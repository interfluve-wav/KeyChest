// Tauri API mock for Playwright E2E tests
// This injects a fake window.__TAURI__ object to simulate native functionality

(function() {
  'use strict';

  // In-memory vault storage
  const vaults = [];
  let currentVault = null;
  let vaultData = {
    keys: [],
    api_keys: [],
    notes: [],
    pgp_keys: [],
  };

  // Helper to create responses
  const ok = (data) => ({ success: true, data });
  const error = (msg) => ({ success: false, error: msg });

  // Generate UUID
  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Build the mock Tauri API
  window.__TAURI__ = {
    invoke: async (cmd, args) => {
      console.log('[Tauri Mock] invoke:', cmd, args);

      // Vault operations
      if (cmd === 'vault_list') {
        return ok(vaults);
      }

      if (cmd === 'vault_save') {
        const vault = { ...args, created: new Date().toISOString() };
        vaults.push(vault);
        return ok(vault);
      }

      if (cmd === 'vault_load') {
        const vault = vaults.find(v => v.id === args.id);
        if (!vault) return error('Vault not found');
        return ok(vault);
      }

      if (cmd === 'vault_delete') {
        const idx = vaults.findIndex(v => v.id === args.id);
        if (idx > -1) vaults.splice(idx, 1);
        return ok(true);
      }

      if (cmd === 'vault_check_integrity') {
        return ok({ valid: true, vaults: vaults.length });
      }

      // Crypto operations
      if (cmd === 'argon2_key_derive') {
        return ok(Buffer.from('derived-key-32-bytes-1234567890').toString('base64'));
      }

      if (cmd === 'aes_encrypt' || cmd === 'aes_decrypt') {
        // Simple mock encryption/decryption
        const key = Buffer.from(args.key, 'base64');
        if (cmd === 'aes_encrypt') {
          return ok('mock-ciphertext-' + generateUuid());
        }
        return ok(args.ciphertext);
      }

      if (cmd === 'generate_salt') {
        return ok(Buffer.from('mock-salt-16-bytes').toString('base64'));
      }

      if (cmd === 'generate_uuid') {
        return ok(generateUuid());
      }

      // SSH operations
      if (cmd === 'ssh_generate_key') {
        const key = {
          id: generateUuid(),
          name: args.name,
          key_type: args.keyType,
          comment: args.comment || '',
          fingerprint: 'SHA256:mock-fingerprint-' + generateUuid().slice(0, 8),
          public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB...' + args.name,
          private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----',
          created: new Date().toISOString(),
          copied_count: 0,
          last_copied_at: null,
          last_used_at: null,
          pinned: false,
        };
        vaultData.keys.push(key);
        return ok(key);
      }

      if (cmd === 'ssh_import_keys') {
        const imported = [];
        // Simulate finding keys in ~/.ssh
        const mockKeys = [
          {
            name: 'id_rsa',
            key_type: 'rsa',
            comment: 'imported@localhost',
            fingerprint: 'SHA256:imported-fingerprint',
            public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ...',
            private_key: '-----BEGIN RSA PRIVATE KEY-----\n...',
          },
          {
            name: 'id_ed25519',
            key_type: 'ed25519',
            comment: 'imported2@localhost',
            fingerprint: 'SHA256:imported2-fingerprint',
            public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB...',
            private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
          },
        ];
        for (const k of mockKeys) {
          const key = { ...k, id: generateUuid(), created: new Date().toISOString(), copied_count: 0, last_copied_at: null, last_used_at: null, pinned: false };
          vaultData.keys.push(key);
          imported.push(key);
        }
        return ok(imported);
      }

      if (cmd === 'ssh_get_fingerprint') {
        return ok('SHA256:calc-fingerprint-' + generateUuid().slice(0, 8));
      }

      if (cmd === 'ssh_export_key') {
        const key = vaultData.keys.find(k => k.id === args.id);
        if (!key) return error('Key not found');
        return ok(key.private_key);
      }

      // Agent operations
      if (cmd === 'ssh_agent_list') {
        return ok(vaultData.keys.filter(k => k.private_key));
      }

      if (cmd === 'ssh_agent_add') {
        const key = vaultData.keys.find(k => k.id === args.id);
        if (key && key.private_key) {
          return ok({ fingerprint: key.fingerprint });
        }
        return error('Key not found or no private key');
      }

      if (cmd === 'ssh_agent_remove') {
        return ok(true);
      }

      if (cmd === 'ssh_agent_clear') {
        return ok(true);
      }

      // Settings
      if (cmd === 'settings_get') {
        return ok({
          auto_lock_minutes: 5,
          theme: 'dark',
          default_ssh_key_type: 'ed25519',
          ssh_agent_lifetime: null,
          clipboard_clear_seconds: null,
          confirm_deletions: true,
          biometric_unlock: false,
          reveal_on_hover: false,
        });
      }

      if (cmd === 'settings_set') {
        return ok(true);
      }

      if (cmd === 'settings_reset') {
        return ok({
          auto_lock_minutes: 5,
          theme: 'dark',
          default_ssh_key_type: 'ed25519',
          reveal_on_hover: false,
        });
      }

      // Biometric
      if (cmd === 'biometric_available') {
        return ok(false); // Mock: no Touch ID in test environment
      }

      if (cmd === 'biometric_store_key' || cmd === 'biometric_retrieve_key' || cmd === 'biometric_delete_key') {
        return ok(null);
      }

      if (cmd === 'biometric_unlock') {
        return error('Biometric not available');
      }

      // Git operations
      if (cmd === 'git_is_repo') {
        return ok(false);
      }

      if (cmd === 'git_set_ssh_key' || cmd === 'git_remove_ssh_key' || cmd === 'git_setup_deploy_key') {
        return ok(true);
      }

      // PGP operations
      if (cmd === 'pgp_generate_key') {
        const pgpKey = {
          id: generateUuid(),
          name: args.name,
          fingerprint: 'MOCK-FPR-' + generateUuid().slice(0, 8),
          key_id: '0x' + generateUuid().slice(0, 16),
          algorithm: args.algorithm || 'ed25519',
          bit_length: args.bitLength || 256,
          created: new Date().toISOString(),
          user_ids: [args.email || 'test@example.com'],
          public_key: '-----BEGIN PGP PUBLIC KEY BLOCK-----\n...',
          private_key: '-----BEGIN PGP PRIVATE KEY BLOCK-----\n...',
          pinned: false,
        };
        vaultData.pgp_keys.push(pgpKey);
        return ok(pgpKey);
      }

      if (cmd === 'pgp_import_key') {
        const pgpKey = {
          id: generateUuid(),
          name: 'Imported PGP Key',
          fingerprint: 'IMPORT-FPR-' + generateUuid().slice(0, 8),
          key_id: '0x' + generateUuid().slice(0, 16),
          algorithm: 'rsa',
          bit_length: 2048,
          created: new Date().toISOString(),
          user_ids: ['imported@example.com'],
          public_key: args.key,
          private_key: args.key.includes('PRIVATE') ? args.key : null,
          pinned: false,
        };
        vaultData.pgp_keys.push(pgpKey);
        return ok(pgpKey);
      }

      if (cmd === 'pgp_list_keys') {
        return ok(vaultData.pgp_keys);
      }

      if (cmd === 'pgp_delete_key') {
        vaultData.pgp_keys = vaultData.pgp_keys.filter(k => k.id !== args.id);
        return ok(true);
      }

      // Unknown command
      console.warn('[Tauri Mock] Unknown command:', cmd);
      return error('Unknown command: ' + cmd);
    },

    // Plugin APIs
    clipboard: {
      writeText: async (text) => {
        console.log('[Clipboard mock] wrote:', text.slice(0, 20) + '...');
        return Promise.resolve();
      },
      readText: async () => 'mock-clipboard-content',
    },

    // Store plugin mock
    store: () => ({
      get: () => null,
      set: () => {},
      save: () => Promise.resolve(),
    }),

    // App handle mock
    app: {
      getCurrentWindow: () => ({ close: () => {} }),
    },
  };

  console.log('[Tauri Mock] Initialized');
})();
