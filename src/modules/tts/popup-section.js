import { storage } from '../../core/storage.js';
import { createLogger } from '../../shared/logger.js';
import { MODULES } from '../../shared/constants.js';
import {
  waitForVoices,
  filterSpanishVoices,
  groupVoicesByCategory,
  isLocalVoice,
  selectBestVoice,
  hasSpanishVoices,
} from '../../popup/voice-utils.js';
import { sendMessageToContent } from '../../popup/messaging-helpers.js';
import { ICON_TTS } from '../../popup/icons.js';

const log = createLogger('TTSPopupSection');

const MSG = {
  ENABLED_CHANGED: 'tts:enabled-changed',
  VOICE_CHANGED: 'tts:voice-changed',
  RATE_CHANGED: 'tts:rate-changed',
  PITCH_CHANGED: 'tts:pitch-changed',
  VIEWER_SIZE_CHANGED: 'tts:viewer-size-changed',
  HIGHLIGHT_CHANGED: 'tts:highlight-changed',
  PAUSE_SUPPORTED_CHANGED: 'tts:pause-supported-changed',
};

const ttsStorage = storage.namespace(MODULES.TTS);

const dom = {
  enabledSwitch: null,
  controlsContainer: null,
  footer: null,
  voiceSelect: null,
  rateSlider: null,
  rateValue: null,
  pitchSlider: null,
  pitchValue: null,
  viewerSizeSelect: null,
  highlightCheckbox: null,
  testBtn: null,
};

const state = {
  allVoices: [],
  selectedVoice: null,
  enabled: true,
};

/**
 * Cancela la reproducción del popup solo si hay algo que cancelar.
 * Llamar speechSynthesis.cancel() innecesariamente puede dejar el motor
 * de voz en un estado atascado donde el siguiente speak() no responde.
 * Bug conocido del Web Speech API en Chrome.
 */
function cancelIfSpeaking() {
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
  }
}

/**
 * Construye el HTML de la sección TTS dentro del contenedor.
 *
 * @param {HTMLElement} container - Contenedor donde renderizar la UI.
 * @param {HTMLElement} footer - Contenedor del footer (mensaje informativo).
 */
async function render(container, footer) {
  container.innerHTML = `
    <section class="clrtxt-field clrtxt-toggle-section">
      <label class="clrtxt-switch-label" for="clrtxt-tts-enabled">
        <span class="clrtxt-switch-text">Activar lectura por voz</span>
        <input type="checkbox" id="clrtxt-tts-enabled" class="clrtxt-switch-input" />
        <span class="clrtxt-switch-track">
          <span class="clrtxt-switch-thumb"></span>
        </span>
      </label>
    </section>

    <div id="clrtxt-tts-controls" class="clrtxt-tts-controls">
      <section class="clrtxt-field">
        <label class="clrtxt-field-label" for="clrtxt-voice">Voz</label>
        <select id="clrtxt-voice" class="clrtxt-select"></select>
      </section>

      <section class="clrtxt-field">
        <label class="clrtxt-field-label" for="clrtxt-rate">
          Velocidad: <span class="clrtxt-field-value" id="clrtxt-rate-value">1.00x</span>
        </label>
        <input type="range" id="clrtxt-rate" class="clrtxt-slider"
          min="0.5" max="2" step="0.05" value="1" />
      </section>

      <section class="clrtxt-field">
        <label class="clrtxt-field-label" for="clrtxt-pitch">
          Tono: <span class="clrtxt-field-value" id="clrtxt-pitch-value">1.00</span>
        </label>
        <input type="range" id="clrtxt-pitch" class="clrtxt-slider"
          min="0" max="2" step="0.05" value="1" />
      </section>

      <section class="clrtxt-field">
        <label class="clrtxt-field-label" for="clrtxt-viewer-size">
          Tamaño del texto en el visor
        </label>
        <select id="clrtxt-viewer-size" class="clrtxt-select">
          <option value="small">Pequeño</option>
          <option value="medium">Mediano</option>
          <option value="large">Grande (recomendado)</option>
        </select>
      </section>

      <section class="clrtxt-field clrtxt-field-checkbox">
        <input type="checkbox" id="clrtxt-highlight" />
        <label for="clrtxt-highlight">Resaltar palabras mientras se lee</label>
      </section>

      <button id="clrtxt-test-voice" class="clrtxt-btn-primary">Probar voz</button>
    </div>
  `;

  dom.footer = footer;

  // Footer: mensaje informativo sobre soporte de pausa.
  footer.innerHTML = `
    <p class="clrtxt-info-pause">
      Las voces locales soportan pausa; las Online tienen mejor calidad pero solo Stop.
    </p>
  `;

  cacheDom(container);
  await loadVoices();
  await restoreSavedValues();
  attachListeners();
}

/** Cachea referencias DOM dentro del contenedor de la sección. */
function cacheDom(container) {
  dom.enabledSwitch = container.querySelector('#clrtxt-tts-enabled');
  dom.controlsContainer = container.querySelector('#clrtxt-tts-controls');
  dom.voiceSelect = container.querySelector('#clrtxt-voice');
  dom.rateSlider = container.querySelector('#clrtxt-rate');
  dom.rateValue = container.querySelector('#clrtxt-rate-value');
  dom.pitchSlider = container.querySelector('#clrtxt-pitch');
  dom.pitchValue = container.querySelector('#clrtxt-pitch-value');
  dom.viewerSizeSelect = container.querySelector('#clrtxt-viewer-size');
  dom.highlightCheckbox = container.querySelector('#clrtxt-highlight');
  dom.testBtn = container.querySelector('#clrtxt-test-voice');
}

/** Carga las voces disponibles del navegador y las muestra agrupadas. */
async function loadVoices() {
  const allVoices = await waitForVoices();
  state.allVoices = allVoices;

  if (!hasSpanishVoices(allVoices)) {
    showVoiceWarning('No se detectaron voces en español en tu navegador.');
    populateAllVoices();
    return;
  }

  const spanishVoices = filterSpanishVoices(allVoices);
  const groups = groupVoicesByCategory(spanishVoices);
  populateGroupedVoices(groups);
}

/** Inserta voces agrupadas (optgroups) en el dropdown. */
function populateGroupedVoices(groups) {
  dom.voiceSelect.innerHTML = '';
  groups.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    group.voices.forEach((voice) => {
      const opt = document.createElement('option');
      opt.value = voice.voiceURI;
      opt.textContent = voice.name;
      optgroup.appendChild(opt);
    });
    dom.voiceSelect.appendChild(optgroup);
  });
}

/** Fallback: muestra todas las voces sin agrupar. */
function populateAllVoices() {
  dom.voiceSelect.innerHTML = '';
  state.allVoices.forEach((voice) => {
    const opt = document.createElement('option');
    opt.value = voice.voiceURI;
    opt.textContent = `${voice.name} (${voice.lang})`;
    dom.voiceSelect.appendChild(opt);
  });
}

/** Muestra un mensaje de advertencia sobre las voces. */
function showVoiceWarning(message) {
  const warning = document.createElement('p');
  warning.className = 'clrtxt-warning';
  warning.textContent = message;
  dom.voiceSelect.parentNode.appendChild(warning);
}

/** Restaura los valores guardados en storage. */
async function restoreSavedValues() {
  state.enabled = await ttsStorage.get('enabled', true);
  dom.enabledSwitch.checked = state.enabled;
  applyEnabledState();

  const savedVoiceUri = await ttsStorage.get('voice');
  const savedRate = (await ttsStorage.get('rate')) ?? 1;
  const savedPitch = (await ttsStorage.get('pitch')) ?? 1;
  const savedViewerSize = (await ttsStorage.get('viewerSize')) ?? 'large';
  const savedHighlight = (await ttsStorage.get('highlight')) ?? true;

  const browserLang = navigator.language;
  state.selectedVoice = selectBestVoice(state.allVoices, savedVoiceUri, browserLang);

  if (state.selectedVoice) {
    dom.voiceSelect.value = state.selectedVoice.voiceURI;
  }

  dom.rateSlider.value = savedRate;
  dom.rateValue.textContent = `${Number(savedRate).toFixed(2)}x`;
  dom.pitchSlider.value = savedPitch;
  dom.pitchValue.textContent = Number(savedPitch).toFixed(2);
  dom.viewerSizeSelect.value = savedViewerSize;
  dom.highlightCheckbox.checked = savedHighlight;

  await notifyPauseSupport();
}

/**
 * Conecta los listeners de los controles.
 * Sin guard de "ya adjuntado": el popup re-renderiza la sección entera en
 * cada activación (innerHTML nuevo), así que los listeners deben volver a
 * engancharse a los elementos nuevos cada vez.
 */
function attachListeners() {
  dom.enabledSwitch.addEventListener('change', handleEnabledChange);
  dom.voiceSelect.addEventListener('change', handleVoiceChange);
  dom.rateSlider.addEventListener('input', handleRateChange);
  dom.pitchSlider.addEventListener('input', handlePitchChange);
  dom.viewerSizeSelect.addEventListener('change', handleViewerSizeChange);
  dom.highlightCheckbox.addEventListener('change', handleHighlightChange);
  dom.testBtn.addEventListener('click', handleTestVoice);
}

/**
 * Aplica la visibilidad de la UI según el estado del toggle.
 * OFF = solo se ve el switch; controles y footer ocultos.
 */
function applyEnabledState() {
  const display = state.enabled ? '' : 'none';
  if (dom.controlsContainer) {
    dom.controlsContainer.style.display = display;
  }
  if (dom.footer) {
    dom.footer.style.display = display;
  }
}

/** Activa/desactiva TTS: persiste, notifica al content script y aplica UI. */
async function handleEnabledChange() {
  state.enabled = dom.enabledSwitch.checked;
  await ttsStorage.set('enabled', state.enabled);
  await sendMessageToContent({
    type: MSG.ENABLED_CHANGED,
    payload: { enabled: state.enabled },
  });
  applyEnabledState();
}

async function handleVoiceChange() {
  const uri = dom.voiceSelect.value;
  state.selectedVoice = state.allVoices.find((v) => v.voiceURI === uri) || null;
  await ttsStorage.set('voice', uri);
  await sendMessageToContent({ type: MSG.VOICE_CHANGED, payload: { voiceURI: uri } });
  await notifyPauseSupport();
}

async function handleRateChange() {
  const rate = parseFloat(dom.rateSlider.value);
  dom.rateValue.textContent = `${rate.toFixed(2)}x`;
  await ttsStorage.set('rate', rate);
  await sendMessageToContent({ type: MSG.RATE_CHANGED, payload: { rate } });
}

async function handlePitchChange() {
  const pitch = parseFloat(dom.pitchSlider.value);
  dom.pitchValue.textContent = pitch.toFixed(2);
  await ttsStorage.set('pitch', pitch);
  await sendMessageToContent({ type: MSG.PITCH_CHANGED, payload: { pitch } });
}

async function handleViewerSizeChange() {
  const size = dom.viewerSizeSelect.value;
  await ttsStorage.set('viewerSize', size);
  await sendMessageToContent({ type: MSG.VIEWER_SIZE_CHANGED, payload: { size } });
}

async function handleHighlightChange() {
  const enabled = dom.highlightCheckbox.checked;
  await ttsStorage.set('highlight', enabled);
  await sendMessageToContent({ type: MSG.HIGHLIGHT_CHANGED, payload: { enabled } });
}

function handleTestVoice() {
  if (!state.selectedVoice) {
    log.warn('No hay voz seleccionada para probar');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(
    'Hola, esta es una prueba de ClariText. Tu lectura accesible comienza aquí.',
  );
  utterance.voice = state.selectedVoice;
  utterance.rate = parseFloat(dom.rateSlider.value);
  utterance.pitch = parseFloat(dom.pitchSlider.value);
  cancelIfSpeaking();
  speechSynthesis.speak(utterance);
}

/** Notifica al content script si la voz actual soporta pausa. */
async function notifyPauseSupport() {
  const supported = state.selectedVoice ? isLocalVoice(state.selectedVoice) : true;
  await sendMessageToContent({
    type: MSG.PAUSE_SUPPORTED_CHANGED,
    payload: { supported },
  });
}

/** Contrato de sección del popup unificado. */
export const ttsPopupSection = {
  id: 'tts',
  label: 'Texto a voz',
  shortLabel: 'Voz',
  icon: ICON_TTS,
  render,
  onActivate() {
    log.debug('Sección TTS activada');
  },
  onDeactivate() {
    log.debug('Sección TTS desactivada');
    cancelIfSpeaking();
  },
  destroy() {
    cancelIfSpeaking();
  },
};
