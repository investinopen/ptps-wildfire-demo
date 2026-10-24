// Printing an area as an atlas: draw a rectangle on the map (atlas-draw.js) and pick a scale, and the area is split into a grid of pages (atlas-grid.js), each drawn by the map itself (atlas-capture.js) and laid out for printing (atlas-pages.js), after an index page if there's more than one. Pages with no roads or buildings on them are left out.
import { atlasGrid, numberPages, zoomForScale } from "./atlas-grid.js";
import { bindAreaDrawing, boundsPolygon } from "./atlas-draw.js";
import { HOUSENUMBERS_LAYER } from "./layers.js";
import { captureIndex, capturePage, withMapSize } from "./atlas-capture.js";
import {
  INDEX_MAP_SIZE,
  PAGE_MAP_SIZE,
  indexPage,
  mapPage,
  sidebarCopy,
} from "./atlas-pages.js";

// the scales to choose from, as 1:N
const SCALES = [2_000, 3_000, 4_000, 5_000, 6_000];
const DEFAULT_SCALE = 4_000;
// zoomed out past this, house numbers, dead ends, gates, and weight limits don't show (see layers.js), so scales that would need it are left out
const MIN_ZOOM = HOUSENUMBERS_LAYER.minzoom;
// more than this would take over an hour to draw, and more memory than a browser has to hold the images (roughly 0.3-0.5 MB a page)
const MAX_PAGES = 2000;
// about how long each page takes to draw, for the estimate before starting
const SECONDS_PER_PAGE = 2;
// how much neighboring pages overlap (as a fraction of a page), so nothing falls on a seam
const OVERLAP = 0.05;
// around the area on the index page, in CSS pixels
const INDEX_PADDING = 24;
// around the area when it's moved into view above the dialog, in CSS pixels
const PREVIEW_PADDING = 40;
// the heading when the index page has no town to name it after
const DEFAULT_TITLE = "Map pages";

const scaleText = (denominator) => `1:${denominator.toLocaleString("en-US")}`;

export const bindAtlas = (map) => {
  const openButton = document.getElementById("atlas-open");
  const banner = document.getElementById("atlas-draw-banner");
  const dialog = document.getElementById("atlas-dialog");
  const scaleSelect = document.getElementById("atlas-scale");
  const status = document.getElementById("atlas-status");
  const progress = document.getElementById("atlas-progress");
  const makeButton = document.getElementById("atlas-make");
  const printButton = document.getElementById("atlas-print");
  const atlas = document.getElementById("atlas");

  // the area drawn, as { bounds, geometry, latitude }
  let area;
  // its pages at the scale picked, as { zoom, scale, cells }
  let layout;
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

  // the pages at the scale picked, previewed on the map
  const showLayout = () => {
    discard();
    const scale = Number(scaleSelect.value);
    const zoom = zoomForScale(area.latitude, scale);
    const { cells } = atlasGrid(area.geometry, {
      zoom,
      ...PAGE_MAP_SIZE,
      overlap: OVERLAP,
    });
    layout = { zoom, scale, cells };
    drawing.preview(area.bounds, cells);
    const pages = cells.length.toLocaleString("en-US");
    makeButton.disabled = cells.length > MAX_PAGES;
    if (cells.length > MAX_PAGES) {
      setStatus(
        `That's ${pages} pages at ${scaleText(scale)}, more than this can print at once. Draw a smaller area, or pick a smaller scale.`,
      );
      return;
    }
    const minutes = Math.ceil((cells.length * SECONDS_PER_PAGE) / 60);
    setStatus(
      cells.length === 1
        ? "1 page."
        : `Up to ${pages} pages, plus an index page, about ${minutes} min to draw.`,
    );
  };

  // the scales that keep everything on the map at the area's latitude
  const showScales = () => {
    const options = SCALES.map((scale) => {
      const option = document.createElement("option");
      option.value = scale;
      option.textContent = scaleText(scale);
      option.disabled = zoomForScale(area.latitude, scale) < MIN_ZOOM;
      return option;
    });
    scaleSelect.replaceChildren(...options);
    const usable = options.filter((o) => !o.disabled);
    scaleSelect.value = (
      usable.find((o) => Number(o.value) === DEFAULT_SCALE) ?? usable.at(-1)
    ).value;
  };

  const drawn = (bounds) => {
    banner.hidden = true;
    area = {
      bounds,
      geometry: boundsPolygon(bounds),
      latitude: (bounds[0][1] + bounds[1][1]) / 2,
    };
    showScales();
    showLayout();
    dialog.showModal();
    // moves the area into view above the dialog (at the bottom of the screen -- see index.css), so its pages can be seen while picking a scale, without zooming in past where it was drawn
    map.fitBounds(bounds, {
      padding: {
        top: PREVIEW_PADDING,
        left: PREVIEW_PADDING,
        right: PREVIEW_PADDING,
        bottom: dialog.offsetHeight + PREVIEW_PADDING,
      },
      maxZoom: map.getZoom(),
    });
  };

  const drawing = bindAreaDrawing(map, { onDrawn: drawn });

  const startDrawing = () => {
    dialog.close();
    drawing.start();
    banner.hidden = false;
  };
  const cancelDrawing = () => {
    drawing.stop();
    drawing.clear();
    banner.hidden = true;
  };

  // draws every page, then the index, returning the pages with something on them, numbered, and the index -- or nothing if stopped partway
  const drawPages = async ({ cells, zoom }, thisRun) => {
    const drawnPages = [];
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
          drawnPages.push({ ...cell, ...result, sidebar: sidebarCopy() });
      }
    });
    if (thisRun.cancelled) return;
    const pages = numberPages(drawnPages);
    setStatus("Drawing the index page…");
    const index = await withMapSize(map, INDEX_MAP_SIZE, () =>
      captureIndex(map, area.geometry, pages, { padding: INDEX_PADDING }),
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
    makeButton.disabled = scaleSelect.disabled = true;
    progress.hidden = false;
    // so the preview isn't drawn onto the pages
    drawing.hide(true);
    try {
      const result = await drawPages(layout, thisRun);
      if (!result) return;
      const { pages, index } = result;
      if (!pages.length) {
        setStatus("There are no roads or buildings in that area to print.");
        return;
      }
      const skipped = layout.cells.length - pages.length;
      const title = index.places || DEFAULT_TITLE;
      const details = `${pages.length} pages at ${scaleText(layout.scale)}, made ${new Date().toLocaleDateString()}. ${document.getElementById("disclaimer-banner").textContent.replace(/\s+/g, " ").trim()}`;
      atlas.replaceChildren(
        // a single page doesn't need an index
        ...(pages.length > 1
          ? [indexPage({ title, details, index, pages })]
          : []),
        ...pages.map((page) =>
          mapPage({ title, page, total: pages.length, index, pages }),
        ),
      );
      document.body.classList.add("atlas-ready");
      printButton.hidden = false;
      const sheets = pages.length > 1 ? pages.length + 1 : 1;
      setStatus(
        `Ready: ${sheets} ${sheets === 1 ? "page" : "pages, including the index"}` +
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
      makeButton.disabled = scaleSelect.disabled = false;
      progress.hidden = true;
      drawing.hide(false);
    }
  };

  openButton.addEventListener("click", startDrawing);
  // the pages are drawn with the map, so not until it's ready (and never, if it can't start)
  map.once("load", () => (openButton.disabled = false));
  document.getElementById("atlas-use-view").addEventListener("click", () => {
    drawing.stop();
    drawn(map.getBounds().toArray());
  });
  document
    .getElementById("atlas-draw-cancel")
    .addEventListener("click", cancelDrawing);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !banner.hidden) cancelDrawing();
  });
  scaleSelect.addEventListener("change", showLayout);
  makeButton.addEventListener("click", make);
  printButton.addEventListener("click", () => window.print());
  document
    .getElementById("atlas-redraw")
    .addEventListener("click", startDrawing);
  // closing (including with Escape) stops or throws away the atlas, so printing the map afterward prints the map
  dialog.addEventListener("close", () => {
    discard();
    if (banner.hidden) drawing.clear();
  });
  document
    .getElementById("atlas-close")
    .addEventListener("click", () => dialog.close());
};
