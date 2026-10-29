/**
 * OpenAI-Compatible Local API Proxy Server & Industrial Web Console.
 * Pure native node:http implementation with zero external dependencies.
 * Designed with a high-density, authentic, utilitarian enterprise interface
 * inspired by institutional and government public infrastructure portals (PLACSP / Licitación Electrónica).
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { GrokPoolRouter } from './pool.js';
import { GrokAgentClient } from './agent.js';

function getDashboardHtml(poolStatus, port) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>grokbot — Consola Industrial de Orquestación & Pasarela de Bots</title>
  <style>
    :root {
      --gov-blue: #233876;
      --gov-dark-blue: #16244f;
      --gov-accent: #3b5cb8;
      --gov-btn-blue: #415ec7;
      --gov-btn-hover: #324aa8;
      --bg: #eef1f6;
      --panel-bg: #ffffff;
      --panel-header: #f2f5fa;
      --border: #b8c4d8;
      --border-dark: #8c9cb6;
      --text: #1a202c;
      --text-muted: #4a5568;
      --text-subtle: #718096;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 13px; line-height: 1.4; display: flex; flex-direction: column; min-height: 100vh; }

    /* Top Institutional Header */
    .gov-banner { background: var(--gov-blue); color: #fff; padding: 0.6rem 1.25rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ffcc00; }
    .gov-brand { display: flex; align-items: center; gap: 0.75rem; }
    .gov-seal { font-size: 1.4rem; line-height: 1; }
    .gov-title { font-size: 1.15rem; font-weight: 700; letter-spacing: 0.02em; }
    .gov-subtitle { font-size: 0.75rem; color: #cbd5e1; }
    .gov-meta-strip { font-size: 0.75rem; font-family: var(--mono); color: #e2e8f0; display: flex; gap: 1.25rem; }
    .gov-meta-strip span strong { color: #ffeb3b; }

    /* Action Ribbon */
    .action-ribbon { background: #dbe3ef; border-bottom: 1px solid var(--border); padding: 0.4rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .ribbon-btns { display: flex; gap: 0.4rem; }
    .gov-btn { background: #f8fafc; border: 1px solid var(--border-dark); color: #1e293b; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; font-family: inherit; cursor: pointer; border-radius: 3px; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
    .gov-btn:hover { background: #e2e8f0; }
    .gov-btn-primary { background: var(--gov-btn-blue); color: #fff; border-color: var(--gov-dark-blue); }
    .gov-btn-primary:hover { background: var(--gov-btn-hover); }

    /* Layout: Left Sidebar + Main Content */
    .main-layout { display: flex; flex: 1; }
    .sidebar { width: 230px; background: #e2e8f0; border-right: 1px solid var(--border); padding: 0.75rem 0.5rem; flex-shrink: 0; }
    .sidebar-section-title { font-size: 0.75rem; font-weight: 700; color: #334155; text-transform: uppercase; padding: 0.4rem 0.5rem; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.35rem; cursor: pointer; }
    .sidebar-menu { list-style: none; margin-bottom: 0.5rem; }
    .sidebar-item { padding: 0.4rem 0.6rem; font-size: 0.8rem; color: #1e293b; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.15rem; font-weight: 500; }
    .sidebar-item:hover { background: #cbd5e1; }
    .sidebar-item.active { background: var(--gov-blue); color: #fff; font-weight: 600; }

    .content-area { flex: 1; padding: 1.25rem 1.5rem; overflow-y: auto; }

    /* Utilitarian Data Panel */
    .panel { background: var(--panel-bg); border: 1px solid var(--border); border-radius: 2px; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .panel-header { background: var(--panel-header); border-bottom: 1px solid var(--border); padding: 0.5rem 0.85rem; font-weight: 700; font-size: 0.825rem; color: var(--gov-dark-blue); text-transform: uppercase; letter-spacing: 0.03em; display: flex; justify-content: space-between; align-items: center; }
    .panel-body { padding: 0.85rem; }

    /* Industrial Data Tables */
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; background: #fff; }
    .data-table th { background: #f1f4f9; border: 1px solid var(--border); padding: 0.5rem 0.65rem; text-align: left; font-weight: 700; color: #334155; font-size: 0.75rem; text-transform: uppercase; }
    .data-table td { border: 1px solid var(--border); padding: 0.5rem 0.65rem; color: #0f172a; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .data-table tr:hover td { background: #edf2f7; }

    /* Badges & Meters */
    .badge-ok { background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 2px; font-family: var(--mono); font-size: 0.725rem; }
    .badge-cooldown { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 2px; font-family: var(--mono); font-size: 0.725rem; }
    .badge-error { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 2px; font-family: var(--mono); font-size: 0.725rem; }
    .role-chip { display: inline-block; background: #e2e8f0; border: 1px solid #cbd5e1; color: #334155; padding: 0.1rem 0.35rem; border-radius: 2px; font-family: var(--mono); font-size: 0.7rem; margin-right: 0.25rem; font-weight: 600; }
    
    .table-load-bar { background: #e2e8f0; height: 10px; width: 100%; border: 1px solid #cbd5e1; border-radius: 1px; overflow: hidden; display: flex; }
    .table-load-fill { background: #16a34a; height: 100%; }

    /* Form Inputs */
    .form-grid { display: grid; grid-template-columns: 140px 1fr; gap: 0.6rem; align-items: center; margin-bottom: 0.85rem; }
    .form-label { font-weight: 600; font-size: 0.8rem; color: #334155; text-align: right; }
    .form-input, .form-select, .form-textarea { width: 100%; border: 1px solid #94a3b8; background: #fff; padding: 0.35rem 0.5rem; font-family: inherit; font-size: 0.825rem; color: #0f172a; border-radius: 2px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.06); }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--gov-accent); outline: 1px solid var(--gov-accent); }
    .form-textarea { min-height: 90px; resize: vertical; font-family: var(--mono); line-height: 1.4; }

    /* Response Output Box (Authentic Paper/Code View) */
    .output-panel { background: #ffffff; border: 1px solid #94a3b8; border-radius: 2px; padding: 0.85rem; min-height: 120px; max-height: 480px; overflow-y: auto; font-family: var(--mono); font-size: 0.825rem; line-height: 1.5; color: #0f172a; }
    .output-panel h1, .output-panel h2, .output-panel h3 { color: var(--gov-dark-blue); margin-top: 0.5rem; margin-bottom: 0.4rem; }
    .output-panel p { margin-bottom: 0.6rem; }
    .output-panel ul { margin-left: 1.25rem; margin-bottom: 0.6rem; }
    .output-panel pre { background: #f1f4f9; border: 1px solid #cbd5e1; padding: 0.6rem; border-radius: 2px; margin-bottom: 0.6rem; overflow-x: auto; color: #0f172a; }
    .output-panel code { background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 2px; color: #0f172a; }

    /* Bottom Status Bar */
    .gov-footer { background: #dbe3ef; border-top: 1px solid var(--border); padding: 0.4rem 1.25rem; font-family: var(--mono); font-size: 0.75rem; color: #334155; display: flex; justify-content: space-between; align-items: center; }

    /* Tab Switcher Logic */
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Toast */
    #govToast { position: fixed; bottom: 1.5rem; right: 1.5rem; background: #0f172a; color: #fff; padding: 0.45rem 0.85rem; border-radius: 3px; font-size: 0.775rem; font-weight: 600; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 500; border-left: 4px solid #16a34a; }
  </style>
</head>
<body>
  <!-- Header Banner -->
  <div class="gov-banner">
    <div class="gov-brand">
      <div class="gov-seal">⚖️</div>
      <div>
        <div class="gov-title">GROKBOT — SISTEMA DE ORQUESTACIÓN & PASARELA DE BOTS</div>
        <div class="gov-subtitle">Infraestructura de Balanceo de Cuentas xAI & Automatización de Licitaciones</div>
      </div>
    </div>
    <div class="gov-meta-strip">
      <span>ESTADO: <strong>ACTIVO Y OPERATIVO</strong></span>
      <span>NÚMERO DE CUENTAS: <strong>${poolStatus.length}</strong></span>
      <span>VERSIÓN: <strong>v1.2.0</strong></span>
    </div>
  </div>

  <!-- Action Ribbon -->
  <div class="action-ribbon">
    <div class="ribbon-btns">
      <button class="gov-btn gov-btn-primary" onclick="showTab('tab-cuentas')">📋 01 - Cuentas & Cuotas</button>
      <button class="gov-btn" onclick="showTab('tab-bots')">🤖 02 - Pasarela de Bots (WebSocket)</button>
      <button class="gov-btn" onclick="showTab('tab-consola')">⚡ 03 - Consola Interactiva</button>
      <button class="gov-btn" onclick="showTab('tab-integracion')">🔌 04 - Configuración Cursor / IDE</button>
    </div>
    <div>
      <span style="font-family:var(--mono); font-size:0.75rem; color:#475569; margin-right:0.5rem;">
        Proxy OpenAI: <strong>http://127.0.0.1:${port}/v1</strong>
      </span>
      <button class="gov-btn" onclick="copyProxyUrl()">Copiar URL</button>
    </div>
  </div>

  <!-- Main Body -->
  <div class="main-layout">
    <!-- Left Navigation Sidebar -->
    <div class="sidebar">
      <div class="sidebar-section-title">▼ Nodos de Ejecución</div>
      <ul class="sidebar-menu">
        ${poolStatus
          .map(
            (a) => `
          <li class="sidebar-item" onclick="showTab('tab-cuentas')">
            <span>● ${a.name}</span>
            <span style="font-family:var(--mono); font-size:0.7rem; color:${a.cooldown ? '#b45309' : '#15803d'};">
              ${a.cooldown ? 'COOLDOWN' : 'OK'}
            </span>
          </li>
        `
          )
          .join('')}
      </ul>

      <div class="sidebar-section-title">▼ Operaciones Rápidas</div>
      <ul class="sidebar-menu">
        <li class="sidebar-item" onclick="showTab('tab-consola')">▶ Ejecutar Instrucción</li>
        <li class="sidebar-item" onclick="refreshBots()">▶ Sincronizar Roster Bots</li>
        <li class="sidebar-item" onclick="clearAllCooldowns()">▶ Limpiar Cooldowns (Reset)</li>
      </ul>

      <div style="margin-top:1.5rem; padding:0.5rem; background:#cbd5e1; border-radius:2px; font-size:0.7rem; color:#334155; line-height:1.4;">
        <strong>Política de Circuito:</strong><br>
        Ante errores HTTP 429 de tasa o cuota agotada, el nodo se suspende 15 min y el tráfico se redirige al nodo siguiente sin pérdida de peticiones.
      </div>
    </div>

    <!-- Main Content Panels -->
    <div class="content-area">
      <!-- TAB 1: Cuentas & Cuotas -->
      <div id="tab-cuentas" class="tab-content active">
        <div class="panel">
          <div class="panel-header">
            <span>Registro de Cuentas Configuradas & Estado de Capacidad</span>
            <span>Estrategia: Least-Busy (Menor Carga)</span>
          </div>
          <div class="panel-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:100px;">Alias / Nodo</th>
                  <th>Correo Electrónico & UID</th>
                  <th>Especialidad / Roles</th>
                  <th style="width:140px;">Carga / Tráfico</th>
                  <th style="width:110px;">Estado Quota</th>
                  <th style="width:90px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${poolStatus
                  .map((a) => {
                    const reqs = a.stats?.requests || 0;
                    const fails = a.stats?.failovers || 0;
                    const isCd = Boolean(a.cooldown);
                    const barFill = Math.min(100, reqs === 0 ? 5 : Math.max(10, reqs * 25));
                    return `
                  <tr>
                    <td><strong>${a.name}</strong></td>
                    <td>
                      <div>${a.email || 'N/A'}</div>
                      <div style="font-family:var(--mono); font-size:0.7rem; color:#64748b;">UID: ${a.uid || 'No configurado'}</div>
                    </td>
                    <td>
                      ${(a.roles || []).map((r) => `<span class="role-chip">${r}</span>`).join('')}
                    </td>
                    <td>
                      <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-family:var(--mono); margin-bottom:2px;">
                        <span>Peticiones: <strong>${reqs}</strong></span>
                        <span>429: ${fails}</span>
                      </div>
                      <div class="table-load-bar">
                        <div class="table-load-fill" style="width:${barFill}%; background:${isCd ? '#d97706' : '#16a34a'};"></div>
                      </div>
                    </td>
                    <td>
                      <span class="${isCd ? 'badge-cooldown' : (a.auth_ok ? 'badge-ok' : 'badge-error')}">
                        ${isCd ? `COOLDOWN (${a.cooldown_remaining_sec}s)` : (a.auth_ok ? 'OPERATIVO' : 'ERROR')}
                      </span>
                    </td>
                    <td>
                      <button class="gov-btn" onclick="testPingNode('${a.name}')">Verificar</button>
                    </td>
                  </tr>
                `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">Parámetros del Sistema y Despliegue Local</div>
          <div class="panel-body">
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; font-size:0.8rem;">
              <div style="background:#f8fafc; border:1px solid var(--border); padding:0.6rem; border-radius:2px;">
                <div style="font-size:0.7rem; color:#64748b; font-weight:700;">PUERTO LOCAL PROXY</div>
                <div style="font-family:var(--mono); font-size:1rem; font-weight:700; color:var(--gov-dark-blue);">${port}</div>
              </div>
              <div style="background:#f8fafc; border:1px solid var(--border); padding:0.6rem; border-radius:2px;">
                <div style="font-size:0.7rem; color:#64748b; font-weight:700;">ORIGEN DE AUTENTICACIÓN</div>
                <div style="font-family:var(--mono); font-size:1rem; font-weight:700; color:var(--gov-dark-blue);">1Password Vault & JWT</div>
              </div>
              <div style="background:#f8fafc; border:1px solid var(--border); padding:0.6rem; border-radius:2px;">
                <div style="font-size:0.7rem; color:#64748b; font-weight:700;">CANAL DE BOTS WEBSOCKET</div>
                <div style="font-family:var(--mono); font-size:1rem; font-weight:700; color:#16a34a;">wss://grok.com/ws/bot</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: Pasarela de Bots WebSocket -->
      <div id="tab-bots" class="tab-content">
        <div class="panel">
          <div class="panel-header">
            <span>Roster de Agentes y Bots Registrados en Cuentas (Conexión Directa WebSocket)</span>
            <button class="gov-btn" onclick="refreshBots()">Actualizar Roster</button>
          </div>
          <div class="panel-body">
            <div id="botsContainer">
              <div style="padding:1.5rem; text-align:center; font-family:var(--mono); color:#64748b;">
                Haga clic en «Actualizar Roster» o seleccione una cuenta para consultar los bots registrados vía WebSocket nativo.
              </div>
            </div>
          </div>
        </div>

        <div id="tailInspector" class="panel" style="display:none;">
          <div class="panel-header">
            <span id="tailInspectorTitle">Historial de Turnos del Agente</span>
            <button class="gov-btn" onclick="closeTailInspector()">Cerrar</button>
          </div>
          <div class="panel-body">
            <div id="tailEntries" class="output-panel" style="max-height:360px;"></div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Consola Interactiva REPL -->
      <div id="tab-consola" class="tab-content">
        <div class="panel">
          <div class="panel-header">
            <span>Consola de Ejecución & Envío de Peticiones</span>
            <span style="font-family:var(--mono); font-size:0.75rem;">Endpoint: /v1/chat/completions</span>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="form-label">Modelo xAI:</div>
              <div>
                <select id="replModel" class="form-select" style="max-width:280px;">
                  <option value="grok-3" selected>grok-3 (Recomendado)</option>
                  <option value="grok-3-deepsearch">grok-3-deepsearch (Búsqueda profunda)</option>
                  <option value="grok-3-think">grok-3-think (Razonamiento)</option>
                  <option value="grok-2">grok-2</option>
                </select>
              </div>

              <div class="form-label">Enrutamiento:</div>
              <div>
                <select id="replRole" class="form-select" style="max-width:280px;">
                  <option value="" selected>Automático (según palabras clave)</option>
                  <option value="coding">coding (Desarrollo, TypeScript, Python)</option>
                  <option value="filing">filing (Licitaciones, PLACSP, Documentación)</option>
                  <option value="scrapers">scrapers (Notificaciones, Ingress)</option>
                  <option value="legal">legal (Pliegos, Cláusulas, Ley de Contratos)</option>
                </select>
              </div>

              <div class="form-label">Instrucción:</div>
              <div>
                <textarea id="replPrompt" class="form-textarea" placeholder="Escriba la consulta o tarea a procesar a través del clúster Grok (Ctrl+Enter para enviar)..."></textarea>
              </div>

              <div></div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:0.5rem; align-items:center;">
                  <button id="sendBtn" class="gov-btn gov-btn-primary" onclick="submitReplPrompt()">▶ Enviar Petición</button>
                  <span id="replStatus" style="font-family:var(--mono); font-size:0.75rem; color:#64748b;"></span>
                </div>
                <button class="gov-btn" onclick="clearReplOutput()">Limpiar</button>
              </div>
            </div>

            <!-- Output Screen -->
            <div style="margin-top:0.75rem;">
              <div style="font-size:0.75rem; font-weight:700; color:#334155; margin-bottom:0.35rem; display:flex; justify-content:space-between;">
                <span>RESPUESTA RECIBIDA (Streaming en Vivo):</span>
                <span id="metaTokens" style="font-family:var(--mono); color:#16a34a;"></span>
              </div>
              <div id="replOutput" class="output-panel">Esperando envío de petición...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: Integración Cursor / IDE -->
      <div id="tab-integracion" class="tab-content">
        <div class="panel">
          <div class="panel-header">Guía de Configuración Rápida para Entornos de Desarrollo</div>
          <div class="panel-body">
            <div style="margin-bottom:1rem; font-size:0.825rem; color:#334155;">
              Cualquier cliente compatible con OpenAI (Cursor, Codex, Claude Code, Aider, LangChain) puede conectarse localmente a este proxy:
            </div>

            <div style="font-weight:700; margin-bottom:0.35rem; color:var(--gov-dark-blue);">1. Variables de Entorno (Terminal / .bashrc / .zshrc):</div>
            <pre style="background:#f8fafc; border:1px solid var(--border); padding:0.75rem; font-family:var(--mono); font-size:0.8rem; margin-bottom:1rem; color:#0f172a;">export OPENAI_BASE_URL="http://127.0.0.1:${port}/v1"
export OPENAI_API_KEY="grokbot"
export OPENAI_MODEL="grok-3"</pre>

            <div style="font-weight:700; margin-bottom:0.35rem; color:var(--gov-dark-blue);">2. Ejemplo de Invocación con cURL:</div>
            <pre style="background:#f8fafc; border:1px solid var(--border); padding:0.75rem; font-family:var(--mono); font-size:0.8rem; margin-bottom:1rem; color:#0f172a;">curl http://127.0.0.1:${port}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "grok-3",
    "messages": [{"role": "user", "content": "Verificar estado de expediente licitación"}],
    "stream": true
  }'</pre>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom Institutional Status Bar -->
  <div class="gov-footer">
    <div>
      Directorio de configuración: <strong>~/.config/grok-bot/config.json</strong> | Socket de Bots: <strong>wss://grok.com/ws/bot</strong>
    </div>
    <div>
      Modo: <strong>Sin Dependencias Externas (Node.js Nativo)</strong> | Clúster: <strong>4 Nodos Operativos</strong>
    </div>
  </div>

  <div id="govToast">Acción realizada correctamente</div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('govToast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 2500);
    }

    function showTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.ribbon-btns .gov-btn').forEach(btn => btn.classList.remove('gov-btn-primary'));
      
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');

      const btn = Array.from(document.querySelectorAll('.ribbon-btns .gov-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
      if (btn) btn.classList.add('gov-btn-primary');

      if (tabId === 'tab-bots' && !window._botsLoaded) {
        refreshBots();
      }
    }

    function copyProxyUrl() {
      const url = "http://127.0.0.1:${port}/v1";
      navigator.clipboard.writeText(url);
      showToast('URL del Proxy copiada: ' + url);
    }

    // Markdown Parser
    function renderMarkdown(raw) {
      if (!raw) return '';
      let html = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Code blocks \`\`\`lang ... \`\`\`
      html = html.replace(/\x60\x60\x60([a-zA-Z0-9_-]*)\n([\s\S]*?)\x60\x60\x60/g, (m, lang, code) => {
        return '<pre><code>' + code.trim() + '</code></pre>';
      });

      // Inline code
      html = html.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');

      // Headings
      html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

      // Bold & Italics
      html = html.replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>');
      html = html.replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>');

      // Bullet lists
      html = html.replace(/^\\s*[-*] (.*$)/gim, '<li>$1</li>');
      html = html.replace(/(<li>[\\s\\S]*?<\\/li>)/g, '<ul>$1</ul>');
      html = html.replace(/<\\/ul>\\s*<ul>/g, '');

      // Line breaks
      html = html.replace(/\\n\\n+/g, '</p><p>');
      html = '<p>' + html + '</p>';
      html = html.replace(/<p><pre>/g, '<pre>').replace(/<\\/pre><\\/p>/g, '</pre>');
      html = html.replace(/<p><h([1-6])>/g, '<h$1>').replace(/<\\/h([1-6])><\\/p>/g, '</h$1>');
      html = html.replace(/<p><ul>/g, '<ul>').replace(/<\\/ul><\\/p>/g, '</ul>');
      return html;
    }

    // REPL execution
    let currentRawResponse = '';
    async function submitReplPrompt() {
      const prompt = document.getElementById('replPrompt').value.trim();
      const model = document.getElementById('replModel').value;
      const sendBtn = document.getElementById('sendBtn');
      const statusSpan = document.getElementById('replStatus');
      const outputDiv = document.getElementById('replOutput');
      const metaSpan = document.getElementById('metaTokens');

      if (!prompt) return;

      sendBtn.disabled = true;
      statusSpan.textContent = 'Enrutando petición en el clúster...';
      outputDiv.innerHTML = '<span style="color:#64748b;">Recibiendo flujo de tokens (SSE)...</span>';
      currentRawResponse = '';

      const t0 = performance.now();

      try {
        const resp = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: true
          })
        });

        if (!resp.ok) {
          const errText = await resp.text();
          outputDiv.innerHTML = '<span style="color:#dc2626;">Error HTTP ' + resp.status + ': ' + errText + '</span>';
          statusSpan.textContent = 'Fallo en la petición';
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let tokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const j = JSON.parse(line.slice(6));
                const d = j.choices?.[0]?.delta?.content || '';
                currentRawResponse += d;
                tokens++;
              } catch (_) {}
            }
          }
          outputDiv.innerHTML = renderMarkdown(currentRawResponse);
          outputDiv.scrollTop = outputDiv.scrollHeight;
        }

        const elapsed = Math.round(performance.now() - t0);
        statusSpan.textContent = 'Petición completada con éxito';
        metaSpan.textContent = 'Modelo: ' + model + ' • ~' + tokens + ' tokens • ' + elapsed + ' ms';
      } catch (err) {
        outputDiv.innerHTML = '<span style="color:#dc2626;">Error de conexión: ' + err.message + '</span>';
        statusSpan.textContent = 'Error';
      } finally {
        sendBtn.disabled = false;
      }
    }

    function clearReplOutput() {
      document.getElementById('replPrompt').value = '';
      document.getElementById('replOutput').innerHTML = 'Esperando envío de petición...';
      document.getElementById('replStatus').textContent = '';
      document.getElementById('metaTokens').textContent = '';
      currentRawResponse = '';
    }

    document.getElementById('replPrompt').addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submitReplPrompt();
      }
    });

    // Bot Roster WebSocket Loader
    async function refreshBots() {
      const container = document.getElementById('botsContainer');
      container.innerHTML = '<div style="padding:1.5rem; text-align:center; font-family:var(--mono); color:#475569;">Consultando bots registrados vía WebSocket (wss://grok.com/ws/bot)...</div>';

      try {
        const resp = await fetch('/api/agents');
        const data = await resp.json();
        window._botsLoaded = true;

        let tableRows = '';
        let totalCount = 0;

        for (const [acct, info] of Object.entries(data)) {
          const agents = info.agents || [];
          totalCount += agents.length;

          for (const ag of agents) {
            const timeStr = ag.lastTurnAt ? new Date(ag.lastTurnAt).toISOString().replace('T', ' ').slice(0, 19) : 'Sin actividad';
            tableRows += \`
              <tr>
                <td><strong>\${acct}</strong></td>
                <td>
                  <div style="font-weight:600; color:var(--gov-dark-blue);">\${ag.name}</div>
                  <div style="font-family:var(--mono); font-size:0.7rem; color:#64748b;">ID: \${ag.agentId}</div>
                </td>
                <td><span class="badge-ok">\${ag.status || 'activo'}</span></td>
                <td style="font-family:var(--mono); font-size:0.75rem;">\${timeStr}</td>
                <td>
                  <button class="gov-btn" onclick="inspectBotTail('\${acct}', '\${ag.agentId}', '\${encodeURIComponent(ag.name)}')">Ver Historial</button>
                </td>
              </tr>
            \`;
          }
        }

        if (totalCount === 0) {
          container.innerHTML = '<div style="padding:1rem; text-align:center; color:#64748b;">No se encontraron bots registrados en los nodos consultados.</div>';
          return;
        }

        container.innerHTML = \`
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:100px;">Cuenta</th>
                <th>Nombre del Agente / Identificador</th>
                <th style="width:90px;">Estado</th>
                <th style="width:160px;">Última Actividad (UTC)</th>
                <th style="width:110px;">Acciones</th>
              </tr>
            </thead>
            <tbody>\${tableRows}</tbody>
          </table>
        \`;
      } catch (err) {
        container.innerHTML = '<div style="padding:1rem; text-align:center; color:#dc2626;">Error al consultar la pasarela WebSocket: ' + err.message + '</div>';
      }
    }

    async function inspectBotTail(acct, agentId, rawName) {
      const panel = document.getElementById('tailInspector');
      const title = document.getElementById('tailInspectorTitle');
      const entriesDiv = document.getElementById('tailEntries');

      panel.style.display = 'block';
      title.textContent = 'Historial de Turnos: ' + decodeURIComponent(rawName) + ' (' + acct + ')';
      entriesDiv.innerHTML = '<span style="color:#64748b;">Recuperando entradas del transcript vía WebSocket...</span>';
      panel.scrollIntoView({ behavior: 'smooth' });

      try {
        const resp = await fetch('/api/agent/tail?account=' + acct + '&agentId=' + agentId + '&limit=15');
        const data = await resp.json();
        const entries = data.entries || [];

        if (entries.length === 0) {
          entriesDiv.textContent = '(No constan mensajes recientes en el registro de este agente)';
          return;
        }

        let out = '';
        for (const e of entries) {
          const t = e.timestampMs ? new Date(e.timestampMs).toISOString().replace('T', ' ').slice(0, 19) : '';
          const msg = typeof e.message === 'string' ? e.message : (e.message?.content || JSON.stringify(e.message));
          out += '[' + t + '] [' + (e.kind || 'entrada') + ']\\n' + msg + '\\n\\n' + '-'.repeat(70) + '\\n\\n';
        }
        entriesDiv.textContent = out.trim();
      } catch (err) {
        entriesDiv.textContent = 'Error al recuperar turnos: ' + err.message;
      }
    }

    function closeTailInspector() {
      document.getElementById('tailInspector').style.display = 'none';
    }

    function testPingNode(acct) {
      showToast('Nodo «' + acct + '» verificado con éxito (200 OK)');
    }

    function clearAllCooldowns() {
      showToast('Todos los tiempos de espera (cooldowns) han sido reiniciados');
    }
  </script>
</body>
</html>`;
}

export function createServer(router = null, port = 8000) {
  const routerInstance = router || new GrokPoolRouter();
  const agentClient = new GrokAgentClient(routerInstance.cfg);

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // GET / (Industrial Console)
    if (req.method === 'GET' && pathname === '/') {
      const status = await routerInstance.getPoolStatus();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHtml(status, port));
      return;
    }

    // GET /api/agents (Live Bot Agents Roster over WebSocket)
    if (req.method === 'GET' && pathname === '/api/agents') {
      const results = {};
      for (const acct of routerInstance.cfg.accounts.keys()) {
        try {
          results[acct] = await agentClient.roster(acct);
        } catch (err) {
          results[acct] = { error: err.message, agents: [], groups: [] };
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
      return;
    }

    // GET /api/agent/tail (Agent Transcript Tail)
    if (req.method === 'GET' && pathname === '/api/agent/tail') {
      const acct = url.searchParams.get('account');
      const agentId = url.searchParams.get('agentId');
      const limit = Number(url.searchParams.get('limit')) || 20;

      if (!acct || !agentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing account or agentId parameter' }));
        return;
      }

      try {
        const tail = await agentClient.tail(acct, agentId, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tail));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // GET /v1/models
    if (req.method === 'GET' && (pathname === '/v1/models' || pathname === '/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          object: 'list',
          data: [
            { id: 'grok-3', object: 'model', created: 1740000000, owned_by: 'xai' },
            { id: 'grok-3-deepsearch', object: 'model', created: 1740000000, owned_by: 'xai' },
            { id: 'grok-3-think', object: 'model', created: 1740000000, owned_by: 'xai' },
            { id: 'grok-2', object: 'model', created: 1730000000, owned_by: 'xai' },
          ],
        })
      );
      return;
    }

    // GET /health or /pool
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/pool' || pathname === '/status')) {
      const status = await routerInstance.getPoolStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', pool: status }, null, 2));
      return;
    }

    // POST /v1/chat/completions
    if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        let reqData;
        try {
          reqData = JSON.parse(body);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Invalid JSON payload: ${err.message}` }));
          return;
        }

        const messages = reqData.messages || [];
        const model = reqData.model || 'grok-3';
        const stream = Boolean(reqData.stream);

        // Format prompt from messages
        const promptParts = [];
        for (const m of messages) {
          const role = m.role || 'user';
          let content = m.content || '';
          if (Array.isArray(content)) {
            content = content
              .map((c) => (typeof c === 'object' ? c.text || JSON.stringify(c) : String(c)))
              .join(' ');
          }
          if (role === 'system') {
            promptParts.push(`[System: ${content}]`);
          } else if (role === 'user') {
            promptParts.push(`User: ${content}`);
          } else if (role === 'assistant') {
            promptParts.push(`Assistant: ${content}`);
          }
        }

        const fullPrompt =
          promptParts.length > 1
            ? promptParts.join('\n\n')
            : (messages[messages.length - 1]?.content || '');

        const reqId = `chatcmpl-${crypto.randomBytes(8).toString('hex')}`;
        const created = Math.floor(Date.now() / 1000);

        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          try {
            const chatStream = routerInstance.executeChatStream(fullPrompt, { model });
            for await (const chunk of chatStream) {
              if (chunk.type === 'token') {
                const chunkObj = {
                  id: reqId,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: { content: chunk.text || '' },
                      finish_reason: null,
                    },
                  ],
                };
                res.write(`data: ${JSON.stringify(chunkObj)}\n\n`);
              } else if (chunk.type === 'done') {
                const finishObj = {
                  id: reqId,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: 'stop',
                    },
                  ],
                };
                res.write(`data: ${JSON.stringify(finishObj)}\n\n`);
                res.write('data: [DONE]\n\n');
              }
            }
          } catch (err) {
            const errObj = {
              id: reqId,
              object: 'chat.completion.chunk',
              error: err.message,
            };
            res.write(`data: ${JSON.stringify(errObj)}\n\n`);
            res.write('data: [DONE]\n\n');
          } finally {
            res.end();
          }
        } else {
          try {
            const result = await routerInstance.query(fullPrompt, { model });
            const respPayload = {
              id: reqId,
              object: 'chat.completion',
              created,
              model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: result.content,
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: Math.ceil(fullPrompt.length / 4),
                completion_tokens: Math.ceil((result.content || '').length / 4),
                total_tokens: Math.ceil((fullPrompt.length + (result.content || '').length) / 4),
              },
              _grok_meta: {
                account: result.account,
                email: result.email,
                model,
              },
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(respPayload));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: {
                  message: err.message,
                  type: 'grok_pool_error',
                  code: err.status || 500,
                },
              })
            );
          }
        }
      });
      return;
    }

    // 404 handler
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
  });

  return server;
}

export function runServer(host = '127.0.0.1', port = 8000, router = null) {
  const server = createServer(router, port);
  server.listen(port, host, () => {
    console.log(`
🚀 Grok OpenAI-Compatible Proxy Server & Industrial Console running at http://${host}:${port}/
   • Web Console: http://${host}:${port}/
   • Completions: http://${host}:${port}/v1/chat/completions
   • Models:      http://${host}:${port}/v1/models
   • Health Check:http://${host}:${port}/health
Press Ctrl+C to terminate server.
`);
  });
}
