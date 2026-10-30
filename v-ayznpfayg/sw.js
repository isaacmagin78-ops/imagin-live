/* Our Journey: keeps everything on this phone so it opens without internet. */
var VERSION = 'sa-voyage-v3';
var CORE = [
  './', 'v.bin', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/cg-400.woff2', 'fonts/cg-500.woff2', 'fonts/cg-600.woff2', 'fonts/cg-400i.woff2', 'fonts/cg-500i.woff2',
  'fonts/lora-400.woff2', 'fonts/lora-500.woff2', 'fonts/lora-400i.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(CORE.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('sa-voyage-') === 0 && k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function refresh(cache, key, req) {
  return fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res && res.ok) return cache.put(key, res.clone()).then(function () { return res; });
    return res;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var nav = req.mode === 'navigate';
  if (/\/m-[a-f0-9]{20}\.bin$/.test(url.pathname)) {
    // Separate persistent cache: video bytes remain encrypted at rest.
    e.respondWith(caches.open('sa-private-media-v1').then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req);
      });
    }));
    return;
  }
  var key = nav ? './' : req;
  var live = nav || /\/v\.bin$/.test(url.pathname);
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        if (live) e.waitUntil(refresh(c, key, nav ? './' : req).catch(function () {}));
        return hit;
      }
      return refresh(c, key, nav ? './' : req).catch(function () {
        return nav ? c.match('./') : Response.error();
      });
    });
  }));
});
