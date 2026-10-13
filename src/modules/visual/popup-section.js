/**
 * visual.popup-section.js — Sección del módulo Visual para el popup unificado.
 *
 * Cumple el contrato de sections-registry.js:
 *   { id, label, shortLabel, icon, render(), onActivate(), onDeactivate(), destroy() }
 *
 * Comunicación con el content script: chrome.tabs.sendMessage,
 * igual que hacía el popup individual anterior.
 * Persistencia: chrome.storage.sync, con las mismas claves que visual.module.js.
 */

// ── Icono SVG ─────────────────────────────────────────────────────────────

import { ICON_SPACING } from '../../popup/icons.js';

const ICON_VISUAL = ICON_SPACING;

// ── Constantes ────────────────────────────────────────────────────────────

const STORAGE_KEY_LINE = 'visual.lineSpacing';
const STORAGE_KEY_LETTER = 'visual.letterSpacing';

const LINE_DEFAULT = 1.5;
const LETTER_DEFAULT = 0.0;
const LINE_STEP = 0.1;
const LETTER_STEP = 0.01;
const LINE_MIN = 1.0;
const LINE_MAX = 3.0;
const LETTER_MIN = -0.05;
const LETTER_MAX = 0.2;

const MSG = {
  LINE: 'visual:line-spacing-changed',
  LETTER: 'visual:letter-spacing-changed',
  RESET: 'visual:reset',
};

// ── Estado de la sección ──────────────────────────────────────────────────

const state = {
  lineSpacing: LINE_DEFAULT,
  letterSpacing: LETTER_DEFAULT,
  pending: false,
};

// Referencias al DOM renderizado (se rellenan en render()).
const el = {};

// ── Helpers ───────────────────────────────────────────────────────────────

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ── Storage ───────────────────────────────────────────────────────────────

function saveToStorage() {
  chrome.storage.sync.set({
    [STORAGE_KEY_LINE]: state.lineSpacing,
    [STORAGE_KEY_LETTER]: state.letterSpacing,
  });
}

function loadFromStorage(cb) {
  chrome.storage.sync.get(
    { [STORAGE_KEY_LINE]: LINE_DEFAULT, [STORAGE_KEY_LETTER]: LETTER_DEFAULT },
    (result) => cb(result[STORAGE_KEY_LINE], result[STORAGE_KEY_LETTER]),
  );
}

// ── Comunicación con el content script ───────────────────────────────────

async function sendToContent(type, payload = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { ok: false, reason: 'No active tab' };
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type, payload });
    return response ?? { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── Sincronización de controles ───────────────────────────────────────────

function syncLine(value) {
  const v = r2(clamp(value, LINE_MIN, LINE_MAX));
  state.lineSpacing = v;

  if (el.lineSlider) {
    el.lineSlider.value = v;
  }
  if (el.lineInput) {
    el.lineInput.value = v.toFixed(2);
  }
  if (el.lineValue) {
    el.lineValue.textContent = v.toFixed(2);
  }
  if (el.previewText) {
    el.previewText.style.lineHeight = v;
  }
}

function syncLetter(value) {
  const v = r2(clamp(value, LETTER_MIN, LETTER_MAX));
  state.letterSpacing = v;

  if (el.letterSlider) {
    el.letterSlider.value = v;
  }
  if (el.letterInput) {
    el.letterInput.value = v.toFixed(2);
  }
  if (el.letterValue) {
    el.letterValue.textContent = `${v.toFixed(2)} em`;
  }
  if (el.previewText) {
    el.previewText.style.letterSpacing = `${v}em`;
  }
}

// ── Handlers de cambio ────────────────────────────────────────────────────

function handleLineChange(value) {
  syncLine(value);
  markPending();
}

function handleLetterChange(value) {
  syncLetter(value);
  markPending();
}

function markPending() {
  state.pending = true;
  if (el.statusDot) {
    el.statusDot.className = 'clrtxt-status-dot clrtxt-status-pending';
  }
  if (el.statusText) {
    el.statusText.textContent = 'Cambios pendientes';
  }
}

// ── Aplicar y resetear ────────────────────────────────────────────────────

async function handleApply() {
  saveToStorage();

  const r1 = await sendToContent(MSG.LINE, { value: state.lineSpacing });
  const r2r = await sendToContent(MSG.LETTER, { value: state.letterSpacing });
  const ok = r1?.ok && r2r?.ok;

  state.pending = false;
  if (el.statusDot) {
    el.statusDot.className = `clrtxt-status-dot ${ok ? 'clrtxt-status-ok' : 'clrtxt-status-error'}`;
  }
  if (el.statusText) {
    el.statusText.textContent = ok ? 'Aplicado en la página' : 'Error al aplicar';
  }
}

async function handleResetAll() {
  syncLine(LINE_DEFAULT);
  syncLetter(LETTER_DEFAULT);
  saveToStorage();
  await sendToContent(MSG.RESET);

  state.pending = false;
  if (el.statusDot) {
    el.statusDot.className = 'clrtxt-status-dot clrtxt-status-ok';
  }
  if (el.statusText) {
    el.statusText.textContent = 'Valores restablecidos';
  }
}

// ── Render ────────────────────────────────────────────────────────────────

/**
 * Construye el HTML de la sección y cachea las referencias DOM.
 * Se llama cada vez que el popup navega a esta sección.
 *
 * @param {HTMLElement} container - Área principal del popup.
 * @param {HTMLElement} footer    - Pie del popup.
 */
function render(container, footer) {
  container.innerHTML = `
    <!-- Interlineado -->
    <div class="clrtxt-field">
      <label class="clrtxt-field-label">
        Interlineado
        <span class="clrtxt-field-value" id="clrtxt-vis-line-value">${state.lineSpacing.toFixed(2)}</span>
      </label>
      <input
        class="clrtxt-slider"
        id="clrtxt-vis-line-slider"
        type="range"
        min="${LINE_MIN}" max="${LINE_MAX}" step="${LINE_STEP}"
        value="${state.lineSpacing}"
        aria-label="Interlineado"
      />
      <div class="clrtxt-vis-row">
        <button class="clrtxt-vis-btn-step" id="clrtxt-vis-line-dec" aria-label="Reducir interlineado">−</button>
        <input
          class="clrtxt-vis-num-input"
          id="clrtxt-vis-line-input"
          type="number"
          min="${LINE_MIN}" max="${LINE_MAX}" step="${LINE_STEP}"
          value="${state.lineSpacing.toFixed(2)}"
          aria-label="Valor de interlineado"
        />
        <button class="clrtxt-vis-btn-step" id="clrtxt-vis-line-inc" aria-label="Aumentar interlineado">+</button>
        <button class="clrtxt-vis-btn-reset" id="clrtxt-vis-line-reset" aria-label="Restablecer interlineado">↺ Reset</button>
      </div>
    </div>

    <!-- Interletraje -->
    <div class="clrtxt-field">
      <label class="clrtxt-field-label">
        Interletraje
        <span class="clrtxt-field-value" id="clrtxt-vis-letter-value">${state.letterSpacing.toFixed(2)} em</span>
      </label>
      <input
        class="clrtxt-slider"
        id="clrtxt-vis-letter-slider"
        type="range"
        min="${LETTER_MIN}" max="${LETTER_MAX}" step="${LETTER_STEP}"
        value="${state.letterSpacing}"
        aria-label="Interletraje"
      />
      <div class="clrtxt-vis-row">
        <button class="clrtxt-vis-btn-step" id="clrtxt-vis-letter-dec" aria-label="Reducir interletraje">−</button>
        <input
          class="clrtxt-vis-num-input"
          id="clrtxt-vis-letter-input"
          type="number"
          min="${LETTER_MIN}" max="${LETTER_MAX}" step="${LETTER_STEP}"
          value="${state.letterSpacing.toFixed(2)}"
          aria-label="Valor de interletraje"
        />
        <button class="clrtxt-vis-btn-step" id="clrtxt-vis-letter-inc" aria-label="Aumentar interletraje">+</button>
        <button class="clrtxt-vis-btn-reset" id="clrtxt-vis-letter-reset" aria-label="Restablecer interletraje">↺ Reset</button>
      </div>
    </div>

    <!-- Vista previa -->
    <div class="clrtxt-vis-preview">
      <p class="clrtxt-vis-preview-label">VISTA PREVIA</p>
      <p
        id="clrtxt-vis-preview-text"
        class="clrtxt-vis-preview-text"
        style="line-height:${state.lineSpacing}; letter-spacing:${state.letterSpacing}em"
      >El texto de la página se verá así al aplicar los cambios.</p>
    </div>

    <!-- Botón Aplicar -->
    <button class="clrtxt-btn-primary" id="clrtxt-vis-apply-btn">
      Aplicar en esta página
    </button>
  `;

  // Footer: estado + reset global
  footer.innerHTML = `
    <div class="clrtxt-vis-footer">
      <div class="clrtxt-vis-status">
        <span class="clrtxt-status-dot clrtxt-status-ok" id="clrtxt-vis-status-dot"></span>
        <span id="clrtxt-vis-status-text">Listo para aplicar</span>
      </div>
      <button class="clrtxt-vis-btn-reset-all" id="clrtxt-vis-reset-all">
        Restablecer todo
      </button>
    </div>
  `;

  // Cachear referencias
  el.lineSlider = document.getElementById('clrtxt-vis-line-slider');
  el.lineInput = document.getElementById('clrtxt-vis-line-input');
  el.lineInc = document.getElementById('clrtxt-vis-line-inc');
  el.lineDec = document.getElementById('clrtxt-vis-line-dec');
  el.lineReset = document.getElementById('clrtxt-vis-line-reset');
  el.lineValue = document.getElementById('clrtxt-vis-line-value');

  el.letterSlider = document.getElementById('clrtxt-vis-letter-slider');
  el.letterInput = document.getElementById('clrtxt-vis-letter-input');
  el.letterInc = document.getElementById('clrtxt-vis-letter-inc');
  el.letterDec = document.getElementById('clrtxt-vis-letter-dec');
  el.letterReset = document.getElementById('clrtxt-vis-letter-reset');
  el.letterValue = document.getElementById('clrtxt-vis-letter-value');

  el.previewText = document.getElementById('clrtxt-vis-preview-text');
  el.applyBtn = document.getElementById('clrtxt-vis-apply-btn');
  el.statusDot = document.getElementById('clrtxt-vis-status-dot');
  el.statusText = document.getElementById('clrtxt-vis-status-text');
  el.resetAllBtn = document.getElementById('clrtxt-vis-reset-all');

  attachListeners();
}

// ── Listeners ─────────────────────────────────────────────────────────────

function attachListeners() {
  // Interlineado
  el.lineSlider.addEventListener('input', () => handleLineChange(parseFloat(el.lineSlider.value)));

  el.lineInput.addEventListener('change', () => {
    const v = parseFloat(el.lineInput.value);
    Number.isFinite(v) ? handleLineChange(v) : (el.lineInput.value = state.lineSpacing.toFixed(2));
  });
  el.lineInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      el.lineInput.dispatchEvent(new Event('change'));
    }
  });

  el.lineInc.addEventListener('click', () => handleLineChange(state.lineSpacing + LINE_STEP));
  el.lineDec.addEventListener('click', () => handleLineChange(state.lineSpacing - LINE_STEP));
  el.lineReset.addEventListener('click', () => handleLineChange(LINE_DEFAULT));

  // Interletraje
  el.letterSlider.addEventListener('input', () =>
    handleLetterChange(parseFloat(el.letterSlider.value)),
  );

  el.letterInput.addEventListener('change', () => {
    const v = parseFloat(el.letterInput.value);
    Number.isFinite(v)
      ? handleLetterChange(v)
      : (el.letterInput.value = state.letterSpacing.toFixed(2));
  });
  el.letterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      el.letterInput.dispatchEvent(new Event('change'));
    }
  });

  el.letterInc.addEventListener('click', () =>
    handleLetterChange(state.letterSpacing + LETTER_STEP),
  );
  el.letterDec.addEventListener('click', () =>
    handleLetterChange(state.letterSpacing - LETTER_STEP),
  );
  el.letterReset.addEventListener('click', () => handleLetterChange(LETTER_DEFAULT));

  // Botones globales
  el.applyBtn.addEventListener('click', handleApply);
  el.resetAllBtn.addEventListener('click', handleResetAll);
}

// ── API pública: contrato de sections-registry ────────────────────────────

export const visualPopupSection = {
  id: 'spacing',
  label: 'Interlineado e Interletraje',
  shortLabel: 'Líneas',
  icon: ICON_VISUAL,

  /**
   * Construye la UI en el contenedor del popup unificado.
   * Carga los valores guardados antes de mostrar los controles.
   */
  render(container, footer) {
    return new Promise((resolve) => {
      loadFromStorage((lineSpacing, letterSpacing) => {
        // Actualizar estado con los valores persistidos antes de renderizar,
        // para que el HTML generado ya tenga los valores correctos.
        state.lineSpacing = r2(clamp(lineSpacing, LINE_MIN, LINE_MAX));
        state.letterSpacing = r2(clamp(letterSpacing, LETTER_MIN, LETTER_MAX));

        render(container, footer);
        resolve();
      });
    });
  },

  /** Se llama cuando el usuario navega a esta sección. Sin efecto aquí. */
  onActivate() {},

  /** Se llama cuando el usuario navega a otra sección. Sin efecto aquí. */
  onDeactivate() {},

  /** Limpieza completa si el popup se cierra o se destruye. */
  destroy() {
    // Vaciar referencias DOM para no retener nodos huérfanos.
    Object.keys(el).forEach((k) => delete el[k]);
  },
};
