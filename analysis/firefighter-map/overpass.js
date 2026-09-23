import { HYDRANTS_LAYER, ONEWAY_ARROWS_LAYER } from "./layers.js";

// water sources and road access (oneway streets, gates, dead ends, bridge weight limits)
// are fetched live from OSM via Overpass rather than from roadsSource (open data, no API
// key) -- OpenFreeMap's tiles don't include hydrants/tanks/gates/etc. at all, its
// "oneway" field turned out to be unreliable (see DRIVABLE_ROAD_CLASSES in layers.js),
// and finding dead ends needs how roads connect, which vector tiles don't keep.
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
  // Private.coffee's public instance -- no rate limits, per the wiki page above
  "https://overpass.private.coffee/api/interpreter",
];
// how long to wait on one server before moving on to the next, so one that's hanging (rather than failing outright) doesn't hold up the others. A bit longer than the queries' own [timeout:25].
const OVERPASS_REQUEST_TIMEOUT_MS = 30 * 1000;
// how long to skip a server after it rate-limits or fails, unless it says otherwise
// via Retry-After
const OVERPASS_COOLDOWN_MS = 60 * 1000;
// fraction of the view's width/height added on each side of what's fetched
const OVERPASS_MARGIN = 0.5;

// widens bounds out to a grid one map tile wide at the current zoom, so views that
// are close to each other produce the exact same query -- which is what lets a cached
// response be found again offline, since the cache is keyed on the full URL
const snapToGrid = (bounds, zoom) => {
  const step = 360 / 2 ** Math.floor(zoom);
  const down = (n) => Math.floor(n / step) * step;
  const up = (n) => Math.ceil(n / step) * step;
  return new maplibregl.LngLatBounds(
    [down(bounds.getWest()), down(bounds.getSouth())],
    [up(bounds.getEast()), up(bounds.getNorth())],
  );
};

// server URL -> timestamp before which it shouldn't be asked again
const overpassCooldowns = new Map();

const fetchOverpass = async (query, signal) => {
  const available = OVERPASS_URLS.filter(
    (url) => (overpassCooldowns.get(url) ?? 0) <= Date.now(),
  );
  for (const url of available) {
    try {
      // GET rather than POST so the service worker can cache it for offline use (see
      // sw.js) -- the Cache API can't store responses to POSTs. Whitespace is collapsed
      // to keep the URL short.
      const response = await fetch(
        `${url}?data=${encodeURIComponent(query.replace(/\s+/g, " "))}`,
        {
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(OVERPASS_REQUEST_TIMEOUT_MS),
          ]),
        },
      );
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
      // network failure, timeout, or a non-JSON (e.g. HTML error page) response
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

// drivable roads, for one-way arrows, gates, dead ends, and bridge weight limits.
// Tracks are included since engines use them as fire roads, but never flagged as dead
// ends (they routinely end at trails).
// https://wiki.openstreetmap.org/wiki/Key:highway
const DRIVABLE_HIGHWAYS =
  "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|track";
const isDrivable = new RegExp(`^(${DRIVABLE_HIGHWAYS})$`);
// barriers an engine can't drive through, even when open some of the time
// https://wiki.openstreetmap.org/wiki/Key:barrier
const VEHICLE_BARRIERS = "gate|lift_gate|swing_gate|chain|bollard";
const isVehicleBarrier = new RegExp(`^(${VEHICLE_BARRIERS})$`);
// mapped places to turn around at the end of a road
// https://wiki.openstreetmap.org/wiki/Tag:highway%3Dturning_circle
const TURNAROUNDS = "turning_circle|turning_loop";
const isTurnaround = new RegExp(`^(${TURNAROUNDS})$`);
// service roads that end in a parking lot or drive-through by design
const NON_ROUTE_SERVICE = ["parking_aisle", "parking", "drive-through"];
// short driveways can be backed out of; long rural ones with no turnaround are the
// real hazard for an engine
const MIN_DEAD_END_DRIVEWAY_METERS = 150;

const lineLengthMeters = (geometry) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    const a = geometry[i - 1];
    const b = geometry[i];
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lon - a.lon);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(a.lat)) *
        Math.cos(toRadians(b.lat)) *
        Math.sin(dLon / 2) ** 2;
    total += 2 * 6371000 * Math.asin(Math.sqrt(h));
  }
  return total;
};

const mayDeadEnd = ({ tags, geometry }) => {
  if (tags.highway === "track" || tags.area === "yes") return false;
  if (tags.highway !== "service") return true;
  if (NON_ROUTE_SERVICE.includes(tags.service)) return false;
  if (tags.service === "driveway") {
    return lineLengthMeters(geometry) >= MIN_DEAD_END_DRIVEWAY_METERS;
  }
  return true;
};

const point = ({ lon, lat }, properties = {}) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties,
});

const line = (geometry, properties = {}) => ({
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: geometry.map((pt) => [pt.lon, pt.lat]),
  },
  properties,
});

// the end of a road that no other road touches, with no turning circle/loop mapped
// there. Only ends inside `bounds` (what was fetched) count -- anything a road connects
// to at a point inside it was fetched too, but past the edge it might not have been.
const findDeadEnds = (roads, turnaroundIds, bounds) => {
  const nodeUses = new Map();
  for (const road of roads) {
    for (const id of road.nodes) nodeUses.set(id, (nodeUses.get(id) ?? 0) + 1);
  }
  const deadEnds = [];
  for (const road of roads) {
    const { nodes, geometry } = road;
    // a closed loop has no end
    if (nodes[0] === nodes.at(-1) || !mayDeadEnd(road)) continue;
    for (const [id, pt] of [
      [nodes[0], geometry[0]],
      [nodes.at(-1), geometry.at(-1)],
    ]) {
      if (
        nodeUses.get(id) === 1 &&
        !turnaroundIds.has(id) &&
        bounds.contains([pt.lon, pt.lat])
      ) {
        deadEnds.push(point(pt));
      }
    }
  }
  return deadEnds;
};

// OSM's maxweight defaults to metric tonnes when there's no unit; US bridges are more
// often tagged in short tons ("st") or pounds ("lbs"), which are kept as-is
// https://wiki.openstreetmap.org/wiki/Key:maxweight
const formatWeight = (maxweight) =>
  /^[\d.]+$/.test(maxweight.trim()) ? `${maxweight.trim()} t` : maxweight;

// one entry per part of the combined query, each only included at or above its minzoom
// (matching its layers'). Each group's query leaves its results in the default set to
// be output (as points, or with full line geometry), then picks its own elements back
// out of the combined response to fill one or more GeoJSON sources.
const OVERPASS_GROUPS = [
  {
    minzoom: HYDRANTS_LAYER.minzoom,
    // tanks/ponds/pools are often mapped as areas, so `out center` reduces those to
    // a point. Indoor pools are left out, since an engine can't draft from them.
    query: (bbox) => `(
      node["emergency"="fire_hydrant"]${bbox};
      nwr["emergency"~"^(water_tank|suction_point|fire_water_pond)$"]${bbox};
      nwr["leisure"="swimming_pool"]["indoor"!="yes"]${bbox};
    );`,
    output: "center",
    matches: ({ tags = {} }) =>
      [
        "fire_hydrant",
        "water_tank",
        "suction_point",
        "fire_water_pond",
      ].includes(tags.emergency) || tags.leisure === "swimming_pool",
    toSources: (elements) => ({
      water: elements.map((el) =>
        point(el.center || el, { ...el.tags, kind: waterKind(el.tags) }),
      ),
    }),
  },
  {
    // the road network, plus the barriers and turnarounds on it. Finding dead ends
    // takes every drivable road around, so this is the heaviest part of the query --
    // only asked for once zoomed in to street level.
    minzoom: ONEWAY_ARROWS_LAYER.minzoom,
    query: (bbox) => `
      way["highway"~"^(${DRIVABLE_HIGHWAYS})$"]${bbox}->.roads;
      (
        .roads;
        node(w.roads)["barrier"~"^(${VEHICLE_BARRIERS})$"];
        node(w.roads)["highway"~"^(${TURNAROUNDS})$"];
      );`,
    output: "geom",
    matches: ({ type, tags = {} }) =>
      type === "way"
        ? isDrivable.test(tags.highway)
        : isVehicleBarrier.test(tags.barrier) ||
          isTurnaround.test(tags.highway),
    toSources: (elements, bounds) => {
      const roads = elements.filter((el) => el.type === "way" && el.geometry);
      const nodes = elements.filter((el) => el.type === "node");
      const turnaroundIds = new Set(
        nodes.filter((n) => isTurnaround.test(n.tags.highway)).map((n) => n.id),
      );
      return {
        oneway: roads
          .filter((r) => /^(yes|-1|1)$/.test(r.tags.oneway))
          .map((r) =>
            line(r.geometry, { oneway: r.tags.oneway === "-1" ? -1 : 1 }),
          ),
        gates: nodes
          .filter((n) => isVehicleBarrier.test(n.tags.barrier))
          .map((n) => point(n, n.tags)),
        "dead-ends": findDeadEnds(roads, turnaroundIds, bounds),
        "weight-limits": roads
          .filter(
            (r) => r.tags.bridge && r.tags.bridge !== "no" && r.tags.maxweight,
          )
          .map((r) =>
            line(r.geometry, { label: formatWeight(r.tags.maxweight) }),
          ),
      };
    },
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
    const bounds = snapToGrid(
      new maplibregl.LngLatBounds(
        [view.getWest() - lngMargin, view.getSouth() - latMargin],
        [view.getEast() + lngMargin, view.getNorth() + latMargin],
      ),
      zoom,
    );
    const bbox = `(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()})`;
    const query =
      "[out:json][timeout:25];" +
      groups.map((g) => `${g.query(bbox)}out ${g.output};`).join("");

    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    liveDataSpinner.hidden = false;
    try {
      const { elements } = await fetchOverpass(query, controller.signal);
      for (const g of groups) {
        const sources = g.toSources(elements.filter(g.matches), bounds);
        for (const [sourceId, features] of Object.entries(sources)) {
          map
            .getSource(sourceId)
            .setData({ type: "FeatureCollection", features });
        }
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
