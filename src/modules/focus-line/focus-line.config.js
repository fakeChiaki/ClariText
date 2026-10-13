/**
 * Configuración del módulo Focus Line.
 */

export const FOCUS_LINE_DEFAULTS = {
  enabled: false,
  mode: 'line',
  overlayOpacity: 0.45, // opacidad del área oscura (0.0 – 0.8)
  highlightColor: '', // '' = transparente, o ej: 'rgba(255,255,0,0.15)'
  heightPx: 0, // 0 = automático (sigue al elemento), >0 = altura fija en px
};

export const FOCUS_LINE_LIMITS = {
  overlayOpacity: { min: 0.1, max: 0.8, step: 0.05 },
  heightPx: { min: 0, max: 200, step: 4 },
};

export const FOCUS_LINE_MODES = {
  LINE: 'line',
  PARAGRAPH: 'paragraph',
};

export const STORAGE_KEYS = {
  ENABLED: 'enabled',
  MODE: 'mode',
  OVERLAY_OPACITY: 'overlayOpacity',
  HIGHLIGHT_COLOR: 'highlightColor',
  HEIGHT_PX: 'heightPx',
};

export const CURSOR_THROTTLE_MS = 50;

export const FOCUS_LINE_EVENTS = {
  ENABLED: 'focus-line:enabled',
  DISABLED: 'focus-line:disabled',
  MODE_CHANGED: 'focus-line:mode-changed',
};

export const FOCUS_LINE_MESSAGES = {
  ENABLE: 'focus-line:enable',
  DISABLE: 'focus-line:disable',
  SET_MODE: 'focus-line:set-mode',
  SET_STYLE: 'focus-line:set-style',
  GET_STATE: 'focus-line:get-state',
};
