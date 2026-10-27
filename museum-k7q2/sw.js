/* Offline support: everything the page saved is served from this iPad first. */
var VERSION = 'wc-plane-v2';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('wc-plane-') === 0 && k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(function (c) {
      var key = req.mode === 'navigate' ? 'index.html' : req;
      return c.match(key, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok && res.status === 200) { c.put(req, res.clone()); }
          return res;
        }).catch(function () {
          return c.match('index.html');
        });
      });
    })
  );
});
