// App entry — wires together UI, snippet rendering, search, and the builder.

import { universal } from './cheats/universal.js';
import { games } from './cheats/games.js';
import { buildConsoleSnippet, buildBookmarklet, buildUserscript } from './generator.js';
import { bootPlay } from './play.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// -------------------- Toast --------------------
const toastEl = $('#toast');
let toastTimer = null;
function toast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

async function copyText(s) {
  try {
    await navigator.clipboard.writeText(s);
    toast('Copied to clipboard');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = s;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Copied');
  }
}

// -------------------- Universal snippets --------------------
function renderUniversal() {
  const grid = $('#universalGrid');
  grid.innerHTML = universal.map(s => `
    <article class="snippet-card">
      <div>
        <h3>${escapeHtml(s.title)}</h3>
      </div>
      <p class="desc">${escapeHtml(s.desc)}</p>
      <pre><code>${escapeHtml(s.code)}</code></pre>
      <div class="snippet-actions">
        <button class="btn btn-primary" data-action="copy" data-id="${s.id}">Copy snippet</button>
        <button class="btn btn-ghost" data-action="bookmark" data-id="${s.id}">As bookmarklet</button>
      </div>
    </article>
  `).join('');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const s = universal.find(x => x.id === btn.dataset.id);
    if (!s) return;
    if (btn.dataset.action === 'copy') copyText(s.code);
    if (btn.dataset.action === 'bookmark') {
      const url = 'javascript:' + encodeURIComponent(`(function(){${s.code}})()`).replace(/'/g, '%27');
      copyText(url);
      toast('Bookmarklet URL copied');
    }
  });
}

// -------------------- Games --------------------
const state = {
  search: '',
  tag: 'all',
};

function uniqueTags() {
  const all = new Set(['all']);
  for (const g of games) for (const t of g.tags || []) all.add(t);
  return Array.from(all);
}

function renderTags() {
  const row = $('#tagRow');
  row.innerHTML = uniqueTags().map(t => `
    <button class="tag-chip ${t === state.tag ? 'active' : ''}" data-tag="${t}" role="tab">${t}</button>
  `).join('');
  row.addEventListener('click', (e) => {
    const chip = e.target.closest('.tag-chip');
    if (!chip) return;
    state.tag = chip.dataset.tag;
    $$('.tag-chip', row).forEach(c => c.classList.toggle('active', c.dataset.tag === state.tag));
    renderGames();
  });
}

function filteredGames() {
  const q = state.search.trim().toLowerCase();
  return games.filter(g => {
    if (state.tag !== 'all' && !g.tags.includes(state.tag)) return false;
    if (!q) return true;
    return g.name.toLowerCase().includes(q)
      || g.slug.toLowerCase().includes(q)
      || (g.publisher || '').toLowerCase().includes(q)
      || (g.engine || '').toLowerCase().includes(q);
  });
}

function renderGames() {
  const grid = $('#gameGrid');
  const noRes = $('#noResults');
  const list = filteredGames();
  noRes.hidden = list.length > 0;

  grid.innerHTML = list.map(g => `
    <article class="game-card" data-slug="${g.slug}">
      <div class="game-head">
        <div>
          <h3>${escapeHtml(g.name)}</h3>
          <div class="game-meta">${escapeHtml(g.publisher || '')} · ${escapeHtml(g.engine || 'HTML5')}</div>
        </div>
        <div class="game-tags">${(g.tags || []).map(t => `<span class="game-tag">${t}</span>`).join('')}</div>
      </div>
      <ul class="features">${(g.features || []).map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
      <div class="game-actions">
        <button class="btn btn-primary" data-action="view" data-slug="${g.slug}">View ${g.snippets.length} snippet${g.snippets.length === 1 ? '' : 's'}</button>
        <a class="btn btn-ghost" href="https://poki.com/en/g/${g.slug}" target="_blank" rel="noopener">Open game ↗</a>
      </div>
    </article>
  `).join('');

  grid.addEventListener('click', onGameClick, { once: true });
}

function onGameClick(e) {
  const btn = e.target.closest('button[data-action="view"]');
  if (!btn) return renderGames();
  const slug = btn.dataset.slug;
  const game = games.find(g => g.slug === slug);
  if (!game) return renderGames();
  openGameSheet(game);
}

function openGameSheet(game) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet-overlay';
  sheet.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(game.name)} cheats">
      <header class="sheet-head">
        <div>
          <h2>${escapeHtml(game.name)}</h2>
          <p class="game-meta">${escapeHtml(game.publisher || '')} · ${escapeHtml(game.engine || '')}</p>
        </div>
        <button class="sheet-close" aria-label="Close">×</button>
      </header>
      <div class="sheet-body">
        ${game.snippets.map(s => `
          <article class="snippet-card">
            <h3>${escapeHtml(s.title)}</h3>
            <p class="desc">${escapeHtml(s.desc)}</p>
            <pre><code>${escapeHtml(s.code)}</code></pre>
            <div class="snippet-actions">
              <button class="btn btn-primary" data-action="copy" data-id="${s.id}">Copy</button>
              <button class="btn btn-ghost" data-action="bookmark" data-id="${s.id}">As bookmarklet</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(sheet);
  document.body.style.overflow = 'hidden';

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.closest('.sheet-close')) {
      sheet.remove();
      document.body.style.overflow = '';
      renderGames();
      return;
    }
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const s = game.snippets.find(x => x.id === btn.dataset.id);
    if (!s) return;
    if (btn.dataset.action === 'copy') copyText(s.code);
    if (btn.dataset.action === 'bookmark') {
      const url = 'javascript:' + encodeURIComponent(`(function(){${s.code}})()`).replace(/'/g, '%27');
      copyText(url);
      toast('Bookmarklet URL copied');
    }
  });
  // ESC close
  const onKey = (e) => { if (e.key === 'Escape') { sheet.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); renderGames(); } };
  document.addEventListener('keydown', onKey);
}

// Search wiring
function bindSearch() {
  $('#gameSearch').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderGames();
  });
}

// -------------------- Builder --------------------
const builderState = {
  mode: 'console',
  opts: {},
};

function readBuilderForm() {
  const form = $('#builderForm');
  const opts = {};
  $$('input[type="checkbox"]', form).forEach(cb => {
    opts[cb.dataset.key] = cb.checked;
  });
  $$('input[type="number"]', form).forEach(inp => {
    opts[inp.dataset.input] = inp.value;
  });
  return opts;
}

function renderBuilder() {
  const opts = readBuilderForm();
  builderState.opts = opts;
  const out = $('#builderOutput');
  const drag = $('#dragBookmark');
  if (builderState.mode === 'console') {
    out.textContent = buildConsoleSnippet(opts);
    drag.hidden = true;
  } else if (builderState.mode === 'bookmark') {
    const url = buildBookmarklet(opts);
    out.textContent = url;
    drag.hidden = false;
    drag.href = url;
    drag.textContent = '↗ drag this to your bookmarks bar';
  } else if (builderState.mode === 'userscript') {
    out.textContent = buildUserscript(opts);
    drag.hidden = true;
  }
}

function bindBuilder() {
  $('#builderForm').addEventListener('change', renderBuilder);
  $('#builderForm').addEventListener('input', renderBuilder);
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      builderState.mode = tab.dataset.tab;
      renderBuilder();
    });
  });
  $('#copyBtn').addEventListener('click', () => copyText($('#builderOutput').textContent));
  $('#downloadBtn').addEventListener('click', () => {
    const opts = readBuilderForm();
    const script = buildUserscript(opts);
    const blob = new Blob([script], { type: 'application/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'poki-cheat-hub.user.js';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  });
}

// -------------------- Footer / misc --------------------
function setUpdatedStamp() {
  // Pure client — show build date based on document.lastModified.
  try {
    const d = new Date(document.lastModified);
    if (!isNaN(d.getTime())) {
      $('#updatedStamp').textContent = 'updated ' + d.toISOString().slice(0, 10);
    }
  } catch {}
}

function injectSheetStyles() {
  // Sheet styles inlined to keep CSS file lean.
  const css = `
.sheet-overlay {
  position: fixed; inset: 0; background: oklch(0% 0 0 / 0.6);
  z-index: 100; display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: fade 200ms cubic-bezier(0.2,0.7,0.2,1);
}
.sheet {
  background: var(--bg-elev); border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg); max-width: 720px; width: 100%;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: var(--shadow-2);
}
.sheet-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 22px 26px;
  border-bottom: 1px solid var(--border);
}
.sheet-head h2 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
.sheet-head .game-meta { margin: 4px 0 0; color: var(--fg-dim); font-size: 12px; }
.sheet-close {
  background: transparent; border: 0; color: var(--fg-muted);
  font-size: 28px; line-height: 1; cursor: pointer; padding: 0 6px;
}
.sheet-close:hover { color: var(--fg); }
.sheet-body {
  padding: 22px 26px; overflow: auto;
  display: grid; gap: 16px;
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// -------------------- Utilities --------------------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -------------------- Boot --------------------
function boot() {
  injectSheetStyles();
  renderUniversal();
  renderTags();
  renderGames();
  bindSearch();
  bindBuilder();
  renderBuilder();
  bootPlay();
  setUpdatedStamp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
