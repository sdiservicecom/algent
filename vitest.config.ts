import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Dummy env so lib/kv.ts can build its Redis client at import time.
    // Tests must never trigger an actual network call.
    env: {
      UPSTASH_REDIS_REST_URL: 'https://localhost',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
      AUTH_SECRET: 'test-auth-secret-for-vitest-only',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.spec.ts', 'lib/kv.ts', 'lib/auth.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
