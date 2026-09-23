import { NO_RISK_COLOR, RISK_BINS } from "./buildings.js";
import { FLAME_LENGTH_CLASSES, hatchCss } from "./rasters.js";
import { iconDataUrl } from "./icons.js";

// the zero-risk gray is labeled "0" under its own cell; every other label sits on the
// boundary where a bin starts (skipping the first bin's own lower bound of 0, since
// it really means "above zero"), with the last bin reading as "3+"
const buildRiskKey = () => {
  const key = document.getElementById("building-risk-key");
  const cellWidth = parseFloat(
    getComputedStyle(key).getPropertyValue("--cell-width"),
  );
  // the outer border, then (after the gray cell) its divider + gap -- see #building-risk-key's CSS in index.html
  const border = 1;
  const grayOffset = border + cellWidth + 1 + 3;
  const cells = key.querySelector(".cells");
  const ticks = key.querySelector(".ticks");
  const addTick = (text, left) => {
    const tick = document.createElement("span");
    tick.textContent = text;
    tick.style.left = left + "px";
    ticks.append(tick);
  };
  for (const color of [NO_RISK_COLOR, ...RISK_BINS.map(([, c]) => c)]) {
    const cell = document.createElement("span");
    cell.style.background = color;
    cells.append(cell);
  }
  addTick("0", border + cellWidth / 2);
  RISK_BINS.slice(1).forEach(([lowerBound], i) => {
    const isLast = i === RISK_BINS.length - 2;
    addTick(
      // drops the leading zero to keep labels narrow enough for their cells
      String(lowerBound).replace(/^0\./, ".") + (isLast ? "+" : ""),
      grayOffset + (i + 1) * cellWidth,
    );
  });
};

// one row per class: its color, range, and what that flame length means for attack
const buildFlameLengthKey = () => {
  const flameLengthKey = document.getElementById("flame-length-key");
  for (const { color, range, meaning } of FLAME_LENGTH_CLASSES) {
    const cell = document.createElement("span");
    cell.className = "cell";
    cell.style.background = hatchCss(color);
    const rangeLabel = document.createElement("span");
    rangeLabel.className = "range";
    rangeLabel.textContent = range;
    const meaningLabel = document.createElement("span");
    meaningLabel.textContent = meaning;
    flameLengthKey.append(cell, rangeLabel, meaningLabel);
  }
};

// filled in by main.js right away rather than after the map, so the legend is complete
// even if the map itself fails to start (e.g. no WebGL)
export const buildLegendKeys = () => {
  buildRiskKey();
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
  bindLayerToggle("burn-probability-toggle", ["burn-probability"]);
  bindLayerToggle("buildings-toggle", [
    "buildings-fill",
    "buildings-outline",
    "housenumbers",
  ]);
  bindLayerToggle("roads-toggle", ["roads", "road-labels", "oneway-arrows"]);
  bindLayerToggle("driveways-toggle", ["driveways"]);
  bindLayerToggle("trails-toggle", ["trails", "trail-labels"]);
  bindLayerToggle("hydrants-toggle", ["hydrants"]);
  bindLayerToggle("water-sources-toggle", ["water-sources"]);
  bindLayerToggle("pools-toggle", ["pools"]);
  bindLayerToggle("gates-toggle", ["gates"]);
  bindLayerToggle("dead-ends-toggle", ["dead-ends"]);
  bindLayerToggle("weight-limits-toggle", ["weight-limits"]);
};
