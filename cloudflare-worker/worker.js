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
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  if (!resp.ok) return new Response('not found', { status: 404 });
  return new Response(resp.body, {
    status: 200,
    headers: {
      'content-type': staticContentType(pathname),
      'cache-control': 'public, max-age=60',
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
    .replace(/https?:\/\/(?:www\.)?poki\.com/g, proxyOrigin)
    .replace(/https?:\/\/games\.poki\.com/g, `${proxyOrigin}/_games`)
    .replace(/https?:\/\/game-cdn\.poki\.com/g, `${proxyOrigin}/_cdn`)
    .replace(/https?:\/\/a\.poki-cdn\.com/g, `${proxyOrigin}/_acdn`)
    .replace(/https?:\/\/([a-z0-9-]+)\.gdn\.poki\.com/g, `${proxyOrigin}/_gdn/$1`);
}

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
      upstreamResp = await fetch(upstreamReq);
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

    const text = await upstreamResp.text();
    const rewritten = rewriteBody(text, url.origin);
    return new Response(rewritten, {
      status: upstreamResp.status,
      headers: respHeaders,
    });
  },
};
