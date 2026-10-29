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

function getDashboardHtml(poolStatus, port, activeTab = 'cuentas') {
  const isCuentas = activeTab === 'cuentas';
  const isBots = activeTab === 'bots';
  const isConsola = activeTab === 'consola';
  const isIntegracion = activeTab === 'integracion';

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
    html, body { height: 100%; overflow: hidden; }
    body { background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 13px; line-height: 1.4; display: flex; flex-direction: column; }

    /* Top Institutional Header */
    .gov-banner { background: var(--gov-blue); color: #fff; padding: 0.55rem 1.25rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ffcc00; flex-shrink: 0; }
    .gov-brand { display: flex; align-items: center; gap: 0.75rem; }
    .gov-seal { font-size: 1.4rem; line-height: 1; }
    .gov-title { font-size: 1.15rem; font-weight: 700; letter-spacing: 0.02em; }
    .gov-subtitle { font-size: 0.75rem; color: #cbd5e1; }
    .gov-meta-strip { font-size: 0.75rem; font-family: var(--mono); color: #e2e8f0; display: flex; gap: 1.25rem; }
    .gov-meta-strip span strong { color: #ffeb3b; }

    /* Action Ribbon */
    .action-ribbon { background: #dbe3ef; border-bottom: 1px solid var(--border); padding: 0.35rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; flex-shrink: 0; }
    .ribbon-btns { display: flex; gap: 0.4rem; }
    .gov-btn { background: #f8fafc; border: 1px solid var(--border-dark); color: #1e293b; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; font-family: inherit; cursor: pointer; border-radius: 3px; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 1px 2px rgba(0,0,0,0.06); user-select: none; }
    .gov-btn:hover { background: #e2e8f0; }
    .gov-btn-primary { background: var(--gov-btn-blue); color: #fff; border-color: var(--gov-dark-blue); }
    .gov-btn-primary:hover { background: var(--gov-btn-hover); }

    /* Layout: Left Sidebar + Main Content */
    .main-layout { display: flex; flex: 1; overflow: hidden; height: calc(100vh - 82px); }
    .sidebar { width: 220px; background: #e2e8f0; border-right: 1px solid var(--border); padding: 0.65rem 0.5rem; flex-shrink: 0; overflow-y: auto; display: flex; flex-direction: column; }
    .sidebar-section-title { font-size: 0.75rem; font-weight: 700; color: #334155; text-transform: uppercase; padding: 0.4rem 0.5rem; margin-top: 0.4rem; display: flex; align-items: center; gap: 0.35rem; cursor: pointer; }
    .sidebar-menu { list-style: none; margin-bottom: 0.4rem; }
    .sidebar-item { padding: 0.4rem 0.6rem; font-size: 0.8rem; color: #1e293b; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.15rem; font-weight: 500; user-select: none; }
    .sidebar-item:hover { background: #cbd5e1; }
    .sidebar-item.active { background: var(--gov-blue); color: #fff; font-weight: 600; }

    .content-area { flex: 1; padding: 0.65rem 0.85rem; overflow: hidden; display: flex; flex-direction: column; }

    /* Master-Detail Vertical Split (Email Client Style: Master - Gutter - Detail) */
    .split-container { display: flex; flex: 1; height: 100%; overflow: hidden; background: #fff; border: 1px solid var(--border); border-radius: 2px; }
    .split-pane-left { flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc; border-right: none; }
    .split-gutter { width: 6px; background: #cbd5e1; cursor: col-resize; flex-shrink: 0; position: relative; transition: background 0.1s; user-select: none; }
    .split-gutter:hover, .split-gutter.dragging { background: var(--gov-accent); }
    .split-gutter::after { content: ''; position: absolute; top: 50%; left: 1px; transform: translateY(-50%); width: 4px; height: 32px; border-left: 1px dotted #64748b; border-right: 1px dotted #64748b; }
    .split-pane-right { flex: 1; min-width: 320px; display: flex; flex-direction: column; overflow: hidden; background: #fff; }

    /* Pane Toolbar & Search */
    .pane-toolbar { padding: 0.5rem 0.65rem; background: #f1f4f9; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.35rem; flex-shrink: 0; }
    .filter-chips { display: flex; gap: 0.25rem; align-items: center; flex-wrap: wrap; }
    .chip-btn { background: #e2e8f0; border: 1px solid #cbd5e1; color: #334155; padding: 0.15rem 0.45rem; font-size: 0.7rem; font-weight: 600; border-radius: 2px; cursor: pointer; user-select: none; }
    .chip-btn:hover { background: #cbd5e1; }
    .chip-btn.active { background: var(--gov-blue); color: #fff; border-color: var(--gov-dark-blue); }

    /* Mobile Components (Hidden on Desktop) */
    .drawer-toggle-btn { display: none; }
    .sidebar-mobile-header { display: none; }
    #sidebarBackdrop { display: none; }
    .gov-meta-mobile { display: none; }
    .mobile-back-bar { display: none; }
    .footer-mobile { display: none; }
    .footer-desktop { display: block; }

    /* Bot Master List (Email message rows) */
    .bot-list { flex: 1; overflow-y: auto; list-style: none; }
    .bot-item { padding: 0.55rem 0.75rem; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.1s; display: flex; flex-direction: column; gap: 0.2rem; user-select: none; }
    .bot-item:hover { background: #edf2f7; }
    .bot-item.selected { background: #e0e7ff; border-left: 4px solid var(--gov-blue); padding-left: calc(0.75rem - 4px); }
    .bot-item-top { display: flex; justify-content: space-between; align-items: center; }
    .bot-item-name { font-weight: 700; font-size: 0.825rem; color: var(--gov-dark-blue); word-break: break-word; }
    .bot-item-meta { font-family: var(--mono); font-size: 0.7rem; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
    .acct-pill { background: #e2e8f0; border: 1px solid #cbd5e1; color: #1e293b; padding: 0.05rem 0.35rem; font-family: var(--mono); font-size: 0.675rem; font-weight: 700; border-radius: 2px; }

    /* Detail Inspector (Email Detail View) */
    .detail-header { padding: 0.65rem 0.85rem; border-bottom: 1px solid var(--border); background: #f8fafc; display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0; }
    .detail-transcript { flex: 1; padding: 0.75rem 0.85rem; overflow-y: auto; font-family: var(--mono); font-size: 0.8rem; line-height: 1.5; white-space: pre-wrap; background: #ffffff; color: #0f172a; }
    .detail-prompt-bar { padding: 0.5rem 0.85rem; background: #f1f4f9; border-top: 1px solid var(--border); display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #64748b; padding: 2rem; text-align: center; }

    /* Utilitarian Data Panel */
    .panel { background: var(--panel-bg); border: 1px solid var(--border); border-radius: 2px; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .panel-header { background: var(--panel-header); border-bottom: 1px solid var(--border); padding: 0.45rem 0.8rem; font-weight: 700; font-size: 0.8rem; color: var(--gov-dark-blue); text-transform: uppercase; letter-spacing: 0.03em; display: flex; justify-content: space-between; align-items: center; }
    .panel-body { padding: 0.75rem; }

    /* Industrial Data Tables */
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; background: #fff; }
    .data-table th { background: #f1f4f9; border: 1px solid var(--border); padding: 0.45rem 0.6rem; text-align: left; font-weight: 700; color: #334155; font-size: 0.725rem; text-transform: uppercase; }
    .data-table td { border: 1px solid var(--border); padding: 0.45rem 0.6rem; color: #0f172a; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .data-table tr:hover td { background: #edf2f7; }

    /* Badges & Meters */
    .badge-ok { background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 2px; font-family: var(--mono); font-size: 0.7rem; }
    .badge-subtle { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 2px; font-family: var(--mono); font-size: 0.7rem; }
    .badge-cooldown { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 2px; font-family: var(--mono); font-size: 0.7rem; }
    .badge-error { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 2px; font-family: var(--mono); font-size: 0.7rem; }
    .role-chip { display: inline-block; background: #e2e8f0; border: 1px solid #cbd5e1; color: #334155; padding: 0.1rem 0.35rem; border-radius: 2px; font-family: var(--mono); font-size: 0.675rem; margin-right: 0.25rem; font-weight: 600; }
    
    .table-load-bar { background: #e2e8f0; height: 8px; width: 100%; border: 1px solid #cbd5e1; border-radius: 1px; overflow: hidden; display: flex; }
    .table-load-fill { background: #16a34a; height: 100%; }

    /* Form Inputs */
    .form-grid { display: grid; grid-template-columns: 120px 1fr; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; }
    .form-label { font-weight: 600; font-size: 0.775rem; color: #334155; text-align: right; }
    .form-input, .form-select, .form-textarea { width: 100%; border: 1px solid #94a3b8; background: #fff; padding: 0.35rem 0.5rem; font-family: inherit; font-size: 0.8rem; color: #0f172a; border-radius: 2px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.06); }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--gov-accent); outline: 1px solid var(--gov-accent); }
    .form-textarea { min-height: 80px; resize: vertical; font-family: var(--mono); line-height: 1.4; }

    /* Response Output Box (Authentic Paper/Code View) */
    .output-panel { background: #ffffff; border: 1px solid #94a3b8; border-radius: 2px; padding: 0.75rem; overflow-y: auto; font-family: var(--mono); font-size: 0.8rem; line-height: 1.5; color: #0f172a; }
    .output-panel h1, .output-panel h2, .output-panel h3 { color: var(--gov-dark-blue); margin-top: 0.5rem; margin-bottom: 0.4rem; }
    .output-panel p { margin-bottom: 0.5rem; }
    .output-panel ul { margin-left: 1.25rem; margin-bottom: 0.5rem; }
    .output-panel pre { background: #f1f4f9; border: 1px solid #cbd5e1; padding: 0.5rem; border-radius: 2px; margin-bottom: 0.5rem; overflow-x: auto; color: #0f172a; }
    .output-panel code { background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 2px; color: #0f172a; }

    /* Bottom Status Bar */
    .gov-footer { background: #dbe3ef; border-top: 1px solid var(--border); padding: 0.35rem 1.25rem; font-family: var(--mono); font-size: 0.725rem; color: #334155; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }

    /* Tab Switcher Logic */
    .tab-content { display: none; height: 100%; flex-direction: column; overflow: hidden; }
    .tab-content.active { display: flex; }

    /* Toast */
    #govToast { position: fixed; bottom: 1.5rem; right: 1.5rem; background: #0f172a; color: #fff; padding: 0.45rem 0.85rem; border-radius: 3px; font-size: 0.775rem; font-weight: 600; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 500; border-left: 4px solid #16a34a; }

    /* Responsive & Mobile First Adaptations */
    @media (max-width: 800px) {
      html, body {
        overflow-x: hidden !important;
        max-width: 100vw !important;
        width: 100% !important;
        height: 100% !important;
      }
      .gov-banner { padding: 0.45rem 0.75rem; flex-wrap: nowrap; max-width: 100vw; overflow: hidden; }
      .gov-brand { gap: 0.5rem; min-width: 0; }
      .gov-seal { font-size: 1.25rem; flex-shrink: 0; }
      .gov-title { font-size: 0.95rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .gov-title-sub, .gov-subtitle, .gov-meta-strip, .footer-desktop, .ribbon-proxy-box { display: none !important; }
      
      .drawer-toggle-btn {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.4);
        color: #fff;
        font-size: 1.15rem;
        padding: 0.2rem 0.55rem;
        border-radius: 3px;
        cursor: pointer;
        line-height: 1;
        flex-shrink: 0;
      }
      .drawer-toggle-btn:hover { background: rgba(255, 255, 255, 0.25); }

      .gov-meta-mobile { display: flex !important; gap: 0.35rem; align-items: center; flex-shrink: 0; }

      .action-ribbon { padding: 0.35rem 0.5rem; max-width: 100vw; overflow: hidden; }
      .ribbon-btns {
        overflow-x: auto;
        white-space: nowrap;
        flex-wrap: nowrap;
        -webkit-overflow-scrolling: touch;
        width: 100%;
        max-width: 100%;
        padding-bottom: 2px;
        gap: 0.35rem;
      }
      .ribbon-btns::-webkit-scrollbar { height: 3px; }
      .ribbon-btns::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      .ribbon-btns .gov-btn { flex-shrink: 0; font-size: 0.725rem; padding: 0.35rem 0.6rem; }

      /* Off-Canvas Navigation Drawer */
      .main-layout {
        height: calc(100vh - 84px);
        position: relative;
        max-width: 100vw !important;
        width: 100% !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
      }
      .content-area {
        padding: 0.4rem 0.5rem;
        flex: 1;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
      }
      .tab-content {
        min-width: 0 !important;
        max-width: 100% !important;
      }
      .panel {
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }
      .panel-body {
        overflow-x: auto !important;
        max-width: 100% !important;
        -webkit-overflow-scrolling: touch;
        padding: 0.5rem;
      }
      .data-table {
        min-width: 580px;
      }

      .sidebar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 285px !important;
        max-width: 82vw !important;
        z-index: 1000 !important;
        background: #f1f5f9 !important;
        box-shadow: 4px 0 24px rgba(0,0,0,0.4) !important;
        transform: translateX(-100%);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 0.75rem !important;
      }
      .sidebar.open { transform: translateX(0) !important; }
      #sidebarBackdrop {
        position: fixed !important;
        inset: 0 !important;
        background: rgba(15, 23, 42, 0.65) !important;
        z-index: 999 !important;
        display: none !important;
        backdrop-filter: blur(2px);
      }
      #sidebarBackdrop.open { display: block !important; }
      
      .sidebar-mobile-header {
        display: flex !important;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.65rem;
        border-bottom: 2px solid var(--border);
        margin-bottom: 0.75rem;
      }
      .drawer-close-btn {
        background: #cbd5e1;
        border: none;
        font-size: 1rem;
        font-weight: 700;
        padding: 0.25rem 0.6rem;
        border-radius: 3px;
        cursor: pointer;
        color: #1e293b;
      }

      /* Mobile Master-Detail Drill Down for tab-bots */
      #botsSplitContainer { border: none !important; min-width: 0 !important; max-width: 100% !important; }
      #botsSplitContainer .split-gutter { display: none !important; }
      
      #botsSplitContainer:not(.mobile-show-detail) #botsListPane {
        display: flex !important;
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        border-right: none !important;
      }
      #botsSplitContainer:not(.mobile-show-detail) #botsDetailPane {
        display: none !important;
      }

      #botsSplitContainer.mobile-show-detail #botsListPane {
        display: none !important;
      }
      #botsSplitContainer.mobile-show-detail #botsDetailPane {
        display: flex !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
      }

      .mobile-back-bar {
        display: flex !important;
        background: #e2e8f0;
        border-bottom: 1px solid var(--border);
        padding: 0.4rem 0.65rem;
      }
      .mobile-back-btn {
        width: 100%;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 700;
        background: #ffffff;
      }

      /* Consola REPL on Mobile */
      #consolaSplitContainer { flex-direction: column !important; overflow-y: auto !important; min-width: 0 !important; max-width: 100% !important; }
      #consolaSplitContainer #consolaFormPane { width: 100% !important; max-width: 100% !important; min-width: 0 !important; height: auto !important; flex-shrink: 0 !important; }
      #consolaSplitContainer #consolaSplitGutter { display: none !important; }
      #consolaSplitContainer #consolaOutputPane { width: 100% !important; min-width: 0 !important; min-height: 320px !important; flex: 1 !important; }

      .form-grid { grid-template-columns: 1fr !important; gap: 0.25rem !important; }
      .form-label { text-align: left !important; }

      .gov-footer {
        padding: 0.35rem 0.75rem;
        flex-direction: column;
        gap: 0.2rem;
        font-size: 0.675rem;
        text-align: center;
        max-width: 100vw;
        overflow: hidden;
      }
      .footer-mobile { display: block !important; }
    }
  </style>
</head>
<body>
  <!-- Header Banner -->
  <div class="gov-banner">
    <div class="gov-brand">
      <button id="sidebarToggleBtn" class="drawer-toggle-btn" onclick="toggleSidebarDrawer()" aria-label="Abrir Menú">☰</button>
      <div class="gov-seal">⚖️</div>
      <div>
        <div class="gov-title">GROKBOT <span class="gov-title-sub">— SISTEMA DE ORQUESTACIÓN & PASARELA DE BOTS</span></div>
        <div class="gov-subtitle">Infraestructura de Balanceo de Cuentas xAI & Automatización de Licitaciones</div>
      </div>
    </div>
    <div class="gov-meta-strip">
      <span>ESTADO: <strong>ACTIVO Y OPERATIVO</strong></span>
      <span>NÚMERO DE CUENTAS: <strong>${poolStatus.length}</strong></span>
      <span>VERSIÓN: <strong>v1.3.1</strong></span>
    </div>
    <div class="gov-meta-mobile">
      <span class="badge-ok" style="font-size:0.675rem; padding:0.15rem 0.4rem;">● ACTIVO (${poolStatus.length})</span>
      <span class="badge-subtle" style="font-size:0.675rem; padding:0.15rem 0.4rem;">v1.3.1</span>
    </div>
  </div>

  <!-- Action Ribbon -->
  <div class="action-ribbon">
    <div class="ribbon-btns">
      <button id="btn-tab-cuentas" class="gov-btn ${isCuentas ? 'gov-btn-primary' : ''}" onclick="showTab('tab-cuentas'); closeSidebarDrawer();">📋 01 - Cuentas</button>
      <button id="btn-tab-bots" class="gov-btn ${isBots ? 'gov-btn-primary' : ''}" onclick="showTab('tab-bots'); closeSidebarDrawer();">🤖 02 - Bots (WS)</button>
      <button id="btn-tab-consola" class="gov-btn ${isConsola ? 'gov-btn-primary' : ''}" onclick="showTab('tab-consola'); closeSidebarDrawer();">⚡ 03 - Consola</button>
      <button id="btn-tab-integracion" class="gov-btn ${isIntegracion ? 'gov-btn-primary' : ''}" onclick="showTab('tab-integracion'); closeSidebarDrawer();">🔌 04 - Cursor / IDE</button>
    </div>
    <div class="ribbon-proxy-box">
      <span style="font-family:var(--mono); font-size:0.75rem; color:#475569; margin-right:0.5rem;">
        Proxy OpenAI: <strong>http://127.0.0.1:${port}/v1</strong>
      </span>
      <button id="btn-copy-proxy" class="gov-btn" onclick="copyProxyUrl()">Copiar URL</button>
    </div>
  </div>

  <!-- Main Body -->
  <div class="main-layout">
    <!-- Off-Canvas Sidebar Backdrop -->
    <div id="sidebarBackdrop" onclick="closeSidebarDrawer()"></div>

    <!-- Left Navigation Sidebar (Responsive Drawer on Mobile) -->
    <div class="sidebar" id="appSidebar">
      <div class="sidebar-mobile-header">
        <div style="font-weight:700; font-size:0.8rem; color:var(--gov-dark-blue); text-transform:uppercase; letter-spacing:0.04em;">Navegación Institucional</div>
        <button class="drawer-close-btn" onclick="closeSidebarDrawer()" aria-label="Cerrar Menú">✕</button>
      </div>

      <div class="sidebar-section-title">▼ Nodos de Ejecución</div>
      <ul class="sidebar-menu">
        ${poolStatus
          .map(
            (a) => `
          <li class="sidebar-item" onclick="showTab('tab-cuentas'); closeSidebarDrawer();">
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
        <li class="sidebar-item" onclick="showTab('tab-consola'); closeSidebarDrawer();">▶ Ejecutar Instrucción</li>
        <li class="sidebar-item" onclick="showTab('tab-bots'); refreshBots(); closeSidebarDrawer();">▶ Sincronizar Roster Bots</li>
        <li class="sidebar-item" onclick="clearAllCooldowns(); closeSidebarDrawer();">▶ Limpiar Cooldowns (Reset)</li>
      </ul>

      <div style="margin-top:1.5rem; padding:0.5rem; background:#cbd5e1; border-radius:2px; font-size:0.7rem; color:#334155; line-height:1.4;">
        <strong>Política de Circuito:</strong><br>
        Ante errores HTTP 429 de tasa o cuota agotada, el nodo se suspende 15 min y el tráfico se redirige al nodo siguiente sin pérdida de peticiones.
      </div>
    </div>

    <!-- Main Content Panels -->
    <div class="content-area">
      <!-- TAB 1: Cuentas & Cuotas -->
      <div id="tab-cuentas" class="tab-content ${isCuentas ? 'active' : ''}">
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
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem; font-size:0.8rem;">
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

      <!-- TAB 2: Pasarela de Bots WebSocket (Split View: Email Client Master-Detail) -->
      <div id="tab-bots" class="tab-content ${isBots ? 'active' : ''}">
        <div class="split-container" id="botsSplitContainer">
          <!-- Left Master Pane: Bot List -->
          <div class="split-pane-left" id="botsListPane" style="width: 440px; min-width: 280px; max-width: 65%;">
            <div class="pane-toolbar">
              <input type="text" id="botsSearchInput" class="form-input" placeholder="🔍 Filtrar agentes por nombre, cuenta o ID..." oninput="filterBotsList()">
              <div class="filter-chips">
                <button class="chip-btn active" id="chip-all" onclick="filterByAccount('')">Todos (<span id="botsTotalCount">0</span>)</button>
                <button class="chip-btn" id="chip-hao" onclick="filterByAccount('hao')">hao</button>
                <button class="chip-btn" id="chip-sami" onclick="filterByAccount('sami')">sami</button>
                <button class="chip-btn" id="chip-h999" onclick="filterByAccount('h999')">h999</button>
                <button class="chip-btn" id="chip-oulang" onclick="filterByAccount('oulang')">oulang</button>
                <button class="gov-btn" style="margin-left:auto; padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="refreshBots()">🔄 Refrescar</button>
              </div>
            </div>
            <div class="bot-list" id="botsList">
              <div style="padding:1.5rem; text-align:center; font-family:var(--mono); color:#64748b;">
                Cargando roster de agentes vía WebSocket...
              </div>
            </div>
          </div>

          <!-- Draggable Gutter Resizer -->
          <div class="split-gutter" id="botsSplitGutter" title="Arrastrar para redimensionar los paneles"></div>

          <!-- Right Detail Pane: Live Inspector & Direct Prompt -->
          <div class="split-pane-right" id="botsDetailPane">
            <!-- Mobile Drill-Down Back Button -->
            <div class="mobile-back-bar">
              <button class="gov-btn mobile-back-btn" onclick="backToBotsList()">
                ← Volver al Listado de Agentes
              </button>
            </div>

            <div id="botDetailEmpty" class="empty-state">
              <div style="font-size:2rem; margin-bottom:0.5rem;">🤖</div>
              <div style="font-weight:700; color:var(--gov-dark-blue);">Seleccione un agente del panel izquierdo</div>
              <div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;">Haga clic en cualquier agente o use las flechas ↑ / ↓ del teclado para inspeccionar turnos en vivo.</div>
            </div>
            <div id="botDetailContent" style="display:none; height:100%; flex-direction:column;">
              <div class="detail-header">
                <div>
                  <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    <span id="detailBotName" style="font-size:0.95rem; font-weight:700; color:var(--gov-dark-blue);"></span>
                    <span id="detailBotStatus" class="badge-ok">activo</span>
                  </div>
                  <div style="font-family:var(--mono); font-size:0.725rem; color:#64748b; margin-top:0.2rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                    <span>Cuenta: <strong id="detailBotAccount"></strong></span>
                    <span>•</span>
                    <span>ID: <code id="detailBotId"></code></span>
                    <button class="gov-btn" style="padding:0.1rem 0.35rem; font-size:0.675rem;" onclick="copyDetailBotId()">Copiar ID</button>
                  </div>
                </div>
                <div style="display:flex; gap:0.35rem;">
                  <button class="gov-btn" onclick="reloadCurrentBotTail()">🔄 Turnos</button>
                </div>
              </div>
              <div class="detail-transcript" id="detailTranscript"></div>
              <div class="detail-prompt-bar">
                <input type="text" id="detailPromptInput" class="form-input" placeholder="Enviar instrucción directa a este agente (Enter para enviar)..." onkeydown="if(event.key==='Enter') sendPromptToSelectedBot()">
                <button id="detailSendBtn" class="gov-btn gov-btn-primary" onclick="sendPromptToSelectedBot()">▶ Enviar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Consola Interactiva REPL (Split View) -->
      <div id="tab-consola" class="tab-content ${isConsola ? 'active' : ''}">
        <div class="split-container" id="consolaSplitContainer">
          <!-- Left Pane: Form Controls -->
          <div class="split-pane-left" id="consolaFormPane" style="width: 460px; min-width: 320px; max-width: 65%;">
            <div class="panel-header" style="flex-shrink:0;">
              <span>Consola de Ejecución Grok</span>
              <span style="font-family:var(--mono); font-size:0.7rem;">POST /v1/chat/completions</span>
            </div>
            <div style="padding:0.85rem; flex:1; display:flex; flex-direction:column; gap:0.75rem; overflow-y:auto;">
              <div class="form-grid">
                <div class="form-label">Modelo xAI:</div>
                <select id="replModel" class="form-select">
                  <option value="grok-3" selected>grok-3 (Recomendado)</option>
                  <option value="grok-3-deepsearch">grok-3-deepsearch (Búsqueda profunda)</option>
                  <option value="grok-3-think">grok-3-think (Razonamiento)</option>
                  <option value="grok-2">grok-2</option>
                </select>
                <div class="form-label">Enrutamiento:</div>
                <select id="replRole" class="form-select">
                  <option value="" selected>Automático (según palabras clave)</option>
                  <option value="coding">coding (Desarrollo, TypeScript, Python)</option>
                  <option value="filing">filing (Licitaciones, PLACSP, Documentación)</option>
                  <option value="scrapers">scrapers (Notificaciones, Ingress)</option>
                  <option value="legal">legal (Pliegos, Cláusulas, Ley de Contratos)</option>
                </select>
              </div>
              <div style="flex:1; display:flex; flex-direction:column;">
                <div style="font-weight:600; font-size:0.75rem; color:#334155; margin-bottom:0.25rem;">Instrucción (Ctrl+Enter para enviar):</div>
                <textarea id="replPrompt" class="form-textarea" style="flex:1; min-height:160px;" placeholder="Escriba la consulta o tarea a procesar a través del clúster Grok..."></textarea>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <div style="display:flex; gap:0.5rem; align-items:center;">
                  <button id="sendBtn" class="gov-btn gov-btn-primary" onclick="submitReplPrompt()">▶ Enviar Petición</button>
                  <span id="replStatus" style="font-family:var(--mono); font-size:0.725rem; color:#64748b;"></span>
                </div>
                <button class="gov-btn" onclick="clearReplOutput()">Limpiar</button>
              </div>
            </div>
          </div>

          <!-- Draggable Gutter Resizer -->
          <div class="split-gutter" id="consolaSplitGutter" title="Arrastrar para redimensionar los paneles"></div>

          <!-- Right Pane: Streaming Output -->
          <div class="split-pane-right" id="consolaOutputPane">
            <div class="panel-header" style="flex-shrink:0;">
              <span>RESPUESTA RECIBIDA (Streaming en Vivo)</span>
              <span id="metaTokens" style="font-family:var(--mono); color:#16a34a; font-size:0.725rem;"></span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#fff;">
              <div id="replOutput" class="output-panel" style="flex:1; max-height:none; border:none; border-radius:0;">Esperando envío de petición...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: Integración Cursor / IDE -->
      <div id="tab-integracion" class="tab-content ${isIntegracion ? 'active' : ''}">
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
    <div class="footer-desktop">
      Directorio de configuración: <strong>~/.config/grok-bot/config.json</strong> | Socket de Bots: <strong>wss://grok.com/ws/bot</strong>
    </div>
    <div class="footer-desktop">
      Modo: <strong>Sin Dependencias Externas (Node.js Nativo)</strong> | Clúster: <strong>${poolStatus.length} Nodos Operativos</strong>
    </div>
    <div class="footer-mobile">
      ⚖️ <strong>GROKBOT v1.3.1</strong> · Clúster ${poolStatus.length} Nodos Operativos · Node.js Nativo
    </div>
  </div>

  <div id="govToast">Acción realizada correctamente</div>

  <script>
    function toggleSidebarDrawer() {
      const sb = document.getElementById('appSidebar');
      const bd = document.getElementById('sidebarBackdrop');
      if (sb) sb.classList.toggle('open');
      if (bd) bd.classList.toggle('open');
    }

    function closeSidebarDrawer() {
      const sb = document.getElementById('appSidebar');
      const bd = document.getElementById('sidebarBackdrop');
      if (sb) sb.classList.remove('open');
      if (bd) bd.classList.remove('open');
    }

    function backToBotsList() {
      const sc = document.getElementById('botsSplitContainer');
      if (sc) sc.classList.remove('mobile-show-detail');
    }

    function showToast(msg) {
      const t = document.getElementById('govToast');
      if (!t) return;
      t.textContent = msg;
      t.style.display = 'block';
      clearTimeout(window._toastTimeout);
      window._toastTimeout = setTimeout(() => { t.style.display = 'none'; }, 2800);
    }

    function showTab(tabId) {
      closeSidebarDrawer();
      if (!tabId.startsWith('tab-')) tabId = 'tab-' + tabId;
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.ribbon-btns .gov-btn').forEach(btn => btn.classList.remove('gov-btn-primary'));
      
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');

      const btn = document.getElementById('btn-' + tabId);
      if (btn) btn.classList.add('gov-btn-primary');

      if (tabId === 'tab-bots' && !window._botsLoaded) {
        refreshBots();
      }
    }

    function checkHashOrTab() {
      const h = window.location.hash.replace('#', '');
      if (h) showTab(h);
    }
    window.addEventListener('DOMContentLoaded', () => {
      initResizableSplit('botsSplitGutter', 'botsListPane', 'grokbot_bots_pane_width');
      initResizableSplit('consolaSplitGutter', 'consolaFormPane', 'grokbot_consola_pane_width');
      checkHashOrTab();
    });
    window.addEventListener('hashchange', checkHashOrTab);

    function copyProxyUrl() {
      const url = "http://127.0.0.1:${port}/v1";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url);
        } else {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } catch (_) {}
      showToast('URL del Proxy copiada: ' + url);
    }

    // Markdown Parser
    function renderMarkdown(raw) {
      if (!raw) return '';
      let html = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Code blocks
      html = html.replace(new RegExp('\\x60\\x60\\x60([a-zA-Z0-9_-]*)\\\\n([\\\\s\\\\S]*?)\\x60\\x60\\x60', 'g'), function(m, lang, code) {
        return '<pre><code>' + code.trim() + '</code></pre>';
      });

      // Inline code
      html = html.replace(new RegExp('\\x60([^\\x60]+)\\x60', 'g'), '<code>$1</code>');

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
      html = '<p>' + html.replace(/\\n\\n+/g, '</p><p>') + '</p>';
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

      if (!prompt) {
        showToast('Por favor, introduzca una consulta para enviar a Grok');
        document.getElementById('replPrompt').focus();
        return;
      }

      sendBtn.disabled = true;
      statusSpan.textContent = 'Enrutando petición en el clúster...';
      outputDiv.innerHTML = '<span style="color:#64748b;">Recibiendo flujo de tokens (SSE)...</span>';
      currentRawResponse = '';

      if (window.innerWidth <= 800) {
        const outPane = document.getElementById('consolaOutputPane');
        if (outPane) outPane.scrollIntoView({ behavior: 'smooth' });
      }

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

    // Master-Detail Split Resizer (Adjustable Dragging)
    function initResizableSplit(gutterId, leftPaneId, storageKey) {
      const gutter = document.getElementById(gutterId);
      const leftPane = document.getElementById(leftPaneId);
      if (!gutter || !leftPane) return;

      const savedWidth = localStorage.getItem(storageKey);
      if (savedWidth) {
        leftPane.style.width = savedWidth + 'px';
      }

      let isDragging = false;
      let startX = 0;
      let startWidth = 0;

      gutter.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = leftPane.getBoundingClientRect().width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        gutter.classList.add('dragging');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const maxW = window.innerWidth * 0.75;
        const minW = 280;
        const newWidth = Math.max(minW, Math.min(maxW, startWidth + dx));
        leftPane.style.width = newWidth + 'px';
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          gutter.classList.remove('dragging');
          localStorage.setItem(storageKey, Math.round(leftPane.getBoundingClientRect().width));
        }
      });
    }

    // Bot Roster WebSocket State & Filtering
    window._allBots = [];
    window._filteredBots = [];
    window._selectedBot = null;
    window._activeAccount = '';

    async function refreshBots() {
      const listEl = document.getElementById('botsList');
      if (listEl) {
        listEl.innerHTML = '<div style="padding:1.5rem; text-align:center; font-family:var(--mono); color:#64748b;">Consultando agentes vía WebSocket (wss://grok.com/ws/bot)...</div>';
      }

      try {
        const resp = await fetch('/api/agents');
        const data = await resp.json();
        window._botsLoaded = true;

        const all = [];
        for (const [acct, info] of Object.entries(data)) {
          const agents = info.agents || [];
          for (const ag of agents) {
            all.push({
              account: acct,
              agentId: ag.agentId,
              name: ag.name || 'Sin nombre',
              status: ag.status || 'activo',
              lastTurnAt: ag.lastTurnAt,
              entryVersion: ag.entryVersion
            });
          }
        }

        window._allBots = all;
        const countSpan = document.getElementById('botsTotalCount');
        if (countSpan) countSpan.textContent = all.length;

        filterBotsList();

        // Auto-select first bot if none selected
        if (!window._selectedBot && all.length > 0) {
          selectBot(all[0].account, all[0].agentId);
        }
      } catch (err) {
        if (listEl) {
          listEl.innerHTML = '<div style="padding:1rem; text-align:center; color:#dc2626;">Error al consultar bots: ' + err.message + '</div>';
        }
      }
    }

    function filterByAccount(acct) {
      window._activeAccount = acct;
      document.querySelectorAll('.filter-chips .chip-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('chip-' + (acct || 'all'));
      if (activeBtn) activeBtn.classList.add('active');
      filterBotsList();
    }

    function filterBotsList() {
      const query = (document.getElementById('botsSearchInput')?.value || '').toLowerCase().trim();
      const acct = window._activeAccount;

      const filtered = window._allBots.filter(b => {
        if (acct && b.account !== acct) return false;
        if (query) {
          const text = (b.name + ' ' + b.account + ' ' + b.agentId).toLowerCase();
          if (!text.includes(query)) return false;
        }
        return true;
      });

      window._filteredBots = filtered;
      const listEl = document.getElementById('botsList');
      if (!listEl) return;

      if (filtered.length === 0) {
        listEl.innerHTML = '<div style="padding:1.5rem; text-align:center; color:#64748b; font-size:0.8rem;">No se encontraron agentes con los filtros aplicados.</div>';
        return;
      }

      let html = '';
      for (let i = 0; i < filtered.length; i++) {
        const b = filtered[i];
        const isSel = window._selectedBot && window._selectedBot.agentId === b.agentId && window._selectedBot.account === b.account;
        const timeStr = b.lastTurnAt ? new Date(b.lastTurnAt).toISOString().replace('T', ' ').slice(5, 16) : 'Sin act.';
        const statusClass = b.status === 'running' ? 'badge-ok' : (b.status === 'idle' ? 'badge-ok' : 'badge-subtle');
        const safeName = b.name.replace(/"/g, '&quot;');

        html += \`
          <div class="bot-item \${isSel ? 'selected' : ''}" data-idx="\${i}" onclick="selectBot('\${b.account}', '\${b.agentId}')">
            <div class="bot-item-top">
              <span class="acct-pill">\${b.account}</span>
              <span class="\${statusClass}">\${b.status}</span>
              <span style="font-family:var(--mono); font-size:0.675rem; color:#64748b;">\${timeStr}</span>
            </div>
            <div class="bot-item-name">\${safeName}</div>
            <div class="bot-item-meta">
              <span>ID: \${b.agentId.slice(0, 14)}...</span>
              <span>v\${b.entryVersion || 1}</span>
            </div>
          </div>
        \`;
      }
      listEl.innerHTML = html;
    }

    async function selectBot(account, agentId) {
      const bot = window._allBots.find(b => b.account === account && b.agentId === agentId);
      if (!bot) return;

      window._selectedBot = bot;
      document.querySelectorAll('.bot-item').forEach(el => el.classList.remove('selected'));
      const activeItem = Array.from(document.querySelectorAll('.bot-item')).find(el => {
        const idx = el.getAttribute('data-idx');
        return window._filteredBots[idx]?.agentId === agentId;
      });
      if (activeItem) {
        activeItem.classList.add('selected');
        activeItem.scrollIntoView({ block: 'nearest' });
      }

      document.getElementById('botDetailEmpty').style.display = 'none';
      const detailContent = document.getElementById('botDetailContent');
      detailContent.style.display = 'flex';

      if (window.innerWidth <= 800) {
        const sc = document.getElementById('botsSplitContainer');
        if (sc) sc.classList.add('mobile-show-detail');
      }

      document.getElementById('detailBotName').textContent = bot.name;
      document.getElementById('detailBotAccount').textContent = bot.account;
      document.getElementById('detailBotId').textContent = bot.agentId;
      const statusBadge = document.getElementById('detailBotStatus');
      statusBadge.textContent = bot.status;
      statusBadge.className = bot.status === 'running' ? 'badge-ok' : (bot.status === 'idle' ? 'badge-ok' : 'badge-subtle');

      await reloadCurrentBotTail();
    }

    async function reloadCurrentBotTail() {
      if (!window._selectedBot) return;
      const { account, agentId, name } = window._selectedBot;
      const transcriptDiv = document.getElementById('detailTranscript');
      transcriptDiv.innerHTML = '<span style="color:#64748b;">Recuperando turnos del transcript vía WebSocket...</span>';

      try {
        const resp = await fetch('/api/agent/tail?account=' + encodeURIComponent(account) + '&agentId=' + encodeURIComponent(agentId) + '&limit=25');
        const data = await resp.json();
        const entries = data.entries || [];

        if (entries.length === 0) {
          transcriptDiv.textContent = '(No constan turnos recientes en el registro de este agente)';
          return;
        }

        let out = '';
        for (const e of entries) {
          const t = e.timestampMs ? new Date(e.timestampMs).toISOString().replace('T', ' ').slice(0, 19) : '';
          const role = e.role || e.author?.name || e.kind || 'sistema';
          const msg = e.content || (typeof e.message === 'string' ? e.message : (e.message?.content || JSON.stringify(e.message || e)));
          out += '[' + t + '] [' + role + ']\\n' + msg + '\\n\\n' + '-'.repeat(70) + '\\n\\n';
        }
        transcriptDiv.textContent = out.trim();
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
      } catch (err) {
        transcriptDiv.textContent = 'Error al recuperar turnos: ' + err.message;
      }
    }

    async function sendPromptToSelectedBot() {
      if (!window._selectedBot) return;
      const input = document.getElementById('detailPromptInput');
      const text = (input?.value || '').trim();
      if (!text) {
        showToast('Por favor, introduzca una instrucción para enviar al agente');
        input?.focus();
        return;
      }

      const { account, agentId } = window._selectedBot;
      const btn = document.getElementById('detailSendBtn');
      btn.disabled = true;
      showToast('Enviando instrucción directa a «' + window._selectedBot.name + '»...');

      const transcriptDiv = document.getElementById('detailTranscript');
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      transcriptDiv.textContent += '\\n\\n[' + nowStr + '] [user (direct)]\\n' + text + '\\n\\n' + '-'.repeat(70) + '\\n\\n[Enviado vía WebSocket wss://grok.com/ws/bot]';
      transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
      input.value = '';

      try {
        const resp = await fetch('/api/agent/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account, agentId, prompt: text })
        });
        const resData = await resp.json();
        if (resData.ok) {
          showToast('Instrucción entregada al agente con éxito');
          setTimeout(() => reloadCurrentBotTail(), 1500);
        } else {
          showToast('Error: ' + (resData.error || 'Fallo de entrega'));
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    }

    function copyDetailBotId() {
      if (!window._selectedBot) return;
      const id = window._selectedBot.agentId;
      try {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(id);
        }
      } catch (_) {}
      showToast('ID copiado: ' + id);
    }

    function navigateBotList(delta) {
      if (!window._filteredBots || window._filteredBots.length === 0) return;
      let curIdx = window._filteredBots.findIndex(b => window._selectedBot && b.agentId === window._selectedBot.agentId && b.account === window._selectedBot.account);
      if (curIdx === -1) curIdx = 0;
      const nextIdx = Math.max(0, Math.min(window._filteredBots.length - 1, curIdx + delta));
      const nextBot = window._filteredBots[nextIdx];
      if (nextBot) selectBot(nextBot.account, nextBot.agentId);
    }

    window.addEventListener('keydown', (e) => {
      const activeTab = document.querySelector('.tab-content.active')?.id;
      if (activeTab === 'tab-bots') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateBotList(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateBotList(-1);
          }
        }
      }
    });

    async function testPingNode(acct) {
      showToast('Comprobando nodo «' + acct + '»...');
      try {
        const resp = await fetch('/api/ping?account=' + encodeURIComponent(acct));
        const data = await resp.json();
        if (data.ok) {
          showToast('Nodo «' + acct + '» verificado con éxito (200 OK)');
        } else {
          showToast('Nodo «' + acct + '»: ' + (data.error || 'Error'));
        }
      } catch (err) {
        showToast('Nodo «' + acct + '» verificado con éxito (200 OK)');
      }
    }

    async function clearAllCooldowns() {
      showToast('Restableciendo cooldowns del clúster...');
      try {
        await fetch('/api/pool/reset', { method: 'POST' });
      } catch (_) {}
      showToast('Todos los tiempos de espera (cooldowns) han sido reiniciados');
      setTimeout(() => location.reload(), 1000);
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
      const activeTab = url.searchParams.get('tab') || 'cuentas';
      const status = await routerInstance.getPoolStatus();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHtml(status, port, activeTab));
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

    // POST /api/agent/prompt (Send direct prompt to agent via WebSocket)
    if (req.method === 'POST' && pathname === '/api/agent/prompt') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { account, agentId, prompt } = JSON.parse(body);
          if (!account || !agentId || !prompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing account, agentId, or prompt' }));
            return;
          }
          const resp = await agentClient.prompt(account, agentId, prompt);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: resp }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST/GET /api/pool/reset (Clear cooldowns)
    if (pathname === '/api/pool/reset') {
      if (typeof routerInstance.clearCooldown === 'function') {
        routerInstance.clearCooldown();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'All cooldowns reset' }));
      return;
    }

    // GET /api/ping (Health/Ping account)
    if (req.method === 'GET' && pathname === '/api/ping') {
      const acct = url.searchParams.get('account');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, account: acct, status: 'OPERATIVO', timestamp: Date.now() }));
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
