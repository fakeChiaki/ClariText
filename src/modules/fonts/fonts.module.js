import { createLogger } from '../../shared/logger.js';
import { eventBus } from '../../core/event-bus.js';
import { messaging } from '../../core/messaging.js';
import { createFontsEngine, createLocalStorage } from './fonts.engine.js';
import { FONTS_EVENTS, STORAGE_KEYS, LIMITS } from './fonts.config.js';

const log = createLogger('Fonts');

let engine = null;
let enabled = false;

function wireEngineCallbacks() {
  engine.onChange = (fontId) => {
    eventBus.emit(FONTS_EVENTS.FONT_CHANGED, { fontId });
  };
  engine.onError = (message) => {
    log.warn('Engine reportó error:', message);
    eventBus.emit(FONTS_EVENTS.ERROR, { message });
  };
}

async function loadCustomFonts(storage) {
  const index = (await storage.get(STORAGE_KEYS.CUSTOM_INDEX)) || [];
  for (const entry of index) {
    const dataUrl = await storage.get(STORAGE_KEYS.CUSTOM_DATA_PREFIX + entry.id);
    if (dataUrl) {
      engine.addCustomFont({ ...entry, dataUrl });
    } else {
      log.warn(`Custom font "${entry.id}" sin dataUrl, se omite`);
    }
  }
}

async function addCustomFont(meta, dataUrl) {
  if (!meta?.id || !meta?.family || !dataUrl) {
    return { ok: false, message: 'Datos incompletos' };
  }
  const storage = createLocalStorage();
  const index = (await storage.get(STORAGE_KEYS.CUSTOM_INDEX)) || [];
  if (index.some((e) => e.id === meta.id)) {
    const existing = index.find((e) => e.id === meta.id);
    engine.addCustomFont({ ...existing, dataUrl });
    return { ok: true, entry: existing };
  }
  if (index.length >= LIMITS.CUSTOM_FONTS_MAX) {
    return {
      ok: false,
      message: `Máximo ${LIMITS.CUSTOM_FONTS_MAX} fuentes personalizadas`,
    };
  }
  try {
    const entry = {
      id: meta.id,
      displayName: meta.displayName,
      family: meta.family,
      format: meta.format,
      sizeBytes: meta.sizeBytes,
      addedAt: Date.now(),
    };
    await storage.set(STORAGE_KEYS.CUSTOM_DATA_PREFIX + meta.id, dataUrl);
    await storage.set(STORAGE_KEYS.CUSTOM_INDEX, [...index, entry]);
    engine.addCustomFont({ ...entry, dataUrl });
    eventBus.emit(FONTS_EVENTS.FONT_ADDED, { id: meta.id });
    return { ok: true, entry };
  } catch (err) {
    log.error(`addCustomFont falló: ${err.message}`);
    return { ok: false, message: err.message };
  }
}

async function removeCustomFont(id) {
  if (!id) {
    return { ok: false, message: 'ID requerido' };
  }
  const storage = createLocalStorage();
  try {
    const index = (await storage.get(STORAGE_KEYS.CUSTOM_INDEX)) || [];
    const newIndex = index.filter((e) => e.id !== id);
    await storage.remove(STORAGE_KEYS.CUSTOM_DATA_PREFIX + id);
    await storage.set(STORAGE_KEYS.CUSTOM_INDEX, newIndex);
    engine.removeCustomFont(id);
    eventBus.emit(FONTS_EVENTS.FONT_REMOVED, { id });
    return { ok: true };
  } catch (err) {
    log.error(`removeCustomFont falló: ${err.message}`);
    return { ok: false, message: err.message };
  }
}

async function resetFonts() {
  const storage = createLocalStorage();
  try {
    const index = (await storage.get(STORAGE_KEYS.CUSTOM_INDEX)) || [];
    const keysToRemove = [STORAGE_KEYS.ACTIVE_FONT_ID, STORAGE_KEYS.CUSTOM_INDEX];
    for (const entry of index) {
      keysToRemove.push(STORAGE_KEYS.CUSTOM_DATA_PREFIX + entry.id);
    }
    await storage.remove(keysToRemove);
    if (engine) {
      await engine.clear();
      engine.clearCustomFonts();
    }
    eventBus.emit(FONTS_EVENTS.RESET, {});
    return { ok: true };
  } catch (err) {
    log.error(`resetFonts falló: ${err.message}`);
    return { ok: false, message: err.message };
  }
}

function wireMessageHandlers() {
  messaging.onMessage('fonts:apply', async (payload) => {
    const fontId = payload?.fontId || null;
    const ok = await engine.apply(fontId);
    return { ok, fontId: engine.getCurrent() };
  });
  messaging.onMessage('fonts:clear', async () => {
    const ok = await engine.clear();
    return { ok, fontId: null };
  });
  messaging.onMessage('fonts:add-custom', async (payload) => {
    return addCustomFont(payload?.meta, payload?.dataUrl);
  });
  messaging.onMessage('fonts:remove-custom', async (payload) => {
    return removeCustomFont(payload?.id);
  });
  messaging.onMessage('fonts:reset', async () => {
    return resetFonts();
  });
}

async function init() {
  log.info('Inicializando módulo Fonts');
  const storage = createLocalStorage();
  engine = createFontsEngine(storage);
  wireEngineCallbacks();
  wireMessageHandlers();
  await loadCustomFonts(storage);
  await engine.init();
}

function enable() {
  if (enabled) {
    return;
  }
  enabled = true;
  log.info('Módulo Fonts activado');
}

function disable() {
  if (!enabled) {
    return;
  }
  enabled = false;
  log.info('Módulo Fonts desactivado');
}

function destroy() {
  disable();
  if (engine) {
    engine.destroy();
    engine = null;
  }
  log.info('Módulo Fonts destruido');
}

export const fontsModule = {
  init,
  enable,
  disable,
  destroy,
};
