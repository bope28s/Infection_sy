// 개발 환경 감지
const isDevelopment = self.location.hostname === 'localhost' || self.location.port === '5173';

// 개발 환경에서는 Service Worker가 모든 요청을 통과시키고 즉시 제거
if (isDevelopment) {
  // 즉시 활성화하여 이전 버전 제거
  self.addEventListener('install', (event) => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      Promise.all([
        // 모든 캐시 삭제
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        }),
        // 모든 클라이언트 제어 획득
        self.clients.claim()
      ]).then(() => {
        // Service Worker 자체를 제거하려고 시도
        // 하지만 실제로는 fetch 이벤트에서 모든 요청을 통과시킴
      })
    );
  });

  self.addEventListener('fetch', (event) => {
    // 개발 환경: 모든 요청을 네트워크에서 직접 가져오기
    // Service Worker가 개입하지 않음
    event.respondWith(
      fetch(event.request).catch((error) => {
        // 네트워크 오류 시에도 원본 요청 반환
        console.error('Service Worker fetch error (dev mode):', error);
        return fetch(event.request);
      })
    );
  });
} else {
  // 프로덕션 환경: 정상적인 Service Worker 동작
const CACHE_NAME = 'germ-battle-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/store_icon.png',
  '/screenshot/GermBattle.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
}