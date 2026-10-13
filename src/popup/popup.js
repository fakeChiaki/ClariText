import { storage } from '../core/storage.js';
import { createLogger } from '../shared/logger.js';
import { getSections, DEFAULT_SECTION_ID } from './sections-registry.js';

const log = createLogger('Popup');
const STORAGE_KEY_ACTIVE_SECTION = 'activeSectionId';

// Storage con namespace propio del popup para no colisionar con módulos.
const popupStorage = storage.namespace('popup');

const state = {
  sections: [],
  activeSection: null,
  navButtons: new Map(),
};

const dom = {
  nav: null,
  content: null,
  footer: null,
};

/**
 * Punto de entrada del popup. Se ejecuta al cargar el HTML.
 */
async function init() {
  log.info('Iniciando popup unificado');

  cacheDom();
  state.sections = getSections();

  renderNav();

  const initialId = await getInitialSectionId();
  await activateSection(initialId);

  log.info(`Popup listo. Sección inicial: ${initialId}`);
}

/** Cachea referencias DOM. */
function cacheDom() {
  dom.nav = document.querySelector('.clrtxt-popup-nav');
  dom.content = document.getElementById('clrtxt-section-container');
  dom.footer = document.getElementById('clrtxt-section-footer');
}

/**
 * Renderiza los botones de navegación. Cada botón tiene su icono SVG
 * y un tooltip con el label.
 */
function renderNav() {
  state.sections.forEach((section) => {
    const btn = document.createElement('button');
    btn.className = 'clrtxt-popup-nav-btn';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('data-section-id', section.id);
    btn.setAttribute('aria-label', section.label);
    btn.innerHTML = `
      <span class="clrtxt-popup-nav-icon">${section.icon}</span>
      <span class="clrtxt-popup-nav-label">${section.shortLabel || section.label}</span>
    `;

    btn.addEventListener('click', () => {
      activateSection(section.id);
    });

    dom.nav.appendChild(btn);
    state.navButtons.set(section.id, btn);
  });
}

/**
 * Activa una sección por su ID. Desactiva la anterior si existe.
 *
 * @param {string} sectionId - ID de la sección a activar.
 */
async function activateSection(sectionId) {
  const section = state.sections.find((s) => s.id === sectionId);
  if (!section) {
    log.warn(`Sección no encontrada: ${sectionId}, cayendo a default`);
    return activateSection(DEFAULT_SECTION_ID);
  }

  // Desactivar la sección anterior si existe.
  if (state.activeSection) {
    try {
      state.activeSection.onDeactivate();
    } catch (err) {
      log.error('Error en onDeactivate:', err);
    }
  }

  // Marcar visualmente el botón activo.
  state.navButtons.forEach((btn, id) => {
    btn.classList.toggle('is-active', id === sectionId);
    btn.setAttribute('aria-selected', id === sectionId ? 'true' : 'false');
  });

  // Limpiar contenedor y footer antes de renderizar. Reseteamos también su
  // display: una sección puede haberlo ocultado (p.ej. TTS oculta el footer
  // cuando la lectura por voz está desactivada) y ese estado no debe filtrarse
  // a la siguiente sección, ya que los contenedores son compartidos.
  dom.content.innerHTML = '';
  dom.content.style.display = '';
  dom.footer.innerHTML = '';
  dom.footer.style.display = '';

  // Renderizar la nueva sección y activarla.
  try {
    await section.render(dom.content, dom.footer);
    section.onActivate();
  } catch (err) {
    log.error('Error renderizando sección:', err);
  }

  state.activeSection = section;

  // Persistir la sección activa para la próxima apertura.
  try {
    await popupStorage.set(STORAGE_KEY_ACTIVE_SECTION, sectionId);
  } catch (err) {
    log.warn('No se pudo guardar la sección activa:', err);
  }
}

/**
 * Determina qué sección debe abrirse al iniciar el popup.
 * Si hay una sección guardada y sigue existiendo, la usa.
 * Si no, cae a la sección default.
 *
 * @returns {Promise<string>} ID de la sección inicial.
 */
async function getInitialSectionId() {
  try {
    const saved = await popupStorage.get(STORAGE_KEY_ACTIVE_SECTION);
    if (saved && state.sections.some((s) => s.id === saved)) {
      return saved;
    }
  } catch (err) {
    log.warn('No se pudo leer sección guardada, usando default');
  }
  return DEFAULT_SECTION_ID;
}

document.addEventListener('DOMContentLoaded', init);
