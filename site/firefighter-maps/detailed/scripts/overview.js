// A small overview map in the sidebar: the same spot zoomed out, with a box showing what the main map covers -- so a printout (or a zoomed-in view) shows where it is in the wider area. Dragging it (or clicking a spot on it) moves the main map, for getting around faster than panning the zoomed-in map. Uses OpenFreeMap's plain Positron style, from the same data (and attribution) as the main map.
import * as maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@6/dist/maplibre-gl.mjs";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
// Positron's route shield layers compare each road's ref_length to a number, but roads without a ref have none, which logs a warning and fails the filter. Defaulting it to a length too long for a shield fails the filter the same way, quietly.
const REF_LENGTH = '["get","ref_length"]';
const withRefLengthDefault = (_, style) =>
  JSON.parse(
    JSON.stringify(style).replaceAll(
      REF_LENGTH,
      `["coalesce",${REF_LENGTH},99]`,
    ),
  );
// how much further out the overview is than the main map
const ZOOM_OUT = 4;

export const bindOverviewMap = (map) => {
  const overview = new maplibregl.Map({
    container: "overview-map",
    // panning only; zooming stays with the main map, which the overview follows
    scrollZoom: false,
    boxZoom: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
    dragRotate: false,
    touchPitch: false,
    keyboard: false,
    attributionControl: false,
    center: map.getCenter(),
    zoom: Math.max(0, map.getZoom() - ZOOM_OUT),
  });
  overview.setStyle(STYLE_URL, { transformStyle: withRefLengthDefault });

  const viewBox = () => {
    const bounds = map.getBounds();
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            bounds.getNorthWest().toArray(),
            bounds.getNorthEast().toArray(),
            bounds.getSouthEast().toArray(),
            bounds.getSouthWest().toArray(),
            bounds.getNorthWest().toArray(),
          ],
        ],
      },
    };
  };

  overview.on("load", () => {
    overview.addSource("view", { type: "geojson", data: viewBox() });
    overview.addLayer({
      id: "view",
      type: "line",
      source: "view",
      paint: { "line-color": "#d62828", "line-width": 2 },
    });
  });

  // the main map moving (below) would otherwise jump the overview around under the pointer while it's being dragged
  let dragging = false;
  overview.on("dragstart", () => {
    dragging = true;
  });
  overview.on("drag", () => map.jumpTo({ center: overview.getCenter() }));
  overview.on("dragend", () => {
    dragging = false;
    // the main map stops at its maxBounds, so line the overview back up with where it actually ended up
    sync();
  });
  overview.on("click", (e) => map.jumpTo({ center: e.lngLat }));

  const sync = () => {
    overview.getSource("view")?.setData(viewBox());
    if (dragging) return;
    overview.jumpTo({
      center: map.getCenter(),
      zoom: Math.max(0, map.getZoom() - ZOOM_OUT),
    });
  };
  map.on("move", sync);
  // the main map's canvas changing size (e.g. the sidebar collapsing) changes what it covers
  map.on("resize", sync);
  // same as the main map, so it prints at its current size rather than blank
  window.addEventListener("beforeprint", () => overview.resize());
};
