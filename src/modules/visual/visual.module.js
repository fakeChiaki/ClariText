import { createLogger } from '../../shared/logger.js';
import { eventBus } from '../../core/event-bus.js';
import { storage } from '../../core/storage.js';
import { messaging } from '../../core/messaging.js';

import { EVENTS, STORAGE_KEY, LINE_SPACING, LETTER_SPACING } from './visual.config.js';

import {
  initEngine,
  applyCurrentStyles,
  setLineSpacing,
  setLetterSpacing,
  resetToDefaults,
  removeStyles,
  getState,
} from './visual.engine.js';

// ─── Servicios del Core ────────────────────────────────────────────────────

const log = createLogger('Visual');
const myStorage = storage.namespace('visual');

// ─── Estado interno ────────────────────────────────────────────────────────

const unsubscribers = [];
let enabled = false;

// ─── Persistencia ──────────────────────────────────────────────────────────

async function persist() {
  const { lineSpacing, letterSpacing } = getState();
  await myStorage.set(STORAGE_KEY.LINE_SPACING, lineSpacing);
  await myStorage.set(STORAGE_KEY.LETTER_SPACING, letterSpacing);
}

// ─── Handlers de mensajes del popup ───────────────────────────────────────
// Se registran via messaging.onMessage() para usar el dispatcher
// que bootstrap.js ya arrancó con messaging.start().

function handleLineSpacingMsg(payload) {
  const value = payload?.value;
  if (typeof value !== 'number') {
    return { ok: false };
  }
  const applied = setLineSpacing(value);
  applyCurrentStyles();
  persist();
  eventBus.emit(EVENTS.LINE_SPACING_CHANGED, { value: applied });
  log.debug('Interlineado aplicado desde popup:', applied);
  return { ok: true, applied };
}

function handleLetterSpacingMsg(payload) {
  const value = payload?.value;
  if (typeof value !== 'number') {
    return { ok: false };
  }
  const applied = setLetterSpacing(value);
  applyCurrentStyles();
  persist();
  eventBus.emit(EVENTS.LETTER_SPACING_CHANGED, { value: applied });
  log.debug('Interletraje aplicado desde popup:', applied);
  return { ok: true, applied };
}

function handleResetMsg() {
  resetToDefaults();
  applyCurrentStyles();
  persist();
  eventBus.emit(EVENTS.RESET, getState());
  log.debug('Reset aplicado desde popup');
  return { ok: true, state: getState() };
}

// ─── API pública ───────────────────────────────────────────────────────────

export const visualModule = {
  async init() {
    log.info('Inicializando');

    const lineSpacing = await myStorage.get(STORAGE_KEY.LINE_SPACING, LINE_SPACING.DEFAULT);
    const letterSpacing = await myStorage.get(STORAGE_KEY.LETTER_SPACING, LETTER_SPACING.DEFAULT);

    initEngine(lineSpacing, letterSpacing);
    log.debug('Estado cargado desde storage:', { lineSpacing, letterSpacing });
  },

  enable() {
    if (enabled) {
      return;
    }
    enabled = true;

    // Aplicar los estilos guardados sobre la página actual
    applyCurrentStyles();

    // Registrar handlers para mensajes del popup
    unsubscribers.push(
      messaging.onMessage(EVENTS.LINE_SPACING_CHANGED, handleLineSpacingMsg),
      messaging.onMessage(EVENTS.LETTER_SPACING_CHANGED, handleLetterSpacingMsg),
      messaging.onMessage(EVENTS.RESET, handleResetMsg),
    );

    // Reaccionar a perfiles aplicados por el módulo de perfiles
    unsubscribers.push(
      eventBus.on('profiles:applied', (data) => {
        if (data?.visual) {
          const { lineSpacing, letterSpacing } = data.visual;
          if (lineSpacing !== null && lineSpacing !== undefined) {
            setLineSpacing(lineSpacing);
          }
          if (letterSpacing !== null && letterSpacing !== undefined) {
            setLetterSpacing(letterSpacing);
          }
          log.debug('Configuración aplicada desde perfil:', data.visual);
        }
      }),
    );

    log.info('Activado');
  },

  disable() {
    if (!enabled) {
      return;
    }
    enabled = false;

    removeStyles();
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers.length = 0;

    log.info('Desactivado');
  },

  destroy() {
    this.disable();
    log.info('Destruido');
  },
};
