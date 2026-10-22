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
// Bins for that score, each a lower bound (in % annual risk) and color -- zero is its own gray, anything above zero starts at the first bin. A coarser grouping of CarbonPlan's own 10 bins (every boundary here is one of theirs, so a building never lands in a lower bin here than on their map), since crews need to tell low from high at a glance rather than read fine gradations: https://github.com/carbonplan/ocr-web/blob/main/lib/config.ts
// Colors are picked from ColorBrewer's Reds.
export const NO_RISK_COLOR = "#d9d9d9";
// buildings without a score at all (see NO_RISK_DATA_BOUNDS)
export const NO_RISK_DATA_COLOR = "#ffffff";
export const RISK_BINS = [
  { min: 0, color: "#fcbba1" },
  { min: 0.1, color: "#fb6a4a" },
  { min: 0.5, color: "#cb181d" },
  { min: 1, color: "#67000d" },
];
export const BUILDING_MIN_ZOOM = 14.5;
// The scores only cover the contiguous US (the tiles' bounds stop there), so Alaska and Hawaii get OpenStreetMap's buildings from the basemap instead, drawn without a score. One box, as [west, south, east, north], from the antimeridian to just east of the Alaska panhandle's tip, which takes in both states and stops well short of Washington. It's the bounds of a source of its own rather than a filter, since MapLibre's "within" doesn't match polygons.
export const NO_RISK_DATA_BOUNDS = [-180, 18.5, -129, 72];
