import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false
    })
  ],
  server: {
    port: 5000,
    host: '0.0.0.0'
  },
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@content': path.resolve(__dirname, './src/content'),
        '@config': path.resolve(__dirname, './src/config'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@shared': path.resolve(__dirname, './shared')
      }
    },
    server: {
      allowedHosts: ['.replit.app', '.replit.dev', '.kirk.replit.dev', '.spock.replit.dev', 'localhost', '127.0.0.1', 'supplements.co.ke', 'www.supplements.co.ke', '.railway.app']
    }
  }
});
