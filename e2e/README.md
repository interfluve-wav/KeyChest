# E2E Tests

This directory contains Playwright end-to-end tests for the SSH Vault Tauri application.

## Running E2E Tests

### Prerequisites
- Tauri dev environment set up with Rust and Node.js
- Playwright browsers installed: `npx playwright install chromium`

### Run All E2E Tests

```bash
# Start Tauri dev server in one terminal
npm run tauri dev

# In another terminal, run the tests
npm run test:e2e
```

### Run Specific Test File

```bash
npm run test:e2e e2e/app.spec.ts
```

### Run in UI Mode

```bash
npm run test:e2e:ui
```

### Debug Tests

```bash
npm run test:e2e:debug
```

## Test Architecture

### Mock Tauri API
Since Playwright runs in a browser context, the native Tauri API is mocked via `tauri-mock.js`. This injects a `window.__TAURI__` object that simulates all native functionality:

- Vault CRUD operations
- Crypto (AES encryption, key derivation)
- SSH key operations
- PGP key management
- Settings persistence
- Clipboard operations

The mock stores data in memory, so each test run starts with a clean slate.

### Test Environment
- `testEnv.ts` - Manages Tauri dev server lifecycle
- `fixtures.ts` - Playwright test fixtures
- `tauri-mock.js` - JavaScript mock of Tauri's native API

### Test Coverage

**Core Flows:**
- Vault creation and unlocking
- SSH key generation, import, copy, reveal, pin, delete
- API key import and management
- PGP key generation and import
- Notes CRUD operations
- Settings (theme, auto-lock, reveal-on-hover, Touch ID)
- Quick Picker (global hotkey search)

**Accessibility:**
- ARIA labels on interactive elements
- Keyboard navigation
- Focus management in modals

## Notes

- Tests run serially to avoid port conflicts with the Tauri dev server
- The Tauri dev server is started automatically by the test harness
- Tests are designed for macOS (Tauri platform)
- Some tests (Touch ID) are skipped when biometric hardware is unavailable
