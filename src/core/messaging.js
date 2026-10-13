import { createLogger } from '../shared/logger.js';

const log = createLogger('Messaging');

const handlers = new Map();
const hasChromeRuntime =
  typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;

function isValidMessage(message) {
  return (
    message !== null &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    message.type.length > 0
  );
}

async function send(message) {
  if (!isValidMessage(message)) {
    log.error('send: mensaje inválido (debe tener type string)', message);
    return undefined;
  }
  if (!hasChromeRuntime) {
    log.warn(`send: chrome.runtime no disponible, mensaje descartado: ${message.type}`);
    return undefined;
  }
  try {
    const response = await chrome.runtime.sendMessage(message);
    log.debug(`Enviado: ${message.type}`);
    return response;
  } catch (error) {
    log.error(`Falló send para "${message.type}"`, error);
    return undefined;
  }
}

function onMessage(type, handler) {
  if (typeof type !== 'string' || type.length === 0) {
    log.error('onMessage: tipo de mensaje inválido', type);
    return () => {};
  }
  if (typeof handler !== 'function') {
    log.error('onMessage: handler debe ser una función', handler);
    return () => {};
  }
  handlers.set(type, handler);
  log.debug(`Handler registrado: ${type}`);
  return () => {
    handlers.delete(type);
    log.debug(`Handler removido: ${type}`);
  };
}

/** Dispatcher único que enruta mensajes entrantes al handler correspondiente. */
function dispatch(message, _sender, sendResponse) {
  if (!isValidMessage(message)) {
    return false;
  }
  const handler = handlers.get(message.type);
  if (!handler) {
    log.debug(`Mensaje sin handler: ${message.type}`);
    return false;
  }
  log.debug(`Procesando: ${message.type}`);
  try {
    const result = handler(message.payload);
    // Si el handler es async, esperamos su promesa y respondemos cuando resuelva.
    Promise.resolve(result)
      .then((response) => sendResponse(response))
      .catch((error) => {
        log.error(`Handler de "${message.type}" lanzó excepción:`, error);
        sendResponse(undefined);
      });
    // Devolvemos true para indicar a Chrome que sendResponse se llamará async.
    return true;
  } catch (error) {
    log.error(`Handler de "${message.type}" lanzó excepción síncrona:`, error);
    return false;
  }
}

function start() {
  if (!hasChromeRuntime || !chrome.runtime.onMessage) {
    log.warn('start: chrome.runtime.onMessage no disponible');
    return;
  }
  chrome.runtime.onMessage.addListener(dispatch);
  log.info('Dispatcher de mensajes activo');
}

export const messaging = {
  send,
  onMessage,
  start,
};
