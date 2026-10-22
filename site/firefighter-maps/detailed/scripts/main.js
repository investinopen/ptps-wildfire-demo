// entry point: builds the legend, creates the map from the layers/sources defined in the other modules, and wires up the controls. pmtiles is loaded as a global by its <script> tag in index.html.
// MapLibre only ships as an ES module since v6, and loads its own web worker from the same CDN.
import * as maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@6/dist/maplibre-gl.mjs";
import { flameHatchProtocol } from "./rasters.js";
import { ACCESS_TILES_URL, STYLE } from "./style.js";
import { PMTILES_URL } from "./buildings.js";
import { OVERTURE_ADDRESSES_URL, OVERTURE_BUILDINGS_URL } from "./overture.js";
import { CachedSource } from "./pmtiles-cache.js";
import {
  ICONS,
  ICON_PIXEL_RATIO,
  SIGN_BOX_OPTIONS,
  iconImageData,
} from "./icons.js";
import {
  buildLegendKeys,
  bindBuildingsKey,
  bindLayerToggles,
} from "./legend.js";
import { bindSidebarToggle } from "./sidebar.js";
import { bindPlaceHeading } from "./places.js";
import { bindOverviewMap } from "./overview.js";
import { bindFallbackRoadLabels, bindLabelBlockers } from "./labels.js";
import { ROAD_LABELS_LAYER } from "./layers.js";
import { bindPlaceSearch } from "./search.js";
import { bindAtlas } from "./atlas.js";

buildLegendKeys();
// before the map is created, so it starts out at the right width
bindSidebarToggle();

const CENTER = [-105.375925, 40.052187]; // [lon, lat]
const ZOOM = 16.03;
// the 50 states, with a little margin, since the flame lengths cover them all -- the building risk scores only cover the contiguous US (see buildings.js), so Alaska and Hawaii have no buildings. Not zooming out past it keeps the map from asking the tile and image servers for the whole world at once. Stops at the antimeridian, which leaves out Alaska's westernmost Aleutians (the Near Islands), since a box can't cross it. The overview map in the sidebar shows the wider area.
const MAX_BOUNDS = [
  [-180, 18.5], // [west, south]
  [-66, 72], // [east, north]
];
const MIN_ZOOM = 4;
// MapLibre ignores a #zoom/lat/lng zoomed out past minZoom, opening at CENTER instead, so a link like that is moved in to MIN_ZOOM to still open where it points
const [hashZoom, ...hashPlace] = location.hash.slice(1).split("/");
if (hashPlace.length === 2 && Number(hashZoom) < MIN_ZOOM) {
  history.replaceState(null, "", `#${[MIN_ZOOM, ...hashPlace].join("/")}`);
}

// metadata, so a source without its own attribution takes the one in its file -- the access tiles' with the date its data is from, Overture's crediting OSM and Overture
const protocol = new pmtiles.Protocol({ metadata: true });
// read through CachedSource, so areas viewed before still draw offline
for (const url of [
  ACCESS_TILES_URL,
  PMTILES_URL,
  OVERTURE_BUILDINGS_URL,
  OVERTURE_ADDRESSES_URL,
]) {
  protocol.add(
    new pmtiles.PMTiles(new CachedSource(new pmtiles.FetchSource(url))),
  );
}
maplibregl.addProtocol("pmtiles", protocol.tile);
maplibregl.addProtocol("flamehatch", flameHatchProtocol);

const map = new maplibregl.Map({
  container: "map",
  // keeps #zoom/lat/lng in the URL in sync with the view, so a copied link reopens
  // to the same place
  hash: true,
  // default control collapses to an (i) icon that needs a click/hover to expand --
  // add our own always-expanded one instead, since attribution must show in print/exports
  attributionControl: false,
  style: STYLE,
  center: CENTER,
  zoom: ZOOM,
  maxBounds: MAX_BOUNDS,
  minZoom: MIN_ZOOM,
  // keeps the last frame drawn, so the county atlas can save it as an image (see atlas-capture.js)
  canvasContextAttributes: { preserveDrawingBuffer: true },
});

// the symbols drawn in icons.js
map.on("load", () => {
  for (const name of Object.keys(ICONS)) {
    map.addImage(name, iconImageData(name), {
      pixelRatio: ICON_PIXEL_RATIO,
      ...(ICONS[name].stretchable ? SIGN_BOX_OPTIONS : {}),
    });
  }
});
bindPlaceHeading(map);
bindOverviewMap(map);
bindLabelBlockers(map, { sourceId: "label-blockers" });
bindFallbackRoadLabels(map, {
  sourceId: "road-label-fallbacks",
  labelLayerId: ROAD_LABELS_LAYER.id,
  roadsFilter: ROAD_LABELS_LAYER.filter,
});

// zoom + compass share the default top-right group; only the zoom buttons get
// hidden on paper (see print styles in index.css), the compass survives printing since it
// tracks the map's actual bearing and still points true north on a rotated map
map.addControl(new maplibregl.NavigationControl());
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
  }),
);
// the container rather than the default (just the map canvas), so the sidebar comes along
map.addControl(
  new maplibregl.FullscreenControl({
    container: document.getElementById("map-container"),
  }),
);
// in the sidebar rather than corners of the map, so they don't cover it -- onAdd() builds a control's element (and keeps it updated) without placing it anywhere
document
  .getElementById("map-scale")
  .append(
    new maplibregl.ScaleControl({ maxWidth: 150, unit: "imperial" }).onAdd(map),
  );
document
  .getElementById("map-attribution")
  .append(new maplibregl.AttributionControl({ compact: false }).onAdd(map));

bindPlaceSearch(map);
bindLayerToggles(map);
bindBuildingsKey(map);
bindAtlas(map);

// resize so the canvas redraws at full page size instead of printing blank/clipped
window.addEventListener("beforeprint", () => map.resize());

// caches this page, its scripts, and map tiles so a previously-viewed area still
// works offline/on a bad connection -- see ../sw.js for what's cached and why
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch((error) =>
      console.error("Service worker registration failed:", error),
    );
}

// handy for poking at the map from the browser console
window.firefighterMap = map;
