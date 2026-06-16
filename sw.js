// ObstetriCare Service Worker v1.0
const CACHE_NAME = 'obstetricare-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// INSTALL — precachear assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE — limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH — cache first, luego red
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// PUSH NOTIFICATIONS
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Nueva consulta obstétrica recibida',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'ver', title: 'Ver ahora' },
      { action: 'cerrar', title: 'Cerrar' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'ObstetriCare', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'ver') {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

// BACKGROUND SYNC (para envíos offline)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-consultas') {
    event.waitUntil(syncConsultas());
  }
});

async function syncConsultas() {
  // Cuando vuelve la conexión, reintenta envíos pendientes
  const cache = await caches.open('pending-requests');
  const requests = await cache.keys();
  return Promise.all(requests.map(async req => {
    try {
      const response = await fetch(req);
      if (response.ok) await cache.delete(req);
    } catch (e) {
      console.log('Sync pendiente:', req.url);
    }
  }));
}
