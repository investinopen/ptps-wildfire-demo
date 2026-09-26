import { describe, expect, test } from "vitest";
import {
  FLAME_LENGTH_CLASSES,
  FLAME_LENGTH_RENDERING_RULE,
  FLAME_LENGTH_URL,
  HATCH_SIZE,
  hatchCoverage,
  hatchCss,
  hatchOffset,
} from "../../../site/firefighter-maps/detailed/scripts/rasters.js";

describe("flame length classes", () => {
  test("are contiguous, starting at 4 ft", () => {
    expect(FLAME_LENGTH_CLASSES[0].min).toBe(4);
    for (let i = 1; i < FLAME_LENGTH_CLASSES.length; i++) {
      expect(FLAME_LENGTH_CLASSES[i].min).toBe(FLAME_LENGTH_CLASSES[i - 1].max);
    }
  });

  test("break at the NWCG hauling chart thresholds", () => {
    expect(FLAME_LENGTH_CLASSES.map((c) => c.min)).toEqual([4, 8, 11]);
  });

  // so every class's hatch stays in phase across tiles (see hatchOffset)
  test("have hatch spacings that divide the pattern size", () => {
    for (const { hatch } of FLAME_LENGTH_CLASSES) {
      expect(HATCH_SIZE % hatch.spacing).toBe(0);
    }
  });
});

describe("rendering rule", () => {
  const rule = JSON.parse(FLAME_LENGTH_RENDERING_RULE);
  const remap = rule.rasterFunctionArguments.Raster;

  test("remaps each class's range to its own value, then marks that value in the red channel", () => {
    expect(rule.rasterFunction).toBe("Colormap");
    expect(remap.rasterFunction).toBe("Remap");
    expect(remap.rasterFunctionArguments.InputRanges).toEqual(
      FLAME_LENGTH_CLASSES.flatMap((c) => [c.min, c.max]),
    );
    expect(remap.rasterFunctionArguments.OutputValues).toEqual([1, 2, 3]);
    expect(rule.rasterFunctionArguments.colormap).toEqual(
      FLAME_LENGTH_CLASSES.map((_, i) => [i + 1, i + 1, 0, 0]),
    );
  });

  // under 4 ft, and non-burnable, should come back transparent
  test("drops unmatched values", () => {
    expect(remap.rasterFunctionArguments.AllowUnmatched).toBe(false);
  });

  test("is sent in the tile URL, behind the flamehatch:// protocol", () => {
    expect(FLAME_LENGTH_URL).toMatch(/^flamehatch:\/\/https:\/\//);
    expect(FLAME_LENGTH_URL).toContain(
      "renderingRule=" + encodeURIComponent(FLAME_LENGTH_RENDERING_RULE),
    );
    expect(FLAME_LENGTH_URL).toContain("bbox={bbox-epsg-3857}");
  });
});

describe("hatchOffset", () => {
  const tileUrl = (xmin, ymin, xmax, ymax) =>
    `https://example.com/exportImage?bbox=${xmin},${ymin},${xmax},${ymax}&bboxSR=3857`;
  const tileWidth = 256;
  const tileMeters = 611.5; // about one tile's width at zoom 16

  test("stays within one repeat of the pattern", () => {
    const [x, y] = hatchOffset(
      tileUrl(-11731000, 4871000, -11731000 + tileMeters, 4871000 + tileMeters),
      tileWidth,
    );
    for (const n of [x, y]) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(HATCH_SIZE);
    }
  });

  // the pattern at a tile's right edge should pick up where it left off at the next tile's left edge
  test("lines neighboring tiles up with each other", () => {
    const xmin = -11731000;
    const ymin = 4871000;
    const [left] = hatchOffset(
      tileUrl(xmin, ymin, xmin + tileMeters, ymin + tileMeters),
      tileWidth,
    );
    const [right] = hatchOffset(
      tileUrl(
        xmin + tileMeters,
        ymin,
        xmin + 2 * tileMeters,
        ymin + tileMeters,
      ),
      tileWidth,
    );
    const mod = (n) => ((n % HATCH_SIZE) + HATCH_SIZE) % HATCH_SIZE;
    expect(mod(left - tileWidth)).toBeCloseTo(right, 6);
  });

  test("handles negative coordinates", () => {
    const [x, y] = hatchOffset(
      tileUrl(-20000, -20000, -20000 + tileMeters, -20000 + tileMeters),
      tileWidth,
    );
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });
});

describe("hatchCoverage", () => {
  const slash = { spacing: 8, directions: ["/"] };
  const cross = { spacing: 8, directions: ["/", "\\"] };

  test("fully covers a pixel on a line", () => {
    expect(hatchCoverage(slash, 4, 4)).toBe(1);
  });

  test("leaves a pixel between lines clear", () => {
    expect(hatchCoverage(slash, 2, 2)).toBe(0);
  });

  test("a / hatch misses the \\ lines that a crosshatch adds", () => {
    expect(hatchCoverage(slash, 2, 2)).toBe(0);
    expect(hatchCoverage(cross, 2, 2)).toBe(1);
  });

  test("repeats every spacing", () => {
    expect(hatchCoverage(slash, 3.5, 1)).toBeCloseTo(
      hatchCoverage(slash, 3.5 + 8, 1),
    );
  });
});

describe("hatchCss", () => {
  test("draws a / hatch as one gradient", () => {
    const css = hatchCss({ spacing: 16, directions: ["/"] });
    expect(css.match(/repeating-linear-gradient/g)).toHaveLength(1);
    expect(css).toContain("repeating-linear-gradient(-45deg");
  });

  test("draws a crosshatch as two", () => {
    const css = hatchCss({ spacing: 8, directions: ["/", "\\"] });
    expect(css).toContain("repeating-linear-gradient(-45deg");
    expect(css).toContain("repeating-linear-gradient(45deg");
  });
});
