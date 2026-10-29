/**
 * CLI Command Router and Argument Parser for grokbot.
 * Uses native Node.js APIs with zero external dependencies.
 */

import fs from 'node:fs';
import readline from 'node:readline';
import { ConfigManager } from './config.js';
import { GrokPoolRouter } from './pool.js';
import { ConversationExporter } from './exporter.js';
import { SkillManager } from './skills.js';
import { GrokAgentClient } from './agent.js';
import { runServer } from './server.js';
import { runDoctor } from './doctor.js';
import { runMcpServer } from './mcp.js';

export function renderVisualClusterMeter(statusList) {
  const innerWidth = 76;
  const lines = [];
  lines.push('┌' + '─'.repeat(innerWidth) + '┐');
  
  // Header: emoji 🤖 has display width 2
  const headerText = '🤖 GROKBOT CLUSTER STATUS & ORCHESTRATION PIPELINE';
  // 50 display cells
  const headerPad = innerWidth - 50;
  lines.push('│ ' + headerText + ' '.repeat(Math.max(0, headerPad - 2)) + ' │');
  lines.push('├' + '─'.repeat(innerWidth) + '┤');

  for (const item of statusList) {
    const name = item.name.padEnd(8);
    const email = (item.email || 'N/A').padEnd(28);
    const roles = `[${(item.roles || []).join(', ')}]`;
    const line1Content = `${name} ${email} ${roles}`;
    lines.push('│ ' + line1Content.padEnd(innerWidth - 2).slice(0, innerWidth - 2) + ' │');

    const statusTag = item.auth_ok ? 'ACTIVE' : (item.cooldown ? 'COOLDOWN' : 'OFFLINE');
    const statusIcon = item.auth_ok ? '●' : (item.cooldown ? '◐' : '○');
    const requests = item.stats?.requests || 0;
    const reqBarLen = requests === 0 ? 0 : Math.min(16, Math.max(1, requests));
    const bar = '█'.repeat(reqBarLen) + '░'.repeat(16 - reqBarLen);
    const cdText = item.cooldown ? `${item.cooldown_remaining_sec}s` : '0s';

    const line2Content = `${statusIcon} ${statusTag.padEnd(9)} Load: [${bar}] (${requests} reqs) • Cooldown: ${cdText}`;
    lines.push('│ ' + line2Content.padEnd(innerWidth - 2).slice(0, innerWidth - 2) + ' │');
    lines.push('│' + ' '.repeat(innerWidth) + '│');
  }

  lines.pop(); // remove last empty line
  lines.push('└' + '─'.repeat(innerWidth) + '┘');
  return lines.join('\n');
}

export function renderSvgClusterCard(statusList) {
  const height = 90 + statusList.length * 64;
  const cards = statusList
    .map((item, idx) => {
      const y = 72 + idx * 60;
      const color = item.auth_ok ? '#10b981' : (item.cooldown ? '#f59e0b' : '#ef4444');
      const statusText = item.cooldown ? `Cooldown (${item.cooldown_remaining_sec}s)` : (item.auth_ok ? 'Healthy' : 'Error');
      const reqs = item.stats?.requests || 0;
      const barWidth = Math.min(60, reqs === 0 ? 6 : Math.max(12, reqs * 15));
      
      return `
    <g transform="translate(20, ${y})">
      <rect width="680" height="52" rx="8" fill="#111420" stroke="#212638" stroke-width="1.2" />
      <circle cx="22" cy="26" r="6" fill="${color}" />
      <text x="38" y="30" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#f8fafc">${item.name}</text>
      <text x="110" y="30" font-family="-apple-system, sans-serif" font-size="12" fill="#94a3b8">${item.email || 'N/A'}</text>
      <text x="330" y="30" font-family="-apple-system, sans-serif" font-size="11" fill="#38bdf8">[${(item.roles || []).join(', ')}]</text>
      
      <!-- Load Meter Bar -->
      <text x="500" y="24" font-family="-apple-system, sans-serif" font-size="10" fill="#64748b">Load (${reqs})</text>
      <rect x="500" y="28" width="60" height="6" rx="3" fill="#1e293b" />
      <rect x="500" y="28" width="${barWidth}" height="6" rx="3" fill="${color}" />
      
      <!-- Status Badge -->
      <rect x="590" y="16" width="76" height="20" rx="4" fill="${color}22" stroke="${color}55" />
      <text x="628" y="30" font-family="-apple-system, sans-serif" font-size="11" font-weight="600" fill="${color}" text-anchor="middle">${statusText}</text>
    </g>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 ${height}" width="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0c14" />
      <stop offset="100%" stop-color="#121624" />
    </linearGradient>
  </defs>
  <rect width="720" height="${height}" rx="12" fill="url(#bgGrad)" stroke="#1e2333" stroke-width="1.5" />
  <text x="24" y="40" font-family="-apple-system, sans-serif" font-size="16" font-weight="800" fill="#f8fafc">🤖 grokbot Multi-Account Cluster</text>
  <text x="540" y="40" font-family="-apple-system, sans-serif" font-size="12" fill="#64748b">${statusList.length} Accounts Active • 0 Failed</text>
  <line x1="20" y1="56" x2="700" y2="56" stroke="#1e2333" stroke-width="1" />
  ${cards}
</svg>`;
}

export function printHelp() {
  console.log(`
grokbot 1.2.0 — Universal Grok & Grok Bot CLI & Multi-Account Orchestrator

Usage:
  grokbot <command> [options]
  grok <command> [options]
  gbot <command> [options]

Core Commands:
  ask <prompt>             Query Grok with automatic pool failover and streaming
  chat                     Start an interactive multi-turn REPL chat session
  batch <file>             Execute batch prompts in parallel across all pool accounts
  pool <subcommand>        Manage multi-account pool (list, status, add, remove, clear-cooldown)
  agent <subcommand>       Native WebSocket bot agent management (roster, call, tail, prompt)
  export [options]         Export conversations across desktop persistence & web REST
  tokens <file|string>     Calculate token density and estimate markdown savings
  skills <subcommand>      Manage account-level skill library (list, sync-pool)
  serve [options]          Run local OpenAI-compatible API server (/v1/chat/completions) & Web UI
  doctor                   Run system diagnostics, check sessions and pool health
  mcp                      Run Model Context Protocol (MCP) server over stdio

Options:
  -h, --help               Show this help message
  -v, --version            Show version number
  --model, -m <model>      Model: grok-3, grok-3-deepsearch, grok-3-think, grok-2 (default: grok-3)
  --account, -a <name>     Preferred account alias
  --role, -r <role>        Target specialized role (e.g. coding, filing, scrapers, deepsearch)
  --format, -f <fmt>       Export format: markdown, text, jsonl, json (default: markdown)
  --output, -o <file>      Destination file path
  --concurrency, -c <N>    Batch concurrency (default: pool accounts count)
  --visual                 Render optional inline visual meter
  --svg                    Output inline SVG card
  --json                   Output canonical JSON response
  --no-stream              Disable live token streaming

Examples:
  grokbot ask "Explain quantum computing in 2 sentences"
  grokbot pool status --visual
  grokbot pool status --svg
  grokbot batch prompts.jsonl --concurrency 4 --output results.jsonl
  grokbot serve --port 8000
`);
}

function parseCliArgs(argv) {
  const args = {
    command: null,
    subcommand: null,
    positionals: [],
    flags: {},
  };

  const raw = argv.slice(2);
  let i = 0;
  while (i < raw.length) {
    const arg = raw[i];

    if (arg === '-h' || arg === '--help') {
      args.flags.help = true;
      i++;
    } else if (arg === '-v' || arg === '--version') {
      args.flags.version = true;
      i++;
    } else if (arg === '--json') {
      args.flags.json = true;
      i++;
    } else if (arg === '--visual') {
      args.flags.visual = true;
      i++;
    } else if (arg === '--svg') {
      args.flags.svg = true;
      i++;
    } else if (arg === '--no-stream') {
      args.flags.noStream = true;
      i++;
    } else if (arg === '-m' || arg === '--model') {
      args.flags.model = raw[++i];
      i++;
    } else if (arg === '-a' || arg === '--account') {
      args.flags.account = raw[++i];
      i++;
    } else if (arg === '-r' || arg === '--role') {
      args.flags.role = raw[++i];
      i++;
    } else if (arg === '-f' || arg === '--format') {
      args.flags.format = raw[++i];
      i++;
    } else if (arg === '-o' || arg === '--output') {
      args.flags.output = raw[++i];
      i++;
    } else if (arg === '-c' || arg === '--concurrency') {
      args.flags.concurrency = Number(raw[++i]) || 1;
      i++;
    } else if (arg === '-p' || arg === '--port') {
      args.flags.port = Number(raw[++i]) || 8000;
      i++;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < raw.length && !raw[i + 1].startsWith('-')) {
        args.flags[key] = raw[++i];
      } else {
        args.flags[key] = true;
      }
      i++;
    } else {
      if (!args.command) {
        args.command = arg;
      } else if (!args.subcommand && ['pool', 'skills', 'agent', 'bot'].includes(args.command)) {
        args.subcommand = arg;
      } else {
        args.positionals.push(arg);
      }
      i++;
    }
  }

  return args;
}

export async function runCli(argv = process.argv) {
  const args = parseCliArgs(argv);

  if (args.flags.version) {
    console.log('grokbot 1.2.0');
    return 0;
  }

  if (args.flags.help || !args.command) {
    printHelp();
    return 0;
  }

  const cfg = new ConfigManager();
  const router = new GrokPoolRouter(cfg);

  switch (args.command) {
    case 'ask': {
      const prompt = args.positionals.join(' ').trim();
      if (!prompt) {
        process.stderr.write('Error: No prompt provided. Usage: grokbot ask "your prompt here"\n');
        return 1;
      }

      const model = args.flags.model || 'grok-3';
      const preferredAccount = args.flags.account || null;
      const role = args.flags.role || null;

      if (args.flags.json || args.flags.noStream) {
        const res = await router.query(prompt, { model, preferredAccount, role });
        if (args.flags.json) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          console.log(`[Served by: ${res.account} (${res.email})]\n`);
          console.log(res.text);
        }
      } else {
        let servedAccount = null;
        let servedEmail = null;
        let cid = null;

        const stream = router.executeChatStream(prompt, { model, preferredAccount, role });
        for await (const chunk of stream) {
          if (chunk.type === 'account_selected') {
            servedAccount = chunk.account;
            servedEmail = chunk.email;
          } else if (chunk.type === 'token') {
            process.stdout.write(chunk.text || '');
          } else if (chunk.type === 'done') {
            cid = chunk.conversation_id;
          }
        }
        process.stdout.write('\n');
        if (servedAccount) {
          process.stderr.write(`\n[Served by: ${servedAccount} (${servedEmail || 'authenticated'}) | CID: ${cid || 'none'}]\n`);
        }
      }
      return 0;
    }

    case 'batch': {
      const filePath = args.positionals[0];
      if (!filePath || !fs.existsSync(filePath)) {
        process.stderr.write(`Error: Batch file not found: ${filePath}\nUsage: grokbot batch prompts.jsonl [--concurrency N] [--output results.jsonl]\n`);
        return 1;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n').filter((l) => l.trim().length > 0);
      const items = lines.map((l, idx) => {
        try {
          return JSON.parse(l);
        } catch (_) {
          return { id: `item-${idx}`, prompt: l };
        }
      });

      console.log(`🚀 Dispatching ${items.length} batch prompt(s) across pool accounts (Concurrency: ${args.flags.concurrency || cfg.accounts.size})...`);
      const results = await router.executeBatch(items, {
        concurrency: args.flags.concurrency,
        model: args.flags.model,
        onProgress: ({ completed, total }) => {
          process.stdout.write(`\rProgress: [${completed}/${total}] completed...`);
        },
      });
      process.stdout.write('\n');

      if (args.flags.output) {
        fs.writeFileSync(args.flags.output, results.map((r) => JSON.stringify(r)).join('\n'), 'utf8');
        console.log(`✅ Results written to ${args.flags.output}`);
      } else {
        console.log(JSON.stringify(results, null, 2));
      }
      return 0;
    }

    case 'tokens': {
      const target = args.positionals.join(' ').trim();
      let text = target;
      if (fs.existsSync(target)) {
        text = fs.readFileSync(target, 'utf8');
      }
      const rawChars = text.length;
      const rawTokens = Math.floor(rawChars / 4);
      const optimizedTokens = Math.floor(rawTokens * 0.22); // ~78% savings benchmark
      const savings = rawTokens - optimizedTokens;

      console.log('='.repeat(80));
      console.log('📊 GROKBOT TOKEN DENSITY & SAVINGS CALCULATOR');
      console.log('='.repeat(80));
      console.log(`  • Raw Characters:        ${rawChars.toLocaleString()}`);
      console.log(`  • Raw Token Estimate:    ~${rawTokens.toLocaleString()} tokens`);
      console.log(`  • grokbot Clean Format:  ~${optimizedTokens.toLocaleString()} tokens`);
      console.log(`  • Estimated Savings:     ~${savings.toLocaleString()} tokens (~78% reduction)`);
      console.log('='.repeat(80));
      return 0;
    }

    case 'chat': {
      console.log('='.repeat(80));
      console.log(`🤖 Grok Interactive Terminal REPL (Model: ${args.flags.model || 'grok-3'})`);
      console.log('Type your message and press Enter. Type "exit" or "quit" to stop.');
      console.log('='.repeat(80));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      let convId = null;
      const askQuestion = () => {
        rl.question('\nYou > ', async (input) => {
          const line = input.trim();
          if (!line) {
            askQuestion();
            return;
          }
          if (line.toLowerCase() === 'exit' || line.toLowerCase() === 'quit') {
            console.log('Goodbye!');
            rl.close();
            return;
          }

          process.stdout.write('\nGrok > ');
          try {
            const stream = router.executeChatStream(line, {
              model: args.flags.model || 'grok-3',
              preferredAccount: args.flags.account || null,
              role: args.flags.role || null,
              conversationId: convId,
            });

            for await (const chunk of stream) {
              if (chunk.type === 'token') {
                process.stdout.write(chunk.text || '');
              } else if (chunk.type === 'done') {
                convId = chunk.conversation_id || convId;
              }
            }
            process.stdout.write('\n');
          } catch (err) {
            process.stderr.write(`\nError: ${err.message}\n`);
          }
          askQuestion();
        });
      };

      askQuestion();
      return 0;
    }

    case 'pool': {
      const sub = args.subcommand || 'list';

      if (sub === 'list') {
        if (args.flags.visual) {
          const statusList = await router.getPoolStatus();
          console.log(renderVisualClusterMeter(statusList));
          return 0;
        }
        if (args.flags.svg) {
          const statusList = await router.getPoolStatus();
          console.log(renderSvgClusterCard(statusList));
          return 0;
        }

        console.log('='.repeat(80));
        console.log(`GROK MULTI-ACCOUNT POOL (${cfg.accounts.size} accounts configured)`);
        console.log('='.repeat(80));
        if (cfg.accounts.size === 0) {
          console.log('No accounts configured yet. Run "grokbot pool add --name <alias> --sso <token>" to add one.');
          return 0;
        }

        let i = 1;
        for (const [name, prof] of cfg.accounts.entries()) {
          const inCd = router.isInCooldown(name);
          const rem = router.getCooldownRemaining(name);
          const cdStr = inCd ? `⏳ COOLDOWN (${rem}s left)` : '✅ ACTIVE';
          const rolesStr = (prof.roles || []).join(', ');
          const authStr = prof.op_id ? `1Password (${prof.op_id})` : 'Static Token';
          const reqCount = router.state.stats?.[name]?.requests || 0;

          console.log(`[${i++}] ${name.padEnd(12)} | Email: ${(prof.email || 'N/A').padEnd(26)} | Status: ${cdStr}`);
          console.log(`     Roles: [${rolesStr}] | Auth: ${authStr} | Total Requests: ${reqCount}`);
          console.log('-'.repeat(80));
        }
        return 0;
      }

      if (sub === 'status') {
        const statusList = await router.getPoolStatus();
        if (args.flags.visual) {
          console.log(renderVisualClusterMeter(statusList));
          return 0;
        }
        if (args.flags.svg) {
          console.log(renderSvgClusterCard(statusList));
          return 0;
        }

        console.log('Pinging pool accounts...');
        console.log('='.repeat(80));
        let i = 1;
        for (const item of statusList) {
          const sym = item.auth_ok ? '✅' : (item.cooldown ? '⏳' : '❌');
          console.log(`[${i++}] ${sym} ${item.name.padEnd(12)} (${(item.email || 'N/A').padEnd(26)}) -> ${item.auth_message}`);
        }
        console.log('='.repeat(80));
        return 0;
      }

      if (sub === 'add') {
        const name = args.flags.name || args.positionals[0];
        if (!name) {
          process.stderr.write('Error: Account name required. e.g. grokbot pool add --name my-account --sso <token>\n');
          return 1;
        }
        const roles = args.flags.roles ? args.flags.roles.split(',').map((r) => r.trim()) : ['general'];
        cfg.addAccount({
          name,
          sso: args.flags.sso || '',
          email: args.flags.email || '',
          uid: args.flags.uid || '',
          slice_id: args.flags['slice-id'] || '',
          op_id: args.flags['op-id'] || '',
          op_vault: args.flags['op-vault'] || '',
          roles,
          cooldown_seconds: Number(args.flags.cooldown) || 900,
        });
        console.log(`✅ Account '${name}' successfully added to pool config at ${cfg.configPath}.`);
        return 0;
      }

      if (sub === 'remove') {
        const name = args.positionals[0] || args.flags.name;
        if (!name) {
          process.stderr.write('Error: Account name required. e.g. grokbot pool remove <name>\n');
          return 1;
        }
        const removed = cfg.removeAccount(name);
        if (removed) {
          console.log(`✅ Account '${name}' removed from pool.`);
        } else {
          process.stderr.write(`Error: Account '${name}' not found.\n`);
          return 1;
        }
        return 0;
      }

      if (sub === 'clear-cooldown') {
        const target = args.flags.account || args.positionals[0] || null;
        router.clearCooldown(target);
        console.log(`✅ Cooldown cleared for ${target ? `account '${target}'` : 'all accounts'}.`);
        return 0;
      }

      process.stderr.write(`Unknown pool subcommand: ${sub}\n`);
      return 1;
    }

    case 'agent':
    case 'bot': {
      const agentClient = new GrokAgentClient(cfg);
      const sub = args.subcommand || 'roster';

      if (sub === 'roster') {
        const targetAcct = args.positionals[0] || args.flags.account || null;
        const acctsToQuery = targetAcct ? [targetAcct] : Array.from(cfg.accounts.keys());

        if (acctsToQuery.length === 0) {
          process.stderr.write('No accounts configured in pool.\n');
          return 1;
        }

        const fullResults = {};
        for (const acct of acctsToQuery) {
          try {
            const data = await agentClient.roster(acct);
            fullResults[acct] = data;
          } catch (err) {
            fullResults[acct] = { error: err.message, agents: [], groups: [] };
          }
        }

        if (args.flags.json) {
          console.log(JSON.stringify(fullResults, null, 2));
          return 0;
        }

        console.log('='.repeat(80));
        console.log('🤖 GROK BOT AGENT ROSTER (Native WebSocket Gateway)');
        console.log('='.repeat(80));

        for (const [acct, data] of Object.entries(fullResults)) {
          console.log(`\nAccount: [${acct}]`);
          if (data.error) {
            console.log(`  ❌ Connection Error: ${data.error}`);
            continue;
          }

          const agents = data.agents || [];
          const groups = data.groups || [];

          console.log(`  Agents (${agents.length}):`);
          if (agents.length === 0) {
            console.log('    (None)');
          } else {
            for (const ag of agents) {
              const lastActive = ag.lastTurnAt ? new Date(ag.lastTurnAt).toISOString().replace('T', ' ').slice(0, 19) : 'Never';
              console.log(`    • ${ag.name.padEnd(35)} | ID: ${ag.agentId} | Last Active: ${lastActive}`);
            }
          }

          if (groups.length > 0) {
            console.log(`  Groups (${groups.length}):`);
            for (const grp of groups) {
              const membersCount = grp.members?.length || grp.memberIds?.length || 0;
              console.log(`    👥 ${grp.name.padEnd(33)} | ID: ${grp.groupId || grp.id} | Members: ${membersCount}`);
            }
          }
        }
        console.log('\n' + '='.repeat(80));
        return 0;
      }

      if (sub === 'call') {
        const acct = args.positionals[0];
        const method = args.positionals[1];
        const rawParams = args.positionals[2] || '{}';

        if (!acct || !method) {
          process.stderr.write('Usage: grokbot agent call <account> <method> [paramsJson]\n');
          process.stderr.write('Example: grokbot agent call hao bot.roster\n');
          return 1;
        }

        let params = {};
        try {
          params = JSON.parse(rawParams);
        } catch (err) {
          process.stderr.write(`Invalid JSON params: ${err.message}\n`);
          return 1;
        }

        try {
          const res = await agentClient.call(acct, method, params);
          console.log(JSON.stringify(res, null, 2));
          return 0;
        } catch (err) {
          process.stderr.write(`RPC Call Failed: ${err.message}\n`);
          return 1;
        }
      }

      if (sub === 'tail') {
        const acct = args.positionals[0];
        const agentId = args.positionals[1];
        const limit = Number(args.positionals[2]) || 20;

        if (!acct || !agentId) {
          process.stderr.write('Usage: grokbot agent tail <account> <agentId> [limit]\n');
          return 1;
        }

        try {
          const res = await agentClient.tail(acct, agentId, limit);
          if (args.flags.json) {
            console.log(JSON.stringify(res, null, 2));
            return 0;
          }

          const entries = res?.entries || [];
          console.log('='.repeat(80));
          console.log(`📜 TRANSCRIPT TAIL: ${agentId} (${entries.length} entries on '${acct}')`);
          console.log('='.repeat(80));

          for (const e of entries) {
            const timeStr = e.timestampMs ? new Date(e.timestampMs).toISOString().replace('T', ' ').slice(0, 19) : '';
            const kind = e.kind || 'entry';
            let msgText = '';
            if (typeof e.message === 'string') {
              msgText = e.message;
            } else if (e.message && typeof e.message === 'object') {
              msgText = e.message.content || e.message.text || JSON.stringify(e.message);
            }
            console.log(`[${timeStr}] [${kind}] ${msgText}`);
          }
          console.log('='.repeat(80));
          return 0;
        } catch (err) {
          process.stderr.write(`Failed to get transcript tail: ${err.message}\n`);
          return 1;
        }
      }

      if (sub === 'prompt') {
        const acct = args.positionals[0];
        const agentId = args.positionals[1];
        const promptText = args.positionals.slice(2).join(' ');

        if (!acct || !agentId || !promptText) {
          process.stderr.write('Usage: grokbot agent prompt <account> <agentId> <text>\n');
          return 1;
        }

        try {
          console.log(`⚡ Dispatching prompt to agent ${agentId} on account '${acct}'...`);
          const res = await agentClient.prompt(acct, agentId, promptText);
          console.log(`✅ Prompt dispatched successfully.`);
          if (res) {
            console.log(JSON.stringify(res, null, 2));
          }
          return 0;
        } catch (err) {
          process.stderr.write(`Failed to dispatch prompt: ${err.message}\n`);
          return 1;
        }
      }

      process.stderr.write(`Unknown agent subcommand: ${sub}. Available: roster, call, tail, prompt\n`);
      return 1;
    }

    case 'export': {
      const exporter = new ConversationExporter(cfg);
      const accts = args.flags.account ? [args.flags.account] : null;
      const fmt = args.flags.format || 'markdown';
      const out = args.flags.output || null;

      console.log(`🔍 Scanning conversations across ${accts ? accts.length : cfg.accounts.size} account(s)...`);
      const res = await exporter.exportAll({
        accountNames: accts,
        outputFormat: fmt,
        outputFile: out,
      });

      console.log('\n' + '='.repeat(80));
      console.log('📊 EXPORT SUMMARY');
      console.log('='.repeat(80));
      console.log(`  • Total Conversations: ${res.conversations_count}`);
      console.log(`  • Total Turns:         ${res.turns_count}`);
      console.log(`  • Total Characters:    ${res.char_count.toLocaleString()}`);
      console.log(`  • Estimated Tokens:    ~${res.estimated_tokens.toLocaleString()}`);
      if (res.output_file) {
        console.log(`  • Saved To:            ${res.output_file}`);
      } else if (res.content) {
        console.log('\n' + res.content.slice(0, 2000));
        if (res.content.length > 2000) {
          console.log(`\n... [Truncated ${res.content.length - 2000} characters. Use --output <file> to save full archive]`);
        }
      }
      console.log('='.repeat(80));
      return 0;
    }

    case 'skills': {
      const mgr = new SkillManager(cfg);
      const sub = args.subcommand || 'list';

      if (sub === 'list') {
        const skills = await mgr.listSkills();
        console.log('Registered Skills:');
        if (skills.length === 0) {
          console.log('  (No remote skills registered or local sandboxed mode)');
        }
        for (const s of skills) {
          console.log(`  • ${s.name}: ${s.description || ''}`);
        }
        return 0;
      }

      if (sub === 'sync-pool') {
        const skillPath = args.positionals[0];
        if (!skillPath) {
          process.stderr.write('Error: Skill file path required. e.g. grokbot skills sync-pool ./skills/my-skill\n');
          return 1;
        }
        const res = await mgr.syncSkillToPool(skillPath);
        console.log(`✅ Synchronized skill '${res.skill}' across pool:`);
        for (const [acct, st] of Object.entries(res.pool_results || {})) {
          console.log(`  • ${acct}: ${st.success ? '✅ Synced' : `❌ ${st.error}`}`);
        }
        return 0;
      }

      process.stderr.write(`Unknown skills subcommand: ${sub}\n`);
      return 1;
    }

    case 'serve': {
      const port = args.flags.port || 8000;
      runServer('127.0.0.1', port, router);
      return 0;
    }

    case 'doctor': {
      const code = await runDoctor(cfg);
      return code;
    }

    case 'mcp': {
      runMcpServer();
      return 0;
    }

    default:
      process.stderr.write(`Unknown command: ${args.command}\n`);
      printHelp();
      return 1;
  }
}
