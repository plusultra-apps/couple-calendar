import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 푸시 알림 처리를 위해 서비스워커를 직접 작성한다 (src/sw.ts)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png', 'badge-96x96.png'],
      manifest: {
        name: '우리달력',
        short_name: '우리달력',
        description: '둘의 시간을 한눈에 — 커플 공유 캘린더',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        // 다른 앱의 '공유' 목록에 우리달력이 뜬다 (안드로이드). 받은 내용은 위시로 담는다.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        background_color: '#FFF4F8',
        theme_color: '#FF8DB3',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    // 자주 안 바뀌는 라이브러리를 따로 묶어, 앱을 고쳐 배포해도 폰이 다시 받는 양을 줄인다
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'date', test: /node_modules[\\/](date-fns|rrule|korean-lunar-calendar)[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](vaul|@radix-ui|lucide-react|@tanstack)[\\/]/ },
          ],
        },
      },
    },
  },
})
