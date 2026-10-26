// Draws each of an atlas's pages (see atlas.js) with the main map itself, saving each as an image -- rather than a separate map per page, since browsers only allow a handful of WebGL maps at once, and this way every page has the same layers, labels, and legend as what's on screen.

// how long after the map goes idle with nothing else redrawing it to call it done -- labels.js adds fallback road labels on idle, which redraws the map once more
const QUIET_MS = 400;
// a page whose tiles never finish loading (e.g. an image server that's down) is saved as it is after this long, rather than holding up the rest
const TIMEOUT_MS = 30_000;
// enough for crisp text on paper, without each page's image getting huge
const MIN_PIXEL_RATIO = 2;
const JPEG_QUALITY = 0.88;

// the layers that say there's something on a page worth printing
const CONTENT_LAYERS = [
  "roads",
  "driveways",
  "trails",
  "buildings-fill",
  "overture-buildings-fill",
];
// left off of the index page's map
const INDEX_HIDDEN_LAYERS = ["hillshade", "flame-length"];

// Waits for the map to finish drawing what's in view. Browsers stop drawing in background tabs, so time spent in one doesn't count toward giving up on a page.
const settle = (map) =>
  new Promise((resolve) => {
    let quiet;
    let giveUp;
    const onIdle = () => {
      clearTimeout(quiet);
      quiet = setTimeout(done, QUIET_MS);
    };
    const onRender = () => clearTimeout(quiet);
    const start = () => {
      clearTimeout(quiet);
      clearTimeout(giveUp);
      if (document.hidden) return;
      giveUp = setTimeout(done, TIMEOUT_MS);
      // so it goes idle again even if nothing needed loading
      map.triggerRepaint();
    };
    const done = () => {
      clearTimeout(quiet);
      clearTimeout(giveUp);
      map.off("idle", onIdle);
      map.off("render", onRender);
      document.removeEventListener("visibilitychange", start);
      resolve();
    };
    map.on("idle", onIdle);
    map.on("render", onRender);
    document.addEventListener("visibilitychange", start);
    start();
  });

// the map's canvas as an image, as an object URL -- needs the map created with preserveDrawingBuffer (see main.js), so the canvas still has its last frame in it. On white, since the style has no background of its own, and a JPEG would turn the transparent parts black.
const snapshot = (map) => {
  const canvas = map.getCanvas();
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const context = flat.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, flat.width, flat.height);
  context.drawImage(canvas, 0, 0);
  return new Promise((resolve, reject) =>
    flat.toBlob(
      (blob) =>
        blob
          ? resolve(URL.createObjectURL(blob))
          : reject(new Error("couldn't save the map as an image")),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
};

// Runs `draw` with the map resized to { width, height } CSS pixels and its controls hidden (so labels don't avoid them -- see labels.js), then puts the map back how it was.
export const withMapSize = async (map, { width, height }, draw) => {
  const container = document.getElementById("map-container");
  const area = document.getElementById("map-area");
  const view = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
  const pixelRatio = map.getPixelRatio();
  container.classList.add("atlas-capturing");
  Object.assign(area.style, { width: `${width}px`, height: `${height}px` });
  map.setPixelRatio(Math.max(pixelRatio, MIN_PIXEL_RATIO));
  map.resize();
  try {
    return await draw();
  } finally {
    container.classList.remove("atlas-capturing");
    Object.assign(area.style, { width: "", height: "" });
    map.setPixelRatio(pixelRatio);
    map.resize();
    map.jumpTo(view);
  }
};

// where [[west, south], [east, north]] falls on the map, as a { x, y, width, height } rect in its CSS pixels
const projectBounds = (map, [sw, ne]) => {
  const a = map.project(sw);
  const b = map.project(ne);
  return { x: a.x, y: b.y, width: b.x - a.x, height: a.y - b.y };
};

// Draws the whole area (given as [[west, south], [east, north]]) to fit, for the index page: its image, the town(s) in it (from the sidebar heading -- see places.js), and where the area and each page fall on it, as rects in its CSS pixels.
export const captureIndex = async (map, bounds, cells, { padding }) => {
  map.fitBounds(bounds, { padding, duration: 0, bearing: 0, pitch: 0 });
  // zoomed out to a whole area, the shading and flame length hatching cover everything, so the page numbers and towns are hard to read
  const visibility = INDEX_HIDDEN_LAYERS.map((id) =>
    map.getLayoutProperty(id, "visibility"),
  );
  INDEX_HIDDEN_LAYERS.forEach((id) =>
    map.setLayoutProperty(id, "visibility", "none"),
  );
  let image;
  let attribution;
  let places;
  try {
    await settle(map);
    refreshAttribution(map);
    attribution = document.getElementById("map-attribution").innerHTML;
    const heading = document.getElementById("map-places");
    places = heading.hidden ? "" : heading.textContent;
    image = await snapshot(map);
  } finally {
    INDEX_HIDDEN_LAYERS.forEach((id, i) =>
      map.setLayoutProperty(id, "visibility", visibility[i] ?? "visible"),
    );
  }
  const rects = new Map(
    cells.map((cell) => [
      `${cell.row},${cell.col}`,
      projectBounds(map, cell.bounds),
    ]),
  );
  return {
    image,
    attribution,
    places,
    outline: projectBounds(map, bounds),
    rects,
  };
};

// MapLibre's attribution only lists sources that have drawn something, and only rechecks on a few events -- so a source that loaded after the last one stays left off. This is one of those events (a source shown/hidden), so the attribution copied onto each page is complete.
const refreshAttribution = (map) =>
  map.fire("sourcedata", { dataType: "source", sourceDataType: "visibility" });

// Draws one page: its image, the town(s) on it (from the sidebar heading -- see places.js), and whether there's anything on it worth printing.
export const capturePage = async (map, { center, zoom }) => {
  map.jumpTo({ center, zoom, bearing: 0, pitch: 0 });
  await settle(map);
  refreshAttribution(map);
  const shown = CONTENT_LAYERS.filter(
    (id) => map.getLayoutProperty(id, "visibility") !== "none",
  );
  const empty =
    shown.length > 0 &&
    map.queryRenderedFeatures({ layers: shown }).length === 0;
  const heading = document.getElementById("map-places");
  return {
    image: empty ? undefined : await snapshot(map),
    places: heading.hidden ? "" : heading.textContent,
    empty,
  };
};
