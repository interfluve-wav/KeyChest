import { beforeAll, afterAll, before } from '@playwright/experimental-ct-react';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const projectRoot = path.join(__dirname, '..');

// Clean test data before all tests
beforeAll(async () => {
  const appSupportPath = path.join(os.homedir(), 'Library', 'Application Support', 'com.sshvault.desktop');
  if (fs.existsSync(appSupportPath)) {
    const vaultDb = path.join(appSupportPath, 'vaults.db');
    if (fs.existsSync(vaultDb)) {
      fs.unlinkSync(vaultDb);
    }
  }
});

// Setup for component tests - mock Tauri environment
before(async () => {
  // For component tests, we need to mock window.__TAURI__
  // This is handled in the test setup file
});

export {};
