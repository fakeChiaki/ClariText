import { OVERLAY_ID, SIDEBAR_ID, READING_DEFAULTS } from './reading.config.js';
import { injectStyles } from './reading.ui.styles.js';
import {
  normalizeDlGroups,
  renderTableBlock,
  renderListBlock,
  renderDtGroup,
  renderDlGroup,
} from './reading.ui.blocks.js';
import {
  buildTopBar,
  buildSidebar,
  closeSidebarIfOpen,
  resetSidebarState,
} from './reading.ui.sidebar.js';
import { sanitizeNode } from './reading.ui.utils.js';

/**
 * @typedef {import('./reading.engine.js').ExtractedContent} ExtractedContent
 */

// ─── Estado interno del overlay ──────────────────────────────────────────────

let column = null; // Referencia a la columna de texto, accesible desde applyReadingStyles()

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Crea e inyecta el overlay de modo lectura en el documento.
 *
 * @param {ExtractedContent} content
 * @param {Object}           prefs   - Preferencias del usuario (del storage).
 * @param {Object}           options - Callbacks adicionales.
 */
export function mountOverlay(content, prefs = {}, options = {}) {
  if (document.getElementById(OVERLAY_ID)) {
    return;
  }

  const cfg = { ...READING_DEFAULTS, ...prefs };
  if (prefs?.forceBlackText) {
    cfg.textColor = '#000000';
  }

  injectStyles(cfg);
  const overlay = buildOverlay(content, cfg, options);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

/**
 * Elimina el overlay y restaura la página original.
 */
export function unmountOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById('clrtxt-reading-styles')?.remove();
  document.body.style.overflow = '';
  column = null;
  resetSidebarState();
}

/**
 * Indica si el overlay está actualmente montado.
 *
 * @returns {boolean}
 */
export function isOverlayMounted() {
  return !!document.getElementById(OVERLAY_ID);
}

/**
 * Aplica estilos tipográficos a la columna de texto del overlay.
 * Llamado desde reading.module.js al recibir eventos de otros módulos.
 *
 * @param {{ lineHeight?, letterSpacing?, fontFamily?, fontSize? }} styles
 */
export function applyReadingStyles({ lineHeight, letterSpacing, fontFamily, fontSize } = {}) {
  if (!column) {
    return;
  }
  if (lineHeight !== null) {
    column.style.lineHeight = lineHeight;
  }
  if (letterSpacing !== null) {
    column.style.letterSpacing = `${letterSpacing}em`;
  }
  if (fontFamily !== null) {
    column.style.fontFamily = fontFamily;
  }
  if (fontSize !== null) {
    column.style.fontSize = `${fontSize}px`;
    const titleEl = column.querySelector('.clrtxt-reading-title');
    if (titleEl) {
      titleEl.style.fontSize = `${Math.round(fontSize * 1.8)}px`;
    }
  }
}

// ─── Construcción del overlay ─────────────────────────────────────────────────

function buildOverlay(content, cfg, options) {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.className = 'clrtxt-reading-overlay';

  root.addEventListener('click', (event) => {
    const sidebarEl = document.getElementById(SIDEBAR_ID);
    const toggleBtn = root.querySelector('.clrtxt-reading-sidebar-toggle');
    if (sidebarEl?.contains(event.target) || toggleBtn?.contains(event.target)) {
      return;
    }
    closeSidebarIfOpen();
  });

  root.appendChild(buildTopBar(content.title, content.url, options));

  const scrollArea = document.createElement('div');
  scrollArea.className = 'clrtxt-reading-scroll';

  column = buildContentColumn(content);
  scrollArea.appendChild(column);
  root.appendChild(scrollArea);

  if (content.navItems.length > 0) {
    root.appendChild(buildSidebar(content.navItems, buildSections(content.nodes)));
  }

  return root;
}

/**
 * Construye la columna central con el título y los nodos de contenido
 * organizados en secciones navegables.
 *
 * @param {ExtractedContent} content
 * @returns {HTMLElement}
 */
function buildContentColumn(content) {
  const col = document.createElement('div');
  col.className = 'clrtxt-reading-column';

  const titleEl = document.createElement('h1');
  titleEl.className = 'clrtxt-reading-title';
  titleEl.textContent = content.title;
  col.appendChild(titleEl);

  const separator = document.createElement('div');
  separator.className = 'clrtxt-reading-separator';
  col.appendChild(separator);

  buildSections(content.nodes).forEach((section) => {
    const sectionWrap = document.createElement('section');
    sectionWrap.className = 'clrtxt-reading-section';
    sectionWrap.id = section.id;

    section.nodes.forEach((item) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'clrtxt-reading-node';
      renderItem(wrapper, item);
      sectionWrap.appendChild(wrapper);
    });

    col.appendChild(sectionWrap);
  });

  return col;
}

/**
 * Despacha el renderizado de un ítem al helper correcto.
 *
 * @param {HTMLElement} wrapper
 * @param {Node|Object} item
 */
function renderItem(wrapper, item) {
  const tag = (item.tagName || '').toUpperCase();
  if (item.type === 'dt-group') {
    renderDtGroup(wrapper, item);
  } else if (item.type === 'dl-group') {
    renderDlGroup(wrapper, item);
  } else if (tag === 'TABLE' || item.querySelector?.('table')) {
    renderTableBlock(wrapper, item);
  } else if (['UL', 'OL', 'DL'].includes(tag) || item.querySelector?.('ul, ol, dl')) {
    renderListBlock(wrapper, item);
  } else {
    wrapper.appendChild(sanitizeNode(item));
  }
}

/**
 * Organiza los nodos en secciones usando los encabezados (H1-H6) como puntos
 * de corte. Devuelve un array de secciones con id, title y nodes.
 *
 * @param {Node[]} nodes
 * @returns {{ id: string, title: string, nodes: Array }[]}
 */
function buildSections(nodes) {
  const sections = [];
  let current = { id: 'section-0', title: 'Inicio', nodes: [] };
  sections.push(current);

  normalizeDlGroups(nodes).forEach((item) => {
    const node = item.type === 'dl-group' ? item.nodes[0] : item;
    const tag = (node.tagName || '').toUpperCase();

    if (/^H[1-6]$/.test(tag)) {
      const title =
        (node.innerText || node.textContent || '').trim() || `Sección ${sections.length}`;
      current = { id: `section-${sections.length}`, title, nodes: [] };
      sections.push(current);
    }

    current.nodes.push(item);
  });

  return sections;
}
