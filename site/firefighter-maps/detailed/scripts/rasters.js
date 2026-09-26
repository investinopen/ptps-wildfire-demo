// mean headfire flame length (feet) if a fire occurs, from USFS Wildfire Risk to
// Communities (Rocky Mountain Research Station / Pyrologix, public domain):
// https://data-usfs.hub.arcgis.com/datasets/usfs::wildfire-risk-to-communities-conditional-flame-length-image-service/about
const FLAME_LENGTH_SERVICE_URL =
  "https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WRC_ConditionalFlameLength/ImageServer";
// classed at the NWCG "hauling chart" thresholds, since those are what decide how a
// fire can be attacked -- rather than the service's own 7 classes, which don't break
// at 11 ft. Under 4 ft (hand crews can work the head) is left unshaded to keep the
// map clear. Every class is drawn in the same deep orange (see the flamehatch://
// protocol below), told apart by how dense its hatch is rather than by hue: thin lines don't show their color well, density survives grayscale printing, and it leaves red to the buildings alone.
// https://www.nwcg.gov/publications/pms437/surface-fire/interpreting-expected-surface-fire-behavior
export const FLAME_LENGTH_CLASSES = [
  {
    min: 4,
    max: 8,
    // sparse "/"
    hatch: { spacing: 16, directions: ["/"] },
    range: "4–8 ft",
    meaning: "too hot for hand tools at the head",
  },
  {
    min: 8,
    max: 11,
    // dense "/"
    hatch: { spacing: 8, directions: ["/"] },
    range: "8–11 ft",
    meaning: "torching/spotting; head attack likely fails",
  },
  {
    // the raster is 16-bit, so this covers everything above 11 ft
    min: 11,
    max: 65536,
    // dense crosshatch
    hatch: { spacing: 8, directions: ["/", "\\"] },
    range: "11+ ft",
    meaning: "crowning & major runs; no head attack",
  },
];
// reclassify the raw feet into one value per class (anything unmatched, i.e. under
// 4 ft or non-burnable, becomes transparent), then color each class by its number (1, 2, 3) in the red channel -- not for display, just so the flamehatch:// protocol can tell which class each pixel is in
export const FLAME_LENGTH_RENDERING_RULE = JSON.stringify({
  rasterFunction: "Colormap",
  rasterFunctionArguments: {
    colormap: FLAME_LENGTH_CLASSES.map((_, i) => [i + 1, i + 1, 0, 0]),
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

// a deep orange: reads as fire, stays clear of the buildings' reds so they pop, and is dark enough for thin lines to show on white and in grayscale
export const HATCH_COLOR = [209, 101, 11];
// a faint wash of HATCH_COLOR under the lines, so each class reads as an area rather than loose lines
export const HATCH_TINT = 0.08;
export const HATCH_LINE_WIDTH = 1.5;
// how often the whole hatch repeats, in pixels -- a multiple of every class's spacing, so they all stay in phase across tiles
export const HATCH_SIZE = 16;

// how much of pixel (x, y) a class's hatch lines cover, from 0 to 1, antialiased. "/" lines run where x + y is a multiple of the spacing, "\" where x - y is.
export const hatchCoverage = ({ spacing, directions }, x, y) => {
  let coverage = 0;
  for (const direction of directions) {
    const along = direction === "/" ? x + y : x - y;
    // along is measured diagonally, so the distance to the nearest line is 1/sqrt(2) of the gap
    const distance =
      Math.abs(along - spacing * Math.round(along / spacing)) / Math.SQRT2;
    const lineCoverage = Math.min(
      Math.max(HATCH_LINE_WIDTH / 2 - distance + 0.5, 0),
      1,
    );
    coverage = Math.max(coverage, lineCoverage);
  }
  return coverage;
};

// the same hatch as CSS, for the legend swatches -- a -45deg gradient runs toward the top left, so its stripes run "/", and a 45deg one "\"
export const hatchCss = ({ spacing, directions }) => {
  const [r, g, b] = HATCH_COLOR;
  const color = `rgb(${r},${g},${b})`;
  const tint = `rgba(${r},${g},${b},${HATCH_TINT})`;
  const lines = directions.map((direction) => {
    const angle = direction === "/" ? "-45deg" : "45deg";
    return `repeating-linear-gradient(${angle}, ${color} 0 ${HATCH_LINE_WIDTH}px, transparent ${HATCH_LINE_WIDTH}px ${spacing / Math.SQRT2}px)`;
  });
  return [...lines, `linear-gradient(${tint}, ${tint})`, "#ffffff"].join(", ");
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

// handles flamehatch:// tile URLs, wrapping the flame length tile fetch: the service marks each pixel's class (see FLAME_LENGTH_RENDERING_RULE), and this redraws it in HATCH_COLOR, as solid as its class's hatch covers it. Registered with MapLibre in main.js, the same way as pmtiles://.
export const flameHatchProtocol = async (params, abortController) => {
  const url = params.url.replace("flamehatch://", "");
  const response = await fetch(url, { signal: abortController.signal });
  const bitmap = await createImageBitmap(await response.blob());
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  const pixels = image.data;

  const [offsetX, offsetY] = hatchOffset(url, width);
  const [r, g, b] = HATCH_COLOR;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const flameClass = FLAME_LENGTH_CLASSES[pixels[i] - 1];
      if (pixels[i + 3] === 0 || !flameClass) {
        pixels[i + 3] = 0;
        continue;
      }
      // sampled at the pixel's center, in the hatch's continuous (cross-tile) coordinates
      const coverage = hatchCoverage(
        flameClass.hatch,
        x + 0.5 - offsetX,
        y + 0.5 - offsetY,
      );
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = Math.round(
        255 * (HATCH_TINT + (1 - HATCH_TINT) * coverage),
      );
    }
  }
  ctx.putImageData(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { data: await blob.arrayBuffer() };
};

export const FLAME_LENGTH_URL = "flamehatch://" + FLAME_LENGTH_EXPORT_URL;
