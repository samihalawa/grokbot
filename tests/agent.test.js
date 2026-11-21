import test from 'node:test';
import assert from 'node:assert';
import { GrokAgentClient, guardianJob } from '../src/agent.js';

test('GrokAgentClient: connects, resolves parameters, and parses roster', async () => {
  const mockConfig = {
    accounts: new Map([
      ['mock-acct', { uid: 'mock-uid-1234', sso: 'mock-sso-token' }],
    ]),
    resolveSso(name) {
      return this.accounts.get(name)?.sso;
    },
  };

  const client = new GrokAgentClient(mockConfig);
  const conn = await client.resolveConnection('mock-acct');

  assert.strictEqual(conn.uid, 'mock-uid-1234');
  assert.strictEqual(conn.wsUrl, 'wss://grok.com/ws/bot/?uid=mock-uid-1234');
  assert.match(conn.cookieHeader, /sso=mock-sso-token/);
});

test('GrokAgentClient: rejects when account does not have UID', async () => {
  const mockConfig = {
    accounts: new Map([
      ['no-uid-acct', { sso: 'mock-sso-token' }],
    ]),
    resolveSso(name) {
      return this.accounts.get(name)?.sso;
    },
  };

  const client = new GrokAgentClient(mockConfig);
  await assert.rejects(
    async () => client.resolveConnection('no-uid-acct'),
    /does not have a 'uid' configured/
  );
});

test('Guardian review preserves the human task and acknowledges the native correction', () => {
  const correction = "[SAMI'S INTENT GUARDIAN] Check the native result.";
  const entries = [
    { kind: 'message', role: 'user', content: 'Verify release' },
    { kind: 'send-message', message: { content: 'Earlier reply' } },
    { kind: 'message', role: 'user', id: 't1u', content: correction },
    { kind: 'send-message', message: { content: 'Verified reply' } },
  ];
  const job = guardianJob('bot-id', entries, ['Native evidence']);
  assert.equal(job.prompt, 'Verify release');
  assert.equal(job.result, 'Verified reply');
  assert.deepEqual(job.evidence, ['Native evidence']);
  assert.equal(job.delivery.source_id, 't1u');
  assert.match(job.delivery.correction_hash, /^[a-f0-9]{64}$/);
  assert.throws(() => guardianJob('bot-id', entries.slice(0, -1), []), /No native GrokBot reply/);
});
