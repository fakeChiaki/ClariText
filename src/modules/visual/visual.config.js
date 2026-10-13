/** ID de la hoja de estilos dinámica inyectada en la página. */
export const STYLE_TAG_ID = 'clrtxt-visual-styles';

/** Selectores CSS a los que se aplican los ajustes tipográficos. */
export const TEXT_SELECTORS = [
  'p',
  'span',
  'li',
  'a',
  'blockquote',
  'label',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'td',
  'th',
  'caption',
  'figcaption',
  'cite',
  'q',
  'article',
  'section',
  'main',
  'aside',
].join(', ');

/** Configuración de interlineado. */
export const LINE_SPACING = {
  DEFAULT: 1.5,
  MIN: 1.0,
  MAX: 3.0,
  STEP: 0.1,
};

/** Configuración de interletraje. */
export const LETTER_SPACING = {
  /** Valor por defecto en `em`. */
  DEFAULT: 0,
  MIN: -0.05,
  MAX: 0.2,
  STEP: 0.01,
};

/** Nombres de eventos emitidos por este módulo (convención modulo:accion). */
export const EVENTS = {
  LINE_SPACING_CHANGED: 'visual:line-spacing-changed',
  LETTER_SPACING_CHANGED: 'visual:letter-spacing-changed',
  RESET: 'visual:reset',
};

/** Clave de namespace en storage. */
export const STORAGE_KEY = {
  LINE_SPACING: 'lineSpacing',
  LETTER_SPACING: 'letterSpacing',
};
