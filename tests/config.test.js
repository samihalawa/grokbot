import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../src/config.js';

test('ConfigManager: adds, normalizes, and retrieves accounts', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grokbot-test-'));
  const configPath = path.join(tmpDir, 'config.json');

  const mgr = new ConfigManager(configPath);
  assert.equal(mgr.accounts.size, 0);

  mgr.addAccount({
    name: 'test-account',
    sso: 'fake-sso-token-12345',
    email: 'test@example.com',
    roles: ['coding', 'general'],
    cooldown_seconds: 600,
  });

  assert.equal(mgr.accounts.size, 1);
  assert.ok(mgr.accounts.has('test-account'));
  const acc = mgr.accounts.get('test-account');
  assert.equal(acc.email, 'test@example.com');
  assert.deepEqual(acc.roles, ['coding', 'general']);
  assert.equal(mgr.resolveSso('test-account'), 'fake-sso-token-12345');

  // Verify persistence
  const reloaded = new ConfigManager(configPath);
  assert.equal(reloaded.accounts.size, 1);
  assert.ok(reloaded.accounts.has('test-account'));

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
