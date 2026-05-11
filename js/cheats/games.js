// Per-game cheat registry.
// Slugs match the Poki URL slug (e.g. /en/g/subway-surfers -> "subway-surfers").
// Each entry has metadata + an array of snippets.
//
// Adding a game: include `globals` (the engine identifiers that must exist before
// the cheat can run) and `snippets`. Each snippet has id, title, desc, tags, code.

export const games = [
  {
    slug: 'subway-surfers',
    name: 'Subway Surfers',
    publisher: 'Sybo Games / Kiloo',
    engine: 'PixiJS + V3D (Pixi 3D)',
    detect: () => typeof window.game === 'object' && typeof window.game.freeRevivals !== 'undefined',
    tags: ['runner', '3d'],
    features: [
      'Infinite revives',
      'Pause physics for free movement',
      'Set custom speed',
      'Disable ad banner overlay',
    ],
    snippets: [
      {
        id: 'ss-infinite-revives',
        title: 'Infinite revives',
        desc: 'Sets free + paid revivals to 999. The game reads this counter every game-over screen.',
        tags: ['runner'],
        code: `(() => {
  if (!window.game) { console.warn('[ss] game not loaded yet'); return; }
  window.game.freeRevivals = 999;
  window.game.paidRevivals = 999;
  console.log('[ss] revives set to 999/999');
})();`,
      },
      {
        id: 'ss-speed',
        title: 'Custom hero speed',
        desc: 'Mutates the speed multiplier on the game root. Lower values = slow motion. Higher = harder.',
        tags: ['fun'],
        code: `(() => {
  if (!window.game) { console.warn('[ss] game not loaded yet'); return; }
  const mul = ${'${speedMul}'};            // tweak in the builder
  window.game.s = mul;
  console.log('[ss] speed multiplier set to', mul);
})();`,
      },
      {
        id: 'ss-pause-toggle',
        title: 'Toggle pause programmatically',
        desc: 'Pauses physics + render without showing the pause UI — useful for screenshots.',
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
        desc: 'Calls game.tutorial.complete() / intro.skip() if those subsystems exist.',
        tags: ['qol'],
        code: `(() => {
  if (!window.game) return;
  try { window.game.tutorial?.complete?.(); } catch (e) {}
  try { window.game.intro?.skip?.(); } catch (e) {}
  console.log('[ss] tutorial/intro skipped (best effort)');
})();`,
      },
      {
        id: 'ss-watch-hero',
        title: 'Watch hero state',
        desc: 'Logs hero position + speed + state to console every second. Read-only.',
        tags: ['debug'],
        code: `(() => {
  if (!window.game?.hero) return;
  if (window.__pokiWatch) clearInterval(window.__pokiWatch);
  window.__pokiWatch = setInterval(() => {
    const h = window.game.hero;
    console.log('[ss] hero', { x: h.x, y: h.y, z: h.z, state: window.game.state });
  }, 1000);
  console.log('[ss] watching hero (clear with clearInterval(window.__pokiWatch))');
})();`,
      },
    ],
  },

  {
    slug: 'temple-run-2',
    name: 'Temple Run 2',
    publisher: 'Imangi Studios',
    engine: 'HTML5 (varies by port)',
    detect: () => typeof window.game === 'object' || typeof window.gameInstance === 'object',
    tags: ['runner', '3d'],
    features: ['Skip ad breaks', 'Universal Poki cheats apply'],
    snippets: [
      {
        id: 'tr2-find-state',
        title: 'Discover the game state object',
        desc: 'Most Poki runners expose `window.game`. This dumps top-level keys so you can target manually.',
        tags: ['debug'],
        code: `(() => {
  const g = window.game || window.gameInstance || window.app;
  if (!g) { console.warn('[tr2] no game global yet'); return; }
  console.log('[tr2] game keys:', Object.keys(g));
  window.__POKI_GAME = g;
})();`,
      },
    ],
  },

  {
    slug: 'stickman-hook',
    name: 'Stickman Hook',
    publisher: 'Madbox',
    engine: 'Phaser / HTML5',
    detect: () => typeof window.game === 'object',
    tags: ['casual', '2d'],
    features: ['Skip levels', 'Force win'],
    snippets: [
      {
        id: 'sh-expose',
        title: 'Expose game globals',
        desc: 'Generic exploration starter for any Madbox-style title.',
        tags: ['debug'],
        code: `(() => {
  const g = window.game || window.app;
  if (!g) return console.warn('no game global');
  window.__POKI_GAME = g;
  console.log('keys:', Object.keys(g));
})();`,
      },
    ],
  },

  {
    slug: 'basket-bros',
    name: 'Basket Bros',
    publisher: 'BasketBros.io',
    engine: 'HTML5 / Custom',
    detect: () => true,
    tags: ['sports', '2p'],
    features: ['Universal ad-skip', 'Unlock all skins (best effort)'],
    snippets: [
      {
        id: 'bb-unlock-skins',
        title: 'Unlock skins (localStorage)',
        desc: 'Most cosmetic-only games store unlock flags in localStorage. Inspect first, then set.',
        tags: ['cosmetic'],
        code: `(() => {
  const dump = {};
  for (const k of Object.keys(localStorage)) dump[k] = localStorage.getItem(k);
  console.log('[bb] localStorage:', dump);
  // Example: localStorage.setItem('unlocks', JSON.stringify({ all: true }));
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
    features: ['Universal ad-skip', 'Expose internals'],
    snippets: [
      {
        id: 'cc-find',
        title: 'Find game internals',
        desc: 'Discover where the speed/coin state is stored.',
        tags: ['debug'],
        code: `(() => {
  const candidates = ['game','app','main','Module','runtime'];
  const found = {};
  for (const c of candidates) if (window[c]) found[c] = typeof window[c];
  console.log('[cc] candidates:', found);
})();`,
      },
    ],
  },

  {
    slug: 'tomb-of-the-mask',
    name: 'Tomb of the Mask',
    publisher: 'Playgendary',
    engine: 'Unity WebGL',
    detect: () => typeof window.unityInstance === 'object' || typeof window.Module === 'object',
    tags: ['arcade', 'unity'],
    features: ['Send custom Unity messages', 'Find Unity heap pointers'],
    snippets: [
      {
        id: 'unity-send',
        title: 'Send a Unity SendMessage',
        desc: 'For Unity WebGL games, the bridge accepts SendMessage(go, method, value). Replace with the right GameObject/method by inspecting the build.',
        tags: ['unity'],
        code: `(() => {
  const u = window.unityInstance || window.gameInstance;
  if (!u || typeof u.SendMessage !== 'function') {
    console.warn('No Unity SendMessage on this frame'); return;
  }
  // Example call — replace 'GameManager','SetCoins',999 with real IDs:
  u.SendMessage('GameManager', 'SetCoins', 999);
  console.log('[unity] message sent');
})();`,
      },
    ],
  },

  {
    slug: 'paper-io-2',
    name: 'Paper.io 2',
    publisher: 'Voodoo',
    engine: 'HTML5 / Custom',
    detect: () => true,
    tags: ['io', '2d'],
    features: ['Universal ad-skip', 'Score peek'],
    snippets: [
      {
        id: 'pio-peek',
        title: 'Peek at game state',
        desc: 'Voodoo games tend to expose nothing on window. Grep window for relevant strings.',
        tags: ['debug'],
        code: `(() => {
  const hits = Object.keys(window).filter(k => /score|coin|player|bot|level/i.test(k));
  console.log('[pio] candidate keys:', hits);
})();`,
      },
    ],
  },
];
