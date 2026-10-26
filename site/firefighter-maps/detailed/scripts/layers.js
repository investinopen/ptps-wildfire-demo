import {
  BUILDING_MIN_ZOOM,
  RISK_BINS,
  NO_RISK_COLOR,
  NO_RISK_DATA_COLOR,
  RISK_PROPERTY,
  SOURCE_LAYER,
} from "./buildings.js";
import { ROAD, STATE_LINE } from "./colors.js";

// one const per layer -- keeping these standalone makes the draw order (the `layers`
// array in main.js) easy to see and rearrange without hunting through each definition
// white under everything, like the page around the map -- so the map's canvas is opaque, and an atlas page saved from it as a JPEG (see atlas-capture.js) doesn't turn its gaps black
export const BACKGROUND_LAYER = {
  id: "background",
  type: "background",
  paint: { "background-color": "#ffffff" },
};

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
  // softened so the dense hatches don't drown out the hillshade and the buildings' pale risk colors
  paint: { "raster-opacity": 0.7 },
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

// state lines, from the map's own tiles rather than us-states.geojson (which places.js uses), since the tiles' boundaries are full-precision and the GeoJSON's are simplified by up to a kilometer. A dash-dot, the usual map convention, so it isn't mistaken for a road or trail.
// https://openmaptiles.org/schema/#boundary
export const STATE_LINES_LAYER = {
  id: "state-lines",
  type: "line",
  source: "roadsSource",
  "source-layer": "boundary",
  filter: [
    "all",
    ["==", ["get", "admin_level"], 4],
    ["!=", ["get", "maritime"], 1],
  ],
  layout: { visibility: "visible", "line-join": "round" },
  paint: {
    "line-color": STATE_LINE,
    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 18, 3],
    // in line widths
    "line-dasharray": [6, 2, 1, 2],
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

// from the OSM access tiles (see style.js), not roadsSource -- its "oneway" field isn't
// reliable in this tileset
export const ONEWAY_ARROWS_LAYER = {
  id: "oneway-arrows",
  type: "symbol",
  source: "osm-access",
  "source-layer": "oneway",
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

// Named peaks and passes with their elevation, so crews can find terrain they're told about over the radio. Italic, the usual convention for natural features, so they aren't mistaken for road names. Hidden zoomed out, where they'd crowd out the town names.
export const PEAK_LABELS_LAYER = {
  id: "peak-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "mountain_peak",
  minzoom: 11,
  filter: [
    "all",
    ["in", ["get", "class"], ["literal", ["peak", "volcano", "saddle"]]],
    ["has", "name"],
  ],
  layout: {
    // see icons.js
    "icon-image": ["match", ["get", "class"], "saddle", "saddle", "peak"],
    "text-field": [
      "case",
      ["has", "ele_ft"],
      [
        "format",
        ["get", "name"],
        {},
        "\n",
        {},
        [
          "concat",
          ["number-format", ["get", "ele_ft"], { locale: "en-US" }],
          " ft",
        ],
        { "font-scale": 0.85 },
      ],
      ["get", "name"],
    ],
    "text-font": ["Noto Sans Bold Italic"],
    "text-size": 12,
    // Passes are often right on a road, among the driveway/building obstacles (see DRIVEWAY_OBSTACLES_LAYER), so the small symbol is always drawn and the name moves to whichever side has room.
    "icon-allow-overlap": true,
    "text-variable-anchor": ["top", "bottom", "right", "left"],
    "text-radial-offset": 0.6,
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

// named ridges, along the ridge line -- styled like PEAK_LABELS_LAYER
export const RIDGE_LABELS_LAYER = {
  id: "ridge-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "mountain_peak",
  minzoom: PEAK_LABELS_LAYER.minzoom,
  filter: [
    "all",
    ["in", ["get", "class"], ["literal", ["ridge", "arete"]]],
    ["has", "name"],
  ],
  layout: {
    "text-field": ["get", "name"],
    "text-font": PEAK_LABELS_LAYER.layout["text-font"],
    "text-size": 12,
    "symbol-placement": "line",
  },
  paint: PEAK_LABELS_LAYER.paint,
};

// creek, gulch, and ditch names along the line -- in rural areas, places are often given by drainage ("up Fourmile Creek"). Italic like the other natural features (see PEAK_LABELS_LAYER), and spaced out so a long creek isn't labeled over and over.
export const WATERWAY_LABELS_LAYER = {
  id: "waterway-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "waterway",
  minzoom: 12,
  filter: ["has", "name"],
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold Italic"],
    "text-size": 11,
    "symbol-placement": "line",
    "symbol-spacing": 400,
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

// a white ring around each building, cutting it out of the flame length hatch and hillshade behind it. Drawn under the fill, so the fill covers the inner half of the line and only the outer half shows.
export const BUILDINGS_HALO_LAYER = {
  id: "buildings-halo",
  type: "line",
  source: "buildings",
  "source-layer": SOURCE_LAYER,
  minzoom: BUILDING_MIN_ZOOM,
  layout: { visibility: "visible" },
  paint: {
    "line-color": "#ffffff",
    "line-width": ["interpolate", ["linear"], ["zoom"], 14.5, 3, 18, 6],
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
    // near-black, like the roads, so even the palest risk bins stand out from the white/hillshade behind them; thicker as buildings get bigger on screen
    "line-color": ROAD,
    "line-width": ["interpolate", ["linear"], ["zoom"], 14.5, 1, 18, 2],
  },
};

// Overture's buildings where there are no risk scores (see NO_RISK_DATA_BOUNDS), drawn the same way but white, so they don't read as the scored buildings' zero-risk gray
const OVERTURE_BUILDINGS = {
  source: "overtureBuildings",
  "source-layer": "building",
};
export const OVERTURE_BUILDINGS_HALO_LAYER = {
  ...BUILDINGS_HALO_LAYER,
  ...OVERTURE_BUILDINGS,
  id: "overture-buildings-halo",
};
export const OVERTURE_BUILDINGS_FILL_LAYER = {
  ...BUILDINGS_FILL_LAYER,
  ...OVERTURE_BUILDINGS,
  id: "overture-buildings-fill",
  paint: { "fill-color": NO_RISK_DATA_COLOR },
};
export const OVERTURE_BUILDINGS_OUTLINE_LAYER = {
  ...BUILDINGS_OUTLINE_LAYER,
  ...OVERTURE_BUILDINGS,
  id: "overture-buildings-outline",
};
export const OVERTURE_BUILDING_OBSTACLES_LAYER = {
  ...BUILDING_OBSTACLES_LAYER,
  ...OVERTURE_BUILDINGS,
  id: "overture-building-obstacles",
};

export const HOUSENUMBERS_LAYER = {
  id: "housenumbers",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "housenumber",
  // from the same zoom as the access hazards below, rather than one closer in, so a printed county atlas (see atlas.js) can be drawn at it with addresses on it -- in rural areas they're spread out enough to stay readable
  minzoom: ONEWAY_ARROWS_LAYER.minzoom,
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

// Overture's house numbers, placed ahead of OpenStreetMap's. Where both have an address they're nearly always at the same spot (95% within 6 m around Gold Hill, CO, where both come from the county), so OSM's copy collides with Overture's and isn't drawn, leaving OSM's only where Overture has no number there.
export const OVERTURE_HOUSENUMBERS_LAYER = {
  ...HOUSENUMBERS_LAYER,
  id: "overture-housenumbers",
  source: "overtureAddresses",
  "source-layer": "address",
  layout: { ...HOUSENUMBERS_LAYER.layout, "text-field": ["get", "number"] },
};

// the three layers below all draw from the access tiles' one "water" layer (see
// ptps_wildfire_demo/access_tiles.py), split by the "kind" each feature is tagged with
export const HYDRANTS_LAYER = {
  id: "hydrants",
  type: "circle",
  source: "osm-access",
  "source-layer": "water",
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
  source: "osm-access",
  "source-layer": "water",
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
  source: "osm-access",
  "source-layer": "water",
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

// access hazards for an engine, from the access tiles (see style.js) at the same
// street-level zoom as the one-way arrows. Symbols are drawn in
// icons.js, and always shown even when they overlap -- a hidden gate is worse than a
// crowded map.
export const DEAD_ENDS_LAYER = {
  id: "dead-ends",
  type: "symbol",
  source: "osm-access",
  "source-layer": "dead-ends",
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
  source: "osm-access",
  "source-layer": "gates",
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
  source: "osm-access",
  "source-layer": "weight-limits",
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

// Villages and hamlets -- rural reference points (old mining camps, crossroads, subdivisions) that PLACE_LABELS_LAYER leaves out. Unlike town names, they stay up zoomed in, since they're often the only name for an area. Spaced-out capitals, so they don't read as a road or a natural feature.
export const SMALL_PLACE_LABELS_LAYER = {
  id: "small-place-labels",
  type: "symbol",
  source: "roadsSource",
  "source-layer": "place",
  minzoom: 10,
  filter: ["in", ["get", "class"], ["literal", ["village", "hamlet"]]],
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Bold"],
    "text-size": ["match", ["get", "class"], "village", 13, 11],
    "text-transform": "uppercase",
    "text-letter-spacing": 0.1,
  },
  paint: {
    "text-color": "#000000",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
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
