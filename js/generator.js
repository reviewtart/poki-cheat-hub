// Custom cheat builder — combines user-selected toggles into a single payload,
// then emits three output formats: Console paste, Bookmarklet URL, Tampermonkey userscript.

const ENCODE = (s) => encodeURIComponent(s).replace(/'/g, '%27');

const partials = {
  skipCommercial: `try {
  const sdk = window.PokiSDK;
  if (sdk && typeof sdk.commercialBreak === 'function') {
    sdk._real_commercialBreak = sdk.commercialBreak;
    sdk.commercialBreak = (fn) => { try { fn && fn(); } catch (e) {} return Promise.resolve(); };
  }
} catch (e) {}`,
  skipRewarded: `try {
  const sdk = window.PokiSDK;
  if (sdk && typeof sdk.rewardedBreak === 'function') {
    sdk._real_rewardedBreak = sdk.rewardedBreak;
    sdk.rewardedBreak = (fn) => { try { fn && fn(); } catch (e) {} return Promise.resolve(true); };
  }
} catch (e) {}`,
  killDisplayAds: `try {
  const sels = ['.poki-ad-slot','#poki-video-ad-container','[id^="poki-ag"]','[class*="ad-slot" i]','[id*="ad-container" i]'];
  const kill = () => { for (const s of sels) document.querySelectorAll(s).forEach(el => el.remove()); };
  kill();
  if (window.__pokiAdObs) window.__pokiAdObs.disconnect();
  window.__pokiAdObs = new MutationObserver(kill);
  window.__pokiAdObs.observe(document.body, { childList: true, subtree: true });
} catch (e) {}`,
  blockAdNetworks: `try {
  const adHosts = ['doubleclick.net','googlesyndication','googletagservices','google-analytics','adservice','amazon-adsystem','criteo','pubmatic','rubiconproject','openx','adnxs.com','casalemedia','indexww','onetag','smartadserver','3lift','yieldmo','richaudience','adform','adgrx','adtrafficquality','moatads','taboola','outbrain','prebid','imasdk.googleapis','/pagead/','/ads/'];
  const isAd = (u) => adHosts.some(h => String(u).toLowerCase().includes(h));
  if (!window.__pokiFetchPatched) {
    const of = window.fetch;
    window.fetch = (i, n) => {
      const u = typeof i === 'string' ? i : (i && i.url) || '';
      if (isAd(u)) return Promise.resolve(new Response('', { status: 204 }));
      return of.call(window, i, n);
    };
    const OX = window.XMLHttpRequest;
    if (OX) {
      const open = OX.prototype.open;
      OX.prototype.open = function (m, u, ...a) { this.__poki_url = u; return open.call(this, m, u, ...a); };
      const send = OX.prototype.send;
      OX.prototype.send = function (...a) { if (isAd(this.__poki_url)) { this.abort(); return; } return send.call(this, ...a); };
    }
    window.__pokiFetchPatched = true;
  }
} catch (e) {}`,
  infRevivals: `try {
  const apply = () => {
    if (window.game) {
      if (typeof window.game.freeRevivals === 'number') window.game.freeRevivals = 999;
      if (typeof window.game.paidRevivals === 'number') window.game.paidRevivals = 999;
    }
  };
  apply();
  if (window.__pokiReviveTick) clearInterval(window.__pokiReviveTick);
  window.__pokiReviveTick = setInterval(apply, 2000);
} catch (e) {}`,
  speedMul: (val) => `try {
  if (window.game) window.game.s = ${Number(val) || 1};
} catch (e) {}`,
  addCoins: (val) => `try {
  if (window.game && window.game.stats) {
    if (typeof window.game.stats.coins === 'number') window.game.stats.coins += ${Number(val) || 0};
    if (typeof window.game.stats.coin === 'number') window.game.stats.coin += ${Number(val) || 0};
  }
} catch (e) {}`,
  exposeGame: `try {
  window.__POKI = {
    game: window.game || null,
    sdk: window.PokiSDK || null,
    config: window.GAME_CONFIG || null,
    submitScore: window.dispatchSubmitScore || null,
  };
} catch (e) {}`,
  reapplyOnLoad: `try {
  if (!window.__pokiBootstrapped) {
    const reapply = () => { try { window.__pokiCheatPayload && window.__pokiCheatPayload(); } catch (e) {} };
    window.addEventListener('load', reapply);
    new MutationObserver(reapply).observe(document.documentElement, { childList: true, subtree: true });
    window.__pokiBootstrapped = true;
  }
} catch (e) {}`,
  silent: `/* silent mode: no banner */`,
  banner: `try { console.log('%c[poki-cheat-hub] active','color:#33ffaa;font-weight:bold;'); } catch (e) {}`,
};

export function buildPayload(opts) {
  const parts = [];
  if (opts.skipCommercial) parts.push(partials.skipCommercial);
  if (opts.skipRewarded) parts.push(partials.skipRewarded);
  if (opts.killDisplayAds) parts.push(partials.killDisplayAds);
  if (opts.blockAdNetworks) parts.push(partials.blockAdNetworks);
  if (opts.infRevivals) parts.push(partials.infRevivals);
  if (opts.speedMul) parts.push(partials.speedMul(opts.speedMulVal));
  if (opts.addCoins) parts.push(partials.addCoins(opts.addCoinsVal));
  if (opts.exposeGame) parts.push(partials.exposeGame);
  if (opts.reapplyOnLoad) parts.push(partials.reapplyOnLoad);
  if (!opts.silent) parts.push(partials.banner);
  return parts.join('\n');
}

export function buildConsoleSnippet(opts) {
  const body = buildPayload(opts);
  return `(() => {
${body.split('\n').map(l => '  ' + l).join('\n')}
})();`;
}

export function buildBookmarklet(opts) {
  const body = buildPayload(opts);
  const wrapped = `(function(){${body}})()`;
  return 'javascript:' + ENCODE(wrapped);
}

export function buildUserscript(opts, version = '0.1.0') {
  const body = buildPayload(opts);
  const indent = body.split('\n').map(l => '    ' + l).join('\n');
  return `// ==UserScript==
// @name         Poki Cheat Hub — Universal
// @namespace    https://github.com/yourname/poki-cheat-hub
// @version      ${version}
// @description  Skip ads + cheats for Poki games, generated by Poki Cheat Hub.
// @author       you
// @match        https://poki.com/*
// @match        https://games.poki.com/*
// @match        https://*.gdn.poki.com/*
// @match        https://game-cdn.poki.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  // Wait until PokiSDK / window.game is present before patching.
  const apply = () => {
    try {
${indent}
    } catch (e) { console.warn('[poki-cheat-hub]', e); }
  };
  const ready = () => (typeof window.PokiSDK === 'object') || (typeof window.game === 'object');
  if (ready()) apply();
  else {
    const t = setInterval(() => { if (ready()) { clearInterval(t); apply(); } }, 500);
    setTimeout(() => clearInterval(t), 60000);
  }
})();
`;
}
