import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  OVERPASS_GROUPS,
  boundsContains,
  buildQuery,
  fetchOverpass,
  findDeadEnds,
  formatWeight,
  lineLengthMeters,
  padBounds,
  snapToGrid,
  toSources,
} from "../../analysis/firefighter-map/overpass.js";

const [WATER_GROUP, ROADS_GROUP] = OVERPASS_GROUPS;

describe("fetchOverpass", () => {
  const urls = [
    "https://a.example/api",
    "https://b.example/api",
    "https://c.example/api",
  ];
  const ok = (body = { elements: [] }) => new Response(JSON.stringify(body));
  let cooldowns;
  let fetchMock;

  beforeEach(() => {
    cooldowns = new Map();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const run = (opts = {}) =>
    fetchOverpass(
      "[out:json];\n  node(1);\n  out;",
      new AbortController().signal,
      {
        urls,
        cooldowns,
        ...opts,
      },
    );
  const hostsTried = () =>
    fetchMock.mock.calls.map(([url]) => new URL(url).hostname);

  // GET (not POST) so the service worker can cache it
  test("sends the query as a GET with collapsed whitespace", async () => {
    fetchMock.mockResolvedValue(ok());
    await run();
    const [url, options] = fetchMock.mock.calls[0];
    expect(options.method ?? "GET").toBe("GET");
    expect(new URL(url).searchParams.get("data")).toBe(
      "[out:json]; node(1); out;",
    );
  });

  test("returns the first server's response when it works", async () => {
    fetchMock.mockResolvedValue(ok({ elements: [{ id: 1 }] }));
    expect(await run()).toEqual({ elements: [{ id: 1 }] });
    expect(hostsTried()).toEqual(["a.example"]);
  });

  test("falls back to the next server on a network error, and cools the failed one down", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(ok());
    await run();
    expect(hostsTried()).toEqual(["a.example", "b.example"]);
    expect(cooldowns.get(urls[0])).toBeGreaterThan(Date.now());

    // the next request skips it
    fetchMock.mockResolvedValue(ok());
    await run();
    expect(hostsTried().at(-1)).toBe("b.example");
  });

  test("falls back on an error status, honoring Retry-After", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("busy", {
          status: 429,
          headers: { "Retry-After": "120" },
        }),
      )
      .mockResolvedValueOnce(ok());
    const before = Date.now();
    await run();
    expect(hostsTried()).toEqual(["a.example", "b.example"]);
    expect(cooldowns.get(urls[0])).toBeGreaterThanOrEqual(before + 120_000);
  });

  // e.g. an HTML error page with a 200 status
  test("falls back on a response that isn't JSON", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("<?xml version"))
      .mockResolvedValueOnce(ok());
    await run();
    expect(hostsTried()).toEqual(["a.example", "b.example"]);
  });

  test("gives up on a server that hangs, and moves on", async () => {
    fetchMock
      .mockImplementationOnce(
        (_url, { signal }) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason)),
          ),
      )
      .mockResolvedValueOnce(ok());
    await run({ timeoutMs: 20 });
    expect(hostsTried()).toEqual(["a.example", "b.example"]);
    expect(cooldowns.has(urls[0])).toBe(true);
  });

  test("throws once every server has failed", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(run()).rejects.toThrow("No Overpass server available");
    expect(hostsTried()).toEqual(["a.example", "b.example", "c.example"]);
  });

  test("doesn't ask any server that's still cooling down", async () => {
    for (const url of urls) cooldowns.set(url, Date.now() + 60_000);
    await expect(run()).rejects.toThrow("No Overpass server available");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // a newer request cancelled this one -- not the server's fault
  test("rethrows when the caller aborts, without cooling the server down", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason)),
        ),
    );
    const request = fetchOverpass("q", controller.signal, { urls, cooldowns });
    controller.abort();
    await expect(request).rejects.toThrow();
    expect(hostsTried()).toEqual(["a.example"]);
    expect(cooldowns.size).toBe(0);
  });
});

describe("bounds", () => {
  const view = { west: -105.38, south: 40.05, east: -105.37, north: 40.055 };

  test("padBounds adds the margin on each side", () => {
    const padded = padBounds(view, 0.5);
    expect(padded.west).toBeCloseTo(-105.385);
    expect(padded.east).toBeCloseTo(-105.365);
    expect(padded.south).toBeCloseTo(40.0475);
    expect(padded.north).toBeCloseTo(40.0575);
  });

  test("snapToGrid only ever grows the bounds", () => {
    expect(boundsContains(snapToGrid(view, 16), view)).toBe(true);
  });

  // this is what lets the service worker find a cached response again
  test("snapToGrid gives nearby views the same bounds", () => {
    const nudged = {
      west: view.west + 0.0001,
      south: view.south + 0.0001,
      east: view.east + 0.0001,
      north: view.north + 0.0001,
    };
    expect(snapToGrid(nudged, 16.4)).toEqual(snapToGrid(view, 16));
  });

  test("boundsContains", () => {
    expect(boundsContains(view, view)).toBe(true);
    expect(boundsContains(view, { ...view, east: view.east + 1 })).toBe(false);
  });
});

describe("buildQuery", () => {
  const bounds = { west: -105.4, south: 40, east: -105.3, north: 40.1 };

  test("combines each group's query and output, over the bounds as (south,west,north,east)", () => {
    const query = buildQuery(OVERPASS_GROUPS, bounds);
    expect(query.startsWith("[out:json][timeout:25];")).toBe(true);
    expect(query).toContain(
      'node["emergency"="fire_hydrant"](40,-105.4,40.1,-105.3);',
    );
    expect(query).toContain("out center;");
    expect(query).toContain("out geom;");
    expect(query.indexOf("out center;")).toBeLessThan(query.indexOf("way["));
  });

  test("leaves out groups that weren't asked for", () => {
    expect(buildQuery([WATER_GROUP], bounds)).not.toContain("way[");
  });
});

// a tiny road network, as Overpass returns it with `out geom`: node IDs plus coordinates
const node = (id, lon, lat, tags = {}) => ({
  type: "node",
  id,
  lon,
  lat,
  tags,
});
const way = (id, nodes, tags) => ({
  type: "way",
  id,
  nodes: nodes.map((n) => n.id),
  geometry: nodes.map(({ lat, lon }) => ({ lat, lon })),
  tags,
});
const BOUNDS = { west: -1, south: -1, east: 1, north: 1 };
// about 111 m per 0.001 degree at the equator
const a = node(1, 0, 0);
const b = node(2, 0.001, 0);
const c = node(3, 0.002, 0);
const d = node(4, 0.001, 0.001);

describe("findDeadEnds", () => {
  const deadEndCoords = (roads, turnarounds = new Set(), bounds = BOUNDS) =>
    findDeadEnds(roads, turnarounds, bounds).map((f) => f.geometry.coordinates);

  test("flags the free end of a road, not where it joins another", () => {
    // a-b-c is a through road; b-d branches off it and stops at d
    const roads = [
      way(10, [a, b, c], { highway: "residential" }),
      way(11, [b, d], { highway: "residential" }),
    ];
    expect(deadEndCoords(roads)).toEqual(
      expect.arrayContaining([
        [d.lon, d.lat],
        [a.lon, a.lat],
        [c.lon, c.lat],
      ]),
    );
    expect(deadEndCoords(roads)).not.toContainEqual([b.lon, b.lat]);
  });

  test("skips an end with a turning circle mapped", () => {
    const roads = [way(10, [a, b, c], { highway: "residential" })];
    expect(deadEndCoords(roads, new Set([c.id]))).toEqual([[a.lon, a.lat]]);
  });

  test("skips a closed loop", () => {
    expect(
      deadEndCoords([way(10, [a, b, d, a], { highway: "residential" })]),
    ).toEqual([]);
  });

  test("skips ends outside what was fetched", () => {
    const bounds = { west: 0.0005, south: -1, east: 1, north: 1 };
    expect(
      deadEndCoords(
        [way(10, [a, b, c], { highway: "residential" })],
        new Set(),
        bounds,
      ),
    ).toEqual([[c.lon, c.lat]]);
  });

  test("skips tracks, parking aisles, and short driveways", () => {
    expect(deadEndCoords([way(10, [a, b], { highway: "track" })])).toEqual([]);
    expect(
      deadEndCoords([
        way(10, [a, b], { highway: "service", service: "parking_aisle" }),
      ]),
    ).toEqual([]);
    // ~111 m
    expect(
      deadEndCoords([
        way(10, [a, b], { highway: "service", service: "driveway" }),
      ]),
    ).toHaveLength(0);
  });

  test("flags a long driveway", () => {
    // ~222 m
    expect(
      deadEndCoords([
        way(10, [a, b, c], { highway: "service", service: "driveway" }),
      ]),
    ).toHaveLength(2);
  });
});

test("lineLengthMeters", () => {
  expect(lineLengthMeters([a, b])).toBeCloseTo(111.2, 0);
  expect(lineLengthMeters([a, b, c])).toBeCloseTo(222.4, 0);
});

test.each([
  ["10", "10 t"],
  [" 5.5 ", "5.5 t"],
  ["10 st", "10 st"],
  ["20000 lbs", "20000 lbs"],
])("formatWeight(%j) is %j", (input, expected) => {
  expect(formatWeight(input)).toBe(expected);
});

describe("toSources", () => {
  test("sorts water sources by kind, using an area's center", () => {
    const elements = [
      node(1, 0, 0, { emergency: "fire_hydrant" }),
      node(2, 0, 0, { emergency: "water_tank" }),
      {
        type: "way",
        id: 3,
        center: { lon: 0.5, lat: 0.5 },
        tags: { leisure: "swimming_pool" },
      },
    ];
    const { water } = toSources([WATER_GROUP], elements, BOUNDS);
    expect(water.map((f) => f.properties.kind)).toEqual([
      "hydrant",
      "water_source",
      "pool",
    ]);
    expect(water[2].geometry.coordinates).toEqual([0.5, 0.5]);
  });

  test("pulls oneway streets, gates, and bridge weight limits out of the road network", () => {
    const elements = [
      way(10, [a, b], { highway: "residential", oneway: "yes" }),
      way(11, [b, c], { highway: "residential", oneway: "-1" }),
      way(12, [b, d], {
        highway: "residential",
        bridge: "yes",
        maxweight: "10",
      }),
      node(2, b.lon, b.lat, { barrier: "gate" }),
      // not a vehicle barrier
      node(5, 0, 0, { barrier: "kissing_gate" }),
    ];
    const sources = toSources([ROADS_GROUP], elements, BOUNDS);
    expect(sources.oneway.map((f) => f.properties.oneway)).toEqual([1, -1]);
    expect(sources.gates).toHaveLength(1);
    expect(sources["weight-limits"].map((f) => f.properties.label)).toEqual([
      "10 t",
    ]);
  });

  // e.g. a pool that's also inside the fetched area of the roads query
  test("each group only sees its own elements", () => {
    const elements = [
      node(1, 0, 0, { emergency: "fire_hydrant" }),
      way(10, [a, b], { highway: "residential" }),
    ];
    const sources = toSources(OVERPASS_GROUPS, elements, BOUNDS);
    expect(sources.water).toHaveLength(1);
    expect(sources.oneway).toHaveLength(0);
    expect(sources["dead-ends"]).toHaveLength(2);
  });
});
