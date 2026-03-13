// ═══════════════════════════════════════════════════
// SERVICE WORKER — Betrés ON · Pedidos Infarma 2026
// Garantiza funcionamiento offline completo
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'betres-infarma-v1';

// Archivos a cachear en la instalación
const PRECACHE_URLS = [
  './',
  './index.html',
  './betres_infarma_pedidos.html'
];

// ── INSTALL: cachea los archivos al primer acceso ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Si falla alguna URL concreta no bloquea la instalación
        return Promise.resolve();
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpia cachés antiguas ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según tipo de recurso ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Webhooks n8n → siempre red, nunca caché
  if (url.hostname.includes('n8n.cloud') || url.hostname.includes('n8n.io')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', queued: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Recursos de la app → Cache First (offline-first)
  // Si está en caché, devuelve caché; si no, va a red y cachea
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Solo cachear respuestas válidas de nuestro origen
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          event.request.method === 'GET'
        ) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, toCache);
          });
        }
        return response;
      }).catch(() => {
        // Sin red y sin caché: devuelve respuesta de fallback
        return new Response(
          '<h1 style="font-family:sans-serif;padding:40px;color:#7B3F1A">Betrés ON · Modo offline<br><small style="font-size:14px;color:#999">Abre la app desde el archivo guardado en tu dispositivo</small></h1>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      });
    })
  );
});

// ── BACKGROUND SYNC (si el navegador lo soporta) ──
// Reintenta operaciones pendientes al recuperar conexión
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pedidos') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_NOW' });
        });
      })
    );
  }
});
