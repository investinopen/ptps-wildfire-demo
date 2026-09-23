// annual burn probability, from USFS Wildfire Risk to Communities (Rocky Mountain
// Research Station / Pyrologix, public domain):
// https://data-usfs.hub.arcgis.com/datasets/usfs::wildfire-risk-to-communities-burn-probability-image-service/about
const BURN_PROBABILITY_SERVICE_URL =
  "https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WRC_BurnProbability/ImageServer";
// "BurnProbability2024" is the service's own named raster function template -- it's
// what the service already renders by default, but naming it explicitly means we keep
// getting USFS's classification+color ramp even if that default ever changes
const BURN_PROBABILITY_RENDERING_RULE = JSON.stringify({
  rasterFunction: "BurnProbability2024",
});

export const BURN_PROBABILITY_EXPORT_URL =
  BURN_PROBABILITY_SERVICE_URL +
  "/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32" +
  "&interpolation=RSP_NearestNeighbor&renderingRule=" +
  encodeURIComponent(BURN_PROBABILITY_RENDERING_RULE) +
  "&f=image";

// mean headfire flame length (feet) if a fire occurs, from USFS Wildfire Risk to
// Communities (Rocky Mountain Research Station / Pyrologix, public domain):
// https://data-usfs.hub.arcgis.com/datasets/usfs::wildfire-risk-to-communities-conditional-flame-length-image-service/about
const FLAME_LENGTH_SERVICE_URL =
  "https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WRC_ConditionalFlameLength/ImageServer";
// classed at the NWCG "hauling chart" thresholds, since those are what decide how a
// fire can be attacked -- rather than the service's own 7 classes, which don't break
// at 11 ft. Under 4 ft (hand crews can work the head) is left unshaded to keep the
// map clear. Browns rather than the usual fire reds/oranges, which the buildings and
// hydrants already use.
// https://www.nwcg.gov/publications/pms437/surface-fire/interpreting-expected-surface-fire-behavior
export const FLAME_LENGTH_CLASSES = [
  {
    min: 4,
    max: 8,
    color: [254, 224, 139],
    range: "4–8 ft",
    meaning: "too hot for hand tools at the head",
  },
  {
    min: 8,
    max: 11,
    color: [191, 129, 45],
    range: "8–11 ft",
    meaning: "torching/spotting; head attack likely fails",
  },
  {
    // the raster is 16-bit, so this covers everything above 11 ft
    min: 11,
    max: 65536,
    color: [84, 48, 5],
    range: "11+ ft",
    meaning: "crowning & major runs; no head attack",
  },
];
// reclassify the raw feet into one value per class (anything unmatched, i.e. under
// 4 ft or non-burnable, becomes transparent), then color those classes
const FLAME_LENGTH_RENDERING_RULE = JSON.stringify({
  rasterFunction: "Colormap",
  rasterFunctionArguments: {
    colormap: FLAME_LENGTH_CLASSES.map(({ color }, i) => [i + 1, ...color]),
    Raster: {
      rasterFunction: "Remap",
      rasterFunctionArguments: {
        InputRanges: FLAME_LENGTH_CLASSES.flatMap(({ min, max }) => [min, max]),
        OutputValues: FLAME_LENGTH_CLASSES.map((_, i) => i + 1),
        AllowUnmatched: false,
      },
    },
  },
});

export const FLAME_LENGTH_EXPORT_URL =
  FLAME_LENGTH_SERVICE_URL +
  "/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32" +
  "&interpolation=RSP_NearestNeighbor&renderingRule=" +
  encodeURIComponent(FLAME_LENGTH_RENDERING_RULE) +
  "&f=image";
