/**
 * Módulo Timer — bloqueo de página con temporizador.
 *
 * Sigue exactamente el mismo patrón que tts.module.js:
 * - init() carga prefs y registra handlers de mensajes.
 * - enable() activa el engine.
 * - disable() detiene el engine sin borrar prefs.
 * - destroy() limpieza total.
 *
 * No depende del service worker.
 */

import { createLogger } from '../../shared/logger.js';
import { storage } from '../../core/storage.js';
import { eventBus } from '../../core/event-bus.js';
import { messaging } from '../../core/messaging.js';
import { MODULES } from '../../shared/constants.js';
import { createTimerEngine } from './timer.engine.js';
import { STORAGE_KEYS, TIMER_DEFAULTS, TIMER_EVENTS, TIMER_MESSAGES } from './timer.config.js';

const log = createLogger('Timer');
const timerStorage = storage.namespace(MODULES.BREAK_TIMER);

let engine = null;
let enabled = false;

const messageUnsubs = [];

const prefs = {
  durationMin: TIMER_DEFAULTS.durationMin,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadPrefs() {
  prefs.durationMin = await timerStorage.get(STORAGE_KEYS.DURATION_MIN, TIMER_DEFAULTS.durationMin);
  log.debug('Preferencias cargadas', prefs);
}

function wireEngineCallbacks() {
  engine.onTick = ({ remaining }) => {
    eventBus.emit(TIMER_EVENTS.TICK, { remaining });
  };

  /**
   * onEnd se dispara cuando:
   * - El tiempo expira (desde el engine).
   * - El usuario pulsa "Desbloquear" (desde el engine).
   * En ambos casos el engine ya se detuvo internamente.
   * Solo actualizamos storage y emitimos al EventBus.
   */
  engine.onEnd = () => {
    log.info('Bloqueo terminado (engine)');
    eventBus.emit(TIMER_EVENTS.LOCK_ENDED, { source: 'engine' });
  };
}

function registerMessageHandlers() {
  messageUnsubs.push(
    messaging.onMessage(TIMER_MESSAGES.START, (payload) => {
      if (payload?.durationMin !== undefined) {
        prefs.durationMin = payload.durationMin;
        timerStorage.set(STORAGE_KEYS.DURATION_MIN, prefs.durationMin);
      }
      if (!engine.isActive()) {
        engine.start(prefs.durationMin);
        eventBus.emit(TIMER_EVENTS.LOCK_STARTED, { durationMin: prefs.durationMin });
      }
      return { ok: true, durationMin: prefs.durationMin };
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(TIMER_MESSAGES.STOP, () => {
      if (engine.isActive()) {
        engine.stop();
        eventBus.emit(TIMER_EVENTS.LOCK_ENDED, { source: 'manual' });
      }
      return { ok: true };
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(TIMER_MESSAGES.GET_STATE, () => {
      return {
        ok: true,
        active: engine.isActive(),
        durationMin: prefs.durationMin,
        remaining: engine.isActive() ? engine.getRemaining() : 0,
      };
    }),
  );

  log.info(`Handlers registrados (${messageUnsubs.length})`);
}

// ─── Ciclo de vida ────────────────────────────────────────────────────────────

async function init() {
  log.info('Inicializando módulo Timer');
  engine = createTimerEngine();
  await loadPrefs();
  wireEngineCallbacks();
  registerMessageHandlers();
  log.info('Módulo Timer inicializado');
}

function enable() {
  if (enabled) {
    return;
  }
  enabled = true;
  log.info('Módulo Timer activado');
}

function disable() {
  if (!enabled) {
    return;
  }
  enabled = false;
  if (engine?.isActive()) {
    engine.stop();
  }
  log.info('Módulo Timer desactivado');
}

function destroy() {
  disable();
  messageUnsubs.forEach((unsub) => unsub());
  messageUnsubs.length = 0;
  engine = null;
  log.info('Módulo Timer destruido');
}

export const timerModule = { init, enable, disable, destroy };
