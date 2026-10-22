// A PMTiles source that keeps every byte range it reads in the Cache API, so an area viewed before still draws offline. The service worker (../sw.js) can't do this for PMTiles: they're read with range requests, answered with 206 Partial Content, which the Cache API won't store -- so here each range is saved as a whole response of its own, under the file's URL plus the range.
// https://github.com/protomaps/PMTiles/blob/main/js/README.md

// the same limits the service worker's map tiles have
const CACHE_NAME = "pmtiles";
const MAX_ENTRIES = 3000;
// how many saves between trimming the cache down to MAX_ENTRIES, since listing every entry each time would be slow
const PRUNE_EVERY = 100;

// the Cache API's cache for the ranges, or null where it's unavailable, e.g. some private windows
export const openCache = async () => {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
};

export class CachedSource {
  // `inner` is the pmtiles source that does the reading, e.g. a pmtiles.FetchSource. `cache` is a Cache, or a promise of one (or null, for none).
  constructor(
    inner,
    {
      cache = openCache(),
      maxEntries = MAX_ENTRIES,
      pruneEvery = PRUNE_EVERY,
    } = {},
  ) {
    this.inner = inner;
    this.cache = Promise.resolve(cache);
    this.maxEntries = maxEntries;
    this.pruneEvery = pruneEvery;
    this.saves = 0;
  }

  // the same as the inner source's, so a style's pmtiles:// URL still finds it
  getKey() {
    return this.inner.getKey();
  }

  // the network first, so an online view always gets the current file (a new one is published daily), and what was saved only when that fails. A saved range keeps the ETag it came with, so pmtiles notices if it's from an older version of the file than the rest.
  async getBytes(offset, length, signal, etag) {
    const key = `${this.getKey()}?bytes=${offset}-${offset + length - 1}`;
    try {
      const response = await this.inner.getBytes(offset, length, signal, etag);
      this.save(key, response);
      return response;
    } catch (error) {
      if (signal?.aborted) throw error;
      const saved = await this.load(key);
      if (saved) return saved;
      throw error;
    }
  }

  async save(key, { data, etag }) {
    try {
      const cache = await this.cache;
      if (!cache) return;
      const headers = etag ? { ETag: etag } : {};
      await cache.put(key, new Response(data, { headers }));
      if (++this.saves % this.pruneEvery === 0) await this.prune(cache);
    } catch (error) {
      console.warn("Couldn't save map tiles for offline use:", error);
    }
  }

  async load(key) {
    try {
      const response = await (await this.cache)?.match(key);
      if (!response) return null;
      return {
        data: await response.arrayBuffer(),
        etag: response.headers.get("ETag") ?? undefined,
      };
    } catch {
      return null;
    }
  }

  // drops the oldest beyond maxEntries -- keys() lists them in the order they were added
  async prune(cache) {
    const keys = await cache.keys();
    await Promise.all(
      keys.slice(0, -this.maxEntries).map((key) => cache.delete(key)),
    );
  }
}
