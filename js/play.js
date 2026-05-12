// Play & cheat — embed a Poki game in an iframe and run cheat snippets
// against the inner game frame. Cross-origin? we fall back to copy-to-clipboard.

import { games as pokiGames } from './cheats/games.js';
import { universal } from './cheats/universal.js';
import { libraryGames } from './cheats/library-games.js';
import { buildMenuPayload } from './cheats/in-game-menu.js';

// Merge: library-games (551 mirrored, playable) + handcrafted poki entries (with cheats).
// Hand-crafted entries take precedence when slug matches.
const handcraftedSlugs = new Set(pokiGames.map(g => g.slug));
const games = [
  ...pokiGames,
  ...libraryGames
    .filter(lg => !handcraftedSlugs.has(lg.slug))
    .map(lg => ({
      slug: lg.slug,
      name: lg.name,
      publisher: 'Library mirror',
      engine: 'HTML5',
      libraryId: lg.libraryId,
      image: lg.image,
      tags: ['library'],
      features: ['Playable via worker mirror', 'Universal Poki snippets if game uses PokiSDK'],
      snippets: [],
    })),
];

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
  const game = games.find(g => g.slug === slug);
  if (state.proxyBase) {
    // Priority 1: library mirror (freebuisness/html via raw github)
    // — fully stripped of Poki SDK + sitelock, simplest to iframe.
    if (game?.libraryId) {
      return `${state.proxyBase}/play/${game.libraryId}`;
    }
    // Priority 2: direct gdn URL (real Poki game files, bypassing Poki React)
    if (game?.gdnId && game?.gdnBuild) {
      return `${state.proxyBase}/_gdn/${game.gdnId}/${game.gdnBuild}/index.html`;
    }
    // Priority 3: poki.com proxy (usually fails React rendering)
    return `${state.proxyBase}/en/g/${slug}`;
  }
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
    `<option value="${g.slug}">${escape(g.name)}${g.proxyBlocked || g.unavailable ? ' (proxy-blocked)' : ''}</option>`
  ).join('');
  sel.addEventListener('change', () => loadGame(sel.value));
}

function showMovedBanner(game) {
  const overlay = $('#playOverlay');
  const msg = $('#overlayMsg');
  overlay.hidden = false;
  const altLink = game.alternativeUrl
    ? `<a href="${game.alternativeUrl}" target="_blank" rel="noopener">Open ${escape(game.name)} on poki.com ↗</a>`
    : '';
  msg.innerHTML = `
    <strong>${escape(game.name)}</strong> — proxy mode blocked
    <br>${escape(game.proxyBlocked || game.unavailable || 'SDK refuses to start through this proxy.')}
    ${altLink ? `<br><br>${altLink}` : ''}
    <br><br>
    <em style="color: var(--fg-dim); font-style: normal;">How to cheat anyway:</em><br>
    1. Click the link above to open the game directly on poki.com<br>
    2. Hit a "Copy snippet" button in the Universal / Games section<br>
    3. In the game tab, open DevTools (F12), pick the <code>gdn.poki.com</code> frame<br>
    4. Paste, Enter — cheats injected
    <br><br>
    <a href="https://poki.com/en/popular" target="_blank" rel="noopener">Browse all Poki games →</a>
  `;
}

async function checkMovedAfterLoad() {
  // After iframe loads, peek inside (same-origin via proxy) and check for the
  // "Sorry has moved" marker. If present, show the overlay.
  await new Promise(r => setTimeout(r, 5000));
  const frame = $('#playFrame');
  try {
    const wins = walkFrames(frame.contentWindow);
    for (const w of wins) {
      try {
        const text = w.document.body?.innerText || '';
        if (/has moved|click here for.*to play/i.test(text)) {
          const game = games.find(g => g.slug === state.currentSlug);
          if (game) showMovedBanner(game);
          return;
        }
      } catch {}
    }
  } catch {}
  $('#playOverlay').hidden = true;
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
  const game = games.find(g => g.slug === slug);
  const frame = $('#playFrame');
  frame.src = gameUrlFor(slug);
  renderButtons(slug);
  setStatus('', 'loading…');
  $('#playOverlay').hidden = true;

  if (game?.proxyBlocked || game?.unavailable) {
    showMovedBanner(game);
  } else {
    checkMovedAfterLoad();
  }
}

function bindAdvanced() {
  $('#reloadFrame').addEventListener('click', () => {
    const frame = $('#playFrame');
    frame.src = frame.src;
  });
  $('#popoutFrame').addEventListener('click', () => {
    if (state.currentSlug) window.open(gameUrlFor(state.currentSlug), '_blank', 'noopener');
  });
  // In-game menu injector — only works for same-origin games (library mirror).
  $('#openMenuBtn')?.addEventListener('click', () => {
    const frame = $('#playFrame');
    const mode = detectAccess(frame);
    if (mode !== 'same-origin') {
      showToast('Cross-origin — cannot inject menu');
      return;
    }
    const game = games.find(g => g.slug === state.currentSlug);
    try {
      frame.contentWindow.eval(buildMenuPayload(game?.name || 'Game'));
      showToast('Cheat menu opened inside game ⤴');
    } catch (e) {
      showToast('Inject err: ' + e.message);
    }
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
