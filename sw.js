/* سرویس‌ورکر: اجرای کاملاً آفلاین پس از اولین بارگذاری */
const CACHE = 'shadow-operation-v1.3.0';
const FILES = [
  './', 'index.html', 'manifest.json',
  'css/style.css', 'css/menu.css', 'css/game.css', 'css/mobile.css',
  'js/storage.js', 'js/gltf.js', 'js/forest.js', 'js/tropic.js', 'assets/models/tropic.glb', 'assets/models/tropic-map.json', 'js/enemy-model.js', 'js/arms-model.js', 'assets/models/heavy.glb', 'assets/models/forest.glb', 'js/audio.js', 'js/game-engine.js', 'js/world.js', 'js/weapons.js', 'js/missions.js',
  'js/effects.js', 'js/enemies.js', 'js/player.js', 'js/controls.js', 'js/ui.js', 'js/main.js',
  'assets/images/icon.svg', 'assets/images/icon-512.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return res;
  }).catch(() => caches.match('index.html'))));
});
