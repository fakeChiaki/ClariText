import { sanitizeNode } from './reading.ui.utils.js';

// ─── Renderizado de bloques de contenido ──────────────────────────────────────

/**
 * Agrupa nodos DT con los DD/listas que los siguen, formando grupos compuestos.
 * Devuelve una lista mixta de nodos simples y grupos `{type, title, nodes}`.
 *
 * @param {Node[]} nodes
 * @returns {Array}
 */
export function normalizeDlGroups(nodes) {
  const displayItems = [];
  let currentGroup = null;

  nodes.forEach((node) => {
    const tag = (node.tagName || '').toUpperCase();
    const isDt = tag === 'DT';
    const isListPiece = ['UL', 'OL', 'DL', 'DD', 'LI'].includes(tag);

    if (isDt) {
      currentGroup = {
        type: 'dt-group',
        title: (node.innerText || node.textContent || '').trim() || 'Lista',
        nodes: [node],
      };
      displayItems.push(currentGroup);
      return;
    }

    if (currentGroup && isListPiece) {
      currentGroup.nodes.push(node);
      return;
    }

    currentGroup = null;
    displayItems.push(node);
  });

  return displayItems;
}

/**
 * Construye el widget colapsable de una tabla HTML.
 *
 * @param {HTMLElement} wrapper
 * @param {Node}        node
 */
export function renderTableBlock(wrapper, node) {
  const table =
    node.tagName === 'TABLE' ? node.cloneNode(true) : node.querySelector('table')?.cloneNode(true);
  const caption = (node.querySelector?.('caption')?.innerText || '').trim();

  const cols = [];
  const thead = table?.querySelector('thead');
  if (thead) {
    thead
      .querySelectorAll('th')
      .forEach((th) => cols.push((th.innerText || th.textContent || '').trim()));
  } else {
    const firstRow = table?.querySelector('tr');
    firstRow?.querySelectorAll('td,th').forEach((cell, i) => {
      if (i < 6) {
        cols.push((cell.innerText || cell.textContent || '').trim());
      }
    });
  }

  const label = caption || (cols.length ? `Tabla — ${cols.join(' + ')}` : 'Tabla');
  const expanded = buildExpandableBlock(wrapper, label);

  if (table) {
    table.classList.add('clrtxt-table');
    expanded.appendChild(sanitizeNode(table));
  }
}

/**
 * Construye el widget colapsable de una lista (UL / OL / DL).
 *
 * @param {HTMLElement} wrapper
 * @param {Node}        node
 */
export function renderListBlock(wrapper, node) {
  const tag = (node.tagName || '').toUpperCase();
  const listRoot = ['UL', 'OL', 'DL'].includes(tag)
    ? node.cloneNode(true)
    : node.querySelector('ul, ol, dl')?.cloneNode(true);

  const itemsText = [];
  listRoot?.querySelectorAll('li, dd, dt').forEach((li, i) => {
    if (i < 6) {
      itemsText.push((li.innerText || li.textContent || '').trim());
    }
  });

  const label = itemsText.length ? `Lista — ${itemsText.join(' + ')}` : 'Lista';
  const expanded = buildExpandableBlock(wrapper, label);

  if (listRoot) {
    expanded.appendChild(sanitizeNode(listRoot));
  }
}

/**
 * Construye el widget colapsable para un grupo DT + hijos.
 *
 * @param {HTMLElement} wrapper
 * @param {Object}      group
 */
export function renderDtGroup(wrapper, group) {
  const titleText = group.title || 'Lista';
  const totalItems = group.nodes.slice(1).reduce((sum, node) => {
    if (!node) {
      return sum;
    }
    return sum + (node.querySelectorAll ? node.querySelectorAll('li, dd, dt').length : 1);
  }, 0);

  const label = totalItems > 15 ? `${titleText} — ${totalItems} elementos` : titleText;
  const expanded = buildExpandableBlock(wrapper, label);
  group.nodes.slice(1).forEach((node) => expanded.appendChild(sanitizeNode(node)));
}

/**
 * Construye el widget colapsable para un grupo DL compuesto.
 *
 * @param {HTMLElement} wrapper
 * @param {Object}      group
 */
export function renderDlGroup(wrapper, group) {
  const firstDt = group.nodes[0]?.querySelector?.('dt');
  const titleText = firstDt?.innerText?.trim() || 'Lista';
  const totalItems = group.nodes.reduce(
    (sum, node) => sum + (node?.querySelectorAll ? node.querySelectorAll('li, dd, dt').length : 0),
    0,
  );

  const label = totalItems > 15 ? `${titleText} — ${totalItems} elementos` : titleText;
  const expanded = buildExpandableBlock(wrapper, label);
  group.nodes.forEach((node) => expanded.appendChild(sanitizeNode(node)));
}

// ─── Privado ──────────────────────────────────────────────────────────────────

/**
 * Crea la estructura colapsable compartida (cabecera + botón + bloque expandido).
 * Añade collapsed al wrapper y devuelve el div expandido para que el llamador
 * le añada el contenido específico.
 *
 * @param {HTMLElement} wrapper
 * @param {string}      label   - Texto del título colapsado.
 * @returns {HTMLElement}       - Div expandido (inicialmente oculto).
 */
function buildExpandableBlock(wrapper, label) {
  const collapsed = document.createElement('div');
  collapsed.className = 'clrtxt-table-collapsed';

  const titleLine = document.createElement('span');
  titleLine.className = 'clrtxt-table-title';
  titleLine.textContent = label;
  collapsed.appendChild(titleLine);

  const showBtn = document.createElement('button');
  showBtn.type = 'button';
  showBtn.className = 'clrtxt-table-toggle';
  showBtn.textContent = 'Mostrar';
  collapsed.appendChild(showBtn);

  const expanded = document.createElement('div');
  expanded.className = 'clrtxt-table-expanded clrtxt-expanded-block';
  expanded.style.display = 'none';

  showBtn.addEventListener('click', () => {
    const visible = expanded.style.display !== 'none';
    expanded.style.display = visible ? 'none' : '';
    showBtn.textContent = visible ? 'Mostrar' : 'Ocultar';
  });

  wrapper.appendChild(collapsed);
  wrapper.appendChild(expanded);

  return expanded;
}
