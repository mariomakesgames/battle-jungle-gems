import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Keep the engine cached when only game code changes.
        manualChunks: { phaser: ['phaser'] }
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    host: true
  }
})
