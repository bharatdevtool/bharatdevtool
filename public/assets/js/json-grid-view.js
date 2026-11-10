// json-grid-view.js — Grid view for the JSON Formatter's output pane.
// Loaded on demand (dynamic import) the first time someone opens the Grid tab.
// All user data goes into the DOM through textContent, never innerHTML.

import {
  classify,
  tableColumns,
  sortIndices,
  filterIndices,
  flattenRows,
  toCSV,
  pathToString,
  getAt,
  setAt,
  deleteAt,
  insertAt,
  renameKey,
  parseCellInput,
  cellText,
} from './json-grid-model.js';
import { isRaw, rawText, cloneValue } from './json-raw.js';

const PAGE_SIZE = 200;
const EXPAND_ALL_MAX_NODES = 2000;
const EXPAND_ALL_MAX_DEPTH = 12;
const HISTORY_LIMIT = 100;
const SEARCH_MAX_MATCHES = 300;

const keyOf = (path) => JSON.stringify(path);
const isContainer = (v) => v !== null && typeof v === 'object' && !isRaw(v);
const isPlainObject = (v) => isContainer(v) && !Array.isArray(v);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgIcon(paths) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of [].concat(paths)) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

const ICONS = {
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  redo: ['m15 14 5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  copy: ['M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z', 'M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
};

function iconButton(label, d, onClick) {
  const b = el('button', 'icon-btn');
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.dataset.tip = label;
  b.appendChild(svgIcon(d));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function textButton(label, title, onClick) {
  const b = el('button', 'jg-action', label);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

/** A blank value shaped like `sample`: objects keep their keys with null values. */
function blankLike(sample) {
  if (isPlainObject(sample)) {
    const out = {};
    for (const k of Object.keys(sample)) out[k] = null;
    return out;
  }
  return null;
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Mount the grid into `container`.
 * @param {HTMLElement} container
 * @param {{
 *   onSelect?: (path: (string|number)[]) => void,
 *   onChange?: (root: unknown) => void,
 *   onAction?: (action: string, params?: Record<string, number|string>) => void,
 *   notify?: (message: string) => void,
 * }} [options]
 */
export function mountGrid(container, options = {}) {
  let root;
  let hasDoc = false;
  /** Expanded container paths (keyOf). The root table is always open. */
  const expanded = new Set();
  /** Rows shown per array path, for "Show more" paging. */
  const visibleRows = new Map();
  /** Extra rows opened only while a search is active (cleared with the search). */
  const searchRows = new Map();
  /** Per table (keyOf path): sort { key, dir }, column filters, hidden columns, flatten flag. */
  const sorts = new Map();
  const filters = new Map(); // k → Map<col, query>
  const filterOpen = new Set();
  const hiddenCols = new Map(); // k → Set<col>
  const flattened = new Set();
  let selectedKey = null;
  let undoStack = [];
  let redoStack = [];
  let editing = null; // { finish(commit: boolean) }
  let searchMatches = []; // [{ k, isKey }]
  let searchActive = -1;
  let menu = null; // open popover element

  const notify = options.notify || (() => {});
  const track = options.onAction || (() => {});

  container.textContent = '';
  container.classList.add('json-grid');

  // ── Toolbar ──────────────────────────────────────────────
  const toolbar = el('div', 'json-grid-toolbar');
  const pathWrap = el('div', 'json-grid-pathwrap');
  const pathLabel = el('code', 'json-grid-path', '$');
  pathLabel.title = 'Path of the selected cell';
  const copyPathBtn = iconButton('Copy path', ICONS.copy, () => {
    navigator.clipboard?.writeText(pathLabel.textContent || '$').then(() => notify('Path copied'), () => {});
    track('copy_path');
  });
  pathWrap.append(pathLabel, copyPathBtn);
  const undoBtn = iconButton('Undo (Ctrl/Cmd+Z)', ICONS.undo, () => undo());
  const redoBtn = iconButton('Redo (Ctrl/Cmd+Shift+Z)', ICONS.redo, () => redo());
  const rowActions = el('div', 'jg-actions');
  rowActions.setAttribute('role', 'group');
  rowActions.setAttribute('aria-label', 'Edit selected item');
  const insertAboveBtn = textButton('Insert above', 'Insert a new item above the selected row', () => insertRow(0));
  const insertBelowBtn = textButton('Insert below', 'Insert a new item below the selected row', () => insertRow(1));
  const duplicateBtn = textButton('Duplicate', 'Duplicate the selected row', () => duplicateRow());
  const addKeyBtn = textButton('Add key', 'Add a key to the selected object', () => addKey());
  const deleteBtn = textButton('Delete', 'Delete the selected row or key', () => deleteSelected());
  deleteBtn.classList.add('jg-danger');
  rowActions.append(insertAboveBtn, insertBelowBtn, duplicateBtn, addKeyBtn, deleteBtn);
  toolbar.append(
    pathWrap,
    rowActions,
    undoBtn,
    redoBtn,
    iconButton('Expand all', ICONS.plus, () => expandAll()),
    iconButton('Collapse all', ICONS.minus, () => collapseAll()),
  );
  const scroller = el('div', 'json-grid-scroll developer-scrollbar');
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', 'JSON grid');
  container.append(toolbar, scroller);

  // ── Events ───────────────────────────────────────────────
  scroller.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.closest('.jg-editor, .jg-filter-input')) return;
    const menuBtn = target.closest('[data-table-menu]');
    if (menuBtn) {
      e.stopPropagation();
      openTableMenu(menuBtn, menuBtn.getAttribute('data-table-menu'));
      return;
    }
    const toggle = target.closest('[data-toggle]');
    if (toggle) {
      const k = toggle.getAttribute('data-toggle');
      if (expanded.has(k)) expanded.delete(k);
      else expanded.add(k);
      render();
      return;
    }
    const more = target.closest('[data-more]');
    if (more) {
      const k = more.getAttribute('data-more');
      visibleRows.set(k, (visibleRows.get(k) || PAGE_SIZE) + PAGE_SIZE);
      render();
      return;
    }
    const sort = target.closest('[data-sort]');
    if (sort) {
      const k = sort.getAttribute('data-sort');
      const col = sort.getAttribute('data-col');
      const cur = sorts.get(k);
      if (!cur || cur.key !== col) sorts.set(k, { key: col, dir: 'asc' });
      else if (cur.dir === 'asc') sorts.set(k, { key: col, dir: 'desc' });
      else sorts.delete(k);
      track('sort');
      render();
      return;
    }
    const cell = target.closest('[data-path]');
    if (cell) select(cell.getAttribute('data-path'));
  });

  scroller.addEventListener('dblclick', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.closest('.jg-editor, .jg-filter-input, [data-toggle], [data-more], [data-sort], [data-table-menu]')) return;
    const cell = target.closest('[data-path]');
    if (!cell) return;
    e.preventDefault();
    select(cell.getAttribute('data-path'));
    startEdit(cell);
  });

  scroller.addEventListener('input', (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (!input.classList.contains('jg-filter-input')) return;
    const k = input.dataset.table;
    const col = input.dataset.col;
    let m = filters.get(k);
    if (!m) filters.set(k, (m = new Map()));
    if (input.value.trim()) m.set(col, input.value);
    else m.delete(col);
    const caret = input.selectionStart;
    render();
    const again = scroller.querySelector(`.jg-filter-input[data-table="${CSS.escape(k)}"][data-col="${CSS.escape(col)}"]`);
    if (again) {
      again.focus();
      again.setSelectionRange(caret, caret);
    }
  });

  container.addEventListener('keydown', (e) => {
    if (editing) return;
    const target = /** @type {HTMLElement} */ (e.target);
    if (e.key === 'Escape' && menu) {
      closeMenu();
      return;
    }
    if (target.closest('input, textarea, select')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (e.key === 'Enter' && selectedKey && !target.closest('button')) {
      const cell = findCell(selectedKey);
      if (cell) {
        e.preventDefault();
        startEdit(cell);
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(/** @type {Node} */ (e.target))) closeMenu();
  });

  /** The value cell for a path (keys and values share a path in object tables). */
  function findCell(k) {
    const sel = CSS.escape(k);
    return scroller.querySelector(`.jg-val[data-path="${sel}"], .jg-missing[data-path="${sel}"]`)
      || scroller.querySelector(`[data-path="${sel}"]`);
  }

  function select(k) {
    selectedKey = k;
    for (const n of scroller.querySelectorAll('.is-selected')) n.classList.remove('is-selected');
    const node = k ? findCell(k) : null;
    if (node) node.classList.add('is-selected');
    const path = k ? JSON.parse(k) : [];
    pathLabel.textContent = pathToString(path);
    updateActions();
    if (k) options.onSelect?.(path);
  }

  /** Which row/key actions apply to the current selection. */
  function selectionContext() {
    if (!selectedKey || !hasDoc) return null;
    const path = JSON.parse(selectedKey);
    if (path.length === 0) return null;
    // A cell inside an array row acts on that row.
    for (let i = path.length - 1; i >= 0; i--) {
      if (typeof path[i] === 'number') {
        const rowPath = path.slice(0, i + 1);
        if (i === path.length - 1 || i === path.length - 2) {
          return { kind: 'row', path: rowPath, keyPath: i === path.length - 2 ? path : null };
        }
        break;
      }
    }
    return { kind: 'key', path };
  }

  function updateActions() {
    const ctx = selectionContext();
    const isRow = ctx?.kind === 'row';
    const parentForKey = ctx ? (isRow && ctx.keyPath ? ctx.path : ctx.kind === 'key' ? ctx.path.slice(0, -1) : null) : null;
    insertAboveBtn.disabled = !isRow;
    insertBelowBtn.disabled = !isRow;
    duplicateBtn.disabled = !isRow;
    addKeyBtn.disabled = !(parentForKey && isPlainObject(getAt(root, parentForKey)));
    const deleteTarget = ctx ? (isRow && ctx.keyPath ? ctx.keyPath : ctx.path) : null;
    deleteBtn.disabled = !deleteTarget || getAt(root, deleteTarget) === undefined;
    deleteBtn.textContent = isRow && !ctx.keyPath ? 'Delete row' : 'Delete key';
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
    copyPathBtn.disabled = !selectedKey;
  }

  // ── Editing ──────────────────────────────────────────────

  function commit(next, nextSelection = selectedKey, action = 'edit') {
    undoStack.push(root);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    root = next;
    selectedKey = nextSelection && getAt(root, JSON.parse(nextSelection)) !== undefined ? nextSelection : null;
    searchMatches = [];
    render();
    select(selectedKey);
    options.onChange?.(root);
    track(action);
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(root);
    root = undoStack.pop();
    afterHistoryMove();
    track('undo');
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(root);
    root = redoStack.pop();
    afterHistoryMove();
    track('redo');
  }

  function afterHistoryMove() {
    if (selectedKey && getAt(root, JSON.parse(selectedKey)) === undefined) selectedKey = null;
    searchMatches = [];
    render();
    select(selectedKey);
    options.onChange?.(root);
  }

  /** Open an inline editor in a value cell, a key cell, or a missing ("—") cell. */
  function startEdit(cell) {
    if (editing) editing.finish(true);
    if (!cell.hasAttribute('data-path')) return;
    const path = JSON.parse(cell.getAttribute('data-path'));
    const isKey = cell.classList.contains('jg-key');
    const isMissing = cell.classList.contains('jg-missing');
    if (!isKey && !isMissing && !cell.classList.contains('jg-val')) return;
    const prev = isMissing ? undefined : getAt(root, path);
    const startText = isKey ? String(path[path.length - 1]) : cellText(prev);

    const input = el('textarea', 'jg-editor');
    input.value = startText;
    input.rows = Math.min(8, Math.max(1, startText.split('\n').length));
    input.spellcheck = false;
    input.setAttribute('aria-label', isKey ? 'Edit key' : 'Edit value');
    const saved = Array.from(cell.childNodes);
    cell.textContent = '';
    cell.classList.add('is-editing');
    cell.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      editing = null;
      if (!save || input.value === startText) {
        cell.classList.remove('is-editing');
        cell.textContent = '';
        cell.append(...saved);
        scroller.focus({ preventScroll: true });
        return;
      }
      try {
        if (isKey) {
          const newKey = input.value;
          if (newKey === '') throw new Error('Key cannot be empty');
          const parentPath = path.slice(0, -1);
          commit(renameKey(root, parentPath, path[path.length - 1], newKey), keyOf([...parentPath, newKey]), 'rename_key');
        } else {
          if (isMissing && input.value.trim() === '') {
            finish(false);
            return;
          }
          commit(setAt(root, path, parseCellInput(input.value, prev)), selectedKey, 'edit_cell');
        }
        scroller.focus({ preventScroll: true });
      } catch (err) {
        done = false;
        editing = { finish };
        input.classList.add('is-invalid');
        input.title = err instanceof Error ? err.message : 'Could not save';
        input.setAttribute('aria-invalid', 'true');
        notify(input.title);
        input.focus();
      }
    };
    editing = { finish };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finish(true);
      }
    });
    input.addEventListener('input', () => {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      input.rows = Math.min(8, Math.max(1, input.value.split('\n').length));
    });
    input.addEventListener('blur', () => finish(true));
  }

  function insertRow(offset) {
    const ctx = selectionContext();
    if (ctx?.kind !== 'row') return;
    const index = ctx.path[ctx.path.length - 1] + offset;
    const at = [...ctx.path.slice(0, -1), index];
    commit(insertAt(root, at, blankLike(getAt(root, ctx.path))), keyOf(at), 'insert_row');
  }

  function duplicateRow() {
    const ctx = selectionContext();
    if (ctx?.kind !== 'row') return;
    const index = ctx.path[ctx.path.length - 1] + 1;
    const at = [...ctx.path.slice(0, -1), index];
    const copy = cloneValue(getAt(root, ctx.path));
    commit(insertAt(root, at, copy), keyOf(at), 'duplicate_row');
  }

  function deleteSelected() {
    const ctx = selectionContext();
    if (!ctx) return;
    const target = ctx.kind === 'row' && ctx.keyPath ? ctx.keyPath : ctx.path;
    commit(deleteAt(root, target), null, ctx.kind === 'row' && !ctx.keyPath ? 'delete_row' : 'delete_key');
  }

  function addKey() {
    const ctx = selectionContext();
    if (!ctx) return;
    const parentPath = ctx.kind === 'row' && ctx.keyPath ? ctx.path : ctx.path.slice(0, -1);
    const parent = getAt(root, parentPath);
    if (!isPlainObject(parent)) return;
    let name = 'new_key';
    for (let n = 2; Object.prototype.hasOwnProperty.call(parent, name); n++) name = `new_key_${n}`;
    const keyPath = [...parentPath, name];
    commit(setAt(root, keyPath, null), keyOf(keyPath), 'add_key');
    // Start renaming the new key right away (object tables show keys as row headers).
    const keyCell = scroller.querySelector(`.jg-key[data-path="${CSS.escape(keyOf(keyPath))}"]`);
    if (keyCell) startEdit(keyCell);
  }

  // ── Table menu: filters, columns, flatten, CSV ───────────

  function closeMenu() {
    menu?.remove();
    menu = null;
  }

  function menuItem(label, onClick, { checked } = {}) {
    const b = el('button', 'jg-menu-item');
    b.type = 'button';
    b.setAttribute('role', checked === undefined ? 'menuitem' : 'menuitemcheckbox');
    if (checked !== undefined) b.setAttribute('aria-checked', String(checked));
    b.append(el('span', 'jg-menu-check', checked ? '✓' : ''), el('span', '', label));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function placeMenu(anchor, node) {
    closeMenu();
    menu = node;
    container.appendChild(node);
    const a = anchor.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    node.style.top = `${a.bottom - c.top + 4}px`;
    node.style.left = `${Math.max(0, Math.min(a.left - c.left, c.width - node.offsetWidth - 4))}px`;
    node.querySelector('button, input')?.focus();
  }

  /** Rows and columns a table currently shows (after flatten, sort, filters and hidden columns). */
  function tableView(value, k) {
    const flat = flattened.has(k);
    let rows = value;
    let cols;
    if (classify(value) !== 'arrayOfObjects') {
      cols = null;
    } else if (flat) {
      const f = flattenRows(value);
      rows = f.rows;
      cols = f.columns.map((key) => ({ key, nested: false }));
    } else {
      cols = tableColumns(value);
    }
    const sort = sorts.get(k);
    let order = sort ? sortIndices(rows, cols ? sort.key : null, sort.dir) : rows.map((_, i) => i);
    const f = filters.get(k);
    if (f) for (const [col, q] of f) order = filterIndices(rows, order, col === '' ? null : col, q);
    const hidden = hiddenCols.get(k);
    const shownCols = cols ? cols.filter((c) => !hidden?.has(c.key)) : null;
    return { rows, cols, shownCols, order, flat };
  }

  function openTableMenu(anchor, k) {
    const path = JSON.parse(k);
    const value = getAt(root, path);
    if (!Array.isArray(value)) return;
    const isObjects = classify(value) === 'arrayOfObjects';
    const box = el('div', 'jg-menu');
    box.setAttribute('role', 'menu');
    box.addEventListener('click', (e) => e.stopPropagation());
    box.append(
      menuItem('Filter rows', () => {
        if (filterOpen.has(k)) {
          filterOpen.delete(k);
          filters.delete(k);
        } else {
          filterOpen.add(k);
          track('filter_open');
        }
        closeMenu();
        render();
        scroller.querySelector(`.jg-filter-input[data-table="${CSS.escape(k)}"]`)?.focus();
      }, { checked: filterOpen.has(k) }),
    );
    if (isObjects) {
      box.append(
        menuItem('Choose columns…', () => openColumnChooser(anchor, k)),
        menuItem('Flatten nested columns', () => {
          if (flattened.has(k)) flattened.delete(k);
          else { flattened.add(k); track('flatten'); }
          sorts.delete(k);
          filters.delete(k);
          hiddenCols.delete(k);
          closeMenu();
          render();
        }, { checked: flattened.has(k) }),
      );
    }
    box.append(
      el('hr', 'jg-menu-sep'),
      menuItem('Download as CSV', () => { exportCSV(k, 'download'); closeMenu(); }),
      menuItem('Copy as CSV', () => { exportCSV(k, 'copy'); closeMenu(); }),
      menuItem('Copy as JSON', () => {
        const { rows, order } = tableView(value, k);
        navigator.clipboard?.writeText(JSON.stringify(order.map((i) => (flattened.has(k) ? rows[i] : value[i])), null, 2))
          .then(() => notify('Table copied as JSON'), () => {});
        closeMenu();
      }),
    );
    if (sorts.has(k) || filters.has(k) || hiddenCols.has(k) || flattened.has(k)) {
      box.append(menuItem('Reset table view', () => {
        sorts.delete(k);
        filters.delete(k);
        filterOpen.delete(k);
        hiddenCols.delete(k);
        flattened.delete(k);
        closeMenu();
        render();
      }));
    }
    placeMenu(anchor, box);
  }

  function openColumnChooser(anchor, k) {
    const value = getAt(root, JSON.parse(k));
    const { cols } = tableView(value, k);
    if (!cols) return;
    const hidden = hiddenCols.get(k) || new Set();
    const box = el('div', 'jg-menu jg-columns');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Choose columns');
    box.addEventListener('click', (e) => e.stopPropagation());
    box.appendChild(el('p', 'jg-menu-title', 'Show columns'));
    const list = el('div', 'jg-col-list');
    for (const col of cols) {
      const label = el('label', 'jg-col-option');
      const cb = /** @type {HTMLInputElement} */ (el('input'));
      cb.type = 'checkbox';
      cb.checked = !hidden.has(col.key);
      cb.addEventListener('change', () => {
        if (cb.checked) hidden.delete(col.key);
        else hidden.add(col.key);
        if (hidden.size) hiddenCols.set(k, hidden);
        else hiddenCols.delete(k);
        track('choose_columns');
        render();
      });
      label.append(cb, el('span', '', col.key));
      list.appendChild(label);
    }
    const all = textButton('Show all', 'Show every column', () => {
      hiddenCols.delete(k);
      for (const cb of list.querySelectorAll('input')) cb.checked = true;
      hidden.clear();
      render();
    });
    box.append(list, all);
    placeMenu(anchor, box);
  }

  function exportCSV(k, mode) {
    const path = JSON.parse(k);
    const value = getAt(root, path);
    const { rows, shownCols, order } = tableView(value, k);
    const picked = order.map((i) => rows[i]);
    const csv = toCSV(picked, shownCols ? shownCols.map((c) => c.key) : null);
    if (mode === 'download') {
      const last = path.length ? String(path[path.length - 1]) : 'data';
      const name = last.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'data';
      downloadText(csv, `${name}.csv`, 'text/csv;charset=utf-8');
      notify(`Downloaded ${picked.length} rows as CSV`);
    } else {
      navigator.clipboard?.writeText(csv).then(() => notify(`Copied ${picked.length} rows as CSV`), () => {});
    }
    track(mode === 'download' ? 'csv_download' : 'csv_copy', { rows: picked.length });
  }

  // ── Rendering ────────────────────────────────────────────

  function renderPrimitive(value) {
    if (value === null) return el('span', 'jg-null', 'null');
    if (typeof value === 'string') return el('span', 'jg-string', value === '' ? '""' : value);
    if (typeof value === 'number') return el('span', 'jg-number', String(value));
    if (isRaw(value)) return el('span', 'jg-number', rawText(value));
    if (typeof value === 'boolean') return el('span', 'jg-boolean', String(value));
    if (value === undefined) return el('span', 'jg-missing-text', '—');
    return el('span', '', String(value));
  }

  /** A cell's content: a primitive, or a [+]/[−] toggle with the nested table under it. */
  function renderValue(value, path, label) {
    if (!isContainer(value)) return renderPrimitive(value);
    const k = keyOf(path);
    const open = expanded.has(k);
    const wrap = el('div', 'jg-nested');
    const isArr = Array.isArray(value);
    const size = isArr ? value.length : Object.keys(value).length;
    const btn = el('button', 'jg-toggle');
    btn.type = 'button';
    btn.dataset.toggle = k;
    btn.setAttribute('aria-expanded', String(open));
    btn.append(el('span', 'jg-sign', open ? '−' : '+'), el('span', 'jg-label', `${label}${isArr ? `[${size}]` : ` {${size}}`}`));
    wrap.appendChild(btn);
    if (open) wrap.appendChild(renderTable(value, path));
    return wrap;
  }

  function cell(tag, path, className) {
    const td = el(tag, className);
    td.dataset.path = keyOf(path);
    if (selectedKey === td.dataset.path && className !== 'jg-key') td.classList.add('is-selected');
    return td;
  }

  function tableMenuButton(k) {
    const b = el('button', 'jg-table-menu');
    b.type = 'button';
    b.dataset.tableMenu = k;
    b.title = 'Table options: filter, columns, CSV';
    b.setAttribute('aria-label', 'Table options');
    b.setAttribute('aria-haspopup', 'menu');
    b.appendChild(svgIcon(ICONS.more));
    return b;
  }

  function filterRow(k, cols) {
    const tr = el('tr', 'jg-filter-row');
    tr.appendChild(el('th', 'jg-index'));
    const current = filters.get(k);
    for (const col of cols) {
      const th = el('th');
      const input = /** @type {HTMLInputElement} */ (el('input', 'jg-filter-input'));
      input.type = 'search';
      input.placeholder = 'Filter';
      input.setAttribute('aria-label', col.key === '' ? 'Filter values' : `Filter ${col.key}`);
      input.dataset.table = k;
      input.dataset.col = col.key;
      input.value = current?.get(col.key) || '';
      th.appendChild(input);
      tr.appendChild(th);
    }
    return tr;
  }

  function renderTable(value, path) {
    const kind = classify(value);
    const table = el('table', `jg-table jg-${kind}`);
    table.setAttribute('role', 'grid');
    const tbody = el('tbody');

    if (kind === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return el('span', 'jg-empty', '{} empty object');
      for (const key of keys) {
        const tr = el('tr');
        const th = cell('th', [...path, key], 'jg-key');
        th.textContent = key;
        th.setAttribute('scope', 'row');
        const td = cell('td', [...path, key], 'jg-val');
        td.appendChild(renderValue(value[key], [...path, key], key));
        tr.append(th, td);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      return table;
    }

    if (value.length === 0) return el('span', 'jg-empty', '[] empty array');
    const k = keyOf(path);
    const limit = Math.max(visibleRows.get(k) || PAGE_SIZE, searchRows.get(k) || 0);
    const view = tableView(value, k);
    const { order } = view;
    const thead = el('thead');
    const hr = el('tr');
    const corner = el('th', 'jg-index jg-corner');
    corner.append(tableMenuButton(k));
    hr.appendChild(corner);

    if (kind === 'arrayOfObjects') {
      const sort = sorts.get(k);
      const cols = view.shownCols;
      for (const col of cols) {
        const th = el('th', 'jg-col');
        th.setAttribute('scope', 'col');
        const b = el('button', 'jg-sort');
        b.type = 'button';
        b.dataset.sort = k;
        b.dataset.col = col.key;
        b.title = 'Sort by this column';
        b.textContent = col.key;
        const dir = sort && sort.key === col.key ? sort.dir : null;
        th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none');
        if (dir) b.appendChild(el('span', 'jg-sort-dir', dir === 'asc' ? ' ▲' : ' ▼'));
        th.appendChild(b);
        hr.appendChild(th);
      }
      thead.appendChild(hr);
      if (filterOpen.has(k)) thead.appendChild(filterRow(k, cols));
      table.appendChild(thead);
      for (const i of order.slice(0, limit)) {
        const tr = el('tr');
        const idx = cell('th', [...path, i], 'jg-index');
        idx.textContent = String(i);
        idx.title = 'Select row';
        idx.setAttribute('scope', 'row');
        tr.appendChild(idx);
        if (view.flat) {
          // Flattened rows are a read-only view; edit in the normal view.
          for (const col of cols) {
            const td = el('td', 'jg-flat');
            td.appendChild(renderPrimitive(view.rows[i][col.key]));
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
          continue;
        }
        const row = value[i];
        for (const col of cols) {
          const cp = [...path, i, col.key];
          if (!Object.prototype.hasOwnProperty.call(row, col.key)) {
            const td = cell('td', cp, 'jg-missing');
            td.textContent = '—';
            td.title = 'Key not in this row. Double-click to add it.';
            tr.appendChild(td);
            continue;
          }
          const td = cell('td', cp, 'jg-val');
          td.appendChild(renderValue(row[col.key], cp, col.key));
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      appendFooter(tbody, k, value.length, order.length, limit, cols.length + 1, view.flat);
      table.appendChild(tbody);
      return table;
    }

    // Arrays of primitives and mixed arrays: index | value
    const vh = el('th', 'jg-col');
    const sort = sorts.get(k);
    const b = el('button', 'jg-sort');
    b.type = 'button';
    b.dataset.sort = k;
    b.dataset.col = '';
    b.title = 'Sort values';
    b.textContent = 'value';
    if (sort) b.appendChild(el('span', 'jg-sort-dir', sort.dir === 'asc' ? ' ▲' : ' ▼'));
    vh.appendChild(b);
    hr.appendChild(vh);
    thead.appendChild(hr);
    if (filterOpen.has(k)) thead.appendChild(filterRow(k, [{ key: '' }]));
    table.appendChild(thead);
    for (const i of order.slice(0, limit)) {
      const tr = el('tr');
      const idx = cell('th', [...path, i], 'jg-index');
      idx.textContent = String(i);
      idx.title = 'Select item';
      idx.setAttribute('scope', 'row');
      const td = cell('td', [...path, i], 'jg-val');
      td.appendChild(renderValue(value[i], [...path, i], String(i)));
      tr.append(idx, td);
      tbody.appendChild(tr);
    }
    appendFooter(tbody, k, value.length, order.length, limit, 2, false);
    table.appendChild(tbody);
    return table;
  }

  function appendFooter(tbody, k, total, shown, limit, colspan, flat) {
    const notes = [];
    if (shown < total) notes.push(`${shown} of ${total} rows match the filter`);
    if (flat) notes.push('Flattened view is read-only');
    if (shown <= limit && !notes.length) return;
    const tr = el('tr', 'jg-more-row');
    const td = el('td');
    td.colSpan = colspan;
    if (notes.length) td.appendChild(el('span', 'jg-footnote', notes.join(' · ')));
    if (shown > limit) {
      const b = el('button', 'jg-more', `Show ${Math.min(PAGE_SIZE, shown - limit)} more (${shown - limit} hidden)`);
      b.type = 'button';
      b.dataset.more = k;
      td.appendChild(b);
    }
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function render() {
    const top = scroller.scrollTop;
    const left = scroller.scrollLeft;
    closeMenu();
    scroller.textContent = '';
    if (hasDoc) {
      scroller.appendChild(isContainer(root) ? renderTable(root, []) : renderPrimitive(root));
      scroller.scrollTop = top;
      scroller.scrollLeft = left;
      paintSearch();
    }
    updateActions();
  }

  function expandAll() {
    if (!hasDoc) return;
    let budget = EXPAND_ALL_MAX_NODES;
    const walk = (v, path, depth) => {
      if (!isContainer(v) || budget <= 0 || depth > EXPAND_ALL_MAX_DEPTH) return;
      if (path.length) { expanded.add(keyOf(path)); budget--; }
      const keys = Array.isArray(v) ? v.slice(0, PAGE_SIZE).map((_, i) => i) : Object.keys(v);
      for (const key of keys) walk(v[key], [...path, key], depth + 1);
    };
    walk(root, [], 0);
    render();
    track('expand_all');
  }

  function collapseAll() {
    expanded.clear();
    render();
  }

  // ── Search ───────────────────────────────────────────────

  /** Find values (and object keys) containing `query`, open their parents, and mark them. */
  function search(query) {
    searchMatches = [];
    searchActive = -1;
    const hadSearchRows = searchRows.size > 0;
    searchRows.clear();
    const q = String(query || '').toLowerCase();
    if (!hasDoc || !q) {
      if (hadSearchRows) render();
      else paintSearch();
      return 0;
    }
    const open = new Set();
    const walk = (v, path, asRow) => {
      if (searchMatches.length >= SEARCH_MAX_MATCHES) return;
      if (!isContainer(v)) {
        if (cellText(v).toLowerCase().includes(q)) {
          searchMatches.push({ k: keyOf(path), isKey: false });
          for (let i = 1; i < path.length; i++) open.add(keyOf(path.slice(0, i)));
        }
        return;
      }
      const rowsOfObjects = Array.isArray(v) && classify(v) === 'arrayOfObjects';
      const keys = Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v);
      for (const key of keys) {
        const childPath = [...path, key];
        if (!Array.isArray(v) && !asRow && String(key).toLowerCase().includes(q)) {
          searchMatches.push({ k: keyOf(childPath), isKey: true });
          for (let i = 1; i < childPath.length; i++) open.add(keyOf(childPath.slice(0, i)));
        }
        walk(v[key], childPath, rowsOfObjects);
        if (searchMatches.length >= SEARCH_MAX_MATCHES) return;
      }
    };
    walk(root, [], false);
    for (const k of open) {
      const v = getAt(root, JSON.parse(k));
      if (isContainer(v)) expanded.add(k);
    }
    // Make sure matches deep in long arrays are on screen.
    for (const m of searchMatches) {
      const p = JSON.parse(m.k);
      for (let i = 0; i < p.length; i++) {
        if (typeof p[i] !== 'number') continue;
        const arrKey = keyOf(p.slice(0, i));
        const need = Math.ceil((p[i] + 1) / PAGE_SIZE) * PAGE_SIZE;
        if (need > PAGE_SIZE && (searchRows.get(arrKey) || 0) < need) searchRows.set(arrKey, Math.min(need, 2000));
      }
    }
    render();
    return searchMatches.length;
  }

  function matchNode(m) {
    const sel = CSS.escape(m.k);
    return m.isKey ? scroller.querySelector(`.jg-key[data-path="${sel}"]`) : scroller.querySelector(`.jg-val[data-path="${sel}"]`);
  }

  function paintSearch() {
    for (const n of scroller.querySelectorAll('.jg-search-match, .jg-search-active')) n.classList.remove('jg-search-match', 'jg-search-active');
    searchMatches.forEach((m, i) => {
      const node = matchNode(m);
      if (!node) return;
      node.classList.add('jg-search-match');
      if (i === searchActive) node.classList.add('jg-search-active');
    });
  }

  function gotoMatch(i) {
    if (!searchMatches[i]) return;
    searchActive = i;
    paintSearch();
    const node = matchNode(searchMatches[i]);
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function showMessage(text) {
    hasDoc = false;
    undoStack = [];
    redoStack = [];
    selectedKey = null;
    searchMatches = [];
    pathLabel.textContent = '$';
    closeMenu();
    scroller.textContent = '';
    scroller.appendChild(el('p', 'json-grid-message', text));
    updateActions();
  }

  updateActions();

  return {
    /**
     * Show a parsed JSON value that came from outside the grid (Format, Minify,
     * typing in the code view). Clears undo history; expansion carries over by path.
     */
    setData(value) {
      if (editing) editing.finish(false);
      root = value;
      hasDoc = true;
      undoStack = [];
      redoStack = [];
      searchMatches = [];
      if (selectedKey && getAt(root, JSON.parse(selectedKey)) === undefined) selectedKey = null;
      render();
      select(selectedKey);
    },
    /** Select a path (e.g. from a query result) and scroll to it. */
    reveal(path) {
      for (let i = 1; i < path.length; i++) {
        const k = keyOf(path.slice(0, i));
        if (isContainer(getAt(root, path.slice(0, i)))) expanded.add(k);
        if (typeof path[i] === 'number') {
          const need = Math.ceil((path[i] + 1) / PAGE_SIZE) * PAGE_SIZE;
          if ((visibleRows.get(k) || PAGE_SIZE) < need) visibleRows.set(k, need);
        }
      }
      render();
      select(keyOf(path));
      findCell(keyOf(path))?.scrollIntoView({ block: 'center', inline: 'nearest' });
    },
    showMessage,
    getSelectedPath() {
      return selectedKey ? JSON.parse(selectedKey) : null;
    },
    search,
    gotoMatch,
    expandAll,
    collapseAll,
  };
}
