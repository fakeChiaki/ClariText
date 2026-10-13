/**
 * Helpers para comunicación entre el popup y el content script.
 *
 * El popup vive en un contexto distinto al content script, por lo que la
 * comunicación se hace vía chrome.tabs.sendMessage hacia la pestaña activa.
 *
 * Si el content script no responde (por ejemplo, en páginas chrome:// o
 * en la Chrome Web Store), las funciones devuelven false sin lanzar error,
 * permitiendo al popup manejarlo con un mensaje al usuario.
 */

import { createLogger } from '../shared/logger.js';

const log = createLogger('PopupMessaging');

/**
 * Obtiene la pestaña activa de la ventana actual.
 *
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch (error) {
    log.error('No se pudo obtener la pestaña activa', error);
    return null;
  }
}

/**
 * Envía un mensaje al content script de la pestaña activa.
 *
 * Si la pestaña no tiene content script (chrome://, pestaña nueva vacía, etc.),
 * la llamada falla silenciosamente y devuelve false.
 *
 * @param {object} message - Mensaje con forma { type: string, payload?: any }.
 * @returns {Promise<boolean>} true si el mensaje llegó, false si falló.
 */
export async function sendMessageToContent(message) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    log.warn('No hay pestaña activa para enviar el mensaje');
    return false;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    log.debug('Mensaje enviado:', message.type);
    return true;
  } catch (error) {
    // chrome.tabs.sendMessage lanza si no hay receptor (página sin content script).
    log.debug(`Sin receptor en pestaña ${tab.id}: ${error.message}`);
    return false;
  }
}

/**
 * Verifica si la pestaña activa tiene el content script cargado.
 *
 * Útil para mostrar al usuario un mensaje explicativo cuando intenta
 * usar funcionalidades que requieren el TTS activo en la página.
 *
 * @returns {Promise<boolean>}
 */
export async function isContentScriptAvailable() {
  return sendMessageToContent({ type: 'tts:ping' });
}

/**
 * Envía un mensaje al content script y retorna su respuesta.
 * Versión extendida para módulos que necesitan leer la respuesta
 * (ej. reading:get-state → { isActive }). A diferencia de
 * sendMessageToContent, no descarta el valor de retorno.
 *
 * @param {object} message - Mensaje con forma { type: string, payload?: any }.
 * @returns {Promise<any|null>} Respuesta del content script, o null si no hubo receptor.
 */
export async function sendMessageToContentWithResponse(message) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    log.warn('No hay pestaña activa para enviar el mensaje');
    return null;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    log.debug('Mensaje enviado:', message.type, '— respuesta:', response);
    return response ?? null;
  } catch (error) {
    log.debug(`Sin receptor en pestaña ${tab.id}: ${error.message}`);
    return null;
  }
}
