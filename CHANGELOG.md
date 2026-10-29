# Changelog

All notable changes to `grokbot` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-29

### Added
- **Visual Branding & Architecture Diagrams**: High-resolution SVG banner and topology diagram in `docs/` for enhanced GitHub presentation and developer clarity.
- **Parallel Batch Dispatch (`grokbot batch`)**: Concurrently dispatches prompt queues across healthy accounts in the pool with automatic rate-limit rebalancing.
- **Context & Specialized Knowledge Classifier**: Auto-detects prompt intent (coding, legal/filing, scrapers, deepsearch) and routes to optimal account profiles automatically.
- **Real-Time Web Dashboard (`grokbot serve`)**: Dark-mode web interface at `http://localhost:8000/` with live account cards, cooldown timers, request metrics, and interactive test playground.
- **Token Density Calculator (`grokbot tokens`)**: Calculates token counts and estimates savings for files or prompts against raw JSON baselines.

## [1.0.0] - 2026-10-29

### Added
- **Multi-Account Parallel Pool**: Dynamic pooling across multiple Grok accounts with round-robin, least-busy, and specialized knowledge/role routing.
- **Automatic Quota Failover**: Detects HTTP 429 and rate limits, places account in cooldown (15 min), and transparently routes to the next candidate with zero dropped requests.
- **3-Layer Conversation Exporter**: Unified exporter recovering transcripts from Desktop Persistent Slices (`sand-client-persistence`), Web REST conversations (`grok.com/rest/app-chat`), and gateway bots.
- **Token-Efficient Plaintext Export**: Formats exported transcripts into clean, readable Markdown or text, reducing token overhead by 70-80% compared to verbose JSON.
- **Local OpenAI-Compatible Server**: Built-in `node:http` proxy (`/v1/chat/completions`) enabling instant drop-in integration with Cursor, Claude Code, Codex, Aider, and OpenAI SDKs.
- **Skill Management & Pool Sync**: Prevents prompt token bloat (re-injecting 50k+ characters per turn) by installing skills into account-level libraries and syncing across pools.
- **System Doctor**: Built-in diagnostics for desktop storage, 1Password CLI session, token validity, and account connectivity.
- **Native Model Context Protocol (MCP)**: Built-in stdio MCP server for seamless agentic workflows.
- **Zero Runtime Dependencies**: Pure native Node.js implementation with no external database or npm dependencies.
