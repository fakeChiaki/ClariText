export const BUILT_IN_FONTS = [
  {
    id: 'opendyslexic',
    displayName: 'OpenDyslexic',
    family: 'ClariText OpenDyslexic',
    files: {
      400: 'opendyslexic-regular.woff2',
      700: 'opendyslexic-bold.woff2',
    },
    category: 'dyslexia',
    license: 'SIL OFL 1.1',
  },
  {
    id: 'lexend',
    displayName: 'Lexend',
    family: 'ClariText Lexend',
    files: {
      400: 'lexend-regular.woff2',
      700: 'lexend-bold.woff2',
    },
    category: 'sans-serif',
    license: 'SIL OFL 1.1',
  },
  {
    id: 'atkinson',
    displayName: 'Atkinson Hyperlegible',
    family: 'ClariText Atkinson',
    files: {
      400: 'atkinson-hyperlegible-regular.woff2',
      700: 'atkinson-hyperlegible-bold.woff2',
    },
    category: 'sans-serif',
    license: 'SIL OFL 1.1',
  },
  {
    id: 'lato',
    displayName: 'Lato',
    family: 'ClariText Lato',
    files: {
      400: 'lato-regular.woff2',
      700: 'lato-bold.woff2',
    },
    category: 'sans-serif',
    license: 'SIL OFL 1.1',
  },
  {
    id: 'comic-neue',
    displayName: 'Comic Neue',
    family: 'ClariText Comic Neue',
    files: {
      400: 'comic-neue-regular.woff2',
      700: 'comic-neue-bold.woff2',
    },
    category: 'dyslexia',
    license: 'SIL OFL 1.1',
  },
];

export const FONTS_DEFAULTS = {
  activeFontId: null,
};

export const STORAGE_KEYS = {
  ACTIVE_FONT_ID: 'fonts.activeFontId',
  CUSTOM_INDEX: 'fonts.customIndex',
  CUSTOM_DATA_PREFIX: 'fonts.custom.',
};

export const FONTS_EVENTS = {
  FONT_CHANGED: 'fonts:changed',
  FONT_ADDED: 'fonts:added',
  FONT_REMOVED: 'fonts:removed',
  RESET: 'fonts:reset',
  ERROR: 'fonts:error',
};

export const ALLOWED_FORMATS = ['.ttf', '.otf', '.woff', '.woff2'];

export const FILE_TYPE_MAP = {
  '.ttf': 'truetype',
  '.otf': 'opentype',
  '.woff': 'woff',
  '.woff2': 'woff2',
};

export const LIMITS = {
  CUSTOM_FONTS_MAX: 10,
  FILE_SIZE_MAX_BYTES: 2 * 1024 * 1024,
  FILE_NAME_MAX_CHARS: 40,
};

export const PREVIEW_TEXT = 'ClariText permite leer con mayor claridad y comodidad';

export const CATEGORIES = {
  dyslexia: 'Dislexia',
  'sans-serif': 'Sans-serif',
  serif: 'Serif',
  monospace: 'Monospace',
};

export const ASSET_BASE = 'modules/fonts/assets/';
