// the map's sources and layers (in draw order) -- kept separate from main.js so it can be loaded, and validated, without a browser
import { PMTILES_URL } from "./buildings.js";
import { FLAME_LENGTH_URL } from "./rasters.js";
import {
  HILLSHADE_LAYER,
  FLAME_LENGTH_LAYER,
  WATER_LAYER,
  WATERWAYS_LAYER,
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
  BUILDINGS_OUTLINE_LAYER,
  HOUSENUMBERS_LAYER,
  HYDRANTS_LAYER,
  WATER_SOURCES_LAYER,
  POOLS_LAYER,
  DEAD_ENDS_LAYER,
  GATES_LAYER,
  WEIGHT_LIMITS_LAYER,
  PLACE_LABELS_LAYER,
} from "./layers.js";

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
    // OpenMapTiles-schema vector tiles, free & keyless: https://openfreemap.org
    roadsSource: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
    buildings: {
      type: "vector",
      url: "pmtiles://" + PMTILES_URL,
      // ODbL requires attributing both CarbonPlan and Overture's footprints
      attribution:
        '<a href="https://carbonplan.org/research/climate-risk" target="_blank">CarbonPlan Open Climate Risk</a> (<a href="https://opendatacommons.org/licenses/odbl/" target="_blank">ODbL</a>), <a href="https://overturemaps.org" target="_blank">Overture Maps</a>',
    },
    // hydrants and other water sources aren't in OpenFreeMap's POI set -- fetched
    // live from OSM in overpass.js
    water: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    // OpenFreeMap's own "oneway" field is unreliable (nearly every road reports
    // oneway:1, real one-way streets are a small minority) -- fetched live from
    // OSM's real oneway tags in overpass.js instead, same as hydrants
    oneway: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    // access hazards -- also from OSM in overpass.js, along with the oneway streets
    gates: {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    "dead-ends": {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    "weight-limits": {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
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
    BUILDINGS_FILL_LAYER,
    TRAILS_LAYER,
    DRIVEWAYS_LAYER,
    ROADS_LAYER,
    ONEWAY_ARROWS_LAYER,
    WATER_LABELS_LAYER,
    BUILDINGS_OUTLINE_LAYER,
    TRAIL_LABELS_LAYER,
    POOLS_LAYER,
    WATER_SOURCES_LAYER,
    HYDRANTS_LAYER,
    DEAD_ENDS_LAYER,
    GATES_LAYER,
    WEIGHT_LIMITS_LAYER,
    // Road names first, then the fallbacks for roads they couldn't fit on, then house numbers, then the invisible building/driveway obstacles, then route numbers -- so route numbers avoid all of those -- over everything else below (see ROAD_LABELS_LAYER).
    ROUTE_SHIELDS_LAYER,
    DRIVEWAY_OBSTACLES_LAYER,
    BUILDING_OBSTACLES_LAYER,
    HOUSENUMBERS_LAYER,
    ROAD_LABEL_FALLBACKS_LAYER,
    ROAD_LABELS_LAYER,
    // town names, only shown zoomed out
    PLACE_LABELS_LAYER,
    // placed ahead of everything, to keep labels out from under the legend/controls and off the edges
    LABEL_BLOCKERS_LAYER,
  ],
};
