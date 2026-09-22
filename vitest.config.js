import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    alias: {
      'server-only': path.resolve('./src/__mocks__/server-only.js'),
    },
  },
})
