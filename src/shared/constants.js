/**
 * Constantes globales de ClariText.
 *
 * Centraliza valores compartidos entre módulos: prefijos CSS, IDs de
 * módulos, nombres de eventos del ciclo de vida y estados. Cualquier
 * string que se use en más de un archivo debería declararse aquí.
 */

export const CSS_PREFIX = 'clrtxt';

export const MODULES = {
  TTS: 'tts',
  VISUAL: 'visual',
  FONTS: 'fonts',
  PAGE_LOCK: 'page-lock',
  READING_MODE: 'reading-mode',
  FOCUS_LINE: 'focus-line',
  BREAK_TIMER: 'break-timer',
  SUMMARIZER: 'summarizer',
};

/** Eventos del ciclo de vida emitidos por los módulos a través del EventBus. */
export const LIFECYCLE_EVENTS = {
  MODULE_INITIALIZED: 'module:initialized',
  MODULE_ENABLED: 'module:enabled',
  MODULE_DISABLED: 'module:disabled',
  MODULE_DESTROYED: 'module:destroyed',
  MODULE_ERROR: 'module:error',
};

/** Estados posibles de un módulo dentro del module-loader. */
export const MODULE_STATES = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  ACTIVE: 'active',
  DISABLED: 'disabled',
  FAILED: 'failed',
};

/**
 * Versión del esquema de storage. Incrementar al hacer cambios
 * incompatibles en las claves para permitir migraciones futuras.
 */
export const STORAGE_SCHEMA_VERSION = 1;
