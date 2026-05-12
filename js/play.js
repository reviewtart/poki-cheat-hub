// Play & cheat — embed a Poki game in an iframe and run cheat snippets
// against the inner game frame. Cross-origin? we fall back to copy-to-clipboard.

import { games } from './cheats/games.js';
import { universal } from './cheats/universal.js';

const $ = (s, r = document) => r.querySelector(s);

const state = {
  proxyBase: null,        // e.g. "https://poki-proxy.workers.dev"
  currentSlug: null,
};

// Read optional proxy from query string: ?proxy=https://poki-proxy.workers.dev
function readProxy() {
  const u = new URL(location.href);
  const p = u.searchParams.get('proxy');
  if (p) {
    state.proxyBase = p.replace(/\/$/, '');
    return state.proxyBase;
  }
  // If served from a workers.dev host, assume it's already the proxy.
  if (/\.workers\.dev$/i.test(location.hostname)) {
    state.proxyBase = location.origin;
    return state.proxyBase;
  }
  return null;
}

function gameUrlFor(slug) {
  if (state.proxyBase) return `${state.proxyBase}/en/g/${slug}`;
  return `https://poki.com/en/g/${slug}`;
}

// Recursively walk all frames in the iframe tree. Returns array of Window refs
// that we can talk to.
function walkFrames(rootWin) {
  const out = [];
  const visit = (w) => {
    out.push(w);
    let kids;
    try { kids = Array.from(w.frames || []); } catch { return; }
    kids.forEach(visit);
  };
  visit(rootWin);
  return out;
}

// Try to detect whether the inner frame is same-origin (we can eval into it).
function detectAccess(iframe) {
  try {
    const w = iframe.contentWindow;
    // Trigger DOMException if cross-origin.
    void w.location.href;
    return 'same-origin';
  } catch (e) {
    return 'cross-origin';
  }
}

// Inject a snippet into every accessible frame. Returns count of frames touched.
function inject(iframe, snippet) {
  const wins = [];
  try { walkFrames(iframe.contentWindow).forEach(w => wins.push(w)); }
  catch { return 0; }
  let count = 0;
  for (const w of wins) {
    try {
      w.eval(snippet);
      count++;
    } catch (e) {
      // cross-origin frame — skip
    }
  }
  return count;
}

function fmtButton(snippet) {
  return `
    <button data-id="${snippet.id}">
      <span class="pb-title">${escape(snippet.title)}</span>
      <span class="pb-desc">${escape(snippet.desc)}</span>
    </button>
  `;
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderGameSelect() {
  const sel = $('#playGameSel');
  sel.innerHTML = games.map(g =>
    `<option value="${g.slug}">${escape(g.name)}</option>`
  ).join('');
  sel.addEventListener('change', () => loadGame(sel.value));
}

function renderButtons(slug) {
  const game = games.find(g => g.slug === slug);
  const wrap = $('#playButtons');
  if (!game) { wrap.innerHTML = ''; return; }
  const universalGroup = universal
    .filter(s => !['kill-display-ads'].includes(s.id))  // parent-only
    .map(fmtButton).join('');
  const specific = game.snippets.map(fmtButton).join('');
  wrap.innerHTML = `
    <div class="pb-group-label">Universal</div>
    ${universalGroup}
    <div class="pb-group-label">${escape(game.name)}</div>
    ${specific}
  `;
  wrap.addEventListener('click', onButtonClick, { once: true });
}

let toast;
function ensureToast() {
  if (!toast) toast = document.getElementById('toast');
}
function showToast(msg) {
  ensureToast();
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 1800);
}

function onButtonClick(e) {
  const btn = e.target.closest('button[data-id]');
  if (!btn) { renderButtons(state.currentSlug); return; }
  const game = games.find(g => g.slug === state.currentSlug);
  const all = [...universal, ...(game?.snippets || [])];
  const snippet = all.find(s => s.id === btn.dataset.id);
  if (!snippet) { renderButtons(state.currentSlug); return; }

  const frame = $('#playFrame');
  const mode = detectAccess(frame);

  if (mode === 'same-origin') {
    const n = inject(frame, snippet.code);
    btn.classList.add('success');
    setTimeout(() => btn.classList.remove('success'), 700);
    showToast(`Injected into ${n} frame${n === 1 ? '' : 's'}`);
  } else {
    navigator.clipboard.writeText(snippet.code).catch(() => {});
    btn.classList.add('success');
    setTimeout(() => btn.classList.remove('success'), 700);
    showToast('Cross-origin: snippet copied — paste into game frame DevTools');
  }
  renderButtons(state.currentSlug);  // rebind listener
}

function setStatus(mode, text) {
  const s = $('#playStatus');
  s.dataset.mode = mode;
  s.querySelector('.status-text').textContent = text;
}

function pollStatus() {
  const frame = $('#playFrame');
  if (!frame.src) {
    setStatus('', 'no game loaded');
    return;
  }
  const mode = detectAccess(frame);
  if (mode === 'same-origin') {
    // Try to count accessible frames
    let nFrames = 0;
    let hasGame = false;
    let hasPokiSDK = false;
    try {
      const wins = walkFrames(frame.contentWindow);
      nFrames = wins.length;
      hasGame = wins.some(w => { try { return typeof w.game === 'object' && w.game; } catch { return false; } });
      hasPokiSDK = wins.some(w => { try { return typeof w.PokiSDK === 'object'; } catch { return false; } });
    } catch {}
    const tags = [];
    if (hasGame) tags.push('window.game ✓');
    if (hasPokiSDK) tags.push('PokiSDK ✓');
    setStatus('same-origin', `same-origin · ${nFrames} frame${nFrames === 1 ? '' : 's'}${tags.length ? ' · ' + tags.join(' · ') : ''}`);
  } else {
    setStatus('cross-origin', state.proxyBase ? 'cross-origin · proxy active but inner frame still cross' : 'cross-origin · serve via worker proxy for full access');
  }
}

function loadGame(slug) {
  state.currentSlug = slug;
  const frame = $('#playFrame');
  frame.src = gameUrlFor(slug);
  renderButtons(slug);
  setStatus('', 'loading…');
  $('#playOverlay').hidden = true;
}

function bindAdvanced() {
  $('#reloadFrame').addEventListener('click', () => {
    const frame = $('#playFrame');
    frame.src = frame.src;
  });
  $('#popoutFrame').addEventListener('click', () => {
    if (state.currentSlug) window.open(gameUrlFor(state.currentSlug), '_blank', 'noopener');
  });
  $('#inspectFrame').addEventListener('click', () => {
    const frame = $('#playFrame');
    const mode = detectAccess(frame);
    if (mode !== 'same-origin') {
      showToast('cross-origin — can\'t probe');
      return;
    }
    const wins = walkFrames(frame.contentWindow);
    const report = wins.map((w, i) => {
      try {
        return {
          i,
          url: w.location.href.slice(0, 100),
          game: typeof w.game === 'object',
          sdk: typeof w.PokiSDK === 'object',
        };
      } catch {
        return { i, error: 'cross-origin' };
      }
    });
    console.table(report);
    showToast(`Probed ${wins.length} frames — see console`);
  });
}

export function bootPlay() {
  readProxy();
  renderGameSelect();
  bindAdvanced();
  const initial = games[0].slug;
  $('#playGameSel').value = initial;
  loadGame(initial);

  // periodic status poll
  setInterval(pollStatus, 2000);

  // also listen to iframe load events
  $('#playFrame').addEventListener('load', () => setTimeout(pollStatus, 500));
}
