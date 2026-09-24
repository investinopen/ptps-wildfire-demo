import { FLAME_LENGTH_CLASSES, hatchCss } from "./rasters.js";
import { iconDataUrl } from "./icons.js";

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
  for (const { color, range, meaning } of FLAME_LENGTH_CLASSES) {
    keyRow(key, hatchCss(color), range, meaning);
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
    "buildings-fill",
    "buildings-outline",
    "housenumbers",
    "building-obstacles",
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
  bindLayerToggle("hydrants-toggle", ["hydrants"]);
  bindLayerToggle("water-sources-toggle", ["water-sources"]);
  bindLayerToggle("pools-toggle", ["pools"]);
  bindLayerToggle("gates-toggle", ["gates"]);
  bindLayerToggle("dead-ends-toggle", ["dead-ends"]);
  bindLayerToggle("weight-limits-toggle", ["weight-limits"]);
};
