import { createLogger } from '../../shared/logger.js';
import { storage } from '../../core/storage.js';
import { eventBus } from '../../core/event-bus.js';
import { messaging } from '../../core/messaging.js';
import { MODULES } from '../../shared/constants.js';

import { ReadingEngine } from './reading.engine.js';
import {
  mountOverlay,
  unmountOverlay,
  isOverlayMounted,
  applyReadingStyles,
} from './reading.ui.overlay.js';
import {
  READING_DEFAULTS,
  STORAGE_KEYS,
  MSG_TOGGLE_READING,
  MSG_GET_STATE,
  MSG_GET_PREVIEW,
  EVENT_READING_ENABLED,
  EVENT_READING_DISABLED,
} from './reading.config.js';

const log = createLogger('Reading');
const readingStorage = storage.namespace(MODULES.READING_MODE);

/** Tipos de mensajes que el módulo escucha desde el popup. */
const MSG = {
  TOGGLE: MSG_TOGGLE_READING,
  GET_STATE: MSG_GET_STATE,
  GET_PREVIEW: MSG_GET_PREVIEW,
};

let engine = null;
let enabled = false;

// Funciones de desuscripción de los handlers de mensajes.
// Se llaman en destroy() para evitar fugas.
const messageUnsubs = [];

// Preferencias cargadas desde storage.
const prefs = {
  backgroundColor: READING_DEFAULTS.backgroundColor,
  textColor: READING_DEFAULTS.textColor,
  fontFamily: READING_DEFAULTS.fontFamily,
  fontSize: READING_DEFAULTS.fontSize,
  lineHeight: READING_DEFAULTS.lineHeight,
  maxWidth: READING_DEFAULTS.maxWidth,
};

/** Lee todas las preferencias del storage al arrancar el módulo. */
async function loadPrefs() {
  prefs.backgroundColor = await readingStorage.get(
    STORAGE_KEYS.BG_COLOR,
    READING_DEFAULTS.backgroundColor,
  );
  prefs.textColor = await readingStorage.get(STORAGE_KEYS.TEXT_COLOR, READING_DEFAULTS.textColor);
  prefs.fontFamily = await readingStorage.get(
    STORAGE_KEYS.FONT_FAMILY,
    READING_DEFAULTS.fontFamily,
  );
  prefs.fontSize = await readingStorage.get(STORAGE_KEYS.FONT_SIZE, READING_DEFAULTS.fontSize);
  prefs.lineHeight = await readingStorage.get(
    STORAGE_KEYS.LINE_HEIGHT,
    READING_DEFAULTS.lineHeight,
  );
  prefs.maxWidth = await readingStorage.get(STORAGE_KEYS.MAX_WIDTH, READING_DEFAULTS.maxWidth);
  log.debug('Preferencias cargadas', prefs);
}

/**
 * Registra los handlers de mensajes del popup.
 * Mismo patrón que registerMessageHandlers() en tts.module.js.
 */
function registerMessageHandlers() {
  messageUnsubs.push(
    messaging.onMessage(MSG.TOGGLE, (payload) => {
      const activate = payload?.activate;

      if (activate === true) {
        enable();
      } else if (activate === false) {
        disable();
      } else {
        // Sin payload: alterna el estado actual.
        if (isOverlayMounted()) {
          disable();
        } else {
          enable();
        }
      }

      return { ok: true, isActive: isOverlayMounted() };
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.GET_STATE, () => {
      return { isActive: isOverlayMounted() };
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.GET_PREVIEW, () => {
      const { title, nodes } = engine.extract();
      const firstText = extractFirstParagraph(nodes);
      return { title, firstText };
    }),
  );

  log.info(`Handlers de mensajes registrados (${messageUnsubs.length})`);
}

/**
 * Obtiene el texto del primer párrafo real (>60 chars), truncado a 120.
 *
 * @param {Node[]} nodes
 * @returns {string}
 */
function extractFirstParagraph(nodes) {
  for (const node of nodes) {
    if (node.tagName !== 'P') {
      continue;
    }
    const text = (node.innerText || node.textContent || '').trim();
    if (text.length < 60) {
      continue;
    }
    return text.length > 120 ? text.slice(0, 117) + '…' : text;
  }
  for (const node of nodes) {
    const text = (node.innerText || node.textContent || '').trim();
    if (text.length >= 60) {
      return text.length > 120 ? text.slice(0, 117) + '…' : text;
    }
  }
  return '';
}

async function init() {
  log.info('Inicializando módulo Reading');

  engine = new ReadingEngine();
  await loadPrefs();
  registerMessageHandlers();

  // No activamos automáticamente al carga del módulo.
  log.debug('Módulo Reading inicializado en estado desactivado');
  log.info('Módulo Reading inicializado');
}

function enable() {
  if (enabled) {
    log.debug('Ya está activo, ignorando enable()');
    return;
  }
  enabled = true;

  const content = engine.extract();
  mountOverlay(content, prefs, { onClose: disable });
  readingStorage.set(STORAGE_KEYS.ACTIVE_URL, window.location.href);

  // Escuchar cambios tipográficos de otros módulos y replicarlos en el overlay.
  // Los valores llegan ya validados desde cada módulo de origen.
  messageUnsubs.push(
    eventBus.on('visual:line-spacing-changed', ({ value }) =>
      applyReadingStyles({ lineHeight: value }),
    ),
    eventBus.on('visual:letter-spacing-changed', ({ value }) =>
      applyReadingStyles({ letterSpacing: value }),
    ),
    eventBus.on('fonts:font-applied', ({ fontFamily }) => applyReadingStyles({ fontFamily })),
  );

  eventBus.emit(EVENT_READING_ENABLED, { url: window.location.href });
  log.info(`Activo — ${content.nodes.length} nodos, ${content.navItems.length} items de nav`);
}

function disable() {
  if (!enabled) {
    log.debug('Ya está inactivo, ignorando disable()');
    return;
  }
  enabled = false;

  unmountOverlay();
  readingStorage.remove(STORAGE_KEYS.ACTIVE_URL);

  eventBus.emit(EVENT_READING_DISABLED, { url: window.location.href });
  log.info('Desactivado');
}

function destroy() {
  disable();

  messageUnsubs.forEach((unsub) => unsub());
  messageUnsubs.length = 0;

  engine = null;
  log.info('Destruido');
}

export const readingModule = { init, enable, disable, destroy, autoEnable: false };
