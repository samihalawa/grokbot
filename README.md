# grokbot 🤖

[![npm version](https://img.shields.io/npm/v/grokbot.svg)](https://www.npmjs.com/package/grokbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-blue.svg)](package.json)

> **Universal Grok & Grok Bot CLI & Multi-Account Orchestrator**: parallel quota pooling, automatic HTTP 429 failover, specialized knowledge routing, 3-layer conversation export, and local OpenAI proxy. **Zero external dependencies. No external databases.**

---

## ⚡ Why Grokbot?

Existing tools either only support a single desktop session, fail immediately when hitting hourly/weekly rate limits (HTTP 429), miss historical web conversations, or re-inject 50,000+ characters of prompt instructions on every turn.

**grokbot** solves these structural bottlenecks:

| Capability | Official Web / Apps | ScriptedAlchemy `gbot` | **`grokbot`** |
| :--- | :--- | :--- | :--- |
| **Runtime Dependencies** | Heavy / Electron | Node + gateway | **0 Dependencies (Pure Node.js)** |
| **Database Requirement** | Cloud / Sand | App sand store | **Zero external databases** |
| **Multi-Account Pooling** | ❌ Manual re-login | ❌ Single session | ✅ **Round-Robin & Least-Busy** |
| **Quota Failover (429)** | ❌ Blocked | ❌ Error exit | ✅ **Automatic transparent retry** |
| **Specialized Knowledge Routing** | ❌ None | ❌ None | ✅ **Role-based (`coding`, `legal`, etc.)** |
| **Conversation Recovery** | Web only or app only | Roster box only | ✅ **All 3 Layers (Local + Web + Roster)** |
| **Export Token Efficiency** | ❌ None | ❌ Verbose JSON | ✅ **Clean Markdown (70-80% token savings)** |
| **Local OpenAI Proxy** | ❌ None | ❌ None | ✅ **`/v1/chat/completions` (SSE stream)** |
| **Secret Management** | Browser storage | Keyring | ✅ **1Password CLI (`op`) + Env + Config** |
| **Agent / MCP Protocol** | ❌ None | ❌ Manual socket | ✅ **Built-in stdio MCP server** |

---

## 🚀 Quickstart

### 1. Install

```bash
# Global install
npm install -g grokbot

# Or run instantly via npx
npx grokbot --help
```

### 2. Single-Account Use (Immediate)

Export your Grok SSO cookie (or set it in your environment):
```bash
export GROK_SSO="your-sso-cookie-value"

# Ask Grok directly with streaming markdown
grokbot ask "Explain the CAP theorem in 2 concise paragraphs"
```

Or start an interactive terminal chat:
```bash
grokbot chat --model grok-3
```

---

## 🔄 Multi-Account Parallel Pooling & Failover

Running heavy research, deep search, or agent swarms burns through Grok limits quickly. `grokbot` pools multiple accounts into a unified high-throughput cluster.

### Adding Accounts to Pool

```bash
# Add accounts with static tokens or 1Password dynamic references
grokbot pool add --name primary --sso "<token>" --roles general,coding
grokbot pool add --name researcher --sso "<token>" --roles deepsearch,research
grokbot pool add --name legal --op-id "ddlrfagpds5wuglau5kei3na2m" --op-vault "Personal" --roles filing,legal

# Inspect pool health
grokbot pool list
grokbot pool status
```

### How Automatic Quota Failover Works

```
                        ┌───────────────────────────────┐
                        │   User / Agent Request        │
                        └──────────────┬────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │   grokbot Pool Router          │
                       │   (Round-robin / Role filter)  │
                       └──────────────┬─────────────────┘
                                      │
              ┌───────────────────────┴────────────────────────┐
              ▼                                                ▼
     [Account: primary]                               [Account: secondary]
    HTTP 429 Quota Exhausted!                                  │
              │                                                │
   ⚠️ Cooldown Activated (15m)                                 │
   Seamless Instant Failover ─────────────────────────────────►│
                                                      HTTP 200 Stream Done ✅
```

1. **Role Matching**: When a request arrives with `--role coding`, it routes to accounts tagged with `coding`.
2. **Quota Exhaustion Detection**: If Grok returns HTTP 429 or rate-limit warnings, `grokbot` marks that account in cooldown (default: 15 minutes).
3. **Zero Dropped Requests**: The request is instantly and transparently re-routed to the next healthy account in the pool.

---

## 📦 3-Layer Conversation Recovery & Token Optimization

Grok stores conversational data across 3 separate layers:
1. **Local Desktop Persistent Slices** (`sand-client-persistence`) — offline agent turns and replica slices.
2. **Grok Web App REST API** (`grok.com/rest/app-chat`) — user web threads and turn trees.
3. **Gateway & Agent Box Transcripts** — live cloud container bot turns.

`grokbot export` queries all three layers, deduplicates threads, and strips redundant JSON schema boilerplate:

```bash
# Export all accounts to token-efficient Markdown
grokbot export --format markdown --output ~/grok_archive.md

# Export as JSONL for programmatic pipelines
grokbot export --format jsonl --output ~/grok_archive.jsonl
```

### Token Savings Benchmark
- **Raw JSON dump:** ~2.21M tokens (8.85 MB)
- **Token-Efficient Markdown:** ~480k tokens (1.92 MB)
- **Savings:** **~78% fewer tokens** when re-injected into LLM context windows!

---

## 🌐 Local OpenAI-Compatible Server (`grokbot serve`)

Turn your Grok pool into a local standard OpenAI-compatible API server:

```bash
grokbot serve --port 8000
```

Any tool, IDE, or agent can now connect with zero code changes:

### In Cursor / VS Code / Claude Code:
- **Base URL:** `http://127.0.0.1:8000/v1`
- **API Key:** `any-string` (handled by pool)
- **Model:** `grok-3`, `grok-3-deepsearch`, or `grok-3-think`

### In Python / Node.js:
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://127.0.0.1:8000/v1',
  apiKey: 'ignored',
});

const completion = await openai.chat.completions.create({
  model: 'grok-3',
  messages: [{ role: 'user', content: 'Design a high-throughput event bus in Go' }],
  stream: true,
});

for await (const chunk of completion) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

---

## 🛠️ Skill Management & Eliminating Token Bloat

Agent prompts often re-inject 50,000+ characters of instructions on every single turn. `grokbot` installs skills at the account level so every bot has native access without burning prompt tokens:

```bash
# Synchronize a skill across all pool accounts
grokbot skills sync-pool ./skills/code-reviewer
```

---

## 🩺 System Doctor

Run comprehensive diagnostics to verify local desktop install, persistence slices, 1Password CLI status, and live session tokens:

```bash
grokbot doctor
```

Output:
```text
================================================================================
🩺 GROKBOT ENVIRONMENT & HEALTH DIAGNOSTICS
================================================================================

[1] Runtime Environment:
  • Node.js:  v22.x
  • Platform: darwin arm64
  • Config:   ~/.config/grok-bot/config.json (Found)

[2] Grok Bot Desktop Storage:
  ✅ Desktop App Data: ~/Library/Application Support/Grok Bot
  ✅ Persistent Slices: 4 slices detected

[3] Secret Management Tools:
  ✅ 1Password CLI ("op"): Detected
  ✅ 1Password Session: Signed in and active

[4] Multi-Account Pool & Live Connectivity:
  Pool Strategy: round-robin | Auto-Failover: true | Accounts: 4
  [1] Account: hao (Roles: [general, filing]) -> ✅ Authenticated
  [2] Account: sami (Roles: [general, coding]) -> ✅ Authenticated
  [3] Account: h999 (Roles: [filing, regional]) -> ✅ Authenticated
  [4] Account: oulang (Roles: [scrapers, notifications]) -> ✅ Authenticated
================================================================================
🎉 ALL SYSTEMS OPERATIONAL. Ready for parallel multi-account routing & export.
================================================================================
```

---

## 🔌 Model Context Protocol (MCP)

Run `grokbot` as a native MCP server over stdio for Claude Code, Cursor, and Codex:

```json
{
  "mcpServers": {
    "grokbot": {
      "command": "npx",
      "args": ["grokbot", "mcp"]
    }
  }
}
```

---

## 📖 CLI Command Reference

```text
grokbot <command> [options]

Commands:
  ask <prompt>             Query Grok with automatic pool failover and streaming
  chat                     Start an interactive multi-turn REPL chat session
  pool list                Show all pool accounts and live cooldown status
  pool status              Ping all accounts and report auth states
  pool add                 Register an account profile in the pool
  pool remove <name>       Remove an account profile from the pool
  pool clear-cooldown      Reset cooldown timers manually
  export                   Extract conversations from all 3 layers
  skills list              List account-level skills
  skills sync-pool <path>  Sync a SKILL.md across all pool accounts
  serve                    Start local OpenAI-compatible API proxy server
  doctor                   Run full system diagnostics and connectivity check
  mcp                      Start Model Context Protocol stdio server

Options:
  --model, -m <model>      grok-3, grok-3-deepsearch, grok-3-think, grok-2 (default: grok-3)
  --account, -a <name>     Preferred account alias
  --role, -r <role>        Target specialized role (e.g. coding, general, filing)
  --format, -f <fmt>       markdown, text, jsonl, json (default: markdown)
  --output, -o <file>      Export destination file path
  --json                   Output canonical JSON response
  --no-stream              Disable live token streaming
  --port, -p <port>        Server port (default: 8000)
```

---

## 📄 License

MIT © [Sami Halawa](https://samihalawa.com)
