const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests/browser', fullyParallel: false,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'php -d short_open_tag=On -S 127.0.0.1:8080 -t . tools/router.php',
    url: 'http://127.0.0.1:8080', reuseExistingServer: !process.env.CI,
    env: { GRAPHONLINE_STORAGE_DIR: '/tmp/graphonline-test-documents' }
  }
});
