import { storage } from '../../core/storage.js';
import { createLogger } from '../../shared/logger.js';
import { MODULES } from '../../shared/constants.js';
import { sendMessageToContent } from '../../popup/messaging-helpers.js';
import { ICON_HIGHLIGHTER } from '../../popup/icons.js';
import {
  FOCUS_LINE_DEFAULTS,
  FOCUS_LINE_LIMITS,
  FOCUS_LINE_MESSAGES,
  STORAGE_KEYS,
} from './focus-line.config.js';

const log = createLogger('FocusLinePopupSection');
const focusStorage = storage.namespace(MODULES.FOCUS_LINE);

const dom = {
  toggleBtn: null,
  modeSelect: null,
  opacitySlider: null,
  opacityValue: null,
  colorInput: null,
  colorTransparent: null,
  heightCheckbox: null,
  heightSlider: null,
  heightValue: null,
};

const state = {
  enabled: FOCUS_LINE_DEFAULTS.enabled,
  mode: FOCUS_LINE_DEFAULTS.mode,
  overlayOpacity: FOCUS_LINE_DEFAULTS.overlayOpacity,
  highlightColor: FOCUS_LINE_DEFAULTS.highlightColor,
  heightPx: FOCUS_LINE_DEFAULTS.heightPx,
};

async function render(container, footer) {
  container.innerHTML = `
    <button id="clrtxt-fl-toggle" class="clrtxt-btn-primary">Activar resaltado</button>

    <section class="clrtxt-field" style="margin-top: 14px;">
      <label class="clrtxt-field-label" for="clrtxt-fl-mode">Modo de resaltado</label>
      <select id="clrtxt-fl-mode" class="clrtxt-select">
        <option value="line">Línea visual</option>
        <option value="paragraph">Párrafo completo</option>
      </select>
    </section>

    <section class="clrtxt-field">
      <label class="clrtxt-field-label" for="clrtxt-fl-opacity">
        Oscurecimiento del fondo:
        <span class="clrtxt-field-value" id="clrtxt-fl-opacity-value">0.45</span>
      </label>
      <input type="range" id="clrtxt-fl-opacity" class="clrtxt-slider"
        min="${FOCUS_LINE_LIMITS.overlayOpacity.min}"
        max="${FOCUS_LINE_LIMITS.overlayOpacity.max}"
        step="${FOCUS_LINE_LIMITS.overlayOpacity.step}"
        value="${FOCUS_LINE_DEFAULTS.overlayOpacity}" />
    </section>

    <section class="clrtxt-field">
      <label class="clrtxt-field-label" for="clrtxt-fl-color">Color del resaltado</label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="color" id="clrtxt-fl-color" value="#ffff00"
          style="width: 40px; height: 32px; border: 1px solid var(--clrtxt-popup-border);
                 border-radius: 4px; cursor: pointer;" />
        <label class="clrtxt-field-checkbox" style="margin: 0;">
          <input type="checkbox" id="clrtxt-fl-color-transparent" checked />
          <span>Transparente</span>
        </label>
      </div>
    </section>

    <section class="clrtxt-field clrtxt-field-checkbox">
      <input type="checkbox" id="clrtxt-fl-height-enabled" />
      <label for="clrtxt-fl-height-enabled">Usar altura fija</label>
    </section>

    <section class="clrtxt-field" id="clrtxt-fl-height-field" style="display: none;">
      <label class="clrtxt-field-label" for="clrtxt-fl-height">
        Altura:
        <span class="clrtxt-field-value" id="clrtxt-fl-height-value">40px</span>
      </label>
      <input type="range" id="clrtxt-fl-height" class="clrtxt-slider"
        min="4"
        max="${FOCUS_LINE_LIMITS.heightPx.max}"
        step="${FOCUS_LINE_LIMITS.heightPx.step}"
        value="40" />
    </section>
  `;

  footer.innerHTML = `
    <p class="clrtxt-info-pause">
      El resaltado sigue tu cursor mientras lees. Puedes elegir entre
      seguir la línea o el párrafo completo.
    </p>
  `;

  cacheDom(container);
  await restoreSavedValues();
  attachListeners();
}

function cacheDom(container) {
  dom.toggleBtn = container.querySelector('#clrtxt-fl-toggle');
  dom.modeSelect = container.querySelector('#clrtxt-fl-mode');
  dom.opacitySlider = container.querySelector('#clrtxt-fl-opacity');
  dom.opacityValue = container.querySelector('#clrtxt-fl-opacity-value');
  dom.colorInput = container.querySelector('#clrtxt-fl-color');
  dom.colorTransparent = container.querySelector('#clrtxt-fl-color-transparent');
  dom.heightCheckbox = container.querySelector('#clrtxt-fl-height-enabled');
  dom.heightField = container.querySelector('#clrtxt-fl-height-field');
  dom.heightSlider = container.querySelector('#clrtxt-fl-height');
  dom.heightValue = container.querySelector('#clrtxt-fl-height-value');
}

async function restoreSavedValues() {
  state.enabled = await focusStorage.get(STORAGE_KEYS.ENABLED, FOCUS_LINE_DEFAULTS.enabled);
  state.mode = await focusStorage.get(STORAGE_KEYS.MODE, FOCUS_LINE_DEFAULTS.mode);
  state.overlayOpacity = await focusStorage.get(
    STORAGE_KEYS.OVERLAY_OPACITY,
    FOCUS_LINE_DEFAULTS.overlayOpacity,
  );
  state.highlightColor = await focusStorage.get(
    STORAGE_KEYS.HIGHLIGHT_COLOR,
    FOCUS_LINE_DEFAULTS.highlightColor,
  );
  state.heightPx = await focusStorage.get(STORAGE_KEYS.HEIGHT_PX, FOCUS_LINE_DEFAULTS.heightPx);

  dom.modeSelect.value = state.mode;
  dom.opacitySlider.value = state.overlayOpacity;
  dom.opacityValue.textContent = Number(state.overlayOpacity).toFixed(2);

  const isTransparent = !state.highlightColor || state.highlightColor === '';
  dom.colorTransparent.checked = isTransparent;
  dom.colorInput.disabled = isTransparent;
  if (!isTransparent) {
    const hex = rgbaToHex(state.highlightColor);
    if (hex) {
      dom.colorInput.value = hex;
    }
  }

  const hasFixedHeight = state.heightPx > 0;
  dom.heightCheckbox.checked = hasFixedHeight;
  dom.heightField.style.display = hasFixedHeight ? 'block' : 'none';
  if (hasFixedHeight) {
    dom.heightSlider.value = state.heightPx;
    dom.heightValue.textContent = `${state.heightPx}px`;
  }

  updateToggleButton();
}

function updateToggleButton() {
  if (state.enabled) {
    dom.toggleBtn.textContent = 'Desactivar resaltado';
    dom.toggleBtn.style.background = '#dc3545';
  } else {
    dom.toggleBtn.textContent = 'Activar resaltado';
    dom.toggleBtn.style.background = '';
  }
}

/**
 * Conecta los listeners. Sin guard de "ya adjuntado": el popup re-renderiza
 * la sección entera en cada activación, así que hay que re-engancharlos a los
 * elementos nuevos cada vez.
 */
function attachListeners() {
  dom.toggleBtn.addEventListener('click', handleToggle);
  dom.modeSelect.addEventListener('change', handleModeChange);
  dom.opacitySlider.addEventListener('input', handleOpacityChange);
  dom.colorInput.addEventListener('input', handleColorChange);
  dom.colorTransparent.addEventListener('change', handleColorTransparentChange);
  dom.heightCheckbox.addEventListener('change', handleHeightCheckboxChange);
  dom.heightSlider.addEventListener('input', handleHeightChange);
}

async function handleToggle() {
  state.enabled = !state.enabled;
  await focusStorage.set(STORAGE_KEYS.ENABLED, state.enabled);
  await sendMessageToContent({
    type: state.enabled ? FOCUS_LINE_MESSAGES.ENABLE : FOCUS_LINE_MESSAGES.DISABLE,
  });
  updateToggleButton();
  log.debug(`Resaltado ${state.enabled ? 'activado' : 'desactivado'}`);
}

async function handleModeChange() {
  state.mode = dom.modeSelect.value;
  await focusStorage.set(STORAGE_KEYS.MODE, state.mode);
  await sendMessageToContent({
    type: FOCUS_LINE_MESSAGES.SET_MODE,
    payload: { mode: state.mode },
  });
}

async function handleOpacityChange() {
  state.overlayOpacity = parseFloat(dom.opacitySlider.value);
  dom.opacityValue.textContent = state.overlayOpacity.toFixed(2);
  await focusStorage.set(STORAGE_KEYS.OVERLAY_OPACITY, state.overlayOpacity);
  await sendMessageToContent({
    type: FOCUS_LINE_MESSAGES.SET_STYLE,
    payload: { overlayOpacity: state.overlayOpacity },
  });
}

async function handleColorChange() {
  if (dom.colorTransparent.checked) {
    return;
  }
  state.highlightColor = hexToRgba(dom.colorInput.value, 0.25);
  await focusStorage.set(STORAGE_KEYS.HIGHLIGHT_COLOR, state.highlightColor);
  await sendMessageToContent({
    type: FOCUS_LINE_MESSAGES.SET_STYLE,
    payload: { highlightColor: state.highlightColor },
  });
}

async function handleColorTransparentChange() {
  const transparent = dom.colorTransparent.checked;
  dom.colorInput.disabled = transparent;
  state.highlightColor = transparent ? '' : hexToRgba(dom.colorInput.value, 0.25);
  await focusStorage.set(STORAGE_KEYS.HIGHLIGHT_COLOR, state.highlightColor);
  await sendMessageToContent({
    type: FOCUS_LINE_MESSAGES.SET_STYLE,
    payload: { highlightColor: state.highlightColor },
  });
}

async function handleHeightCheckboxChange() {
  const enabled = dom.heightCheckbox.checked;
  dom.heightField.style.display = enabled ? 'block' : 'none';
  state.heightPx = enabled ? parseInt(dom.heightSlider.value, 10) : 0;
  await focusStorage.set(STORAGE_KEYS.HEIGHT_PX, state.heightPx);
  await sendMessageToContent({
    type: FOCUS_LINE_MESSAGES.SET_STYLE,
    payload: { heightPx: state.heightPx },
  });
}

async function handleHeightChange() {
  state.heightPx = parseInt(dom.heightSlider.value, 10);
  dom.heightValue.textContent = `${state.heightPx}px`;
  await focusStorage.set(STORAGE_KEYS.HEIGHT_PX, state.heightPx);
  await sendMessageToContent({
    type: FOCUS_LINE_MESSAGES.SET_STYLE,
    payload: { heightPx: state.heightPx },
  });
}

// ─── Helpers de color ─────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function rgbaToHex(rgba) {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) {
    return null;
  }
  const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/** Contrato de sección del popup unificado. */
export const focusLinePopupSection = {
  id: 'focus-line',
  label: 'Resaltado',
  shortLabel: 'Resaltar',
  icon: ICON_HIGHLIGHTER,
  render,
  onActivate() {
    log.debug('Sección Focus Line activada');
  },
  onDeactivate() {
    log.debug('Sección Focus Line desactivada (overlay sigue activo si lo estaba)');
  },
  destroy() {
    log.debug('Sección Focus Line destruida');
  },
};
