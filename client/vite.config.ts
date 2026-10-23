import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies `/api` to the Express server so the browser sees a
// single origin. That keeps cookies simple later and avoids CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
