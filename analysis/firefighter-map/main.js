// entry point: builds the legend, creates the map from the layers/sources defined in the other modules, and wires up the controls. pmtiles is loaded as a global by its <script> tag in index.html.
// MapLibre only ships as an ES module since v6, and loads its own web worker from the same CDN.
import * as maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@6/dist/maplibre-gl.mjs";
import { flameHatchProtocol } from "./rasters.js";
import { STYLE } from "./style.js";
import {
  ICONS,
  ICON_PIXEL_RATIO,
  WEIGHT_LIMIT_BOX_OPTIONS,
  iconImageData,
} from "./icons.js";
import { buildLegendKeys, bindLayerToggles } from "./legend.js";
import { bindOverpassData } from "./overpass.js";
import { bindPlaceSearch } from "./search.js";

buildLegendKeys();

const CENTER = [-105.375925, 40.052187]; // [lon, lat]
const ZOOM = 16.03;

const protocol = new pmtiles.Protocol();
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
});

// the symbols drawn in icons.js
map.on("load", () => {
  for (const name of Object.keys(ICONS)) {
    map.addImage(name, iconImageData(name), {
      pixelRatio: ICON_PIXEL_RATIO,
      ...(name === "weight-limit-box" ? WEIGHT_LIMIT_BOX_OPTIONS : {}),
    });
  }
});
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
