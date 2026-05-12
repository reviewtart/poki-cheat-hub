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
    proxyBlocked: 'Playable on poki.com directly — the Poki SDK checks parent origin and refuses to load through this proxy. Open poki.com/en/g/subway-surfers in another tab and paste the snippets in DevTools or use the bookmarklet.',
    alternativeUrl: 'https://poki.com/en/g/subway-surfers',
    detect: () => typeof window.game === 'object' && typeof window.game.freeRevivals !== 'undefined',
    tags: ['runner', '3d'],
    features: [
      'Infinite revives + skip ad on revive',
      'Add coins / keys / score multiplier',
      'Slow motion / fast forward',
      'Auto-collect (magnet always on)',
      'Disable guard chaser',
      'Skip ahead by distance',
    ],
    snippets: [
      {
        id: 'ss-godmode',
        title: '🛡️ God mode bundle (recommended)',
        desc: 'Everything at once — infinite revives, 999k coins, 99 keys, 100x multiplier, magnet always on, no chaser. Run once per session.',
        tags: ['runner', 'bundle'],
        code: `(() => {
  const g = window.game;
  if (!g) return console.warn('[ss] no game — start the game first');
  g.freeRevivals = 999;
  g.paidRevivals = 999;
  if (g.stats?.data) {
    g.stats.data.coins += 999000;
    g.stats.data.keys = 99;
    g.stats.data.multiplier = 100;
  }
  if (g.hero?.magnet) g.hero.magnet.count = 999;
  if (g.guard?.chaser) {
    g.guard.chaser._distance = -9999;
    g.guard.chaser.distanceStart = -9999;
  }
  // Skip ads
  if (window.PokiSDK) {
    PokiSDK.commercialBreak = () => Promise.resolve();
    PokiSDK.rewardedBreak = () => Promise.resolve(true);
  }
  console.log('%c[ss] god mode active', 'color:#33ffaa;font-weight:bold');
})();`,
      },
      {
        id: 'ss-infinite-revives',
        title: 'Infinite revives',
        desc: 'Sets free + paid revivals to 999. No ad needed to revive.',
        tags: ['runner'],
        code: `(() => {
  if (!window.game) return console.warn('[ss] no game');
  window.game.freeRevivals = 999;
  window.game.paidRevivals = 999;
  console.log('[ss] revives = 999/999');
})();`,
      },
      {
        id: 'ss-add-coins',
        title: 'Add 99,999 coins',
        desc: 'Tops up game.stats.data.coins. Updates live HUD on next tick.',
        tags: ['economy'],
        code: `(() => {
  const d = window.game?.stats?.data;
  if (!d) return console.warn('[ss] stats.data not ready');
  d.coins += 99999;
  console.log('[ss] coins =', d.coins);
})();`,
      },
      {
        id: 'ss-add-keys',
        title: 'Add 99 keys',
        desc: 'Sets stats.data.keys = 99. Keys revive you on Gameover.',
        tags: ['economy'],
        code: `(() => {
  const d = window.game?.stats?.data;
  if (!d) return console.warn('[ss] stats.data not ready');
  d.keys = 99;
  console.log('[ss] keys = 99');
})();`,
      },
      {
        id: 'ss-multiplier',
        title: 'Score multiplier x100',
        desc: 'Sets stats.data.multiplier = 100. Multiplies score gained per coin/distance.',
        tags: ['economy'],
        code: `(() => {
  const d = window.game?.stats?.data;
  if (!d) return console.warn('[ss] stats.data not ready');
  d.multiplier = 100;
  console.log('[ss] multiplier = 100');
})();`,
      },
      {
        id: 'ss-magnet-forever',
        title: 'Magnet always on',
        desc: 'Sets hero.magnet.count = 999 so coins fly to you continuously.',
        tags: ['powerup'],
        code: `(() => {
  const m = window.game?.hero?.magnet;
  if (!m) return console.warn('[ss] no magnet');
  m.count = 999;
  m.frozen = false;
  console.log('[ss] magnet engaged (count=999)');
})();`,
      },
      {
        id: 'ss-no-guard',
        title: 'Disable guard chaser',
        desc: 'Sends the inspector and his dog far behind. _distance = -9999.',
        tags: ['runner'],
        code: `(() => {
  const c = window.game?.guard?.chaser;
  if (!c) return console.warn('[ss] no guard chaser');
  c._distance = -9999;
  c.distanceStart = -9999;
  console.log('[ss] guard chaser pushed back');
})();`,
      },
      {
        id: 'ss-slow-mo',
        title: 'Slow motion (0.4x)',
        desc: 'Halves the speed multiplier — easier to dodge. game.s = 0.4',
        tags: ['fun'],
        code: `(() => {
  if (!window.game) return;
  window.game.s = 0.4;
  console.log('[ss] slow motion engaged (s=0.4)');
})();`,
      },
      {
        id: 'ss-fast-forward',
        title: 'Fast forward (2x)',
        desc: 'Doubles game speed — harder but rack up score fast.',
        tags: ['fun'],
        code: `(() => {
  if (!window.game) return;
  window.game.s = 2;
  console.log('[ss] fast forward (s=2)');
})();`,
      },
      {
        id: 'ss-skip-distance',
        title: 'Skip 5000 distance',
        desc: 'Adds 5000 to stats.data.distance — equivalent to running ahead.',
        tags: ['economy'],
        code: `(() => {
  const d = window.game?.stats?.data;
  if (!d) return;
  d.distance += 5000;
  console.log('[ss] distance jumped to', d.distance);
})();`,
      },
      {
        id: 'ss-pause-toggle',
        title: 'Toggle pause programmatically',
        desc: 'Freeze the world without the pause UI — useful for screenshots.',
        tags: ['debug'],
        code: `(() => {
  if (!window.game) return;
  window.game.paused = !window.game.paused;
  console.log('[ss] paused =', window.game.paused);
})();`,
      },
      {
        id: 'ss-no-tutorial',
        title: 'Skip tutorial / intro',
        desc: 'Force-completes tutorial and intro sequences.',
        tags: ['qol'],
        code: `(() => {
  const g = window.game;
  if (!g) return;
  try { g.tutorial?.complete?.(); } catch (e) {}
  try { g.intro?.skip?.(); } catch (e) {}
  console.log('[ss] tutorial/intro skipped');
})();`,
      },
      {
        id: 'ss-watch-state',
        title: 'Watch game state (live)',
        desc: 'Logs hero position, coins, score, multiplier every second. Stop with clearInterval(__pokiWatch).',
        tags: ['debug'],
        code: `(() => {
  if (window.__pokiWatch) clearInterval(window.__pokiWatch);
  window.__pokiWatch = setInterval(() => {
    const d = window.game?.stats?.data;
    if (!d) return;
    console.log('[ss]', { x: d.x?.toFixed(2), z: d.z?.toFixed(0), coins: d.coins, score: d.score, m: d.multiplier, distance: d.distance });
  }, 1000);
  console.log('[ss] watching — clearInterval(window.__pokiWatch) to stop');
})();`,
      },
      {
        id: 'ss-expose',
        title: 'Expose internals on window.__POKI',
        desc: 'Convenience handle: __POKI.game, __POKI.stats, __POKI.hero for tweaking from console.',
        tags: ['debug'],
        code: `(() => {
  const g = window.game;
  if (!g) return;
  window.__POKI = {
    game: g, stats: g.stats?.data, hero: g.hero, guard: g.guard,
    sdk: window.PokiSDK, config: window.GAME_CONFIG,
  };
  console.log('[ss] window.__POKI ready:', window.__POKI);
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
