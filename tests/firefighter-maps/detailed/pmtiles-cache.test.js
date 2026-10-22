import { describe, expect, test, vi } from "vitest";
import { CachedSource } from "../../../site/firefighter-maps/detailed/scripts/pmtiles-cache.js";

// the parts of the Cache API CachedSource uses
const fakeCache = () => {
  const entries = new Map();
  return {
    entries,
    match: async (key) => entries.get(key)?.clone(),
    put: async (key, response) => void entries.set(key, response),
    keys: async () => [...entries.keys()],
    delete: async (key) => entries.delete(key),
  };
};

// a pmtiles source, like pmtiles.FetchSource, that answers with `bytes` or fails
const innerSource = (bytes) => ({
  getKey: () => "https://example.org/tiles.pmtiles",
  getBytes: vi.fn(async () => {
    if (!bytes) throw new TypeError("Failed to fetch");
    return { data: new Uint8Array(bytes).buffer, etag: '"v1"' };
  }),
});

const read = async (source) => {
  const { data, etag } = await source.getBytes(10, 3);
  return { bytes: [...new Uint8Array(data)], etag };
};

describe("CachedSource", () => {
  test("uses the inner source's key, so pmtiles:// URLs still find it", () => {
    const source = new CachedSource(innerSource([1]), { cache: fakeCache() });
    expect(source.getKey()).toBe("https://example.org/tiles.pmtiles");
  });

  test("reads from the network, saving what it gets", async () => {
    const cache = fakeCache();
    const source = new CachedSource(innerSource([1, 2, 3]), { cache });
    expect(await read(source)).toEqual({ bytes: [1, 2, 3], etag: '"v1"' });
    // saved in the background, so the tiles don't wait on it
    await vi.waitFor(() =>
      expect([...cache.entries.keys()]).toEqual([
        "https://example.org/tiles.pmtiles?bytes=10-12",
      ]),
    );
  });

  test("falls back to what it saved when the network fails", async () => {
    const cache = fakeCache();
    await read(new CachedSource(innerSource([1, 2, 3]), { cache }));
    await vi.waitFor(() => expect(cache.entries.size).toBe(1));
    const offline = new CachedSource(innerSource(null), { cache });
    expect(await read(offline)).toEqual({ bytes: [1, 2, 3], etag: '"v1"' });
  });

  test("rethrows when there's nothing saved either", async () => {
    const source = new CachedSource(innerSource(null), { cache: fakeCache() });
    await expect(source.getBytes(10, 3)).rejects.toThrow("Failed to fetch");
  });

  // e.g. in a private window, where the Cache API can be missing or throw
  test("works without a cache", async () => {
    const source = new CachedSource(innerSource([1, 2, 3]), { cache: null });
    expect(await read(source)).toEqual({ bytes: [1, 2, 3], etag: '"v1"' });
    const broken = { put: () => Promise.reject(new Error("quota")) };
    const withBroken = new CachedSource(innerSource([1, 2, 3]), {
      cache: broken,
    });
    expect(await read(withBroken)).toEqual({ bytes: [1, 2, 3], etag: '"v1"' });
  });

  test("keeps only the newest maxEntries", async () => {
    const cache = fakeCache();
    const source = new CachedSource(innerSource([1]), {
      cache,
      maxEntries: 2,
      pruneEvery: 1,
    });
    for (const offset of [0, 10, 20]) {
      await source.getBytes(offset, 1);
      await vi.waitFor(() => expect(source.saves).toBe(offset / 10 + 1));
    }
    await vi.waitFor(() =>
      expect([...cache.entries.keys()]).toEqual([
        "https://example.org/tiles.pmtiles?bytes=10-10",
        "https://example.org/tiles.pmtiles?bytes=20-20",
      ]),
    );
  });
});
