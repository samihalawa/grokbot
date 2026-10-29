/**
 * Model Context Protocol (MCP) Server for Grok Bot.
 * Standard JSON-RPC 2.0 stdio server enabling Claude Code, Cursor,
 * and Codex to use Grok capabilities directly as native tools.
 */

import readline from 'node:readline';
import { ConfigManager } from './config.js';
import { GrokPoolRouter } from './pool.js';
import { ConversationExporter } from './exporter.js';

const TOOLS = [
  {
    name: 'grok_ask',
    description: 'Query Grok with automatic multi-account pooling and quota failover.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt or instruction to submit to Grok.' },
        model: {
          type: 'string',
          enum: ['grok-3', 'grok-3-deepsearch', 'grok-3-think', 'grok-2'],
          default: 'grok-3',
          description: 'Grok model name.',
        },
        role: { type: 'string', description: 'Target specialized account role (e.g. coding, legal).' },
        account: { type: 'string', description: 'Specific account alias in pool.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'grok_pool_status',
    description: 'Check live health, active cooldowns, and request counts for all pool accounts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'grok_export',
    description: 'Export Grok conversations into a clean, token-efficient plain text or markdown archive.',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', description: 'Account name (omit for all accounts).' },
        format: { type: 'string', enum: ['markdown', 'text', 'jsonl', 'json'], default: 'markdown' },
        output_file: { type: 'string', description: 'Optional destination file path.' },
      },
    },
  },
];

export function runMcpServer() {
  const cfg = new ConfigManager();
  const router = new GrokPoolRouter(cfg);
  const exporter = new ConversationExporter(cfg);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req;
    try {
      req = JSON.parse(trimmed);
    } catch (_) {
      return;
    }

    const { id, method, params = {} } = req;

    if (method === 'initialize') {
      const res = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'grokbot', version: '1.0.0' },
      };
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: res }) + '\n');
    } else if (method === 'notifications/initialized') {
      // no response needed
    } else if (method === 'tools/list') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: TOOLS } }) + '\n');
    } else if (method === 'tools/call') {
      const { name, arguments: args = {} } = params;

      try {
        if (name === 'grok_ask') {
          const res = await router.query(args.prompt, {
            model: args.model || 'grok-3',
            preferredAccount: args.account,
            role: args.role,
          });
          const text = `[Served by: ${res.account} (${res.email})]\n\n${res.text}`;
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: { content: [{ type: 'text', text }] },
            }) + '\n'
          );
        } else if (name === 'grok_pool_status') {
          const status = await router.getPoolStatus();
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] },
            }) + '\n'
          );
        } else if (name === 'grok_export') {
          const accts = args.account ? [args.account] : null;
          const expRes = await exporter.exportAll({
            accountNames: accts,
            outputFormat: args.format || 'markdown',
            outputFile: args.output_file,
          });
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: { content: [{ type: 'text', text: JSON.stringify(expRes, null, 2) }] },
            }) + '\n'
          );
        } else {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Tool ${name} not found` },
            }) + '\n'
          );
        }
      } catch (err) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: { isError: true, content: [{ type: 'text', text: err.message }] },
          }) + '\n'
        );
      }
    } else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        }) + '\n'
      );
    }
  });
}
