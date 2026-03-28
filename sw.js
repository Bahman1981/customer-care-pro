// ══════════════════════════════════════════════════
//  Customer Care System — Service Worker (PWA)
//  يدعم العمل Offline + تحديث تلقائي
// ══════════════════════════════════════════════════

const CACHE_NAME = 'cc-system-v1';
const OFFLINE_PAGE = './offline.html';

// الملفات الجوهرية التي تُحفظ دائماً
const CORE_ASSETS = [
  './index.html',
  './style.css',
  './app_final.js',
  './supabase.js',
  './offline.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// ── Install: حفظ الملفات في الكاش ──
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching core assets');
      // نحفظ الملفات المحلية أولاً، والمكتبات الخارجية بشكل اختياري
      return cache.addAll(['./index.html', './style.css', './app_final.js', './supabase.js', './offline.html', './manifest.json'])
        .then(() => {
          // حفظ المكتبات الخارجية بشكل اختياري (لا تفشل إن لم تتوفر)
          const externalLibs = CORE_ASSETS.filter(url => url.startsWith('http'));
          return Promise.allSettled(externalLibs.map(url => cache.add(url)));
        });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: تنظيف الكاش القديم ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: استراتيجية Network-First مع Offline Fallback ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل طلبات Supabase وAnthropic (تحتاج اتصال دائماً)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('anthropic.com')) {
    return; // يمر للشبكة مباشرة
  }

  // تجاهل chrome-extension وغير http/https
  if (!url.protocol.startsWith('http')) return;

  // للملفات الخارجية (CDN) — Cache First
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // للملفات المحلية — Network First مع Cache Fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // صفحة Offline للطلبات التنقلية
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_PAGE) || 
            new Response('<h1>لا يوجد اتصال</h1>', { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
        }
        return new Response('', { status: 503 });
      })
  );
});

// ── Background Sync: مزامنة عند عودة الاتصال ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
  }
});

// ── Push Notifications ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Customer Care', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200],
      data: { url: data.url || './' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
