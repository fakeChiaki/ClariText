# Documentación de ClariText

Este directorio contiene la documentación técnica del proyecto ClariText, una
extensión Chromium con lectura por voz para personas con dislexia y TDAH.

---

## Documentos disponibles

### Especificación de Requisitos del Software (SRS)

- **Archivo:** [`ClariText-SRS-IEEE830.pdf`](./ClariText-SRS-IEEE830.pdf)
- **Estándar:** IEEE 830 — Especificación de Requisitos del Software
- **Contenido:** Define todos los requisitos funcionales y no funcionales de
  ClariText, las restricciones de diseño, las interfaces externas y los
  criterios de aceptación.

### Contrato de API

- **Archivo:** [`ClariText-Contrato-API.pdf`](./ClariText-Contrato-API.pdf)
- **Contenido:** Tabla detallada de las funcionalidades expuestas por cada
  módulo de la extensión, sus parámetros, eventos publicados y consumidos
  vía EventBus, y las dependencias entre módulos.

### Guía de implementación de módulos

- **Archivo:** [`guia-modulos.md`](./guia-modulos.md)
- **Contenido:** Manual técnico para el equipo. Convenciones, contrato de la
  API pública, uso de los servicios del Core (logger, EventBus, storage),
  flujo de trabajo con Git y Definition of Done. Lectura obligatoria antes
  de implementar un módulo nuevo.

---

## Diagramas

Los diagramas del proyecto se encuentran en la carpeta [`diagramas/`](./diagramas/).

### Modelo C4

Modela la arquitectura del sistema en tres niveles de detalle, siguiendo
la notación C4 de Simon Brown.

- **C4 Nivel 1 (Contexto):** [`diagramas/C4_Nivel_1_Contexto.jpg`](./diagramas/C4_Nivel_1_Contexto.jpg).
  Sistema y actores externos.
- **C4 Nivel 2 (Contenedores):** [`diagramas/C4_Nivel_2_Contenedores.jpg`](./diagramas/C4_Nivel_2_Contenedores.jpg).
  Contenedores principales del sistema y sus interacciones.
- **C4 Nivel 3 (Componentes — Content Script):** [`diagramas/C4_Nivel_3_Diagrama_de_Componente_Content_Script.png`](./diagramas/C4_Nivel_3_Diagrama_de_Componente_Content_Script.png).
  Detalle interno del content script.
- **C4 Nivel 3 (Componentes — Service Worker):** [`diagramas/C4_Nivel_3_Diagrama_de_Componente_Service_Worker.png`](./diagramas/C4_Nivel_3_Diagrama_de_Componente_Service_Worker.png).
  Detalle interno del service worker.

### BPMN 2.0 — Proceso de configuración

- **Archivo:** [`diagramas/ClariText-BPMN.png`](./diagramas/ClariText-BPMN.png)
- **Notación:** BPMN 2.0 (Business Process Model and Notation)
- **Contenido:** Modela el flujo completo del proceso de configuración de la
  extensión por parte del usuario, desde la activación inicial hasta la
  persistencia de preferencias.

### Diagrama de dominio

- **Archivo:** [`diagramas/Diagrama de dominio.png`](./diagramas/Diagrama%20de%20dominio.png)
- **Contenido:** Entidades del dominio del problema y sus relaciones.

---

## Convenciones

- **Idioma:** toda la documentación está redactada en español.
- **Formatos:** los documentos formales (SRS, Contrato de API) se mantienen
  en PDF para preservar el formato académico. Los diagramas se publican como
  imágenes (PNG o JPG). Las guías técnicas operativas se mantienen en
  Markdown para facilitar su edición y consulta directa desde el repositorio.
- **Nombrado:** los archivos siguen el patrón
  `ClariText-<Tipo>-<Identificador>.<ext>`, con siglas técnicas oficiales en
  mayúsculas (IEEE830, API, BPMN, etc.). Los diagramas C4 siguen el patrón
  `C4_Nivel_<N>_<Descripcion>.<ext>`.

---
