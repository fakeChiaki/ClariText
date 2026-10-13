import {
  CONTENT_SELECTORS,
  NOISE_SELECTORS,
  NARRATIVE_TAGS,
  INTERACTIVE_TAGS,
  NAVIGABLE_HREF_PATTERNS,
} from './reading.config.js';

/**
 * @typedef {Object} ExtractedContent
 * @property {string}    title    - Título de la página.
 * @property {string}    url      - URL actual.
 * @property {Node[]}    nodes    - Nodos narrativos clonados y saneados.
 * @property {NavItem[]} navItems - Links y botones navegables detectados.
 */

/**
 * @typedef {Object} NavItem
 * @property {string} label - Texto visible del elemento.
 * @property {string} href  - Destino ('' si es botón sin href).
 * @property {string} type  - 'link' | 'button'.
 */

export function createReadingEngine() {
  /**
   * Extrae el contenido principal de la página activa.
   * No modifica el DOM original; trabaja sobre clones.
   *
   * @returns {ExtractedContent}
   */
  function extract() {
    const title = resolveTitle();
    const url = window.location.href;
    const root = resolveContentRoot();
    const cleaned = cloneAndClean(root);
    const nodes = collectNarrativeNodes(cleaned);
    const navItems = collectNavItems(root);
    return { title, url, nodes, navItems };
  }

  function resolveTitle() {
    const og = document.querySelector('meta[property="og:title"]');
    if (og?.content) {
      return og.content.trim();
    }
    const h1 = document.querySelector('h1');
    if (h1?.textContent) {
      return h1.textContent.trim();
    }
    return document.title.trim() || 'Sin título';
  }

  function resolveContentRoot() {
    for (const selector of CONTENT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && hasEnoughText(el)) {
        return el;
      }
    }
    return document.body;
  }

  function hasEnoughText(el) {
    return (el.innerText || el.textContent || '').trim().length > 200;
  }

  function cloneAndClean(root) {
    const clone = root.cloneNode(true);
    for (const selector of NOISE_SELECTORS) {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    }
    clone.querySelectorAll('*').forEach((el) => {
      if (el.style.display === 'none' || el.style.visibility === 'hidden') {
        el.remove();
      }
    });
    return clone;
  }

  function collectNarrativeNodes(root) {
    const nodes = [];
    const seen = new Set();

    root.querySelectorAll('*').forEach((el) => {
      if (!NARRATIVE_TAGS.has(el.tagName)) {
        return;
      }
      if (
        el.closest(
          'nav, [role="navigation"], .navbar, .nav, .nav-menu, .toc, .sidebar-nav, .page-nav',
        )
      ) {
        return;
      }

      // if any ancestor was already captured, skip to avoid duplicates
      let ancestor = el.parentElement;
      while (ancestor) {
        if (seen.has(ancestor)) {
          return;
        }
        ancestor = ancestor.parentElement;
      }

      const text = (el.innerText || el.textContent || '').trim();
      if (text.length < 5) {
        return;
      }

      seen.add(el);
      nodes.push(el.cloneNode(true));
    });

    return nodes;
  }

  function collectNavItems(root) {
    const seen = new Set();
    const items = [];
    root.querySelectorAll('a, button').forEach((el) => {
      if (!INTERACTIVE_TAGS.has(el.tagName)) {
        return;
      }
      const label = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
      if (!label || label.length < 2) {
        return;
      }
      const href = el.getAttribute('href') || '';
      const type = el.tagName === 'A' ? 'link' : 'button';
      if (type === 'link') {
        const isNavigable = NAVIGABLE_HREF_PATTERNS.some((re) => re.test(href));
        if (!isNavigable) {
          return;
        }
      }
      const key = `${label}::${href}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      // Detectar contexto del enlace: dentro de tabla, lista, nav, u otro
      const inTable = !!el.closest('table');
      const inList = !!el.closest('ul, ol, dl');
      const inNav = !!el.closest('nav, [role="navigation"], .navbar, .toc');

      const context = inTable ? 'table' : inList ? 'list' : inNav ? 'nav' : 'default';
      if (context === 'nav') {
        return;
      }

      items.push({ label, href, type, context });
    });
    return items;
  }

  return { extract };
}

// Alias de clase para compatibilidad con imports que usen `new ReadingEngine()`.
// Internamente sigue siendo una factory; el constructor simplemente la invoca.
export class ReadingEngine {
  #engine;
  constructor() {
    this.#engine = createReadingEngine();
  }
  extract() {
    return this.#engine.extract();
  }
}
