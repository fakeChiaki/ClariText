/**
 * Registro centralizado de las secciones del popup unificado.
 *
 * Cada sección debe cumplir el contrato:
 *   {
 *     id: string,           // Identificador único del módulo.
 *     label: string,        // Nombre visible (hover tooltip).
 *     shortLabel: string,   // Nombre corto bajo el icono.
 *     icon: string,         // SVG inline del icono.
 *     render(container, footer),  // Construye la UI.
 *     onActivate(),         // Cuando la sección se vuelve activa.
 *     onDeactivate(),       // Cuando la sección deja de ser activa.
 *     destroy(),            // Limpieza completa.
 *   }
 *
 * Para añadir un módulo real: importar su popup-section.js e
 * insertarlo en el array. Los módulos no implementados se generan
 * automáticamente como placeholders.
 *
 * Orden visible en la barra: TTS → Resaltado → Interlineado →
 * Fuente → Bloqueo.
 */

import { ttsPopupSection } from '../modules/tts/popup-section.js';
import { focusLinePopupSection } from '../modules/focus-line/popup-section.js';
import { fontsPopupSection } from '../modules/fonts/popup-section.js';
import { readingPopupSection } from '../modules/reading-mode/popup-section.js';
import { timerPopupSection } from '../modules/timer/popup-section.js';
import { visualPopupSection } from '../modules/visual/popup-section.js';

/**
 * Devuelve las secciones ordenadas para la barra de navegación.
 *
 * @returns {Array} Lista ordenada de secciones.
 */
export function getSections() {
  return [
    ttsPopupSection,

    focusLinePopupSection,

    visualPopupSection,

    fontsPopupSection,

    timerPopupSection,

    readingPopupSection,
  ];
}

/** ID de la sección por defecto al abrir el popup por primera vez. */
export const DEFAULT_SECTION_ID = 'tts';
