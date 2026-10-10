# Project Ayesha — a cinematic love letter

A single-page, dependency-free website whose signature is a **heart built out of
real words**: every phrase is a text element packed inside a parametric heart
curve, blooming out from the centre, then the main reveal, a secret letter, and
a hidden easter egg.

Plain HTML + CSS + JavaScript + SVG. No framework, no build step, no backend,
no paid API, no tracking. It runs from a file:// URL or any static host.

---

## 1. Files

```
ayesha-love/
├── index.html            markup: the five scenes, the no-JS fallback
├── style.css             design tokens, layout, animation, responsive rules
├── script.js             ← ALL EDITABLE TEXT IS HERE (SECTION 1: CONFIG)
├── .nojekyll             keeps GitHub Pages from re-processing the folder
├── assets/
│   ├── share-card.png    1200×630 preview shown when you share the link
│   └── audio/README.txt  how to switch the optional music on
├── tests/
│   ├── run.sh                 runs every check below in one go
│   ├── heart-layout.test.js   geometry + word-packing checks (17)
│   ├── dom-audit.js           html/css/js cross-checks (11)
│   ├── smoke.test.js          executes every interaction (15, DOM shim)
│   ├── render_preview.py      renders the heart to a PNG for eyeballing
│   ├── make_share_card.py     builds assets/share-card.png for link previews
│   ├── heart-preview.svg      written by the layout test
│   └── layout.json            written by the layout test (input for the PNG)
└── README.md             this file
```

## 2. Run it locally

Nothing to install.

* **Easiest:** open `index.html` in a browser (double-click it, or copy the
  folder to your phone and open it with a file browser).
* **Nicer:** serve the folder so relative paths behave exactly like production:

  ```sh
  cd ayesha-love
  python3 -m http.server 8099
  # then open http://localhost:8099
  ```

The page works offline. The two Google Fonts links are optional: if the network
is blocked the site falls back to Georgia/system fonts and still lays out
correctly (the heart measures text with whatever font actually loaded).

## 3. Editing the words — one place only

Open **`script.js`**, the `CONFIG` block at the top (it is clearly fenced with
`SECTION 1 — CONFIG`). Everything personal lives there:

| Key | What it changes |
|-----|-----------------|
| `opening.*` | eyebrow, name, tagline, button label of the first screen |
| `heart.phrases[]` | the phrases packed into the heart (`text`, optional `weight`, `hero`) |
| `heart.tokens[]` | short filler words used to close the gaps in the shape |
| `heart.font/baseSize/minSize/pitchFactor/pad/gap/seed` | typography & packing feel |
| `main.*` | the big reveal: title, heart glyph, sub-line |
| `letter.*` | the envelope invitation, button labels, the letter body |
| `egg.*` | how many taps reveal the secret, and what it says |
| `audio.*` | music file, volume, fade time (see §4) |
| `motion.*` | number of drifting motes and tap-hearts |

`index.html` contains the *same* default copy, but only as a no-JavaScript
fallback — you normally never touch it. If you change a string in `CONFIG`,
nothing else needs to change.

Add or remove phrases freely: the layout re-measures and re-packs the shape on
every load. The `weight` value is a size multiplier (`1.15` = 15 % larger) and
the phrase marked `hero: true` claims the widest row.

## 4. Music (off by default, and honest about it)

No audio ships with the site, so the **Music button is visible but disabled**
and says *"No audio file added yet — see README.md to switch music on."* The
site never claims to be playing anything.

To turn it on: drop a properly licensed file at `assets/audio/ambient.mp3`
(licensing notes in `assets/audio/README.txt`) and set

```js
audio: { src: 'assets/audio/ambient.mp3', ... }
```

Playback then fades in, loops, and reports real errors.

## 5. How the heart works

1. `heartPoints()` samples the classic curve `x = 16 sin³t`,
   `y = 13cos t − 5cos 2t − 2cos 3t − cos 4t` (1400 points, y flipped so the
   point of the heart sits at the bottom).
2. `insideIntervals()` computes, for any height, exactly which horizontal
   spans are *inside* the shape — two spans above the cleft, one below.
3. `buildHeartLayout()` lays horizontal rows (tighter steps near the point),
   sorts rows widest-first and phrases longest-first, then packs **the longest
   phrase that fits into each slot** so a big line never gets squeezed into a
   narrow row. Leftover gaps are filled with rotating short tokens, and one
   small word finishes the tip.
4. The result is rendered as an inline SVG: a whisper-thin crimson contour plus
   one `<text>` element per word. Each word starts displaced towards the centre
   and blooms outward with a staggered delay.
5. The SVG has `role="img"` with a `<title>` and a `<desc>` that lists every
   phrase — a screen reader gets the full message as one sentence, and the
   shape is deterministic (fixed seed) so it looks identical on every load.

Everything is resolution-independent: the layout is computed in "heart units"
and scaled by the viewBox, so rotating or resizing a phone never re-flows the
composition.

## 6. Tests and visual checks

```sh
cd ayesha-love
sh tests/run.sh                # everything, one command
```

or run them individually:

```sh
node --check script.js                  # syntax
node tests/heart-layout.test.js         # 17 geometry / packing checks
node tests/dom-audit.js                 # 11 html↔css↔js cross-checks
node tests/smoke.test.js                # 15 interaction checks (DOM shim)
```

`smoke.test.js` drives the real `script.js` through a minimal DOM shim: it
opens the surprise, builds the heart, waits for the reveal, replays three
times, opens/closes the letter, taps the easter egg, presses the music button
and taps empty space — asserting that the DOM contracts hold and that **no
second animation loop** appears. It is not a browser (no layout, CSS or
rendering), so §9 still matters.

`heart-layout.test.js` also writes `tests/layout.json`, which the PNG renderer
uses so you can *see* the composition without a browser:

```sh
python3 tests/render_preview.py tests/layout.json /tmp/heart.png
```

The renderer squeezes each glyph run to the exact width the layout reserved —
the same box the browser uses — so the preview shows real packing.

## 7. Going live — a shareable link, and your own domain

**Deployed:** `https://akash-rizz.github.io/ayesha-love/` — public repository
`Akash-rizz/ayesha-love`, served by GitHub Pages from the `main` branch. No
account was created on anyone's behalf and no custom domain was bought (the
custom-domain recipe in §7B is there for whenever it is wanted).

### A. How this was deployed (re-runnable any time)

`gh auth login` needed scopes the shared token did not have, so the push went
through plain `git` + the REST API with a fine-grained-ish classic token
(`public_repo` scope only):

```sh
cd ~/ayesha-love
git init -b main
git add -A && git commit -m "Project Ayesha"

# create the repo once
curl -X POST -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/user/repos \
     -d '{"name":"ayesha-love","private":false,"auto_init":false}'

# push (token read from the environment, never written into the remote URL)
git -c credential.helper= \
    -c credential.helper='!f() { echo "username=Akash-rizz"; echo "password=$GH_TOKEN"; }; f' \
    push https://github.com/Akash-rizz/ayesha-love.git main

# turn Pages on
curl -X POST -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/Akash-rizz/ayesha-love/pages \
     -d '{"source":{"branch":"main","path":"/"}}'
```

If `gh` works for you (`gh auth login` succeeds), this is all one command:

```sh
gh repo create ayesha-love --public --source=. --push
gh api -X POST repos/$(gh api user -q .login)/ayesha-love/pages \
       -f "source[branch]=main" -f "source[path]=/"
```

About a minute later the site is live at:

```
https://<your-username>.github.io/ayesha-love/
```

Share that link anywhere — WhatsApp, Chrome, Instagram bio. Heads-up: a free
GitHub account can only serve Pages from a **public** repo, so the source code
is readable by anyone who has the link. The words are public either way once
the site is live, but you should know the difference.

*Prefer drag-and-drop?* `netlify.app/drop` or Cloudflare Pages accept the
folder straight from a phone browser and give you a `*.netlify.app` /
`*.pages.dev` link. Same files, no terminal.

### B. Your own custom domain

1. **Buy a domain** (₹700–1,200 a year for a `.com`; `.in`/`.xyz` are cheaper):
   Cloudflare Registrar sells at cost and has no renewal markup — best value.
   Namecheap, GoDaddy and BigRock also work. This is the only paid part.
2. **Point its DNS at GitHub Pages** (in the registrar's dashboard):

   | Type | Name | Value |
   |------|------|-------|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `<your-username>.github.io` |

3. **Tell GitHub about it** — add a file named `CNAME` at the repo root
   containing only your domain (no `https://`):

   ```sh
   cd ~/ayesha-love
   printf 'love.example.com\n' > CNAME
   gh api -X PUT repos/$(gh api user -q .login)/ayesha-love/contents/CNAME \
          -f message="custom domain" -f content="$(base64 -w0 CNAME)" \
          -f branch=main
   ```

4. Repo → **Settings → Pages → Custom domain** → type it → *Save*. Wait for
   the DNS check to go green, then tick **Enforce HTTPS** — GitHub issues a
   free Let's Encrypt certificate automatically. `https://love.example.com`
   is now your link.

DNS can take a few minutes to a few hours to propagate.

### C. Two small things after it is live

1. In `index.html`, make the share image absolute so WhatsApp/Google show the
   preview card (both `og:image` and `twitter:image`):

   ```html
   <meta property="og:image" content="https://love.example.com/assets/share-card.png">
   ```
2. If you ever change the words, regenerate that card so the preview matches:

   ```sh
   node tests/heart-layout.test.js && python3 tests/make_share_card.py
   ```

**Privacy note:** anyone with the link sees the message — that is the point.
There is no analytics, no tracking, and nothing leaves the visitor's browser.

## 8. Verification status (honest)

**Run here:**

- `node --check` on `script.js` and every test file — clean.
- `heart-layout.test.js` — 17 checks (symmetry, inside/outside spans, no
  overlap, no clipping, readable sizes, determinism, contour, filler variety).
- `dom-audit.js` — 11 checks (unique ids, ids referenced by JS/CSS all exist,
  local assets resolve, no required remote dependency, no hard-coded copy
  outside `CONFIG`, no `console.*`).
- `smoke.test.js` — 15 checks driving every interaction through a DOM shim.
- PIL-rendered PNG previews of the heart at the final layout, eyeballed for
  silhouette, balance and word fit (the one you see in `tests/heart-preview.svg`
  is the same composition).

**Not run here:** real-browser testing. No browser binary or a connected
desktop browser was available in this environment, so nothing was verified
with actual layout/CSS: no live screenshots, no console output from a real
engine, no measured horizontal scroll at 320/360/390/430 px, and no check on
a real phone. The DOM shim executes the logic but paints nothing — §9 is the
list of things only a browser can confirm.

## 9. Quick manual checklist (2 minutes, in a browser)

- [ ] 320×640, 360×800, 390×844, 430×932 and a desktop window: no horizontal
      scrollbar, nothing clipped.
- [ ] Opening → *Open Your Surprise* → heart blooms → reveal appears.
- [ ] *Replay* twice quickly: the heart rebuilds, no doubled/stuck animation.
- [ ] Secret letter opens/closes; focus moves into the paper and back.
- [ ] Three taps on the tiny heart beside the sub-line open the easter egg.
- [ ] Music button explains itself (no file added) and never claims to play.
- [ ] DevTools → *Rendering → emulate prefers-reduced-motion*: no movement,
      full content still visible.
- [ ] Disable JavaScript: opening screen is skipped, message and letter show.

## 10. Troubleshooting

| Symptom | Fix |
|--------|-----|
| Heart looks empty/odd | A font may be blocked. It still renders with Georgia — check the console. |
| Text seems clipped at the edges | Your `CONFIG.heart` phrases may be unusually long; reduce `weight` or shorten a phrase (the tests will tell you if something no longer fits). |
| Music button does nothing | That is intended until you add a file — see §4. |
| Fonts look different from the demo | Google Fonts was unreachable; the site intentionally falls back rather than blocking. |
| Page scrolls sideways | It shouldn't; `body { overflow-x: hidden }` plus a `max-width: min(94vw, …)` heart. If you see it, note the viewport and the element. |
