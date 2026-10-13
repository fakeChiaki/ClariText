import { ICON_GEAR } from './icons.js';

/**
 * Crea una sección placeholder.
 *
 * @param {Object} options
 * @param {string} options.id - Identificador único del módulo.
 * @param {string} options.label - Nombre del módulo (ej. "Fuente").
 * @param {string} options.icon - SVG inline del icono del módulo.
 * @param {string} options.author - Nombre del responsable.
 * @returns {Object} Sección que cumple el contrato del popup unificado.
 */
export function createPlaceholderSection({ id, label, shortLabel, icon, author }) {
  return {
    id,
    label,
    shortLabel: shortLabel || label,
    icon,

    render(container) {
      container.innerHTML = `
        <div class="clrtxt-placeholder">
          <div class="clrtxt-placeholder-icon">${ICON_GEAR}</div>
          <h2 class="clrtxt-placeholder-title">Módulo en desarrollo</h2>
          <p class="clrtxt-placeholder-message">
            El módulo de <strong>${label}</strong> estará disponible
            próximamente.
          </p>
          <p class="clrtxt-placeholder-author">Responsable: ${author}</p>
        </div>
      `;
    },

    onActivate() {
      // Sin lógica activa para los placeholders.
    },

    onDeactivate() {
      // Sin lógica activa para los placeholders.
    },

    destroy() {
      // Sin recursos que liberar.
    },
  };
}
