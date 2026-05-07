import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@lib': resolve(__dirname, 'src/lib'),
      '@shared': resolve(__dirname, 'shared'),
      '@config': resolve(__dirname, 'src/config'),
      '@components': resolve(__dirname, 'src/components'),
    },
  },
});
