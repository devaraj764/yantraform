import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite'

export default defineConfig({
  server: {
    port: 51821,
    host: '0.0.0.0',
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    viteReact(),
    nitro({ preset: 'node-server' })
  ],
  ssr: {
    external: ['better-sqlite3', 'knex', 'qrcode', 'jsonwebtoken'],
  },
});
