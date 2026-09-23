// A small overview map in the sidebar: the same spot zoomed out, with a box showing what the main map covers -- so a printout (or a zoomed-in view) shows where it is in the wider area. Uses OpenFreeMap's plain Positron style, from the same data (and attribution) as the main map.
import * as maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@6/dist/maplibre-gl.mjs";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
// how much further out the overview is than the main map
const ZOOM_OUT = 4;

export const bindOverviewMap = (map) => {
  const overview = new maplibregl.Map({
    container: "overview-map",
    style: STYLE_URL,
    interactive: false,
    attributionControl: false,
    center: map.getCenter(),
    zoom: Math.max(0, map.getZoom() - ZOOM_OUT),
  });

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

  const sync = () => {
    overview.jumpTo({
      center: map.getCenter(),
      zoom: Math.max(0, map.getZoom() - ZOOM_OUT),
    });
    overview.getSource("view")?.setData(viewBox());
  };
  map.on("move", sync);
  // the main map's canvas changing size (e.g. the sidebar collapsing) changes what it covers
  map.on("resize", sync);
  // same as the main map, so it prints at its current size rather than blank
  window.addEventListener("beforeprint", () => overview.resize());
};
