// ============================================================
// MicioExpress — Service Worker (PWA)
// Versione cache: v2
// Strategia: Cache First (risorse statiche) + Network First (API)
// ============================================================

const CACHE_NAME = 'micioexpress-v2';

// Risorse essenziali da pre-cachare durante l'installazione
const PRECACHE_ASSETS = [
  './',
  'index.html',
  // Leaflet — mappa interattiva
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  // Font Awesome — icone
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// ============================================================
// INSTALL — Pre-cache delle risorse essenziali
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installazione in corso…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching risorse essenziali');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        // Forza l'attivazione immediata senza attendere la chiusura dei tab
        return self.skipWaiting();
      })
  );
});

// ============================================================
// ACTIVATE — Pulizia delle cache vecchie
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Attivazione in corso…');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log(`[SW] Eliminazione cache obsoleta: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Prende il controllo di tutti i client immediatamente
        return self.clients.claim();
      })
  );
});

// ============================================================
// UTILITÀ — Verifica se una richiesta è una chiamata API
// ============================================================
function isApiRequest(url) {
  return url.includes('script.google.com') || url.includes('macros/s/');
}

// ============================================================
// UTILITÀ — Verifica se una richiesta è una risorsa statica cachabile
// ============================================================
function isStaticAsset(url) {
  return (
    url.endsWith('.css') ||
    url.endsWith('.js') ||
    url.endsWith('.png') ||
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.svg') ||
    url.endsWith('.ico') ||
    url.endsWith('.woff') ||
    url.endsWith('.woff2') ||
    url.endsWith('.ttf') ||
    url.includes('font-awesome') ||
    url.includes('leaflet') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('unpkg.com')
  );
}

// ============================================================
// FETCH — Gestione delle richieste con strategia appropriata
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Ignora le richieste non-GET (POST, PUT, DELETE…)
  if (request.method !== 'GET') return;

  // --------------------------------------------------------
  // STRATEGIA: Network First — per le chiamate API
  // Tenta la rete; se fallisce, usa la cache come fallback
  // --------------------------------------------------------
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Salva una copia della risposta API in cache per uso offline
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          console.log(`[SW] Rete non disponibile, uso cache per: ${url}`);
          return caches.match(request);
        })
    );
    return;
  }

  // --------------------------------------------------------
  // STRATEGIA: Cache First — per risorse statiche
  // Cerca prima in cache; se non presente, scarica dalla rete
  // --------------------------------------------------------
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Risorsa non in cache: scarica e salva per il futuro
          return fetch(request).then((networkResponse) => {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
            return networkResponse;
          });
        })
    );
    return;
  }

  // --------------------------------------------------------
  // DEFAULT: Network First — per pagine HTML e altro
  // Tenta la rete; se fallisce, usa la cache
  // --------------------------------------------------------
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          // Se nemmeno la cache ha la risorsa, mostra la pagina principale
          return cachedResponse || caches.match('./');
        });
      })
  );
});
