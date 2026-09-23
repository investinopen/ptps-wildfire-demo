// Scott & Burgan 40 fire behavior fuel models, from LANDFIRE (USGS/USFS, public domain)
const FUEL_MODEL_SERVICE_URL =
  "https://edcintl.cr.usgs.gov/arcgis/rest/services/Landfire_LF2025/LF2025_FBFM40_CONUS/ImageServer";
// the raster's underlying pixel values for each code (LANDFIRE's standard FBFM40
// numbering: 9x nonburnable, 1xx grass, 12x grass-shrub, 14x shrub, 16x
// timber-understory, 18x timber-litter, 20x slash-blowdown), spot-checked against
// live /identify calls at a few points
const FUEL_MODEL_VALUES = {
  NB1: 91,
  NB2: 92,
  NB3: 93,
  NB8: 98,
  NB9: 99,
  GR1: 101,
  GR2: 102,
  GR3: 103,
  GR4: 104,
  GR5: 105,
  GR6: 106,
  GR7: 107,
  GR8: 108,
  GS1: 121,
  GS2: 122,
  GS3: 123,
  GS4: 124,
  SH1: 141,
  SH2: 142,
  SH3: 143,
  SH4: 144,
  SH5: 145,
  SH6: 146,
  SH7: 147,
  SH8: 148,
  SH9: 149,
  TU1: 161,
  TU2: 162,
  TU3: 163,
  TU4: 164,
  TU5: 165,
  TL1: 181,
  TL2: 182,
  TL3: 183,
  TL4: 184,
  TL5: 185,
  TL6: 186,
  TL7: 187,
  TL8: 188,
  TL9: 189,
  SB1: 201,
  SB2: 202,
  SB3: 203,
  SB4: 204,
};

// fire spreads faster and burns more intensely with more fuel, so we use the load
// LANDFIRE's own model names call out ("low"/"moderate"/"high"/"very high") as a
// stand-in for risk -- nonburnable and low/sparse-load models are left out; a few
// models with no load word in their name (TU4, TL4, TL7, TL8) are judgment calls
// based on what they describe
const MODERATE_HIGH_RISK_CODES = [
  "GR4",
  "GR6",
  "GR7",
  "GR8",
  "GS2",
  "GS3",
  "GS4",
  "SH2",
  "SH3",
  "SH5",
  "SH7",
  "SH8",
  "SH9",
  "TU2",
  "TU3",
  "TU4",
  "TU5",
  "TL3",
  "TL5",
  "TL6",
  "TL7",
  "TL8",
  "TL9",
  "SB2",
  "SB3",
  "SB4",
];

// every included code maps to the same opaque red -- we only need the colormap to
// decide what's transparent (the mask below replaces the actual fill), so there's no
// reason to carry a distinct color per fuel type anymore
const FUEL_MODEL_COLORMAP = JSON.stringify({
  rasterFunction: "Colormap",
  rasterFunctionArguments: {
    colormap: MODERATE_HIGH_RISK_CODES.map((code) => [
      FUEL_MODEL_VALUES[code],
      255,
      0,
      0,
    ]),
  },
});

const FUEL_MODEL_EXPORT_URL =
  FUEL_MODEL_SERVICE_URL +
  "/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32" +
  "&interpolation=RSP_NearestNeighbor&renderingRule=" +
  encodeURIComponent(FUEL_MODEL_COLORMAP) +
  "&f=image";

// an 12px tile of thin diagonal lines, repeated to fill the risk mask below
const HATCH_SIZE = 12;
const makeHatchTile = () => {
  const patternCanvas = new OffscreenCanvas(HATCH_SIZE, HATCH_SIZE);
  const pctx = patternCanvas.getContext("2d");
  pctx.strokeStyle = "#d62828";
  pctx.lineWidth = 0.6;
  for (const offset of [-HATCH_SIZE, 0, HATCH_SIZE]) {
    pctx.beginPath();
    pctx.moveTo(offset, HATCH_SIZE);
    pctx.lineTo(offset + HATCH_SIZE, 0);
    pctx.stroke();
  }
  return patternCanvas;
};
const hatchTile = makeHatchTile();

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
// map clear. Browns rather than the usual fire reds/oranges, which the buildings,
// fuel hatch, and hydrants already use.
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

// wraps the LANDFIRE tile fetch: keeps the colormap's opacity as a mask of where
// moderate/high risk fuels are, but swaps its fill for the diagonal hatch instead of a
// solid color, since risk areas should read as "hazard" rather than "this color means
// this fuel type" -- registered as a protocol the same way pmtiles:// is in main.js
maplibregl.addProtocol("fuelhatch", async (params) => {
  const url = params.url.replace("fuelhatch://", "");
  const response = await fetch(url);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");

  // each tile draws the hatch starting from its own local (0,0), so without this the
  // lines jump out of phase at every tile edge -- shift the pattern by this tile's
  // real-world position (mod the tile size) so it reads as one continuous hatch
  const [, xmin, , xmax, ymax] = url
    .match(/bbox=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/)
    .map(Number);
  const metersPerPixel = (xmax - xmin) / bitmap.width;
  const mod = (n, m) => ((n % m) + m) % m;
  const offsetX = mod(-xmin / metersPerPixel, HATCH_SIZE);
  const offsetY = mod(ymax / metersPerPixel, HATCH_SIZE);
  const pattern = ctx.createPattern(hatchTile, "repeat");
  pattern.setTransform(new DOMMatrix().translate(offsetX, offsetY));

  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { data: await blob.arrayBuffer() };
});

export const FUEL_MODEL_URL = "fuelhatch://" + FUEL_MODEL_EXPORT_URL;
