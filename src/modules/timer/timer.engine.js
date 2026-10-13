/**
 * Timer Engine — widget de concentración + bloqueo de navegación.
 */

import { createLogger } from '../../shared/logger.js';
import { CSS_PREFIX } from '../../shared/constants.js';

const log = createLogger('Timer-Engine');

const WIDGET_ID = `${CSS_PREFIX}-timer-widget`;
const COUNTER_ID = `${CSS_PREFIX}-timer-counter`;
const UNLOCK_ID = `${CSS_PREFIX}-timer-unlock`;
const STYLE_ID = `${CSS_PREFIX}-timer-styles`;

// ─── CSS ─────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${WIDGET_ID} {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      background: rgba(30, 30, 30, 0.92);
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.35);
      font-family: 'Segoe UI', system-ui, sans-serif;
      backdrop-filter: blur(6px);
      user-select: none;
    }
    #${COUNTER_ID} {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.5px;
      min-width: 42px;
    }
    #${UNLOCK_ID} {
      padding: 4px 10px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      background: transparent;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    #${UNLOCK_ID}:hover {
      color: #ffffff;
      border-color: rgba(255,255,255,0.7);
      background: rgba(255,255,255,0.08);
    }
    #${UNLOCK_ID}:focus-visible {
      outline: 2px solid #4a90d9;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Notifica al service worker para registrar o liberar el bloqueo de pestaña. */
async function notifyServiceWorker(type) {
  try {
    await chrome.runtime.sendMessage({ type });
  } catch {
    // El SW puede no estar activo todavía — no es crítico
    log.warn(`No se pudo notificar al SW: ${type}`);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createTimerEngine() {
  let widgetEl = null;
  let counterEl = null;

  let tickInterval = null;
  let remainingSeconds = 0;
  let active = false;

  const engine = {
    onTick: () => {},
    onEnd: () => {},
  };

  // ── DOM ──────────────────────────────────────────────────────────────────

  function buildDom() {
    widgetEl = document.createElement('div');
    widgetEl.id = WIDGET_ID;
    widgetEl.setAttribute('role', 'status');
    widgetEl.setAttribute('aria-label', 'Modo concentración activo');

    counterEl = document.createElement('span');
    counterEl.id = COUNTER_ID;
    counterEl.textContent = formatTime(remainingSeconds);

    const unlockEl = document.createElement('button');
    unlockEl.id = UNLOCK_ID;
    unlockEl.textContent = 'Desbloquear';
    unlockEl.addEventListener('click', () => {
      log.debug('Desbloqueo manual');
      stopInternal();
      engine.onEnd();
    });

    widgetEl.appendChild(counterEl);
    widgetEl.appendChild(unlockEl);
    document.body.appendChild(widgetEl);
  }

  function tearDownDom() {
    widgetEl?.remove();
    widgetEl = counterEl = null;
  }

  // ── Tick ─────────────────────────────────────────────────────────────────

  function startTick() {
    tickInterval = setInterval(() => {
      remainingSeconds -= 1;
      if (counterEl) {
        counterEl.textContent = formatTime(remainingSeconds);
      }
      engine.onTick({ remaining: remainingSeconds });

      if (remainingSeconds <= 0) {
        log.info('Tiempo agotado');
        stopInternal();
        engine.onEnd();
      }
    }, 1000);
  }

  function stopTick() {
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  // ── Bloqueadores de navegación (content script) ───────────────────────────

  function handleBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = '';
  }

  function handleLinkClick(event) {
    const link = event.target.closest('a[href]');
    if (!link) {
      return;
    }
    const href = link.getAttribute('href');
    if (href && !href.startsWith('#')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      log.debug('Navegación bloqueada:', href);
    }
  }

  function attachBlockers() {
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleLinkClick, { capture: true });
  }

  function detachBlockers() {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('click', handleLinkClick, { capture: true });
  }

  // ── stop interno vs externo ───────────────────────────────────────────────

  function stopInternal() {
    if (!active) {
      return;
    }
    active = false;
    stopTick();
    detachBlockers();
    tearDownDom();
    removeStyles();
    // Avisar al SW que ya no hay bloqueo
    notifyServiceWorker('timer:unlock');
    log.info('Engine detenido (interno)');
  }

  // ── API pública ───────────────────────────────────────────────────────────

  function start(durationMin) {
    if (active) {
      log.warn('start: ya está activo');
      return;
    }
    remainingSeconds = durationMin * 60;
    active = true;
    injectStyles();
    buildDom();
    attachBlockers();
    startTick();
    // Avisar al SW que esta pestaña está bloqueada
    notifyServiceWorker('timer:lock');
    log.info(`Widget iniciado (${durationMin} min)`);
  }

  function stop() {
    if (!active) {
      return;
    }
    active = false;
    stopTick();
    detachBlockers();
    tearDownDom();
    removeStyles();
    // Avisar al SW que ya no hay bloqueo
    notifyServiceWorker('timer:unlock');
    log.info('Engine detenido (externo)');
  }

  function isActive() {
    return active;
  }
  function getRemaining() {
    return remainingSeconds;
  }

  engine.start = start;
  engine.stop = stop;
  engine.isActive = isActive;
  engine.getRemaining = getRemaining;

  return engine;
}
