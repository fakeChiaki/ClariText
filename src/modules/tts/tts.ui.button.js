import { createLogger } from '../../shared/logger.js';
import { CSS_PREFIX } from '../../shared/constants.js';

const log = createLogger('TTS-Button');

// Separación vertical entre el botón y el borde de la selección.
const VERTICAL_OFFSET = 48;

// Icono SVG de altavoz (20x20, hereda el color blanco del texto).
const SPEAKER_ICON = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
  </svg>
`;

/**
 * Crea el componente del botón flotante.
 *
 * @param {Function} onReadClick - Callback que recibe el texto seleccionado.
 * @returns {object} Componente con enable, disable y hide.
 */
export function createReadButton(onReadClick) {
  let buttonEl = null;

  function buildButton() {
    const btn = document.createElement('button');
    btn.className = `${CSS_PREFIX}-read-button`;
    btn.setAttribute('aria-label', 'Leer el texto seleccionado');
    btn.innerHTML = `${SPEAKER_ICON}<span>Leer</span>`;
    applyButtonStyles(btn);

    // Evitar que el mousedown sobre el botón borre la selección de texto.
    btn.addEventListener('mousedown', (event) => event.preventDefault());

    btn.addEventListener('click', () => {
      const text = getSelectedText();
      hide();
      if (text) {
        log.debug('Click en Leer, texto seleccionado');
        onReadClick(text);
      }
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#357ABD';
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#4A90E2';
      btn.style.transform = 'scale(1)';
    });

    return btn;
  }

  function applyButtonStyles(btn) {
    Object.assign(btn.style, {
      position: 'absolute',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      borderRadius: '24px',
      background: '#4A90E2',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      transition: 'background 0.15s ease, transform 0.15s ease',
      zIndex: 'var(--clrtxt-z-floating, 2147483000)',
    });
  }

  /** Devuelve el texto seleccionado actual, o cadena vacía si no hay. */
  function getSelectedText() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  }

  /**
   * Posiciona el botón sobre la selección. Si no cabe arriba, lo coloca
   * debajo. Usa coordenadas de documento (scroll incluido) para anclarlo.
   */
  function positionButton() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Centrado horizontal respecto a la selección.
    const centerX = rect.left + rect.width / 2 + scrollX;

    // Por defecto, 48px por encima del borde superior de la selección.
    let top = rect.top + scrollY - VERTICAL_OFFSET;
    // Si no cabe arriba (quedaría sobre el borde de la página), va debajo.
    if (rect.top - VERTICAL_OFFSET < 0) {
      top = rect.bottom + scrollY + 8;
    }

    buttonEl.style.left = `${centerX}px`;
    buttonEl.style.top = `${top}px`;
    // translateX(-50%) para centrar el botón respecto a su propio ancho.
    buttonEl.style.transform = 'translateX(-50%)';
  }

  function show() {
    if (!buttonEl) {
      buttonEl = buildButton();
      document.body.appendChild(buttonEl);
    }
    buttonEl.style.display = 'inline-flex';
    positionButton();
  }

  /** Oculta el botón sin destruirlo. */
  function hide() {
    if (buttonEl) {
      buttonEl.style.display = 'none';
    }
  }

  function handleMouseUp() {
    // setTimeout(0) para que la selección ya esté actualizada al leerla.
    setTimeout(() => {
      const text = getSelectedText();
      if (text.length > 0) {
        show();
      } else {
        hide();
      }
    }, 0);
  }

  function handleMouseDown(event) {
    // Si el clic fue fuera del botón, ocultarlo.
    if (buttonEl && !buttonEl.contains(event.target)) {
      hide();
    }
  }

  /** Empieza a escuchar selecciones de texto. */
  function enable() {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    log.debug('Botón de lectura activado');
  }

  /** Deja de escuchar y oculta el botón. */
  function disable() {
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousedown', handleMouseDown);
    hide();
    log.debug('Botón de lectura desactivado');
  }

  return {
    enable,
    disable,
    hide,
  };
}
