// This code computes the Ecosystem Functional Attributes (EFAs) and Ecosystem Functional Types (EFTs) of a period
// EFAs are Annual Mean, SD, MMax, Min; see Cazorla et al. 2020. Ecosystems.
// Authors: Domingo Alcaraz-Segura, Javier Blanco, Camilo Bagnato, Juanma Cintas, Beatriz Cazorla
// CAESCG, University of Almería and Dept. of Botany, University of Granada (Spain)
// Contact: e-mail: b.cazorla@ual.es, dalcaraz@ugr.es


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////// 1) SETTING VARIABLES FOR ANALYSIS (Modify only these sections) ////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var GDriveOutputImgFolder = 'GEEOutputs';
var VarForSeason = 'SD'; //'SD' or 'CV' Seasonality


// 1.1 ) Definition of the studied period
  var FirstYear = 2001; // First year of the studied period
  var LastYear = 2018;  // Last year of the studied period
    var TimeFrame = ee.List.sequence(FirstYear, LastYear); // Do not modify this variable
    var NumberYears = LastYear - FirstYear + 1; // Do not modify this variable


// 1.2) Select Image Collection // Do not modify this section
var coll1 = ee.ImageCollection('MODIS/006/MOD13Q1').filterDate(String(FirstYear)+'-01-01', String(LastYear)+'-12-31'); // EVI y NDVI


// 1.3) Select the target variable/spectral index // 
var SelectedVariableName = 'EVI'
var SelectedVariable = coll1.select([SelectedVariableName]); // EVI index, selected from the "MODIS/006/MOD13Q1" collection


// 1.4) Study area  // Be CAREFUL the whole world must be visualized before exportation of a particular region!!!!!!                  
  // See https://developers.google.com/earth-engine/importing for more information about hot to create and importe Feature Collections
var UseRegion = 1; // Set to 0 to compute the Globe
if (UseRegion == 1){

  var region = ee.FeatureCollection('users/bpc315/Shared_BajaCalifornia/Limite_SN_LatLonWGS84') // Shape o Rectangle o Geometry
  Map.addLayer(region, false);  
}

//////////////////////////////////
///2) COMPUTATION OF VARIABLES ///
//////////////////////////////////

// 1 --> compute the variable. 0 --> do not compute the variable

// 2.1) Annual EFAs //


//Import MODIS image collection, define temporal subset

// Negative EVI vvalues to zero
SelectedVariable = SelectedVariable.map(function(img){
    var tmp = img.clip(region);
    var mask = tmp.lt(0)
    var out = tmp.multiply(mask.not())
    out = out.copyProperties(img, ['system:time_start','system:time_end'])
    return(out)
  })




//Function to calculate the mean year
var months = ee.List.sequence(1, 12);

print('SelectedVariable',SelectedVariable)
var Evi_mensual = months.map(function(m) {
  // Filter to 1 month.
  var Evi_men0 = SelectedVariable.filter(ee.Filter.calendarRange(m, m, 'month')).mean();
  // add month band for MMax
  var Evi_men = Evi_men0;
  return  Evi_men.addBands(ee.Image.constant(m).select([0],['month']).int8());
});

var Evi_mensual = ee.ImageCollection(Evi_mensual);
    if (UseRegion == 1){
    var Evi_mensual = ee.ImageCollection(Evi_mensual
    .map(function(image){
      var xx = image.clip(region);
      return xx;
    }));
      }
      
//Calculation of metrics or EFAs

var Media = Evi_mensual.select(SelectedVariableName).mean();
print('Mean',Media)
var Max = Evi_mensual.qualityMosaic(SelectedVariableName);
//print(Max)
var MMax = Max.select(['month']);
print ('MMax', MMax)
if (VarForSeason == 'SD'){
  var Season = Evi_mensual.select([SelectedVariableName]).reduce(ee.Reducer.stdDev());
  print('SD', Season)
}
if (VarForSeason == 'CV'){
  var SD = Evi_mensual.select([SelectedVariableName]).reduce(ee.Reducer.stdDev());
  var Season = SD.divide(Media)
  print('CV', Season)
}
//Map.addLayer(Media, { min: -5000, max:8000, gamma:1.3}, "Mean");
//Map.addLayer(Season, { min: 0, max:1000, gamma:1.3}, "Season");
//Map.addLayer(MMax, { min: 1, max:12, gamma:1.3}, "MMax");


//var TFE (EFT) =  ee.ImageCollection.fromImages([Media, MMax, Season])
var TFE = Media.addBands([Season,MMax])


//Calculation of quartiles

var quartM = Media.reduceRegion({
              reducer: ee.Reducer.percentile([25,50,75]),
              geometry: region,
              crs:'EPSG:4326',
              scale: 1,
              bestEffort: true,
              maxPixels: 10000
              });

print (quartM)
var Mp25 = ee.Image.constant(quartM.get(String(SelectedVariableName)+'_p25'))
var Mp50 = ee.Image.constant(quartM.get(String(SelectedVariableName)+'_p50'))
var Mp75 = ee.Image.constant(quartM.get(String(SelectedVariableName)+'_p75'))

var quartSeason = Season.reduceRegion({
              reducer: ee.Reducer.percentile([25,50,75]),
              geometry: region,
              crs:'EPSG:4326',
              scale: 1,
              bestEffort: true,
              maxPixels: 10000
              });
print (quartSeason)

var Season25 = ee.Image.constant(quartSeason.get(String(SelectedVariableName)+'_stdDev_p25'))
var Season50 = ee.Image.constant(quartSeason.get(String(SelectedVariableName)+'_stdDev_p50'))
var Season75 = ee.Image.constant(quartSeason.get(String(SelectedVariableName)+'_stdDev_p75'))

//EFTs classification based on quartiles and seasons of the year for the MMax

var PPN = Media.where(Media.lte(Mp25), 100)
PPN = PPN.where(Media.gt(Mp25).and(Media.lte(Mp50)),200) 
PPN = PPN.where(Media.gt(Mp50).and(Media.lte(Mp75)), 300)
PPN = PPN.where(Media.gt(Mp75), 400) 

var Seasonality = Season.where(Season.lte(Season25), 40)
Seasonality = Seasonality.where(Season.gt(Season25).and(Season.lte(Season50)),30) 
Seasonality = Seasonality.where(Season.gt(Season50).and(Season.lte(Season75)), 20)
Seasonality = Seasonality.where(Season.gt(Season75), 10) 


var Feno = MMax.where(MMax.lte(3), 4)
Feno = Feno.where(MMax.gt(3).and(MMax.lte(6)),1) 
Feno = Feno.where(MMax.gt(6).and(MMax.lte(9)), 2)
Feno = Feno.where(MMax.gt(9), 3) 

//EFTs with the shape 111 to 444
var TFEcat = PPN.int().addBands([Seasonality,Feno]).int();  
var TFEunib = TFEcat.reduce(ee.Reducer.sum())

//EFTs from 1 to 64
var clasInpt = ([111, 112, 113, 114, 121, 122, 123, 124,
131, 132, 133, 134, 141, 142, 143, 144, 211, 212, 213, 214, 221, 
222, 223, 224, 231, 232, 233, 234, 241, 
242, 243, 244, 311, 312, 313, 314, 321, 322, 323, 324,
331, 332, 333, 334, 341, 342, 343, 344, 411, 412, 413, 414, 421, 
422, 423, 424, 431, 432, 433, 434, 441, 442, 443, 444])

var clasesF = ee.List.sequence(1, 64)

var TFEclas = TFEunib.remap(clasInpt, clasesF)

print('TFE111-444',TFEunib)
print('TFE1-64',TFEclas)

//Display the EFTs on the map, you can click on a study area.

// activate with study area shapes
var clipped = TFEclas.clip(region)

var vizParams = { min: 1, max:64,'palette':"6000E8, 8D00FF, A400D3, 3A00E6, 4100AF, 3900B9, 2E00C3, 5500DC, 4E0068, 55007C, 51008E, 4B00A6, 000000, 380032, 450052, 44005C, 005DFF, 0072FF, 0087FF, 009DFF, 00B2FF, 00C7FF, 00DCFF, 00F2FF, 00FFF6, 00FFE1, 00FFCB, 00FFBB, 00FFA5,	00FF90, 00FF7B, 00FF69, 00FF4E, 00FF3B, 00FF26, 00FF10, 04FF00, 19FF00, 2EFF00, 43FF00, 59FF00, 6EFF00, 83FF00, 99FF00, A9FF00, BFFF00, D4FF00, E9FF00, FFFF00, FFE900, FFD400, FFBF00, FFAA00, FF9400, FF7F00, FF6A00, FF5500, FF3F00, FF2A00, FF1500, FF0000, E90000, D40000, BF0000"};
var vizParams2 = { min: 1, max:4, gamma:1.3}
//Map.addLayer(TFEunib, vizParams, 'TFE111-444');
Map.addLayer(TFEclas, vizParams, 'TFE1-64');

//Map.addLayer(clipped, vizParams, 'EFTs');

//Exporta las imagenes
//Export.image(Media, 'Media_Evi_rz', {maxPixels: 1000000000000, scale:231.65, region:[[180,85],[180,-60],[-180,-60],[-180,85]]});
//Export.image(clipped, 'TFE_Chaco-PRP', {maxPixels: 1000000000, scale:231.65, region:area.geometry()});
  var prod = ee.Image(SelectedVariable.first());
  var projection = prod.projection();
  var crs = projection.crs();
  var crs = crs.getInfo();
  var crs = crs.replace(/\:/g, '');
  //print(crs, 'crs')
  var NativeResol = projection.nominalScale();
  var NativeResol = NativeResol.getInfo();
  print(projection, 'proj');
  
  var ResolOfExport = NativeResol; // "NativeResol" or "DefinedByUser" or "ExternalResol", deppending on if we want the native resolution of the data o a resolution defined by the user


    Export.image.toDrive({
      image: Media,
      description: 'Mean',
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: ResolOfExport
    });
Map.addLayer(Media, { min: 1, max:10000, gamma:1.3}, 'Media', false);


if (VarForSeason == 'SD'){
  Export.image.toDrive({
    image: Season,
    description: 'SD',
    maxPixels: 1e13,
    folder: GDriveOutputImgFolder,
    scale: ResolOfExport
  });
  Map.addLayer(Season, { min: 1, max:10000, gamma:4}, 'SD', false);
}

if (VarForSeason == 'CV'){
  Export.image.toDrive({
    image: Season,
    description: 'CV',
    maxPixels: 1e13,
    folder: GDriveOutputImgFolder,
    scale: ResolOfExport
  });
  Map.addLayer(Season, { min: 0, max:1, gamma:4}, 'CV', false);
}

    Export.image.toDrive({
      image: MMax,
      description: 'MMax',
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: ResolOfExport
    });
Map.addLayer(MMax, { min: 1, max:12, gamma:1.3}, 'MMax', false);

    Export.image.toDrive({
      image: TFEcat,
      description: 'TFE3bands',
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: ResolOfExport
    });


    Export.image.toDrive({
      image: TFEclas,
      description: 'TFE1-64',
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: ResolOfExport
    });
    
    
    Export.image.toDrive({
      image: TFEunib,
      description: 'TFE111-444',
      maxPixels: 1e13,
      folder: GDriveOutputImgFolder,
      scale: ResolOfExport
    });
