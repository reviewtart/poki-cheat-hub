// Cloudflare Worker — Poki reverse-proxy + cheat-hub static host.
//
// Routes:
//   GET /_health                              → ok
//   GET /, /index.html, /css/*, /js/*,
//       /assets/*, /README.md, /LICENSE       → static cheat-hub (from GitHub raw)
//   GET /_games/*                             → games.poki.com/*
//   GET /_cdn/*                               → game-cdn.poki.com/*
//   GET /_acdn/*                              → a.poki-cdn.com/*
//   GET /_gdn/<id>/*                          → <id>.gdn.poki.com/*
//   GET /<anything else>                      → poki.com/<anything else>
//
// HTML/JS/CSS/JSON bodies have URLs rewritten so all Poki domains map to the
// worker's own origin → game iframe runs same-origin with the parent site.

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer',
  'upgrade', 'proxy-authenticate', 'proxy-authorization',
]);
const STRIP_RESP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  // Strip preload Link header — Poki sends "Link: <poki-cdn..poki-sdk.js>; rel=preload"
  // which makes the browser fetch the real SDK directly, bypassing our stub.
  'link',
]);

const STATIC_ORIGIN = 'https://raw.githubusercontent.com/reviewtart/poki-cheat-hub/main';
const STATIC_PATHS = new Set([
  '/', '/index.html',
  '/README.md', '/LICENSE',
  '/css/style.css',
  '/js/app.js', '/js/play.js', '/js/generator.js',
  '/js/cheats/games.js', '/js/cheats/universal.js',
]);
function isStaticPath(p) {
  if (STATIC_PATHS.has(p)) return true;
  if (p.startsWith('/js/') || p.startsWith('/css/') || p.startsWith('/assets/')) return true;
  return false;
}
function staticContentType(p) {
  if (p.endsWith('.html') || p === '/') return 'text/html; charset=utf-8';
  if (p.endsWith('.css')) return 'text/css; charset=utf-8';
  if (p.endsWith('.js') || p.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (p.endsWith('.json')) return 'application/json; charset=utf-8';
  if (p.endsWith('.md')) return 'text/plain; charset=utf-8';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
async function serveStatic(pathname) {
  const remote = pathname === '/' ? '/index.html' : pathname;
  const resp = await fetch(STATIC_ORIGIN + remote, {
    cf: { cacheTtl: 5, cacheEverything: true },
  });
  if (!resp.ok) return new Response('not found', { status: 404 });
  return new Response(resp.body, {
    status: 200,
    headers: {
      'content-type': staticContentType(pathname),
      'cache-control': 'public, max-age=5, must-revalidate',
      'access-control-allow-origin': '*',
    },
  });
}

function pickUpstream(pathname) {
  // Returns { url, kind } where url is upstream absolute URL.
  if (pathname.startsWith('/_games/')) {
    return { url: 'https://games.poki.com' + pathname.slice('/_games'.length), kind: 'games' };
  }
  if (pathname.startsWith('/_cdn/')) {
    return { url: 'https://game-cdn.poki.com' + pathname.slice('/_cdn'.length), kind: 'cdn' };
  }
  if (pathname.startsWith('/_acdn/')) {
    return { url: 'https://a.poki-cdn.com' + pathname.slice('/_acdn'.length), kind: 'acdn' };
  }
  if (pathname.startsWith('/_gdn/')) {
    // /_gdn/<id>/<rest>
    const rest = pathname.slice('/_gdn/'.length);
    const slash = rest.indexOf('/');
    const id = slash === -1 ? rest : rest.slice(0, slash);
    const after = slash === -1 ? '/' : rest.slice(slash);
    return { url: `https://${id}.gdn.poki.com${after}`, kind: 'gdn' };
  }
  // Default: poki.com
  return { url: 'https://poki.com' + pathname, kind: 'poki' };
}

function rewriteUrlAbsolute(absoluteUrl, proxyOrigin) {
  try {
    const u = new URL(absoluteUrl, 'https://poki.com');
    if (u.hostname === 'poki.com' || u.hostname === 'www.poki.com')
      return `${proxyOrigin}${u.pathname}${u.search}${u.hash}`;
    if (u.hostname === 'games.poki.com')
      return `${proxyOrigin}/_games${u.pathname}${u.search}${u.hash}`;
    if (u.hostname === 'game-cdn.poki.com')
      return `${proxyOrigin}/_cdn${u.pathname}${u.search}${u.hash}`;
    if (u.hostname === 'a.poki-cdn.com')
      return `${proxyOrigin}/_acdn${u.pathname}${u.search}${u.hash}`;
    const gdn = /^([^.]+)\.gdn\.poki\.com$/.exec(u.hostname);
    if (gdn) return `${proxyOrigin}/_gdn/${gdn[1]}${u.pathname}${u.search}${u.hash}`;
    return absoluteUrl;
  } catch {
    return absoluteUrl;
  }
}

function rewriteBody(body, proxyOrigin) {
  return body
    // Protocol-relative first (//host/...) so we don't double-rewrite
    .replace(/(["'\(\s])\/\/(?:www\.)?poki\.com/g, `$1${proxyOrigin}`)
    .replace(/(["'\(\s])\/\/games\.poki\.com/g, `$1${proxyOrigin}/_games`)
    .replace(/(["'\(\s])\/\/game-cdn\.poki\.com/g, `$1${proxyOrigin}/_cdn`)
    .replace(/(["'\(\s])\/\/a\.poki-cdn\.com/g, `$1${proxyOrigin}/_acdn`)
    .replace(/(["'\(\s])\/\/([a-z0-9-]+)\.gdn\.poki\.com/g, `$1${proxyOrigin}/_gdn/$2`)
    // Absolute
    .replace(/https?:\/\/(?:www\.)?poki\.com/g, proxyOrigin)
    .replace(/https?:\/\/games\.poki\.com/g, `${proxyOrigin}/_games`)
    .replace(/https?:\/\/game-cdn\.poki\.com/g, `${proxyOrigin}/_cdn`)
    .replace(/https?:\/\/a\.poki-cdn\.com/g, `${proxyOrigin}/_acdn`)
    .replace(/https?:\/\/([a-z0-9-]+)\.gdn\.poki\.com/g, `${proxyOrigin}/_gdn/$1`)
    // Neutralize sitelock redirects ("/sitelock" → harmless data URL no-op)
    .replace(/(["'`])\/sitelock(["'`])/g, '$1data:text/html,<title>sitelock-blocked</title>$2')
    .replace(/(["'`])\/_games\/sitelock(["'`])/g, '$1data:text/html,<title>sitelock-blocked</title>$2');
}

// Anti-sitelock pre-script injected at the top of every HTML page served.
// Blocks navigation to /sitelock, game-not-available, and any poki.com URL
// that's not via our proxy origin. Also fakes top-origin checks.
const SITELOCK_BUSTER = `<script>
(function(){
  const PROXY_ORIGIN = location.origin;
  const isBlock = (u) => {
    const s = String(u || '');
    return /\\/sitelock(?:[?#/]|$)/i.test(s)
        || /game-not-available/i.test(s)
        || (/^https?:\\/\\/(?:www\\.|games\\.)?poki\\.com/i.test(s) && !s.startsWith(PROXY_ORIGIN));
  };
  const log = (label, u) => { try { console.warn('[sitelock-block:' + label + ']', u); } catch (e) {} };

  try {
    const realAssign = Location.prototype.assign;
    Location.prototype.assign = function(u) { if (isBlock(u)) { log('assign', u); return; } return realAssign.call(this, u); };
  } catch (e) {}
  try {
    const realReplace = Location.prototype.replace;
    Location.prototype.replace = function(u) { if (isBlock(u)) { log('replace', u); return; } return realReplace.call(this, u); };
  } catch (e) {}
  try {
    const desc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
    if (desc?.set) {
      Object.defineProperty(Location.prototype, 'href', {
        get: desc.get,
        set: function(v) { if (isBlock(v)) { log('href-set', v); return; } desc.set.call(this, v); },
        configurable: true,
      });
    }
  } catch (e) {}

  // Patch window.open similarly
  try {
    const realOpen = window.open;
    window.open = function(u, ...a) { if (isBlock(u)) { log('open', u); return null; } return realOpen.call(window, u, ...a); };
  } catch (e) {}

  // Intercept <meta http-equiv=refresh> insertions
  try {
    const observer = new MutationObserver((mut) => {
      for (const m of mut) {
        for (const node of m.addedNodes) {
          if (node.tagName === 'META' && /refresh/i.test(node.getAttribute?.('http-equiv') || '')) {
            const c = node.getAttribute('content') || '';
            if (isBlock(c.split(';')[1])) { log('meta-refresh', c); node.remove(); }
          }
          if (node.tagName === 'IFRAME' && isBlock(node.src)) { log('iframe-src', node.src); node.remove(); }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  // Override window.location setter (window.location = "..." direct assignment)
  try {
    const winLocDesc = Object.getOwnPropertyDescriptor(Window.prototype, 'location')
                    || Object.getOwnPropertyDescriptor(window, 'location');
    if (winLocDesc?.set) {
      Object.defineProperty(window, 'location', {
        get: winLocDesc.get.bind(window),
        set: function(v) { if (isBlock(v)) { log('window.location-set', v); return; } winLocDesc.set.call(window, v); },
        configurable: true,
      });
    }
  } catch (e) {}

  // Override document.location too
  try {
    const docLocDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'location')
                    || Object.getOwnPropertyDescriptor(document, 'location');
    if (docLocDesc?.set) {
      Object.defineProperty(document, 'location', {
        get: docLocDesc.get.bind(document),
        set: function(v) { if (isBlock(v)) { log('document.location-set', v); return; } docLocDesc.set.call(document, v); },
        configurable: true,
      });
    }
  } catch (e) {}

  // Block form submissions to blocked URLs
  try {
    document.addEventListener('submit', function(e) {
      if (isBlock(e.target?.action)) { log('form-submit', e.target.action); e.preventDefault(); e.stopPropagation(); }
    }, true);
  } catch (e) {}

  // Block <a> clicks
  try {
    document.addEventListener('click', function(e) {
      const a = e.target?.closest?.('a[href]');
      if (a && isBlock(a.href)) { log('anchor-click', a.href); e.preventDefault(); e.stopPropagation(); }
    }, true);
  } catch (e) {}

  // Fake document.referrer = poki.com (some games verify)
  try { Object.defineProperty(document, 'referrer', { get: () => 'https://poki.com/', configurable: true }); } catch (e) {}

  // Fake top.location checks — many games do top.location.hostname === 'poki.com'
  try {
    const fakeHostname = 'poki.com';
    const origDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'hostname');
    Object.defineProperty(Location.prototype, 'hostname', {
      get: function() {
        const real = origDesc.get.call(this);
        // Tell games we are poki.com
        if (real.endsWith('workers.dev') || real === PROXY_ORIGIN.replace(/^https?:\\/\\//, '').replace(/[\\/:]/, '')) return fakeHostname;
        return real;
      },
      configurable: true,
    });
  } catch (e) {}

  // Nuke any service workers — Poki may have left one that redirects.
  try {
    if (navigator.serviceWorker?.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(rs => {
        for (const r of rs) { r.unregister(); console.warn('[sitelock-buster] unregistered SW:', r.scope); }
      });
    }
  } catch (e) {}

  // Track every navigation attempt so we can debug
  window.addEventListener('beforeunload', function () {
    console.warn('[sitelock-buster] beforeunload! current=' + location.href);
  }, true);

  console.log('[sitelock-buster] armed @ ' + PROXY_ORIGIN);
})();
</script>`;

// Replacement for Poki's SDK. The real SDK checks the parent origin and
// refuses to start the game when it's not poki.com — that's what makes
// removed-from-Poki games show "SORRY! not available". Our stub fakes a
// happy SDK so the game initialises normally.
const POKI_SDK_STUB = `
(function () {
  if (window.PokiSDK) return;
  const noop = () => {};
  const ok = () => Promise.resolve();
  const okTrue = () => Promise.resolve(true);
  const stub = {
    init: ok,
    initWithVideoHB: ok,
    commercialBreak: ok,
    rewardedBreak: okTrue,
    displayAd: () => false,
    destroyAd: noop,
    getLeaderboard: () => Promise.resolve([]),
    shareableURL: () => Promise.resolve(''),
    getURLParam: (k) => new URLSearchParams(location.search).get(k),
    getLanguage: () => 'en',
    getIsoLanguage: () => 'en',
    isAdBlocked: () => false,
    getUser: () => null,
    getToken: () => null,
    login: () => Promise.resolve(null),
    generateScreenshot: () => Promise.resolve(),
    captureError: noop,
    customEvent: noop,
    gameInteractive: noop,
    gameLoadingFinished: noop,
    gameLoadingProgress: noop,
    gameLoadingStart: noop,
    gameplayStart: noop,
    gameplayStop: noop,
    happyTime: noop,
    logError: noop,
    muteAd: noop,
    roundEnd: noop,
    roundStart: noop,
    sendHighscore: noop,
    setActiveLanguage: noop,
    setDebug: noop,
    setVolume: noop,
    EVENTS: {},
  };
  window.PokiSDK = stub;
  try { console.log('[poki-sdk-stub] loaded — bypassing origin check'); } catch (e) {}
})();
`;

function isPokiSdkPath(p) {
  return /\/poki-sdk[a-zA-Z0-9_-]*\.js$/.test(p);
}

// Ad-killer injected into /play/<id> mirror games. The freebuisness/html
// mirror embeds AdSense (#sidebarad1/2, googletagmanager, obfuscated loaders).
// We block requests + strip DOM nodes + hide dim backdrops continuously.
const AD_KILLER = `<style id="pch-ad-css">
  /* Pre-emptive CSS hide so ads stay invisible even before JS runs */
  #sidebarad1, #sidebarad2,
  iframe[src*="googlesyndication"],
  iframe[src*="googleads"],
  iframe[src*="doubleclick"],
  iframe[src*="googletag"],
  iframe[id^="aswift"],
  iframe[id^="google_ads"],
  ins.adsbygoogle,
  [id^="aswift_"],
  [id*="google_ads_iframe"],
  div[data-google-query-id] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
    width: 0 !important;
    height: 0 !important;
  }
</style>
<script>
(function(){
  const AD_RE = /googlesyndication|doubleclick|adservice|adsystem|pagead|googletagmanager|googletagservices|google-analytics\\.com|tpc\\.googlesyndication|partner\\.googleadservices|fundingchoices|criteo|pubmatic|adnxs|amazon-adsystem|outbrain|taboola|imasdk|moatads|smartadserver/i;

  // 1. Block ad-network fetches
  try {
    const _fetch = window.fetch;
    window.fetch = function(input) {
      const u = typeof input === 'string' ? input : (input && input.url) || '';
      if (AD_RE.test(u)) return Promise.resolve(new Response('', { status: 204 }));
      return _fetch.apply(this, arguments);
    };
  } catch(e){}
  try {
    const X = window.XMLHttpRequest;
    if (X) {
      const o = X.prototype.open;
      X.prototype.open = function(m, u) { this.__pch_u = u; return o.apply(this, arguments); };
      const s = X.prototype.send;
      X.prototype.send = function() { if (AD_RE.test(this.__pch_u || '')) { this.abort(); return; } return s.apply(this, arguments); };
    }
  } catch(e){}

  // 2. Block <script>/<iframe>.src assignments to ad URLs
  try {
    for (const proto of [HTMLScriptElement.prototype, HTMLIFrameElement.prototype]) {
      const desc = Object.getOwnPropertyDescriptor(proto, 'src');
      if (!desc || !desc.set) continue;
      Object.defineProperty(proto, 'src', {
        get: desc.get,
        set: function(v) {
          if (AD_RE.test(String(v))) { try { console.warn('[ad-killer] blocked .src=', v); } catch(_){} return; }
          return desc.set.call(this, v);
        },
        configurable: true,
      });
    }
  } catch(e){}

  // 3. Strip DOM nodes — known selectors + dim overlays containing ad iframes
  const SELECTORS = [
    '#sidebarad1', '#sidebarad2',
    'iframe[src*="googleads"]', 'iframe[src*="googlesyndication"]',
    'iframe[src*="doubleclick"]', 'iframe[src*="googletag"]',
    'iframe[id^="aswift"]', 'iframe[id^="google_ads"]',
    'ins.adsbygoogle', '[id^="aswift_"]', '[id*="google_ads_iframe"]',
    'div[data-google-query-id]',
    'script[src*="googlesyndication"]', 'script[src*="googletagmanager"]',
    'script[src*="googletagservices"]',
  ];
  const killAds = () => {
    let n = 0;
    for (const sel of SELECTORS) {
      try { document.querySelectorAll(sel).forEach(el => { try { el.remove(); n++; } catch(_){} }); } catch(_){}
    }
    // Fixed full-viewport overlays with dim backdrop OR containing an ad iframe
    try {
      document.querySelectorAll('div').forEach(d => {
        if (!d.isConnected) return;
        const cs = getComputedStyle(d);
        if (cs.position !== 'fixed') return;
        const z = parseInt(cs.zIndex || '0', 10);
        const r = d.getBoundingClientRect();
        const isLarge = r.width >= window.innerWidth * 0.7 && r.height >= window.innerHeight * 0.7;
        const bg = cs.backgroundColor || '';
        const isDim = /rgba\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*,\\s*0?\\.[3-9]/.test(bg);
        const hasAdIframe = d.querySelector('iframe[src*="google"], iframe[src*="doubleclick"], iframe[id^="google_ads"], iframe[id^="aswift"]');
        const hasOwnCanvas = d.querySelector('canvas');
        if (z >= 1000 && isLarge && !hasOwnCanvas && (isDim || hasAdIframe)) {
          try { d.remove(); n++; } catch(_){}
        }
      });
    } catch(_){}
    if (n) try { console.log('[ad-killer] removed', n, 'nodes'); } catch(_){}
  };
  killAds();
  try {
    new MutationObserver(killAds).observe(document.documentElement, { childList: true, subtree: true });
  } catch(_){}
  setInterval(killAds, 800);

  try { console.log('[ad-killer] armed'); } catch(_){}
})();
</script>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/_health') {
      return new Response('poki-proxy ok', { headers: { 'content-type': 'text/plain' } });
    }
    if (isStaticPath(pathname)) {
      return serveStatic(pathname);
    }
    if (isPokiSdkPath(pathname)) {
      return new Response(POKI_SDK_STUB, {
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          'cache-control': 'public, max-age=300',
          'access-control-allow-origin': '*',
        },
      });
    }

    // /play/<id> — proxy a freebuisness/html mirrored game with proper
    // content-type so the browser renders it. The upstream serves text/plain
    // (because of GitHub's nosniff), which makes the browser show source.
    if (pathname.startsWith('/play/')) {
      const id = pathname.slice('/play/'.length).replace(/\.html$/, '');
      // Use raw.githubusercontent.com directly — jsdelivr causes worker fetch
      // redirect loops because both are on Cloudflare.
      const upstream = `https://raw.githubusercontent.com/freebuisness/html/main/${id}.html`;
      try {
        const r = await fetch(upstream, { cf: { cacheTtl: 300, cacheEverything: true } });
        if (!r.ok) return new Response('game not found: ' + id, { status: r.status });
        let text = await r.text();
        text = text.replace(/<head([^>]*)>/i, `<head$1>${SITELOCK_BUSTER}${AD_KILLER}`);
        return new Response(text, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'access-control-allow-origin': '*',
            'cache-control': 'public, max-age=300',
          },
        });
      } catch (e) {
        return new Response('upstream err: ' + e.message, { status: 502 });
      }
    }

    const { url: upstreamUrl } = pickUpstream(pathname);

    // Build upstream request
    const upstreamHeaders = new Headers();
    for (const [k, v] of request.headers) {
      const kl = k.toLowerCase();
      if (HOP_BY_HOP.has(kl)) continue;
      if (kl === 'host') continue;
      if (kl === 'cf-connecting-ip' || kl === 'cf-ray' || kl === 'cf-visitor') continue;
      upstreamHeaders.set(k, v);
    }
    upstreamHeaders.set('referer', 'https://poki.com/');
    upstreamHeaders.set('origin', 'https://poki.com');

    const upstreamReq = new Request(upstreamUrl + url.search, {
      method: request.method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    let upstreamResp;
    try {
      // Short cache TTL — upstream sends max-age=31536000 but we need our
      // header strips and body rewrites to take effect quickly.
      // cacheEverything: true forces our TTL over upstream's cache-control.
      upstreamResp = await fetch(upstreamReq, {
        cf: { cacheTtl: 30, cacheEverything: true, cacheKey: `v2-${upstreamUrl}` },
      });
    } catch (e) {
      return new Response('upstream error: ' + e.message, { status: 502 });
    }

    // Manual redirect rewriting
    if ([301, 302, 303, 307, 308].includes(upstreamResp.status)) {
      const loc = upstreamResp.headers.get('location');
      if (loc) {
        const rewritten = rewriteUrlAbsolute(loc, url.origin);
        return new Response(null, {
          status: upstreamResp.status,
          headers: { location: rewritten },
        });
      }
    }

    const respHeaders = new Headers(upstreamResp.headers);
    for (const k of [...respHeaders.keys()]) {
      if (STRIP_RESP_HEADERS.has(k.toLowerCase())) respHeaders.delete(k);
    }
    respHeaders.set('access-control-allow-origin', '*');

    const ct = (upstreamResp.headers.get('content-type') || '').toLowerCase();
    const shouldRewrite = ct.includes('html') || ct.includes('javascript') || ct.includes('json') || ct.includes('css');

    if (!shouldRewrite) {
      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        headers: respHeaders,
      });
    }

    let text = await upstreamResp.text();
    text = rewriteBody(text, url.origin);
    // Inject sitelock-buster at the top of every HTML response so the game's
    // anti-iframe redirect can't take effect.
    if (ct.includes('html')) {
      text = text.replace(/<head([^>]*)>/i, `<head$1>${SITELOCK_BUSTER}${AD_KILLER}`);
    }
    return new Response(text, {
      status: upstreamResp.status,
      headers: respHeaders,
    });
  },
};
