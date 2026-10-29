import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../src/config.js';
import { GrokPoolRouter, detectSpecializedRole } from '../src/pool.js';

test('detectSpecializedRole: auto-detects domain context from prompts', () => {
  assert.equal(detectSpecializedRole('Write a function to sort an array'), 'coding');
  assert.equal(detectSpecializedRole('Revisa los pliegos y la licitación'), 'filing');
  assert.equal(detectSpecializedRole('Scrape all notification links from portal'), 'scrapers');
  assert.equal(detectSpecializedRole('Perform a deepsearch literature survey'), 'deepsearch');
  assert.equal(detectSpecializedRole('Hello world'), null);
});

test('GrokPoolRouter: role-affinity routing with horizontal symmetric replica fallback', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grokbot-pool-test-'));
  const configPath = path.join(tmpDir, 'config.json');
  const statePath = path.join(tmpDir, 'state.json');

  const cfg = new ConfigManager(configPath);
  cfg.addAccount({ name: 'acct-general', sso: 'token-gen', roles: ['general'] });
  cfg.addAccount({ name: 'acct-coder', sso: 'token-coder', roles: ['coding'] });
  cfg.addAccount({ name: 'acct-filer', sso: 'token-filer', roles: ['filing'] });

  const router = new GrokPoolRouter(cfg, statePath);

  // 1. All candidates returned when no role specified
  const all = router.getCandidateAccounts();
  assert.equal(all.length, 3);

  // 2. Role-affinity: specialized role matches first, but ALL accounts remain as fallback replicas
  const coders = router.getCandidateAccounts(null, 'coding');
  assert.equal(coders.length, 3);
  assert.equal(coders[0], 'acct-coder'); // Tier 1: specialized role match is prioritized!
  assert.ok(coders.slice(1).includes('acct-general')); // Tier 2: healthy horizontal replicas
  assert.ok(coders.slice(1).includes('acct-filer'));

  // 3. Dynamic failover: when role specialist enters cooldown, fallback replicas take over!
  router.setCooldown('acct-coder', 300, 'Test Quota Exhaustion');
  assert.ok(router.isInCooldown('acct-coder'));
  assert.ok(router.getCooldownRemaining('acct-coder') > 0);

  const fallbackCandidates = router.getCandidateAccounts(null, 'coding');
  assert.equal(fallbackCandidates.length, 3);
  // Crucial: cooling specialist must NOT stall or be the first candidate
  assert.notEqual(fallbackCandidates[0], 'acct-coder');
  assert.ok(['acct-general', 'acct-filer'].includes(fallbackCandidates[0]));
  assert.ok(['acct-general', 'acct-filer'].includes(fallbackCandidates[1]));
  // Cooling specialist is placed last at Tier 3
  assert.equal(fallbackCandidates[2], 'acct-coder');

  // 4. Cooldown reset restores primary priority
  router.clearCooldown('acct-coder');
  assert.equal(router.isInCooldown('acct-coder'), false);
  const restored = router.getCandidateAccounts(null, 'coding');
  assert.equal(restored[0], 'acct-coder');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('GrokPoolRouter: symmetric replica load balancing (--strategy replica / --parallel)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grokbot-replica-test-'));
  const configPath = path.join(tmpDir, 'config.json');
  const statePath = path.join(tmpDir, 'state.json');

  const cfg = new ConfigManager(configPath);
  cfg.addAccount({ name: 'node-a', sso: 'tok-a', roles: ['coding'] });
  cfg.addAccount({ name: 'node-b', sso: 'tok-b', roles: ['filing'] });
  cfg.addAccount({ name: 'node-c', sso: 'tok-c', roles: ['scrapers'] });

  const router = new GrokPoolRouter(cfg, statePath);

  // Strategy replica treats all nodes symmetrically regardless of role
  const candidatesReplica = router.getCandidateAccounts(null, null, null, 'replica');
  assert.equal(candidatesReplica.length, 3);

  // Record usage on node-a and node-b
  router.recordUsage('node-a', true);
  router.recordUsage('node-a', true);
  router.recordUsage('node-b', true);
  // node-c has 0 requests -> least busy node MUST be candidate 0!
  const leastBusyCandidates = router.getCandidateAccounts(null, null, null, 'replica');
  assert.equal(leastBusyCandidates[0], 'node-c');
  assert.equal(leastBusyCandidates[1], 'node-b');
  assert.equal(leastBusyCandidates[2], 'node-a');

  // When node-c enters cooldown, remaining least-busy healthy nodes lead
  router.setCooldown('node-c', 300, 'Temporary 429');
  const failoverCandidates = router.getCandidateAccounts(null, null, null, 'replica');
  assert.equal(failoverCandidates[0], 'node-b');
  assert.equal(failoverCandidates[1], 'node-a');
  assert.equal(failoverCandidates[2], 'node-c'); // cooling at end

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
