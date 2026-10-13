import { createLogger } from '../../shared/logger.js';
import { storage } from '../../core/storage.js';
import { eventBus } from '../../core/event-bus.js';
import { messaging } from '../../core/messaging.js';
import { MODULES } from '../../shared/constants.js';
import { createTtsEngine } from './tts.engine.js';
import { createReadButton } from './tts.ui.button.js';
import { createPlayer } from './tts.ui.player.js';
import { createViewer } from './tts.ui.viewer.js';
import { STORAGE_KEYS, TTS_DEFAULTS, TTS_EVENTS, DEFAULT_ENABLED } from './tts.config.js';

const log = createLogger('TTS');
const ttsStorage = storage.namespace(MODULES.TTS);

/** Tipos de mensajes que el módulo escucha desde el popup. */
const MSG = {
  ENABLED_CHANGED: 'tts:enabled-changed',
  VOICE_CHANGED: 'tts:voice-changed',
  RATE_CHANGED: 'tts:rate-changed',
  PITCH_CHANGED: 'tts:pitch-changed',
  VIEWER_SIZE_CHANGED: 'tts:viewer-size-changed',
  HIGHLIGHT_CHANGED: 'tts:highlight-changed',
  PAUSE_SUPPORTED_CHANGED: 'tts:pause-supported-changed',
  PING: 'tts:ping',
};

let engine = null;
let button = null;
let player = null;
let viewer = null;
let enabled = false;

// Funciones de desuscripción de los handlers de mensajes.
// Se llaman en destroy() para evitar fugas.
const messageUnsubs = [];

// Texto actual en reproducción. Se usa para releer cuando termina
// y el usuario presiona play de nuevo (opción C del estado finished).
let currentText = '';

// Preferencias cargadas desde storage. Se inicializan en init() y se
// actualizan en caliente cuando llegan mensajes del popup.
const prefs = {
  voice: TTS_DEFAULTS.voice,
  rate: TTS_DEFAULTS.rate,
  pitch: TTS_DEFAULTS.pitch,
  viewerSize: TTS_DEFAULTS.viewerSize,
  highlight: TTS_DEFAULTS.highlight,
};

/** Lee todas las preferencias del storage al arrancar el módulo. */
async function loadPrefs() {
  prefs.voice = await ttsStorage.get(STORAGE_KEYS.VOICE, TTS_DEFAULTS.voice);
  prefs.rate = await ttsStorage.get(STORAGE_KEYS.RATE, TTS_DEFAULTS.rate);
  prefs.pitch = await ttsStorage.get(STORAGE_KEYS.PITCH, TTS_DEFAULTS.pitch);
  prefs.viewerSize = await ttsStorage.get(STORAGE_KEYS.VIEWER_SIZE, TTS_DEFAULTS.viewerSize);
  prefs.highlight = await ttsStorage.get(STORAGE_KEYS.HIGHLIGHT, TTS_DEFAULTS.highlight);
  log.debug('Preferencias cargadas', prefs);
}

/**
 * Registra los handlers de mensajes del popup.
 * Los handlers actualizan prefs en memoria y, para los reactivos
 * (viewer size y highlight), aplican el cambio en vivo.
 */
function registerMessageHandlers() {
  messageUnsubs.push(
    messaging.onMessage(MSG.ENABLED_CHANGED, async (payload) => {
      // El popup activa/desactiva TTS sin afectar a los demás módulos.
      const shouldEnable = payload?.enabled ?? DEFAULT_ENABLED;
      if (shouldEnable) {
        enable();
      } else {
        // disable() ya detiene la lectura en curso y oculta el reproductor.
        disable();
      }
      // Defensa en profundidad: el popup ya persiste el estado. Gracias al
      // early-return idempotente de storage.set, esta escritura es no-op si
      // el valor ya coincide, así que no consume cuota extra.
      await ttsStorage.set(STORAGE_KEYS.ENABLED, shouldEnable);
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.VOICE_CHANGED, (payload) => {
      // Aplica en la próxima lectura. La lectura actual sigue con la voz vieja.
      prefs.voice = payload?.voiceURI ?? null;
      log.debug(`Voz actualizada (próxima lectura): ${prefs.voice}`);
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.RATE_CHANGED, (payload) => {
      // Aplica en la próxima lectura por ahora. En Sesión 3b: pausa+play.
      prefs.rate = payload?.rate ?? TTS_DEFAULTS.rate;
      log.debug(`Velocidad actualizada (próxima lectura): ${prefs.rate}`);
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.PITCH_CHANGED, (payload) => {
      // Aplica en la próxima lectura.
      prefs.pitch = payload?.pitch ?? TTS_DEFAULTS.pitch;
      log.debug(`Tono actualizado (próxima lectura): ${prefs.pitch}`);
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.VIEWER_SIZE_CHANGED, (payload) => {
      // Aplica en vivo al visor si está abierto.
      prefs.viewerSize = payload?.size ?? TTS_DEFAULTS.viewerSize;
      if (viewer) {
        viewer.setSize(prefs.viewerSize);
      }
      log.debug(`Tamaño del visor actualizado en vivo: ${prefs.viewerSize}`);
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.HIGHLIGHT_CHANGED, (payload) => {
      // Aplica en vivo al visor.
      prefs.highlight = payload?.highlight ?? TTS_DEFAULTS.highlight;
      if (viewer) {
        viewer.setHighlightEnabled(prefs.highlight);
      }
      log.debug(`Resaltado actualizado en vivo: ${prefs.highlight}`);
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.PAUSE_SUPPORTED_CHANGED, (payload) => {
      // Comunica al player si debe deshabilitar el botón pausa.
      const supported = payload?.supported ?? true;
      if (player) {
        player.setPauseSupported(supported);
      }
      log.debug(`Soporte de pausa actualizado: ${supported}`);
    }),
  );

  messageUnsubs.push(
    messaging.onMessage(MSG.PING, () => {
      // Sirve al popup para verificar si el content script está activo.
      return { active: true };
    }),
  );

  log.info(`Handlers de mensajes registrados (${messageUnsubs.length})`);
}

/** Inicia una nueva lectura. Detiene cualquier lectura anterior. */
function startReading(text) {
  currentText = text;
  // Decisión 3A: el visor muestra el texto nuevo de inmediato.
  viewer.setText(text);
  viewer.setSize(prefs.viewerSize);
  viewer.setHighlightEnabled(prefs.highlight);

  player.show();
  player.setRate(prefs.rate);
  player.setState('idle');

  // Decisión 2A: si hay una lectura activa, se detiene antes de empezar.
  // El engine.speak ya hace internamente stop() antes de iniciar.
  viewer.start();
  engine.speak(text, {
    rate: prefs.rate,
    pitch: prefs.pitch,
    voiceName: prefs.voice,
  });
}

/** Conecta los callbacks del engine con la UI del player y el viewer. */
function wireEngineCallbacks() {
  engine.onStart = () => {
    player.setState('playing');
    eventBus.emit(TTS_EVENTS.READ_STARTED, { text: currentText });
  };
  engine.onEnd = () => {
    // Opción C que elegiste: el player queda en estado finished.
    player.setState('finished');
    viewer.stop();
    eventBus.emit(TTS_EVENTS.READ_FINISHED, {});
  };
  engine.onPause = () => {
    player.setState('paused');
    eventBus.emit(TTS_EVENTS.READ_PAUSED, {});
  };
  engine.onResume = () => {
    player.setState('playing');
    eventBus.emit(TTS_EVENTS.READ_RESUMED, {});
  };
  engine.onBoundary = ({ charIndex, charLength }) => {
    viewer.highlightWord(charIndex, charLength);
    eventBus.emit(TTS_EVENTS.WORD_BOUNDARY, { charIndex, charLength });
  };
  engine.onError = (error) => {
    log.error('Engine reportó error:', error);
    player.setState('finished');
    viewer.stop();
  };
}

/** Construye las piezas de UI y las conecta entre sí. */
function buildUi() {
  player = createPlayer({
    onTogglePlay: () => {
      // Decisión basada en el estado REAL del engine, no en el state del player
      // (que puede no estar sincronizado si onStart no se disparó).
      if (engine.isPaused()) {
        // Pausado: reanudar.
        engine.resume();
      } else if (engine.isActive()) {
        // Reproduciendo: pausar.
        engine.pause();
      } else {
        // No hay lectura activa: releer desde el principio (estado finished).
        startReading(currentText);
      }
    },
    onStop: () => {
      engine.stop();
      viewer.stop();
      player.setState('idle');
      eventBus.emit(TTS_EVENTS.READ_STOPPED, {});
    },
    onRateChange: (newRate) => {
      // El slider del reproductor flotante. Guarda en storage.
      prefs.rate = newRate;
      ttsStorage.set(STORAGE_KEYS.RATE, newRate);
    },
    onClose: () => {
      // Decisión 4A: cerrar reproductor también detiene la lectura.
      engine.stop();
      viewer.stop();
    },
  });

  // El visor se monta dentro del contenedor del player.
  viewer = createViewer(player.getBodyContainer());

  button = createReadButton((text) => {
    startReading(text);
  });
}

async function init() {
  log.info('Inicializando módulo TTS');
  engine = createTtsEngine();
  await engine.ready();
  await loadPrefs();

  // El usuario puede haber desactivado TTS desde el popup. El module-loader
  // llama enable() automáticamente tras init() salvo que autoEnable sea
  // false, así que exponemos el estado persistido en lugar de llamar a
  // enable() manualmente: así el estado del loader queda coherente.
  ttsModule.autoEnable = await ttsStorage.get(STORAGE_KEYS.ENABLED, DEFAULT_ENABLED);

  buildUi();
  wireEngineCallbacks();
  registerMessageHandlers();
}

function enable() {
  if (enabled) {
    return;
  }
  enabled = true;
  button.enable();
  log.info('Módulo TTS activado');
}

function disable() {
  if (!enabled) {
    return;
  }
  enabled = false;
  button.disable();
  if (engine) {
    engine.stop();
  }
  if (player) {
    player.hide();
  }
  log.info('Módulo TTS desactivado');
}

function destroy() {
  disable();
  // Desuscribir todos los handlers de mensajes.
  messageUnsubs.forEach((unsub) => unsub());
  messageUnsubs.length = 0;
  // Las referencias se sueltan para que el GC pueda liberar memoria.
  engine = null;
  button = null;
  player = null;
  viewer = null;
  log.info('Módulo TTS destruido');
}

export const ttsModule = { init, enable, disable, destroy };
