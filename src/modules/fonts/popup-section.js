import { createLogger } from '../../shared/logger.js';
import { mountFontsPanel } from './fonts.ui.js';
import {
  BUILT_IN_FONTS,
  STORAGE_KEYS,
  ALLOWED_FORMATS,
  FILE_TYPE_MAP,
  LIMITS,
} from './fonts.config.js';

import { ICON_FONT } from '../../popup/icons.js';

const log = createLogger('FontsPopupSection');

const dom = { mount: null };

let panelController = null;
let storageListener = null;

async function sendToAllTabs(message) {
  const tabs = await chrome.tabs.query({});
  let activeResult = null;
  for (const tab of tabs) {
    try {
      const result = await chrome.tabs.sendMessage(tab.id, message);
      if (tab.active) {
        activeResult = result;
      }
    } catch {
      // Tab sin content script (chrome://, etc.) — ignorar
    }
  }
  return activeResult || { ok: true };
}

function getExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function stripExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(0, idx) : name;
}

function sanitizeId(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'font'
  );
}

function generateFontId(fileName) {
  const base = sanitizeId(stripExtension(fileName));
  return `custom-${base}-${Date.now().toString(36)}`;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

async function loadCustomFonts() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_INDEX);
  const index = result[STORAGE_KEYS.CUSTOM_INDEX] || [];
  if (index.length === 0) {
    return [];
  }
  const dataKeys = index.map((entry) => STORAGE_KEYS.CUSTOM_DATA_PREFIX + entry.id);
  const data = await chrome.storage.local.get(dataKeys);
  return index.map((entry) => ({
    ...entry,
    dataUrl: data[STORAGE_KEYS.CUSTOM_DATA_PREFIX + entry.id] || null,
  }));
}

async function render(container, _footer) {
  dom.mount = document.createElement('div');
  dom.mount.className = 'clrtxt-fonts-mount';
  container.appendChild(dom.mount);

  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_FONT_ID);
  const currentFontId = result[STORAGE_KEYS.ACTIVE_FONT_ID] || null;
  const customFonts = await loadCustomFonts();

  panelController = mountFontsPanel(dom.mount, {
    availableFonts: BUILT_IN_FONTS,
    customFonts,
    currentFontId,
    onApply: (fontId) => sendToAllTabs({ type: 'fonts:apply', payload: { fontId } }),
    onRemove: () => sendToAllTabs({ type: 'fonts:clear' }),
    onAddCustom: async (file) => {
      const ext = getExtension(file.name);
      if (!ALLOWED_FORMATS.includes(ext)) {
        return { ok: false, message: 'Formato no soportado: ' + (ext || 'desconocido') };
      }
      if (file.size > LIMITS.FILE_SIZE_MAX_BYTES) {
        return {
          ok: false,
          message:
            'Archivo demasiado grande (máx. ' +
            (LIMITS.FILE_SIZE_MAX_BYTES / 1024 / 1024).toFixed(0) +
            ' MB)',
        };
      }
      let dataUrl;
      try {
        dataUrl = await readFileAsDataURL(file);
      } catch (err) {
        return { ok: false, message: err.message || 'No se pudo leer el archivo' };
      }

      const id = generateFontId(file.name);
      const displayName = stripExtension(file.name).slice(0, LIMITS.FILE_NAME_MAX_CHARS);
      const family = 'ClariText Custom ' + id;
      const format = FILE_TYPE_MAP[ext] || 'truetype';

      const addResult = await sendToAllTabs({
        type: 'fonts:add-custom',
        payload: {
          meta: { id, displayName, family, format, sizeBytes: file.size },
          dataUrl,
        },
      });

      if (addResult?.ok) {
        const updated = await loadCustomFonts();
        panelController.setCustomFonts(updated);
        panelController.setDropdownSelection(id);
      }
      return addResult;
    },
    onRemoveCustom: (id) => sendToAllTabs({ type: 'fonts:remove-custom', payload: { id } }),
    onReset: () => sendToAllTabs({ type: 'fonts:reset' }),
  });

  storageListener = (changes, area) => {
    if (area !== 'local') {
      return;
    }
    if (changes[STORAGE_KEYS.ACTIVE_FONT_ID]) {
      const newValue = changes[STORAGE_KEYS.ACTIVE_FONT_ID].newValue || null;
      if (panelController) {
        panelController.setSelected(newValue);
      }
    }
    if (changes[STORAGE_KEYS.CUSTOM_INDEX]) {
      loadCustomFonts().then((updated) => {
        if (panelController) {
          panelController.setCustomFonts(updated);
        }
      });
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
}

function onActivate() {
  log.debug('Sección Fuente activada');
}

function onDeactivate() {
  log.debug('Sección Fuente desactivada');
}

function destroy() {
  if (storageListener) {
    chrome.storage.onChanged.removeListener(storageListener);
    storageListener = null;
  }
  if (panelController?.destroy) {
    panelController.destroy();
  }
  panelController = null;
  if (dom.mount) {
    dom.mount.remove();
    dom.mount = null;
  }
}

export const fontsPopupSection = {
  id: 'font',
  label: 'Fuente',
  shortLabel: 'Fuente',
  icon: ICON_FONT,
  render,
  onActivate,
  onDeactivate,
  destroy,
};
