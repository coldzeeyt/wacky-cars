/* editor.js — the Creator's building dock: palette + the track being edited.
 * Works on a "current track" (name + pieces + optional id from the store).
 */
window.HC = window.HC || {};
HC.editor = (function () {
  let pieces = [];
  let meta = { id: null, name: 'Untitled' };
  let hooks = {};
  const $ = (id) => document.getElementById(id);

  function previewSVG(key) {
    if (key === 'bridge') {
      return `<svg viewBox="0 0 52 34" aria-hidden="true">
        <line x1="4" y1="16" x2="48" y2="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="13" y1="17" x2="13" y2="27" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
        <line x1="26" y1="17" x2="26" y2="27" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
        <line x1="39" y1="17" x2="39" y2="27" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
      </svg>`;
    }
    if (key === 'key') {
      return `<svg viewBox="0 0 52 34" aria-hidden="true">
        <circle cx="15" cy="17" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/>
        <circle cx="15" cy="17" r="2.2" fill="currentColor"/>
        <line x1="21" y1="17" x2="40" y2="17" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <line x1="32" y1="17" x2="32" y2="23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <line x1="40" y1="17" x2="40" y2="23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
    }
    if (key === 'lock') {
      return `<svg viewBox="0 0 52 34" aria-hidden="true">
        <line x1="14" y1="10" x2="14" y2="28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="38" y1="10" x2="38" y2="28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="14" y1="14" x2="38" y2="14" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
        <rect x="21" y="16" width="10" height="9" rx="2" fill="currentColor"/>
      </svg>`;
    }
    if (key === 'speed') {
      return `<svg viewBox="0 0 52 34" aria-hidden="true">
        <line x1="4" y1="26" x2="48" y2="26" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <polyline points="14,10 22,17 14,24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="27,10 35,17 27,24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
    if (key === 'teleportIn' || key === 'teleportOut') {
      return `<svg viewBox="0 0 52 34" aria-hidden="true">
        <ellipse cx="26" cy="17" rx="10" ry="14" fill="none" stroke="currentColor" stroke-width="2.5"/>
        <ellipse cx="26" cy="17" rx="5" ry="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
      </svg>`;
    }
    const pts = HC.pieces.defs[key].build();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs);
    const miny = Math.min(...ys), maxy = Math.max(...ys);
    const w = Math.max(1, maxx - minx), h = Math.max(1, maxy - miny);
    const pad = 6, vw = 52, vh = 34;
    const scale = Math.min((vw - pad * 2) / w, (vh - pad * 2) / (h || 1));
    const ox = (vw - w * scale) / 2 - minx * scale;
    const oy = (vh - h * scale) / 2 - miny * scale;
    const d = pts.map(p => `${(p[0] * scale + ox).toFixed(1)},${(p[1] * scale + oy).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${vw} ${vh}" aria-hidden="true"><polyline points="${d}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function change() { hooks.onChange && hooks.onChange(pieces.slice()); renderCount(); }
  function renderCount() {
    const el = $('piece-count');
    if (!el) return;
    el.textContent = pieces.length
      ? `${pieces.length} piece${pieces.length > 1 ? 's' : ''} · ${HC.pieces.lengthCategory(pieces.length)}`
      : 'empty track';
  }

  function buildPalette(container) {
    container.innerHTML = '';
    for (const key of HC.pieces.order) {
      const btn = document.createElement('button');
      btn.className = 'piece'; btn.type = 'button';
      btn.innerHTML = previewSVG(key) + `<span>${HC.pieces.defs[key].label}</span>`;
      btn.addEventListener('click', () => { pieces.push(key); change(); });
      container.appendChild(btn);
    }
  }

  function init(opts) {
    hooks = opts || {};
    buildPalette($('palette'));
    $('btn-undo').addEventListener('click', () => { if (pieces.length) { pieces.pop(); change(); } });
    $('btn-clear').addEventListener('click', () => { if (pieces.length && confirm('Clear the whole track?')) { pieces = []; change(); } });
    $('btn-drive').addEventListener('click', () => hooks.onPlay && hooks.onPlay());
    $('btn-save').addEventListener('click', save);
    $('btn-export').addEventListener('click', exportJSON);
    $('btn-import').addEventListener('click', importJSON);
    const name = $('track-name');
    if (name) name.addEventListener('input', () => { meta.name = name.value; });
  }

  // entry = {id,name,pieces} to edit, or null for a fresh track.
  function load(entry) {
    if (entry) {
      meta = { id: entry.id || null, name: entry.name || 'Untitled' };
      pieces = (entry.pieces || []).filter(k => HC.pieces.defs[k]);
    } else {
      meta = { id: null, name: 'Untitled' };
      pieces = [];
    }
    const name = $('track-name');
    if (name) name.value = meta.name;
    change();
  }

  function getPieces() { return pieces.slice(); }

  // Saves to the store (auto-assigns a permanent seq number for new tracks)
  // and keeps meta in sync. Used by both the Save button and Export, so
  // export always has a real track behind its WackyCars_n filename.
  function persist() {
    const name = $('track-name');
    meta.name = ((name && name.value) || meta.name || 'Untitled').trim() || 'Untitled';
    const rec = HC.store.save({ id: meta.id, name: meta.name, pieces });
    meta.id = rec.id;
    meta.seq = rec.seq;
    return rec;
  }
  function save() {
    const rec = persist();
    flash('Saved “' + rec.name + '”');
    hooks.onSaved && hooks.onSaved(rec);
  }

  function flash(msg) {
    const el = $('save-flash');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(flash._t); flash._t = setTimeout(() => el.classList.remove('show'), 1600);
  }

  function sanitizeFilename(name) {
    return (name || 'Untitled').trim().replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_') || 'Untitled';
  }
  function exportJSON() {
    const rec = persist(); // makes sure this track is actually saved
    const blob = new Blob([JSON.stringify({ name: rec.name, pieces: rec.pieces })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const filename = `WackyCars_${sanitizeFilename(rec.name)}`;
    a.download = filename + '.json';
    a.click(); URL.revokeObjectURL(a.href);
    flash('Exported as ' + filename);
  }
  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          const arr = Array.isArray(data) ? data : data.pieces;
          if (Array.isArray(arr)) {
            pieces = arr.filter(k => HC.pieces.defs[k]);
            if (data.name) { meta.name = data.name; const n = $('track-name'); if (n) n.value = data.name; }
            change();
          }
        } catch (e) { alert('That file was not a valid track.'); }
      };
      r.readAsText(file);
    };
    input.click();
  }

  return { init, load, getPieces, getMeta: () => ({ id: meta.id, name: meta.name }) };
})();
