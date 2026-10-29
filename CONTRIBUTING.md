# Contributing to Grokbot

Thank you for your interest in contributing to `grokbot`!

## Philosophy
- **Zero Runtime Dependencies**: Keep the core lightweight, robust, and fast using native Node.js APIs.
- **Universal Utility**: Make the tool immediately useful for single-account terminal users, while offering enterprise-grade parallel multi-account pooling for power users and AI agent swarms.
- **Documentation Integrity**: All features and flags must be reflected in `--help` and `README.md`.

## Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/samihalawa/grokbot.git
   cd grokbot
   ```
2. Run tests:
   ```bash
   npm test
   ```
3. Test CLI locally:
   ```bash
   node ./bin/grok.mjs --help
   ```

## Pull Request Guidelines
- Ensure all tests pass (`npm test`).
- Add tests for new capabilities in `tests/`.
- Maintain clean, readable code formatting.
