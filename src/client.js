/**
 * Native Grok API Client for Node.js.
 * Implements direct streaming via fetch, session validation,
 * and conversational response tree loading.
 */

export class GrokAPIError extends Error {
  constructor(message, statusCode = 0, body = '') {
    super(message);
    this.name = 'GrokAPIError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class RateLimitError extends GrokAPIError {
  constructor(message, statusCode = 429, body = '') {
    super(message, statusCode, body);
    this.name = 'RateLimitError';
  }
}

export class AuthError extends GrokAPIError {
  constructor(message, statusCode = 401, body = '') {
    super(message, statusCode, body);
    this.name = 'AuthError';
  }
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export class GrokClient {
  constructor(ssoToken, baseUrl = 'https://grok.com') {
    this.ssoToken = ssoToken;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.userAgent = DEFAULT_USER_AGENT;
  }

  _headers(custom = {}) {
    return {
      Cookie: `sso=${this.ssoToken}; sso-rw=${this.ssoToken}`,
      'User-Agent': this.userAgent,
      Origin: this.baseUrl,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...custom,
    };
  }

  async checkAuth(timeoutMs = 10000) {
    const url = `${this.baseUrl}/api/auth/session`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        headers: this._headers(),
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        return { authenticated: false, email: null, uid: null };
      }
      if (!resp.ok) {
        throw new GrokAPIError(`HTTP ${resp.status} checking auth session`, resp.status);
      }

      const data = await resp.json();
      const user = data.user || data.session || {};
      const authenticated = data.status === 'authenticated' || Boolean(user.email || user.id);
      return {
        authenticated,
        email: user.email || null,
        uid: user.id || user.userId || null,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new GrokAPIError('Timeout checking auth session', 408);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async *streamCompletion(prompt, options = {}) {
    const {
      model = 'grok-3',
      conversationId = null,
      parentResponseId = null,
      timeoutMs = 120000,
    } = options;

    const url = `${this.baseUrl}/rest/app-chat/conversations/new`;

    let deepsearch = '';
    let thinking = '';
    let actualModel = model;

    if (model.toLowerCase().includes('deepsearch')) {
      deepsearch = 'deepsearch';
      actualModel = 'grok-3';
    } else if (model.toLowerCase().includes('think')) {
      thinking = 'think';
      actualModel = 'grok-3';
    }

    const payload = {
      temporary: !conversationId,
      modelName: actualModel,
      message: prompt,
      fileAttachments: [],
      imageAttachments: [],
      disableSearch: false,
      enableImageGeneration: true,
      returnImageBytes: false,
      returnProxiedImageUrls: true,
      deepsearchPreset: deepsearch,
      thinkingPreset: thinking,
    };

    if (conversationId) payload.conversationId = conversationId;
    if (parentResponseId) payload.parentResponseId = parentResponseId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: this._headers({
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        }),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new GrokAPIError('Completion request timed out', 408);
      }
      throw new GrokAPIError(`Network error connecting to Grok: ${err.message}`);
    }

    if (!resp.ok) {
      clearTimeout(timeout);
      let errBody = '';
      try {
        errBody = await resp.text();
      } catch (_) {}

      if (
        resp.status === 429 ||
        errBody.toLowerCase().includes('rate') ||
        errBody.toLowerCase().includes('limit') ||
        errBody.toLowerCase().includes('quota')
      ) {
        throw new RateLimitError(
          `HTTP 429: Rate limit or quota exhausted (${errBody.slice(0, 200)})`,
          429,
          errBody
        );
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new AuthError(`HTTP ${resp.status}: Authentication failed`, resp.status, errBody);
      }
      throw new GrokAPIError(`HTTP ${resp.status}: ${errBody.slice(0, 200)}`, resp.status, errBody);
    }

    try {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = [];
      let finalModelMsg = null;
      let activeCid = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last unfinished line

        for (let line of lines) {
          line = line.trim();
          if (!line) continue;

          let jsonStr = line;
          if (line.startsWith('data:')) {
            jsonStr = line.slice(5).trim();
          }

          if (jsonStr === '[DONE]') {
            break;
          }

          let obj;
          try {
            obj = JSON.parse(jsonStr);
          } catch (_) {
            continue;
          }

          const resOuter = obj.result || obj;

          if (resOuter.error) {
            const err = resOuter.error;
            const msg = err.message || JSON.stringify(err);
            if (
              msg.toLowerCase().includes('rate') ||
              msg.toLowerCase().includes('limit') ||
              msg.toLowerCase().includes('quota')
            ) {
              throw new RateLimitError(msg, 429);
            }
            throw new GrokAPIError(msg);
          }

          if (resOuter.conversation) {
            const cInfo = resOuter.conversation;
            activeCid = cInfo.conversationId || activeCid;
            yield {
              type: 'meta',
              conversation_id: activeCid,
              title: cInfo.title,
            };
          }

          const res = resOuter.response || resOuter;
          const token = res.token;
          const isThinking = Boolean(res.isThinking);

          if (token) {
            if (isThinking) {
              yield { type: 'thinking', text: token };
            } else {
              accumulatedText.push(token);
              yield { type: 'token', text: token };
            }
          }

          if (res.modelResponse) {
            finalModelMsg = res.modelResponse.message;
          }
        }
      }

      const fullText = finalModelMsg || accumulatedText.join('');
      yield {
        type: 'done',
        text: fullText,
        conversation_id: activeCid,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async listConversations(limit = 50) {
    const url = `${this.baseUrl}/rest/app-chat/conversations?pageSize=${limit}`;
    const resp = await fetch(url, { headers: this._headers() });
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        throw new AuthError(`HTTP ${resp.status} listing conversations`, resp.status);
      }
      throw new GrokAPIError(`HTTP ${resp.status} listing conversations`, resp.status);
    }
    const data = await resp.json();
    return data.conversations || [];
  }

  async getConversationNodes(conversationId) {
    const url = `${this.baseUrl}/rest/app-chat/conversations/${conversationId}/response-node?includeThreads=true`;
    const resp = await fetch(url, { headers: this._headers() });
    if (!resp.ok) {
      throw new GrokAPIError(`Failed to get conversation nodes: HTTP ${resp.status}`, resp.status);
    }
    const data = await resp.json();
    const nodes = data.responseNodes || [];
    return nodes.map((n) => n.responseId).filter(Boolean);
  }

  async loadResponses(conversationId, nodeIds) {
    if (!nodeIds || nodeIds.length === 0) return [];
    const url = `${this.baseUrl}/rest/app-chat/conversations/${conversationId}/load-responses`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: this._headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ responseIds: nodeIds }),
    });
    if (!resp.ok) {
      throw new GrokAPIError(`Failed loading responses: HTTP ${resp.status}`, resp.status);
    }
    const data = await resp.json();
    return data.responses || [];
  }
}
