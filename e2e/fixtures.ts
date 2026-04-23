import { test as baseTest, expect, chromium } from '@playwright/test';
import path from 'path';

// Get the project root
const projectRoot = path.join(__dirname, '..');

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    // Inject the Tauri mock before any page content loads
    await page.addInitScript({
      path: path.join(__dirname, 'tauri-mock.js'),
    });

    await use(page);
  },
});

export { expect, chromium };
