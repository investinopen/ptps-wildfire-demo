import {
  BUILDING_MIN_ZOOM,
  RISK_BINS,
  NO_RISK_COLOR,
  RISK_PROPERTY,
  SOURCE_LAYER,
} from "./buildings.js";
import { ROAD } from "./colors.js";

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
export const FLAME_LENGTH_LAYER = {
  id: "flame-length",
  type: "raster",
  source: "flameLength",
  layout: { visibility: "visible" },
  // a hatch already reads as sparse, unlike a solid fill, so this can sit close to
  // fully opaque
  paint: { "raster-opacity": 0.9 },
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
    "line-color": ROAD,
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
    // see icons.js
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

// private roads/driveways (class "service") -- styled thinner than roads + a different
// hue to read as minor, same as OSM data allows, but still thick/dark enough to follow
// over the flame length hatch, since a driveway is how an engine reaches a house
// https://wiki.openstreetmap.org/wiki/Key:highway#Highway
export const DRIVEWAYS_LAYER = {
  id: "driveways",
  type: "line",
  source: "roadsSource",
  "source-layer": "transportation",
  filter: ["==", ["get", "class"], "service"],
  layout: { visibility: "visible" },
  paint: {
    "line-color": "#6a2fb8",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 18, 2.5],
  },
};

// tracks and paths, minus sidewalks. The tiles don't keep OSM's footway=sidewalk tag, so
// this drops highway=footway altogether (along with steps, plazas, and indoor
// corridors) -- in OSM, trails outside of town are almost always highway=path/track,
// while footways are mostly sidewalks/crossings running alongside roads. Cycleways stay,
// since they're usually their own corridors (rail-trails, bike paths).
// https://openmaptiles.org/schema/#transportation
const TRAILS_FILTER = [
  "all",
  ["in", ["get", "class"], ["literal", ["track", "path"]]],
  [
    "!",
    [
      "in",
      ["get", "subclass"],
      ["literal", ["footway", "steps", "pedestrian", "corridor", "platform"]],
    ],
  ],
];

// unpaved tracks and foot/bike/horse paths (class "track", "path") -- the same width as
// driveways so they're as easy to follow over the flame length hatch --
// https://wiki.openstreetmap.org/wiki/Tag:highway%3Dtrack
// https://wiki.openstreetmap.org/wiki/Tag:highway%3Dpath
export const TRAILS_LAYER = {
  id: "trails",
  type: "line",
  source: "roadsSource",
  "source-layer": "transportation",
  filter: TRAILS_FILTER,
  layout: { visibility: "visible" },
  paint: {
    "line-color": "#557a12",
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 18, 2.5],
  },
};

// Invisible obstacles so route number signs (and any other label placed after these -- see the layer order in style.js) don't land on top of buildings or driveways. MapLibre only keeps labels from overlapping other labels/symbols, not lines or shapes, so these put an invisible symbol on each building and every few pixels along each driveway. Always placed (allow-overlap), but still counted in collisions. Road names and house numbers are placed before these, so they're unaffected.
export const BUILDING_OBSTACLES_LAYER = {
  id: "building-obstacles",
  type: "symbol",
  source: "buildings",
  "source-layer": SOURCE_LAYER,
  minzoom: BUILDING_MIN_ZOOM,
  layout: {
    visibility: "visible",
    "icon-image": "obstacle",
    // roughly a house's size on screen, growing with it
    "icon-size": ["interpolate", ["exponential", 2], ["zoom"], 15, 1, 18, 4],
    "icon-allow-overlap": true,
  },
};

export const DRIVEWAY_OBSTACLES_LAYER = {
  id: "driveway-obstacles",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "transportation",
  filter: ["==", ["get", "class"], "service"],
  layout: {
    visibility: "visible",
    "icon-image": "obstacle",
    "symbol-placement": "line",
    // closer together than a sign is wide, so a sign can't fit between two of them
    "symbol-spacing": 10,
    "icon-allow-overlap": true,
  },
};

// route numbers as sign-style boxes along the road, e.g. "I-25", "US 36", "Hwy 119" -- also the only label for highway stretches with a number but no name. County roads' refs already read like "CR 52", so they're shown as-is.
// https://openmaptiles.org/schema/#transportation_name
export const ROUTE_SHIELDS_LAYER = {
  id: "route-shields",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "transportation_name",
  filter: [
    "all",
    ["has", "ref"],
    ["in", ["get", "class"], ["literal", DRIVABLE_ROAD_CLASSES]],
  ],
  layout: {
    visibility: "visible",
    "symbol-placement": "line",
    // tried often along each road, since the obstacles above rule out many spots near houses
    "symbol-spacing": 150,
    "text-field": [
      "match",
      ["get", "network"],
      "us-interstate",
      ["concat", "I-", ["get", "ref"]],
      "us-highway",
      ["concat", "US ", ["get", "ref"]],
      "us-state",
      ["concat", "Hwy ", ["get", "ref"]],
      ["get", "ref"],
    ],
    "text-font": ["Noto Sans Bold"],
    "text-size": 11,
    // upright like a sign, rather than following the road
    "text-rotation-alignment": "viewport",
    "icon-rotation-alignment": "viewport",
    // see icons.js
    "icon-image": [
      "match",
      ["get", "network"],
      "us-interstate",
      "interstate-box",
      "sign-box",
    ],
    "icon-text-fit": "both",
    "icon-text-fit-padding": [1, 3, 1, 3],
  },
  paint: {
    "text-color": [
      "match",
      ["get", "network"],
      "us-interstate",
      "#ffffff",
      "#000000",
    ],
  },
};

// Every named road on screen should get a readable name, so these are placed before any other labels/symbols (see the layer order in style.js) and tried more often along each road than the default 250px, which gives short town blocks more chances to fit. Named service roads are included, since rural private roads are often tagged that way -- unnamed driveways just get no label.
export const ROAD_LABELS_LAYER = {
  id: "road-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "transportation_name",
  filter: [
    "in",
    ["get", "class"],
    ["literal", [...DRIVABLE_ROAD_CLASSES, "service"]],
  ],
  layout: {
    visibility: "visible",
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
    "symbol-placement": "line",
    "symbol-spacing": 150,
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

// invisible boxes over the legend/controls and along the map's edges, which other labels avoid -- see bindLabelBlockers in labels.js. Always placed (allow-overlap), but still counted in collisions (no ignore-placement).
export const LABEL_BLOCKERS_LAYER = {
  id: "label-blockers",
  type: "symbol",
  source: "label-blockers",
  layout: {
    "icon-image": ["get", "image"],
    "icon-allow-overlap": true,
    "icon-rotation-alignment": "viewport",
    "icon-pitch-alignment": "viewport",
  },
};

// horizontal names for the roads ROAD_LABELS_LAYER couldn't label along the line -- placed by labels.js. Still avoids overlapping anything, but can shift off-center to find room.
export const ROAD_LABEL_FALLBACKS_LAYER = {
  id: "road-label-fallbacks",
  type: "symbol",
  source: "road-label-fallbacks",
  layout: {
    visibility: "visible",
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
    "text-variable-anchor": [
      "center",
      "top",
      "bottom",
      "left",
      "right",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ],
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
  filter: TRAILS_FILTER,
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
        ...RISK_BINS.flatMap(({ min, color }) => [min, color]),
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

// access hazards for an engine, fed by live Overpass data (see OVERPASS_GROUPS in
// overpass.js) at the same street-level zoom as the one-way arrows. Symbols are drawn in
// icons.js, and always shown even when they overlap -- a hidden gate is worse than a
// crowded map.
export const DEAD_ENDS_LAYER = {
  id: "dead-ends",
  type: "symbol",
  source: "dead-ends",
  minzoom: ONEWAY_ARROWS_LAYER.minzoom,
  layout: {
    visibility: "visible",
    "icon-image": "dead-end",
    "icon-allow-overlap": true,
  },
};

export const GATES_LAYER = {
  id: "gates",
  type: "symbol",
  source: "gates",
  minzoom: ONEWAY_ARROWS_LAYER.minzoom,
  layout: {
    visibility: "visible",
    "icon-image": "gate",
    "icon-allow-overlap": true,
  },
};

// the limit in a sign-like box at the middle of the bridge, kept upright rather than
// following the road's angle so it reads like a sign
export const WEIGHT_LIMITS_LAYER = {
  id: "weight-limits",
  type: "symbol",
  source: "weight-limits",
  minzoom: ONEWAY_ARROWS_LAYER.minzoom,
  layout: {
    visibility: "visible",
    "symbol-placement": "line-center",
    "text-field": ["get", "label"],
    "text-font": ["Noto Sans Bold"],
    "text-size": 11,
    "text-rotation-alignment": "viewport",
    // see icons.js
    "icon-image": "weight-limit-box",
    "icon-text-fit": "both",
    "icon-text-fit-padding": [1, 3, 1, 3],
    "icon-rotation-alignment": "viewport",
    "icon-allow-overlap": true,
    "text-allow-overlap": true,
  },
  paint: {
    "text-color": "#000000",
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
