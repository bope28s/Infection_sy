import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Tailwind CSS CDN (프로젝트에 빌드된 CSS가 없어 프로덕션에서도 필요)
if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) {
    const tailwindScript = document.createElement('script');
    tailwindScript.src = 'https://cdn.tailwindcss.com';
    // 경고를 억제하기 위해 설정 추가 (Tailwind CDN이 지원하는 경우)
    tailwindScript.onload = () => {
      // Tailwind가 로드된 후 경고 억제 시도
      if (window.tailwind && window.tailwind.config) {
        // Tailwind 설정으로 경고 억제 시도
        try {
          window.tailwind.config = {
            ...window.tailwind.config,
            // 경고 억제 옵션이 있다면 설정
          };
        } catch (e) {
          // 설정 실패 시 무시
        }
      }
    };
    document.head.appendChild(tailwindScript);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker 관리 (production only)
if ('serviceWorker' in navigator) {
  if (!import.meta.env.PROD) {
    // 개발 환경: Service Worker 완전히 제거하지 않고, 등록도 하지 않음
    // 기존 Service Worker가 있으면 제거 시도
    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          console.log('Found existing Service Workers, removing...');
          await Promise.all(
            registrations.map((registration) => registration.unregister())
          );
          
          // 캐시도 삭제
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
          }
          
          console.log('Service Workers removed. The page will work normally now.');
        }
      } catch (error) {
        console.error('Error managing Service Workers:', error);
      }
    })();
    
    // 개발 환경에서는 Service Worker를 등록하지 않음
  } else {
    // 프로덕션 환경: Service Worker 등록
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      },
      (err) => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);