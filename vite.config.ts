import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 개발 환경에서는 Service Worker 완전히 비활성화
      devOptions: {
        enabled: false,
        type: 'module',
      },
      // 개발 환경에서 Service Worker 파일 자체를 생성하지 않음
      injectRegister: null,
      strategies: 'generateSW',
      manifest: {
        name: 'Infection SY',
        short_name: 'InfectionSY',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})