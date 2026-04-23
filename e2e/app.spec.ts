import { test, expect } from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('SSH Vault E2E', () => {

  test('should load vault list screen', async ({ page }) => {
    await page.goto('http://localhost:1420');
    await expect(page.locator('h1')).toContainText('SSH Vault');
    await expect(page.locator('button:has-text("Create Vault")')).toBeVisible();
  });

  test('should create a new vault and show dashboard', async ({ page }) => {
    await page.goto('http://localhost:1420');

    await page.click('button:has-text("Create Vault")');
    await page.fill('input[placeholder="My Vault"]', 'TestVault');
    await page.fill('input[type="password"]:first-of-type', 'TestPass123!');
    await page.fill('input[type="password"]:nth-of-type(2)', 'TestPass123!');
    await page.click('button:has-text("Create Vault")');

    // Dashboard should appear with vault name
    await expect(page.locator('h1')).toContainText('TestVault');
    await expect(page.locator('button:has-text("SSH Keys")')).toBeVisible();
  });

  test.describe('Dashboard Navigation', () => {

    test('should switch between tabs', async ({ page }) => {
      await page.goto('http://localhost:1420');

      // Create vault
      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'NavTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      // Verify we're on dashboard, then switch tabs
      await page.click('button:has-text("SSH Keys")');
      await expect(page.locator('text=No SSH keys yet')).toBeVisible();

      await page.click('button:has-text("API Keys")');
      await expect(page.locator('text=No API keys yet')).toBeVisible();

      await page.click('button:has-text("PGP Keys")');
      await expect(page.locator('text=No PGP keys yet')).toBeVisible();

      await page.click('button:has-text("Notes")');
      await expect(page.locator('text=No notes yet')).toBeVisible();
    });

  });

  test.describe('SSH Keys', () => {

    test('should add an SSH key', async ({ page }) => {
      await page.goto('http://localhost:1420');

      // Create vault
      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'SSHTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      // SSH tab
      await page.click('button:has-text("SSH Keys")');

      // Open add modal
      await page.click('button:has-text("Add")');

      // Fill form
      await page.fill('input[placeholder="Key name"]', 'My Test Key');
      await page.fill('textarea', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB... test@example.com');
      await page.selectOption('select', 'ed25519');

      await page.click('button:has-text("Save")');

      await expect(page.locator('h3')).toContainText('My Test Key');
      await expect(page.locator('text=ed25519')).toBeVisible();
    });

    test('should display Copy Public button for each key', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'PubCopyTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("SSH Keys")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Key name"]', 'Key with Public');
      await page.fill('textarea', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB... test@example.com');
      await page.click('button:has-text("Save")');

      await expect(page.locator('button:has-text("Copy Public")').first()).toBeVisible();
    });

    test('should copy public key when Copy Public clicked', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'PubKeyCopy');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("SSH Keys")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Key name"]', 'CopyPubKey');
      await page.fill('textarea', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB...');
      await page.click('button:has-text("Save")');

      await page.click('button:has-text("Copy Public")');

      await expect(page.locator('text=Copied to clipboard!')).toBeVisible();
    });

    test('should reveal private key on click', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'RevealTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("SSH Keys")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Key name"]', 'RevealMe');
      await page.fill('textarea', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB...');
      await page.click('button:has-text("Save")');

      await expect(page.locator('pre')).toContainText('••••••••');
      await page.click('button[title="Reveal"]');
      await expect(page.locator('pre')).not.toContainText('••••••••');
      await expect(page.locator('pre')).toContainText('-----BEGIN OPENSSH PRIVATE KEY-----');
    });

    test('should show partial key on hover when reveal-on-hover enabled', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'HoverTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("SSH Keys")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Key name"]', 'HoverKey');
      await page.fill('textarea', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB...');
      await page.click('button:has-text("Save")');

      // Enable setting
      await page.click('button[title="Settings"]');
      const offToggle = page.locator('button[role="switch"][aria-checked="false"]').first();
      await offToggle.click();
      await page.click('button:has-text("Back")');
      await page.click('button:has-text("SSH Keys")');

      // Hover over key row
      const keyRow = page.locator('.group').first();
      await keyRow.hover();

      await expect(page.locator('pre')).toContainText('...');
    });

  });

  test.describe('Settings', () => {

    test('should open settings screen', async ({ page }) => {
      await page.goto('http://localhost:1420');
      await page.click('button[title="Settings"]');
      await expect(page.locator('h1')).toContainText('Settings');
    });

    test('should toggle reveal-on-hover setting', async ({ page }) => {
      await page.goto('http://localhost:1420');
      await page.click('button[title="Settings"]');

      const offToggle = page.locator('button[role="switch"][aria-checked="false"]').first();
      await offToggle.click();
      await expect(offToggle).toHaveAttribute('aria-checked', 'true');
    });

    test('should toggle dark/light theme', async ({ page }) => {
      await page.goto('http://localhost:1420');
      await page.click('button[title="Settings"]');
      await page.click('button[title="Toggle dark mode"]');
      await expect(page.locator('body')).toHaveClass(/light/);
    });

    test('should adjust auto-lock timeout', async ({ page }) => {
      await page.goto('http://localhost:1420');
      await page.click('button[title="Settings"]');

      const slider = page.locator('input[type="range"]').first();
      await slider.fill('30');

      await expect(page.locator('text=Settings saved')).toBeVisible();
    });

  });

  test.describe('API Keys', () => {

    test('should import API keys from JSON', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'APITest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("API Keys")');
      await page.click('button:has-text("Import API")');

      const apiData = JSON.stringify([
        {
          name: 'OpenAI API',
          provider: 'OpenAI',
          key: 'sk-mock123456789',
          notes: 'E2E test key',
          created: new Date().toISOString(),
        },
      ]);

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'api-keys.json',
        mimeType: 'application/json',
        buffer: Buffer.from(apiData),
      } as File);

      await page.click('button:has-text("Continue")');
      await page.click('button:has-text("Import")');

      await expect(page.locator('h3')).toContainText('OpenAI API');
    });

    test('should copy API key', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'APICopyTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("API Keys")');
      await page.click('button:has-text("Import API")');

      await page.setInputFiles('input[type="file"]', {
        name: 'api.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify([{ name: 'TestAPI', provider: 'Test', key: 'testkey123', notes: '', created: new Date().toISOString() }])),
      } as File);
      await page.click('button:has-text("Continue")');
      await page.click('button:has-text("Import")');

      await page.click('button[title="Copy key"]');
      await expect(page.locator('text=Copied to clipboard!')).toBeVisible();
    });

  });

  test.describe('PGP Keys', () => {

    test('should generate a new PGP key', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'PGPGenTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("PGP Keys")');
      await page.click('button:has-text("Add")');

      await page.fill('input[placeholder="Key name"]', 'My PGP Key');
      await page.fill('input[placeholder="email@example.com"]', 'test@example.com');
      await page.selectOption('select', 'ed25519');

      await page.click('button:has-text("Generate")');
      await page.waitForTimeout(4000);

      await expect(page.locator('h3')).toContainText('My PGP Key');
    });

    test('should copy PGP public key', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'PGPCopyTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("PGP Keys")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Key name"]', 'CopyPGP');
      await page.fill('input[placeholder="email@example.com"]', 'test@example.com');
      await page.click('button:has-text("Generate")');

      await page.waitForTimeout(4000);

      await page.click('button:has-text("Copy Public")');
      await expect(page.locator('text=Copied to clipboard!')).toBeVisible();
    });

  });

  test.describe('Quick Picker', () => {

    test('should open with keyboard shortcut', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'QPTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      // Add a key to search for
      await page.click('button:has-text("SSH Keys")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Key name"]', 'QuickSearchKey');
      await page.fill('textarea', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB...');
      await page.click('button:has-text("Save")');

      // Press shortcut
      const shortcut = process.platform === 'darwin' ? 'Meta+Shift+K' : 'Control+Shift+K';
      await page.keyboard.press(shortcut);

      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('input[placeholder="Search keys..."]')).toBeVisible();
    });

    test('should filter results as typing', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'QPFTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("SSH Keys")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Key name"]', 'AlphaKey');
      await page.fill('textarea', 'ssh-ed25519 ...');
      await page.click('button:has-text("Save")');

      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+K' : 'Control+Shift+K');
      await page.fill('input[placeholder="Search keys..."]', 'Alpha');

      await expect(page.locator('.quick-picker-item').first()).toContainText('AlphaKey');
    });

  });

  test.describe('Notes', () => {

    test('should create a note', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'NoteTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("Notes")');
      await page.click('button:has-text("Add")');

      await page.fill('input[placeholder="Note title"]', 'E2E Test Note');
      await page.fill('textarea', 'This note was created during E2E testing.');
      await page.click('button:has-text("Save")');

      await expect(page.locator('h3')).toContainText('E2E Test Note');
    });

    test('should edit a note', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'NoteEditTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("Notes")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Note title"]', 'Editable Note');
      await page.fill('textarea', 'Original content');
      await page.click('button:has-text("Save")');

      await page.click('button[title="Edit note"]');
      await page.fill('textarea', 'Updated content');
      await page.click('button:has-text("Save")');

      await expect(page.locator('text=Updated content')).toBeVisible();
    });

    test('should delete a note', async ({ page }) => {
      await page.goto('http://localhost:1420');

      await page.click('button:has-text("Create Vault")');
      await page.fill('input[placeholder="My Vault"]', 'NoteDelTest');
      await page.fill('input[type="password"]:first-of-type', 'Pass123!');
      await page.fill('input[type="password"]:nth-of-type(2)', 'Pass123!');
      await page.click('button:has-text("Create Vault")');

      await page.click('button:has-text("Notes")');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Note title"]', 'Delete Me');
      await page.fill('textarea', 'To be deleted');
      await page.click('button:has-text("Save")');

      await page.click('button[title="Delete note"]');
      await page.click('button:has-text("Delete")');

      await expect(page.locator('h3')).not.toContainText('Delete Me');
    });

  });

});
