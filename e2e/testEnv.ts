import { chromium, Browser, Page } from '@playwright/test';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const projectRoot = path.join(__dirname, '..');
const vaultDbPath = path.join(os.homedir(), 'Library', 'Application Support', 'com.sshvault.desktop', 'vaults.db');
const sshVaultDir = path.join(os.homedir(), '.ssh-vault');

let tauriProcess: ReturnType<typeof spawn> | null = null;
let browser: Browser | null = null;

// Clean test vault data
function cleanTestData() {
  try {
    if (fs.existsSync(vaultDbPath)) {
      fs.unlinkSync(vaultDbPath);
      console.log('Cleaned vaults.db');
    }
    if (fs.existsSync(sshVaultDir)) {
      const files = fs.readdirSync(sshVaultDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(sshVaultDir, file));
        }
      }
      console.log('Cleaned vault files');
    }
  } catch (err) {
    console.log('Cleanup note:', err.message);
  }
}

// Start Tauri dev server
function startTauriDev() {
  return new Promise<void>((resolve, reject) => {
    tauriProcess = spawn('npm', ['run', 'tauri', 'dev'], {
      cwd: projectRoot,
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    tauriProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[Tauri]', text);
      if (text.includes('ready') || text.includes('listening')) {
        resolve();
      }
    });

    tauriProcess.stderr.on('data', (data) => {
      console.error('[Tauri Err]', data.toString());
    });

    tauriProcess.on('error', reject);

    // Timeout fallback
    setTimeout(resolve, 15000);
  });
}

// Stop Tauri dev server
function stopTauriDev() {
  if (tauriProcess) {
    tauriProcess.kill('SIGTERM');
    tauriProcess = null;
  }
}

export async function setupTestEnv(): Promise<Page> {
  cleanTestData();

  // Start Tauri dev
  console.log('Starting Tauri dev server...');
  await startTauriDev();

  // Launch browser and connect to the app
  browser = await chromium.launch({
    headless: process.env.CI ? true : false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Inject Tauri mock before navigation
  await context.addInitScript({
    path: path.join(__dirname, 'tauri-mock.js'),
  });

  const page = await context.newPage();
  await page.goto('http://localhost:1420');

  return page;
}

export async function teardownTestEnv() {
  if (browser) {
    await browser.close();
    browser = null;
  }
  stopTauriDev();
}
