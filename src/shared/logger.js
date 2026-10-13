/**
 * Logger centralizado de ClariText.
 *
 * Expone createLogger(moduleName) que devuelve un objeto con los métodos
 * debug, info, warn y error. Cada mensaje se imprime con el prefijo
 * [ClariText][<modulo>] usando el método de console correspondiente.
 *
 * Para activar logs detallados durante desarrollo, cambiar CURRENT_LEVEL
 * a 'debug'. Recordar volver a 'info' antes de publicar.
 *
 * @example
 *   const log = createLogger('TTS');
 *   log.info('Módulo inicializado');
 *   // Salida: [ClariText][TTS] Módulo inicializado
 */

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL = 'info';
const PREFIX = '[ClariText]';

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[CURRENT_LEVEL];
}

function output(level, moduleName, args) {
  if (!shouldLog(level)) {
    return;
  }
  const tag = `${PREFIX}[${moduleName}]`;
  // Se usa el método de console correspondiente para que las DevTools
  // categoricen los mensajes (Verbose / Info / Warning / Error).
  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(tag, ...args);
      break;
    case 'info':
      console.info(tag, ...args);
      break;
    case 'warn':
      console.warn(tag, ...args);
      break;
    case 'error':
      console.error(tag, ...args);
      break;
  }
}

/**
 * Crea un logger asociado a un módulo concreto.
 *
 * @param {string} moduleName - Identificador del módulo (ej: 'TTS', 'Storage').
 * @returns {object} Logger con los métodos debug, info, warn y error.
 */
export function createLogger(moduleName) {
  if (typeof moduleName !== 'string' || moduleName.length === 0) {
    moduleName = 'Unknown';
    console.warn(`${PREFIX}[Logger] createLogger fue llamado sin nombre de módulo`);
  }

  return {
    debug(...args) {
      output('debug', moduleName, args);
    },
    info(...args) {
      output('info', moduleName, args);
    },
    warn(...args) {
      output('warn', moduleName, args);
    },
    error(...args) {
      output('error', moduleName, args);
    },
  };
}
