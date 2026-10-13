/**
 * Wrapper sobre chrome.storage.sync para ClariText.
 *
 * Provee namespaces por módulo para evitar colisiones de claves.
 * Internamente las claves se guardan como '<namespace>.<key>'.
 *
 * Limitaciones de chrome.storage.sync:
 *   - 100 KB totales por extensión
 *   - 8 KB por item individual
 *   - 512 items máximo
 *   - cuota de escritura: MAX_WRITE_OPERATIONS_PER_MINUTE / hora
 *
 * Contrato de idempotencia:
 *   `set` y `setBatch` son idempotentes: omiten la escritura si el valor
 *   no cambió respecto al actual (early-return). Esta idempotencia es lo
 *   que permite que dos contextos distintos (p.ej. el popup y el módulo en
 *   el content script) escriban la misma clave sin duplicar el consumo de
 *   cuota: el segundo writer lee el valor ya escrito por el primero y omite
 *   la operación. Ver TODO de single-writer en focus-line.module.js.
 *
 * @example
 *   const ttsStorage = storage.namespace('tts');
 *   await ttsStorage.set('voice', 'es-ES');
 *   const voice = await ttsStorage.get('voice', 'es-CL');
 *   await ttsStorage.setBatch({ voice: 'es-ES', rate: 1.5 });
 *   await ttsStorage.remove('voice');
 *   await ttsStorage.clear();
 */

import { createLogger } from '../shared/logger.js';

const log = createLogger('Storage');

// Fallback en memoria para entornos sin chrome.storage (tests, Node).
const memoryFallback = new Map();
const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

async function rawGet(fullKey) {
  if (!hasChromeStorage) {
    return memoryFallback.get(fullKey);
  }
  try {
    const result = await chrome.storage.sync.get(fullKey);
    return result[fullKey];
  } catch (error) {
    log.error(`Falló get para "${fullKey}"`, error);
    return undefined;
  }
}

/**
 * Lee múltiples claves en una sola operación.
 *
 * @param {string[]} fullKeys - Claves completas (ya prefijadas).
 * @returns {Promise<object>} Mapa { fullKey: value } solo con las claves
 *   existentes; las inexistentes quedan ausentes (acceder da undefined).
 */
async function rawGetMany(fullKeys) {
  if (!hasChromeStorage) {
    const result = {};
    for (const key of fullKeys) {
      result[key] = memoryFallback.get(key);
    }
    return result;
  }
  try {
    return await chrome.storage.sync.get(fullKeys);
  } catch (error) {
    log.error(`Falló get para ${fullKeys.length} claves`, error);
    return {};
  }
}

async function rawSet(fullKey, value) {
  if (!hasChromeStorage) {
    memoryFallback.set(fullKey, value);
    return;
  }
  try {
    await chrome.storage.sync.set({ [fullKey]: value });
  } catch (error) {
    log.error(`Falló set para "${fullKey}"`, error);
  }
}

/**
 * Escribe múltiples claves en una sola operación de chrome.storage.sync.
 * chrome.storage.sync trata un objeto con N claves como UNA escritura,
 * no N, por lo que esto reduce el consumo de cuota.
 *
 * @param {object} prefixedUpdates - Mapa { fullKey: value } ya prefijado.
 */
async function rawSetBatch(prefixedUpdates) {
  if (!hasChromeStorage) {
    for (const [key, value] of Object.entries(prefixedUpdates)) {
      memoryFallback.set(key, value);
    }
    return;
  }
  try {
    await chrome.storage.sync.set(prefixedUpdates);
  } catch (error) {
    log.error(`Falló setBatch para ${Object.keys(prefixedUpdates).length} claves`, error);
  }
}

async function rawRemove(fullKey) {
  if (!hasChromeStorage) {
    memoryFallback.delete(fullKey);
    return;
  }
  try {
    await chrome.storage.sync.remove(fullKey);
  } catch (error) {
    log.error(`Falló remove para "${fullKey}"`, error);
  }
}

async function rawGetAllKeys() {
  if (!hasChromeStorage) {
    return Array.from(memoryFallback.keys());
  }
  try {
    const all = await chrome.storage.sync.get(null);
    return Object.keys(all);
  } catch (error) {
    log.error('Falló al listar claves', error);
    return [];
  }
}

/**
 * Crea un namespace de almacenamiento para un módulo concreto.
 *
 * @param {string} name - Identificador del módulo (ej: 'tts', 'visual').
 * @returns {object} API con get, set, setBatch, remove y clear acotados
 *   al namespace.
 */
function createNamespace(name) {
  if (typeof name !== 'string' || name.length === 0) {
    log.error('namespace() requiere un nombre válido');
    name = 'unknown';
  }

  const prefix = `${name}.`;

  return {
    /**
     * Obtiene un valor del namespace.
     *
     * @param {string} key - Clave dentro del namespace.
     * @param {*} [defaultValue] - Valor a devolver si la clave no existe.
     */
    async get(key, defaultValue) {
      const value = await rawGet(prefix + key);
      return value === undefined ? defaultValue : value;
    },

    /**
     * Guarda un valor (debe ser serializable como JSON).
     *
     * Early-return: si el valor es estrictamente igual (`===`) al actual,
     * no escribe, para no consumir cuota innecesariamente.
     *
     * Limitación: la comparación `===` solo es fiable para primitivos
     * (string, number, boolean). Para objetos/arrays compara referencias,
     * por lo que el consumidor debe hacer su propia comparación previa.
     * Caso borde: `NaN !== NaN` siempre, por lo que un valor NaN se
     * considera siempre "cambiado" y se reescribe cada vez.
     *
     * @param {string} key - Clave dentro del namespace.
     * @param {*} value - Valor a guardar.
     */
    async set(key, value) {
      const fullKey = prefix + key;
      const currentValue = await rawGet(fullKey);
      if (currentValue === value) {
        return;
      }
      await rawSet(fullKey, value);
      log.debug(`Guardado: ${fullKey}`);
    },

    /**
     * Guarda múltiples claves en una sola escritura de chrome.storage.sync.
     *
     * Agrupa N actualizaciones en UNA operación (en vez de N llamadas a
     * `set`), reduciendo el consumo de cuota y los roundtrips IPC.
     *
     * Early-return por clave: lee los valores actuales en una sola lectura
     * y filtra las claves cuyo valor no cambió. Si ninguna cambió, no
     * escribe nada.
     *
     * Limitación: igual que `set`, la comparación es estricta (`===`),
     * fiable solo para primitivos. Caso borde: un valor NaN se considera
     * siempre "cambiado" (`NaN !== NaN`) y se reescribe cada vez.
     *
     * @param {object} updates - Mapa { key: value } (claves sin prefijo).
     */
    async setBatch(updates) {
      if (typeof updates !== 'object' || updates === null) {
        log.error('setBatch requiere un objeto');
        return;
      }

      const keys = Object.keys(updates);
      if (keys.length === 0) {
        return;
      }

      // Una sola lectura para todas las claves del batch.
      const prefixedKeys = keys.map((key) => prefix + key);
      const current = await rawGetMany(prefixedKeys);

      // Early return: conservar solo las claves cuyo valor cambió.
      const changedUpdates = {};
      for (const key of keys) {
        const fullKey = prefix + key;
        if (current[fullKey] !== updates[key]) {
          changedUpdates[fullKey] = updates[key];
        }
      }

      if (Object.keys(changedUpdates).length === 0) {
        log.debug(`setBatch sin cambios para namespace "${name}"`);
        return;
      }

      await rawSetBatch(changedUpdates);
      log.debug(`setBatch aplicado: ${Object.keys(changedUpdates).length} claves`);
    },

    /** Elimina una clave del namespace. */
    async remove(key) {
      await rawRemove(prefix + key);
      log.debug(`Eliminado: ${prefix}${key}`);
    },

    /** Elimina TODAS las claves de este namespace (no afecta a otros). */
    async clear() {
      const allKeys = await rawGetAllKeys();
      const ownKeys = allKeys.filter((k) => k.startsWith(prefix));
      for (const key of ownKeys) {
        await rawRemove(key);
      }
      log.info(`Namespace "${name}" limpiado (${ownKeys.length} claves)`);
    },
  };
}

export const storage = {
  namespace: createNamespace,
};
