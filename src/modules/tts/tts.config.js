export const TTS_DEFAULTS = {
  voice: null, // null = voz por defecto del sistema
  rate: 1.0,
  pitch: 1.0,
  viewerSize: 'large',
  highlight: true,
};

/** Límites de los controles de velocidad y tono (Web Speech API). */
export const TTS_LIMITS = {
  rate: { min: 0.5, max: 2.0, step: 0.05 },
  pitch: { min: 0.0, max: 2.0, step: 0.1 },
};

/** Tamaños disponibles para el visor del texto (en píxeles). */
export const VIEWER_SIZES = {
  small: '16px',
  medium: '20px',
  large: '24px',
};

/** Idiomas preferidos para elegir voz, en orden de prioridad. */
export const PREFERRED_LANGS = ['es-CL', 'es-MX', 'es-AR', 'es-419', 'es-ES', 'es'];

/** Claves de storage usadas por el módulo (dentro del namespace 'tts'). */
export const STORAGE_KEYS = {
  ENABLED: 'enabled',
  VOICE: 'voice',
  RATE: 'rate',
  PITCH: 'pitch',
  VIEWER_SIZE: 'viewerSize',
  HIGHLIGHT: 'highlight',
};

/**
 * Estado por defecto del módulo TTS (activado).
 * Compatible con el comportamiento previo: usuarios nuevos y existentes
 * tienen el botón flotante activo salvo que lo desactiven explícitamente.
 */
export const DEFAULT_ENABLED = true;

/** Eventos que el módulo TTS emite a través del EventBus. */
export const TTS_EVENTS = {
  READ_STARTED: 'tts:read-started',
  READ_PAUSED: 'tts:read-paused',
  READ_RESUMED: 'tts:read-resumed',
  READ_FINISHED: 'tts:read-finished',
  READ_STOPPED: 'tts:read-stopped',
  WORD_BOUNDARY: 'tts:word-boundary',
  CONFIG_CHANGED: 'tts:config-changed',
};
