import test from 'node:test';
import assert from 'node:assert';
import { GrokAgentClient } from '../src/agent.js';

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
