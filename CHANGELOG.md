# Registro de cambios

Todos los cambios notables del proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y el proyecto utiliza [Versionado Semántico](https://semver.org/spec/v2.0.0.html).

## [Sin liberar]

### Por hacer

- Opción para encolar nuevas lecturas en lugar de detener la actual (mejora del módulo TTS).
- Mejoras y nuevas funcionalidades a definir en próximas iteraciones.

## [0.2.0] - 2026-06-26

### Añadido

#### Módulos funcionales

- **TTS:** módulo completo de lectura por voz con selector de voz,
  control de velocidad y tono, resaltado opcional del texto leído,
  reproductor flotante en página y toggle ON/OFF en el popup.
- **Visual:** módulo de personalización de interlineado e interletraje.
- **Fonts:** módulo de cambio de fuente con soporte para OpenDyslexic
  y Atkinson Hyperlegible. Aplica a todas las pestañas activas.
- **Focus Line:** módulo de resaltado de la línea actual con overlay
  configurable (opacidad, color, altura).
- **Reading Mode:** módulo de modo solo lectura que extrae el contenido
  principal de la página.
- **Timer:** módulo de bloqueo temporal de pestaña (estilo Pomodoro)
  con duración configurable de 1 a 120 minutos.

#### Arquitectura

- **Popup unificado:** esqueleto con barra de iconos. Cada módulo se
  integra siguiendo el contrato `popup-section.js`. Reemplaza el
  popup mono-módulo anterior.
- **Service worker:** introducido para soportar funcionalidad cross-popup
  (necesario para Timer).
- **Storage optimizado:** método `setBatch()` que agrupa múltiples
  escrituras en una sola operación de `chrome.storage.sync.set()`.
  Early-return en `set` y `setBatch` para evitar escrituras redundantes.

#### Infraestructura

- Bundle generado por esbuild para soportar ES Modules en content
  scripts de Manifest V3.
- GitHub Actions con CI (lint, format, build, validate manifest).
- Git Flow con ramas main/develop y PRs obligatorios.

### Cambiado

- README.md y CHANGELOG.md actualizados para reflejar el estado real
  del proyecto.
- Estructura del README simplificada: solo se muestran los módulos
  disponibles, sin referencias a funcionalidades futuras.
- Roles del equipo actualizados con módulos efectivamente implementados.

### Corregido

- Bug del `speechSynthesis.cancel()` que dejaba el motor de voz
  atascado en Chrome.
- Storage del popup que llamaba a `storage.set()` en vez de
  `storage.namespace(name).set()`.
- Aplicación de fuentes solo a la pestaña activa (ahora se aplica
  a todas las pestañas).
- Toggle del Timer en el popup que no respondía correctamente.
- Listeners del popup que no se re-adjuntaban al revisitar secciones.
- Indentación de archivos del módulo Timer no compatibles con Prettier.

### Eliminado

- Placeholder del módulo Colors del popup.
- Código no utilizado del módulo Reading Mode (variable `readingStorage`
  e imports sin uso).

## [0.1.0] - 2026-05-13

### Añadido

- Estructura inicial del proyecto con arquitectura modular
- Configuración base de Manifest V3
- Carpetas preparadas para los módulos: tts, visual, fonts, focus-line, reading-mode, timer
- Placeholders para utilidades core: event-bus, messaging, module-loader, storage
- Placeholders para utilidades compartidas: constants, logger, selectors, utils
- Puntos de entrada: background service worker, content scripts, popup
- Configuración de ESLint y Prettier
- Documentación inicial: README, LICENSE, CHANGELOG
- Configuración de Git Flow con ramas main y develop

[Sin liberar]: https://github.com/DiegoGremory/ClariText/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/DiegoGremory/ClariText/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/DiegoGremory/ClariText/releases/tag/v0.1.0
