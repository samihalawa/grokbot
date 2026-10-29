import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

test('Server: returns OpenAI models list and health status', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /v1/models
    const respModels = await fetch(`${baseUrl}/v1/models`);
    assert.equal(respModels.status, 200);
    const modelsData = await respModels.json();
    assert.equal(modelsData.object, 'list');
    assert.ok(modelsData.data.some((m) => m.id === 'grok-3'));

    // 2. GET /health
    const respHealth = await fetch(`${baseUrl}/health`);
    assert.equal(respHealth.status, 200);
    const healthData = await respHealth.json();
    assert.equal(healthData.status, 'ok');

    // 3. POST /api/pool/reset
    const respReset = await fetch(`${baseUrl}/api/pool/reset`, { method: 'POST' });
    assert.equal(respReset.status, 200);
    const resetData = await respReset.json();
    assert.equal(resetData.ok, true);

    // 4. GET / (Dashboard HTML)
    const respDash = await fetch(`${baseUrl}/`);
    assert.equal(respDash.status, 200);
    const dashHtml = await respDash.text();
    assert.ok(dashHtml.includes('GROKBOT'));
    assert.ok(dashHtml.includes('drawer-toggle-btn'));
    assert.ok(dashHtml.includes('mobile-back-btn'));
    assert.ok(dashHtml.includes('Réplicas Horizontales Simétricas'));

    // 5. POST /v1/chat/completions bad payload validation
    const respBad = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{',
    });
    assert.equal(respBad.status, 400);
  } finally {
    server.close();
  }
});
