/**
 * GiroWeg service worker. Keeps the app shell available offline: the local
 * store (localStorage) already holds the data, this makes the code load too.
 *
 * - Precaches the offline page and the icons on install.
 * - Hashed build assets (/_next/static/*) are cache-first: immutable.
 * - Page navigations are network-first; the last good copy of each page is
 *   kept, and /offline is the fallback for pages never visited.
 * - API calls, auth and RSC payloads are never cached.
 *
 * Bump VERSION whenever the caching strategy changes; old caches are purged
 * on activate. Registered only in production by src/pwa/PwaBoot.tsx.
 */
const VERSION = "v1";
const SHELL_CACHE = `giroweg-shell-${VERSION}`;
const ASSET_CACHE = `giroweg-assets-${VERSION}`;
const PAGE_CACHE = `giroweg-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isNavigation = (request) => request.mode === "navigate";
const isBuildAsset = (url) => url.pathname.startsWith("/_next/static/");
const isShellAsset = (url) => PRECACHE.includes(url.pathname);
const isNeverCached = (request, url) =>
  url.pathname.startsWith("/api/") || request.headers.has("RSC") || url.searchParams.has("_rsc");

const cacheFirst = async (cacheName, request) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
};

const networkFirstPage = async (request) => {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    // Only keep real pages: redirects (e.g. to /login) and errors are not useful offline.
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCached(request, url)) return;

  if (isNavigation(request)) {
    event.respondWith(networkFirstPage(request));
  } else if (isBuildAsset(url)) {
    event.respondWith(cacheFirst(ASSET_CACHE, request));
  } else if (isShellAsset(url)) {
    event.respondWith(cacheFirst(SHELL_CACHE, request));
  }
});
