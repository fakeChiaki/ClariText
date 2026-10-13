import { STYLE_TAG_ID, TEXT_SELECTORS, LINE_SPACING, LETTER_SPACING } from './visual.config.js';

// ─── Estado interno ────────────────────────────────────────────────────────

let currentLineSpacing = LINE_SPACING.DEFAULT;
let currentLetterSpacing = LETTER_SPACING.DEFAULT;

// ─── Helpers privados ──────────────────────────────────────────────────────

/**
 * Obtiene (o crea) el elemento <style> donde se escriben los estilos
 * del módulo. Reutilizar el mismo tag evita acumular nodos en el DOM.
 * @returns {HTMLStyleElement}
 */
function getOrCreateStyleTag() {
  let tag = document.getElementById(STYLE_TAG_ID);

  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_TAG_ID;
    // Insertamos al final de <head> para mayor especificidad que los
    // estilos inline del sitio, pero sin necesitar !important siempre.
    document.head.appendChild(tag);
  }

  return tag;
}

/**
 * Construye el bloque CSS con los valores actuales y lo escribe en el tag.
 * Usamos !important para sobrescribir estilos inline del sitio
 * (comportamiento esperado según el Contrato de API ID-01 e ID-02).
 */
function applyStyles() {
  const tag = getOrCreateStyleTag();

  tag.textContent = `
    ${TEXT_SELECTORS} {
      line-height: ${currentLineSpacing} !important;
      letter-spacing: ${currentLetterSpacing}em !important;
    }
  `;
}

/**
 * Fuerza que un valor numérico quede dentro del rango [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Redondea a 2 decimales para evitar artefactos de punto flotante
 * en los valores de CSS (0.30000000004 → 0.30).
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

// ─── API pública del engine ────────────────────────────────────────────────

/**
 * Inicializa el estado del engine con valores recuperados del storage.
 * @param {number} lineSpacing   - Valor de interlineado almacenado.
 * @param {number} letterSpacing - Valor de interletraje almacenado.
 */
export function initEngine(lineSpacing, letterSpacing) {
  currentLineSpacing = clamp(lineSpacing, LINE_SPACING.MIN, LINE_SPACING.MAX);
  currentLetterSpacing = clamp(letterSpacing, LETTER_SPACING.MIN, LETTER_SPACING.MAX);
}

/**
 * Aplica los estilos actuales al DOM de la página.
 * Idempotente: llamar dos veces seguidas no genera efectos secundarios.
 */
export function applyCurrentStyles() {
  applyStyles();
}

/**
 * Actualiza el interlineado y reescribe los estilos en la página.
 * @param {number} value - Nuevo valor (se normaliza al rango permitido).
 * @returns {number}     - Valor efectivamente aplicado.
 */
export function setLineSpacing(value) {
  currentLineSpacing = round2(clamp(value, LINE_SPACING.MIN, LINE_SPACING.MAX));
  applyStyles();
  return currentLineSpacing;
}

/**
 * Actualiza el interletraje y reescribe los estilos en la página.
 * @param {number} value - Nuevo valor en em (se normaliza al rango permitido).
 * @returns {number}     - Valor efectivamente aplicado.
 */
export function setLetterSpacing(value) {
  currentLetterSpacing = round2(clamp(value, LETTER_SPACING.MIN, LETTER_SPACING.MAX));
  applyStyles();
  return currentLetterSpacing;
}

/**
 * Devuelve el estado actual del engine.
 * @returns {{ lineSpacing: number, letterSpacing: number }}
 */
export function getState() {
  return {
    lineSpacing: currentLineSpacing,
    letterSpacing: currentLetterSpacing,
  };
}

/**
 * Restaura los valores a los defaults de fábrica y actualiza la página.
 */
export function resetToDefaults() {
  currentLineSpacing = LINE_SPACING.DEFAULT;
  currentLetterSpacing = LETTER_SPACING.DEFAULT;
  applyStyles();
}

/**
 * Elimina la hoja de estilos del DOM, dejando la página como estaba.
 * Se llama desde module.destroy().
 */
export function removeStyles() {
  const tag = document.getElementById(STYLE_TAG_ID);
  if (tag) {
    tag.remove();
  }
}
