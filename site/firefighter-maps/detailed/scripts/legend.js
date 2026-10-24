import { FLAME_LENGTH_CLASSES, hatchCss } from "./rasters.js";
import { iconDataUrl } from "./icons.js";
import { NO_RISK_DATA_BOUNDS } from "./buildings.js";

// a row of the flame length key below: a pattern cell, a bold name, and a description
const keyRow = (key, background, name, description) => {
  const cell = document.createElement("span");
  cell.className = "cell";
  cell.style.background = background;
  const term = document.createElement("span");
  term.className = "term";
  term.textContent = name;
  const detail = document.createElement("span");
  detail.textContent = description;
  key.append(cell, term, detail);
};

// one row per class: its hatch, range, and what that flame length means for attack
const buildFlameLengthKey = () => {
  const key = document.getElementById("flame-length-key");
  for (const { hatch, range, meaning } of FLAME_LENGTH_CLASSES) {
    keyRow(key, hatchCss(hatch), range, meaning);
  }
};

// filled in by main.js right away rather than after the map, so the legend is complete
// even if the map itself fails to start (e.g. no WebGL)
export const buildLegendKeys = () => {
  buildFlameLengthKey();
  // swatches drawn from the same canvas code as their map symbols
  for (const swatch of document.querySelectorAll(".swatch[data-icon]")) {
    swatch.style.backgroundImage = `url(${iconDataUrl(swatch.dataset.icon)})`;
  }
};

// Keys the buildings by what's in view: risk colors in the contiguous US, white ones without a score in Alaska and Hawaii (see NO_RISK_DATA_BOUNDS). Swapped in place rather than listed as a second row, which would push a printout onto a second page. The two areas are far enough apart that buildings from both are never in view at once.
export const bindBuildingsKey = (map) => {
  const swatch = document.getElementById("buildings-swatch");
  const name = document.getElementById("buildings-name");
  const update = () => {
    const noRiskData = map.getCenter().lng < NO_RISK_DATA_BOUNDS[2];
    swatch.classList.toggle("buildings", !noRiskData);
    swatch.classList.toggle("no-risk-data", noRiskData);
    name.textContent = noRiskData
      ? "Buildings (no risk data here)"
      : "Buildings, by wildfire risk";
  };
  update();
  map.on("moveend", update);
};

// wires each legend checkbox to show/hide its layers
export const bindLayerToggles = (map) => {
  // wires a checkbox to show/hide one or more layers together
  const bindLayerToggle = (checkboxId, layerIds) => {
    document.getElementById(checkboxId).addEventListener("change", (e) => {
      const visibility = e.target.checked ? "visible" : "none";
      for (const id of layerIds) {
        map.setLayoutProperty(id, "visibility", visibility);
      }
    });
  };
  bindLayerToggle("hillshade-toggle", ["hillshade"]);
  bindLayerToggle("flame-length-toggle", ["flame-length"]);
  bindLayerToggle("buildings-toggle", [
    "buildings-halo",
    "buildings-fill",
    "buildings-outline",
    "overture-buildings-halo",
    "overture-buildings-fill",
    "overture-buildings-outline",
    "housenumbers",
    "building-obstacles",
    "overture-building-obstacles",
  ]);
  // driveways and paths are listed under roads, without toggles of their own
  bindLayerToggle("roads-toggle", [
    "roads",
    "road-labels",
    "road-label-fallbacks",
    "oneway-arrows",
    "route-shields",
    "driveways",
    "driveway-obstacles",
    "trails",
    "trail-labels",
  ]);
  bindLayerToggle("state-lines-toggle", ["state-lines"]);
  bindLayerToggle("hydrants-toggle", ["hydrants"]);
  bindLayerToggle("water-sources-toggle", ["water-sources"]);
  bindLayerToggle("pools-toggle", ["pools"]);
  bindLayerToggle("gates-toggle", ["gates"]);
  bindLayerToggle("dead-ends-toggle", ["dead-ends"]);
  bindLayerToggle("weight-limits-toggle", ["weight-limits"]);
};
