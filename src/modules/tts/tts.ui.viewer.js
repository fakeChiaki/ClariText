import { createLogger } from '../../shared/logger.js';
import { CSS_PREFIX } from '../../shared/constants.js';
import { VIEWER_SIZES, TTS_DEFAULTS } from './tts.config.js';

const log = createLogger('TTS-Viewer');

// Tiempo de espera para detectar si la voz soporta onboundary.
const BOUNDARY_DETECTION_MS = 2000;

/**
 * Crea el visor del texto.
 *
 * @param {HTMLElement} container - Elemento donde montar el visor.
 * @returns {object} Componente con setText, highlightWord, clearHighlight, start, stop, setSize.
 */
export function createViewer(container) {
  if (!container) {
    log.error('createViewer requiere un contenedor');
    return null;
  }

  let root = null;
  let currentText = '';
  let highlightSupported = null; // null = sin determinar, true/false = ya determinado
  let detectionTimer = null;
  let currentSize = TTS_DEFAULTS.viewerSize;
  let highlightEnabled = TTS_DEFAULTS.highlight;

  function build() {
    root = document.createElement('div');
    root.className = `${CSS_PREFIX}-viewer`;
    applyStyles(root);
    container.appendChild(root);
  }

  function applyStyles(el) {
    Object.assign(el.style, {
      marginTop: '12px',
      padding: '14px 16px',
      borderRadius: '10px',
      background: 'var(--clrtxt-bg, #fdf6e3)',
      color: 'var(--clrtxt-text, #2d2d2d)',
      fontSize: VIEWER_SIZES[currentSize] || VIEWER_SIZES.large,
      lineHeight: 'var(--clrtxt-line-height, 1.8)',
      letterSpacing: 'var(--clrtxt-letter-spacing, 0.02em)',
      maxHeight: '240px',
      overflowY: 'auto',
      wordBreak: 'break-word',
    });
  }

  /**
   * Asigna el texto a mostrar. Lo divide en spans por palabra para
   * poder resaltar después.
   */
  function setText(text) {
    if (!root) {
      build();
    }
    currentText = typeof text === 'string' ? text : '';
    root.innerHTML = '';

    if (!currentText) {
      return;
    }

    // Renderizar como spans para poder resaltar palabras.
    // Cada span guarda su rango de caracteres en data-start y data-end.
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    // Regex que separa palabras manteniendo los espacios y signos.
    const tokens = currentText.match(/\S+|\s+/g) || [];
    for (const token of tokens) {
      const span = document.createElement('span');
      span.textContent = token;
      span.dataset.start = String(cursor);
      span.dataset.end = String(cursor + token.length);
      fragment.appendChild(span);
      cursor += token.length;
    }
    root.appendChild(fragment);
  }

  /**
   * Resalta la palabra que comienza en charIndex (en el texto original).
   * Si todavía no se ha confirmado el soporte de boundary, esta llamada
   * lo confirma y cancela el watchdog.
   */
  function highlightWord(charIndex, _charLength) {
    if (!root || !highlightEnabled) {
      return;
    }
    confirmBoundarySupport();

    clearHighlight();
    const spans = root.querySelectorAll('span');
    for (const span of spans) {
      const start = parseInt(span.dataset.start, 10);
      const end = parseInt(span.dataset.end, 10);
      if (charIndex >= start && charIndex < end) {
        span.style.background = 'var(--clrtxt-highlight, #ffe08a)';
        span.style.borderRadius = '3px';
        // Llevar la palabra al área visible si está fuera del scroll.
        span.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      }
    }
  }

  /** Quita el resaltado de cualquier palabra previamente marcada. */
  function clearHighlight() {
    if (!root) {
      return;
    }
    root.querySelectorAll('span').forEach((s) => {
      s.style.background = '';
      s.style.borderRadius = '';
    });
  }

  function confirmBoundarySupport() {
    if (highlightSupported === null) {
      highlightSupported = true;
      log.debug('onboundary detectado, resaltado activo');
    }
    if (detectionTimer) {
      clearTimeout(detectionTimer);
      detectionTimer = null;
    }
  }

  /**
   * Inicia el watchdog: si no llega ningún highlightWord en 2 segundos,
   * marcamos esta voz como sin soporte de boundary y nos olvidamos del
   * resaltado para esta lectura.
   */
  function start() {
    highlightSupported = null;
    clearHighlight();
    if (detectionTimer) {
      clearTimeout(detectionTimer);
    }
    detectionTimer = setTimeout(() => {
      if (highlightSupported === null) {
        highlightSupported = false;
        log.info('La voz no soporta onboundary, resaltado desactivado');
      }
    }, BOUNDARY_DETECTION_MS);
  }

  /** Detiene el watchdog y limpia el resaltado. */
  function stop() {
    if (detectionTimer) {
      clearTimeout(detectionTimer);
      detectionTimer = null;
    }
    clearHighlight();
  }

  /** Cambia el tamaño del texto del visor (small | medium | large). */
  function setSize(size) {
    if (!VIEWER_SIZES[size]) {
      log.warn(`Tamaño inválido: ${size}`);
      return;
    }
    currentSize = size;
    if (root) {
      root.style.fontSize = VIEWER_SIZES[size];
    }
  }

  /** Activa o desactiva la función de resaltado. */
  function setHighlightEnabled(enabled) {
    highlightEnabled = Boolean(enabled);
    if (!highlightEnabled) {
      clearHighlight();
    }
  }

  return {
    setText,
    highlightWord,
    clearHighlight,
    start,
    stop,
    setSize,
    setHighlightEnabled,
  };
}
