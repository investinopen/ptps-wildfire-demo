// Printing a whole county as an atlas: pick a county and a level of detail, and the county is split into a grid of pages (atlas-grid.js), each drawn by the map itself (atlas-capture.js) and laid out for printing (atlas-pages.js) after an index page. Pages with no roads or buildings on them are left out.
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

// the zooms to choose from, with what shows at each (see BUILDING_MIN_ZOOM in buildings.js and the minzooms in layers.js)
const DETAIL_LEVELS = [
  { zoom: 14, shows: "roads only" },
  { zoom: 14.5, shows: "roads and buildings" },
  { zoom: 15, shows: "plus one-way arrows" },
  { zoom: 16, shows: "plus house numbers" },
];
// picked by default: the most detailed level with at most this many pages
const DEFAULT_MAX_PAGES = 150;
// more than this would take hours to draw, and more memory than a browser has to hold the images
const MAX_PAGES = 1000;
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

export const bindAtlas = (map) => {
  const dialog = document.getElementById("atlas-dialog");
  const detail = document.getElementById("atlas-detail");
  const status = document.getElementById("atlas-status");
  const progress = document.getElementById("atlas-progress");
  const makeButton = document.getElementById("atlas-make");
  const printButton = document.getElementById("atlas-print");
  const atlas = document.getElementById("atlas");

  // the county picked, as { title, geometry, latitude, grids } (a grid per detail level)
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

  const showDetailLevels = () => {
    const options = DETAIL_LEVELS.map(({ zoom, shows }, i) => {
      const pages = county.grids[i].cells.length;
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `${scaleText(county.latitude, zoom)}: ${shows} (up to ${pages} pages)`;
      option.disabled = pages > MAX_PAGES;
      return option;
    });
    detail.replaceChildren(...options);
    const fitting = options.filter(
      (o, i) => county.grids[i].cells.length <= DEFAULT_MAX_PAGES,
    );
    detail.value = (fitting.at(-1) ?? options[0]).value;
    detail.disabled = false;
    makeButton.disabled = options.every((o) => o.disabled);
  };

  const chooseCounty = async (feature) => {
    discard();
    county = undefined;
    detail.disabled = true;
    makeButton.disabled = true;
    setStatus("Looking up the county's boundary…");
    try {
      const { title, geometry } = await fetchBoundary(feature);
      county = {
        title,
        geometry,
        latitude: middleLatitude(geometry),
        grids: DETAIL_LEVELS.map(({ zoom }) =>
          atlasGrid(geometry, { zoom, ...PAGE_MAP_SIZE, overlap: OVERLAP }),
        ),
      };
      showDetailLevels();
      setStatus(`${title}: pick how detailed the pages should be.`);
    } catch (error) {
      console.error("County lookup failed:", error);
      setStatus("Couldn't get that county's boundary. Try again?");
    }
  };

  // draws every page, then the index, returning the pages with something on them, numbered -- or nothing if stopped partway
  const drawPages = async (cells, zoom, thisRun) => {
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
    const level = DETAIL_LEVELS[detail.value];
    const { cells } = county.grids[detail.value];
    makeButton.disabled = detail.disabled = true;
    progress.hidden = false;
    try {
      const result = await drawPages(cells, level.zoom, thisRun);
      if (!result) return;
      const { pages, index } = result;
      const skipped = cells.length - pages.length;
      const details = `${pages.length} pages at ${scaleText(county.latitude, level.zoom)}, made ${new Date().toLocaleDateString()}. ${document.getElementById("disclaimer-banner").textContent.replace(/\s+/g, " ").trim()}`;
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
      makeButton.disabled = detail.disabled = false;
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
    makeButton.disabled = !county;
    detail.disabled = !county;
  });
  document
    .getElementById("atlas-close")
    .addEventListener("click", () => dialog.close());
};
