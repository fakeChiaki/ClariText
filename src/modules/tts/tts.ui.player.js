import { createLogger } from '../../shared/logger.js';
import { CSS_PREFIX } from '../../shared/constants.js';
import { TTS_DEFAULTS, TTS_LIMITS } from './tts.config.js';

const log = createLogger('TTS-Player');

const ICONS = {
  play: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
  stop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>',
  close:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
};

/**
 * Crea el reproductor flotante.
 *
 * @param {object} callbacks - { onPlay, onPause, onStop, onRateChange, onClose }.
 * @returns {object} Componente con show, hide, setState, getRate, setRate, getBodyContainer.
 */
export function createPlayer(callbacks = {}) {
  const cb = {
    onTogglePlay: () => {},
    onStop: () => {},
    onRateChange: () => {},
    onClose: () => {},
    ...callbacks,
  };

  let root = null;
  let bodyContainer = null;
  let playBtn = null;
  let pauseBtn = null;
  let stopBtn = null;
  let rateSlider = null;
  let rateLabel = null;
  let state = 'idle';
  let rate = TTS_DEFAULTS.rate;
  let pauseSupported = true;

  function build() {
    root = document.createElement('div');
    root.className = `${CSS_PREFIX}-player`;
    applyRootStyles(root);

    const bar = document.createElement('div');
    applyBarStyles(bar);

    playBtn = makeControlButton(ICONS.play, 'Reproducir', () => {
      cb.onTogglePlay();
    });

    pauseBtn = makeControlButton(ICONS.pause, 'Pausar', () => {
      // Solo dispara si la voz soporta pausa.
      if (pauseSupported) {
        cb.onTogglePlay();
      }
    });
    pauseBtn.classList.add(`${CSS_PREFIX}-pause-btn`);

    stopBtn = makeControlButton(ICONS.stop, 'Detener', () => cb.onStop());

    rateLabel = document.createElement('span');
    rateLabel.textContent = `Velocidad: ${rate.toFixed(2)}x`;
    Object.assign(rateLabel.style, {
      color: '#ffffff',
      fontSize: '13px',
      fontWeight: '600',
      whiteSpace: 'nowrap',
    });

    rateSlider = document.createElement('input');
    rateSlider.type = 'range';
    rateSlider.min = String(TTS_LIMITS.rate.min);
    rateSlider.max = String(TTS_LIMITS.rate.max);
    rateSlider.step = String(TTS_LIMITS.rate.step);
    rateSlider.value = String(rate);
    Object.assign(rateSlider.style, { flex: '1', cursor: 'pointer', minWidth: '120px' });
    rateSlider.addEventListener('input', () => {
      rate = parseFloat(rateSlider.value);
      rateLabel.textContent = `Velocidad: ${rate.toFixed(2)}x`;
      cb.onRateChange(rate);
    });

    const closeBtn = makeControlButton(ICONS.close, 'Cerrar', () => {
      hide();
      cb.onClose();
    });

    bar.append(playBtn, pauseBtn, stopBtn, rateLabel, rateSlider, closeBtn);

    // Contenedor del cuerpo: aquí se monta el visor del texto.
    // Si el módulo decide no montar nada, queda colapsado (sin altura).
    bodyContainer = document.createElement('div');
    bodyContainer.className = `${CSS_PREFIX}-player-body`;

    root.append(bar, bodyContainer);
    document.body.appendChild(root);
  }

  function makeControlButton(svg, label, onClick) {
    const btn = document.createElement('button');
    btn.className = `${CSS_PREFIX}-player-btn`;
    btn.innerHTML = svg;
    btn.setAttribute('aria-label', label);
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: 'var(--clrtxt-control-bg, rgba(255,255,255,0.25))',
      color: '#ffffff',
      transition: 'background 0.15s ease',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--clrtxt-control-bg-hover, rgba(255,255,255,0.4))';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'var(--clrtxt-control-bg, rgba(255,255,255,0.25))';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  function applyRootStyles(el) {
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 'var(--clrtxt-z-player, 2147483100)',
      borderRadius: 'var(--clrtxt-radius, 14px)',
      background: 'var(--clrtxt-bg-accent, #e8c39e)',
      boxShadow: '0 8px 24px var(--clrtxt-shadow, rgba(0,0,0,0.18))',
      padding: '12px',
      maxWidth: '520px',
      overflow: 'hidden',
      display: 'none',
    });
  }

  function applyBarStyles(el) {
    Object.assign(el.style, {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--clrtxt-gap, 12px)',
    });
  }

  /** Cambia el estado visual del reproductor. */
  function setState(newState) {
    state = newState;
    if (!playBtn) {
      return;
    }

    // El botón play se muestra cuando NO está reproduciendo.
    // El botón pause se muestra cuando SÍ está reproduciendo (y la voz lo soporta).
    const isPlaying = state === 'playing';
    playBtn.style.display = isPlaying ? 'none' : 'inline-flex';
    pauseBtn.style.display = isPlaying ? 'inline-flex' : 'none';

    const stopDisabled = state === 'finished' || state === 'idle';
    stopBtn.style.opacity = stopDisabled ? '0.4' : '1';
    stopBtn.style.pointerEvents = stopDisabled ? 'none' : 'auto';

    applyPauseSupport();
    log.debug(`Estado: ${state}`);
  }

  /**
   * Aplica el estado visual de soporte de pausa al botón pausa.
   * Si la voz no soporta pausa, el botón se ve gris y no responde.
   */
  function applyPauseSupport() {
    if (!pauseBtn) {
      return;
    }
    pauseBtn.style.opacity = pauseSupported ? '1' : '0.4';
    pauseBtn.style.cursor = pauseSupported ? 'pointer' : 'not-allowed';
    if (!pauseSupported) {
      pauseBtn.setAttribute('data-tooltip', 'Esta voz no soporta pausa. Usa Detener.');
    } else {
      pauseBtn.removeAttribute('data-tooltip');
    }
  }

  /** Permite al orquestador comunicar si la voz actual soporta pausa. */
  function setPauseSupported(supported) {
    pauseSupported = supported;
    applyPauseSupport();
  }

  function show() {
    if (!root) {
      build();
    }
    root.style.display = 'block';
    setState('idle');
  }

  function hide() {
    if (root) {
      root.style.display = 'none';
    }
  }

  function getRate() {
    return rate;
  }

  function setRate(value) {
    rate = value;
    if (rateSlider) {
      rateSlider.value = String(value);
      rateLabel.textContent = `Velocidad: ${rate.toFixed(2)}x`;
    }
  }

  /**
   * Devuelve el contenedor del cuerpo del panel. El visor debe montarse
   * dentro de este elemento. Construye el reproductor si aún no existe.
   */
  function getBodyContainer() {
    if (!root) {
      build();
    }
    return bodyContainer;
  }

  return {
    show,
    hide,
    setState,
    setPauseSupported,
    getRate,
    setRate,
    getBodyContainer,
  };
}
