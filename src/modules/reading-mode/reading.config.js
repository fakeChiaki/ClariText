/**
 * Configuración visual del overlay.
 * Todos los valores son sobreescribibles mediante storage.
 */
export const READING_DEFAULTS = {
  backgroundColor: '#F8F7F4',
  textColor: '#1A1A1A',
  sidebarBackground: '#EDECE9',
  fontFamily: "'Georgia', 'Times New Roman', serif",
  fontSize: 18,
  maxWidth: 720,
  lineHeight: 1.7,
};

/**
 * Claves de storage. Evita strings literales dispersos en el módulo.
 * Mismo patrón que STORAGE_KEYS en tts.config.js.
 */
export const STORAGE_KEYS = {
  BG_COLOR: 'backgroundColor',
  TEXT_COLOR: 'textColor',
  FONT_FAMILY: 'fontFamily',
  FONT_SIZE: 'fontSize',
  LINE_HEIGHT: 'lineHeight',
  MAX_WIDTH: 'maxWidth',
  /** URL donde el modo lectura estaba activo; persiste para restaurar tras recarga. */
  ACTIVE_URL: 'activeUrl',
};

/**
 * Selectores CSS para detectar el contenido principal.
 * Se evalúan en orden; se usa el primero que tenga texto suficiente.
 */
export const CONTENT_SELECTORS = [
  'article[role="main"]',
  'main article',
  '[role="main"]',
  'main',
  'article',
  '.post-content',
  '.article-body',
  '.entry-content',
  '.content-body',
  '#content',
  '.content',
];

/**
 * Selectores de elementos excluidos del contenido principal,
 * aunque estén dentro del contenedor detectado.
 */
export const NOISE_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="complementary"]',
  '.sidebar',
  '.nav',
  '.navbar',
  '.nav-menu',
  '.toc',
  '.sidebar-nav',
  '.page-nav',
  '.advertisement',
  '.ad',
  '.cookie-banner',
  '.newsletter-signup',
  '.social-share',
  '.related-posts',
  'script',
  'style',
  'noscript',
  'iframe',
];

/** Tags HTML de texto narrativo (se incluyen en el overlay). */
export const NARRATIVE_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'UL',
  'OL',
  'DL',
  'LI',
  'DT',
  'DD',
  'TABLE',
  'FIGURE',
  'FIGCAPTION',
  'CAPTION',
]);

/** Tags HTML que producen items de navegación en la barra lateral. */
export const INTERACTIVE_TAGS = new Set(['A', 'BUTTON']);

/**
 * Patrones de href que identifican links de navegación real.
 * Excluye anchors internos (#), javascript:, mailto:, etc.
 */
export const NAVIGABLE_HREF_PATTERNS = [/^https?:\/\//, /^\//];

/** ID del overlay en el DOM para evitar montajes duplicados. */
export const OVERLAY_ID = 'clrtxt-reading-overlay';

/** ID de la barra lateral desplegable. */
export const SIDEBAR_ID = 'clrtxt-reading-sidebar';

/** Nombres de los mensajes del sistema de mensajería. */
export const MSG_TOGGLE_READING = 'reading:toggle';
export const MSG_GET_STATE = 'reading:get-state';
export const MSG_GET_PREVIEW = 'reading:get-preview';

/** Nombres de los eventos emitidos al EventBus. */
export const EVENT_READING_ENABLED = 'reading:enabled';
export const EVENT_READING_DISABLED = 'reading:disabled';
