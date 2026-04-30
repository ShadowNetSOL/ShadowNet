/* global UVServiceWorker */
/**
 * ShadowNet service worker bootstrap.
 *
 * Imports Ultraviolet's bundle + config + service worker class and wires
 * them up. Every fetch within scope `/service/` is intercepted and routed
 * through the bare server, with HTML / JS / CSS rewritten so the proxied
 * page never makes a direct request to the real destination.
 */
importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts(self.__uv$config.sw || "/uv/uv.sw.js");

const sw = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      if (sw.route(event)) {
        return await sw.fetch(event);
      }
      return await fetch(event.request);
    })(),
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
