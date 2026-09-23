// entry point: builds the legend, creates the map from the layers/sources defined in the
// other modules, and wires up the controls. MapLibre and pmtiles are loaded as globals
// by the <script> tags in index.html.
import { PMTILES_URL } from "./buildings.js";
import {
  BURN_PROBABILITY_EXPORT_URL,
  FLAME_LENGTH_EXPORT_URL,
  FUEL_MODEL_URL,
} from "./rasters.js";
import {
  makeArrowIcon,
  HILLSHADE_LAYER,
  FUEL_MODELS_LAYER,
  BURN_PROBABILITY_LAYER,
  FLAME_LENGTH_LAYER,
  WATER_LAYER,
  WATERWAYS_LAYER,
  ROADS_LAYER,
  ONEWAY_ARROWS_LAYER,
  DRIVEWAYS_LAYER,
  TRAILS_LAYER,
  ROAD_LABELS_LAYER,
  TRAIL_LABELS_LAYER,
  WATER_LABELS_LAYER,
  BUILDINGS_FILL_LAYER,
  BUILDINGS_OUTLINE_LAYER,
  HOUSENUMBERS_LAYER,
  HYDRANTS_LAYER,
  WATER_SOURCES_LAYER,
  POOLS_LAYER,
  PLACE_LABELS_LAYER,
} from "./layers.js";
import { buildLegendKeys, bindLayerToggles } from "./legend.js";
import { bindOverpassData } from "./overpass.js";
import { bindPlaceSearch } from "./search.js";

buildLegendKeys();

const CENTER = [-105.375925, 40.052187]; // [lon, lat]
const ZOOM = 16.03;

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: "map",
  // keeps #zoom/lat/lng in the URL in sync with the view, so a copied link reopens
  // to the same place
  hash: true,
  // default control collapses to an (i) icon that needs a click/hover to expand --
  // add our own always-expanded one instead, since attribution must show in print/exports
  attributionControl: false,
  style: {
    version: 8,
    sources: {
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
      // LANDFIRE (USGS/USFS, public domain); exportImage per-tile via the
      // {bbox-epsg-3857} template maplibre substitutes for ArcGIS image services
      fuelModels: {
        type: "raster",
        tiles: [FUEL_MODEL_URL],
        tileSize: 256,
        attribution:
          '<a href="https://landfire.gov" target="_blank">LANDFIRE</a>',
      },
      // USFS Wildfire Risk to Communities (public domain); exportImage per-tile via
      // the {bbox-epsg-3857} template maplibre substitutes for ArcGIS image services
      burnProbability: {
        type: "raster",
        tiles: [BURN_PROBABILITY_EXPORT_URL],
        tileSize: 256,
        attribution:
          '<a href="https://data-usfs.hub.arcgis.com/datasets/usfs::wildfire-risk-to-communities-burn-probability-image-service/about" target="_blank">USFS Wildfire Risk to Communities</a>',
      },
      // same service family + attribution as burnProbability -- maplibre dedupes
      // identical attribution strings
      flameLength: {
        type: "raster",
        tiles: [FLAME_LENGTH_EXPORT_URL],
        tileSize: 256,
        attribution:
          '<a href="https://data-usfs.hub.arcgis.com/datasets/usfs::wildfire-risk-to-communities-burn-probability-image-service/about" target="_blank">USFS Wildfire Risk to Communities</a>',
      },
    },
    glyphs: "https://fonts.undpgeohub.org/fonts/{fontstack}/{range}.pbf",
    // draw order, bottom to top -- reorder these to change what draws over what
    layers: [
      HILLSHADE_LAYER,
      BURN_PROBABILITY_LAYER,
      FLAME_LENGTH_LAYER,
      FUEL_MODELS_LAYER,
      WATER_LAYER,
      WATERWAYS_LAYER,
      BUILDINGS_FILL_LAYER,
      TRAILS_LAYER,
      DRIVEWAYS_LAYER,
      ROADS_LAYER,
      ONEWAY_ARROWS_LAYER,
      WATER_LABELS_LAYER,
      BUILDINGS_OUTLINE_LAYER,
      ROAD_LABELS_LAYER,
      TRAIL_LABELS_LAYER,
      HOUSENUMBERS_LAYER,
      POOLS_LAYER,
      WATER_SOURCES_LAYER,
      HYDRANTS_LAYER,
      PLACE_LABELS_LAYER,
    ],
  },
  center: CENTER,
  zoom: ZOOM,
});

map.on("load", () => map.addImage("oneway-arrow", makeArrowIcon()));
bindOverpassData(map);

// zoom + compass share the default top-right group; only the zoom buttons get
// hidden on paper (see print styles in index.html), the compass survives printing since it
// tracks the map's actual bearing and still points true north on a rotated map
map.addControl(new maplibregl.NavigationControl());
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
  }),
);
// the container rather than the default (just the map canvas), so the legend/layer
// toggles come along
map.addControl(
  new maplibregl.FullscreenControl({
    container: document.getElementById("map-container"),
  }),
);
map.addControl(new maplibregl.AttributionControl({ compact: false }));
map.addControl(
  new maplibregl.ScaleControl({ maxWidth: 150, unit: "imperial" }),
  "bottom-left",
);

bindPlaceSearch(map);
bindLayerToggles(map);

// resize so the canvas redraws at full page size instead of printing blank/clipped
window.addEventListener("beforeprint", () => map.resize());

// caches this page, its scripts, and map tiles so a previously-viewed area still
// works offline/on a bad connection -- see sw.js for what's cached and why
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch((error) =>
      console.error("Service worker registration failed:", error),
    );
}
