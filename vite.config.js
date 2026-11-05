import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Allows hosting on GitHub Pages and any subpath
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
