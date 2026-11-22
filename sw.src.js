/* Spectre Qualifier service worker: caches the app for full offline use. Relative URLs (works from any sub-path).
   build.sh writes sw.js from this file with a cache name taken from the files' hash. */
var CACHE = "spectre-qualifier-__HASH__";
var FILES = ["./", "./index.html", "./app.js", "./engine.js", "./reg-core.js", "./firebase-config.js", "./qrcode.js",
  "./qualifiers/fam-tpc.js", "./qualifiers/fbi-pistol.todo.js", "./qualifiers/fbi-shotgun.todo.js",
  "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png",
  "./indemnity-pdf.js", "./indemnity-form.pdf"];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES.map(function(f){ return new Request(f, { cache: "reload" }); })); }));
  /* no automatic skipWaiting: a phone keeps the running version until "Reload" is tapped (keeps a score entry safe) */
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k.indexOf("spectre-qualifier-") === 0 && k !== CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("message", function(e){ if(e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if(url.origin === "https://www.gstatic.com" && url.pathname.indexOf("/firebasejs/") === 0){
    e.respondWith(caches.open("spectre-qualifier-firebase-sdk").then(function(c){ return c.match(e.request).then(function(hit){ return hit || fetch(e.request).then(function(r){ if(r.ok) c.put(e.request, r.clone()); return r; }); }); }));
    return;
  }
  if(url.origin !== location.origin) return;
  /* register.html is an online page (live squad counts): network first, never cached */
  if(/\/register\.html$/.test(url.pathname)) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function(hit){
    return hit || fetch(e.request).catch(function(){ if(e.request.mode === "navigate") return caches.match("./index.html"); return new Response("", { status: 504 }); });
  }));
});
