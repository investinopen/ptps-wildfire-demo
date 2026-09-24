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
} from "../../site/firefighter-map/scripts/buildings.js";
import {
  BUILDINGS_FILL_LAYER,
  ROUTE_SHIELDS_LAYER,
  TRAILS_LAYER,
} from "../../site/firefighter-map/scripts/layers.js";
import { STYLE } from "../../site/firefighter-map/scripts/style.js";

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
    expect(colorFor({ 0: 0.001 })).toBe(color(RISK_BINS[0].color));
  });

  test.each(RISK_BINS.slice(1))(
    "a score of exactly $min starts its own bin",
    ({ min, color: binColor }) => {
      expect(colorFor({ 0: min })).toBe(color(binColor));
    },
  );

  test("scores above the last bound get the last color", () => {
    expect(colorFor({ 0: 50 })).toBe(color(RISK_BINS.at(-1).color));
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

describe("route numbers", () => {
  const layout = (property) =>
    expression.createPropertyExpression(
      ROUTE_SHIELDS_LAYER.layout[property],
      `route-shields.layout.${property}`,
      latest.layout_symbol[property],
    );
  const label = layout("text-field");
  const icon = layout("icon-image");
  const evaluate = (expr, properties) =>
    expr.value.evaluate({ zoom: 14 }, { properties }).toString();
  const { filter } = featureFilter(
    ROUTE_SHIELDS_LAYER.filter,
    "route-shields.filter",
  );

  test.each([
    ["us-interstate", "25", "I-25", "interstate-box"],
    ["us-highway", "36", "US 36", "sign-box"],
    ["us-state", "119", "Hwy 119", "sign-box"],
    // county roads' refs already say what they are
    ["road", "CR 52", "CR 52", "sign-box"],
  ])("a %s route %j reads %j on a %s", (network, ref, text, iconName) => {
    expect(evaluate(label, { network, ref })).toBe(text);
    expect(evaluate(icon, { network, ref })).toBe(iconName);
  });

  test("only labels roads that have a number", () => {
    const shown = (properties) => filter({ zoom: 14 }, { type: 2, properties });
    expect(shown({ class: "trunk", ref: "119", network: "us-state" })).toBe(
      true,
    );
    expect(shown({ class: "minor", name: "Gold Run Road" })).toBe(false);
    expect(shown({ class: "path", ref: "123" })).toBe(false);
  });
});
