/**
 * EventBus de ClariText.
 *
 * Sistema pub/sub que permite a los módulos comunicarse sin conocerse
 * entre sí. Soporta solo nombres exactos (sin wildcards).
 *
 * Convención de nombres: <modulo>:<accion>
 *   Ejemplos: tts:read-request, visual:theme-changed
 *
 * @example
 *   const unsubscribe = eventBus.on('tts:read-request', (data) => {
 *     console.log(data.text);
 *   });
 *   eventBus.emit('tts:read-request', { text: 'Hola' });
 *   unsubscribe();
 */

import { createLogger } from '../shared/logger.js';

const log = createLogger('EventBus');

const subscribers = new Map();

/**
 * Suscribe un handler a un evento.
 *
 * @param {string} eventName - Nombre del evento (formato 'modulo:accion').
 * @param {Function} handler - Función que recibe los datos del evento.
 * @returns {Function} Función para cancelar la suscripción.
 */
function on(eventName, handler) {
  if (typeof eventName !== 'string' || eventName.length === 0) {
    log.error('on: nombre de evento inválido', eventName);
    return () => {};
  }
  if (typeof handler !== 'function') {
    log.error('on: handler debe ser una función', handler);
    return () => {};
  }

  if (!subscribers.has(eventName)) {
    subscribers.set(eventName, new Set());
  }
  subscribers.get(eventName).add(handler);
  log.debug(`Suscriptor registrado: ${eventName}`);

  return () => off(eventName, handler);
}

/** Cancela la suscripción de un handler. */
function off(eventName, handler) {
  const handlers = subscribers.get(eventName);
  if (!handlers) {
    return;
  }
  handlers.delete(handler);
  if (handlers.size === 0) {
    subscribers.delete(eventName);
  }
  log.debug(`Suscriptor removido: ${eventName}`);
}

/**
 * Emite un evento a todos los suscriptores. Cada handler se ejecuta
 * dentro de try-catch para que un error no afecte a los demás.
 *
 * @param {string} eventName - Nombre del evento a emitir.
 * @param {*} data - Datos a pasar a los handlers.
 */
function emit(eventName, data) {
  const handlers = subscribers.get(eventName);
  if (!handlers || handlers.size === 0) {
    log.debug(`Evento emitido sin suscriptores: ${eventName}`);
    return;
  }
  log.debug(`Emitiendo ${eventName} a ${handlers.size} suscriptor(es)`);
  for (const handler of handlers) {
    try {
      handler(data);
    } catch (error) {
      log.error(`Handler de "${eventName}" lanzó una excepción:`, error);
    }
  }
}

/** Devuelve cuántos suscriptores tiene un evento. Útil para tests. */
function listenerCount(eventName) {
  const handlers = subscribers.get(eventName);
  return handlers ? handlers.size : 0;
}

/** Remueve todos los suscriptores. Solo para tests o reinicio completo. */
function clear() {
  subscribers.clear();
  log.debug('Todos los suscriptores fueron removidos');
}

export const eventBus = {
  on,
  off,
  emit,
  listenerCount,
  clear,
};
