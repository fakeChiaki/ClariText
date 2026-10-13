# Guía de implementación de módulos

Documento de referencia para implementar un módulo dentro de ClariText.
Pensado para que cada contribuidor pueda desarrollar su módulo en
paralelo sin pisar el trabajo de los demás.

---

## Asignaciones de la versión 1.x

| Contribuidor | Módulo                               | Carpeta                  | Versión |
| ------------ | ------------------------------------ | ------------------------ | ------- |
| Diego        | TTS (lectura por voz)                | `src/modules/tts/`       | v1.0    |
| Bastián      | Visual (interlineado e interletraje) | `src/modules/visual/`    | v1.1    |
| Sebastián    | Fonts (tipo de fuente)               | `src/modules/fonts/`     | v1.2    |
| Carlos       | Page Lock (bloqueador de pestaña)    | `src/modules/page-lock/` | v1.3    |

El módulo TTS ya está implementado y mergeado en `develop`. Puede
consultarse como ejemplo vivo de la arquitectura en
`src/modules/tts/`.

---

## Antes de empezar

Tras clonar el repositorio, antes de poder probar la extensión en el
navegador, hay que generar el bundle del content script. Esto se hace
una vez al arrancar:

```bash
npm run setup
```

Este comando instala las dependencias y genera `src/content/content.bundle.js`.

### Durante el desarrollo

Mientras se trabaja en un módulo, dejar corriendo en una terminal:

```bash
npm run build:watch
```

Esto hace que esbuild regenere el bundle automáticamente cada vez que
se guarda un archivo. Solo hay que recargar la extensión en
`chrome://extensions/` con el botón circular para ver los cambios.

### Por qué hace falta esto

Manifest V3 de Chrome no soporta `import`/`export` en content scripts
declarados directamente en el manifest. Por eso usamos `esbuild` para
procesar `src/content/bootstrap.js` y todos sus imports en un solo
archivo (`content.bundle.js`) que sí puede cargarse como content
script clásico.

El bundle no se versiona (está en `.gitignore`). Cada contribuidor lo
genera localmente.

---

## Reglas obligatorias

Todo módulo de ClariText debe cumplir las siguientes reglas. No son
opcionales. La revisión de código antes de mergear va a verificarlas.

1. **Idioma:** código en inglés (nombres de variables, funciones,
   clases). Comentarios y documentación en español.
2. **Tamaño:** ningún archivo debe superar las 300 líneas. ESLint
   marca esto como error automáticamente.
3. **Aislamiento:** un módulo no puede importar código de otro módulo
   directamente. Si necesita comunicarse con otro, usa el EventBus.
4. **Prefijo CSS:** todas las clases CSS inyectadas deben empezar con
   `clrtxt-`. Por ejemplo: `.clrtxt-floating-button`.
5. **Sin estado global:** cada módulo maneja su propio estado interno.
   No usar variables globales ni `window.X`.
6. **Sin código remoto:** no cargar scripts ni recursos desde URLs
   externas. La Chrome Web Store rechaza extensiones que lo hacen.
7. **Conventional Commits:** los mensajes de commit en español, con
   tipo en inglés. Ejemplo: `feat(visual): agregar control de interlineado`.

---

## Estructura interna de un módulo

Cada módulo vive en su propia carpeta dentro de `src/modules/`. La
estructura interna esperada es:

```
src/modules/<nombre>/
├── <nombre>.module.js       Entry point. Expone init/enable/disable/destroy.
├── <nombre>.engine.js       Lógica de negocio (sin UI).
├── <nombre>.ui.js           Interfaz visual (si el módulo tiene UI).
├── <nombre>.config.js       Constantes y valores por defecto del módulo.
└── <nombre>.test.js         Casos de prueba manuales documentados.
```

No todos los módulos necesitan los cinco archivos. Por ejemplo, un
módulo sin UI puede omitir `<nombre>.ui.js`. Pero todos deben tener
al menos `module.js`, `engine.js` y `config.js`.

Si la UI del módulo es compleja y supera las 300 líneas, conviene
dividirla en varios sub-archivos con el patrón `<nombre>.ui.<parte>.js`.
El módulo TTS usa este patrón: `tts.ui.button.js`, `tts.ui.player.js`,
`tts.ui.viewer.js`.

---

## Contrato de la API pública (module.js)

El archivo `<nombre>.module.js` debe exportar un objeto con la
siguiente forma exacta:

```javascript
export const <nombre>Module = {
  /**
   * Configuración inicial. Se ejecuta una sola vez al cargar la extensión.
   * No debe activar la funcionalidad todavía; solo prepararla.
   */
  async init() { ... },

  /**
   * Activa la funcionalidad. Puede llamarse múltiples veces.
   * Debe ser idempotente: llamar dos veces seguidas no debe romper nada.
   */
  enable() { ... },

  /**
   * Desactiva la funcionalidad sin destruirla. Permite reactivarla
   * con enable() sin volver a hacer init().
   */
  disable() { ... },

  /**
   * Limpieza completa. Libera recursos, listeners, timers.
   * Tras destroy(), el módulo debe ser como si nunca hubiera existido.
   */
  destroy() { ... },
};
```

El nombre del objeto exportado debe ser `<nombre>Module` en camelCase.
Ejemplos: `ttsModule`, `visualModule`, `fontsModule`, `pageLockModule`.

---

## Cómo registrar el módulo en el content script

Una vez creado el módulo, hay que registrarlo en
`src/content/bootstrap.js` para que el module-loader lo cargue:

```javascript
import { visualModule } from '../modules/visual/visual.module.js';
// ...

moduleLoader.register(MODULES.VISUAL, visualModule);
```

`MODULES.VISUAL` ya está definido en `src/shared/constants.js`. Si tu
módulo no aparece en `MODULES`, añadirlo ahí antes de registrarlo.

---

## Cómo usar los servicios del Core

Cada módulo puede usar tres servicios del Core. Aquí van los ejemplos
de uso de cada uno.

### Logger

Para registrar lo que el módulo está haciendo. Reemplaza a `console.log`.

```javascript
import { createLogger } from '../../shared/logger.js';

const log = createLogger('Visual'); // El nombre debe coincidir con tu módulo

log.info('Módulo inicializado');
log.debug('Valor de interlineado:', 1.5);
log.warn('Configuración fuera de rango, ajustando');
log.error('No se pudo aplicar el estilo', error);
```

Salida en consola:

```
[ClariText][Visual] Módulo inicializado
```

### EventBus

Para comunicarse con otros módulos sin acoplarse a ellos.

```javascript
import { eventBus } from '../../core/event-bus.js';

// Suscribirse a un evento:
const unsubscribe = eventBus.on('tts:read-started', (data) => {
  log.info('TTS empezó a leer:', data.text);
});

// Emitir un evento:
eventBus.emit('visual:theme-changed', { theme: 'dark' });

// Cancelar suscripción al destruir el módulo:
unsubscribe();
```

**Convención de nombres de eventos:** `<modulo>:<accion>` en kebab-case.

Ejemplos válidos:

```
tts:read-request
tts:read-started
tts:read-finished
visual:theme-changed
visual:line-spacing-changed
fonts:font-applied
page-lock:locked
page-lock:unlocked
```

### Storage

Para guardar configuraciones del usuario que persistan entre sesiones.

```javascript
import { storage } from '../../core/storage.js';

// Crear el namespace al cargar el módulo:
const myStorage = storage.namespace('visual'); // usa el nombre de tu módulo

// Guardar una preferencia:
await myStorage.set('lineSpacing', 1.5);
await myStorage.set('letterSpacing', 0.1);

// Leer una preferencia con valor por defecto:
const lineSpacing = await myStorage.get('lineSpacing', 1.0);

// Eliminar una clave:
await myStorage.remove('lineSpacing');

// Borrar TODAS las preferencias del módulo (útil para "restaurar defaults"):
await myStorage.clear();
```

---

## Eventos del ciclo de vida (opcional)

Los módulos pueden emitir eventos cuando cambian de estado. No son
obligatorios pero ayudan a depurar.

```javascript
import { LIFECYCLE_EVENTS, MODULES } from '../../shared/constants.js';

eventBus.emit(LIFECYCLE_EVENTS.MODULE_INITIALIZED, { module: MODULES.VISUAL });
eventBus.emit(LIFECYCLE_EVENTS.MODULE_ENABLED, { module: MODULES.VISUAL });
eventBus.emit(LIFECYCLE_EVENTS.MODULE_DISABLED, { module: MODULES.VISUAL });
```

---

## Esqueleto recomendado

Plantilla mínima para arrancar un módulo nuevo. Copiar, renombrar y
empezar a llenar.

```javascript
// src/modules/<nombre>/<nombre>.module.js

import { createLogger } from '../../shared/logger.js';
import { eventBus } from '../../core/event-bus.js';
import { storage } from '../../core/storage.js';

const log = createLogger('<Nombre>');
const myStorage = storage.namespace('<nombre>');

const unsubscribers = [];
let enabled = false;

async function init() {
  log.info('Inicializando');
  // Cargar configuraciones guardadas, preparar recursos.
}

function enable() {
  if (enabled) {
    return;
  }
  enabled = true;
  log.info('Activado');

  // Suscribirse a los eventos relevantes:
  unsubscribers.push(
    eventBus.on('algun-evento', handleSomething),
  );

  // Iniciar la funcionalidad.
}

function disable() {
  if (!enabled) {
    return;
  }
  enabled = false;
  log.info('Desactivado');

  // Cancelar suscripciones:
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers.length = 0;

  // Detener la funcionalidad.
}

function destroy() {
  disable();
  log.info('Destruido');
  // Liberar recursos pesados, remover elementos del DOM, etc.
}

function handleSomething(data) {
  log.debug('Recibido:', data);
}

export const <nombre>Module = {
  init,
  enable,
  disable,
  destroy,
};
```

---

## Flujo de trabajo con Git

Cada contribuidor trabaja en una rama feature aparte para no
interferir con los demás.

### Crear la rama

```bash
git checkout develop
git pull origin develop
git checkout -b feature/modulo-<nombre>
```

Ejemplos:

- Bastián: `feature/modulo-visual`
- Sebastián: `feature/modulo-fonts`
- Carlos: `feature/modulo-page-lock`

### Hacer commits

Cada commit debe ser atómico y seguir Conventional Commits.

```bash
git add src/modules/visual/
git commit -m "feat(visual): agregar configuración de interlineado"
```

Tipos de commit permitidos:

| Tipo     | Cuándo                                   |
| -------- | ---------------------------------------- |
| feat     | Nueva funcionalidad                      |
| fix      | Corrección de bug                        |
| docs     | Cambios solo en documentación            |
| style    | Cambios de formato (sin afectar lógica)  |
| refactor | Reorganizar código sin cambiar resultado |
| test     | Agregar o modificar tests                |
| chore    | Mantenimiento (deps, config)             |
| build    | Cambios en el sistema de build           |
| ci       | Cambios en el workflow de GitHub Actions |

### Antes de pushear

Verificar que el código pasa el linter, el formato y compila bien:

```bash
npm run lint
npm run format:check
npm run build
```

Si el formato falla, corregir antes de pushear:

```bash
npm run format
```

### Pushear y abrir Pull Request

```bash
git push -u origin feature/modulo-<nombre>
```

Luego, en GitHub, abrir un Pull Request hacia `develop`.

**Importante:** GitHub puede sugerir `main` como base branch por defecto.
Hay que cambiarlo manualmente a `develop`. NO mergear directamente a
`main`. El flujo es siempre `feature/* -> develop -> main`.

Esperar a que el CI pase verde antes de pedir el merge. El workflow
ejecuta lint, format, validación del manifest y build.

---

## Definition of Done

Un módulo se considera terminado cuando cumple todos estos puntos.

- [ ] Funciona correctamente en al menos 3 sitios distintos.
- [ ] No genera errores en la consola del navegador.
- [ ] Pasa `npm run lint` sin warnings.
- [ ] Pasa `npm run format:check`.
- [ ] Pasa `npm run build` sin errores.
- [ ] Casos de prueba manuales documentados (puede ser en
      `<nombre>.test.js` o en un documento Markdown aparte si se
      prefiere ese formato).
- [ ] Si se desactiva, los demás módulos siguen funcionando.
- [ ] Tiene entrada en `CHANGELOG.md`.
- [ ] La API pública (init/enable/disable/destroy) está completa.

---

## Restricciones técnicas a tener en cuenta

Algunas situaciones donde una extensión Chromium se comporta distinto
o no funciona. Bueno saberlas para no perder tiempo depurando lo que
no se puede arreglar.

- **No funciona en:** Google Docs (usa canvas), páginas `chrome://`,
  Chrome Web Store, nueva pestaña vacía, PDFs nativos de Chrome.
- **Shadow DOM:** sitios como YouTube, Twitter o Gmail usan Shadow DOM
  para sus interfaces, lo que bloquea la inyección de CSS desde
  content scripts. Hay que detectarlo y dar feedback al usuario.
- **chrome.storage.sync:** límite de 100 KB en total, 8 KB por item.
  Si tu módulo necesita guardar mucho, considerar `chrome.storage.local`.
- **CSP estrictas:** algunos sitios bloquean `eval()`, `innerHTML` con
  scripts y otras formas de ejecución dinámica. El proyecto los
  prohíbe por completo a través de ESLint.

---

## Dudas y comunicación

Cualquier duda sobre el contrato, la arquitectura o los servicios del
Core, preguntar antes de empezar a programar. Cambiar el contrato a
mitad del desarrollo afecta a todo el equipo.

El módulo TTS (`src/modules/tts/`) puede consultarse como referencia
viva. Implementa todos los patrones descritos en este documento.
