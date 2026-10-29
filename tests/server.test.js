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
  } finally {
    server.close();
  }
});
