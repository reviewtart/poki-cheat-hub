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
];
