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
}
