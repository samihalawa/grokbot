/**
 * Diagnostic Engine for Grok Bot.
 * Inspects desktop sessions, tokens, network connectivity,
 * and multi-account pool status with clear actionable recommendations.
 */

import os from 'node:os';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ConfigManager, getDesktopAppPaths } from './config.js';
import { GrokClient } from './client.js';

function commandExists(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

export async function runDoctor(configManager = null) {
  const cfg = configManager || new ConfigManager();
  const paths = getDesktopAppPaths();
  let issues = 0;

  console.log('='.repeat(80));
  console.log('🩺 GROKBOT ENVIRONMENT & HEALTH DIAGNOSTICS');
  console.log('='.repeat(80));

  // 1. Runtime
  console.log('\n[1] Runtime Environment:');
  console.log(`  • Node.js:  ${process.version} (${process.execPath})`);
  console.log(`  • Platform: ${os.platform()} ${os.release()} (${os.arch()})`);
  console.log(`  • Config:   ${cfg.configPath} (${fs.existsSync(cfg.configPath) ? 'Found' : 'Not created yet'})`);

  // 2. Desktop Storage
  console.log('\n[2] Grok Bot Desktop Storage:');
  if (fs.existsSync(paths.appData)) {
    console.log(`  ✅ Desktop App Data: ${paths.appData}`);
  } else {
    console.log(`  ℹ️  Desktop App Data: Not installed locally (Web/API mode active)`);
  }

  if (fs.existsSync(paths.persistence)) {
    try {
      const items = fs.readdirSync(paths.persistence).filter((f) => !f.startsWith('.'));
      console.log(`  ✅ Persistent Slices: ${items.length} slice(s) detected in ${paths.persistence}`);
    } catch (_) {
      console.log(`  ✅ Persistent Slices: Present`);
    }
  } else {
    console.log(`  ℹ️  Persistent Slices: None detected`);
  }

  // 3. 1Password Integration
  console.log('\n[3] Secret Management Tools:');
  const hasOp = commandExists('op');
  if (hasOp) {
    console.log('  ✅ 1Password CLI ("op"): Detected');
    try {
      execFileSync('op', ['whoami'], { stdio: 'ignore' });
      console.log('  ✅ 1Password Session: Signed in and active');
    } catch (_) {
      console.log('  ⚠️  1Password Session: Not signed in. Run "eval $(op signin)" if using dynamic tokens.');
    }
  } else {
    console.log('  ℹ️  1Password CLI ("op"): Not installed (Static tokens / env vars used)');
  }

  // 4. Multi-Account Pool Health
  console.log('\n[4] Multi-Account Pool & Live Connectivity:');
  if (cfg.accounts.size === 0) {
    console.log('  ❌ No accounts configured in pool!');
    console.log('     Quickstart: Set GROK_SSO in environment or run:');
    console.log('                 grokbot pool add --name my-account --sso <token>');
    issues += 1;
  } else {
    console.log(`  Pool Strategy: ${cfg.strategy} | Auto-Failover: ${cfg.autoFailover} | Accounts: ${cfg.accounts.size}`);

    let idx = 1;
    for (const [name, profile] of cfg.accounts.entries()) {
      const rolesStr = (profile.roles || []).join(', ');
      console.log(`\n  [${idx++}] Account: ${name} (Roles: [${rolesStr}])`);
      if (profile.email) console.log(`      Email: ${profile.email}`);

      try {
        const sso = cfg.resolveSso(name);
        const masked = sso ? `${sso.slice(0, 8)}...${sso.slice(-6)}` : 'empty';
        console.log(`      SSO Token: Resolved (${masked})`);

        const client = new GrokClient(sso);
        const auth = await client.checkAuth(8000);
        if (auth.authenticated) {
          console.log(`      ✅ Live Session: Authenticated (${auth.email || 'verified'})`);
        } else {
          console.log(`      ❌ Live Session: Expired or Invalid (HTTP 401/403)`);
          issues += 1;
        }
      } catch (err) {
        console.log(`      ❌ Live Session Error: ${err.message}`);
        issues += 1;
      }
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(80));
  if (issues === 0) {
    console.log('🎉 ALL SYSTEMS OPERATIONAL. Ready for parallel multi-account routing & export.');
  } else {
    console.log(`⚠️  ${issues} issue(s) detected. Review the items marked with ❌ above.`);
  }
  console.log('='.repeat(80));

  return issues;
}
