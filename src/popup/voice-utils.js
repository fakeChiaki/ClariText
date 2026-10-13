import { createLogger } from '../shared/logger.js';

const log = createLogger('VoiceUtils');

const SPANISH_PREFIX = 'es-';
const MULTILINGUAL_TAG = 'Multilingual';
const ONLINE_TAG = 'Online';

/**
 * Mapa de códigos de región a nombres en español.
 * Solo cubre los que aparecen en las voces de Microsoft (es-XX).
 */
const REGION_NAMES = {
  'es-AR': 'Argentina',
  'es-BO': 'Bolivia',
  'es-CL': 'Chile',
  'es-CO': 'Colombia',
  'es-CR': 'Costa Rica',
  'es-CU': 'Cuba',
  'es-DO': 'República Dominicana',
  'es-EC': 'Ecuador',
  'es-ES': 'España',
  'es-GQ': 'Guinea Ecuatorial',
  'es-GT': 'Guatemala',
  'es-HN': 'Honduras',
  'es-MX': 'México',
  'es-NI': 'Nicaragua',
  'es-PA': 'Panamá',
  'es-PE': 'Perú',
  'es-PR': 'Puerto Rico',
  'es-PY': 'Paraguay',
  'es-SV': 'El Salvador',
  'es-US': 'Estados Unidos',
  'es-UY': 'Uruguay',
  'es-VE': 'Venezuela',
};

/**
 * Espera a que speechSynthesis cargue las voces. En Chrome, las voces se cargan
 * de manera asíncrona y getVoices() devuelve [] al inicio.
 *
 * @param {number} timeoutMs - Timeout máximo en milisegundos (default 3000).
 * @returns {Promise<SpeechSynthesisVoice[]>} Lista de voces disponibles.
 */
export function waitForVoices(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const existing = speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    let resolved = false;
    const onVoicesChanged = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(speechSynthesis.getVoices());
    };

    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        log.warn('Timeout esperando voces, devolviendo lo que haya');
        resolve(speechSynthesis.getVoices());
      }
    }, timeoutMs);
  });
}

/**
 * Filtra voces en español y elimina las "Multilingual" duplicadas.
 *
 * @param {SpeechSynthesisVoice[]} voices - Todas las voces del sistema.
 * @returns {SpeechSynthesisVoice[]} Solo voces en español, sin Multilingual.
 */
export function filterSpanishVoices(voices) {
  return voices.filter((voice) => {
    const isSpanish = voice.lang.startsWith(SPANISH_PREFIX);
    const isMultilingual = voice.name.includes(MULTILINGUAL_TAG);
    return isSpanish && !isMultilingual;
  });
}

/**
 * Determina si una voz es local (soporta pausa/resume).
 * Las voces de Microsoft con "Online" en el nombre son sintetizadas
 * en servidores remotos y NO soportan pausa confiable.
 *
 * @param {SpeechSynthesisVoice} voice
 * @returns {boolean} true si la voz es local.
 */
export function isLocalVoice(voice) {
  return !voice.name.includes(ONLINE_TAG);
}

/**
 * Obtiene el nombre legible de un país a partir del código de región.
 *
 * @param {string} lang - Código tipo "es-CL".
 * @returns {string} Nombre del país o el código si no se conoce.
 */
export function getRegionName(lang) {
  return REGION_NAMES[lang] || lang;
}

/**
 * Agrupa voces en dos categorías: Locales recomendadas y Online avanzadas.
 * Dentro de Online, ordena por región alfabéticamente (España al final).
 *
 * @param {SpeechSynthesisVoice[]} voices - Voces ya filtradas (solo español).
 * @returns {Array<{label: string, voices: SpeechSynthesisVoice[]}>} Grupos ordenados.
 */
export function groupVoicesByCategory(voices) {
  const locals = voices.filter(isLocalVoice);
  const online = voices.filter((v) => !isLocalVoice(v));

  const groups = [];

  // Grupo 1: voces locales (siempre primero si existen).
  if (locals.length > 0) {
    groups.push({
      label: 'Locales (recomendadas)',
      voices: locals,
    });
  }

  // Grupo 2: voces Online agrupadas por región, alfabéticamente.
  if (online.length > 0) {
    const byRegion = new Map();
    online.forEach((voice) => {
      if (!byRegion.has(voice.lang)) {
        byRegion.set(voice.lang, []);
      }
      byRegion.get(voice.lang).push(voice);
    });

    const sortedRegions = Array.from(byRegion.entries()).sort(([langA], [langB]) => {
      // España al final, el resto alfabético.
      if (langA === 'es-ES') {
        return 1;
      }
      if (langB === 'es-ES') {
        return -1;
      }
      return getRegionName(langA).localeCompare(getRegionName(langB), 'es');
    });

    sortedRegions.forEach(([lang, voiceList]) => {
      groups.push({
        label: `Online — ${getRegionName(lang)} (calidad superior)`,
        voices: voiceList,
      });
    });
  }

  return groups;
}

/**
 * Selecciona la mejor voz disponible aplicando jerarquía de fallback.
 *
 *  1. Voz guardada por el usuario (si existe en el sistema).
 *  2. Primera voz LOCAL disponible (Sabina, Raul en Windows).
 *  3. Voz de la región del navegador (puede ser Online).
 *  4. Cualquier voz en español (es-*).
 *  5. Voz default del navegador.
 *  6. null si no hay ninguna.
 *
 * @param {SpeechSynthesisVoice[]} allVoices - Todas las voces del sistema.
 * @param {string|null} savedVoiceUri - URI guardada en storage, o null.
 * @param {string} browserLang - Idioma del navegador, ej. "es-CL".
 * @returns {SpeechSynthesisVoice|null} Mejor voz disponible o null.
 */
export function selectBestVoice(allVoices, savedVoiceUri, browserLang) {
  // Nivel 1: voz guardada.
  if (savedVoiceUri) {
    const saved = allVoices.find((v) => v.voiceURI === savedVoiceUri);
    if (saved) {
      return saved;
    }
    log.warn('Voz guardada no disponible, aplicando fallback');
  }

  const spanishVoices = allVoices.filter((v) => v.lang.startsWith(SPANISH_PREFIX));

  // Nivel 2: primera voz local en español (preferimos local por soporte de pausa).
  const firstLocal = spanishVoices.find(isLocalVoice);
  if (firstLocal) {
    return firstLocal;
  }

  // Nivel 3: voz de la región del navegador (Online, pero al menos coincide).
  if (browserLang) {
    const regional = spanishVoices.find((v) => v.lang === browserLang);
    if (regional) {
      return regional;
    }
  }

  // Nivel 4: cualquier voz en español.
  if (spanishVoices.length > 0) {
    return spanishVoices[0];
  }

  // Nivel 5: voz default del navegador.
  const def = allVoices.find((v) => v.default);
  if (def) {
    return def;
  }

  return null;
}

/**
 * Verifica si hay al menos una voz en español en el sistema.
 *
 * @param {SpeechSynthesisVoice[]} allVoices - Todas las voces.
 * @returns {boolean} true si hay alguna voz es-*.
 */
export function hasSpanishVoices(allVoices) {
  return allVoices.some((v) => v.lang.startsWith(SPANISH_PREFIX));
}

/**
 * Verifica si hay al menos una voz local en español.
 *
 * @param {SpeechSynthesisVoice[]} allVoices - Todas las voces.
 * @returns {boolean} true si hay alguna voz local es-*.
 */
export function hasLocalSpanishVoices(allVoices) {
  return allVoices.some((v) => v.lang.startsWith(SPANISH_PREFIX) && isLocalVoice(v));
}
