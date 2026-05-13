// In-game cheat menu — injected into the game iframe.
// Builds a floating draggable panel inside the game's own DOM, with
// generic + game-specific cheats. Triggered from the parent hub via
// iframe.contentWindow.eval(buildMenuPayload()).

export function buildMenuPayload(gameName = 'Game') {
  return `(${menuBootFn.toString()})(${JSON.stringify(gameName)});`;
}

// This function is serialized as a string and eval'd inside the iframe.
// Keep it self-contained (no closures, no imports).
function menuBootFn(gameName) {
  if (window.__PCH_MENU__) {
    // Already mounted — toggle visibility
    const m = document.getElementById('pch-menu');
    if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
    return 'toggled';
  }

  // Detect engine + suggest relevant cheats
  const engines = {
    pixi: typeof window.PIXI !== 'undefined',
    phaser: typeof window.Phaser !== 'undefined',
    three: typeof window.THREE !== 'undefined',
    playcanvas: typeof window.pc !== 'undefined',
    unity: typeof window.unityInstance !== 'undefined' || typeof window.Module !== 'undefined',
    construct: typeof window.cr_getC2Runtime === 'function' || typeof window.c3runtime !== 'undefined',
  };
  const detectedEngine = Object.entries(engines).find(([_, v]) => v)?.[0] || 'unknown';

  // Find common state globals
  const stateGlobals = Object.keys(window).filter(k =>
    /^(game|app|main|state|player|hero|scene|engine|world|level|stats|hud|gamePlay|GameManager|GameUI|currentprofil)/i.test(k)
    && typeof window[k] === 'object' && window[k] !== null
  ).slice(0, 8);

  // ────────────── Build UI ──────────────
  const css = `
    #pch-menu {
      position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      width: 280px; max-height: calc(100vh - 24px); overflow: hidden;
      background: rgba(20, 24, 34, 0.95); color: #e8eaed;
      border: 1px solid rgba(120, 220, 180, 0.4);
      border-radius: 10px;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.6);
      font: 13px/1.5 -apple-system, system-ui, sans-serif;
      transition: transform 200ms cubic-bezier(0.2,0.7,0.2,1);
    }
    #pch-menu.dragging { transition: none; opacity: 0.85; }
    #pch-menu .pch-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px;
      background: rgba(120, 220, 180, 0.15);
      border-bottom: 1px solid rgba(120, 220, 180, 0.3);
      cursor: move; user-select: none;
    }
    #pch-menu .pch-title { font-family: ui-monospace,Menlo,monospace; font-size: 11px; letter-spacing: 0.05em; color: #7ce6b4; }
    #pch-menu .pch-x {
      background: transparent; border: 0; color: #888; font-size: 18px;
      cursor: pointer; padding: 0 4px; line-height: 1;
    }
    #pch-menu .pch-x:hover { color: #fff; }
    #pch-menu .pch-body { padding: 12px; max-height: calc(100vh - 80px); overflow-y: auto; }
    #pch-menu .pch-section { margin-bottom: 14px; }
    #pch-menu .pch-section h4 {
      margin: 0 0 6px; font-size: 10px; font-weight: 600;
      color: rgba(232,234,237,0.5); letter-spacing: 0.08em; text-transform: uppercase;
    }
    #pch-menu button.pch-btn {
      display: block; width: 100%; text-align: left;
      padding: 8px 10px; margin: 0 0 4px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
      color: #e8eaed; font: inherit; cursor: pointer;
      transition: all 120ms;
    }
    #pch-menu button.pch-btn:hover {
      background: rgba(120, 220, 180, 0.15);
      border-color: rgba(120, 220, 180, 0.5);
    }
    #pch-menu button.pch-btn.success {
      background: rgba(120, 220, 180, 0.3);
      border-color: #7ce6b4;
    }
    #pch-menu .pch-info {
      font-size: 11px; color: rgba(232,234,237,0.55);
      padding: 6px 0; line-height: 1.4;
    }
    #pch-menu .pch-tag {
      display: inline-block; padding: 1px 6px;
      background: rgba(120,220,180,0.2); color: #7ce6b4;
      font-family: ui-monospace,monospace; font-size: 10px;
      border-radius: 3px; margin-right: 4px;
    }
    #pch-toast {
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: #7ce6b4; color: #0b1018;
      padding: 8px 16px; border-radius: 999px;
      font-family: -apple-system, system-ui, sans-serif; font-size: 12px; font-weight: 600;
      z-index: 2147483648; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      pointer-events: none; opacity: 0;
      transition: opacity 200ms;
    }
    #pch-toast.show { opacity: 1; }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const menu = document.createElement('div');
  menu.id = 'pch-menu';
  menu.innerHTML = `
    <div class="pch-head">
      <span class="pch-title">[POKI::CHEAT] ${escapeHtml(gameName)}</span>
      <button class="pch-x" data-act="hide">×</button>
    </div>
    <div class="pch-body" id="pch-body"></div>
  `;
  document.body.appendChild(menu);

  const toast = document.createElement('div');
  toast.id = 'pch-toast';
  document.body.appendChild(toast);

  // Build cheat sections
  const body = document.getElementById('pch-body');
  body.appendChild(section('Diagnostics', [
    info('Engine detected:', '<span class="pch-tag">' + detectedEngine + '</span>'),
    info('Game globals:', stateGlobals.length ? stateGlobals.slice(0, 6).map(k => '<span class="pch-tag">' + k + '</span>').join(' ') : '<em>none</em>'),
    btn('🔍 Dump globals to console', () => {
      const probe = {};
      for (const k of stateGlobals) probe[k] = typeof window[k] === 'object' ? Object.keys(window[k]).slice(0, 10) : window[k];
      console.log('[pch] globals', probe);
      window.__POKI = { game: window.game, app: window.app, state: window.state, _all: stateGlobals.reduce((a, k) => (a[k] = window[k], a), {}) };
      toastShow('Console + window.__POKI');
    }),
    btn('⛔ Block ad networks', () => {
      const adHosts = ['doubleclick.net', 'googlesyndication', 'googletagmanager', 'googletagservices', 'adservice.google', 'amazon-adsystem', 'criteo', 'pubmatic', 'rubicon', 'adnxs', 'casalemedia', '/pagead/', '/ads/'];
      const isAd = u => adHosts.some(h => String(u).toLowerCase().includes(h));
      if (!window.__pch_fpatched) {
        const f = window.fetch;
        window.fetch = (i, n) => isAd(typeof i === 'string' ? i : i?.url || '') ? Promise.resolve(new Response('', { status: 204 })) : f.call(window, i, n);
        const X = window.XMLHttpRequest;
        if (X) {
          const o = X.prototype.open, s = X.prototype.send;
          X.prototype.open = function (m, u, ...a) { this.__u = u; return o.call(this, m, u, ...a); };
          X.prototype.send = function (...a) { if (isAd(this.__u)) { this.abort(); return; } return s.call(this, ...a); };
        }
        window.__pch_fpatched = true;
      }
      // Remove ad DOM nodes
      document.querySelectorAll('[id*="ad" i],[class*="ad-slot" i],iframe[src*="doubleclick"],iframe[src*="googletag"]').forEach(el => el.remove());
      toastShow('Ads blocked');
    }),
  ]));

  body.appendChild(section('Game speed', [
    btn('🐢 Slow motion 0.3x', () => patchRaf(0.3, 'Slow mode 0.3x')),
    btn('🔄 Normal speed', () => patchRaf(1, 'Normal speed')),
    btn('⚡ Fast forward 2x', () => patchRaf(2, 'Fast forward 2x')),
    btn('🚀 Insane speed 5x', () => patchRaf(5, 'Insane 5x')),
  ]));

  // Universal numeric tweaks — try common property paths
  body.appendChild(section('Common numeric tweaks', [
    btn('💰 +9999 to all "coin*" / "score*" fields', () => bumpFields(['coin','coins','score','money','gold','gem','cash','coinCount','scoreValue'], 9999)),
    btn('❤️ Max lives (+99 on "life*" / "health*")', () => bumpFields(['life','lives','health','hp','hitPoints','energy'], 99)),
    btn('⏱️ Pause game (boolean "paused")', () => togglePaused()),
    btn('🛡️ Set "godMode" / "invincible" = true', () => setFields(['godMode','invincible','immortal','noDeath','infiniteHealth'], true)),
  ]));

  // Engine-specific
  if (engines.unity) {
    body.appendChild(section('Unity hooks', [
      btn('📡 Try SendMessage(GameManager, AddCoins, 9999)', () => {
        const u = window.unityInstance || window.gameInstance;
        try { u.SendMessage('GameManager', 'AddCoins', 9999); toastShow('Unity message sent'); }
        catch (e) { toastShow('Unity err: ' + e.message); }
      }),
    ]));
  }
  if (engines.playcanvas) {
    body.appendChild(section('PlayCanvas hooks', [
      btn('📊 Dump pc.app to console', () => { console.log('pc.app', window.pc?.app); toastShow('Console'); }),
      btn('⏸ pc.app.timeScale = 0.3', () => { try { window.pc.app.timeScale = 0.3; toastShow('timeScale = 0.3'); } catch (e) {} }),
      btn('▶ pc.app.timeScale = 1', () => { try { window.pc.app.timeScale = 1; toastShow('timeScale = 1'); } catch (e) {} }),
    ]));
  }
  if (engines.pixi) {
    body.appendChild(section('PixiJS hooks', [
      btn('📊 Dump app.ticker / stage', () => {
        const app = window.app || window.game?.app || window.__PIXI_APP__;
        console.log('PIXI app', app, 'ticker speed', app?.ticker?.speed);
        toastShow('Console');
      }),
      btn('⏸ ticker.speed = 0.3', () => {
        const app = window.app || window.game?.app || window.__PIXI_APP__;
        if (app?.ticker) { app.ticker.speed = 0.3; toastShow('ticker = 0.3'); }
      }),
    ]));
  }

  body.appendChild(section('Tools', [
    btn('📺 Toggle FPS counter', () => toggleFps()),
    btn('🔇 Mute all audio', () => {
      document.querySelectorAll('video,audio').forEach(el => el.muted = true);
      const ctx = window.audioContext || window.AudioContext;
      try { window.AudioContext.prototype._origCreateOsc = window.AudioContext.prototype.createOscillator; } catch {}
      toastShow('Audio muted');
    }),
    btn('🖼️ Screenshot canvas', () => {
      const c = document.querySelector('canvas');
      if (!c) { toastShow('No canvas'); return; }
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = 'cheat-' + Date.now() + '.png';
      a.click();
      toastShow('Saved');
    }),
  ]));

  // Drag handle
  let dx = 0, dy = 0, dragging = false;
  const head = menu.querySelector('.pch-head');
  head.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    dragging = true; menu.classList.add('dragging');
    const r = menu.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    menu.style.left = (e.clientX - dx) + 'px';
    menu.style.top = (e.clientY - dy) + 'px';
    menu.style.right = 'auto';
  });
  window.addEventListener('mouseup', () => { dragging = false; menu.classList.remove('dragging'); });

  // Close button
  menu.querySelector('[data-act=hide]').addEventListener('click', () => {
    menu.style.display = 'none';
  });

  window.__PCH_MENU__ = true;
  toastShow('Cheat menu mounted');

  // ──── helpers ────
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function section(title, items) {
    const div = document.createElement('div');
    div.className = 'pch-section';
    const h = document.createElement('h4'); h.textContent = title; div.appendChild(h);
    items.forEach(it => div.appendChild(it));
    return div;
  }
  function btn(label, fn) {
    const b = document.createElement('button');
    b.className = 'pch-btn'; b.textContent = label;
    b.onclick = () => {
      try { fn(); b.classList.add('success'); setTimeout(() => b.classList.remove('success'), 500); }
      catch (e) { console.warn('[pch] cheat err', e); toastShow('Error: ' + e.message); }
    };
    return b;
  }
  function info(label, value) {
    const d = document.createElement('div');
    d.className = 'pch-info';
    d.innerHTML = '<strong>' + label + '</strong> ' + value;
    return d;
  }
  function toastShow(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastShow._t);
    toastShow._t = setTimeout(() => toast.classList.remove('show'), 1500);
  }
  // Speed cheat — scales the timestamp passed to every requestAnimationFrame
  // callback. RAF chain stays linear (no exponential freeze on speed-up, no
  // dead loop on slow-down), and delta-time physics scales naturally.
  function patchRaf(mul, label) {
    if (!window.__pch_raf_installed) {
      const orig = window.requestAnimationFrame.bind(window);
      window.__pch_raf_orig = orig;
      window.__pch_raf_scale = 1;
      let base = null, virt = 0, lastReal = 0;
      window.requestAnimationFrame = (cb) => orig((t) => {
        if (base === null) { base = t; lastReal = t; }
        virt += (t - lastReal) * window.__pch_raf_scale;
        lastReal = t;
        try { cb(base + virt); } catch(e) { console.warn('[pch] RAF cb err', e); }
      });
      window.__pch_raf_installed = true;
    }
    window.__pch_raf_scale = mul;
    toastShow(label);
  }
  function bumpFields(names, delta) {
    let n = 0;
    const visit = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 4) return;
      for (const k of Object.keys(o)) {
        if (names.includes(k) && typeof o[k] === 'number') { o[k] += delta; n++; }
        else if (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]) && !k.startsWith('_')) {
          try { visit(o[k], depth + 1); } catch {}
        }
      }
    };
    for (const root of ['game', 'app', 'main', 'state']) try { visit(window[root], 0); } catch {}
    toastShow('Bumped ' + n + ' field(s)');
  }
  function setFields(names, value) {
    let n = 0;
    const visit = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 4) return;
      for (const k of Object.keys(o)) {
        if (names.includes(k)) { o[k] = value; n++; }
        else if (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]) && !k.startsWith('_')) {
          try { visit(o[k], depth + 1); } catch {}
        }
      }
    };
    for (const root of ['game', 'app', 'main', 'state']) try { visit(window[root], 0); } catch {}
    toastShow('Set ' + n + ' field(s)');
  }
  function togglePaused() {
    for (const root of ['game', 'app', 'main']) {
      const o = window[root];
      if (o && typeof o.paused === 'boolean') { o.paused = !o.paused; toastShow(root + '.paused=' + o.paused); return; }
    }
    toastShow('No "paused" field found');
  }
  function toggleFps() {
    if (window.__pch_fps) { window.__pch_fps.remove(); window.__pch_fps = null; cancelAnimationFrame(window.__pch_fpsRaf); return; }
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;background:rgba(0,0,0,0.7);color:#7ce6b4;font:bold 12px monospace;padding:4px 8px;border-radius:4px;pointer-events:none;';
    document.body.appendChild(div);
    window.__pch_fps = div;
    let last = performance.now(), frames = 0;
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last > 500) { div.textContent = (frames * 1000 / (now - last)).toFixed(0) + ' fps'; frames = 0; last = now; }
      window.__pch_fpsRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  return 'mounted';
}
