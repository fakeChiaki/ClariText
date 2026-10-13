export function mountResetButton(parent, { onReset, setBusy, setStatus }) {
  const row = document.createElement('div');
  row.className = 'clrtxt-fonts-reset-row';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'clrtxt-fonts-reset';
  btn.className = 'clrtxt-btn-reset';
  btn.textContent = 'Restablecer';
  row.appendChild(btn);
  parent.appendChild(row);

  function setDisabled(value) {
    btn.disabled = value;
  }

  async function handle() {
    if (btn.disabled || !onReset) {
      return;
    }
    setBusy(true);
    setStatus('Restableciendo…', 'info');
    try {
      const result = await onReset();
      if (result?.ok) {
        setStatus('Valores restablecidos', 'success');
      } else {
        setStatus(result?.message || 'No se pudo restablecer', 'error');
      }
    } catch (err) {
      setStatus(err?.message || 'Error al restablecer', 'error');
    } finally {
      setBusy(false);
    }
  }

  btn.addEventListener('click', handle);

  return { el: btn, setDisabled };
}
