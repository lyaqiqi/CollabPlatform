const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/env.js'],
    clearMocks: true,
    restoreMocks: true,
  },
});
