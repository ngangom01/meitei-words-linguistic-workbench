import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  // Keep local development at / and use this repository's GitHub Pages path in production.
  base: mode === 'production' ? '/meitei-words-linguistic-workbench/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'words.json'],
      manifest: {
        name: 'Meitei Words Audio Workbench',
        short_name: 'Meitei Words',
        description: 'A simple local-first recording workbench for Meitei vocabulary.',
        theme_color: '#f8f7f3',
        background_color: '#f8f7f3',
        display: 'standalone',
        start_url: './',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,json,svg,woff2}'] }
    })
  ]
}))
