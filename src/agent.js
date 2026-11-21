import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const guardianTag = "[SAMI'S INTENT GUARDIAN]";

function entryText(entry) {
  const value = entry.content ?? entry.message;
  const text = typeof value === 'string' ? value : value?.content ?? value?.text;
  return typeof text === 'string' ? text.trim() : '';
}

export function guardianJob(agentId, entries, evidence) {
  const lastUser = entries.findLastIndex(entry => entry.kind === 'message' && entry.role === 'user');
  const lastTask = entries.findLastIndex(entry => entry.kind === 'message' && entry.role === 'user'
    && !entryText(entry).startsWith(guardianTag));
  if (lastTask < 0 || !entryText(entries[lastTask])) {
    throw new Error('The original GrokBot task is missing from the native transcript tail');
  }
  const replies = entries.slice(lastUser + 1)
    .filter(entry => entry.kind === 'send-message' || (entry.kind === 'message' && entry.role === 'assistant'))
    .map(entryText).filter(Boolean);
  if (!replies.length) throw new Error('No native GrokBot reply after the latest message');
  const job = { session_id: agentId, prompt: entryText(entries[lastTask]), evidence, result: replies.join('\n\n') };
  const newestUser = entries[lastUser];
  if (lastUser !== lastTask && newestUser.id) {
    // Canonical Guardian computes this digest over the JSON-encoded correction text.
    job.delivery = {
      correction_hash: createHash('sha256').update(JSON.stringify(entryText(newestUser))).digest('hex'),
      source_id: newestUser.id,
    };
  }
  return job;
}

/**
 * Native WebSocket Grok Bot & Agent Orchestration Client.
 * Connects directly to wss://grok.com/ws/bot/?uid=${uid} using native Node.js WebSocket.
 * Zero external dependencies.
 *
 * Provides programmatic management for:
 *  - bot.roster (list agents, groups, status, last activity)
 *  - bot.command / sendPrompt (dispatch instructions directly to agent)
 *  - bot.command / getAgentTranscriptTail (inspect agent logs & history)
 *  - Generic JSON-RPC 2.0 gateway calls (updateAgent, setGroupMembers, etc.)
 */

export class GrokAgentClient {
  constructor(configManager) {
    this.cfg = configManager;
  }

  /**
   * Resolves connection parameters (UID, SSO cookie, WS URL) for an account.
   */
  async resolveConnection(accountName) {
    let name = accountName;
    if (!name) {
      // Pick first configured account or default
      const accts = Array.from(this.cfg.accounts.keys());
      if (accts.length === 0) {
        throw new Error('No accounts configured in pool. Add one with "grokbot pool add".');
      }
      name = accts[0];
    }

    if (!this.cfg.accounts.has(name)) {
      throw new Error(`Account '${name}' not found in configuration.`);
    }

    const prof = this.cfg.accounts.get(name);
    const sso = this.cfg.resolveSso(name);
    const uid = prof.uid;

    if (!uid) {
      throw new Error(`Account '${name}' does not have a 'uid' configured. Run "grokbot doctor" or update config.`);
    }

    const cookieHeader = `sso=${sso}; sso-rw=${sso}; x-userid=${uid}`;
    const wsUrl = `wss://grok.com/ws/bot/?uid=${uid}`;

    return { name, uid, prof, sso, cookieHeader, wsUrl };
  }

  /**
   * Raw JSON-RPC 2.0 call over Grok Bot Gateway WebSocket.
   */
  async call(accountName, method, params = {}, timeoutMs = 45000) {
    const conn = await this.resolveConnection(accountName);

    return new Promise((resolve, reject) => {
      let isDone = false;
      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try { ws.close(); } catch (_) {}
          reject(new Error(`WebSocket call to '${method}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      let ws;
      try {
        ws = new WebSocket(conn.wsUrl, {
          headers: {
            Cookie: conn.cookieHeader,
            Origin: 'https://grok.com',
          },
        });
      } catch (err) {
        clearTimeout(timer);
        return reject(new Error(`Failed to instantiate WebSocket: ${err.message}`));
      }

      const reqId = 1;

      ws.onopen = () => {
        try {
          // Send handshake
          ws.send(JSON.stringify({ protocol_version: '1.0.0', kind: 'bot_client' }));
          // Send JSON-RPC call
          const msg = {
            jsonrpc: '2.0',
            id: reqId,
            method,
            params: params || {},
          };
          ws.send(JSON.stringify(msg));
        } catch (err) {
          if (!isDone) {
            isDone = true;
            clearTimeout(timer);
            try { ws.close(); } catch (_) {}
            reject(err);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.id === reqId) {
            if (!isDone) {
              isDone = true;
              clearTimeout(timer);
              try { ws.close(); } catch (_) {}
              if (data.error) {
                return reject(new Error(`Grok Bot RPC Error [${data.error.code || 'ERR'}]: ${data.error.message || JSON.stringify(data.error)}`));
              }
              resolve(data.result);
            }
          }
        } catch (err) {
          // Ignore unparseable frames or handshake acks
        }
      };

      ws.onerror = (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          reject(new Error(`WebSocket connection error: ${err.message || err}`));
        }
      };

      ws.onclose = (event) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          reject(new Error(`WebSocket closed unexpectedly (code: ${event.code}, reason: ${event.reason || 'none'})`));
        }
      };
    });
  }

  /**
   * Retrieves the full agent roster (and groups) for an account.
   */
  async roster(accountName) {
    const res = await this.call(accountName, 'bot.roster', {});
    return {
      agents: res?.agents || [],
      groups: res?.groups || [],
    };
  }

  /**
   * Executes a command on a specific bot agent (wraps into 'bot.command').
   */
  async callBotCommand(accountName, agentId, commandName, args = {}, timeoutMs = 45000) {
    const params = {
      agentId,
      name: commandName,
      args: {
        ...args,
        id: agentId,
        agentId,
      },
    };
    return this.call(accountName, 'bot.command', params, timeoutMs);
  }

  /**
   * Retrieves recent transcript entries for a specific agent.
   */
  async tail(accountName, agentId, limit = 50, beforeSeq = null) {
    const args = { id: agentId, limit: Math.min(200, Math.max(1, limit)) };
    if (beforeSeq !== null && beforeSeq !== undefined) {
      args.beforeSeq = beforeSeq;
    }
    const res = await this.callBotCommand(accountName, agentId, 'getAgentTranscriptTail', args);
    return res || { entries: [] };
  }

  /**
   * Sends a prompt instruction directly to a bot agent.
   */
  async prompt(accountName, agentId, promptText) {
    const args = { agentId, prompt: promptText };
    return this.callBotCommand(accountName, agentId, 'sendPrompt', args);
  }

  /** Review a completed native bot turn through the shared local Guardian. */
  async review(accountName, agentId, { evidence = [], applyCorrection = false } = {}) {
    const roster = await this.roster(accountName);
    const agent = roster.agents.find(item => item.agentId === agentId);
    if (!agent || agent.status !== 'idle') {
      throw new Error('Review requires an idle bot in the named account');
    }
    const transcript = await this.tail(accountName, agentId, 100);
    const job = guardianJob(agentId, transcript.entries ?? [], evidence);
    const script = join(homedir(), '.agents', 'skills', 'multi-agent-orchestrator', 'scripts', 'intent_guardian.py');
    const process = spawnSync('python3', [script, 'review-job', '--host', 'grokbot'], {
      input: JSON.stringify(job), encoding: 'utf8', timeout: 90000, maxBuffer: 256 * 1024,
    });
    if (process.error || process.status !== 0 || !process.stdout) {
      throw new Error('The installed Intent Guardian did not return a job review');
    }
    const review = JSON.parse(process.stdout);
    const correction = review.hook_output?.hookSpecificOutput?.additionalContext;
    if (applyCorrection && correction?.startsWith(guardianTag + ' ')) {
      const current = await this.tail(accountName, agentId, 1);
      if (current.entries?.at(-1)?.id !== transcript.entries.at(-1)?.id) {
        throw new Error('The bot transcript changed during review. Read the latest turn before sending a correction.');
      }
      const dispatch = await this.prompt(accountName, agentId, correction);
      return { ...review, correction_dispatch: dispatch };
    }
    return review;
  }
}
