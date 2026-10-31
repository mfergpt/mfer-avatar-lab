import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: process.env.LAB_BASE_PATH || '/',
  resolve: {
    alias: { '@avatar': fileURLToPath(new URL('./src/avatar', import.meta.url)) },
    dedupe: ['three'],
  },
  build: { target: 'es2020' },
});
