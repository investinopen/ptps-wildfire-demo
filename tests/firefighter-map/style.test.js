import {
  Color,
  expression,
  featureFilter,
  latest,
  validateStyleMin,
} from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, test } from "vitest";
import {
  NO_RISK_COLOR,
  RISK_BINS,
} from "../../analysis/firefighter-map/buildings.js";
import {
  BUILDINGS_FILL_LAYER,
  TRAILS_LAYER,
} from "../../analysis/firefighter-map/layers.js";
import { STYLE } from "../../analysis/firefighter-map/style.js";

// MapLibre's own validator, against the style spec version the page's maplibre-gl@6 uses
test("the style is valid", () => {
  expect(validateStyleMin(STYLE)).toEqual([]);
});

test("every layer's source is defined", () => {
  for (const layer of STYLE.layers) {
    if (layer.source) expect(STYLE.sources).toHaveProperty(layer.source);
  }
});

test("layer IDs are unique", () => {
  const ids = STYLE.layers.map((l) => l.id);
  expect(new Set(ids).size).toBe(ids.length);
});

describe("building risk colors", () => {
  // the second argument only labels where an error came from, in error messages
  const fillColor = expression.createPropertyExpression(
    BUILDINGS_FILL_LAYER.paint["fill-color"],
    "buildings-fill.paint.fill-color",
    latest.paint_fill["fill-color"],
  );
  // the tiles' risk score is property "0" (see RISK_PROPERTY)
  const colorFor = (properties) =>
    fillColor.value.evaluate({ zoom: 16 }, { properties }).toString();
  const color = (hex) => Color.parse(hex).toString();

  test("compiles", () => {
    expect(fillColor.result).toBe("success");
  });

  test("zero and missing scores are gray", () => {
    expect(colorFor({ 0: 0 })).toBe(color(NO_RISK_COLOR));
    expect(colorFor({})).toBe(color(NO_RISK_COLOR));
  });

  test("anything above zero starts at the first bin", () => {
    expect(colorFor({ 0: 0.001 })).toBe(color(RISK_BINS[0][1]));
  });

  test.each(RISK_BINS.slice(1))(
    "a score of exactly %s starts its own bin",
    (lowerBound, binColor) => {
      expect(colorFor({ 0: lowerBound })).toBe(color(binColor));
    },
  );

  test("scores above the last bound get the last color", () => {
    expect(colorFor({ 0: 50 })).toBe(color(RISK_BINS.at(-1)[1]));
  });
});

describe("paths and trails", () => {
  const { filter } = featureFilter(TRAILS_LAYER.filter, "trails.filter");
  const shown = (properties) => filter({ zoom: 16 }, { type: 2, properties });

  test.each(["path", "cycleway", "bridleway"])("keeps path/%s", (subclass) => {
    expect(shown({ class: "path", subclass })).toBe(true);
  });

  test("keeps tracks", () => {
    expect(shown({ class: "track", subclass: "track" })).toBe(true);
  });

  // the tiles don't keep footway=sidewalk, so sidewalks are dropped along with all footways
  test.each(["footway", "steps", "pedestrian"])("hides path/%s", (subclass) => {
    expect(shown({ class: "path", subclass })).toBe(false);
  });

  test("doesn't pick up roads", () => {
    expect(shown({ class: "minor" })).toBe(false);
  });
});
