/**
 * @file sw.js
 * @description QBank Service Worker — Cache-First for static assets,
 * Network-First for HTML navigation so updates are always picked up.
 */

const CACHE_NAME = 'qbank-shell-v16.4';   // bumped → purges stale caches

const APP_SHELL = [
    './',
    './index.html',
    './duplicates.html',
    './app.js',
    './assets/style.css',
    './assets/style_print_fix.css',
    './lib/arabic-reshaper.js',
    './src/lib/qrcode.min.js',
    './src/core/db.js',
    './src/core/i18n.js',
    './src/core/migrations.js',
    './src/core/query.js',
    './src/core/state.js',
    './src/modules/ai.js',
    './src/modules/export.js',
    './src/modules/notebooks.js',
    './src/modules/questions.js',
    './src/modules/quiz.js',
    './src/ui/audio.js',
    './src/ui/components.js',
    './src/ui/theme.js',
    './src/utils/helpers.js',
    './locales/ar.js',
    './locales/en.js',
];

// ── Install: pre-cache the app shell ──────────────────────────
globalThis.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching app shell v4...');
            return cache.addAll(APP_SHELL);
        }).then(() => globalThis.skipWaiting())
    );
});

// ── Activate: purge old caches ────────────────────────────────
globalThis.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            )
        ).then(() => globalThis.clients.claim())
    );
});

// ── Fetch: smart strategy per request type ────────────────────
globalThis.addEventListener('fetch', (event) => {
    const requestUrl = event.request.url;
    
    // استثناء روابط جوجل درايف والـ CDNs الخارجية تماماً من الكاش لمنع حظر CORS والـ Integrity
    if (requestUrl.includes('drive.google.com') || 
        requestUrl.includes('cdnjs.cloudflare.com') || 
        requestUrl.includes('cdn.tailwindcss.com') || 
        requestUrl.includes('jsdelivr.net') ||
        requestUrl.includes('unpkg.com')) {
        return; // اترك المتصفح يجلبها مباشرة من الإنترنت النظيف
    }

    const url = new URL(event.request.url);

    // Skip non-GET and cross-origin tracking requests entirely
    if (event.request.method !== 'GET') return;
    if (url.hostname.includes('script.google.com')) return;

    // Network-first for Google Fonts (fallback to cache offline)
    if (url.hostname.includes('googleapis.com') && url.pathname.includes('/css')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Network-first for HTML navigation — always serve the latest index.html
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Network-first for versioned JS/CSS (?v=x.x) so bumped versions always load fresh
    if (url.search && url.origin === globalThis.location.origin) {
        event.respondWith(
            fetch(event.request).catch((err) => {
                console.warn('[SW] Versioned fetch failed, serving from cache:', err);
                return caches.match(event.request);
            })
        );
        return;
    }

    // Cache-First for same-origin static assets (fonts, images, unversioned JS)
    if (url.origin === globalThis.location.origin) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response && response.status === 200 && response.type !== 'error') {
                        const toCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Network-first for all other external resources (CDN libs, QR API, etc.)
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
