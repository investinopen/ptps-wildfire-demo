import { HYDRANTS_LAYER, ONEWAY_ARROWS_LAYER } from "./layers.js";

// water sources and oneway streets are fetched live from OSM via Overpass rather than
// from roadsSource (open data, no API key) -- for water because OpenFreeMap's POI set
// doesn't include hydrants/tanks/etc. at all, for oneway because its "oneway" field
// turned out to be unreliable (see DRIVABLE_ROAD_CLASSES in layers.js).
//
// Overpass is a free, shared, volunteer-run service, so this tries to ask as little of
// it as possible:
// - every group below goes out in one combined query, rather than one per layer
// - it fetches a margin around the view, and skips refetching while the view stays
//   inside what's already loaded (panning around a neighborhood, zooming in)
// - a newer request cancels an in-flight one, so fast panning doesn't pile them up
// - a server that's rate-limiting (429) or failing is left alone for a while, and the
//   next one in OVERPASS_URLS is used instead
// https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  // VK Maps' public instance, which also allows cross-origin requests
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
// how long to skip a server after it rate-limits or fails, unless it says otherwise
// via Retry-After
const OVERPASS_COOLDOWN_MS = 60 * 1000;
// fraction of the view's width/height added on each side of what's fetched
const OVERPASS_MARGIN = 0.5;

// server URL -> timestamp before which it shouldn't be asked again
const overpassCooldowns = new Map();

const fetchOverpass = async (query, signal) => {
  const available = OVERPASS_URLS.filter(
    (url) => (overpassCooldowns.get(url) ?? 0) <= Date.now(),
  );
  for (const url of available) {
    try {
      const response = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        signal,
      });
      if (response.ok) return await response.json();
      const retryAfterSeconds = Number(response.headers.get("Retry-After"));
      overpassCooldowns.set(
        url,
        Date.now() +
          (retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : OVERPASS_COOLDOWN_MS),
      );
      console.warn(`Overpass ${url} responded ${response.status}`);
    } catch (error) {
      if (signal.aborted) throw error;
      // network failure, or a non-JSON (e.g. HTML error page) response
      overpassCooldowns.set(url, Date.now() + OVERPASS_COOLDOWN_MS);
      console.warn(`Overpass ${url} failed:`, error);
    }
  }
  throw new Error("No Overpass server available");
};

// what kind of water source an OSM element is, for the water layers' filters in layers.js.
// Cisterns don't have their own tag -- OSM maps them as emergency=water_tank.
// https://wiki.openstreetmap.org/wiki/Key:emergency
const waterKind = (tags) => {
  if (tags.emergency === "fire_hydrant") return "hydrant";
  if (tags.leisure === "swimming_pool") return "pool";
  return "water_source";
};

// one entry per GeoJSON source fed from Overpass. Each is only included in the query
// at or above its minzoom (matching its layers'), contributes its own statements
// plus how to output them, and picks its own elements back out of the combined
// response.
const OVERPASS_GROUPS = [
  {
    sourceId: "water",
    minzoom: HYDRANTS_LAYER.minzoom,
    // tanks/ponds/pools are often mapped as areas, so `out center` reduces those to
    // a point. Indoor pools are left out, since an engine can't draft from them.
    statements: (bbox) => `
      node["emergency"="fire_hydrant"]${bbox};
      nwr["emergency"~"^(water_tank|suction_point|fire_water_pond)$"]${bbox};
      nwr["leisure"="swimming_pool"]["indoor"!="yes"]${bbox};`,
    output: "center",
    matches: ({ tags = {} }) =>
      [
        "fire_hydrant",
        "water_tank",
        "suction_point",
        "fire_water_pond",
      ].includes(tags.emergency) || tags.leisure === "swimming_pool",
    toFeature: (el) => {
      const { lon, lat } = el.center || el;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { ...el.tags, kind: waterKind(el.tags) },
      };
    },
  },
  {
    sourceId: "oneway",
    minzoom: ONEWAY_ARROWS_LAYER.minzoom,
    statements: (bbox) => `
      way["highway"]["oneway"~"^(yes|-1|1)$"]${bbox};`,
    output: "geom",
    matches: (el) =>
      el.type === "way" && el.geometry && el.tags?.highway && el.tags.oneway,
    toFeature: (el) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: el.geometry.map((pt) => [pt.lon, pt.lat]),
      },
      properties: { oneway: el.tags.oneway === "-1" ? -1 : 1 },
    }),
  },
];

// keeps the Overpass-fed sources up to date as the map moves
export const bindOverpassData = (map) => {
  const liveDataSpinner = document.getElementById("live-data-spinner");
  // what's already been loaded: the (padded) area, and which groups were included
  let loadedBounds = null;
  let loadedGroups = [];
  let inFlight = null;

  const updateOverpassData = async () => {
    const zoom = map.getZoom();
    const groups = OVERPASS_GROUPS.filter((g) => zoom >= g.minzoom);
    // below every group's minzoom, nothing's drawn anyway -- keep what's loaded
    if (groups.length === 0) return;
    const view = map.getBounds();
    const alreadyLoaded =
      loadedBounds &&
      loadedBounds.contains(view.getSouthWest()) &&
      loadedBounds.contains(view.getNorthEast()) &&
      groups.every((g) => loadedGroups.includes(g));
    if (alreadyLoaded) return;

    const latMargin = (view.getNorth() - view.getSouth()) * OVERPASS_MARGIN;
    const lngMargin = (view.getEast() - view.getWest()) * OVERPASS_MARGIN;
    const bounds = new maplibregl.LngLatBounds(
      [view.getWest() - lngMargin, view.getSouth() - latMargin],
      [view.getEast() + lngMargin, view.getNorth() + latMargin],
    );
    const bbox = `(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()})`;
    // each group's results go into their own named set so they can be output
    // differently (points vs. full line geometry)
    const query =
      "[out:json][timeout:25];" +
      groups
        .map(
          (g) =>
            `(${g.statements(bbox)})->.${g.sourceId};.${g.sourceId} out ${g.output};`,
        )
        .join("");

    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    liveDataSpinner.hidden = false;
    try {
      const { elements } = await fetchOverpass(query, controller.signal);
      for (const g of groups) {
        const features = elements.filter(g.matches).map(g.toFeature);
        map
          .getSource(g.sourceId)
          .setData({ type: "FeatureCollection", features });
      }
      loadedBounds = bounds;
      loadedGroups = groups;
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Failed to load live data from Overpass:", error);
      }
    } finally {
      if (inFlight === controller) {
        inFlight = null;
        liveDataSpinner.hidden = true;
      }
    }
  };

  map.on("load", updateOverpassData);
  let overpassDebounce;
  map.on("moveend", () => {
    clearTimeout(overpassDebounce);
    overpassDebounce = setTimeout(updateOverpassData, 500);
  });
};
