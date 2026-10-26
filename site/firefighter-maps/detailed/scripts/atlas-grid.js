// The grid of pages an atlas (see atlas.js) splits an area into: equal-sized pages at one zoom, laid out in Web Mercator like the map itself, so every page prints at the same scale and lines up with its neighbors. Kept apart from atlas.js so it can be tested without a browser.

// MapLibre's world is 512 pixels across at zoom 0
const TILE_SIZE = 512;
const EARTH_CIRCUMFERENCE = 40_075_016.686; // meters, at the equator
// a CSS pixel on paper
const METERS_PER_CSS_PIXEL = 0.0254 / 96;

// [lng, lat] as { x, y } pixels across the whole world at the zoom, from its northwest corner
export const toWorld = ([lng, lat], zoom) => {
  const size = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
};

export const fromWorld = ({ x, y }, zoom) => {
  const size = TILE_SIZE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / size;
  return [(x / size) * 360 - 180, (Math.atan(Math.sinh(n)) * 180) / Math.PI];
};

// the 1:N of a map printed at its CSS size, at the latitude and zoom
export const scaleDenominator = (lat, zoom) =>
  (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) /
  (TILE_SIZE * 2 ** zoom) /
  METERS_PER_CSS_PIXEL;

// the zoom that prints at 1:`denominator` at the latitude -- the inverse of scaleDenominator
export const zoomForScale = (lat, denominator) =>
  Math.log2(
    (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) /
      (TILE_SIZE * METERS_PER_CSS_PIXEL * denominator),
  );

// how many pages of `size` pixels, overlapping by `step`, cover `span` pixels
const pagesAcross = (span, size, step) =>
  Math.max(1, Math.ceil((span - size) / step) + 1);

// The pages (each with a row and col), numbered in the order given, with each one's neighbors' numbers as { north, south, east, west } -- leaving out neighbors that aren't among them, so pages can be dropped (e.g. empty ones) and the rest renumbered.
export const numberPages = (cells) => {
  const numbers = new Map(cells.map((c, i) => [`${c.row},${c.col}`, i + 1]));
  return cells.map((cell, i) => {
    const at = (dRow, dCol) =>
      numbers.get(`${cell.row + dRow},${cell.col + dCol}`);
    const neighbors = Object.fromEntries(
      Object.entries({
        north: at(-1, 0),
        south: at(1, 0),
        west: at(0, -1),
        east: at(0, 1),
      }).filter(([, number]) => number),
    );
    return { ...cell, number: i + 1, neighbors };
  });
};

// Given an area's bounds ([[west, south], [east, north]]) and the pages' { zoom, width, height } (in CSS pixels) and overlap (a fraction of a page), returns the pages covering it as { cells, rows, cols }, the grid centered on the area. Each cell is { number, row, col, center: [lng, lat], bounds: [[west, south], [east, north]], neighbors: { north, south, east, west } } (page numbers), numbered across then down.
export const atlasGrid = ([sw, ne], { zoom, width, height, overlap }) => {
  // y grows southward in Web Mercator's world pixels
  const { x: minX, y: maxY } = toWorld(sw, zoom);
  const { x: maxX, y: minY } = toWorld(ne, zoom);
  const stepX = width * (1 - overlap);
  const stepY = height * (1 - overlap);
  const cols = pagesAcross(maxX - minX, width, stepX);
  const rows = pagesAcross(maxY - minY, height, stepY);
  // the grid's northwest corner, so it's centered over the area
  const x0 = (minX + maxX) / 2 - (width + (cols - 1) * stepX) / 2;
  const y0 = (minY + maxY) / 2 - (height + (rows - 1) * stepY) / 2;

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [w, n] = [x0 + col * stepX, y0 + row * stepY];
      cells.push({
        row,
        col,
        center: fromWorld({ x: w + width / 2, y: n + height / 2 }, zoom),
        bounds: [
          fromWorld({ x: w, y: n + height }, zoom),
          fromWorld({ x: w + width, y: n }, zoom),
        ],
      });
    }
  }
  return { cells: numberPages(cells), rows, cols };
};
