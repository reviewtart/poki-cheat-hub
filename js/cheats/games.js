// Per-game cheat registry.
// Slugs match the Poki URL slug (e.g. /en/g/crazy-cars -> "crazy-cars").
// "unavailable" means Poki removed this game from their catalog — kept for
// historical reference and snippet education, but play-mode shows a warning.

export const games = [
  {
    slug: 'combat-reloaded',
    name: 'Combat Reloaded',
    publisher: 'NadGames',
    engine: 'Unity WebGL',
    detect: () => typeof window.unityInstance === 'object' || typeof window.Module === 'object',
    tags: ['fps', '3d', 'unity'],
    features: ['Skip Poki ad breaks', 'Probe Unity heap', 'Send Unity messages'],
    snippets: [
      {
        id: 'cr-find',
        title: 'Find Unity instance',
        desc: 'Dumps the Unity gameInstance / unityInstance keys so you can craft SendMessage calls.',
        tags: ['debug', 'unity'],
        code: `(() => {
  const u = window.unityInstance || window.gameInstance || window.Module;
  if (!u) return console.warn('[cr] no Unity instance');
  console.log('[cr] Unity globals:', Object.keys(u).slice(0, 30));
  if (u.SendMessage) console.log('[cr] SendMessage(go, method, value) ready');
  window.__POKI_UNITY = u;
})();`,
      },
      {
        id: 'cr-send-msg',
        title: 'Try SendMessage to GameManager',
        desc: 'Sends a sample Unity message — find the right gameObject/method names via the build files first.',
        tags: ['unity', 'experimental'],
        code: `(() => {
  const u = window.unityInstance || window.gameInstance;
  if (!u?.SendMessage) return console.warn('[cr] no SendMessage');
  ['Player','GameManager','HUD','Money'].forEach(go => {
    try { u.SendMessage(go, 'AddCoins', 9999); } catch (e) {}
  });
  console.log('[cr] AddCoins(9999) sent to common GameObjects');
})();`,
      },
    ],
  },

  {
    slug: 'crazy-cars',
    name: 'Crazy Cars',
    publisher: 'Goog Tech Studios',
    engine: 'HTML5 / Custom',
    detect: () => true,
    tags: ['racing', '3d'],
    features: ['Skip ads', 'Expose internals', 'Slow-motion engine'],
    snippets: [
      {
        id: 'cc-find',
        title: 'Find game internals',
        desc: 'Dumps common game-related globals that crazy-cars and similar racing games expose.',
        tags: ['debug'],
        code: `(() => {
  const cands = ['game','app','main','Module','runtime','GAME','SCENE','engine'];
  const found = {};
  for (const c of cands) if (window[c]) found[c] = window[c].constructor?.name || typeof window[c];
  console.log('[cc] candidates:', found);
  window.__POKI_CANDS = found;
})();`,
      },
      {
        id: 'cc-slow',
        title: 'Slow time (if game uses requestAnimationFrame)',
        desc: 'Wraps RAF to fire every other tick — halves animation speed and any rAF-driven physics.',
        tags: ['fun'],
        code: `(() => {
  if (window.__pokiRAFPatched) return console.log('[cc] already patched');
  const real = window.requestAnimationFrame;
  let i = 0;
  window.requestAnimationFrame = (cb) => real.call(window, (t) => { if (++i % 2) cb(t); });
  window.__pokiRAFPatched = true;
  console.log('[cc] RAF slowed to 1/2 speed. Run again to compound.');
})();`,
      },
    ],
  },

  {
    slug: 'basketball-stars',
    name: 'Basketball Stars',
    publisher: 'Madpuffers',
    engine: 'Unity WebGL',
    detect: () => typeof window.unityInstance === 'object' || typeof window.Module === 'object',
    tags: ['sports', 'unity', '2p'],
    features: ['Skip ads', 'Discover Unity hooks'],
    snippets: [
      {
        id: 'bs-find-unity',
        title: 'Locate Unity instance',
        desc: 'Madpuffers ports use Unity WebGL — expose the instance for further inspection.',
        tags: ['debug', 'unity'],
        code: `(() => {
  const u = window.unityInstance || window.gameInstance || window.Module;
  if (!u) return console.warn('[bs] no Unity');
  console.log('[bs] Unity keys:', Object.keys(u).slice(0,30));
  window.__POKI_UNITY = u;
})();`,
      },
    ],
  },

  {
    slug: 'drift-boss',
    name: 'Drift Boss',
    publisher: 'MarketJS',
    engine: 'HTML5 / Custom',
    detect: () => true,
    tags: ['racing', '2d'],
    features: ['Skip ads', 'Probe globals', 'Slow physics tick'],
    snippets: [
      {
        id: 'db-find',
        title: 'Find game globals',
        desc: 'Discover what drift-boss exposes — try window.game / window.app / window.scene first.',
        tags: ['debug'],
        code: `(() => {
  const keys = Object.keys(window).filter(k => /game|score|coin|level|car|drift|player/i.test(k));
  console.log('[db] candidate keys:', keys);
  window.__POKI_KEYS = keys;
})();`,
      },
    ],
  },

  {
    slug: 'drive-mad',
    name: 'Drive Mad',
    publisher: 'MarketJS',
    engine: 'HTML5 / Custom',
    detect: () => true,
    tags: ['racing', '2d'],
    features: ['Skip ads', 'Skip levels'],
    snippets: [
      {
        id: 'dm-find',
        title: 'Find game globals',
        desc: 'Most MarketJS games hide state in closures — start by listing window keys with relevant names.',
        tags: ['debug'],
        code: `(() => {
  const keys = Object.keys(window).filter(k => /game|level|car|driver|state/i.test(k));
  console.log('[dm]', keys);
})();`,
      },
    ],
  },

  {
    slug: 'bullet-bros',
    name: 'Bullet Bros',
    publisher: 'GIBBO',
    engine: 'HTML5 / Custom',
    detect: () => true,
    tags: ['shooter', '2d'],
    features: ['Skip ads', 'Inspect state'],
    snippets: [
      {
        id: 'bb-find',
        title: 'Find game state',
        desc: 'Look for common state holders like window.game, window.scene, or hero objects.',
        tags: ['debug'],
        code: `(() => {
  const cands = ['game','scene','app','hero','player','main'];
  for (const c of cands) if (window[c]) console.log('[bb] window.' + c, typeof window[c]);
})();`,
      },
    ],
  },

  {
    slug: 'cryzen-io',
    name: 'Cryzen.io',
    publisher: 'Cryzenx',
    engine: 'HTML5 / Custom',
    detect: () => true,
    tags: ['shooter', 'io', '3d'],
    features: ['Skip ads', 'Find player state'],
    snippets: [
      {
        id: 'cz-find',
        title: 'Find player object',
        desc: 'Most .io shooters store player and world state at top-level. Dump everything game-related.',
        tags: ['debug'],
        code: `(() => {
  const found = {};
  for (const k of Object.keys(window)) {
    if (/player|world|game|score|health/i.test(k) && window[k]) found[k] = typeof window[k];
  }
  console.log('[cz] candidates:', found);
})();`,
      },
    ],
  },

  {
    slug: 'brain-test-tricky-puzzles',
    name: 'Brain Test: Tricky Puzzles',
    publisher: 'Unico Studio',
    engine: 'Unity WebGL',
    detect: () => typeof window.unityInstance === 'object' || typeof window.Module === 'object',
    tags: ['puzzle', 'unity'],
    features: ['Skip ads', 'Solve revealed via SendMessage probe'],
    snippets: [
      {
        id: 'bt-find',
        title: 'Find Unity SendMessage',
        desc: 'Unity puzzle games typically have a LevelManager or PuzzleManager. Discover via build inspection.',
        tags: ['debug', 'unity'],
        code: `(() => {
  const u = window.unityInstance || window.gameInstance;
  if (!u) return console.warn('[bt] no unity');
  console.log('[bt] unity ready. Try u.SendMessage("LevelManager","SkipLevel","")');
  window.__POKI_UNITY = u;
})();`,
      },
    ],
  },

  {
    slug: 'dinosaur-game',
    name: 'Dinosaur Game (Chrome Dino)',
    publisher: 'Various / Poki',
    engine: 'HTML5 / Canvas',
    detect: () => typeof window.Runner === 'function',
    tags: ['runner', '2d'],
    features: ['Infinite jump', 'Slow motion', 'Score boost'],
    snippets: [
      {
        id: 'dino-jump',
        title: 'Make dino unkillable',
        desc: 'Patches Runner.prototype.gameOver to no-op — dino runs forever even after hitting a cactus.',
        tags: ['runner'],
        code: `(() => {
  if (typeof window.Runner !== 'function') return console.warn('[dino] no Runner');
  Runner.prototype.gameOver = function () { console.log('[dino] gameOver suppressed'); };
  console.log('[dino] dino is now immortal.');
})();`,
      },
      {
        id: 'dino-slow',
        title: 'Slow down the game',
        desc: 'Halves the speed so you can dodge everything comfortably.',
        tags: ['runner', 'fun'],
        code: `(() => {
  const r = Runner.instance_;
  if (!r) return console.warn('[dino] no Runner instance');
  r.config.SPEED = 1;
  r.currentSpeed = 1;
  console.log('[dino] speed = 1 (was ' + r.currentSpeed + ')');
})();`,
      },
    ],
  },

  // ─── Games whose SDK refuses to load through the proxy ───
  // Still fully playable on poki.com directly. Use the snippets there
  // (DevTools console / bookmarklet) — the iframe play mode is the one
  // limitation, not the snippet mode.

  {
    slug: 'subway-surfers',
    name: 'Subway Surfers',
    publisher: 'Sybo Games / Kiloo',
    engine: 'PixiJS + V3D',
    proxyBlocked: 'Playable on poki.com directly — the Poki SDK checks parent origin and refuses to load through this proxy. Open poki.com/en/g/subway-surfers in another tab and paste the snippets in DevTools instead.',
    alternativeUrl: 'https://poki.com/en/g/subway-surfers',
    detect: () => typeof window.game === 'object' && typeof window.game.freeRevivals !== 'undefined',
    tags: ['runner', '3d'],
    features: ['Infinite revives', 'Custom speed', 'Pause physics'],
    snippets: [
      {
        id: 'ss-infinite-revives',
        title: 'Infinite revives',
        desc: 'Sets free + paid revivals to 999.',
        tags: ['runner'],
        code: `(() => {
  if (!window.game) return console.warn('[ss] no game');
  window.game.freeRevivals = 999;
  window.game.paidRevivals = 999;
  console.log('[ss] revives = 999/999');
})();`,
      },
      {
        id: 'ss-speed',
        title: 'Custom speed multiplier',
        desc: 'Sets game.s — speed factor. Lower = slow mo.',
        tags: ['fun'],
        code: `(() => {
  if (!window.game) return;
  window.game.s = 0.5;
  console.log('[ss] speed = 0.5');
})();`,
      },
    ],
  },

  {
    slug: 'stickman-hook',
    name: 'Stickman Hook',
    publisher: 'Madbox',
    engine: 'Custom HTML5',
    proxyBlocked: 'Playable on poki.com directly — SDK refuses through proxy. Paste snippets in DevTools instead.',
    alternativeUrl: 'https://poki.com/en/g/stickman-hook',
    detect: () => typeof window.game === 'object',
    tags: ['casual', '2d'],
    features: ['Expose game globals'],
    snippets: [
      {
        id: 'sh-expose',
        title: 'Expose game globals',
        desc: 'Generic exploration starter for any Madbox-style title.',
        tags: ['debug'],
        code: `(() => {
  const g = window.game || window.app;
  if (!g) return console.warn('no game');
  window.__POKI_GAME = g;
  console.log('keys:', Object.keys(g));
})();`,
      },
    ],
  },
];
