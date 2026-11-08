/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  optimizeDeps: {
    include: ['@shared/utils/dist/academicConfig']
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8080'),
    allowedHosts: true,
    hmr: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
    proxy: {
      '/api/auth': {
        target: process.env.VITE_AUTH_API_TARGET || 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: process.env.VITE_BACKEND_PROXY_URL || 'http://localhost:4002',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_PROXY_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/uploads': {
        target: process.env.VITE_BACKEND_PROXY_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, './src/test/setup.ts'),
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
