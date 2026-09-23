// Vector tile archive of Overture building footprints with CarbonPlan's per-building
// wildfire risk attached (ODbL), from https://source.coop/carbonplan/carbonplan-ocr
// Same source + view as:
// https://pmtiles.io/#url=https://data.source.coop/carbonplan/carbonplan-ocr/output/fire-risk/vector/production/v1.1.0/pmtiles/buildings.pmtiles&map=16.03/40.052187/-105.375925
export const PMTILES_URL =
  "https://data.source.coop/carbonplan/carbonplan-ocr/output/fire-risk/vector/production/v1.1.0/pmtiles/buildings.pmtiles";
export const SOURCE_LAYER = "risk";
// the tiles' properties are numbered rather than named to save space -- "0" is
// rps_2011, annual risk to potential structures (%) under current (~2011) climate,
// the same score CarbonPlan's own map shows
// https://github.com/carbonplan/ocr/blob/main/ocr/pipeline/create_building_pmtiles.py
export const RISK_PROPERTY = "0";
// CarbonPlan's own bins for that score (a lower bound + color each), so a building
// reads the same here as on their map -- zero is its own gray, anything above zero
// starts at the first bin: https://github.com/carbonplan/ocr-web/blob/main/lib/config.ts
// Colors are ColorBrewer's 9-class Reds, resampled to 10 steps.
export const NO_RISK_COLOR = "#d9d9d9";
export const RISK_BINS = [
  [0, "#fff5f0"],
  [0.01, "#fee2d5"],
  [0.02, "#fcc3ac"],
  [0.035, "#fca082"],
  [0.06, "#fb7c5c"],
  [0.1, "#f6553d"],
  [0.2, "#e32f27"],
  [0.5, "#c3161b"],
  [1, "#9e0d14"],
  [3, "#67000d"],
];
export const BUILDING_MIN_ZOOM = 14.5;
