import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    testTimeout: 10000,
    alias: {
      'server-only': path.resolve('./src/__mocks__/server-only.js'),
    },
  },
})
