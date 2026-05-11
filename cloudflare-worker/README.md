# Cloudflare Worker — Poki reverse-proxy (advanced mode)

This Worker proxies Poki under a single origin so the game frame becomes same-origin with your hub site. That unlocks iframe embedding *and* lets you inject cheats directly into the game frame from the parent page.

> **Read this before deploying.** This mode reverse-proxies third-party content. Poki's TOS likely forbids it, and they can block your Worker by Cloudflare AS or by detecting the rewriting heuristics. Treat this as a research toy, not as production.

## What it does

- Maps Poki domains under path prefixes:

  | Prefix | Upstream |
  |---|---|
  | `/poki/*` | `poki.com` |
  | `/games/*` | `games.poki.com` |
  | `/cdn/*` | `game-cdn.poki.com` |
  | `/acdn/*` | `a.poki-cdn.com` |
  | `/gdn/<id>/*` | `<id>.gdn.poki.com` (per-game frame) |

- Strips `X-Frame-Options`, `Content-Security-Policy`, `COOP/COEP/CORP` from every response, so embedding works.
- Rewrites absolute Poki URLs inside HTML/JS/JSON/CSS bodies so they go through the Worker.
- Forces `referer: https://poki.com/` upstream so Poki's edge logic doesn't see the proxy.

## Deploy

```bash
npm i -g wrangler
wrangler login        # opens browser, authenticates
cd cloudflare-worker
wrangler deploy
```

You'll get a URL like `https://poki-proxy.<your-account>.workers.dev`. Visit `/_health` to confirm.

To proxy a game: `https://poki-proxy.<your-account>.workers.dev/poki/en/g/subway-surfers`.

## How to iframe + inject

Once the proxy is live, your hub page (on the same Worker domain) can:

```html
<iframe id="g" src="/poki/en/g/subway-surfers"></iframe>
<script>
  document.getElementById('g').addEventListener('load', () => {
    const frame = document.getElementById('g').contentWindow;
    // Same-origin now — you can recursively walk frame trees.
    const inject = (win) => {
      try { win.eval(`/* paste your snippet here */`); } catch (e) {}
      Array.from(win.frames).forEach(inject);
    };
    setTimeout(() => inject(frame), 5000);
  });
</script>
```

## Limits / failure modes

- **Cloudflare free plan**: 100k requests/day total. Each game asset is one request — heavy.
- **Worker CPU limit**: 50 ms CPU / request on free plan. Large HTML rewrites can blow this.
- **No streaming rewrite**: we buffer responses before rewriting. Big game bundles (1+ MB JS) work but blow your subrequest budget.
- **Poki may block**: they can block referer headers, check fingerprints, or rate-limit by Cloudflare egress IP. Rotate your Worker URL when this happens.
- **Asset URLs may break**: some Poki scripts construct URLs from string fragments. If a fragment doesn't match our rewrite regex, it'll 404. Add more regex cases when you spot them.

## Local testing

```bash
wrangler dev
# Worker runs on http://127.0.0.1:8787
# Open http://127.0.0.1:8787/poki/en/g/subway-surfers
```
