// Picking the area to print (see atlas.js): a rectangle dragged out on the map -- with the mouse or a finger -- and the page grid previewed over it, so it's clear how the area will be split up before any pages are drawn.

const SOURCE = "atlas-area";
const LAYERS = [
  {
    id: "atlas-area-fill",
    type: "fill",
    source: SOURCE,
    filter: ["==", ["get", "kind"], "area"],
    paint: { "fill-color": "#d62828", "fill-opacity": 0.08 },
  },
  {
    id: "atlas-area-pages",
    type: "line",
    source: SOURCE,
    filter: ["==", ["get", "kind"], "page"],
    paint: {
      "line-color": "#d62828",
      "line-width": 1,
      "line-dasharray": [3, 2],
    },
  },
  {
    id: "atlas-area-outline",
    type: "line",
    source: SOURCE,
    filter: ["==", ["get", "kind"], "area"],
    paint: { "line-color": "#d62828", "line-width": 2.5 },
  },
];
// a drag shorter than this (in pixels) is taken as a click, rather than an area
const MIN_DRAG_PX = 10;

// [[west, south], [east, north]] as a GeoJSON polygon
export const boundsPolygon = ([[w, s], [e, n]]) => ({
  type: "Polygon",
  coordinates: [
    [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ],
  ],
});

const feature = (geometry, kind) => ({
  type: "Feature",
  geometry,
  properties: { kind },
});

// Sets up drawing on the map; `onDrawn(bounds)` is called with the rectangle drawn, as [[west, south], [east, north]]. Returns { start, stop, preview, hide, clear }: start/stop drawing, preview an area and its pages (each with its { bounds }), hide or show the preview (e.g. while pages are drawn, so it isn't on them), and clear it.
export const bindAreaDrawing = (map, { onDrawn }) => {
  const container = document.getElementById("map-container");
  let drawing = false;
  // the corner the drag started at, and the one under the pointer now
  let anchor;
  let pointer;

  const setData = (features) =>
    map.getSource(SOURCE)?.setData({ type: "FeatureCollection", features });

  const dragged = () => [
    [Math.min(anchor.lng, pointer.lng), Math.min(anchor.lat, pointer.lat)],
    [Math.max(anchor.lng, pointer.lng), Math.max(anchor.lat, pointer.lat)],
  ];

  map.once("load", () => {
    map.addSource(SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    for (const layer of LAYERS) map.addLayer(layer);
  });

  const onDown = (e) => {
    // one finger only, so pinching still zooms
    if (!drawing || (e.points && e.points.length !== 1)) return;
    e.preventDefault();
    anchor = pointer = e.lngLat;
  };
  const onMove = (e) => {
    if (!drawing || !anchor) return;
    pointer = e.lngLat;
    setData([feature(boundsPolygon(dragged()), "area")]);
  };
  const onUp = () => {
    if (!drawing || !anchor) return;
    const a = map.project(anchor);
    const b = map.project(pointer);
    const area = dragged();
    anchor = undefined;
    if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_DRAG_PX) return;
    stop();
    onDrawn(area);
  };
  map.on("mousedown", onDown);
  map.on("touchstart", onDown);
  map.on("mousemove", onMove);
  map.on("touchmove", onMove);
  map.on("mouseup", onUp);
  map.on("touchend", onUp);

  const start = () => {
    drawing = true;
    container.classList.add("atlas-drawing");
    // so dragging draws rather than pans
    map.dragPan.disable();
    setData([]);
  };
  const stop = () => {
    drawing = false;
    anchor = undefined;
    container.classList.remove("atlas-drawing");
    map.dragPan.enable();
  };

  return {
    start,
    stop,
    preview: (area, pages) =>
      setData([
        feature(boundsPolygon(area), "area"),
        ...pages.map(({ bounds }) => feature(boundsPolygon(bounds), "page")),
      ]),
    hide: (hidden) => {
      for (const { id } of LAYERS) {
        map.setLayoutProperty(id, "visibility", hidden ? "none" : "visible");
      }
    },
    clear: () => setData([]),
  };
};
