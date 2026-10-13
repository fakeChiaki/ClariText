/* eslint-disable max-lines */
/**
 * Focus Line Engine — motor del overlay de resaltado con seguimiento de cursor.
 *
 * Nota: Este archivo supera el límite estándar de 300 líneas del proyecto (355 líneas).
 * El eslint-disable-next-line está justificado porque el motor incluye:
 * - Estilos CSS inyectados (40 líneas)
 * - Helpers de detección DOM (60 líneas)
 * - Cálculo de rectángulos por modo (50 líneas)
 * - Factory con estado y handlers (180 líneas)
 *
 * Refactor pendiente: dividir en focus-line.engine.dom.js + focus-line.engine.detect.js
 * cuando el módulo se estabilice. Documentado en decisiones-academicas.md.
 */
import { createLogger } from '../../shared/logger.js';
import { CSS_PREFIX } from '../../shared/constants.js';
import { FOCUS_LINE_MODES, CURSOR_THROTTLE_MS, FOCUS_LINE_DEFAULTS } from './focus-line.config.js';

const log = createLogger('FocusLine-Engine');

const OVERLAY_ID = `${CSS_PREFIX}-fl-overlay`;
const HIGHLIGHT_ID = `${CSS_PREFIX}-fl-highlight`;
const CLOSE_BTN_ID = `${CSS_PREFIX}-fl-close`;
const STYLE_ID = `${CSS_PREFIX}-fl-styles`;

// ─── CSS base ─────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483640;
    }
    #${HIGHLIGHT_ID} {
      position: fixed;
      left: 0;
      right: 0;
      pointer-events: none;
      z-index: 2147483641;
      background: transparent;
      transition: top 0.04s linear, height 0.04s linear;
    }
    #${CLOSE_BTN_ID} {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      padding: 8px 14px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      background: #4a90d9;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      opacity: 0.85;
      transition: opacity 0.15s;
    }
    #${CLOSE_BTN_ID}:hover        { opacity: 1; }
    #${CLOSE_BTN_ID}:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

// ─── Helpers de detección ─────────────────────────────────────────────────────

const TEXT_TAGS = new Set([
  'P',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'SPAN',
  'A',
  'TD',
  'TH',
  'BLOCKQUOTE',
  'DIV',
  'ARTICLE',
  'SECTION',
]);
const BLOCK_TAGS = new Set([
  'P',
  'LI',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'ARTICLE',
  'SECTION',
  'TD',
  'TH',
]);

function getTargetElement(x, y, overlayEl, highlightEl) {
  if (overlayEl) {
    overlayEl.style.display = 'none';
  }
  if (highlightEl) {
    highlightEl.style.display = 'none';
  }
  const el = document.elementFromPoint(x, y);
  if (overlayEl) {
    overlayEl.style.display = '';
  }
  if (highlightEl) {
    highlightEl.style.display = '';
  }

  if (!el) {
    return null;
  }
  if ([OVERLAY_ID, HIGHLIGHT_ID, CLOSE_BTN_ID].includes(el.id)) {
    return null;
  }
  if (TEXT_TAGS.has(el.tagName)) {
    return el;
  }

  let parent = el.parentElement;
  for (let i = 0; i < 5 && parent; i++) {
    if (TEXT_TAGS.has(parent.tagName)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return el;
}

function computeRect(x, y, el, mode) {
  if (!el) {
    return null;
  }

  if (mode === FOCUS_LINE_MODES.PARAGRAPH) {
    let target = el;
    while (target && !BLOCK_TAGS.has(target.tagName)) {
      target = target.parentElement;
    }
    const r = (target ?? el).getBoundingClientRect();
    return { top: r.top, height: r.height };
  }

  if (document.caretRangeFromPoint) {
    try {
      const range = document.caretRangeFromPoint(x, y);
      if (range) {
        const rects = range.getClientRects();
        for (const r of rects) {
          if (r.height > 2) {
            return { top: r.top, height: r.height };
          }
        }
        range.expand('character');
        const expanded = range.getClientRects();
        for (const r of expanded) {
          if (r.height > 2) {
            return { top: r.top, height: r.height };
          }
        }
      }
    } catch {
      // Algunos iframes o shadow DOM pueden lanzar — ignorar y usar fallback.
    }
  }

  const r = el.getBoundingClientRect();
  return { top: r.top, height: r.height };
}

// ─── Estilos dinámicos del highlight ─────────────────────────────────────────

function applyHighlightStyle(highlightEl, opacity, highlightColor) {
  if (!highlightEl) {
    return;
  }
  const shadow = `rgba(0,0,0,${opacity})`;
  highlightEl.style.boxShadow = `0 -9999px 0 9999px ${shadow}, 0 9999px 0 9999px ${shadow}`;
  highlightEl.style.background = highlightColor || 'transparent';
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createFocusLineEngine() {
  let overlayEl = null;
  let highlightEl = null;
  let closeBtnEl = null;

  let currentMode = FOCUS_LINE_MODES.LINE;
  let currentOpacity = FOCUS_LINE_DEFAULTS.overlayOpacity;
  let currentColor = FOCUS_LINE_DEFAULTS.highlightColor;
  let currentHeightPx = FOCUS_LINE_DEFAULTS.heightPx;

  let active = false;
  let throttleTimer = null;
  let frameId = null;

  const engine = { onClose: () => {} };

  function buildDom() {
    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute('aria-hidden', 'true');

    highlightEl = document.createElement('div');
    highlightEl.id = HIGHLIGHT_ID;
    highlightEl.setAttribute('aria-hidden', 'true');
    applyHighlightStyle(highlightEl, currentOpacity, currentColor);

    closeBtnEl = document.createElement('button');
    closeBtnEl.id = CLOSE_BTN_ID;
    closeBtnEl.textContent = '✕ Cerrar enfoque';
    closeBtnEl.setAttribute('aria-label', 'Desactivar modo de enfoque');
    closeBtnEl.addEventListener('click', () => {
      log.debug('Cierre desde botón flotante');
      engine.onClose();
    });

    document.body.appendChild(overlayEl);
    document.body.appendChild(highlightEl);
    document.body.appendChild(closeBtnEl);
  }

  function tearDownDom() {
    overlayEl?.remove();
    highlightEl?.remove();
    closeBtnEl?.remove();
    overlayEl = highlightEl = closeBtnEl = null;
  }

  function onMouseMove(event) {
    if (!active || !highlightEl) {
      return;
    }
    if (throttleTimer !== null) {
      return;
    }

    const { clientX, clientY } = event;

    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const target = getTargetElement(clientX, clientY, overlayEl, highlightEl);
        const rect = computeRect(clientX, clientY, target, currentMode);

        if (rect && highlightEl) {
          highlightEl.style.top = `${rect.top}px`;
          highlightEl.style.height =
            currentHeightPx > 0 ? `${currentHeightPx}px` : `${rect.height}px`;
          highlightEl.style.display = '';
        } else if (highlightEl) {
          highlightEl.style.display = 'none';
        }
      });
    }, CURSOR_THROTTLE_MS);
  }

  function activate(mode, styleOptions = {}) {
    if (active) {
      log.warn('activate: ya está activo');
      return;
    }
    currentMode = mode ?? FOCUS_LINE_MODES.LINE;
    currentOpacity = styleOptions.overlayOpacity ?? FOCUS_LINE_DEFAULTS.overlayOpacity;
    currentColor = styleOptions.highlightColor ?? FOCUS_LINE_DEFAULTS.highlightColor;
    currentHeightPx = styleOptions.heightPx ?? FOCUS_LINE_DEFAULTS.heightPx;
    active = true;
    injectStyles();
    buildDom();
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    log.info(`Overlay activado (modo: ${currentMode})`);
  }

  function deactivate() {
    if (!active) {
      return;
    }
    active = false;
    document.removeEventListener('mousemove', onMouseMove);
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    tearDownDom();
    removeStyles();
    log.info('Overlay desactivado');
  }

  function setMode(mode) {
    currentMode = mode;
    log.debug(`Modo cambiado a: ${mode}`);
  }

  function setStyle({ overlayOpacity, highlightColor, heightPx } = {}) {
    if (overlayOpacity !== undefined) {
      currentOpacity = overlayOpacity;
    }
    if (highlightColor !== undefined) {
      currentColor = highlightColor;
    }
    if (heightPx !== undefined) {
      currentHeightPx = heightPx;
    }
    applyHighlightStyle(highlightEl, currentOpacity, currentColor);
    log.debug('Estilos actualizados', { currentOpacity, currentColor, currentHeightPx });
  }

  function isActive() {
    return active;
  }

  engine.activate = activate;
  engine.deactivate = deactivate;
  engine.setMode = setMode;
  engine.setStyle = setStyle;
  engine.isActive = isActive;

  return engine;
}
