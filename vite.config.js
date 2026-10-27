import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use relative base so the built site works when dragged to Netlify Drop
// or served from any subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
})
