import { createLogger } from '../../shared/logger.js';
import { BUILT_IN_FONTS, FONTS_DEFAULTS, STORAGE_KEYS, ASSET_BASE } from './fonts.config.js';

const log = createLogger('Fonts-Engine');

const STYLE_ID = 'clrtxt-fonts-style';

const TARGET_SELECTORS =
  'body, p, h1, h2, h3, h4, h5, h6, li, td, th, dd, dt, ' +
  'blockquote, article, section, main, aside, nav, header, footer, ' +
  'figure, figcaption, label, input, textarea, select, button, a, ' +
  'code, pre, small, address';

const hasLocal =
  typeof chrome !== 'undefined' &&
  typeof chrome.storage !== 'undefined' &&
  typeof chrome.storage.local !== 'undefined';

export function createLocalStorage() {
  const memory = new Map();

  async function get(key) {
    if (!hasLocal) {
      return memory.has(key) ? memory.get(key) : undefined;
    }
    try {
      const result = await chrome.storage.local.get(key);
      return result?.[key];
    } catch (err) {
      log.warn(`storage.get falló para "${key}": ${err.message}`);
      return memory.get(key);
    }
  }

  async function set(key, value) {
    if (!hasLocal) {
      memory.set(key, value);
      return;
    }
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (err) {
      log.warn(`storage.set falló para "${key}": ${err.message}`);
      memory.set(key, value);
    }
  }

  async function remove(key) {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) {
      return;
    }
    if (!hasLocal) {
      for (const k of keys) {
        memory.delete(k);
      }
      return;
    }
    try {
      await chrome.storage.local.remove(keys);
    } catch (err) {
      log.warn(`storage.remove falló: ${err.message}`);
      for (const k of keys) {
        memory.delete(k);
      }
    }
  }

  async function getMultiple(keys) {
    const out = {};
    for (const key of keys) {
      out[key] = await get(key);
    }
    return out;
  }

  return { get, set, remove, getMultiple };
}

export function createFontsEngine(storage) {
  if (!storage) {
    throw new Error('createFontsEngine: storage es requerido');
  }
  const customFonts = new Map();
  let currentFontId = null;
  let observer = null;

  const engine = {
    onChange: () => {},
    onError: () => {},
  };

  function resolveFont(id) {
    if (!id) {
      return null;
    }
    const builtIn = BUILT_IN_FONTS.find((f) => f.id === id);
    if (builtIn) {
      return { family: builtIn.family, source: 'built-in', weights: Object.keys(builtIn.files) };
    }
    const custom = customFonts.get(id);
    if (custom) {
      return { family: custom.family, source: 'custom', weights: ['400'] };
    }
    return null;
  }

  function buildFontFaceCSS() {
    const rules = [];
    for (const font of BUILT_IN_FONTS) {
      for (const [weight, file] of Object.entries(font.files)) {
        const url = chrome.runtime.getURL(ASSET_BASE + file);
        rules.push(
          `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${url}') format('woff2');}`,
        );
      }
    }
    for (const custom of customFonts.values()) {
      rules.push(
        `@font-face{font-family:'${custom.family}';font-style:normal;font-weight:400;font-display:swap;src:url('${custom.dataUrl}') format('${custom.format}');}`,
      );
    }
    return rules.join('\n');
  }

  function buildOverrideCSS(family) {
    return `${TARGET_SELECTORS}{font-family:'${family}' !important;}`;
  }

  function rebuildStyle() {
    const head = document.head || document.documentElement;
    if (!head) {
      return;
    }
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      head.appendChild(el);
    }
    const fontFace = buildFontFaceCSS();
    const resolved = resolveFont(currentFontId);
    const override = resolved ? buildOverrideCSS(resolved.family) : '';
    el.textContent = fontFace + (override ? '\n' + override : '');
  }

  function removeStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) {
      el.remove();
    }
  }

  function setupObserver() {
    if (observer) {
      return;
    }
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    const head = document.head;
    if (!head) {
      return;
    }
    try {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.removedNodes) {
            if (node.nodeType === 1 && node.id === STYLE_ID) {
              log.debug('Style removido por la página, re-inyectando');
              rebuildStyle();
              return;
            }
          }
        }
      });
      observer.observe(head, { childList: true });
    } catch (err) {
      log.warn(`No se pudo instalar MutationObserver: ${err.message}`);
      observer = null;
    }
  }

  async function init() {
    try {
      const stored = await storage.get(STORAGE_KEYS.ACTIVE_FONT_ID);
      if (stored && resolveFont(stored)) {
        currentFontId = stored;
        rebuildStyle();
      } else if (stored) {
        log.warn(`Fuente persistida "${stored}" no disponible, se descarta`);
        currentFontId = null;
        await storage.set(STORAGE_KEYS.ACTIVE_FONT_ID, FONTS_DEFAULTS.activeFontId);
      }
      setupObserver();
    } catch (err) {
      log.error(`init falló: ${err.message}`);
      engine.onError(err.message);
    }
  }

  async function apply(fontId) {
    try {
      if (fontId && !resolveFont(fontId)) {
        log.warn(`Fuente desconocida: ${fontId}`);
        engine.onError(`Fuente desconocida: ${fontId}`);
        return false;
      }
      currentFontId = fontId || null;
      await storage.set(STORAGE_KEYS.ACTIVE_FONT_ID, currentFontId);
      if (currentFontId) {
        rebuildStyle();
      } else {
        removeStyle();
      }
      engine.onChange(currentFontId);
      return true;
    } catch (err) {
      log.error(`apply falló: ${err.message}`);
      engine.onError(err.message);
      return false;
    }
  }

  async function clear() {
    return apply(null);
  }

  function getCurrent() {
    return currentFontId;
  }

  function getAvailableFonts() {
    return BUILT_IN_FONTS.map((f) => ({ ...f }));
  }

  function addCustomFont(meta) {
    if (!meta?.id || !meta?.family || !meta?.dataUrl || !meta?.format) {
      log.warn('addCustomFont: meta incompleto');
      return false;
    }
    customFonts.set(meta.id, { ...meta });
    if (currentFontId === meta.id) {
      rebuildStyle();
    }
    return true;
  }

  function removeCustomFont(id) {
    const existed = customFonts.delete(id);
    if (existed && currentFontId === id) {
      currentFontId = null;
      removeStyle();
    }
    return existed;
  }

  function getCustomFonts() {
    return Array.from(customFonts.values()).map((c) => ({
      id: c.id,
      displayName: c.displayName,
      family: c.family,
      format: c.format,
      sizeBytes: c.sizeBytes,
      addedAt: c.addedAt,
    }));
  }

  function clearCustomFonts() {
    const had = customFonts.size > 0;
    customFonts.clear();
    return had;
  }

  function destroy() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    removeStyle();
    currentFontId = null;
    customFonts.clear();
  }

  engine.init = init;
  engine.apply = apply;
  engine.clear = clear;
  engine.getCurrent = getCurrent;
  engine.getAvailableFonts = getAvailableFonts;
  engine.addCustomFont = addCustomFont;
  engine.removeCustomFont = removeCustomFont;
  engine.clearCustomFonts = clearCustomFonts;
  engine.getCustomFonts = getCustomFonts;
  engine.destroy = destroy;

  return engine;
}
