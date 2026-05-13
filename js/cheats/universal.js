// Universal cheats — work on every Poki game because they all embed PokiSDK.
// Run inside the game's iframe DevTools context (the *.gdn.poki.com frame).

export const universal = [
  {
    id: 'skip-commercial',
    title: 'Skip commercial ad breaks',
    desc: 'Auto-resolves PokiSDK.commercialBreak so the game moves on without an ad.',
    tags: ['ads', 'safe'],
    code: `(() => {
  if (typeof PokiSDK !== 'object') { console.warn('[poki-cheat] PokiSDK not on this frame'); return; }
  const real = PokiSDK.commercialBreak;
  PokiSDK.commercialBreak = (fn) => {
    try { if (typeof fn === 'function') fn(); } catch (e) {}
    console.log('[poki-cheat] commercialBreak intercepted');
    return Promise.resolve();
  };
  PokiSDK._realCommercialBreak = real;
  console.log('[poki-cheat] Commercial breaks will be skipped.');
})();`,
  },
  {
    id: 'skip-rewarded',
    title: 'Auto-grant rewarded ads',
    desc: 'Resolves PokiSDK.rewardedBreak with success without showing video — game thinks you watched.',
    tags: ['ads', 'safe'],
    code: `(() => {
  if (typeof PokiSDK !== 'object') { console.warn('[poki-cheat] PokiSDK not on this frame'); return; }
  const real = PokiSDK.rewardedBreak;
  PokiSDK.rewardedBreak = (fn) => {
    try { if (typeof fn === 'function') fn(); } catch (e) {}
    console.log('[poki-cheat] rewardedBreak intercepted -> rewarding');
    return Promise.resolve(true);  // truthy signals "user watched the ad"
  };
  PokiSDK._realRewardedBreak = real;
  console.log('[poki-cheat] Rewarded ads granted automatically.');
})();`,
  },
  {
    id: 'kill-display-ads',
    title: 'Hide display ad slots',
    desc: 'Removes Poki banner / 300x250 / video-ad-container DOM nodes from the parent page. Run in the TOP page, not the iframe.',
    tags: ['ads', 'parent-frame'],
    code: `(() => {
  const selectors = [
    '.poki-ad-slot',
    '#poki-video-ad-container',
    '[id^="poki-ag"]',
    '[class*="ad-slot" i]',
    '[id*="ad-container" i]',
  ];
  const kill = () => {
    let n = 0;
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => { el.remove(); n++; });
    }
    if (n) console.log('[poki-cheat] removed', n, 'ad nodes');
  };
  kill();
  new MutationObserver(kill).observe(document.body, { childList: true, subtree: true });
  console.log('[poki-cheat] Display ads removed (continuous).');
})();`,
  },
  {
    id: 'block-ad-networks',
    title: 'Block ad-network requests',
    desc: 'Patches fetch/XHR to drop calls to known ad bidders. Aggressive — may break leaderboards on some games.',
    tags: ['ads', 'aggressive'],
    code: `(() => {
  const adHosts = [
    'doubleclick.net','googlesyndication','googletagservices','google-analytics',
    'adservice','amazon-adsystem','criteo','pubmatic','rubiconproject','openx',
    'adnxs.com','casalemedia','indexww','onetag','smartadserver','3lift',
    'yieldmo','richaudience','adform','adgrx','adtrafficquality','moatads',
    'taboola','outbrain','prebid','imasdk.googleapis','/pagead/','/ads/'
  ];
  const isAd = (u) => adHosts.some(h => String(u).toLowerCase().includes(h));
  const origFetch = window.fetch;
  window.fetch = (input, init) => {
    const u = typeof input === 'string' ? input : (input && input.url) || '';
    if (isAd(u)) return Promise.resolve(new Response('', { status: 204 }));
    return origFetch.call(window, input, init);
  };
  const OX = window.XMLHttpRequest;
  if (OX) {
    const open = OX.prototype.open;
    OX.prototype.open = function (m, u, ...a) {
      this.__poki_url = u;
      return open.call(this, m, u, ...a);
    };
    const send = OX.prototype.send;
    OX.prototype.send = function (...a) {
      if (isAd(this.__poki_url)) { this.abort(); return; }
      return send.call(this, ...a);
    };
  }
  console.log('[poki-cheat] Ad-network requests blocked.');
})();`,
  },
  {
    id: 'expose-globals',
    title: 'Expose game internals on window.__POKI',
    desc: 'Convenient handle: window.__POKI.game, window.__POKI.sdk for manual experimentation in DevTools.',
    tags: ['debug'],
    code: `(() => {
  window.__POKI = {
    game: window.game || null,
    sdk: window.PokiSDK || null,
    config: window.GAME_CONFIG || null,
    submitScore: window.dispatchSubmitScore || null,
  };
  console.log('[poki-cheat] Exposed window.__POKI:', window.__POKI);
})();`,
  },
  {
    id: 'mute-sdk-analytics',
    title: 'Mute PokiSDK analytics events',
    desc: 'No-ops customEvent / captureError / logError so the game stops reporting telemetry.',
    tags: ['privacy'],
    code: `(() => {
  if (typeof PokiSDK !== 'object') return;
  ['customEvent','captureError','logError','happyTime'].forEach(k => {
    if (typeof PokiSDK[k] === 'function') PokiSDK[k] = () => {};
  });
  console.log('[poki-cheat] PokiSDK telemetry muted.');
})();`,
  },
  // ════════════════════════ GENERIC GAMEPLAY CHEATS ════════════════════════
  // Auto-detect game state objects and patch common field names. Works on
  // ~70-80% of HTML5 games because they share field naming conventions
  // (coin/coins/score/money/gold/cash/lives/health/hp/godMode/invincible).
  {
    id: 'cheat-money',
    title: '💰 Max money / coins / score',
    desc: 'Bumps every coin/coins/score/money/gold/gem/cash/diamond field on window.game / app / state to 999999.',
    tags: ['cheat', 'auto'],
    code: `(() => {
  const NAMES = ['coin','coins','score','money','gold','gem','gems','cash','diamond','diamonds','coinCount','scoreValue','totalCoins','totalScore','bestScore','highscore','highScore','currency','points','xp','exp'];
  const VALUE = 999999;
  let n = 0;
  const visit = (o, d) => {
    if (!o || typeof o !== 'object' || d > 5) return;
    for (const k of Object.keys(o)) {
      try {
        if (NAMES.includes(k) && typeof o[k] === 'number') { o[k] = VALUE; n++; }
        else if (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]) && !k.startsWith('_')) visit(o[k], d+1);
      } catch(e){}
    }
  };
  for (const root of ['game','app','main','state','player','hero','stats','data','store','gameData','GameManager','currentprofil']) {
    try { if (window[root]) visit(window[root], 0); } catch(e){}
  }
  console.log('[poki-cheat] Bumped', n, 'money/score field(s) to', VALUE);
})();`,
  },
  {
    id: 'cheat-lives',
    title: '❤️ Max lives / health / energy',
    desc: 'Sets every life/lives/health/hp/energy/stamina field to 99 across known game state objects.',
    tags: ['cheat', 'auto'],
    code: `(() => {
  const NAMES = ['life','lives','health','hp','hitPoints','energy','stamina','maxHealth','maxLives','maxHp','playerHealth','playerLives','heart','hearts','heartCount','retries','revivals'];
  const VALUE = 99;
  let n = 0;
  const visit = (o, d) => {
    if (!o || typeof o !== 'object' || d > 5) return;
    for (const k of Object.keys(o)) {
      try {
        if (NAMES.includes(k) && typeof o[k] === 'number') { o[k] = VALUE; n++; }
        else if (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]) && !k.startsWith('_')) visit(o[k], d+1);
      } catch(e){}
    }
  };
  for (const root of ['game','app','main','state','player','hero','stats','data']) {
    try { if (window[root]) visit(window[root], 0); } catch(e){}
  }
  console.log('[poki-cheat] Set', n, 'life/health field(s) to', VALUE);
})();`,
  },
  {
    id: 'cheat-godmode',
    title: '🛡️ God mode',
    desc: 'Sets godMode / invincible / immortal / noDeath / infinite* flags to true on game state.',
    tags: ['cheat', 'auto'],
    code: `(() => {
  const NAMES = ['godMode','god','invincible','immortal','noDeath','infiniteHealth','infiniteLives','isInvincible','isImmortal','isGod','cheat','cheatMode','debug','debugMode','noClip','noclip'];
  let n = 0;
  const visit = (o, d) => {
    if (!o || typeof o !== 'object' || d > 5) return;
    for (const k of Object.keys(o)) {
      try {
        if (NAMES.includes(k)) { o[k] = true; n++; }
        else if (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]) && !k.startsWith('_')) visit(o[k], d+1);
      } catch(e){}
    }
  };
  for (const root of ['game','app','main','state','player','hero']) {
    try { if (window[root]) visit(window[root], 0); } catch(e){}
  }
  console.log('[poki-cheat] God mode: set', n, 'flag(s) to true');
})();`,
  },
  {
    id: 'cheat-speed-fast',
    title: '⚡ Fast forward 2x',
    desc: 'Scales the timestamp passed to every requestAnimationFrame callback so delta-time physics runs 2x faster. RAF chain stays linear (no exponential freeze).',
    tags: ['cheat', 'speed'],
    code: `(() => {
  // Install once — repeated clicks just change the scale.
  if (!window.__pch_raf_installed) {
    const orig = window.requestAnimationFrame.bind(window);
    window.__pch_raf_orig = orig;
    window.__pch_raf_scale = 1;
    let base = null, virt = 0, lastReal = 0;
    window.requestAnimationFrame = (cb) => orig((t) => {
      if (base === null) { base = t; lastReal = t; }
      virt += (t - lastReal) * window.__pch_raf_scale;
      lastReal = t;
      try { cb(base + virt); } catch(e) { console.warn('[poki-cheat] RAF cb err', e); }
    });
    window.__pch_raf_installed = true;
  }
  window.__pch_raf_scale = 2;
  console.log('[poki-cheat] Fast forward 2x active (timestamp scale).');
})();`,
  },
  {
    id: 'cheat-speed-slow',
    title: '🐢 Slow motion 0.3x',
    desc: 'Scales the timestamp passed to every requestAnimationFrame callback so delta-time physics runs at 30% speed. Easier reaction time without freezing the game loop.',
    tags: ['cheat', 'speed'],
    code: `(() => {
  if (!window.__pch_raf_installed) {
    const orig = window.requestAnimationFrame.bind(window);
    window.__pch_raf_orig = orig;
    window.__pch_raf_scale = 1;
    let base = null, virt = 0, lastReal = 0;
    window.requestAnimationFrame = (cb) => orig((t) => {
      if (base === null) { base = t; lastReal = t; }
      virt += (t - lastReal) * window.__pch_raf_scale;
      lastReal = t;
      try { cb(base + virt); } catch(e) { console.warn('[poki-cheat] RAF cb err', e); }
    });
    window.__pch_raf_installed = true;
  }
  window.__pch_raf_scale = 0.3;
  console.log('[poki-cheat] Slow motion 0.3x active (timestamp scale).');
})();`,
  },
  {
    id: 'cheat-speed-normal',
    title: '🔄 Normal speed',
    desc: 'Restores timestamp scale to 1x. Reset after fast forward / slow motion.',
    tags: ['cheat', 'speed'],
    code: `(() => {
  if (window.__pch_raf_installed) {
    window.__pch_raf_scale = 1;
    console.log('[poki-cheat] Speed restored to 1x.');
  } else {
    console.log('[poki-cheat] No speed cheat active.');
  }
})();`,
  },
  {
    id: 'cheat-pause',
    title: '⏸️ Toggle pause',
    desc: 'Toggles paused / isPaused boolean on game/app/main. Some games freeze on this; others ignore.',
    tags: ['cheat', 'auto'],
    code: `(() => {
  for (const root of ['game','app','main','engine','state']) {
    const o = window[root];
    if (!o || typeof o !== 'object') continue;
    for (const k of ['paused','isPaused','pause','isPause']) {
      if (typeof o[k] === 'boolean') {
        o[k] = !o[k];
        console.log('[poki-cheat]', root + '.' + k, '=', o[k]);
        return;
      }
    }
  }
  console.log('[poki-cheat] No paused field found on common roots.');
})();`,
  },
  {
    id: 'cheat-mute',
    title: '🔇 Mute all audio',
    desc: 'Sets every <audio>/<video>.muted = true and overrides AudioContext to silence Web Audio API output.',
    tags: ['cheat'],
    code: `(() => {
  document.querySelectorAll('audio,video').forEach(el => { try { el.muted = true; el.volume = 0; } catch(e){} });
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !AC.prototype.__pch_muted) {
      const orig = AC.prototype.createGain;
      AC.prototype.createGain = function() { const g = orig.call(this); try { g.gain.value = 0; } catch(e){} return g; };
      AC.prototype.__pch_muted = true;
    }
  } catch(e){}
  console.log('[poki-cheat] Audio muted.');
})();`,
  },
  {
    id: 'cheat-dump',
    title: '🔍 Dump game state to console',
    desc: 'Lists every top-level object on window and the keys of common game roots so you can inspect manually.',
    tags: ['debug'],
    code: `(() => {
  const interesting = Object.keys(window).filter(k =>
    !/^[A-Z][A-Z_]*$/.test(k) && // skip uppercase constants
    typeof window[k] === 'object' && window[k] !== null &&
    /game|app|main|player|hero|stats|state|engine|world|level|scene|hud|store|data/i.test(k)
  );
  const out = {};
  for (const k of interesting) {
    try {
      const o = window[k];
      out[k] = Array.isArray(o) ? '[Array '+o.length+']' : Object.keys(o).slice(0, 20);
    } catch(e){}
  }
  console.log('[poki-cheat] Detected game globals:', out);
  console.log('[poki-cheat] Full window.game:', window.game);
  console.log('[poki-cheat] Full window.app :', window.app);
  console.log('[poki-cheat] Tip: window.__POKI_GAME = window.game or window.app for easier access.');
  window.__POKI_GAME = window.game || window.app || window.main || null;
})();`,
  },
];
