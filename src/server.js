/**
 * OpenAI-Compatible Local API Proxy Server.
 * Pure native node:http implementation with zero external dependencies.
 * Allows any AI agent or IDE (Cursor, Claude Code, Codex, Aider, LangChain, LiteLLM)
 * to connect to Grok with automatic multi-account pooling and quota failover.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { GrokPoolRouter } from './pool.js';

export function createServer(router = null) {
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
  const server = createServer(router);
  server.listen(port, host, () => {
    process.stdout.write(`🚀 Grok OpenAI-Compatible Proxy Server running on http://${host}:${port}/v1\n`);
    process.stdout.write(`   - Completions: http://${host}:${port}/v1/chat/completions\n`);
    process.stdout.write(`   - Models:      http://${host}:${port}/v1/models\n`);
    process.stdout.write(`   - Health:      http://${host}:${port}/health\n`);
    process.stdout.write(`Press Ctrl+C to stop.\n`);
  });
  return server;
}
