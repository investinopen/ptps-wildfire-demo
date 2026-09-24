// mean headfire flame length (feet) if a fire occurs, from USFS Wildfire Risk to
// Communities (Rocky Mountain Research Station / Pyrologix, public domain):
// https://data-usfs.hub.arcgis.com/datasets/usfs::wildfire-risk-to-communities-conditional-flame-length-image-service/about
const FLAME_LENGTH_SERVICE_URL =
  "https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WRC_ConditionalFlameLength/ImageServer";
// classed at the NWCG "hauling chart" thresholds, since those are what decide how a
// fire can be attacked -- rather than the service's own 7 classes, which don't break
// at 11 ft. Under 4 ft (hand crews can work the head) is left unshaded to keep the
// map clear. Drawn as a diagonal hatch in the usual fire yellow/orange/red (see the
// flamehatch:// protocol below), so the buildings' solid red fills still stand apart.
// The yellow is darker than a typical ramp's so thin lines still show on white.
// https://www.nwcg.gov/publications/pms437/surface-fire/interpreting-expected-surface-fire-behavior
export const FLAME_LENGTH_CLASSES = [
  {
    min: 4,
    max: 8,
    color: [200, 150, 0],
    range: "4–8 ft",
    meaning: "too hot for hand tools at the head",
  },
  {
    min: 8,
    max: 11,
    color: [240, 120, 0],
    range: "8–11 ft",
    meaning: "torching/spotting; head attack likely fails",
  },
  {
    // the raster is 16-bit, so this covers everything above 11 ft
    min: 11,
    max: 65536,
    color: [200, 20, 20],
    range: "11+ ft",
    meaning: "crowning & major runs; no head attack",
  },
];
// reclassify the raw feet into one value per class (anything unmatched, i.e. under
// 4 ft or non-burnable, becomes transparent), then color those classes
export const FLAME_LENGTH_RENDERING_RULE = JSON.stringify({
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

const FLAME_LENGTH_EXPORT_URL =
  FLAME_LENGTH_SERVICE_URL +
  "/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32" +
  "&interpolation=RSP_NearestNeighbor&renderingRule=" +
  encodeURIComponent(FLAME_LENGTH_RENDERING_RULE) +
  "&f=image";

// a hatch tile: a single diagonal ("/"), repeated to fill each class's area
export const HATCH_SIZE = 14;
const HATCH_LINE_WIDTH = 1;
const makeHatchTile = () => {
  const canvas = new OffscreenCanvas(HATCH_SIZE, HATCH_SIZE);
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = HATCH_LINE_WIDTH;
  // drawn three times, offset by a tile, so the ends of the line meet up across tile
  // edges instead of leaving gaps at the corners
  for (const offset of [-HATCH_SIZE, 0, HATCH_SIZE]) {
    ctx.beginPath();
    ctx.moveTo(offset, HATCH_SIZE);
    ctx.lineTo(offset + HATCH_SIZE, 0);
    ctx.stroke();
  }
  return canvas;
};
// made on first use rather than at import, so this module can be loaded without a canvas (e.g. in tests)
let hatchTile;

// the same hatch as CSS, for the legend swatches -- a -45deg gradient runs toward the
// top left, so its stripes run "/" like the tile's
export const hatchCss = ([r, g, b]) => {
  const color = `rgb(${r},${g},${b})`;
  const line = `${color} 0 ${HATCH_LINE_WIDTH}px, transparent ${HATCH_LINE_WIDTH}px ${HATCH_SIZE / Math.SQRT2}px`;
  return `repeating-linear-gradient(-45deg, ${line}), #ffffff`;
};

// where the hatch pattern should start within a tile, in pixels. Each tile draws the hatch starting from its own local (0,0), so without this the lines jump out of phase at every tile edge -- this shifts the pattern by the tile's real-world position (from the exportImage URL's EPSG:3857 bbox, mod the pattern size) so it reads as one continuous hatch.
export const hatchOffset = (url, tileWidth) => {
  const [, xmin, , xmax, ymax] = url
    .match(/bbox=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/)
    .map(Number);
  const metersPerPixel = (xmax - xmin) / tileWidth;
  const mod = (n, m) => ((n % m) + m) % m;
  return [
    mod(-xmin / metersPerPixel, HATCH_SIZE),
    mod(ymax / metersPerPixel, HATCH_SIZE),
  ];
};

// handles flamehatch:// tile URLs, wrapping the flame length tile fetch: the service already colors each class (see FLAME_LENGTH_RENDERING_RULE), so this just keeps those colors where the hatch lines are and clears everything else. Registered with MapLibre in main.js, the same way as pmtiles://.
export const flameHatchProtocol = async (params, abortController) => {
  const url = params.url.replace("flamehatch://", "");
  const response = await fetch(url, { signal: abortController.signal });
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  hatchTile ??= makeHatchTile();
  const pattern = ctx.createPattern(hatchTile, "repeat");
  pattern.setTransform(
    new DOMMatrix().translate(...hatchOffset(url, bitmap.width)),
  );

  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { data: await blob.arrayBuffer() };
};

export const FLAME_LENGTH_URL = "flamehatch://" + FLAME_LENGTH_EXPORT_URL;
