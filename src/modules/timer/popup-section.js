/**
 * Sección del popup para el módulo Timer.
 */

import { storage } from '../../core/storage.js';
import { createLogger } from '../../shared/logger.js';
import { MODULES } from '../../shared/constants.js';
import { ICON_LOCK } from '../../popup/icons.js';
import {
  sendMessageToContent,
  sendMessageToContentWithResponse,
} from '../../popup/messaging-helpers.js';
import { TIMER_MESSAGES, TIMER_DEFAULTS, STORAGE_KEYS } from './timer.config.js';

const log = createLogger('TimerPopupSection');
const timerStorage = storage.namespace(MODULES.BREAK_TIMER);

// ─── Estado de la sección ─────────────────────────────────────────────────────

const dom = {
  toggle: null,
  durationEl: null,
  durationVal: null,
  statusRow: null,
  remainingEl: null,
};

let pollInterval = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setStatusRowVisible(visible) {
  if (dom.statusRow) {
    dom.statusRow.style.display = visible ? 'flex' : 'none';
  }
}

// ─── Polling ─────────────────────────────────────────────────────────────────

function startPolling() {
  stopPolling();
  pollInterval = setInterval(async () => {
    const response = await sendMessageToContentWithResponse({ type: TIMER_MESSAGES.GET_STATE });
    if (response?.active && response?.remaining > 0) {
      if (dom.remainingEl) {
        dom.remainingEl.textContent = formatTime(response.remaining);
      }
      setStatusRowVisible(true);
    } else {
      stopPolling();
      if (dom.toggle) {
        dom.toggle.checked = false;
      }
      setStatusRowVisible(false);
    }
  }, 1000);
}

function stopPolling() {
  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ─── Render ──────────────────────────────────────────────────────────────────

async function render(container, footer) {
  container.innerHTML = `
    <section class="clrtxt-field">
      <div class="clrtxt-field-row">
        <span class="clrtxt-field-label">Bloquear página</span>
        <label class="clrtxt-toggle-label" aria-label="Activar bloqueo de página">
          <input type="checkbox" id="clrtxt-timer-toggle" class="clrtxt-toggle-input" />
          <span class="clrtxt-toggle-track"></span>
        </label>
      </div>
    </section>
 
    <section class="clrtxt-field">
      <label class="clrtxt-field-label" for="clrtxt-timer-duration">
        Duración: <span class="clrtxt-field-value" id="clrtxt-timer-duration-val">25 min</span>
      </label>
      <input
        type="range"
        id="clrtxt-timer-duration"
        class="clrtxt-slider"
        min="1" max="120" step="1" value="25"
      />
      <div class="clrtxt-range-hints">
        <span>1 min</span>
        <span>120 min</span>
      </div>
    </section>
 
    <div id="clrtxt-timer-status-row" class="clrtxt-timer-status-row" style="display:none">
      <span class="clrtxt-field-label">Tiempo restante</span>
      <span id="clrtxt-timer-remaining" class="clrtxt-field-value">--:--</span>
    </div>
  `;

  footer.innerHTML = `
    <p class="clrtxt-info-pause">
      El bloqueo impide navegar fuera de la página actual mientras el temporizador está activo.
    </p>
  `;

  cacheDom(container);
  await restoreValues();
  attachListeners();
}

function cacheDom(container) {
  dom.toggle = container.querySelector('#clrtxt-timer-toggle');
  dom.durationEl = container.querySelector('#clrtxt-timer-duration');
  dom.durationVal = container.querySelector('#clrtxt-timer-duration-val');
  dom.statusRow = container.querySelector('#clrtxt-timer-status-row');
  dom.remainingEl = container.querySelector('#clrtxt-timer-remaining');
}

async function restoreValues() {
  const durationMin = await timerStorage.get(STORAGE_KEYS.DURATION_MIN, TIMER_DEFAULTS.durationMin);
  dom.durationEl.value = String(durationMin);
  dom.durationVal.textContent = `${durationMin} min`;

  // Preguntar al content script si el timer está activo
  const response = await sendMessageToContentWithResponse({ type: TIMER_MESSAGES.GET_STATE });
  if (response?.active && response?.remaining > 0) {
    dom.toggle.checked = true;
    dom.remainingEl.textContent = formatTime(response.remaining);
    setStatusRowVisible(true);
    startPolling();
  } else {
    dom.toggle.checked = false;
    setStatusRowVisible(false);
  }
}

// Sin guard de "ya adjuntado": el popup re-renderiza la sección entera en
// cada activación, así que hay que re-enganchar los listeners a los
// elementos nuevos cada vez.
function attachListeners() {
  dom.durationEl.addEventListener('input', () => {
    dom.durationVal.textContent = `${dom.durationEl.value} min`;
  });

  dom.durationEl.addEventListener('change', async () => {
    const val = parseInt(dom.durationEl.value, 10);
    await timerStorage.set(STORAGE_KEYS.DURATION_MIN, val);
  });

  dom.toggle.addEventListener('change', handleToggle);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleToggle() {
  const active = dom.toggle.checked;
  const durationMin = parseInt(dom.durationEl.value, 10);

  if (active) {
    const response = await sendMessageToContentWithResponse({
      type: TIMER_MESSAGES.START,
      payload: { durationMin },
    });

    if (!response?.ok) {
      dom.toggle.checked = false;
      log.warn('No se pudo activar el timer en la página');
      return;
    }

    await timerStorage.set(STORAGE_KEYS.DURATION_MIN, durationMin);
    dom.remainingEl.textContent = formatTime(durationMin * 60);
    setStatusRowVisible(true);
    startPolling();
  } else {
    await sendMessageToContent({ type: TIMER_MESSAGES.STOP });
    stopPolling();
    setStatusRowVisible(false);
  }
}

// ─── Contrato de sección ──────────────────────────────────────────────────────

export const timerPopupSection = {
  id: 'lock',
  label: 'Concentración',
  shortLabel: 'Bloqueo',
  icon: ICON_LOCK,

  render,

  onActivate() {
    log.debug('Sección Timer activada');
    sendMessageToContentWithResponse({ type: TIMER_MESSAGES.GET_STATE }).then((response) => {
      if (response?.active) {
        startPolling();
      }
    });
  },

  onDeactivate() {
    log.debug('Sección Timer desactivada');
    stopPolling();
  },

  destroy() {
    stopPolling();
  },
};
