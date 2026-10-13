import { createLogger } from '../shared/logger.js';
import { eventBus } from './event-bus.js';
import { LIFECYCLE_EVENTS, MODULE_STATES } from '../shared/constants.js';

const log = createLogger('ModuleLoader');

const modules = new Map();

function isValidModule(mod) {
  return (
    mod !== null &&
    typeof mod === 'object' &&
    typeof mod.init === 'function' &&
    typeof mod.enable === 'function' &&
    typeof mod.disable === 'function' &&
    typeof mod.destroy === 'function'
  );
}

function register(name, mod) {
  if (typeof name !== 'string' || name.length === 0) {
    log.error('register: nombre de módulo inválido', name);
    return;
  }
  if (!isValidModule(mod)) {
    log.error(
      `register: el módulo "${name}" no cumple el contrato (faltan init/enable/disable/destroy)`,
    );
    return;
  }
  if (modules.has(name)) {
    log.warn(`register: "${name}" ya estaba registrado, será reemplazado`);
  }
  modules.set(name, { instance: mod, state: MODULE_STATES.UNLOADED });
  log.debug(`Registrado: ${name}`);
}

async function loadOne(name) {
  const entry = modules.get(name);
  if (!entry) {
    log.error(`load: módulo "${name}" no está registrado`);
    return;
  }
  entry.state = MODULE_STATES.LOADING;
  try {
    await entry.instance.init();

    const shouldAutoEnable = entry.instance.autoEnable !== false;
    if (shouldAutoEnable) {
      entry.instance.enable();
      entry.state = MODULE_STATES.ACTIVE;
      log.info(`Módulo activo: ${name}`);
      eventBus.emit(LIFECYCLE_EVENTS.MODULE_INITIALIZED, { module: name });
      eventBus.emit(LIFECYCLE_EVENTS.MODULE_ENABLED, { module: name });
    } else {
      entry.state = MODULE_STATES.DISABLED;
      log.info(`Módulo cargado en estado deshabilitado: ${name}`);
      eventBus.emit(LIFECYCLE_EVENTS.MODULE_INITIALIZED, { module: name });
      eventBus.emit(LIFECYCLE_EVENTS.MODULE_DISABLED, { module: name });
    }
  } catch (error) {
    entry.state = MODULE_STATES.FAILED;
    log.error(`Módulo "${name}" falló al cargar, se desactiva`, error);
    eventBus.emit(LIFECYCLE_EVENTS.MODULE_ERROR, { module: name, error });
  }
}

/**
 * Carga todos los módulos registrados. Si alguno falla, los demás siguen.
 */
async function loadAll() {
  const names = Array.from(modules.keys());
  log.info(`Cargando ${names.length} módulo(s): ${names.join(', ')}`);
  for (const name of names) {
    await loadOne(name);
  }
}

/** Desactiva un módulo sin destruirlo (puede reactivarse con enable). */
function disable(name) {
  const entry = modules.get(name);
  if (!entry || entry.state !== MODULE_STATES.ACTIVE) {
    return;
  }
  try {
    entry.instance.disable();
    entry.state = MODULE_STATES.DISABLED;
    log.info(`Módulo desactivado: ${name}`);
    eventBus.emit(LIFECYCLE_EVENTS.MODULE_DISABLED, { module: name });
  } catch (error) {
    log.error(`Falló disable de "${name}"`, error);
  }
}

/** Reactiva un módulo previamente desactivado. */
function enable(name) {
  const entry = modules.get(name);
  if (!entry || entry.state !== MODULE_STATES.DISABLED) {
    return;
  }
  try {
    entry.instance.enable();
    entry.state = MODULE_STATES.ACTIVE;
    log.info(`Módulo reactivado: ${name}`);
    eventBus.emit(LIFECYCLE_EVENTS.MODULE_ENABLED, { module: name });
  } catch (error) {
    log.error(`Falló enable de "${name}"`, error);
  }
}

/** Destruye un módulo completamente. Tras esto, hay que registrar de nuevo. */
function destroy(name) {
  const entry = modules.get(name);
  if (!entry) {
    return;
  }
  try {
    entry.instance.destroy();
    log.info(`Módulo destruido: ${name}`);
    eventBus.emit(LIFECYCLE_EVENTS.MODULE_DESTROYED, { module: name });
  } catch (error) {
    log.error(`Falló destroy de "${name}"`, error);
  }
  modules.delete(name);
}

/** Devuelve el estado actual de un módulo. */
function getState(name) {
  const entry = modules.get(name);
  return entry ? entry.state : MODULE_STATES.UNLOADED;
}

/** Lista todos los módulos registrados con su estado. Útil para diagnóstico. */
function list() {
  const result = {};
  for (const [name, entry] of modules) {
    result[name] = entry.state;
  }
  return result;
}

export const moduleLoader = {
  register,
  loadAll,
  enable,
  disable,
  destroy,
  getState,
  list,
};
