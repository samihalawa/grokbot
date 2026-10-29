/**
 * Example: Using grokbot programmatically in Node.js
 */

import { GrokPoolRouter } from '../src/pool.js';
import { ConfigManager } from '../src/config.js';

async function main() {
  const cfg = new ConfigManager();
  const router = new GrokPoolRouter(cfg);

  console.log('Sending query to Grok multi-account pool...');
  try {
    const response = await router.query('What are the key trade-offs between Paxos and Raft consensus algorithms?', {
      model: 'grok-3',
      role: 'coding', // automatically picks specialized coding accounts
    });

    console.log(`\nServed by: ${response.account} (${response.email})`);
    console.log(`Model:     ${response.model}\n`);
    console.log(response.text);
  } catch (err) {
    console.error('Dispatch failed:', err.message);
  }
}

main();
