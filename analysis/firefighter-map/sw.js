// Workbox loaded from its CDN build so this stays a plain script -- no bundler/build step
// for a repo that's otherwise just static HTML files.
// https://developer.chrome.com/docs/workbox/modules/workbox-sw
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js",
);

// take over immediately on update rather than waiting for every open tab to close --
// this is a small tool, not worth making people re-open it to get a fix
self.skipWaiting();
workbox.core.clientsClaim();

const { registerRoute } = workbox.routing;
const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// only cache real successes -- avoids poisoning a cache with an opaque/error response
const cacheableResponse = new CacheableResponsePlugin({ statuses: [0, 200] });

// the page itself and its own scripts (main.js etc.): NetworkFirst so a fresh deploy is
// picked up whenever there's a connection, but the last-successfully-loaded version still
// works offline
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" ||
    (url.origin === self.location.origin && request.destination === "script"),
  new NetworkFirst({
    cacheName: "pages",
    plugins: [
      cacheableResponse,
      // room for the page plus each of its script files
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
);

// MapLibre/pmtiles scripts pinned to a major version -- effectively immutable, safe to
// cache aggressively
registerRoute(
  ({ url }) => url.origin === "https://cdn.jsdelivr.net",
  new CacheFirst({
    cacheName: "cdn-scripts",
    plugins: [
      cacheableResponse,
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

// vector/raster tiles (roads/water/buildings/hillshade/USFS burn probability + flame
// length) -- lots of small, URL-addressed requests; stale-while-revalidate means a
// previously-viewed area still renders instantly offline while quietly refreshing in the
// background when online
registerRoute(
  ({ url }) =>
    url.hostname === "tiles.openfreemap.org" ||
    url.hostname === "tiles.mapterhorn.com" ||
    url.hostname === "data.source.coop" ||
    url.hostname === "imagery.geoplatform.gov" ||
    url.hostname === "fonts.undpgeohub.org",
  new StaleWhileRevalidate({
    cacheName: "map-tiles",
    plugins: [
      cacheableResponse,
      new ExpirationPlugin({
        maxEntries: 3000,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  }),
);

// water sources/road access (Overpass, or its fallback mirror -- queried with GET so
// they can be cached here, see overpass.js) and place search (Nominatim) are live,
// safety-relevant data -- always prefer the network, and only fall back to a
// short-lived cache entry if there's genuinely no connection, so a stale hydrant or
// one-way status is never shown in preference to a fresh one
registerRoute(
  ({ url }) =>
    url.hostname === "overpass-api.de" ||
    url.hostname === "maps.mail.ru" ||
    url.hostname === "nominatim.openstreetmap.org",
  new NetworkFirst({
    cacheName: "live-data",
    networkTimeoutSeconds: 10,
    plugins: [
      cacheableResponse,
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
    ],
  }),
);
