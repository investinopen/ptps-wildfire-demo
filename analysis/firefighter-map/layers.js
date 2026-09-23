import {
  BUILDING_MIN_ZOOM,
  RISK_BINS,
  NO_RISK_COLOR,
  RISK_PROPERTY,
  SOURCE_LAYER,
} from "./buildings.js";

// a small right-pointing arrow, registered as a map image in main.js -- line-placed symbols
// orient a 0deg icon along the line's own direction, so "right" is the convention
export const makeArrowIcon = () => {
  const size = 14;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(size - 2, size / 2);
  ctx.lineTo(2, size - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
};

// one const per layer -- keeping these standalone makes the draw order (the `layers`
// array in main.js) easy to see and rearrange without hunting through each definition
export const HILLSHADE_LAYER = {
  id: "hillshade",
  type: "hillshade",
  source: "hillshadeSource",
  layout: { visibility: "visible" },
  paint: { "hillshade-exaggeration": 0.3 },
};

// on by default -- toggled via the layer control
export const FUEL_MODELS_LAYER = {
  id: "fuel-models",
  type: "raster",
  source: "fuelModels",
  layout: { visibility: "visible" },
  // a hatch pattern already reads as sparse, unlike a solid fill, so this can sit
  // much closer to fully opaque
  paint: { "raster-opacity": 0.9 },
};

// off by default -- toggled via the layer control. It's a regional-scale measure, so in
// fire-prone areas it's uniformly high across a whole neighborhood and just tints the
// map red. This is USFS's own classification + color ramp, so unlike the fuel-model
// hatch above it's a solid fill and needs to stay translucent enough for
// roads/hillshade/labels underneath to stay legible
export const BURN_PROBABILITY_LAYER = {
  id: "burn-probability",
  type: "raster",
  source: "burnProbability",
  layout: { visibility: "none" },
  paint: { "raster-opacity": 0.4 },
};

// on by default -- toggled via the layer control; translucent for the same reason as
// burn probability above
export const FLAME_LENGTH_LAYER = {
  id: "flame-length",
  type: "raster",
  source: "flameLength",
  layout: { visibility: "visible" },
  paint: { "raster-opacity": 0.5 },
};

export const WATER_LAYER = {
  id: "water",
  type: "fill",
  source: "roadsSource",
  "source-layer": "water",
  paint: {
    "fill-color": "#a3d3e8",
  },
};

export const WATERWAYS_LAYER = {
  id: "waterways",
  type: "line",
  source: "roadsSource",
  "source-layer": "waterway",
  paint: {
    "line-color": "#a3d3e8",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 18, 2],
  },
};

// actual drivable road classes -- excluding this way (an allowlist) rather than just
// excluding driveways/tracks/paths means rail/transit/tram/ferry/aerialway lines,
// which the previous exclusion-only filter let through, don't render as "roads" too
// https://openmaptiles.org/schema/#transportation
export const DRIVABLE_ROAD_CLASSES = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "minor",
];

export const ROADS_LAYER = {
  id: "roads",
  type: "line",
  source: "roadsSource",
  "source-layer": "transportation",
  filter: ["in", ["get", "class"], ["literal", DRIVABLE_ROAD_CLASSES]],
  layout: { visibility: "visible" },
  paint: {
    // near-black, like a topo map -- every brighter hue is already taken by a
    // hazard/risk layer, and it stays legible when printed in grayscale
    "line-color": "#2b2b2b",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 18, 4],
  },
};

// fed by live Overpass data (see OVERPASS_GROUPS in overpass.js), not roadsSource -- its "oneway"
// field isn't reliable in this tileset
export const ONEWAY_ARROWS_LAYER = {
  id: "oneway-arrows",
  type: "symbol",
  source: "oneway",
  minzoom: 15,
  layout: {
    visibility: "visible",
    "icon-image": "oneway-arrow",
    "icon-size": 0.8,
    "symbol-placement": "line",
    "symbol-spacing": 80,
    "icon-rotation-alignment": "map",
    // a way digitized in reverse (oneway=-1) points the wrong way by default;
    // flip its arrow 180 degrees to still point the direction traffic actually flows
    "icon-rotate": ["match", ["get", "oneway"], -1, 180, 0],
    "icon-allow-overlap": true,
  },
};

// private roads/driveways (class "service") -- styled thinner + a different hue to
// read as minor, same as OSM data allows
// https://wiki.openstreetmap.org/wiki/Key:highway#Highway
export const DRIVEWAYS_LAYER = {
  id: "driveways",
  type: "line",
  source: "roadsSource",
  "source-layer": "transportation",
  filter: ["==", ["get", "class"], "service"],
  layout: { visibility: "visible" },
  paint: {
    "line-color": "#8855c8",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 18, 1.5],
  },
};

// unpaved tracks and foot/bike/horse paths (class "track", "path") --
// https://wiki.openstreetmap.org/wiki/Tag:highway%3Dtrack
// https://wiki.openstreetmap.org/wiki/Tag:highway%3Dpath
export const TRAILS_LAYER = {
  id: "trails",
  type: "line",
  source: "roadsSource",
  "source-layer": "transportation",
  filter: ["in", ["get", "class"], ["literal", ["track", "path"]]],
  layout: { visibility: "visible" },
  paint: {
    "line-color": "#6b8e23",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 18, 1.5],
    "line-dasharray": [2, 1.5],
  },
};

export const ROAD_LABELS_LAYER = {
  id: "road-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "transportation_name",
  filter: ["in", ["get", "class"], ["literal", DRIVABLE_ROAD_CLASSES]],
  layout: {
    visibility: "visible",
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
    "symbol-placement": "line",
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

export const TRAIL_LABELS_LAYER = {
  id: "trail-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "transportation_name",
  filter: ["in", ["get", "class"], ["literal", ["track", "path"]]],
  layout: {
    visibility: "visible",
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
    "symbol-placement": "line",
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

export const WATER_LABELS_LAYER = {
  id: "water-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "water_name",
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

export const BUILDINGS_FILL_LAYER = {
  id: "buildings-fill",
  type: "fill",
  source: "buildings",
  "source-layer": SOURCE_LAYER,
  minzoom: BUILDING_MIN_ZOOM,
  layout: { visibility: "visible" },
  paint: {
    // same shape as CarbonPlan's own expression; a building with no score at all
    // gets the zero gray too, rather than looking like it's been rated low risk
    "fill-color": [
      "case",
      ["==", ["to-number", ["get", RISK_PROPERTY], 0], 0],
      NO_RISK_COLOR,
      [
        "step",
        ["to-number", ["get", RISK_PROPERTY]],
        NO_RISK_COLOR,
        ...RISK_BINS.flat(),
      ],
    ],
  },
};

export const BUILDINGS_OUTLINE_LAYER = {
  id: "buildings-outline",
  type: "line",
  source: "buildings",
  "source-layer": SOURCE_LAYER,
  minzoom: BUILDING_MIN_ZOOM,
  layout: { visibility: "visible" },
  paint: {
    // dark enough to separate the palest risk bins from the white/hillshade behind them
    "line-color": "#4d4d4d",
    "line-width": 1,
  },
};

export const HOUSENUMBERS_LAYER = {
  id: "housenumbers",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "housenumber",
  minzoom: 16,
  layout: {
    visibility: "visible",
    "text-field": ["get", "housenumber"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1,
  },
};

// the three layers below all draw from the one "water" source (see OVERPASS_GROUPS
// in overpass.js), split by the "kind" each feature is tagged with
export const HYDRANTS_LAYER = {
  id: "hydrants",
  type: "circle",
  source: "water",
  filter: ["==", ["get", "kind"], "hydrant"],
  minzoom: 13,
  layout: { visibility: "visible" },
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2, 18, 6],
    "circle-color": "#e0342a",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1,
  },
};

// where an engine can draft or refill when there's no hydrant -- the norm in rural
// areas. Same size as the hydrants, since they're just as important
export const WATER_SOURCES_LAYER = {
  id: "water-sources",
  type: "circle",
  source: "water",
  filter: ["==", ["get", "kind"], "water_source"],
  minzoom: 13,
  layout: { visibility: "visible" },
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2, 18, 6],
    "circle-color": "#1f5fa8",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1,
  },
};

// a last resort for drafting (usually private, and small), so drawn smaller + paler
// than the purpose-built water sources
export const POOLS_LAYER = {
  id: "pools",
  type: "circle",
  source: "water",
  filter: ["==", ["get", "kind"], "pool"],
  minzoom: 13,
  layout: { visibility: "visible" },
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 1.5, 18, 4],
    "circle-color": "#6baed6",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1,
  },
};

// fades out around where buildings/hydrants start showing (zoom 13), so the
// two label sets hand off rather than fight for space
export const PLACE_LABELS_LAYER = {
  id: "place-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "place",
  maxzoom: 13,
  filter: ["in", ["get", "class"], ["literal", ["country", "city", "town"]]],
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      2,
      ["match", ["get", "class"], "country", 12, "city", 9, 8],
      10,
      ["match", ["get", "class"], "country", 18, "city", 15, 12],
    ],
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};
