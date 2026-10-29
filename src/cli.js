/**
 * CLI Command Router and Argument Parser for grokbot.
 * Uses native Node.js APIs with zero external dependencies.
 */

import readline from 'node:readline';
import { ConfigManager } from './config.js';
import { GrokPoolRouter } from './pool.js';
import { ConversationExporter } from './exporter.js';
import { SkillManager } from './skills.js';
import { runServer } from './server.js';
import { runDoctor } from './doctor.js';
import { runMcpServer } from './mcp.js';

export function printHelp() {
  console.log(`
grokbot 1.0.0 — Universal Grok & Grok Bot CLI & Multi-Account Orchestrator

Usage:
  grokbot <command> [options]
  grok <command> [options]
  gbot <command> [options]

Commands:
  ask <prompt>             Query Grok with automatic pool failover and streaming
  chat                     Start an interactive multi-turn REPL chat session
  pool <subcommand>        Manage multi-account pool (list, status, add, remove, clear-cooldown)
  export [options]         Export conversations across desktop persistence & web REST
  skills <subcommand>      Manage account-level skill library (list, sync-pool)
  serve [options]          Run local OpenAI-compatible API server (/v1/chat/completions)
  doctor                   Run system diagnostics, check sessions and pool health
  mcp                      Run Model Context Protocol (MCP) server over stdio

Options:
  -h, --help               Show this help message
  -v, --version            Show version number
  --model, -m <model>      Model: grok-3, grok-3-deepsearch, grok-3-think, grok-2 (default: grok-3)
  --account, -a <name>     Preferred account alias
  --role, -r <role>        Target specialized role (e.g. coding, general, legal)
  --format, -f <fmt>       Export format: markdown, text, jsonl, json (default: markdown)
  --output, -o <file>      Destination file path
  --json                   Output canonical JSON response
  --no-stream              Disable live token streaming

Examples:
  grokbot ask "Explain quantum computing in 2 sentences"
  grokbot ask "Write a fast matrix multiplication" --role coding
  grokbot pool list
  grokbot pool status
  grokbot export --format markdown --output ~/grok_archive.md
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
      } else if (!args.subcommand && ['pool', 'skills'].includes(args.command)) {
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
    console.log('grokbot 1.0.0');
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
        console.log('Pinging pool accounts...');
        const statusList = await router.getPoolStatus();
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
