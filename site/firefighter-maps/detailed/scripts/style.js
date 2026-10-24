// the map's sources and layers (in draw order) -- kept separate from main.js so it can be loaded, and validated, without a browser
import {
  NO_RISK_DATA_BOUNDS,
  OVERTURE_BUILDINGS_URL,
  PMTILES_URL,
} from "./buildings.js";
import { FLAME_LENGTH_URL } from "./rasters.js";
import {
  HILLSHADE_LAYER,
  FLAME_LENGTH_LAYER,
  WATER_LAYER,
  WATERWAYS_LAYER,
  STATE_LINES_LAYER,
  ROADS_LAYER,
  ONEWAY_ARROWS_LAYER,
  DRIVEWAYS_LAYER,
  TRAILS_LAYER,
  ROAD_LABELS_LAYER,
  ROUTE_SHIELDS_LAYER,
  BUILDING_OBSTACLES_LAYER,
  DRIVEWAY_OBSTACLES_LAYER,
  ROAD_LABEL_FALLBACKS_LAYER,
  LABEL_BLOCKERS_LAYER,
  TRAIL_LABELS_LAYER,
  WATER_LABELS_LAYER,
  BUILDINGS_FILL_LAYER,
  BUILDINGS_HALO_LAYER,
  BUILDINGS_OUTLINE_LAYER,
  OVERTURE_BUILDINGS_HALO_LAYER,
  OVERTURE_BUILDINGS_FILL_LAYER,
  OVERTURE_BUILDINGS_OUTLINE_LAYER,
  OVERTURE_BUILDING_OBSTACLES_LAYER,
  HOUSENUMBERS_LAYER,
  HYDRANTS_LAYER,
  WATER_SOURCES_LAYER,
  POOLS_LAYER,
  DEAD_ENDS_LAYER,
  GATES_LAYER,
  WEIGHT_LIMITS_LAYER,
  PLACE_LABELS_LAYER,
} from "./layers.js";

// OpenMapTiles-schema vector tiles, free & keyless: https://openfreemap.org
const OPENFREEMAP_URL = "https://tiles.openfreemap.org/planet";

// built daily and published next to this page -- see the "osm-access" source below
export const ACCESS_TILES_URL = new URL(
  "../osm-access.pmtiles",
  import.meta.url,
).href;

export const STYLE = {
  version: 8,
  sources: {
    // filled in by labels.js
    "road-label-fallbacks": {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    "label-blockers": {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    // hillshade example: https://mapterhorn.com/examples/hillshade/
    hillshadeSource: {
      type: "raster-dem",
      tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
      encoding: "terrarium",
      tileSize: 512,
      attribution:
        '&copy; <a href="https://mapterhorn.com" target="_blank">Mapterhorn</a>',
    },
    roadsSource: {
      type: "vector",
      url: OPENFREEMAP_URL,
    },
    // only fetched where buildings.js has no risk scores; attributed by the file itself
    overtureBuildings: {
      type: "vector",
      url: "pmtiles://" + OVERTURE_BUILDINGS_URL,
      bounds: NO_RISK_DATA_BOUNDS,
    },
    buildings: {
      type: "vector",
      url: "pmtiles://" + PMTILES_URL,
      // ODbL requires attributing both CarbonPlan and Overture's footprints
      attribution:
        '<a href="https://carbonplan.org/research/climate-risk" target="_blank">CarbonPlan Open Climate Risk</a> (<a href="https://opendatacommons.org/licenses/odbl/" target="_blank">ODbL</a>), <a href="https://overturemaps.org" target="_blank">Overture Maps</a>',
    },
    // water sources and road access (one-way streets, gates, dead ends, bridge weight
    // limits) from OSM, as one layer each -- OpenFreeMap's tiles don't include
    // hydrants/tanks/gates at all, its "oneway" field is unreliable (nearly every road
    // reports oneway:1), and finding dead ends takes how roads connect, which its tiles
    // don't keep. Built daily by .github/workflows/build-access-tiles.yml and published
    // alongside this page; the file's attribution says what date its data is from.
    "osm-access": {
      type: "vector",
      url: "pmtiles://" + ACCESS_TILES_URL,
    },
    // USFS Wildfire Risk to Communities (public domain); exportImage per-tile via
    // the {bbox-epsg-3857} template maplibre substitutes for ArcGIS image services
    flameLength: {
      type: "raster",
      tiles: [FLAME_LENGTH_URL],
      tileSize: 256,
      attribution:
        '<a href="https://data-usfs.hub.arcgis.com/datasets/usfs::wildfire-risk-to-communities-conditional-flame-length-image-service/about" target="_blank">USFS Wildfire Risk to Communities</a>',
    },
  },
  glyphs: "https://fonts.undpgeohub.org/fonts/{fontstack}/{range}.pbf",
  // draw order, bottom to top -- reorder these to change what draws over what. Labels/symbols are also placed in reverse of this order, so the ones nearer the end win when they'd collide.
  layers: [
    HILLSHADE_LAYER,
    FLAME_LENGTH_LAYER,
    WATER_LAYER,
    WATERWAYS_LAYER,
    STATE_LINES_LAYER,
    BUILDINGS_HALO_LAYER,
    BUILDINGS_FILL_LAYER,
    OVERTURE_BUILDINGS_HALO_LAYER,
    OVERTURE_BUILDINGS_FILL_LAYER,
    TRAILS_LAYER,
    DRIVEWAYS_LAYER,
    ROADS_LAYER,
    ONEWAY_ARROWS_LAYER,
    WATER_LABELS_LAYER,
    BUILDINGS_OUTLINE_LAYER,
    OVERTURE_BUILDINGS_OUTLINE_LAYER,
    TRAIL_LABELS_LAYER,
    POOLS_LAYER,
    WATER_SOURCES_LAYER,
    HYDRANTS_LAYER,
    DEAD_ENDS_LAYER,
    GATES_LAYER,
    // Road names first, then the fallbacks for roads they couldn't fit on, then house numbers, then the invisible building/driveway obstacles, then route numbers -- so route numbers avoid all of those -- over everything else below (see ROAD_LABELS_LAYER).
    ROUTE_SHIELDS_LAYER,
    DRIVEWAY_OBSTACLES_LAYER,
    BUILDING_OBSTACLES_LAYER,
    OVERTURE_BUILDING_OBSTACLES_LAYER,
    HOUSENUMBERS_LAYER,
    ROAD_LABEL_FALLBACKS_LAYER,
    ROAD_LABELS_LAYER,
    // bridge weight limits over the road names, which steer around them -- a limit an engine exceeds matters more than the road's name
    WEIGHT_LIMITS_LAYER,
    // town names, only shown zoomed out
    PLACE_LABELS_LAYER,
    // placed ahead of everything, to keep labels out from under the legend/controls and off the edges
    LABEL_BLOCKERS_LAYER,
  ],
};
