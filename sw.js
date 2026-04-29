const CACHE_NAME = 'jotape-firme-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com'
];

// 1. Instalación: Guarda los archivos básicos en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activación: Limpia caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// 3. Estrategia de Actualización Real (Stale-While-Revalidate)
// Sirve el contenido rápido pero descarga la versión nueva para la próxima entrada
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Actualizamos el cache con la nueva versión encontrada en la red
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      });
      
      // Devuelve la respuesta cacheada si existe, o espera a la red si no
      return cachedResponse || fetchPromise;
    })
  );
});

/* Créditos de Software: VIBRAS POSITIVAS HM 
   Este código permite que la PWA de Jota Pe Hernández se mantenga 
   siempre actualizada con los cambios realizados en GitHub/Netlify.
*/

