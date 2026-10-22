// The grid of pages an atlas (see atlas.js) splits an area into: equal-sized pages at one zoom, laid out in Web Mercator like the map itself, so every page prints at the same scale and lines up with its neighbors. Kept apart from atlas.js so it can be tested without a browser.
import { inPolygon } from "./places.js";

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

// a GeoJSON Polygon/MultiPolygon as a list of polygons, each a list of rings
const polygonsOf = ({ type, coordinates }) =>
  type === "Polygon" ? [coordinates] : coordinates;

const segmentsCross = ([a, b], [c, d]) => {
  const side = (p, q, r) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

// whether a rect (as [west, north, east, south]) and a polygon (rings of [x, y]) overlap at all: a vertex of one inside the other, or their edges crossing
const rectTouchesPolygon = ([w, n, e, s], rings) => {
  const corners = [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
  const vertexInside = rings.some((ring) =>
    ring.some(([x, y]) => x >= w && x <= e && y >= n && y <= s),
  );
  if (vertexInside || corners.some((c) => inPolygon(c, rings))) return true;
  const rectEdges = corners.map((c, i) => [c, corners[(i + 1) % 4]]);
  return rings.some((ring) =>
    ring
      .slice(1)
      .some((p, i) =>
        rectEdges.some((edge) => segmentsCross(edge, [ring[i], p])),
      ),
  );
};

// how many pages of `size` pixels, overlapping by `step`, cover `span` pixels
const pagesAcross = (span, size, step) =>
  Math.max(1, Math.ceil((span - size) / step) + 1);

// Given an area (a GeoJSON Polygon or MultiPolygon) and the pages' { zoom, width, height } (in CSS pixels) and overlap (a fraction of a page), returns the pages covering it as { cells, rows, cols }, the grid centered on the area. Each cell is { number, row, col, center: [lng, lat], bounds: [[west, south], [east, north]], neighbors: { north, south, east, west } } (page numbers), numbered across then down, leaving out pages that would be entirely outside the area.
export const atlasGrid = (geometry, { zoom, width, height, overlap }) => {
  const polygons = polygonsOf(geometry).map((rings) =>
    rings.map((ring) => ring.map((c) => Object.values(toWorld(c, zoom)))),
  );
  const points = polygons.flat(2);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const stepX = width * (1 - overlap);
  const stepY = height * (1 - overlap);
  const cols = pagesAcross(maxX - minX, width, stepX);
  const rows = pagesAcross(maxY - minY, height, stepY);
  // the grid's northwest corner, so it's centered over the area
  const x0 = (minX + maxX) / 2 - (width + (cols - 1) * stepX) / 2;
  const y0 = (minY + maxY) / 2 - (height + (rows - 1) * stepY) / 2;

  const numbers = new Map();
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [w, n] = [x0 + col * stepX, y0 + row * stepY];
      const rect = [w, n, w + width, n + height];
      if (!polygons.some((rings) => rectTouchesPolygon(rect, rings))) continue;
      const number = cells.length + 1;
      numbers.set(`${row},${col}`, number);
      cells.push({
        number,
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
  for (const cell of cells) {
    const at = (dRow, dCol) =>
      numbers.get(`${cell.row + dRow},${cell.col + dCol}`);
    cell.neighbors = Object.fromEntries(
      Object.entries({
        north: at(-1, 0),
        south: at(1, 0),
        west: at(0, -1),
        east: at(0, 1),
      }).filter(([, number]) => number),
    );
  }
  return { cells, rows, cols };
};
