#!/usr/bin/env node

import { runCli } from '../src/cli.js';

runCli(process.argv).then((code) => {
  if (typeof code === 'number' && code !== 0) {
    process.exit(code);
  }
}).catch((err) => {
  process.stderr.write(`Fatal Error: ${err.message}\n`);
  process.exit(1);
});
