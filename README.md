# ClariText

Extensión de navegador Chromium diseñada para personas con dislexia y TDAH.
Ofrece herramientas de accesibilidad visual y auditiva con un enfoque modular,
configurable por sitio web y completamente local (sin envío de datos a
servidores externos).

[![Versión](https://img.shields.io/badge/versión-0.2.0-blue)]()
[![Manifest](https://img.shields.io/badge/manifest-v3-green)]()
[![Licencia](https://img.shields.io/badge/licencia-Apache%202.0-yellow)]()
[![Estado](https://img.shields.io/badge/estado-alpha%20funcional-yellow)]()

---

## Estado del proyecto

ClariText se encuentra en fase **alpha funcional**. Los módulos listados
a continuación están operativos y han sido probados en navegadores
Chromium. El proyecto sigue en desarrollo activo.

---

## Módulos disponibles

| Módulo                      | Descripción                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Lectura por voz (TTS)       | Lee texto seleccionado con voz sintetizada. Selector de voz, ajustes de velocidad y tono. Toggle para activar/desactivar el módulo. |
| Resaltado de línea          | Overlay configurable que destaca la línea actual de lectura. Ajustes de opacidad, color y altura.                                   |
| Personalización visual      | Ajustes de interlineado e interletraje para mejorar la lectura.                                                                     |
| Cambio de fuente            | Aplica fuentes accesibles como OpenDyslexic y Atkinson Hyperlegible a las páginas web.                                              |
| Modo solo lectura           | Extrae el contenido principal de la página y lo presenta en un formato limpio.                                                      |
| Bloqueo temporal de pestaña | Bloquea la pestaña por un tiempo configurable (1 a 120 minutos) para evitar distracciones.                                          |

---

## Arquitectura

ClariText utiliza una arquitectura modular donde cada funcionalidad es un
módulo independiente, autocontenido, que se comunica con otros mediante un
sistema pub/sub (EventBus).

### Principios de diseño

- **Aislamiento de fallos:** si un módulo falla, los demás siguen funcionando.
- **Comunicación desacoplada:** los módulos no se importan entre sí.
- **Sin telemetría:** no se envía ningún dato a servidores externos.
- **Procesamiento local:** todo se ejecuta en el navegador del usuario.
- **Popup unificado:** cada módulo se integra siguiendo un contrato
  estándar (`popup-section.js`) que permite añadir o quitar módulos
  sin afectar al popup base.

### Estructura del proyecto

```
claritext/
├── src/                        Código fuente de la extensión
│   ├── manifest.json           Configuración Manifest V3
│   ├── core/                   Motor central (event-bus, storage, messaging, module-loader)
│   ├── modules/                Funcionalidades modulares
│   │   ├── tts/                Lectura por voz
│   │   ├── focus-line/         Resaltado de línea
│   │   ├── visual/             Interlineado e interletraje
│   │   ├── fonts/              Cambio de fuente
│   │   ├── reading-mode/       Modo solo lectura
│   │   └── timer/              Bloqueo temporal de pestaña
│   ├── shared/                 Utilidades compartidas
│   ├── background/             Service worker (coordinación cross-popup del Timer)
│   ├── content/                Scripts inyectados en páginas
│   └── popup/                  Popup unificado de configuración
├── docs/                       Documentación técnica
└── tests/                      Pruebas
```

---

## Instalación y arranque

### Requisitos previos

- Node.js 18 o superior.
- Navegador Chromium (Chrome, Edge, Brave, Opera).

### Primer arranque

Tras clonar el repositorio, antes de cargar la extensión en el navegador,
ejecutar el comando de setup:

```bash
git clone https://github.com/DiegoGremory/claritext.git
cd claritext
npm run setup
```

`npm run setup` instala las dependencias y genera el bundle del content script
(`src/content/content.bundle.js`). **Sin este paso la extensión no carga.**

### Cargar la extensión en el navegador

1. Abrir `chrome://extensions/` en Chrome o Edge.
2. Activar el **"Modo de desarrollador"** (esquina superior derecha).
3. Click en **"Cargar descomprimida"** y seleccionar la carpeta `src/` del
   proyecto.

---

## Flujo de desarrollo

Cuando se trabaja en un módulo y se quieren probar los cambios en el
navegador, hay dos opciones.

### Opción 1: regenerar el bundle manualmente

```bash
npm run build
```

Después de cada cambio, regenerar el bundle y recargar la extensión en
`chrome://extensions/` con el botón circular de recarga.

### Opción 2: modo watch (recomendado)

```bash
npm run build:watch
```

Esbuild queda escuchando cambios en los archivos fuente y regenera el bundle
automáticamente cada vez que se guarda. Solo hace falta recargar la extensión
en el navegador para ver los cambios. Detener el watch con `Ctrl+C`.

---

## Por qué el proyecto necesita un bundle

Manifest V3 de Chrome no soporta módulos ES (`import`/`export`) en content
scripts declarados directamente en el manifest. Para mantener la arquitectura
modular del proyecto, se usa `esbuild` para procesar `bootstrap.js` y todos
sus imports en un único archivo (`content.bundle.js`) que sí puede cargarse
como content script clásico.

El bundle se genera localmente y no se versiona (está en `.gitignore`). Cada
contribuidor lo regenera en su máquina con `npm run build` o `npm run build:watch`.

---

## Comandos disponibles

| Comando                     | Descripción                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `npm run setup`             | Instalación inicial: instala dependencias y genera el bundle    |
| `npm run build`             | Genera el bundle de producción una vez                          |
| `npm run build:watch`       | Genera el bundle automáticamente al guardar archivos            |
| `npm run lint`              | Analiza el código con ESLint                                    |
| `npm run lint:fix`          | Corrige los errores de ESLint automáticamente cuando es posible |
| `npm run format`            | Formatea el código con Prettier                                 |
| `npm run format:check`      | Verifica el formato sin modificar archivos                      |
| `npm run validate:manifest` | Valida la sintaxis del `manifest.json`                          |
| `npm run check`             | Ejecuta todas las validaciones del CI                           |

---

## Tecnologías

- **JavaScript vanilla** con ES Modules.
- **Manifest V3**, estándar de Chromium.
- **esbuild** como bundler del content script.
- **Web Speech API**, síntesis de voz nativa del navegador.
- **chrome.storage.sync** para persistencia de preferencias del usuario.
- **Service Worker** (Manifest V3) para coordinación cross-popup del Timer.
- **ESLint + Prettier** para mantener la calidad del código.
- **GitHub Actions** para integración continua (lint, format, build, validate).

---

## Flujo de trabajo con Git

El proyecto utiliza Git Flow con las siguientes ramas:

- `main`: versiones estables liberadas.
- `develop`: rama de desarrollo activo.
- `feature/*`: nuevas funcionalidades (parten de `develop`).
- `release/*`: preparación de versiones.
- `hotfix/*`: correcciones urgentes.

Los Pull Requests siempre se abren contra `develop`, **nunca contra `main`
directamente**. GitHub puede sugerir `main` por defecto al crear un PR; hay
que cambiar el base branch manualmente a `develop`.

### Convenciones de commits

El proyecto sigue el estándar de [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(tts): agregar control de velocidad
fix(visual): corregir conflicto CSS con sitios oscuros
docs: actualizar guía de instalación
refactor(core): simplificar lógica del event bus
```

Tipos en inglés, descripciones en español.

---

## Documentación

- [Especificación SRS (IEEE 830)](docs/ClariText-SRS-IEEE830.pdf): requisitos
  funcionales y no funcionales del sistema.
- [Contrato de API](docs/ClariText-Contrato-API.pdf): tabla detallada de las
  funcionalidades expuestas por cada módulo, sus parámetros, eventos
  publicados y consumidos.
- [Guía de implementación de módulos](docs/guia-modulos.md): manual técnico
  para el equipo. Lectura obligatoria antes de implementar un módulo nuevo.
- [Diagramas](docs/diagramas/): C4 (niveles 1, 2 y 3), BPMN del proceso de
  configuración, diagrama de dominio.

---

## Equipo

- **Diego López** Líder del proyecto. Módulo TTS y arquitectura del popup unificado.
- **Carlos Moris** Módulos Focus Line y Timer.
- **Sebastián Avila** Módulo Fonts.
- **Bastián Lagos** Módulo Visual.

---

## Licencia

Apache License 2.0. Ver el archivo [`LICENSE`](./LICENSE) para los términos
completos y [`NOTICE`](./NOTICE) para las atribuciones requeridas.
