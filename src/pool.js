/**
 * Multi-Account Parallel Orchestrator & Automatic Failover Engine.
 * Supports round-robin, least-busy, specialized knowledge/role routing,
 * automatic context detection, cooldown tracking, and parallel batch dispatch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ConfigManager, STATE_FILE } from './config.js';
import { GrokClient, RateLimitError, AuthError } from './client.js';

export function detectSpecializedRole(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return null;
  const p = prompt.toLowerCase();

  // 1. Coding & Technical
  if (
    p.includes('def ') ||
    p.includes('function') ||
    p.includes('const ') ||
    p.includes('class ') ||
    p.includes('import ') ||
    p.includes('lambda') ||
    p.includes('algorithm') ||
    p.includes('refactor') ||
    p.includes('bug') ||
    p.includes('typescript') ||
    p.includes('javascript') ||
    p.includes('python') ||
    p.includes('rust') ||
    p.includes('sql') ||
    p.includes('git')
  ) {
    return 'coding';
  }

  // 2. Legal, Public Tenders & Procurement
  if (
    p.includes('licitaci') ||
    p.includes('pliego') ||
    p.includes('expediente') ||
    p.includes('sobre') ||
    p.includes('cláusula') ||
    p.includes('contrato') ||
    p.includes('tender') ||
    p.includes('procurement') ||
    p.includes('borme') ||
    p.includes('boe') ||
    p.includes('legal')
  ) {
    return 'filing';
  }

  // 3. Web Scraping & Ingestion
  if (
    p.includes('scrap') ||
    p.includes('crawl') ||
    p.includes('extract from url') ||
    p.includes('webhook') ||
    p.includes('notific')
  ) {
    return 'scrapers';
  }

  // 4. Research & DeepSearch
  if (
    p.includes('deepsearch') ||
    p.includes('deep search') ||
    p.includes('literature review') ||
    p.includes('comprehensive survey') ||
    p.includes('academic')
  ) {
    return 'deepsearch';
  }

  return null;
}

export class GrokPoolRouter {
  constructor(configManager = null, stateFile = STATE_FILE) {
    this.cfg = configManager || new ConfigManager();
    this.stateFile = stateFile;
    this.state = this._loadState();
  }

  _loadState() {
    if (fs.existsSync(this.stateFile)) {
      try {
        const content = fs.readFileSync(this.stateFile, 'utf8');
        return JSON.parse(content);
      } catch (_) {}
    }
    return {
      last_idx: 0,
      cooldowns: {}, // acct_name -> unix timestamp
      stats: {}, // acct_name -> {requests, errors, failovers, last_used}
      conversation_map: {}, // conversation_id -> acct_name
    };
  }

  _saveState() {
    try {
      const dir = path.dirname(path.resolve(this.stateFile));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      process.stderr.write(`[warning] Failed to save pool state: ${err.message}\n`);
    }
  }

  isInCooldown(acctName) {
    const expires = (this.state.cooldowns && this.state.cooldowns[acctName]) || 0;
    return Date.now() / 1000 < expires;
  }

  getCooldownRemaining(acctName) {
    const expires = (this.state.cooldowns && this.state.cooldowns[acctName]) || 0;
    const rem = Math.floor(expires - Date.now() / 1000);
    return Math.max(0, rem);
  }

  setCooldown(acctName, durationSeconds = 900, reason = 'Quota Exhausted') {
    const expireAt = Math.floor(Date.now() / 1000) + durationSeconds;
    if (!this.state.cooldowns) this.state.cooldowns = {};
    this.state.cooldowns[acctName] = expireAt;

    if (!this.state.stats) this.state.stats = {};
    if (!this.state.stats[acctName]) {
      this.state.stats[acctName] = { requests: 0, errors: 0, failovers: 0 };
    }
    this.state.stats[acctName].failovers = (this.state.stats[acctName].failovers || 0) + 1;
    this._saveState();

    const timeStr = new Date(expireAt * 1000).toISOString().slice(11, 19) + ' UTC';
    process.stderr.write(
      `⚠️  [GROK POOL FAILOVER] Account '${acctName}' in cooldown until ${timeStr} (${reason})\n`
    );
  }

  clearCooldown(acctName = null) {
    if (acctName) {
      if (this.state.cooldowns) delete this.state.cooldowns[acctName];
    } else {
      this.state.cooldowns = {};
    }
    this._saveState();
  }

  getCandidateAccounts(preferredAccount = null, role = null, conversationId = null) {
    const allAccounts = Array.from(this.cfg.accounts.keys());
    if (allAccounts.length === 0) return [];

    // 1. Sticky conversation mapping
    if (conversationId && this.state.conversation_map && this.state.conversation_map[conversationId]) {
      const mapped = this.state.conversation_map[conversationId];
      if (allAccounts.includes(mapped) && !this.isInCooldown(mapped)) {
        const others = allAccounts.filter((a) => a !== mapped);
        return [mapped, ...others];
      }
    }

    // 2. Preferred explicit account
    if (preferredAccount && allAccounts.includes(preferredAccount)) {
      const others = allAccounts.filter((a) => a !== preferredAccount);
      return [preferredAccount, ...others];
    }

    // 3. Filter by specialized knowledge/role
    let candidates = allAccounts;
    if (role) {
      const roleMatches = [];
      for (const [name, prof] of this.cfg.accounts.entries()) {
        const roles = (prof.roles || []).map((r) => r.toLowerCase());
        if (roles.includes(role.toLowerCase())) {
          roleMatches.push(name);
        }
      }
      if (roleMatches.length > 0) {
        candidates = roleMatches;
      }
    }

    const healthy = candidates.filter((a) => !this.isInCooldown(a));
    const cooling = candidates.filter((a) => this.isInCooldown(a));

    if (healthy.length === 0) {
      cooling.sort((a, b) => (this.state.cooldowns[a] || 0) - (this.state.cooldowns[b] || 0));
      return cooling;
    }

    // Sort healthy by strategy
    if (this.cfg.strategy === 'least-busy') {
      healthy.sort((a, b) => {
        const reqA = this.state.stats?.[a]?.requests || 0;
        const reqB = this.state.stats?.[b]?.requests || 0;
        return reqA - reqB;
      });
      return [...healthy, ...cooling];
    }

    // Default round-robin offset
    const lastIdx = this.state.last_idx || 0;
    const n = healthy.length;
    const offset = lastIdx % n;
    const ordered = [...healthy.slice(offset), ...healthy.slice(0, offset)];
    return [...ordered, ...cooling];
  }

  recordUsage(acctName, success = true) {
    if (!this.state.stats) this.state.stats = {};
    if (!this.state.stats[acctName]) {
      this.state.stats[acctName] = { requests: 0, errors: 0, failovers: 0 };
    }
    this.state.stats[acctName].requests = (this.state.stats[acctName].requests || 0) + 1;
    this.state.stats[acctName].last_used = Math.floor(Date.now() / 1000);
    if (!success) {
      this.state.stats[acctName].errors = (this.state.stats[acctName].errors || 0) + 1;
    }

    const keys = Array.from(this.cfg.accounts.keys());
    if (keys.includes(acctName)) {
      const curr = keys.indexOf(acctName);
      this.state.last_idx = (curr + 1) % Math.max(1, keys.length);
    }
    this._saveState();
  }

  async *executeChatStream(prompt, options = {}) {
    let {
      model = 'grok-3',
      preferredAccount = null,
      role = null,
      conversationId = null,
    } = options;

    // Automatic specialized role detection if none explicitly supplied
    if (!role && !preferredAccount) {
      role = detectSpecializedRole(prompt);
      if (role) {
        process.stderr.write(`[context-router] Auto-detected specialized role: '${role}'\n`);
      }
    }

    const candidates = this.getCandidateAccounts(preferredAccount, role, conversationId);
    if (candidates.length === 0) {
      throw new Error("No accounts available in pool. Run 'grokbot pool add' or set GROK_SSO.");
    }

    let lastError = null;
    for (const acctName of candidates) {
      if (this.isInCooldown(acctName)) {
        const rem = this.getCooldownRemaining(acctName);
        process.stderr.write(`[pool] Skipping '${acctName}' (in cooldown: ${rem}s remaining)\n`);
        continue;
      }

      try {
        const sso = this.cfg.resolveSso(acctName);
        const client = new GrokClient(sso);
        const profile = this.cfg.accounts.get(acctName);

        yield {
          type: 'account_selected',
          account: acctName,
          email: profile?.email || '',
        };

        const stream = client.streamCompletion(prompt, {
          model,
          conversationId,
        });

        for await (const chunk of stream) {
          yield chunk;

          if (chunk.type === 'done') {
            if (chunk.conversation_id) {
              if (!this.state.conversation_map) this.state.conversation_map = {};
              this.state.conversation_map[chunk.conversation_id] = acctName;
            }
            this.recordUsage(acctName, true);
            return;
          }
        }
      } catch (err) {
        lastError = err;
        this.recordUsage(acctName, false);

        if (err instanceof RateLimitError || err.statusCode === 429) {
          const profile = this.cfg.accounts.get(acctName);
          const cooldownSec = profile?.cooldown_seconds || 900;
          this.setCooldown(acctName, cooldownSec, err.message);
          yield {
            type: 'failover',
            failed_account: acctName,
            reason: err.message,
          };
          continue; // seamlessly try next candidate!
        }

        if (err instanceof AuthError || err.statusCode === 401 || err.statusCode === 403) {
          process.stderr.write(`⚠️  Authentication error on account '${acctName}': ${err.message}\n`);
          yield {
            type: 'failover',
            failed_account: acctName,
            reason: `Auth error: ${err.message}`,
          };
          continue;
        }

        process.stderr.write(`⚠️  Error on account '${acctName}': ${err.message}\n`);
      }
    }

    throw new Error(`All candidate accounts in pool failed or exhausted. Last error: ${lastError?.message || 'Unknown'}`);
  }

  async query(prompt, options = {}) {
    const accumulated = [];
    const thinkingParts = [];
    let servedBy = null;
    let email = null;
    let cid = options.conversationId || null;

    for await (const chunk of this.executeChatStream(prompt, options)) {
      if (chunk.type === 'account_selected') {
        servedBy = chunk.account;
        email = chunk.email;
      } else if (chunk.type === 'token') {
        accumulated.push(chunk.text || '');
      } else if (chunk.type === 'thinking') {
        thinkingParts.push(chunk.text || '');
      } else if (chunk.type === 'done') {
        cid = chunk.conversation_id || cid;
        return {
          success: true,
          text: chunk.text || accumulated.join(''),
          thinking: thinkingParts.join(''),
          account: servedBy,
          email,
          conversation_id: cid,
          model: options.model || 'grok-3',
        };
      }
    }

    return {
      success: true,
      text: accumulated.join(''),
      thinking: thinkingParts.join(''),
      account: servedBy,
      email,
      conversation_id: cid,
      model: options.model || 'grok-3',
    };
  }

  async executeBatch(items, options = {}) {
    const { concurrency = Math.max(1, this.cfg.accounts.size), onProgress = null } = options;
    const results = new Array(items.length);
    let completed = 0;
    let index = 0;

    const worker = async () => {
      while (true) {
        const i = index++;
        if (i >= items.length) break;

        const item = items[i];
        const prompt = typeof item === 'string' ? item : item.prompt;
        const id = typeof item === 'object' ? item.id || `item-${i}` : `item-${i}`;
        const model = (typeof item === 'object' && item.model) || options.model || 'grok-3';
        const role = (typeof item === 'object' && item.role) || options.role || null;

        const start = Date.now();
        try {
          const res = await this.query(prompt, { model, role });
          results[i] = {
            id,
            success: true,
            text: res.text,
            account: res.account,
            email: res.email,
            latency_ms: Date.now() - start,
          };
        } catch (err) {
          results[i] = {
            id,
            success: false,
            error: err.message,
            latency_ms: Date.now() - start,
          };
        }

        completed++;
        if (onProgress) {
          onProgress({ completed, total: items.length, lastResult: results[i] });
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  async getPoolStatus() {
    const results = [];
    for (const [name, profile] of this.cfg.accounts.entries()) {
      const inCd = this.isInCooldown(name);
      const rem = this.getCooldownRemaining(name);
      const stats = (this.state.stats && this.state.stats[name]) || { requests: 0, errors: 0, failovers: 0 };

      const item = {
        name,
        email: profile.email || '',
        uid: profile.uid || '',
        roles: profile.roles || ['general'],
        cooldown: inCd,
        cooldown_remaining_sec: rem,
        stats,
        auth_ok: false,
        auth_message: 'Not tested',
      };

      if (!inCd) {
        try {
          const sso = this.cfg.resolveSso(name);
          const client = new GrokClient(sso);
          const authRes = await client.checkAuth(5000);
          item.auth_ok = authRes.authenticated;
          item.auth_message = authRes.authenticated ? 'Authenticated' : 'Session expired (401/403)';
          if (authRes.email && !item.email) item.email = authRes.email;
        } catch (err) {
          item.auth_ok = false;
          item.auth_message = err.message;
        }
      } else {
        item.auth_message = `In cooldown (${rem}s remaining)`;
      }

      results.push(item);
    }
    return results;
  }
}
