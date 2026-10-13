import { OVERLAY_ID } from './reading.config.js';

// ─── Estilos ──────────────────────────────────────────────────────────────────

/**
 * Inyecta la hoja de estilos del overlay en el <head>.
 * Si ya existe no hace nada.
 *
 * @param {Object} cfg
 */
export function injectStyles(cfg) {
  if (document.getElementById('clrtxt-reading-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'clrtxt-reading-styles';
  style.textContent = buildCSS(cfg);
  document.head.appendChild(style);
}

/**
 * Genera el CSS completo del módulo de lectura a partir de la configuración.
 *
 * @param {Object} cfg
 * @returns {string}
 */
function buildCSS(cfg) {
  return `
    /* ── ClariText · Modo lectura ── */

    #${OVERLAY_ID} {
      position: fixed !important; inset: 0 !important;
      z-index: 2147482000 !important;
      background: ${cfg.backgroundColor} !important;
      color: ${cfg.textColor} !important;
      font-family: ${cfg.fontFamily} !important;
      display: flex !important; flex-direction: column !important; overflow: hidden !important;
    }

    /* ── Barra superior ── */
    .clrtxt-reading-topbar {
      display: flex !important; align-items: center !important; gap: 12px !important;
      padding: 10px 20px !important;
      background: ${cfg.sidebarBackground} !important;
      border-bottom: 1px solid rgba(0,0,0,0.1) !important; flex-shrink: 0 !important;
    }
    .clrtxt-reading-label  { font-size: 13px !important; font-weight: 600 !important; letter-spacing: 0.02em !important; color: #555 !important; white-space: nowrap !important; }
    .clrtxt-reading-url    { font-size: 11px !important; color: #888 !important; flex: 1 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }

    .clrtxt-reading-sidebar-toggle, .clrtxt-reading-close {
      padding: 5px 12px !important; border: 1px solid rgba(0,0,0,0.18) !important;
      border-radius: 6px !important; background: white !important; color: #333 !important;
      font-size: 12px !important; cursor: pointer !important; white-space: nowrap !important;
      transition: background 0.15s !important; font-family: inherit !important;
    }
    .clrtxt-reading-sidebar-toggle:hover, .clrtxt-reading-close:hover { background: #e8e7e4 !important; }
    .clrtxt-reading-close { color: #c0392b !important; border-color: rgba(192,57,43,0.3) !important; }

    /* ── Área de scroll ── */
    .clrtxt-reading-scroll {
      flex: 1 !important; overflow-y: auto !important; padding: 48px 24px 84px !important;
      display: flex !important; justify-content: center !important; align-items: flex-start !important;
      min-height: 0 !important; box-sizing: border-box !important;
    }

    /* ── Columna de texto ── */
    .clrtxt-reading-column {
      max-width: ${cfg.maxWidth}px !important; width: 100% !important;
      font-size: ${cfg.fontSize}px !important; line-height: ${cfg.lineHeight} !important;
      padding-bottom: 32px !important; box-sizing: border-box !important;
      min-height: 0 !important; margin: 0 auto !important;
      padding-left: 8px !important; padding-right: 8px !important;
    }
    .clrtxt-reading-title {
      font-size: ${Math.round(cfg.fontSize * 1.8)}px !important; font-weight: 700 !important;
      line-height: 1.2 !important; margin: 0 0 16px 0 !important; color: ${cfg.textColor} !important;
    }
    .clrtxt-reading-separator {
      height: 2px !important;
      background: linear-gradient(90deg, rgba(0,0,0,0.12), transparent) !important;
      margin-bottom: 32px !important; border: none !important;
    }

    /* ── Nodos de contenido ── */
    .clrtxt-reading-node { margin-bottom: 1.2em !important; }
    .clrtxt-reading-node h1, .clrtxt-reading-node h2, .clrtxt-reading-node h3,
    .clrtxt-reading-node h4, .clrtxt-reading-node h5, .clrtxt-reading-node h6 {
      font-weight: 700 !important; margin: 1.5em 0 0.5em 0 !important;
      line-height: 1.3 !important; color: ${cfg.textColor} !important;
    }
    .clrtxt-reading-node p { margin: 0 0 1em 0 !important; }
    .clrtxt-reading-node blockquote {
      border-left: 3px solid rgba(0,0,0,0.2) !important; margin: 1em 0 !important;
      padding: 4px 16px !important; color: #555 !important; font-style: italic !important;
    }
    .clrtxt-reading-node ul, .clrtxt-reading-node ol { padding-left: 1.5em !important; margin: 0.5em 0 !important; }

    /* ── Barra lateral ── */
    .clrtxt-reading-sidebar {
      position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important;
      width: 360px !important; background: ${cfg.sidebarBackground} !important;
      border-left: 1px solid rgba(0,0,0,0.1) !important; overflow-y: auto !important;
      padding: 64px 16px 24px !important; transform: translateX(0) !important;
      transition: transform 0.25s ease !important; z-index: 2147483648 !important;
    }
    .clrtxt-reading-sidebar--closed { transform: translateX(100%) !important; }
    .clrtxt-reading-sidebar-heading {
      display: flex !important; justify-content: space-between !important; align-items: center !important;
      font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important;
      letter-spacing: 0.08em !important; color: #888 !important; margin: 0 0 12px 0 !important;
    }
    .clrtxt-reading-sidebar-close {
      border: none !important; background: transparent !important; color: #888 !important;
      font-size: 14px !important; cursor: pointer !important; padding: 4px 8px !important;
      border-radius: 6px !important; transition: background 0.15s ease !important;
    }
    .clrtxt-reading-sidebar-close:hover { background: rgba(0,0,0,0.05) !important; }
    .clrtxt-reading-sidebar-list {
      list-style: none !important; margin: 0 !important; padding: 0 !important;
      display: flex !important; flex-direction: column !important; gap: 4px !important;
    }
    .clrtxt-reading-nav-item {
      display: block !important; width: 100% !important; padding: 8px 12px !important;
      border-radius: 6px !important; font-size: 13px !important; color: #333 !important;
      text-decoration: none !important; background: transparent !important; border: none !important;
      text-align: left !important; cursor: pointer !important; font-family: inherit !important;
      transition: background 0.12s !important; line-height: 1.4 !important;
      white-space: normal !important; word-break: break-word !important;
    }
    .clrtxt-reading-nav-item:hover { background: rgba(0,0,0,0.07) !important; }

    /* ── Tablas y listas colapsables ── */
    .clrtxt-table-collapsed {
      display: flex !important; justify-content: space-between !important; align-items: center !important;
      padding: 12px 14px !important; border: 1px solid rgba(0,0,0,0.1) !important;
      border-radius: 10px !important; background: rgb(255 255 255) !important;
      margin-bottom: 8px !important; gap: 12px !important;
    }
    .clrtxt-table-title {
      font-weight: 700 !important; font-size: 15px !important; line-height: 1.2 !important;
      color: ${cfg.textColor} !important; flex: 1 1 auto !important; min-width: 0 !important;
      overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;
    }
    .clrtxt-table-toggle {
      padding: 6px 10px !important; border-radius: 8px !important; cursor: pointer !important;
      font-size: 12px !important; min-width: 88px !important; border: 1px solid #000000 !important;
    }
    .clrtxt-expanded-block {
      margin-top: 10px !important; padding: 14px !important;
      border: 1px solid rgba(0,0,0,0.08) !important; border-radius: 10px !important;
      background: #fff !important; box-shadow: 0 8px 18px rgba(0,0,0,0.06) !important;
    }
    .clrtxt-table-expanded { margin-top: 0 !important; overflow: auto !important; max-width: 100% !important; }
    .clrtxt-table {
      width: 100% !important; border-collapse: collapse !important;
      background: #fff !important; font-size: 13px !important;
    }
    .clrtxt-table th, .clrtxt-table td {
      border: 1px solid rgba(0,0,0,0.08) !important; padding: 10px 12px !important;
      text-align: left !important; vertical-align: top !important; word-break: break-word !important;
    }
    .clrtxt-table th { background: #f4f0e9 !important; font-weight: 700 !important; }
    .clrtxt-table tr:nth-child(even) td { background: rgba(0,0,0,0.02) !important; }

    /* ── Color de texto global en nodos (excluye enlaces) ── */
    .clrtxt-reading-node, .clrtxt-reading-node *:not(a):not(a *) { color: ${cfg.textColor} !important; }
    .clrtxt-reading-node a, .clrtxt-reading-node a * { color: #1a73e8 !important; }
    #${OVERLAY_ID} a, #${OVERLAY_ID} a * { color: #1a73e8 !important; }

    /* ── Sidebar: grupos e inline links ── */
    .clrtxt-sidebar-group-heading { font-size: 12px !important; font-weight: 700 !important; margin: 14px 0 6px 0 !important; color: #666 !important; }
    .clrtxt-sidebar-links-row { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; }
    .clrtxt-reading-nav-inline {
      display: inline-flex !important; align-items: center !important;
      padding: 6px 10px !important; border-radius: 6px !important;
      background: transparent !important; border: 1px solid rgba(0,0,0,0.04) !important;
      font-size: 13px !important; white-space: normal !important; word-break: break-word !important;
      max-width: calc(100% - 16px) !important;
    }
    .clrtxt-reading-nav-inline:hover { background: rgba(0,0,0,0.05) !important; }

    .clrtxt-section-selector-wrap { margin-bottom: 12px !important; }
    .clrtxt-section-selector { width: 100% !important; padding: 8px 10px !important; border-radius: 6px !important; border: 1px solid rgb(0 0 0) !important; background: #ffffff !important; }
  `;
}
