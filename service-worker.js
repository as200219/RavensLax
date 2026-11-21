// Ravens Goal Soundboard - Service Worker v4.7
// Caches the app page so it opens with no signal.
// Songs are stored separately in IndexedDB by index.html ("Download All Songs").

const CACHE_NAME = 'ravens-shell-v2';

// Relative paths so this works at a sub-folder URL like /RavensLax/
const APP_SHELL = [
    './',
    './index.html'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Delete caches from older versions (including the old ravens-audio-v1 audio cache)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

// Network-first for the app page: fresh when online, cached copy when offline.
// Everything else (GitHub API, audio) passes straight through.
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html');
    if (!isSameOrigin || !isPage) return;

    event.respondWith(
        fetch(req)
            .then(response => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
                }
                return response;
            })
            .catch(() =>
                caches.match(req, { ignoreSearch: true })
                    .then(cached => cached || caches.match('./index.html'))
            )
    );
});
