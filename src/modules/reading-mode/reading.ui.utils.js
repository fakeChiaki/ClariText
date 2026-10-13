// ─── Utilidades de UI ─────────────────────────────────────────────────────────

/**
 * Trunca una URL para mostrarla en la barra superior.
 *
 * @param {string} url
 * @returns {string}
 */
export function truncateUrl(url) {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    return display.length > 60 ? display.substring(0, 57) + '…' : display;
  } catch {
    return url;
  }
}

/**
 * Sanitiza un nodo clonado eliminando scripts y atributos de evento.
 * Preserva la estructura semántica y el texto.
 *
 * @param {Node} node
 * @returns {Node}
 */
export function sanitizeNode(node) {
  const clone = node.cloneNode(true);

  // Desenvuelve anclas internas en encabezados; preserva enlaces normales en cuerpo de texto.
  clone
    .querySelectorAll?.(
      'h1 a[href^="#"], h2 a[href^="#"], h3 a[href^="#"], h4 a[href^="#"], h5 a[href^="#"], h6 a[href^="#"]',
    )
    .forEach((a) => {
      try {
        a.replaceWith(document.createTextNode(a.textContent || ''));
      } catch (e) {
        /* ignorar */
      }
    });

  // Eliminar anclas javascript: (no son útiles en modo lectura).
  clone.querySelectorAll?.('a[href^="javascript:"]').forEach((a) => {
    try {
      a.replaceWith(document.createTextNode(a.textContent || ''));
    } catch (e) {
      /* ignorar */
    }
  });

  // Eliminar scripts y estilos residuales
  clone.querySelectorAll?.('script, style, link').forEach((el) => el.remove());

  // Eliminar atributos de evento inline
  clone.querySelectorAll?.('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith('on') || attr.name === 'style') {
        el.removeAttribute(attr.name);
      }
    });
  });

  return clone;
}

/**
 * Parsea un color CSS a array RGB [r, g, b].
 *
 * @param {string} color
 * @returns {number[]|null}
 */
export function parseColorToRgb(color) {
  if (!color) {
    return null;
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const hex = color.replace('#', '').trim();
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.substr(0, 2), 16),
      parseInt(hex.substr(2, 2), 16),
      parseInt(hex.substr(4, 2), 16),
    ];
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  return null;
}

/**
 * Calcula la luminancia relativa de un color RGB.
 *
 * @param {number[]} rgb
 * @returns {number}
 */
export function relativeLuminance([r, g, b]) {
  const srgb = [r, g, b]
    .map((v) => v / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Indica si un color es cercano al blanco (luminancia > 0.92).
 *
 * @param {string} color
 * @returns {boolean}
 */
export function isWhiteish(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    return false;
  }
  return relativeLuminance(rgb) > 0.92;
}

/**
 * Detecta los colores de fondo y texto actuales de la página.
 *
 * @returns {{ bg: string, fg: string }|null}
 */
export function detectPageColors() {
  try {
    const el = document.body || document.documentElement;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor || cs.background || '#ffffff';
    const fg = cs.color || '#000000';
    return { bg, fg };
  } catch (e) {
    return null;
  }
}
