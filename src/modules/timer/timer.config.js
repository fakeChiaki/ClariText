/**
 * Configuración del módulo Timer.
 */

export const TIMER_DEFAULTS = {
  durationMin: 25,
};

export const TIMER_LIMITS = {
  durationMin: { min: 1, max: 120, step: 1 },
};

export const STORAGE_KEYS = {
  DURATION_MIN: 'durationMin',
};

/** Eventos que el módulo Timer emite a través del EventBus. */
export const TIMER_EVENTS = {
  LOCK_STARTED: 'timer:lock-started',
  LOCK_ENDED: 'timer:lock-ended',
  TICK: 'timer:tick',
};

/** Mensajes que el módulo escucha desde el popup. */
export const TIMER_MESSAGES = {
  START: 'timer:start',
  STOP: 'timer:stop',
  GET_STATE: 'timer:get-state',
};
