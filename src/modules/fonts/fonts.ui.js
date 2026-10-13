import { PREVIEW_TEXT, CATEGORIES } from './fonts.config.js';
import { mountResetButton } from './fonts.ui.reset.js';

const STYLE_ID = 'clrtxt-fonts-preview-style';

function buildPreviewFontFaceCSS(fonts, customFonts) {
  const rules = [];
  for (const font of fonts) {
    for (const [weight, file] of Object.entries(font.files)) {
      const url = chrome.runtime.getURL('modules/fonts/assets/' + file);
      rules.push(
        `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${url}') format('woff2');}`,
      );
    }
  }
  for (const custom of customFonts) {
    if (!custom?.dataUrl || !custom?.family) {
      continue;
    }
    const format = custom.format || 'font/woff2';
    rules.push(
      `@font-face{font-family:'${custom.family}';font-style:normal;font-weight:400;font-display:swap;src:url('${custom.dataUrl}') format('${format}');}`,
    );
  }
  return rules.join('\n');
}

function ensurePreviewStyle(fonts, customFonts) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = buildPreviewFontFaceCSS(fonts, customFonts);
}

function populateSelect(select, fonts, customFonts, currentId) {
  select.innerHTML = '';

  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = '— Sin fuente personalizada —';
  select.appendChild(noneOption);

  const byCategory = new Map();
  for (const font of fonts) {
    if (!byCategory.has(font.category)) {
      byCategory.set(font.category, []);
    }
    byCategory.get(font.category).push(font);
  }

  for (const [category, list] of byCategory) {
    const group = document.createElement('optgroup');
    group.label = CATEGORIES[category] || category;
    for (const font of list) {
      const opt = document.createElement('option');
      opt.value = font.id;
      opt.textContent = font.displayName;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }

  if (customFonts.length > 0) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Personalizadas';
    for (const custom of customFonts) {
      const opt = document.createElement('option');
      opt.value = custom.id;
      opt.textContent = custom.displayName;
      customGroup.appendChild(opt);
    }
    select.appendChild(customGroup);
  }

  select.value = currentId || '';
}

function updatePreview(preview, fontId, fonts, customFonts) {
  if (!fontId) {
    preview.style.fontFamily = '';
    return;
  }
  const builtIn = fonts.find((f) => f.id === fontId);
  if (builtIn) {
    preview.style.fontFamily = `'${builtIn.family}', sans-serif`;
    return;
  }
  const custom = customFonts.find((c) => c.id === fontId);
  if (custom) {
    preview.style.fontFamily = `'${custom.family}', sans-serif`;
    return;
  }
  preview.style.fontFamily = '';
}

export function createButton(label, variant) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `clrtxt-btn clrtxt-btn-${variant}`;
  btn.textContent = label;
  return btn;
}

export function mountFontsPanel(
  container,
  {
    availableFonts,
    customFonts = [],
    currentFontId = null,
    onApply,
    onRemove,
    onAddCustom,
    onRemoveCustom,
    onReset,
  } = {},
) {
  container.innerHTML = '';

  ensurePreviewStyle(availableFonts, customFonts);

  const wrapper = document.createElement('fieldset');
  wrapper.className = 'clrtxt-fonts-panel';

  const legend = document.createElement('legend');
  legend.textContent = 'Fuente para la página';
  wrapper.appendChild(legend);

  const label = document.createElement('label');
  label.htmlFor = 'clrtxt-fonts-select';
  label.textContent = 'Elige una fuente:';
  wrapper.appendChild(label);

  const select = document.createElement('select');
  select.id = 'clrtxt-fonts-select';
  select.className = 'clrtxt-fonts-select';
  populateSelect(select, availableFonts, customFonts, currentFontId);
  wrapper.appendChild(select);

  const preview = document.createElement('div');
  preview.className = 'clrtxt-fonts-preview';
  preview.id = 'clrtxt-fonts-preview';
  preview.setAttribute('aria-label', 'Vista previa de la fuente');
  preview.textContent = PREVIEW_TEXT;
  wrapper.appendChild(preview);

  const actions = document.createElement('div');
  actions.className = 'clrtxt-fonts-actions';

  const applyBtn = createButton('Aplicar', 'primary');
  applyBtn.id = 'clrtxt-fonts-apply';
  actions.appendChild(applyBtn);

  const removeBtn = createButton('Quitar', 'secondary');
  removeBtn.id = 'clrtxt-fonts-remove';
  actions.appendChild(removeBtn);

  wrapper.appendChild(actions);

  const status = document.createElement('div');
  status.className = 'clrtxt-fonts-status';
  status.id = 'clrtxt-fonts-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  wrapper.appendChild(status);

  const customSection = document.createElement('div');
  customSection.className = 'clrtxt-fonts-custom';
  wrapper.appendChild(customSection);

  const resetBtn = mountResetButton(wrapper, {
    onReset,
    setBusy: (value) => {
      busy = value;
      updateButtons();
    },
    setStatus,
  });

  let appliedFontId = currentFontId || null;
  let busy = false;

  function updateButtons() {
    const hasSelection = !!select.value;
    const sameAsApplied = select.value === appliedFontId;
    applyBtn.disabled = busy || !hasSelection || sameAsApplied;
    removeBtn.disabled = busy || !appliedFontId;
    resetBtn.setDisabled(busy || (!appliedFontId && customFonts.length === 0));
  }

  function setStatus(message, tone) {
    if (!message) {
      status.textContent = '';
      status.removeAttribute('data-tone');
      return;
    }
    status.textContent = message;
    if (tone) {
      status.setAttribute('data-tone', tone);
    } else {
      status.removeAttribute('data-tone');
    }
  }

  function refreshSelectAndPreview() {
    populateSelect(select, availableFonts, customFonts, appliedFontId);
    updatePreview(preview, appliedFontId, availableFonts, customFonts);
    updateButtons();
  }

  const controller = {
    isBusy: () => busy,
    setBusy: (value) => {
      busy = value;
      updateButtons();
    },
    setStatus,
    getApplied: () => appliedFontId,
    setApplied: (id) => {
      appliedFontId = id || null;
      select.value = id || '';
      updatePreview(preview, select.value, availableFonts, customFonts);
      updateButtons();
    },
    refreshSelectAndPreview,
  };

  async function handleApply() {
    if (!onApply || applyBtn.disabled) {
      return;
    }
    busy = true;
    updateButtons();
    setStatus('Aplicando…', 'info');
    try {
      const result = await onApply(select.value);
      if (result?.ok) {
        appliedFontId = select.value;
        setStatus('Fuente aplicada', 'success');
        updateButtons();
      } else {
        setStatus(result?.message || 'No se pudo aplicar', 'error');
      }
    } catch (err) {
      setStatus(err?.message || 'Error al aplicar', 'error');
    } finally {
      busy = false;
      updateButtons();
    }
  }

  async function handleRemove() {
    if (!onRemove || removeBtn.disabled) {
      return;
    }
    busy = true;
    updateButtons();
    setStatus('Quitando…', 'info');
    try {
      const result = await onRemove();
      if (result?.ok) {
        appliedFontId = null;
        select.value = '';
        setStatus('Fuente quitada', 'success');
        updateButtons();
      } else {
        setStatus(result?.message || 'No se pudo quitar', 'error');
      }
    } catch (err) {
      setStatus(err?.message || 'Error al quitar', 'error');
    } finally {
      busy = false;
      updateButtons();
    }
  }

  select.addEventListener('change', () => {
    setStatus('');
    updatePreview(preview, select.value, availableFonts, customFonts);
    updateButtons();
  });

  applyBtn.addEventListener('click', handleApply);
  removeBtn.addEventListener('click', handleRemove);

  updatePreview(preview, currentFontId, availableFonts, customFonts);
  updateButtons();

  let customSectionController = null;
  import('./fonts.ui.custom.js').then(({ mountCustomFontsSection }) => {
    customSectionController = mountCustomFontsSection(customSection, {
      customFonts,
      onAddCustom,
      onRemoveCustom,
      controller,
    });
  });

  container.appendChild(wrapper);

  return {
    getSelected: () => select.value,
    getApplied: () => appliedFontId,
    getCustomFonts: () => [...customFonts],
    setSelected: (id) => {
      appliedFontId = id || null;
      select.value = id || '';
      updatePreview(preview, select.value, availableFonts, customFonts);
      updateButtons();
    },
    setDropdownSelection: (id) => {
      select.value = id || '';
      updatePreview(preview, id, availableFonts, customFonts);
      updateButtons();
    },
    setCustomFonts: (list) => {
      customFonts.length = 0;
      for (const c of list || []) {
        customFonts.push(c);
      }
      ensurePreviewStyle(availableFonts, customFonts);
      refreshSelectAndPreview();
      if (customSectionController?.render) {
        customSectionController.render();
      }
    },
    destroy: () => {
      wrapper.remove();
      const style = document.getElementById(STYLE_ID);
      if (style) {
        style.remove();
      }
    },
  };
}
