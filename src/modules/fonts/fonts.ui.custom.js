import { createButton } from './fonts.ui.js';

function formatSize(bytes) {
  if (!bytes) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function mountCustomFontsSection(
  parent,
  { customFonts, onAddCustom, onRemoveCustom, controller },
) {
  parent.innerHTML = '';

  const customLabel = document.createElement('label');
  customLabel.htmlFor = 'clrtxt-fonts-upload-input';
  customLabel.textContent = 'Agregar fuente personalizada:';
  parent.appendChild(customLabel);

  const fileRow = document.createElement('div');
  fileRow.className = 'clrtxt-fonts-upload-row';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'clrtxt-fonts-upload-input';
  fileInput.className = 'clrtxt-fonts-upload-input';
  fileInput.accept = '.ttf,.otf,.woff,.woff2';
  fileInput.setAttribute('aria-describedby', 'clrtxt-fonts-upload-help');
  fileRow.appendChild(fileInput);

  const fileButton = createButton('Elegir archivo…', 'secondary');
  fileButton.id = 'clrtxt-fonts-upload-button';
  fileButton.addEventListener('click', () => fileInput.click());
  fileRow.appendChild(fileButton);

  parent.appendChild(fileRow);

  const helpText = document.createElement('p');
  helpText.id = 'clrtxt-fonts-upload-help';
  helpText.className = 'clrtxt-fonts-upload-help';
  helpText.textContent = 'Formatos: .ttf, .otf, .woff, .woff2. Máx. 2 MB por archivo.';
  parent.appendChild(helpText);

  const customList = document.createElement('ul');
  customList.id = 'clrtxt-fonts-custom-list';
  customList.className = 'clrtxt-fonts-custom-list';
  customList.setAttribute('aria-label', 'Fuentes personalizadas cargadas');
  parent.appendChild(customList);

  function renderList() {
    customList.innerHTML = '';
    if (customFonts.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'clrtxt-fonts-custom-empty';
      empty.textContent = 'No hay fuentes personalizadas.';
      customList.appendChild(empty);
      return;
    }
    for (const custom of customFonts) {
      const li = document.createElement('li');
      li.className = 'clrtxt-fonts-custom-item';

      const name = document.createElement('span');
      name.className = 'clrtxt-fonts-custom-name';
      name.textContent = custom.displayName;
      name.style.fontFamily = `'${custom.family}', sans-serif`;
      li.appendChild(name);

      const meta = document.createElement('span');
      meta.className = 'clrtxt-fonts-custom-meta';
      meta.textContent = formatSize(custom.sizeBytes);
      li.appendChild(meta);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'clrtxt-btn-icon';
      delBtn.setAttribute('aria-label', `Eliminar fuente ${custom.displayName}`);
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => handleRemove(custom.id));
      li.appendChild(delBtn);

      customList.appendChild(li);
    }
  }

  async function handleAdd() {
    const file = fileInput.files?.[0];
    if (!file || !onAddCustom) {
      return;
    }
    controller.setBusy(true);
    controller.setStatus('Subiendo…', 'info');
    try {
      const result = await onAddCustom(file);
      if (result?.ok) {
        controller.setStatus('Fuente agregada', 'success');
        fileInput.value = '';
      } else {
        controller.setStatus(result?.message || 'No se pudo agregar', 'error');
      }
    } catch (err) {
      controller.setStatus(err?.message || 'Error al subir', 'error');
    } finally {
      controller.setBusy(false);
    }
  }

  async function handleRemove(id) {
    if (!onRemoveCustom) {
      return;
    }
    controller.setBusy(true);
    controller.setStatus('Eliminando…', 'info');
    try {
      const result = await onRemoveCustom(id);
      if (result?.ok) {
        if (controller.getApplied() === id) {
          controller.setApplied(null);
        }
        const idx = customFonts.findIndex((c) => c.id === id);
        if (idx >= 0) {
          customFonts.splice(idx, 1);
        }
        renderList();
        controller.refreshSelectAndPreview();
        controller.setStatus('Fuente eliminada', 'success');
      } else {
        controller.setStatus(result?.message || 'No se pudo eliminar', 'error');
      }
    } catch (err) {
      controller.setStatus(err?.message || 'Error al eliminar', 'error');
    } finally {
      controller.setBusy(false);
    }
  }

  fileInput.addEventListener('change', handleAdd);

  renderList();

  return {
    render: () => renderList(),
  };
}
