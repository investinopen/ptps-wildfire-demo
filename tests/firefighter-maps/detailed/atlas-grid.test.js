import { describe, expect, test } from "vitest";
import {
  atlasGrid,
  fromWorld,
  numberPages,
  scaleDenominator,
  toWorld,
} from "../../../site/firefighter-maps/detailed/scripts/atlas-grid.js";

// a square of the given size (in world pixels at ZOOM) centered on the origin of the map
const ZOOM = 10;
const square = (size, { x = 0, y = 0 } = {}) => {
  const center = toWorld([0, 0], ZOOM);
  const corner = (dx, dy) =>
    fromWorld({ x: center.x + x + dx, y: center.y + y + dy }, ZOOM);
  const h = size / 2;
  return {
    type: "Polygon",
    coordinates: [
      [
        corner(-h, -h),
        corner(h, -h),
        corner(h, h),
        corner(-h, h),
        corner(-h, -h),
      ],
    ],
  };
};
const page = { zoom: ZOOM, width: 100, height: 100, overlap: 0 };

describe("toWorld/fromWorld", () => {
  test("round-trip", () => {
    const [lng, lat] = fromWorld(toWorld([-105.4, 40.05], 15), 15);
    expect(lng).toBeCloseTo(-105.4, 9);
    expect(lat).toBeCloseTo(40.05, 9);
  });

  test("puts null island in the middle of the world", () => {
    expect(toWorld([0, 0], 0)).toEqual({ x: 256, y: 256 });
  });
});

describe("atlasGrid", () => {
  test("fits a small area on one page", () => {
    const { cells, rows, cols } = atlasGrid(square(50), page);
    expect([rows, cols]).toEqual([1, 1]);
    expect(cells).toHaveLength(1);
    const [lng, lat] = cells[0].center;
    expect(lng).toBeCloseTo(0, 6);
    expect(lat).toBeCloseTo(0, 6);
  });

  test("covers a bigger area with a grid of pages, numbered across then down", () => {
    const { cells, rows, cols } = atlasGrid(square(250), page);
    expect([rows, cols]).toEqual([3, 3]);
    expect(cells.map((c) => [c.number, c.row, c.col])).toEqual([
      [1, 0, 0],
      [2, 0, 1],
      [3, 0, 2],
      [4, 1, 0],
      [5, 1, 1],
      [6, 1, 2],
      [7, 2, 0],
      [8, 2, 1],
      [9, 2, 2],
    ]);
  });

  test("overlaps neighboring pages", () => {
    // 195 px fits on two 100 px pages edge to edge, but not with 10% overlap
    expect(atlasGrid(square(195), page).cols).toBe(2);
    expect(atlasGrid(square(195), { ...page, overlap: 0.1 }).cols).toBe(3);
  });

  test("names each page's neighbors", () => {
    const { cells } = atlasGrid(square(250), page);
    expect(cells[4].neighbors).toEqual({
      north: 2,
      south: 8,
      west: 4,
      east: 6,
    });
    expect(cells[0].neighbors).toEqual({ south: 4, east: 2 });
  });

  test("skips pages that would be outside the area", () => {
    // an L: the top row and left column of a 3x3 grid
    const center = toWorld([0, 0], ZOOM);
    const at = (x, y) => fromWorld({ x: center.x + x, y: center.y + y }, ZOOM);
    const l = {
      type: "Polygon",
      coordinates: [
        [
          at(-145, -145),
          at(145, -145),
          at(145, -60),
          at(-60, -60),
          at(-60, 145),
          at(-145, 145),
          at(-145, -145),
        ],
      ],
    };
    const { cells } = atlasGrid(l, page);
    expect(cells.map((c) => [c.row, c.col])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 0],
    ]);
    // numbered without gaps, and without neighbors that were skipped
    expect(cells.map((c) => c.number)).toEqual([1, 2, 3, 4, 5]);
    expect(cells[3].neighbors).toEqual({ north: 1, south: 5 });
  });

  test("keeps a page that only an edge of the area crosses", () => {
    // a thin diagonal sliver through the middle page's corner, with no vertex or page corner inside the other
    const center = toWorld([0, 0], ZOOM);
    const at = (x, y) => fromWorld({ x: center.x + x, y: center.y + y }, ZOOM);
    const sliver = {
      type: "Polygon",
      coordinates: [
        [
          at(-150, 40),
          at(40, -150),
          at(40.5, -150),
          at(-150, 40.5),
          at(-150, 40),
        ],
      ],
    };
    const { cells } = atlasGrid(sliver, page);
    // only the sliver's edges cross the top left page; the bottom right one misses it
    expect(cells.map((c) => [c.row, c.col])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
  });

  test("covers each part of a multipolygon", () => {
    const a = square(50, { x: -200 }).coordinates;
    const b = square(50, { x: 200 }).coordinates;
    const { cells, cols } = atlasGrid(
      { type: "MultiPolygon", coordinates: [a, b] },
      page,
    );
    expect(cols).toBe(5);
    expect(cells.map((c) => c.col)).toEqual([0, 4]);
  });
});

describe("numberPages", () => {
  test("renumbers the pages left after dropping some", () => {
    const { cells } = atlasGrid(square(250), page);
    // without the middle one
    const kept = numberPages(cells.filter((c) => c.number !== 5));
    expect(kept.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(kept[1].neighbors).toEqual({ west: 1, east: 3 });
    expect(kept[3].neighbors).toEqual({ north: 1, south: 6 });
  });
});

describe("scaleDenominator", () => {
  // MapLibre's tiles are 512 pixels, so its zooms are one off from the 256 pixel ones of OSM's scale tables
  test("is about 1:6,900 at zoom 15 in Colorado", () => {
    expect(scaleDenominator(40, 15)).toBeCloseTo(6_900, -2);
  });
});
