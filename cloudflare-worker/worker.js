// Cloudflare Worker reverse-proxy for Poki.
// USE AT YOUR OWN RISK — may violate Poki's TOS. Cloudflare may also block this
// at scale (their free plan caps at 100k req/day, and Poki may IP-block your egress).
//
// What this does:
//  - Routes /poki/* to poki.com
//  - Routes /games/* to games.poki.com
//  - Routes /gdn/<id>/* to <id>.gdn.poki.com
//  - Strips X-Frame-Options and Content-Security-Policy on the proxied responses
//  - Rewrites HTML/JS URLs that reference poki.com|games.poki.com|*.gdn.poki.com
//    so they go through this Worker (preserves same-origin).
//
// Deploy:
//   npm i -g wrangler
//   wrangler login
//   wrangler deploy
//
// wrangler.toml (sibling file):
//   name = "poki-proxy"
//   main = "worker.js"
//   compatibility_date = "2026-01-01"
//   routes = [{ pattern = "poki-proxy.yourdomain.workers.dev/*", zone_name = "..." }]

const UPSTREAM_HOSTS = new Map([
  ['poki', 'poki.com'],
  ['games', 'games.poki.com'],
  ['cdn', 'game-cdn.poki.com'],
  ['acdn', 'a.poki-cdn.com'],
]);
const GDN_PREFIX = '/gdn/';   // /gdn/<id>/<path>

const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer',
  'upgrade', 'proxy-authenticate', 'proxy-authorization',
]);

const STRIP_RESPONSE_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Healthcheck
    if (pathname === '/' || pathname === '/_health') {
      return new Response('poki-proxy ok', { headers: { 'content-type': 'text/plain' } });
    }

    // Determine upstream
    let upstreamUrl;
    if (pathname.startsWith(GDN_PREFIX)) {
      // /gdn/<id>/<rest>
      const rest = pathname.slice(GDN_PREFIX.length);
      const slash = rest.indexOf('/');
      if (slash === -1) return new Response('bad gdn path', { status: 400 });
      const id = rest.slice(0, slash);
      const after = rest.slice(slash);
      upstreamUrl = `https://${id}.gdn.poki.com${after}${url.search}`;
    } else {
      const [, prefix, ...rest] = pathname.split('/');
      const host = UPSTREAM_HOSTS.get(prefix);
      if (!host) return new Response('unknown route', { status: 404 });
      upstreamUrl = `https://${host}/${rest.join('/')}${url.search}`;
    }

    // Build upstream request
    const upstreamHeaders = new Headers();
    for (const [k, v] of request.headers) {
      if (HOP_BY_HOP_HEADERS.has(k.toLowerCase())) continue;
      if (k.toLowerCase() === 'host') continue;
      upstreamHeaders.set(k, v);
    }
    // Pretend referer comes from poki.com
    upstreamHeaders.set('referer', 'https://poki.com/');
    upstreamHeaders.set('origin', 'https://poki.com');

    const upstreamReq = new Request(upstreamUrl, {
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

    // Follow redirects manually, rewriting Location
    if ([301, 302, 303, 307, 308].includes(upstreamResp.status)) {
      const loc = upstreamResp.headers.get('location');
      if (loc) {
        const rewritten = rewriteUrlToProxy(loc, url.origin);
        return new Response(null, {
          status: upstreamResp.status,
          headers: { location: rewritten },
        });
      }
    }

    // Strip dangerous headers
    const respHeaders = new Headers(upstreamResp.headers);
    for (const k of [...respHeaders.keys()]) {
      if (STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) respHeaders.delete(k);
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

function rewriteUrlToProxy(absoluteUrl, proxyOrigin) {
  try {
    const u = new URL(absoluteUrl, 'https://poki.com');
    if (u.hostname === 'poki.com' || u.hostname === 'www.poki.com')
      return `${proxyOrigin}/poki${u.pathname}${u.search}`;
    if (u.hostname === 'games.poki.com')
      return `${proxyOrigin}/games${u.pathname}${u.search}`;
    if (u.hostname === 'game-cdn.poki.com')
      return `${proxyOrigin}/cdn${u.pathname}${u.search}`;
    if (u.hostname === 'a.poki-cdn.com')
      return `${proxyOrigin}/acdn${u.pathname}${u.search}`;
    const gdn = /^([^.]+)\.gdn\.poki\.com$/.exec(u.hostname);
    if (gdn) return `${proxyOrigin}/gdn/${gdn[1]}${u.pathname}${u.search}`;
    return absoluteUrl;
  } catch {
    return absoluteUrl;
  }
}

function rewriteBody(body, proxyOrigin) {
  return body
    .replace(/https:\/\/poki\.com/g, `${proxyOrigin}/poki`)
    .replace(/https:\/\/www\.poki\.com/g, `${proxyOrigin}/poki`)
    .replace(/https:\/\/games\.poki\.com/g, `${proxyOrigin}/games`)
    .replace(/https:\/\/game-cdn\.poki\.com/g, `${proxyOrigin}/cdn`)
    .replace(/https:\/\/a\.poki-cdn\.com/g, `${proxyOrigin}/acdn`)
    .replace(/https:\/\/([a-z0-9-]+)\.gdn\.poki\.com/g, `${proxyOrigin}/gdn/$1`);
}
