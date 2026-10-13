import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts', 'tests/rag/**/*.test.ts', 'tests/security/**/*.test.ts'],
          environment: 'node',
          // Integration tests only ever touch the isolated test schema.
          env: { DB_SCHEMA: 'website_with_rag_test', LOG_LEVEL: 'silent', NODE_ENV: 'test', PUBLIC_CHAT_REQUIRES_LLM: 'false' },
          testTimeout: 120_000,
          hookTimeout: 300_000,
          fileParallelism: false,
          sequence: { concurrent: false },
        },
      },
    ],
  },
});
