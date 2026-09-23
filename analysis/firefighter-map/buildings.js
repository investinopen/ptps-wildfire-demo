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
// Bins for that score, each a lower bound (in % annual risk), color, and name for the legend -- zero is its own gray, anything above zero starts at the first bin. A coarser grouping of CarbonPlan's own 10 bins (every boundary here is one of theirs, so a building never lands in a lower bin here than on their map), since crews need to tell low from high at a glance rather than read fine gradations: https://github.com/carbonplan/ocr-web/blob/main/lib/config.ts
// Colors are picked from ColorBrewer's Reds.
export const NO_RISK_COLOR = "#d9d9d9";
export const RISK_BINS = [
  { min: 0, color: "#fcbba1", label: "Low" },
  { min: 0.1, color: "#fb6a4a", label: "Moderate" },
  { min: 0.5, color: "#cb181d", label: "High" },
  { min: 1, color: "#67000d", label: "Very high" },
];
export const BUILDING_MIN_ZOOM = 14.5;
