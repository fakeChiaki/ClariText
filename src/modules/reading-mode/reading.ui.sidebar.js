import { OVERLAY_ID, SIDEBAR_ID } from './reading.config.js';
import { truncateUrl } from './reading.ui.utils.js';

// ─── Estado interno de la barra lateral ──────────────────────────────────────

let sidebar = null;
let sidebarOpen = false;
let sidebarToggleBtn = null;

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Construye la barra superior fija del overlay.
 *
 * @param {string}   title
 * @param {string}   url
 * @param {Object}   options
 * @param {Function} [options.onClose]
 * @returns {HTMLElement}
 */
export function buildTopBar(title, url, options = {}) {
  const { onClose } = options;
  const bar = document.createElement('div');
  bar.className = 'clrtxt-reading-topbar';

  const label = document.createElement('span');
  label.className = 'clrtxt-reading-label';
  label.textContent = '📖 Modo lectura';
  bar.appendChild(label);

  const urlEl = document.createElement('span');
  urlEl.className = 'clrtxt-reading-url';
  urlEl.textContent = truncateUrl(url);
  urlEl.title = url;
  bar.appendChild(urlEl);

  const sidebarBtn = document.createElement('button');
  sidebarBtn.type = 'button';
  sidebarBtn.className = 'clrtxt-reading-sidebar-toggle';
  sidebarBtn.textContent = 'Navegación ▸';
  sidebarBtn.setAttribute('aria-label', 'Abrir barra de navegación');
  sidebarBtn.addEventListener('click', () => toggleSidebar(sidebarBtn));
  bar.appendChild(sidebarBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'clrtxt-reading-close';
  closeBtn.textContent = '✕ Salir';
  closeBtn.setAttribute('aria-label', 'Salir del modo lectura');
  closeBtn.addEventListener('click', () => {
    if (typeof onClose === 'function') {
      onClose();
      return;
    }
    chrome.runtime.sendMessage({ type: 'reading:toggle', payload: { activate: false } });
  });
  bar.appendChild(closeBtn);

  return bar;
}

/**
 * Construye la barra lateral desplegable con los ítems de navegación.
 *
 * @param {import('./reading.engine.js').NavItem[]} items
 * @param {Object[]}                                sections
 * @returns {HTMLElement}
 */
export function buildSidebar(items, sections = []) {
  const panel = document.createElement('div');
  panel.id = SIDEBAR_ID;
  panel.className = 'clrtxt-reading-sidebar clrtxt-reading-sidebar--closed';
  panel.setAttribute('aria-hidden', 'true');

  panel.appendChild(buildSidebarHeading());
  if (sections.length > 0) {
    panel.appendChild(buildSectionSelector(sections));
  }

  buildGroupedLinks(items, sections).forEach(({ groupTitle, itemsList }) => {
    if (!itemsList.length) {
      return;
    }

    const heading = document.createElement('div');
    heading.className = 'clrtxt-sidebar-group-heading';
    heading.textContent = groupTitle;
    panel.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'clrtxt-sidebar-links-row';
    itemsList.forEach(({ label, href, type }) => {
      const el = type === 'link' ? document.createElement('a') : document.createElement('button');
      el.className = 'clrtxt-reading-nav-item clrtxt-reading-nav-inline';
      el.textContent = label;
      if (type === 'link' && href) {
        el.href = href;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      } else {
        el.type = 'button';
      }
      el.addEventListener('click', closeSidebar);
      row.appendChild(el);
    });
    panel.appendChild(row);
  });

  panel.addEventListener('click', (event) => event.stopPropagation());

  // Guardar referencia para cierre externo
  sidebar = panel;
  return panel;
}

/**
 * Cierra la barra lateral desde el overlay (clic fuera del panel).
 * Exportado para uso en reading.ui.overlay.js.
 */
export function closeSidebarIfOpen() {
  closeSidebar();
}

/**
 * Reinicia el estado interno (llamar desde unmountOverlay).
 */
export function resetSidebarState() {
  sidebar = null;
  sidebarOpen = false;
  sidebarToggleBtn = null;
}

// ─── Privado ──────────────────────────────────────────────────────────────────

function buildSidebarHeading() {
  const heading = document.createElement('div');
  heading.className = 'clrtxt-reading-sidebar-heading';

  const title = document.createElement('span');
  title.textContent = 'Navegación';
  heading.appendChild(title);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'clrtxt-reading-sidebar-close';
  closeButton.textContent = '✕';
  closeButton.setAttribute('aria-label', 'Cerrar navegación');
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    closeSidebar();
  });
  heading.appendChild(closeButton);

  return heading;
}

function buildSectionSelector(sections) {
  const wrap = document.createElement('div');
  wrap.className = 'clrtxt-section-selector-wrap';

  const selector = document.createElement('select');
  selector.className = 'clrtxt-section-selector';

  sections.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title;
    selector.appendChild(opt);
  });

  selector.addEventListener('change', () => {
    const target = document.getElementById(selector.value);
    if (!target) {
      return;
    }
    const scrollAreaEl = document.querySelector(`#${OVERLAY_ID} .clrtxt-reading-scroll`);
    if (scrollAreaEl) {
      const top = target.offsetTop - (scrollAreaEl.offsetTop || 0) - 24;
      scrollAreaEl.scrollTo({ top, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  wrap.appendChild(selector);
  return wrap;
}

/**
 * Agrupa los ítems de navegación por sección heurísticamente.
 *
 * @returns {{ groupTitle: string, itemsList: Object[] }[]}
 */
function buildGroupedLinks(items, sections) {
  const groups = new Map();
  sections.forEach((s) => groups.set(s.title, []));
  groups.set('Enlaces', []);

  items.forEach((item) => {
    if (item.context === 'table' || item.context === 'list' || item.context === 'nav') {
      return;
    }
    const label = item.label || 'link';
    let placed = false;

    try {
      if (item.href?.startsWith('#')) {
        const targetId = item.href.slice(1);
        const sect = sections.find(
          (s) => s.id === targetId || s.title.toLowerCase().includes(targetId.toLowerCase()),
        );
        if (sect) {
          groups.get(sect.title).push(item);
          placed = true;
        }
      }
    } catch (e) {
      /* ignorar */
    }

    if (!placed) {
      const match = sections.find((s) =>
        label.toLowerCase().includes(s.title.toLowerCase().slice(0, 12)),
      );
      if (match) {
        groups.get(match.title).push(item);
        placed = true;
      }
    }

    if (!placed) {
      groups.get('Enlaces').push(item);
    }
  });

  return [...groups.entries()].map(([groupTitle, itemsList]) => ({ groupTitle, itemsList }));
}

function closeSidebar() {
  if (!sidebar || !sidebarOpen) {
    return;
  }
  sidebarOpen = false;
  sidebar.classList.add('clrtxt-reading-sidebar--closed');
  sidebar.setAttribute('aria-hidden', 'true');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.textContent = 'Navegación ▸';
  }
}

function toggleSidebar(toggleBtn) {
  if (!sidebar) {
    return;
  }
  sidebarToggleBtn = toggleBtn;
  sidebarOpen = !sidebarOpen;
  sidebar.classList.toggle('clrtxt-reading-sidebar--closed', !sidebarOpen);
  sidebar.setAttribute('aria-hidden', String(!sidebarOpen));
  toggleBtn.textContent = sidebarOpen ? 'Navegación ◂' : 'Navegación ▸';
}
