# Poki Cheat Hub

> Built by **Thành Đạt**

A static, client-side cheat generator for [Poki](https://poki.com) games. No accounts, no backend, no analytics. Drop the folder on GitHub Pages / Cloudflare Pages and you're done.

> **Two deploy modes.** Pick the one that matches your risk appetite.
>
> 1. **Static (default, recommended)** — bookmarklet + console-snippet + userscript generator. Works on GitHub Pages, Cloudflare Pages, Netlify, anywhere. Zero infrastructure. Doesn't proxy Poki, doesn't violate their TOS, and can't be blocked by Poki.
> 2. **Cloudflare Worker proxy (advanced)** — reverse-proxies Poki so the game runs same-origin with your site, letting you iframe + auto-inject. Powerful, but Poki can block your Worker IPs, and you may be violating their TOS. See `cloudflare-worker/README.md`.

## What's in the box

```
poki-cheat-hub/
├── index.html              # Single-page UI
├── css/style.css           # Terminal-meets-editorial dark theme
├── js/
│   ├── app.js              # UI wiring
│   ├── generator.js        # Builds console / bookmarklet / userscript
│   └── cheats/
│       ├── universal.js    # PokiSDK overrides that work on every game
│       └── games.js        # Per-game hooks
├── cloudflare-worker/
│   ├── worker.js           # Reverse-proxy worker (advanced mode)
│   └── README.md
├── README.md
└── LICENSE
```

## Run locally

It's static HTML. Any web server works:

```bash
cd poki-cheat-hub
python3 -m http.server 8080
# open http://localhost:8080
```

The reason port 8080 is convenient: Poki's CSP `frame-ancestors` list whitelists `http://localhost:8080`. If you serve from that port, you can also iframe the real Poki page for testing — that won't work on GitHub Pages.

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "init poki-cheat-hub"
gh repo create poki-cheat-hub --public --source . --push
# Enable Pages in repo Settings → Pages → Branch: main / root
```

## Deploy to Cloudflare Pages

```bash
npm i -g wrangler
wrangler pages deploy . --project-name poki-cheat-hub
```

## How the cheats work

Every Poki game embeds a single `PokiSDK` global that bridges the game frame and Poki's ad service. The SDK exposes:

```
PokiSDK.commercialBreak()  // mid-game ad
PokiSDK.rewardedBreak()    // optional ad for reward
PokiSDK.displayAd(...)     // banner injection
PokiSDK.gameplayStart()    // analytics event
PokiSDK.gameplayStop()
...
```

Overriding these in the game frame's window scope short-circuits ads completely.

Per-game cheats target the engine's exposed globals. For Subway Surfers Web:

```js
window.game.freeRevivals = 999;   // top up free continues
window.game.s = 0.5;              // half-speed
window.game.paused = true;        // freeze
```

Different games expose different surfaces. Unity WebGL builds use `unityInstance.SendMessage(go, method, value)`. Phaser games typically expose the game on `window.game`. Voodoo titles often hide everything inside closures and need DevTools breakpoints to find the state.

The `js/cheats/games.js` registry is meant to be PR-able. Add an entry, push, your snippet is in.

## Where to run a snippet

The game lives in **two** iframes deep:

```
poki.com  →  games.poki.com/<id>  →  <id>.gdn.poki.com/<build>/index.html
```

Most of the interesting globals (`window.game`, `PokiSDK`, `GAME_CONFIG`, `dispatchSubmitScore`) live in the innermost `.gdn.poki.com` frame.

To run a snippet there:

1. Open DevTools (`F12` / `⌘⌥I`).
2. In the Console's context dropdown, pick the `*.gdn.poki.com` frame.
3. Paste, Enter.

Bookmarklets run against the currently focused frame. Click the game canvas first to focus it, then click the bookmarklet.

Userscripts via Tampermonkey can `@match` all three URL patterns and run automatically.

## License

MIT. See `LICENSE`. Game trademarks belong to their respective publishers. This project does not redistribute any game assets, and is not affiliated with Poki BV.
