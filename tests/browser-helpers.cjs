const { chromium } = require('playwright');
const { existsSync } = require('node:fs');

// Prefer an explicit browser, then system Chromium, then Playwright's download.
exports.launchBrowser = () => chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true,
  args: ['--no-sandbox'],
});
exports.testUrl = process.env.TEST_URL || 'http://127.0.0.1:8000/';
