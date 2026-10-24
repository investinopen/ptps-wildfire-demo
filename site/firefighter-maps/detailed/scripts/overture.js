// Overture Maps' own hosted vector tiles, read directly rather than built here. Attributed by the files themselves; each source's terms are at https://docs.overturemaps.org/attribution/
// Each release's tiles are only kept for about two months (https://stac.overturemaps.org/catalog.json lists the ones still up), so publish-site.yml replaces this with the latest release each time it publishes.
export const OVERTURE_RELEASE = "2026-10-21.0";
const TILES = `https://tiles.overturemaps.org/${OVERTURE_RELEASE}`;

// the same footprints CarbonPlan's are built from -- OpenStreetMap's alone have almost none in rural Alaska and Hawaii (1 in the z14 tile around Hawaiian Paradise Park, to Overture's 1,169), since Overture adds Microsoft's and Google's machine-learned ones. Only read within NO_RISK_DATA_BOUNDS (see buildings.js).
export const OVERTURE_BUILDINGS_URL = `${TILES}/buildings.pmtiles`;
// mostly from the National Address Database and county/state data via OpenAddresses -- OpenStreetMap's are sparse in most rural areas (49 around Paradise, CA, to Overture's 18,179; 76 around Ruidoso, NM, to 11,366). Only in z14 tiles, overzoomed past that.
export const OVERTURE_ADDRESSES_URL = `${TILES}/addresses.pmtiles`;
