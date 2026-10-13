import { createLogger } from '../../shared/logger.js';
import { PREFERRED_LANGS, TTS_DEFAULTS, TTS_LIMITS } from './tts.config.js';

const log = createLogger('TTS-Engine');

const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createTtsEngine() {
  let voicesCache = [];

  // Callbacks que la UI puede asignar. Por defecto no hacen nada.
  const engine = {
    onStart: () => {},
    onEnd: () => {},
    onPause: () => {},
    onResume: () => {},
    onBoundary: () => {},
    onError: () => {},
  };

  /** Carga la lista de voces. En Chrome puede llegar vacía al inicio. */
  function loadVoices() {
    if (!hasSpeech) {
      return [];
    }
    voicesCache = window.speechSynthesis.getVoices();
    return voicesCache;
  }

  /**
   * Espera a que las voces estén disponibles. Necesario porque Chrome
   * carga las voces de forma asíncrona tras el primer getVoices().
   *
   * @returns {Promise<void>}
   */
  function ready() {
    return new Promise((resolve) => {
      if (!hasSpeech) {
        log.warn('speechSynthesis no disponible en este navegador');
        resolve();
        return;
      }
      const voices = loadVoices();
      if (voices.length > 0) {
        resolve();
        return;
      }
      // Si llegaron vacías, esperar al evento voiceschanged.
      window.speechSynthesis.addEventListener(
        'voiceschanged',
        () => {
          loadVoices();
          resolve();
        },
        { once: true },
      );
    });
  }

  /** Devuelve la lista de voces disponibles. */
  function getVoices() {
    if (voicesCache.length === 0) {
      loadVoices();
    }
    return voicesCache;
  }

  /**
   * Elige la mejor voz disponible según las preferencias de idioma.
   * Si no hay ninguna en español, devuelve null (voz por defecto del sistema).
   *
   * @returns {SpeechSynthesisVoice|null}
   */
  function pickPreferredVoice() {
    const voices = getVoices();
    if (voices.length === 0) {
      return null;
    }
    for (const lang of PREFERRED_LANGS) {
      const match = voices.find((v) => v.lang === lang || v.lang.startsWith(lang));
      if (match) {
        log.debug(`Voz elegida: ${match.name} (${match.lang})`);
        return match;
      }
    }
    log.debug('No se encontró voz en español, usando la del sistema');
    return null;
  }

  /**
   * Inicia la lectura de un texto.
   *
   * @param {string} text - Texto a leer.
   * @param {object} [options] - { rate, pitch, voiceName }.
   */
  function speak(text, options = {}) {
    if (!hasSpeech) {
      log.error('No se puede leer: speechSynthesis no disponible');
      return;
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      log.warn('speak: texto vacío, se ignora');
      return;
    }

    stop(); // Detener cualquier lectura en curso antes de empezar otra.

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = clamp(
      options.rate ?? TTS_DEFAULTS.rate,
      TTS_LIMITS.rate.min,
      TTS_LIMITS.rate.max,
    );
    utterance.pitch = clamp(
      options.pitch ?? TTS_DEFAULTS.pitch,
      TTS_LIMITS.pitch.min,
      TTS_LIMITS.pitch.max,
    );

    // Asignar voz: la indicada por nombre, o la preferida automática.
    const voices = getVoices();
    const chosen = options.voiceName
      ? voices.find((v) => v.name === options.voiceName)
      : pickPreferredVoice();
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    }

    utterance.onstart = () => {
      log.debug('Lectura iniciada');
      engine.onStart();
    };
    utterance.onend = () => {
      log.debug('Lectura finalizada');
      engine.onEnd();
    };
    utterance.onpause = () => engine.onPause();
    utterance.onresume = () => engine.onResume();
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        engine.onBoundary({ charIndex: event.charIndex, charLength: event.charLength });
      }
    };
    utterance.onerror = (event) => {
      log.error('Error en la síntesis de voz:', event.error);
      engine.onError(event.error);
    };

    window.speechSynthesis.speak(utterance);
  }

  /** Pausa la lectura en curso. */
  function pause() {
    if (hasSpeech && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  }

  /** Reanuda una lectura pausada. */
  function resume() {
    if (hasSpeech && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  /** Detiene la lectura por completo. */
  function stop() {
    if (hasSpeech && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
      window.speechSynthesis.cancel();
    }
  }

  /** Indica si hay una lectura en curso (reproduciendo o pausada). */
  function isActive() {
    return hasSpeech && (window.speechSynthesis.speaking || window.speechSynthesis.paused);
  }

  /** Indica si la lectura está pausada. */
  function isPaused() {
    return hasSpeech && window.speechSynthesis.paused;
  }

  engine.ready = ready;
  engine.getVoices = getVoices;
  engine.speak = speak;
  engine.pause = pause;
  engine.resume = resume;
  engine.stop = stop;
  engine.isActive = isActive;
  engine.isPaused = isPaused;

  return engine;
}
