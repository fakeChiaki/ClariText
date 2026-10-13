# Decisiones académicas y notas internas

Archivo privado del repo. **No se publica al hacer el repo público.**

Este documento existe para registrar decisiones, datos sensibles e
información que solo es relevante mientras el proyecto está en su
fase académica privada.

---

## Información del contexto académico

- **Universidad:** Universidad de La Frontera
- **Carrera:** Ingeniería Civil Informática
- **Equipo del proyecto:**
  - Diego López (DiegoGremory) — Módulo TTS (v1.0)
  - Carlos Moris — Módulo Page Lock (v1.3)
  - Sebastián Avila — Módulo Fonts (v1.2)
  - Bastián Lagos — Módulo Visual (v1.1)

---

## Pendientes antes de hacer el repo público

Cuando llegue el momento de crear el repo público de portafolio, revisar
y aplicar todos estos puntos antes de publicar.

### Documentos PDF a regenerar sin datos institucionales

- [ ] `docs/ClariText-SRS-IEEE830.pdf` — quitar encabezado de universidad,
      profesor, asignatura, nombres completos.
- [ ] `docs/ClariText-Contrato-API.pdf` — revisar si tiene datos académicos.

### Archivos a limpiar o modificar

- [ ] `README.md` raíz — revisar con cada compañero si quiere aparecer
      con nombre completo. Si alguno prefiere solo nombre de pila o
      iniciales, ajustar antes de publicar.
- [ ] `README.md` raíz — decidir si mantener "Universidad de La Frontera"
      o quitarlo de los créditos.
- [ ] `package.json` — el campo `contributors` ya tiene solo nombres de
      pila, está bien.
- [ ] Toda la carpeta `docs/interno/` no se publica (incluye este archivo).

### Información a anonimizar

- [ ] Buscar en el historial de commits cualquier dato personal que se
      haya colado (correos, nombres completos, datos de cátedra).
- [ ] Si hay menciones a "nuestro profesor", "la cátedra", "el ramo",
      etc. en comentarios de código, limpiar.

### Pasos sugeridos para el repo público

1. Crear repo nuevo en GitHub llamado `claritext` (sin nada).
2. Clonar este repo localmente como base.
3. Aplicar todas las correcciones de la lista anterior.
4. Eliminar `docs/interno/` por completo.
5. Reescribir el `README.md` con enfoque de portafolio (qué resuelve,
   tecnologías, decisiones de arquitectura, qué aprendí).
6. Añadir capturas de pantalla del módulo TTS funcionando.
7. Hacer `git init` fresco para no arrastrar el historial completo (los
   commits viejos pueden tener datos sensibles).
8. Push al nuevo repo.

---

## Decisiones de diseño no negociables

Estas son las decisiones que tomamos al iniciar el proyecto y que no
deben cambiarse sin discusión del equipo.

- JavaScript vanilla con ES Modules. No TypeScript.
- Bundler: esbuild (introducido en Fase 2 por limitación de Manifest V3).
- Tests manuales documentados. No tests automáticos.
- Máximo 300 líneas por archivo (enforced por ESLint).
- Código en inglés, comentarios y documentación en español.
- Conventional Commits con tipo en inglés y descripción en español.
- Prefijo CSS `clrtxt-` para evitar colisiones.
- Sin código remoto, sin telemetría.

---

## Notas técnicas para uso interno

### Limitación de Manifest V3 con ES Modules

Los content scripts declarados directamente en el manifest no soportan
`import`/`export`. La solución que adoptamos fue usar `esbuild` para
generar un bundle (`content.bundle.js`) que sí puede cargarse como
content script clásico. El bundle se genera localmente y no se versiona
(está en `.gitignore`).

Implicaciones:

- Cualquier persona que clone el repo debe correr `npm run setup` antes
  de poder cargar la extensión en Chrome.
- Para desarrollo, se recomienda `npm run build:watch` que regenera
  el bundle automáticamente.

### Voces TTS detectadas

El sistema de prueba tiene 79 voces en español disponibles. Conviene
en Fase 3 (popup) agrupar las voces por país y/o filtrar las
"Multilingual" para no saturar el selector con duplicados.

---

## Estado del proyecto al cierre de Fase 2

- Fase 0 (Andamiaje): completa.
- Fase 1 (Core): completa.
- Fase 2 (Módulo TTS): completa, mergeada a develop.
- Fase 3 (Popup integrador): pendiente.
- Fase 4 (Service worker + atajos): pendiente.
- Fase 5 (Tests manuales): pendiente.
- Fase 6 (Release v1.0.0): pendiente.

Módulos de compañeros:

- Visual (Bastián Lagos): pendiente.
- Fonts (Sebastián Avila): pendiente.
- Page Lock (Carlos Moris): pendiente.

Documentación añadida por el equipo (en `docs/diagramas/`):

- C4 Nivel 1 (Contexto)
- C4 Nivel 2 (Contenedores)
- C4 Nivel 3 (Componentes — Content Script y Service Worker)
- BPMN del proceso de configuración
- Diagrama de dominio

---

## Mejoras candidatas para versiones futuras

Ideas que han surgido durante el desarrollo. No están comprometidas,
solo registradas para evaluar más adelante.

- Encolar lecturas TTS en lugar de detener la actual cuando se inicia una nueva.
- Permitir cambiar la velocidad TTS a media lectura (reanudando desde la última palabra).
- Implementar tests automáticos con Jest/Vitest cuando el proyecto madure.
- Migrar a Webpack o Vite si el bundler esbuild se queda corto.
- Añadir soporte para Shadow DOM en sitios complejos (YouTube, Gmail).
- Iconos reales de la extensión (los actuales son placeholder).
