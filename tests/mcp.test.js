import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('MCP: discovers working tools with annotations matching their side effects', { timeout: 5000 }, async (t) => {
  const env = { ...process.env, GROK_CONFIG: join(tmpdir(), `grokbot-mcp-no-config-${process.pid}.json`) };
  for (const key of ['GROK_SSO', 'GROK_COOKIE', 'GROK_SESSION', 'GROK_POOL_JSON']) delete env[key];
  const child = spawn(process.execPath, [new URL('../bin/grok.js', import.meta.url).pathname, 'mcp'], {
    cwd: tmpdir(), env, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = createInterface({ input: child.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  t.after(() => { child.kill(); lines.close(); });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
  const initialized = JSON.parse((await iterator.next()).value);
  assert.equal(initialized.id, 1);
  assert.equal(initialized.result.serverInfo.name, 'grokbot');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
  const listed = JSON.parse((await iterator.next()).value);
  assert.equal(listed.id, 2);
  assert.deepEqual(Object.fromEntries(listed.result.tools.map(({ name, annotations }) => [name, annotations])), {
    grok_ask: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
    grok_pool_status: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
    grok_export: { readOnlyHint: false, openWorldHint: true, destructiveHint: true },
  });
});
