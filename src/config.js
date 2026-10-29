/**
 * Configuration and Profile Management for Grok Bot CLI.
 * Handles single-account setup, desktop app auto-detection,
 * multi-account pool configuration, and dynamic 1Password CLI resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export const CONFIG_SEARCH_PATHS = [
  path.join(os.homedir(), '.config', 'grok-bot', 'config.json'),
  path.join(os.homedir(), '.grokbot', 'config.json'),
  path.join(os.homedir(), '.grok', 'config.json'),
];

export const STATE_FILE = path.join(os.homedir(), '.grokbot', 'pool_state.json');

export function getDefaultConfigPath() {
  if (process.env.GROK_CONFIG) {
    return path.resolve(process.env.GROK_CONFIG);
  }
  for (const p of CONFIG_SEARCH_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(os.homedir(), '.config', 'grok-bot', 'config.json');
}

export function getDesktopAppPaths() {
  const platform = os.platform();
  const home = os.homedir();
  const paths = {
    appData: '',
    persistence: '',
    agents: '',
  };

  if (platform === 'darwin') {
    const base = path.join(home, 'Library', 'Application Support', 'Grok Bot');
    paths.appData = base;
    paths.persistence = path.join(base, 'sand-client-persistence');
    paths.agents = path.join(base, 'agent-data', 'agents');
  } else if (platform === 'linux') {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    const base = path.join(configDir, 'Grok Bot');
    paths.appData = base;
    paths.persistence = path.join(base, 'sand-client-persistence');
    paths.agents = path.join(base, 'agent-data', 'agents');
  } else if (platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const base = path.join(appdata, 'Grok Bot');
    paths.appData = base;
    paths.persistence = path.join(base, 'sand-client-persistence');
    paths.agents = path.join(base, 'agent-data', 'agents');
  }

  return paths;
}

export class ConfigManager {
  constructor(configPath = null) {
    this.configPath = configPath || getDefaultConfigPath();
    this.accounts = new Map();
    this.defaultAccount = null;
    this.strategy = 'round-robin'; // 'round-robin' | 'least-busy' | 'role-based'
    this.autoFailover = true;
    this._ssoCache = new Map();
    this.load();
  }

  load() {
    let raw = {};
    if (fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        raw = JSON.parse(fileContent);
      } catch (err) {
        process.stderr.write(`[warning] Failed to parse config file at ${this.configPath}: ${err.message}\n`);
      }
    }

    this.strategy = raw.strategy || 'round-robin';
    this.autoFailover = raw.auto_failover ?? true;
    this.defaultAccount = raw.default_account || null;

    // Load accounts
    const acctsRaw = raw.accounts || {};
    if (Array.isArray(acctsRaw)) {
      for (const item of acctsRaw) {
        if (item && item.name) {
          this.accounts.set(item.name, this._normalizeProfile(item));
        }
      }
    } else if (typeof acctsRaw === 'object') {
      for (const [name, item] of Object.entries(acctsRaw)) {
        if (item && typeof item === 'object') {
          item.name = item.name || name;
          this.accounts.set(name, this._normalizeProfile(item));
        }
      }
    }

    // Single-account environment overrides
    const envSso = process.env.GROK_SSO || process.env.GROK_COOKIE || process.env.GROK_SESSION;
    if (envSso && !this.accounts.has('default')) {
      const defaultProf = {
        name: 'default',
        sso: envSso,
        email: process.env.GROK_EMAIL || 'env-user@local',
        uid: '',
        slice_id: '',
        op_id: '',
        op_vault: '',
        roles: ['general'],
        model_preference: 'grok-3',
        cooldown_seconds: 900,
        weight: 1,
      };
      this.accounts.set('default', defaultProf);
      if (!this.defaultAccount) this.defaultAccount = 'default';
    }

    // Pool JSON environment override
    if (process.env.GROK_POOL_JSON) {
      try {
        const poolList = JSON.parse(process.env.GROK_POOL_JSON);
        for (const item of poolList) {
          if (item && item.name) {
            this.accounts.set(item.name, this._normalizeProfile(item));
          }
        }
      } catch (err) {
        process.stderr.write(`[warning] Failed to parse GROK_POOL_JSON: ${err.message}\n`);
      }
    }

    if (!this.defaultAccount && this.accounts.size > 0) {
      this.defaultAccount = this.accounts.keys().next().value;
    }
  }

  _normalizeProfile(data) {
    return {
      name: String(data.name || 'unnamed'),
      sso: String(data.sso || ''),
      email: String(data.email || ''),
      uid: String(data.uid || ''),
      slice_id: String(data.slice_id || ''),
      op_id: String(data.op_id || ''),
      op_vault: String(data.op_vault || ''),
      roles: Array.isArray(data.roles) ? data.roles.map(String) : ['general'],
      model_preference: String(data.model_preference || 'grok-3'),
      cooldown_seconds: Number(data.cooldown_seconds) || 900,
      weight: Number(data.weight) || 1,
    };
  }

  save() {
    const dir = path.dirname(path.resolve(this.configPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const acctsObj = {};
    for (const [k, v] of this.accounts.entries()) {
      acctsObj[k] = v;
    }
    const data = {
      strategy: this.strategy,
      auto_failover: this.autoFailover,
      default_account: this.defaultAccount,
      accounts: acctsObj,
    };
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf8');
  }

  addAccount(profile) {
    const norm = this._normalizeProfile(profile);
    this.accounts.set(norm.name, norm);
    if (!this.defaultAccount) this.defaultAccount = norm.name;
    this.save();
  }

  removeAccount(name) {
    if (this.accounts.has(name)) {
      this.accounts.delete(name);
      if (this.defaultAccount === name) {
        this.defaultAccount = this.accounts.keys().next().value || null;
      }
      this.save();
      return true;
    }
    return false;
  }

  resolveSso(name) {
    if (this._ssoCache.has(name)) {
      return this._ssoCache.get(name);
    }
    if (!this.accounts.has(name)) {
      throw new Error(`Account '${name}' not found in pool configuration.`);
    }

    const profile = this.accounts.get(name);
    if (profile.sso) {
      this._ssoCache.set(name, profile.sso);
      return profile.sso;
    }

    if (profile.op_id) {
      const args = ['item', 'get', profile.op_id, '--format', 'json'];
      if (profile.op_vault) {
        args.push('--vault', profile.op_vault);
      }
      try {
        const stdout = execFileSync('op', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const item = JSON.parse(stdout);
        const fields = {};
        for (const f of item.fields || []) {
          const lbl = (f.label || '').toLowerCase();
          fields[lbl] = f.value;
        }
        const token = fields.sso || fields.password || fields.credential || fields.token;
        if (token) {
          this._ssoCache.set(name, token);
          return token;
        }
        throw new Error(`No credential field (sso/password/token) found in 1Password item ${profile.op_id}`);
      } catch (err) {
        throw new Error(`Failed to resolve token from 1Password for account '${name}': ${err.message}`);
      }
    }

    throw new Error(`Account '${name}' has neither static 'sso' token nor 'op_id' configured.`);
  }
}
