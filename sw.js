/* ════════════════════════════════════════════════════════════════
   Service Worker — Atelier privé (PWA installable, usage en ligne)
   ────────────────────────────────────────────────────────────────
   Volontairement minimal : l'app a besoin du réseau (Firebase +
   Cloudinary), donc PAS de mise en cache agressive qui servirait des
   versions périmées. Ce SW sert juste à rendre l'app installable et
   à afficher un repli simple si la page est demandée hors-ligne.
   ════════════════════════════════════════════════════════════════ */

const VERSION = "atelier-v1";

// Installation : on s'active tout de suite
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

// Activation : on prend le contrôle et on nettoie les anciens caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Stratégie : réseau d'abord (toujours la version fraîche).
// On ne met en cache que la coquille de la page privé, en secours.
self.addEventListener("fetch", (e) => {
  const req = e.request;

  // On ne touche qu'aux requêtes GET de même origine (la page elle-même).
  // Firebase, Cloudinary, fonts, Worker… passent directement au réseau.
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (req.method !== "GET" || !sameOrigin) return;

  // Pour la navigation (ouvrir prive.html) : réseau d'abord, cache en secours.
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(VERSION);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(
            "<h1>Hors-ligne</h1><p>L'atelier a besoin d'une connexion. Réessaie une fois en ligne.</p>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
          );
        }
      })()
    );
  }
});
