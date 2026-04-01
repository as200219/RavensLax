// Ravens Goal Soundboard - Service Worker v4.5
// Provides offline audio playback capability

const CACHE_VERSION = 'ravens-audio-v1';
const CACHE_NAME = `${CACHE_VERSION}`;

// Files to cache immediately on install
const STATIC_CACHE = [
    '/',
    '/index.html'
];

// Audio file extensions to cache
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|ogg|aac|flac)$/i;

// Install event - cache static files
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing v4.5...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Caching static files');
            return cache.addAll(STATIC_CACHE);
        }).then(() => {
            console.log('[Service Worker] Installation complete');
            return self.skipWaiting(); // Activate immediately
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating v4.5...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activation complete');
            return self.clients.claim(); // Take control immediately
        })
    );
});

// Fetch event - cache-first for audio, network-first for everything else
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Cache-first strategy for audio files
    if (AUDIO_EXTENSIONS.test(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('[Service Worker] Serving audio from cache:', url.pathname);
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network and cache it
                console.log('[Service Worker] Fetching and caching audio:', url.pathname);
                return fetch(event.request).then(response => {
                    // Only cache successful responses
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                }).catch(error => {
                    console.error('[Service Worker] Audio fetch failed:', error);
                    throw error;
                });
            })
        );
    }
    // Network-first strategy for settings and HTML (always get fresh data when online)
    else if (url.pathname.includes('soundboard-settings.json') || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request).then(response => {
                // Cache the fresh response
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(error => {
                // Network failed, try cache
                console.log('[Service Worker] Network failed, trying cache for:', url.pathname);
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('[Service Worker] Serving from cache (offline):', url.pathname);
                        return cachedResponse;
                    }
                    throw error;
                });
            })
        );
    }
    // Default: network-first for everything else
    else {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
    }
});

// Message handler for cache management
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_AUDIO_FILES') {
        const audioUrls = event.data.urls;
        console.log('[Service Worker] Caching audio files:', audioUrls.length);
        
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                return Promise.all(
                    audioUrls.map(url => {
                        return fetch(url).then(response => {
                            if (response && response.status === 200) {
                                return cache.put(url, response);
                            }
                        }).catch(error => {
                            console.error('[Service Worker] Failed to cache:', url, error);
                        });
                    })
                );
            }).then(() => {
                console.log('[Service Worker] All audio files cached');
                // Notify the client
                event.ports[0].postMessage({ success: true });
            })
        );
    }
    else if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('[Service Worker] Clearing cache');
        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => {
                console.log('[Service Worker] Cache cleared');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
    else if (event.data && event.data.type === 'GET_CACHE_STATUS') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                return cache.keys();
            }).then(keys => {
                const audioFiles = keys.filter(request => 
                    AUDIO_EXTENSIONS.test(new URL(request.url).pathname)
                );
                event.ports[0].postMessage({ 
                    success: true,
                    cachedCount: audioFiles.length,
                    cachedFiles: audioFiles.map(r => new URL(r.url).pathname)
                });
            })
        );
    }
});

console.log('[Service Worker] Script loaded');
