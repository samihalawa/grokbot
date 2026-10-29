import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../src/config.js';
import { GrokPoolRouter } from '../src/pool.js';

test('GrokPoolRouter: role-based candidate routing and cooldown failover', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grokbot-pool-test-'));
  const configPath = path.join(tmpDir, 'config.json');
  const statePath = path.join(tmpDir, 'state.json');

  const cfg = new ConfigManager(configPath);
  cfg.addAccount({ name: 'acct-general', sso: 'token-gen', roles: ['general'] });
  cfg.addAccount({ name: 'acct-coder', sso: 'token-coder', roles: ['coding'] });
  cfg.addAccount({ name: 'acct-filer', sso: 'token-filer', roles: ['filing'] });

  const router = new GrokPoolRouter(cfg, statePath);

  // 1. All candidates
  const all = router.getCandidateAccounts();
  assert.equal(all.length, 3);

  // 2. Specialized role filtering
  const coders = router.getCandidateAccounts(null, 'coding');
  assert.equal(coders.length, 1);
  assert.equal(coders[0], 'acct-coder'); // matches specialized role!

  // 3. Cooldown activation and failover
  router.setCooldown('acct-coder', 300, 'Test Quota');
  assert.ok(router.isInCooldown('acct-coder'));
  assert.ok(router.getCooldownRemaining('acct-coder') > 0);

  // 4. Cooldown reset
  router.clearCooldown('acct-coder');
  assert.equal(router.isInCooldown('acct-coder'), false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
