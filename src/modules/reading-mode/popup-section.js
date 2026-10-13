import { createLogger } from '../../shared/logger.js';
import {
  sendMessageToContent,
  sendMessageToContentWithResponse,
} from '../../popup/messaging-helpers.js';
import { ICON_OPEN_BOOK } from '../../popup/icons.js';
import { truncateUrl } from './reading.ui.utils.js';

const log = createLogger('ReadingPopupSection');

/** Tipos de mensajes intercambiados con el content script. */
const MSG = {
  TOGGLE: 'reading:toggle',
  GET_STATE: 'reading:get-state',
  GET_PREVIEW: 'reading:get-preview',
};

/** Referencias a nodos del DOM; se rellenan en cacheDom(). */
const dom = {
  urlValue: null,
  previewDomain: null,
  previewTitle: null,
  previewText: null,
  activateBtn: null,
  deactivateBtn: null,
};

/** Estado en memoria de la sección. */
const state = {
  isActive: false,
  tabUrl: '',
};

// ─── render ───────────────────────────────────────────────────────────────────

/**
 * Construye la UI de la sección dentro del contenedor recibido del orquestador.
 *
 * @param {HTMLElement} container
 * @param {HTMLElement} footer
 */
async function render(container, footer) {
  container.innerHTML = `
    <div class="clrtxt-reading-section">

      <!-- Recuadro de URL activa -->
      <div class="clrtxt-reading-url-box">
        <span class="clrtxt-reading-url-label">Página:</span>
        <span id="clrtxt-reading-url-value" class="clrtxt-reading-url-value">(cargando…)</span>
      </div>

      <!-- Vista previa -->
      <p class="clrtxt-reading-preview-label">Vista previa</p>
      <div class="clrtxt-reading-preview" aria-hidden="true">
        <div class="clrtxt-reading-preview-topbar">
          <span>📖 Modo lectura</span>
        </div>
        <div class="clrtxt-reading-preview-body">
          <span id="clrtxt-reading-preview-domain" class="clrtxt-reading-preview-domain">
            ejemplo.com
          </span>
          <p id="clrtxt-reading-preview-title" class="clrtxt-reading-preview-title">
            Título de la página
          </p>
          <p id="clrtxt-reading-preview-text" class="clrtxt-reading-preview-text"></p>
          <div class="clrtxt-reading-preview-line" style="width:100%"></div>
          <div class="clrtxt-reading-preview-line" style="width:88%"></div>
          <div class="clrtxt-reading-preview-line" style="width:72%"></div>
        </div>
      </div>

      <!-- Controles -->
      <div class="clrtxt-reading-controls">
        <button id="clrtxt-reading-deactivate-btn" type="button"
                class="clrtxt-button-secondary" disabled>
          Desactivar
        </button>
        <button id="clrtxt-reading-activate-btn" type="button"
                class="clrtxt-button-primary">
          Activar
        </button>
      </div>

    </div>
  `;

  // Footer: descripción informativa del módulo.
  footer.innerHTML = `
    <p class="clrtxt-info-pause">
      Extrae el contenido principal y lo presenta sobre un fondo limpio.
      Links y botones quedan en una barra lateral desplegable.
    </p>
  `;

  cacheDom(container);
  await resolveTabContext();
  await restoreState();
  await loadPreview();

  // El popup re-renderiza la sección entera en cada activación, así que los
  // listeners se re-enganchan a los elementos nuevos en cada render.
  attachListeners();

  renderState();
}

// ─── Inicialización ───────────────────────────────────────────────────────────

/** Cachea referencias DOM usando IDs con prefijo del módulo. */
function cacheDom(container) {
  dom.urlValue = container.querySelector('#clrtxt-reading-url-value');
  dom.previewDomain = container.querySelector('#clrtxt-reading-preview-domain');
  dom.previewTitle = container.querySelector('#clrtxt-reading-preview-title');
  dom.previewText = container.querySelector('#clrtxt-reading-preview-text');
  dom.activateBtn = container.querySelector('#clrtxt-reading-activate-btn');
  dom.deactivateBtn = container.querySelector('#clrtxt-reading-deactivate-btn');
}

/** Resuelve la URL de la pestaña activa y actualiza los elementos de previsualización. */
async function resolveTabContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.tabUrl = tab?.url ?? '';
  } catch (err) {
    log.error('Error al consultar chrome.tabs:', err.message);
    state.tabUrl = '';
  }

  if (dom.urlValue) {
    dom.urlValue.textContent = truncateUrl(state.tabUrl) || '(sin URL)';
    dom.urlValue.title = state.tabUrl;
  }

  if (dom.previewDomain) {
    dom.previewDomain.textContent = extractDomain(state.tabUrl) || 'ejemplo.com';
  }
}

/** Consulta el estado actual del modo lectura en el content script. */
async function restoreState() {
  const response = await sendMessageToContentWithResponse({ type: MSG.GET_STATE });
  state.isActive = response?.isActive === true;
  log.debug('Estado restaurado — isActive:', state.isActive);
}

/** Carga el título y primer párrafo reales de la página para la vista previa. */
async function loadPreview() {
  const response = await sendMessageToContentWithResponse({ type: MSG.GET_PREVIEW });
  if (!response) {
    return;
  }

  if (dom.previewTitle) {
    dom.previewTitle.textContent = response.title || 'Título de la página';
  }

  if (dom.previewText && response.firstText) {
    dom.previewText.textContent = response.firstText;
    dom.previewText.style.display = 'block';
  }
}

/** Conecta los listeners de los botones (se llama una sola vez por ciclo de vida). */
function attachListeners() {
  dom.activateBtn?.addEventListener('click', () => handleToggle(true));
  dom.deactivateBtn?.addEventListener('click', () => handleToggle(false));
}

// ─── Interacción ──────────────────────────────────────────────────────────────

/** Envía el mensaje de toggle al content script y actualiza la UI. */
async function handleToggle(activate) {
  const response = await sendMessageToContent({
    type: MSG.TOGGLE,
    payload: { activate },
  });

  if (response !== null) {
    state.isActive = response?.isActive ?? activate;
  }

  renderState();
}

/** Sincroniza el estado de los botones con state.isActive. */
function renderState() {
  if (!dom.activateBtn || !dom.deactivateBtn) {
    return;
  }
  dom.activateBtn.disabled = state.isActive;
  dom.deactivateBtn.disabled = !state.isActive;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Extrae el dominio de una URL.
 *
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// ─── Contrato del popup unificado ─────────────────────────────────────────────

export const readingPopupSection = {
  id: 'reading-mode',
  label: 'Modo lectura',
  shortLabel: 'Lectura',
  icon: ICON_OPEN_BOOK,

  render,

  onActivate() {
    log.debug('Sección Modo lectura activada');
  },

  onDeactivate() {
    log.debug('Sección Modo lectura desactivada');
  },

  destroy() {
    Object.keys(dom).forEach((k) => (dom[k] = null));
    log.debug('Sección Modo lectura destruida');
  },
};
