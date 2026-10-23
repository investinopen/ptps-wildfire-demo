// Printing a whole county as an atlas: pick a county, and it's split into a grid of pages (atlas-grid.js) at the zoom the map opens at, so house numbers show, each drawn by the map itself (atlas-capture.js) and laid out for printing (atlas-pages.js) after an index page. Pages with no roads or buildings on them are left out.
import { bindCombobox } from "./combobox.js";
import { fetchPlaces } from "./search.js";
import { atlasGrid, numberPages, scaleDenominator } from "./atlas-grid.js";
import { captureIndex, capturePage, withMapSize } from "./atlas-capture.js";
import {
  INDEX_MAP_SIZE,
  PAGE_MAP_SIZE,
  indexPage,
  mapPage,
  sidebarCopy,
} from "./atlas-pages.js";

// county boundaries come from Nominatim, one request per county picked (which its usage policy allows, unlike search-as-you-type -- see search.js), simplified to about 50 m so the response stays small
// https://nominatim.org/release-docs/latest/api/Lookup/
const NOMINATIM_LOOKUP_URL = "https://nominatim.openstreetmap.org/lookup";
const SIMPLIFY_DEGREES = 0.0005;
const LOOKUP_TIMEOUT_MS = 20_000;

// more than this would take over an hour to draw, and more memory than a browser has to hold the images (roughly 0.3-0.5 MB a page)
const MAX_PAGES = 2000;
// about how long each page takes to draw, for the estimate before starting
const SECONDS_PER_PAGE = 2;
// how much neighboring pages overlap (as a fraction of a page), so nothing falls on a seam
const OVERLAP = 0.05;
// around the area on the index page, in CSS pixels
const INDEX_PADDING = 24;

// the boundary of a county from Photon's search results, as { title, geometry }
const fetchBoundary = async ({ properties: { osm_type, osm_id } }) => {
  const params = new URLSearchParams({
    osm_ids: `${osm_type}${osm_id}`,
    format: "geojson",
    polygon_geojson: 1,
    polygon_threshold: SIMPLIFY_DEGREES,
  });
  const response = await fetch(`${NOMINATIM_LOOKUP_URL}?${params}`, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`lookup failed: ${response.status}`);
  const [feature] = (await response.json()).features;
  if (!["Polygon", "MultiPolygon"].includes(feature?.geometry.type)) {
    throw new Error("no boundary found");
  }
  const { name, address } = feature.properties;
  return {
    title: [name, address?.state].filter(Boolean).join(", "),
    geometry: feature.geometry,
  };
};

// the latitude in the middle of an area, for its scale
const middleLatitude = ({ type, coordinates }) => {
  const lats = (type === "Polygon" ? coordinates : coordinates.flat())
    .flat()
    .map(([, lat]) => lat);
  return (Math.min(...lats) + Math.max(...lats)) / 2;
};

// "1:6,900" -- rounded, since it's only exact in the middle of the area
const scaleText = (lat, zoom) =>
  `1:${(Math.round(scaleDenominator(lat, zoom) / 100) * 100).toLocaleString("en-US")}`;

// `zoom` is the one the pages are drawn at
export const bindAtlas = (map, { zoom }) => {
  const dialog = document.getElementById("atlas-dialog");
  const status = document.getElementById("atlas-status");
  const progress = document.getElementById("atlas-progress");
  const makeButton = document.getElementById("atlas-make");
  const printButton = document.getElementById("atlas-print");
  const atlas = document.getElementById("atlas");

  // the county picked, as { title, geometry, latitude, cells } (its pages)
  let county;
  // the atlas being made, if any, so it can be stopped
  let run;

  const setStatus = (text) => (status.textContent = text);

  // throws away a finished (or half-made) atlas, and the page images it was holding on to
  const discard = () => {
    if (run) run.cancelled = true;
    run = undefined;
    for (const img of atlas.querySelectorAll("img, image")) {
      URL.revokeObjectURL(img.getAttribute("src") ?? img.getAttribute("href"));
    }
    atlas.replaceChildren();
    document.body.classList.remove("atlas-ready");
    printButton.hidden = true;
    progress.hidden = true;
  };

  const chooseCounty = async (feature) => {
    discard();
    county = undefined;
    makeButton.disabled = true;
    setStatus("Looking up the county's boundary…");
    try {
      const { title, geometry } = await fetchBoundary(feature);
      county = {
        title,
        geometry,
        latitude: middleLatitude(geometry),
        cells: atlasGrid(geometry, {
          zoom,
          ...PAGE_MAP_SIZE,
          overlap: OVERLAP,
        }).cells,
      };
      const pages = county.cells.length.toLocaleString("en-US");
      const scale = scaleText(county.latitude, zoom);
      if (county.cells.length > MAX_PAGES) {
        setStatus(
          `${title} would take ${pages} pages at ${scale}, more than this can print at once.`,
        );
        return;
      }
      makeButton.disabled = false;
      const minutes = Math.ceil((county.cells.length * SECONDS_PER_PAGE) / 60);
      setStatus(
        `${title}: up to ${pages} pages at ${scale}, about ${minutes} min to draw.`,
      );
    } catch (error) {
      console.error("County lookup failed:", error);
      setStatus("Couldn't get that county's boundary. Try again?");
    }
  };

  // draws every page, then the index, returning the pages with something on them, numbered -- or nothing if stopped partway
  const drawPages = async (cells, thisRun) => {
    const drawn = [];
    const started = Date.now();
    await withMapSize(map, PAGE_MAP_SIZE, async () => {
      for (const [i, cell] of cells.entries()) {
        if (thisRun.cancelled) return;
        const left =
          i &&
          Math.ceil(
            (((Date.now() - started) / i) * (cells.length - i)) / 60_000,
          );
        setStatus(
          `Drawing page ${i + 1} of ${cells.length}` +
            (left ? ` (about ${left} min left)…` : "…"),
        );
        progress.value = i / cells.length;
        const result = await capturePage(map, { center: cell.center, zoom });
        if (!result.empty)
          drawn.push({ ...cell, ...result, sidebar: sidebarCopy() });
      }
    });
    if (thisRun.cancelled) return;
    const pages = numberPages(drawn);
    setStatus("Drawing the index page…");
    const index = await withMapSize(map, INDEX_MAP_SIZE, () =>
      captureIndex(map, county.geometry, pages, { padding: INDEX_PADDING }),
    );
    if (thisRun.cancelled) {
      URL.revokeObjectURL(index.image);
      return;
    }
    return { pages, index };
  };

  const make = async () => {
    discard();
    const thisRun = (run = { cancelled: false });
    const { cells } = county;
    makeButton.disabled = true;
    progress.hidden = false;
    try {
      const result = await drawPages(cells, thisRun);
      if (!result) return;
      const { pages, index } = result;
      const skipped = cells.length - pages.length;
      const details = `${pages.length} pages at ${scaleText(county.latitude, zoom)}, made ${new Date().toLocaleDateString()}. ${document.getElementById("disclaimer-banner").textContent.replace(/\s+/g, " ").trim()}`;
      atlas.replaceChildren(
        indexPage({ title: county.title, details, index, pages }),
        ...pages.map((page) =>
          mapPage({
            title: county.title,
            page,
            total: pages.length,
            index,
            pages,
          }),
        ),
      );
      document.body.classList.add("atlas-ready");
      progress.hidden = true;
      printButton.hidden = false;
      setStatus(
        `Ready: ${pages.length + 1} pages, including the index` +
          (skipped
            ? ` (${skipped} without roads or buildings left out).`
            : "."),
      );
      printButton.focus();
    } catch (error) {
      console.error("Making the atlas failed:", error);
      setStatus("Something went wrong drawing the pages. Try again?");
    } finally {
      if (run === thisRun) run = undefined;
      makeButton.disabled = false;
      progress.hidden = true;
    }
  };

  bindCombobox({
    form: document.getElementById("atlas-county-search"),
    input: document.getElementById("atlas-county-input"),
    list: document.getElementById("atlas-county-suggestions"),
    search: (query, signal) =>
      fetchPlaces(map, query, signal, { layer: "county" }),
    // Photon leaves "County" off of counties' names
    label: ({ properties: { name, state } }) =>
      [name, state].filter(Boolean).join(", "),
    onChoose: chooseCounty,
    // e.g. a consolidated city-county like Denver, which OSM tags as a city
    onNoMatch: () => setStatus("No county found by that name."),
  });
  const openButton = document.getElementById("atlas-open");
  openButton.addEventListener("click", () => dialog.showModal());
  // the pages are drawn with the map, so not until it's ready (and never, if it can't start)
  map.once("load", () => (openButton.disabled = false));
  makeButton.addEventListener("click", make);
  printButton.addEventListener("click", () => window.print());
  // closing (including with Escape) stops or throws away the atlas, so printing the map afterward prints the map
  dialog.addEventListener("close", () => {
    discard();
    makeButton.disabled = !county || county.cells.length > MAX_PAGES;
  });
  document
    .getElementById("atlas-close")
    .addEventListener("click", () => dialog.close());
};
