/**
 * Módulo Focus Line — regla de lectura digital.
 */
import { createLogger } from '../../shared/logger.js';
import { storage } from '../../core/storage.js';
import { eventBus } from '../../core/event-bus.js';
import { messaging } from '../../core/messaging.js';
import { MODULES } from '../../shared/constants.js';
import { createFocusLineEngine } from './focus-line.engine.js';
import {
  STORAGE_KEYS,
  FOCUS_LINE_DEFAULTS,
  FOCUS_LINE_EVENTS,
  FOCUS_LINE_MESSAGES,
  FOCUS_LINE_MODES,
} from './focus-line.config.js';

const log = createLogger('FocusLine');
const focusStorage = storage.namespace(MODULES.FOCUS_LINE);

let engine = null;
let moduleEnabled = false;

const prefs = {
  enabled: FOCUS_LINE_DEFAULTS.enabled,
  mode: FOCUS_LINE_DEFAULTS.mode,
  overlayOpacity: FOCUS_LINE_DEFAULTS.overlayOpacity,
  highlightColor: FOCUS_LINE_DEFAULTS.highlightColor,
  heightPx: FOCUS_LINE_DEFAULTS.heightPx,
};

async function loadPrefs() {
  prefs.enabled = await focusStorage.get(STORAGE_KEYS.ENABLED, FOCUS_LINE_DEFAULTS.enabled);
  prefs.mode = await focusStorage.get(STORAGE_KEYS.MODE, FOCUS_LINE_DEFAULTS.mode);
  prefs.overlayOpacity = await focusStorage.get(
    STORAGE_KEYS.OVERLAY_OPACITY,
    FOCUS_LINE_DEFAULTS.overlayOpacity,
  );
  prefs.highlightColor = await focusStorage.get(
    STORAGE_KEYS.HIGHLIGHT_COLOR,
    FOCUS_LINE_DEFAULTS.highlightColor,
  );
  prefs.heightPx = await focusStorage.get(STORAGE_KEYS.HEIGHT_PX, FOCUS_LINE_DEFAULTS.heightPx);
  log.debug('Preferencias cargadas', prefs);
}

function stylePrefs() {
  return {
    overlayOpacity: prefs.overlayOpacity,
    highlightColor: prefs.highlightColor,
    heightPx: prefs.heightPx,
  };
}

function startOverlay() {
  if (engine.isActive()) {
    return;
  }
  engine.activate(prefs.mode, stylePrefs());
  eventBus.emit(FOCUS_LINE_EVENTS.ENABLED, { mode: prefs.mode });
}

function stopOverlay() {
  if (!engine.isActive()) {
    return;
  }
  engine.deactivate();
  eventBus.emit(FOCUS_LINE_EVENTS.DISABLED, {});
}

function handleEnable() {
  prefs.enabled = true;
  focusStorage.set(STORAGE_KEYS.ENABLED, true);
  startOverlay();
  return { ok: true, enabled: true, mode: prefs.mode };
}

function handleDisable() {
  prefs.enabled = false;
  focusStorage.set(STORAGE_KEYS.ENABLED, false);
  stopOverlay();
  return { ok: true, enabled: false };
}

function handleSetMode(payload) {
  const newMode = payload?.mode;
  if (!Object.values(FOCUS_LINE_MODES).includes(newMode)) {
    log.warn(`handleSetMode: modo inválido "${newMode}"`);
    return { ok: false, error: 'modo inválido' };
  }
  prefs.mode = newMode;
  focusStorage.set(STORAGE_KEYS.MODE, newMode);
  engine.setMode(newMode);
  eventBus.emit(FOCUS_LINE_EVENTS.MODE_CHANGED, { mode: newMode });
  return { ok: true, mode: newMode };
}

function handleSetStyle(payload) {
  if (payload?.overlayOpacity !== undefined) {
    prefs.overlayOpacity = payload.overlayOpacity;
    focusStorage.set(STORAGE_KEYS.OVERLAY_OPACITY, prefs.overlayOpacity);
  }
  if (payload?.highlightColor !== undefined) {
    prefs.highlightColor = payload.highlightColor;
    focusStorage.set(STORAGE_KEYS.HIGHLIGHT_COLOR, prefs.highlightColor);
  }
  if (payload?.heightPx !== undefined) {
    prefs.heightPx = payload.heightPx;
    focusStorage.set(STORAGE_KEYS.HEIGHT_PX, prefs.heightPx);
  }
  if (engine.isActive()) {
    engine.setStyle(stylePrefs());
  }
  return { ok: true };
}

function handleGetState() {
  return {
    ok: true,
    enabled: prefs.enabled,
    mode: prefs.mode,
    overlayOpacity: prefs.overlayOpacity,
    highlightColor: prefs.highlightColor,
    heightPx: prefs.heightPx,
  };
}

async function init() {
  log.info('Inicializando módulo FocusLine');
  engine = createFocusLineEngine();

  engine.onClose = () => {
    log.info('Cierre desde botón flotante');
    prefs.enabled = false;
    focusStorage.set(STORAGE_KEYS.ENABLED, false);
    stopOverlay();
    eventBus.emit(FOCUS_LINE_EVENTS.DISABLED, { source: 'close-button' });
  };

  await loadPrefs();

  messaging.onMessage(FOCUS_LINE_MESSAGES.ENABLE, handleEnable);
  messaging.onMessage(FOCUS_LINE_MESSAGES.DISABLE, handleDisable);
  messaging.onMessage(FOCUS_LINE_MESSAGES.SET_MODE, handleSetMode);
  messaging.onMessage(FOCUS_LINE_MESSAGES.SET_STYLE, handleSetStyle);
  messaging.onMessage(FOCUS_LINE_MESSAGES.GET_STATE, handleGetState);

  log.info('Módulo FocusLine inicializado');
}

function enable() {
  if (moduleEnabled) {
    return;
  }
  moduleEnabled = true;
  if (prefs.enabled) {
    startOverlay();
  }
  log.info('Módulo FocusLine activado');
}

function disable() {
  if (!moduleEnabled) {
    return;
  }
  moduleEnabled = false;
  stopOverlay();
  log.info('Módulo FocusLine desactivado');
}

function destroy() {
  disable();
  engine = null;
  log.info('Módulo FocusLine destruido');
}

export const focusLineModule = { init, enable, disable, destroy };
