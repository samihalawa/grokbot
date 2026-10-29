/**
 * OpenAI-Compatible Local API Proxy Server & Web Dashboard.
 * Pure native node:http implementation with zero external dependencies.
 * Allows any AI agent or IDE (Cursor, Claude Code, Codex, Aider, LangChain, LiteLLM)
 * to connect to Grok with automatic multi-account pooling and quota failover.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { GrokPoolRouter } from './pool.js';

function getDashboardHtml(poolStatus, port) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>grokbot — Multi-Account Orchestrator</title>
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: #13151f;
      --border: #232738;
      --text: #f0f3f8;
      --muted: #8b949e;
      --primary: #3b82f6;
      --green: #10b981;
      --yellow: #f59e0b;
      --red: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--font); padding: 2rem; line-height: 1.5; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    h1 { font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
    .badge { background: var(--border); padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem; margin-bottom: 2rem; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .status-active { background: var(--green); box-shadow: 0 0 8px var(--green); }
    .status-cooldown { background: var(--yellow); box-shadow: 0 0 8px var(--yellow); }
    .status-error { background: var(--red); box-shadow: 0 0 8px var(--red); }
    .role-tag { background: #1e293b; color: #94a3b8; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 4px; margin-right: 0.25rem; }
    .meta-row { display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 0.5rem; color: var(--muted); }
    .box { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
    input, textarea, button { font-family: inherit; }
    textarea { width: 100%; background: #0b0d14; border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 0.75rem; min-height: 80px; resize: vertical; margin-bottom: 0.75rem; }
    button { background: var(--primary); color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
    button:hover { opacity: 0.9; }
    #resultBox { margin-top: 1rem; padding: 1rem; background: #0b0d14; border: 1px solid var(--border); border-radius: 6px; display: none; white-space: pre-wrap; font-family: monospace; font-size: 0.9rem; }
    code { font-family: monospace; background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.85rem; }
  </style>
</head>
<body>
  <header>
    <h1>🤖 grokbot <span class="badge">v1.1.0</span></h1>
    <div style="font-size: 0.9rem; color: var(--muted);">
      OpenAI Proxy: <code>http://127.0.0.1:${port}/v1</code>
    </div>
  </header>

  <h2 style="font-size: 1.1rem; margin-bottom: 1rem; color: var(--muted);">POOL ACCOUNTS & REAL-TIME QUOTA</h2>
  <div class="grid">
    ${poolStatus
      .map(
        (a) => `
      <div class="card">
        <div class="card-header">
          <strong>${a.name}</strong>
          <span class="status-dot ${a.cooldown ? 'status-cooldown' : (a.auth_ok ? 'status-active' : 'status-error')}"></span>
        </div>
        <div style="font-size: 0.85rem; color: var(--muted); margin-bottom: 0.5rem;">${a.email || 'N/A'}</div>
        <div>${(a.roles || []).map((r) => `<span class="role-tag">${r}</span>`).join('')}</div>
        <div class="meta-row">
          <span>Status:</span>
          <span>${a.cooldown ? `Cooldown (${a.cooldown_remaining_sec}s)` : (a.auth_ok ? 'Healthy & Active' : 'Auth Required')}</span>
        </div>
        <div class="meta-row">
          <span>Requests: ${a.stats?.requests || 0}</span>
          <span>Failovers: ${a.stats?.failovers || 0}</span>
        </div>
      </div>
    `
      )
      .join('')}
  </div>

  <div class="box">
    <h2 style="font-size: 1.1rem; margin-bottom: 0.75rem;">Interactive Playground</h2>
    <textarea id="promptInput" placeholder="Enter a prompt to test multi-account pool routing (e.g. 'Write a fast binary search')..."></textarea>
    <button onclick="sendPrompt()">Run Prompt</button>
    <div id="resultBox"></div>
  </div>

  <div class="box" style="font-size: 0.85rem; color: var(--muted);">
    <strong>Connecting from Cursor, Claude Code, or Codex:</strong><br>
    Set OpenAI Base URL to: <code>http://127.0.0.1:${port}/v1</code> and API Key to any string. Requests will automatically route and fail over across healthy pool accounts.
  </div>

  <script>
    async function sendPrompt() {
      const prompt = document.getElementById('promptInput').value.trim();
      const resBox = document.getElementById('resultBox');
      if (!prompt) return;

      resBox.style.display = 'block';
      resBox.textContent = 'Routing prompt through grokbot pool...';

      try {
        const resp = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'grok-3',
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
        const meta = data._grok_meta ? ('[Served by: ' + data._grok_meta.account + ' (' + data._grok_meta.email + ')]\\n\\n') : '';
        resBox.textContent = meta + text;
      } catch (err) {
        resBox.textContent = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}

export function createServer(router = null, port = 8000) {
  const routerInstance = router || new GrokPoolRouter();

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // GET / (Web Dashboard)
    if (req.method === 'GET' && pathname === '/') {
      const status = await routerInstance.getPoolStatus();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHtml(status, port));
      return;
    }

    // GET /v1/models
    if (req.method === 'GET' && (pathname === '/v1/models' || pathname === '/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          object: 'list',
          data: [
            { id: 'grok-3', object: 'model', created: 1740000000, owned_by: 'xai' },
            { id: 'grok-3-deepsearch', object: 'model', created: 1740000000, owned_by: 'xai' },
            { id: 'grok-3-think', object: 'model', created: 1740000000, owned_by: 'xai' },
            { id: 'grok-2', object: 'model', created: 1730000000, owned_by: 'xai' },
          ],
        })
      );
      return;
    }

    // GET /health or /pool
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/pool' || pathname === '/status')) {
      const status = await routerInstance.getPoolStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', pool: status }, null, 2));
      return;
    }

    // POST /v1/chat/completions
    if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        let reqData;
        try {
          reqData = JSON.parse(body);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Invalid JSON payload: ${err.message}` }));
          return;
        }

        const messages = reqData.messages || [];
        const model = reqData.model || 'grok-3';
        const stream = Boolean(reqData.stream);

        // Format prompt from messages
        const promptParts = [];
        for (const m of messages) {
          const role = m.role || 'user';
          let content = m.content || '';
          if (Array.isArray(content)) {
            content = content
              .map((c) => (typeof c === 'object' ? c.text || JSON.stringify(c) : String(c)))
              .join(' ');
          }
          if (role === 'system') {
            promptParts.push(`[System: ${content}]`);
          } else if (role === 'user') {
            promptParts.push(`User: ${content}`);
          } else if (role === 'assistant') {
            promptParts.push(`Assistant: ${content}`);
          }
        }

        const fullPrompt =
          promptParts.length > 1
            ? promptParts.join('\n\n')
            : (messages[messages.length - 1]?.content || '');

        const reqId = `chatcmpl-${crypto.randomBytes(8).toString('hex')}`;
        const created = Math.floor(Date.now() / 1000);

        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          try {
            const chatStream = routerInstance.executeChatStream(fullPrompt, { model });
            for await (const chunk of chatStream) {
              if (chunk.type === 'token') {
                const chunkObj = {
                  id: reqId,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: { content: chunk.text || '' },
                      finish_reason: null,
                    },
                  ],
                };
                res.write(`data: ${JSON.stringify(chunkObj)}\n\n`);
              } else if (chunk.type === 'done') {
                const finishObj = {
                  id: reqId,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: 'stop',
                    },
                  ],
                };
                res.write(`data: ${JSON.stringify(finishObj)}\n\n`);
                res.write('data: [DONE]\n\n');
              }
            }
          } catch (err) {
            const errObj = {
              id: reqId,
              object: 'chat.completion.chunk',
              error: err.message,
            };
            res.write(`data: ${JSON.stringify(errObj)}\n\n`);
            res.write('data: [DONE]\n\n');
          } finally {
            res.end();
          }
        } else {
          try {
            const result = await routerInstance.query(fullPrompt, { model });
            const respPayload = {
              id: reqId,
              object: 'chat.completion',
              created,
              model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: result.text || '',
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: Math.floor(fullPrompt.length / 4),
                completion_tokens: Math.floor((result.text || '').length / 4),
                total_tokens: Math.floor((fullPrompt.length + (result.text || '').length) / 4),
              },
              _grok_meta: {
                account: result.account,
                email: result.email,
                conversation_id: result.conversation_id,
              },
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(respPayload));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  return server;
}

export function runServer(host = '127.0.0.1', port = 8000, router = null) {
  const server = createServer(router, port);
  server.listen(port, host, () => {
    process.stdout.write(`\n🚀 Grok OpenAI-Compatible Proxy Server & Dashboard running at http://${host}:${port}/\n`);
    process.stdout.write(`   • Web Dashboard: http://${host}:${port}/\n`);
    process.stdout.write(`   • Completions:   http://${host}:${port}/v1/chat/completions\n`);
    process.stdout.write(`   • Models:        http://${host}:${port}/v1/models\n`);
    process.stdout.write(`   • Health Check:  http://${host}:${port}/health\n`);
    process.stdout.write(`Press Ctrl+C to terminate server.\n\n`);
  });
  return server;
}
