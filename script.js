/* ==========================================================================
   PROJECT AYESHA — script.js
   A cinematic love letter for Ayesha. Plain JavaScript, no dependencies.

   ┌─────────────────────────────────────────────────────────────────────────┐
   │  SECTION 1 — CONFIG: edit every personal message right here.           │
   │  The HTML file only holds the same default copy as a no-JS fallback,   │
   │  so you normally never need to touch anything outside this file.       │
   └─────────────────────────────────────────────────────────────────────────┘

   SECTION 2 — the heart geometry (pure functions, unit-tested in tests/).
   SECTION 3 — the page: scenes, interactions, canvases, cleanup.
   ========================================================================== */

'use strict';

/* ==========================================================================
   1. CONFIG — ALL EDITABLE TEXT LIVES HERE
   ========================================================================== */

const CONFIG = {

  /* --- SCENE ONE · the cinematic opening -------------------------------- */
  opening: {
    eyebrow: 'A LITTLE SOMETHING FOR YOU',
    name: 'Ayesha',
    tagline: 'Some feelings deserve their own little universe.',
    button: 'Open Your Surprise'
  },

  /* --- SCENE TWO · the heart made of words -------------------------------
     `phrases` fill the heart, row by row, from the top of the shape down.
     - hero:   true  -> gets the widest, most central row and a larger size
     - weight: type-size multiplier (1 = normal)
     Add, remove or rewrite freely; the layout always adapts to the text.   */
  heart: {
    ariaTitle: 'A heart made of romantic words',
    phrases: [
      { text: 'I love you, Ayesha', hero: true, weight: 1.15 },
      { text: 'You make ordinary moments special' },
      { text: 'Forever in this little universe' },
      { text: 'A little piece of happiness' },
      { text: 'You are special' },
      { text: 'My favorite person' },
      { text: 'Made with love' },
      { text: 'I love you' },
      { text: 'Ayesha \u2661' }
    ],
    /* short words used to fill the leftover space so the shape reads clearly.
       They are laid down in a rotating order, so the filler stays varied. */
    tokens: ['my darling', 'forever', 'always', 'love', 'you', 'yours', 'us', '\u2661'],
    fill: true,

    /* Typography of the heart, in "heart units" (the curve is 32 wide). */
    font: "'Playfair Display', 'Iowan Old Style', Georgia, 'Times New Roman', serif",
    baseSize: 1.95,      // normal word size
    minSize: 1.15,       // never render smaller than this
    pitchFactor: 1.55,   // vertical distance between rows = baseSize * this
    pad: 0.42,           // breathing room between words and the heart edge
    gap: 0.62,           // space between two words sitting side by side
    seed: 20261009,      // deterministic randomness (same heart every time)

    /* Entrance timing. `wordDuration` must match .heart__word in style.css. */
    baseDelay: 80,
    stagger: 1250,
    delayJitter: 90,
    wordDuration: 1040
  },

  /* --- SCENE THREE · the main love reveal ------------------------------- */
  main: {
    title: 'I Love You, Ayesha',
    heart: '\u2764\uFE0F',
    sub: 'Made with love, just for you.'
  },

  /* --- SCENE FOUR · the secret letter ----------------------------------- */
  letter: {
    invite: 'A little note, just for you.',
    open: 'Open Your Letter',
    close: 'Close Letter',
    /* \n\n starts a new paragraph. This text never leaves your device. */
    body: 'Ayesha,\n\n' +
          'This little corner of the internet was created just to make you smile. ' +
          'I hope it brings a little warmth to your day and reminds you that you are special.\n\n' +
          'With love,\n\u2764\uFE0F'
  },

  /* --- SCENE FIVE · the hidden easter egg -------------------------------
     Three taps on the tiny heart next to the signature reveal this.       */
  egg: {
    taps: 3,
    kicker: 'One more little thing...',
    message: 'I Love You, Ayesha \u2764\uFE0F'
  },

  /* --- OPTIONAL AMBIENT MUSIC (always OFF until you add a file) ----------
     Set `src` to a relative path once you have a properly licensed audio
     file, e.g. src: 'assets/audio/ambient.mp3'.
     Leave it as null and no music ever plays — the site never pretends to. */
  audio: {
    src: null,
    volume: 0.55,
    fadeMs: 1500,
    missingHint: 'No audio file added yet \u2014 see README.md to switch music on.',
    failedHint: 'The audio file could not be played.'
  },

  /* --- ATMOSPHERE ------------------------------------------------------- */
  motion: {
    particles: 26,      // drifting motes
    tapHearts: 5        // small hearts when you tap an empty area
  }
};

/* ==========================================================================
   2. GEOMETRY — the heart curve and the word layout (pure, testable)
   ========================================================================== */

const HEART_SAMPLES = 1400;

/** Deterministic PRNG so the composition is identical on every load. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The classic parametric heart, sampled into screen coordinates (y grows down).
 * x = 16 sin^3 t ; y = 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t
 */
function heartPoints(n) {
  const count = n || HEART_SAMPLES;
  const pts = new Array(count);
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const s = Math.sin(t);
    pts[i] = {
      x: 16 * s * s * s,
      y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    };
  }
  return pts;
}

function bounds(pts) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Horizontal spans that lie INSIDE the heart at a given y.
 * Above the cleft there are two spans (the lobes); below it, one.
 */
function insideIntervals(pts, y) {
  const xs = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      const r = (y - a.y) / (b.y - a.y);
      xs.push(a.x + r * (b.x - a.x));
    }
  }
  xs.sort(function (p, q) { return p - q; });
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

function pointInPolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Lay romantic phrases out inside the heart, row by row, so the silhouette
 * is unmistakably a heart and every word stays readable.
 *
 * Returns { box, words, rows, message, forced } where words are in heart units.
 */
function buildHeartLayout(options) {
  const o = options || {};
  const points = o.points || heartPoints(HEART_SAMPLES);
  const measure = o.measure;                    // text -> width at 1px font size
  const phrases = (o.phrases || []).map(function (p) {
    return typeof p === 'string' ? { text: p, weight: 1 } : { text: p.text, weight: p.weight || 1 };
  });
  const tokens = o.tokens || [];
  const base = o.baseSize || 1.95;
  const min = o.minSize || 1.15;
  const pitch = base * (o.pitchFactor || 1.55);
  const pad = o.pad == null ? 0.42 : o.pad;
  const gap = o.gap == null ? 0.62 : o.gap;
  const bb = bounds(points);
  const message = phrases.map(function (p) { return p.text; }).join(' \u00b7 ');

  /* -- 1. horizontal bands, anchored just under the lobe tops so the lobes
        and the point of the heart are actually filled with words. The step
        between rows shrinks as the shape narrows towards the tip. --------- */
  const bottom = bb.maxY - min * 0.7;
  const rows = [];
  let y = bb.minY + min * 1.4;
  while (y <= bottom) {
    const ivs = insideIntervals(points, y)
      .map(function (iv) { return { x0: iv[0], x1: iv[1], w: iv[1] - iv[0] }; })
      .filter(function (iv) { return iv.w >= min * 1.7; });
    if (ivs.length) {
      const cap = ivs.reduce(function (s, iv) { return s + iv.w; }, 0);
      rows.push({ index: rows.length, y: y, ivs: ivs, cap: cap });
      /* narrower row -> smaller step, so the words follow the point */
      const tight = 0.66 + 0.34 * Math.min(1, cap / (bb.w * 0.9));
      y += pitch * Math.max(0.66, Math.min(1, tight));
    } else {
      y += pitch * 0.4;
    }
  }

  /* -- 2. widest rows first, so long phrases get the room they need ------- */
  const queue = phrases.map(function (p) {
    return { text: p.text, weight: p.weight, uw: measure(p.text) };
  }).sort(function (a, b) {
    return (b.weight - a.weight) || (b.uw - a.uw);   // hero first, then longest
  });

  const slots = rows.slice()
    .sort(function (a, b) { return b.cap - a.cap; })
    .map(function (row) {
      return {
        y: row.y,
        index: row.index,
        list: row.ivs
          .map(function (iv) {
            return {
              x: iv.x0 + pad, rem: iv.w - 2 * pad, cursor: iv.x0 + pad,
              full: iv.w - 2 * pad, y: row.y, index: row.index
            };
          })
          .sort(function (a, b) { return b.rem - a.rem; })
      };
    });

  const words = [];
  let forced = 0;

  /* -- 3. pack the phrases: in every slot take the LONGEST phrase that fits,
        so a big line is never squeezed into a narrow row while a short one
        wastes the wide row. The hero phrase is first in the queue, so it
        claims the widest row. ---------------------------------------------- */
  for (let s = 0; s < slots.length && queue.length; s++) {
    const entry = slots[s];
    for (let k = 0; k < entry.list.length && queue.length; k++) {
      const slot = entry.list[k];
      while (queue.length && slot.rem > gap * 2) {
        const idx = queue.findIndex(function (ph) {
          return (slot.rem - gap) / ph.uw >= min;
        });
        if (idx < 0) break;
        const ph = queue[idx];
        const size = Math.min(ph.weight * base, (slot.rem - gap) / ph.uw);
        const w = ph.uw * size;
        words.push({
          text: ph.text, x: slot.cursor + w / 2, y: slot.y,
          size: size, uw: ph.uw, row: slot.index
        });
        slot.cursor += w + gap;
        slot.rem -= w + gap;
        queue.splice(idx, 1);
      }
    }
  }

  /* -- 4. never drop a phrase: anything left goes, centred, into the widest
        row. Only reachable with unusually long custom copy. ---------------- */
  while (queue.length) {
    const ph = queue.shift();
    const entry = slots[0];
    const slot = entry && entry.list[0];
    if (!slot) break;
    const size = Math.max(min * 0.8, Math.min(ph.weight * base, (slot.full - gap) / ph.uw));
    const w = ph.uw * size;
    words.push({
      text: ph.text, x: slot.x + slot.full / 2, y: slot.y,
      size: size, uw: ph.uw, row: slot.index
    });
    forced++;
  }

  /* -- 5. fill leftover room with short tokens so the silhouette is dense.
        The tokens are laid down in a rotating order (so the same string never
        repeats row after row); a token that is too big for the space left is
        simply skipped in favour of the next one. --------------------------- */
  if (o.fill !== false && tokens.length) {
    const uwOf = tokens.map(function (t) { return measure(t); });
    let ti = 0;
    for (let s = 0; s < slots.length; s++) {
      for (let k = 0; k < slots[s].list.length; k++) {
        const slot = slots[s].list[k];
        let guard = 0;
        while (slot.rem > gap * 2 && guard++ < tokens.length * 8) {
          let pick = -1;
          for (let a = 0; a < tokens.length; a++) {
            const idx = (ti + a) % tokens.length;
            if (uwOf[idx] * min * 0.9 <= slot.rem - gap) { pick = idx; break; }
          }
          if (pick < 0) break;
          const uw = uwOf[pick];
          const size = Math.min(base * 0.94, (slot.rem - gap) / uw);
          const w = uw * size;
          words.push({
            text: tokens[pick], x: slot.cursor + gap * 0.5 + w / 2, y: slot.y,
            size: size, uw: uw, row: slot.index, token: true
          });
          slot.cursor += gap + w;
          slot.rem -= gap + w;
          ti = (pick + 1) % tokens.length;
        }
      }
    }
  }

  /* -- 6. finish the point of the heart with one small word ---------------
        The regular row grid stops short of the tip; this closes the gap so
        the heart keeps its narrow point. Degrades gracefully if no word
        can fit there. ------------------------------------------------------ */
  if (o.fill !== false && tokens.length && rows.length) {
    let lowest = null;
    for (let i = 0; i < words.length; i++) {
      if (!lowest || words[i].y > lowest.y) lowest = words[i];
    }
    const tipPad = Math.min(pad, 0.16);
    const floorY = (lowest ? lowest.y + lowest.size * 0.62 : bb.minY) + min * 0.5;
    const endY = bb.maxY - min * 0.3;
    for (let y = floorY; y <= endY; y += 0.16) {
      const spans = insideIntervals(points, y);
      if (!spans.length) break;
      const iv = spans[spans.length - 1];
      const slotW = (iv[1] - iv[0]) - 2 * tipPad;
      if (slotW < 0.55) continue;         // too pointed to hold a visible word
      let bestTok = null;
      let bestSize = 0;
      for (let i = 0; i < tokens.length; i++) {
        const uw = measure(tokens[i]);
        const size = Math.min(base * 0.94, slotW / uw);
        if (size >= min * 0.9 && size > bestSize) { bestTok = tokens[i]; bestSize = size; }
      }
      if (!bestTok) continue;
      const clears = lowest
        ? y - bestSize * 0.62 >= lowest.y + lowest.size * 0.62 + 0.12
        : true;
      if (!clears) continue;
      words.push({
        text: bestTok, x: (iv[0] + iv[1]) / 2, y: y,
        size: bestSize, uw: measure(bestTok), row: rows.length, tip: true
      });
      break;
    }
  }

  /* -- 7. drawing box: heart curve + every glyph, with a little air ------- */
  let minX = bb.minX, maxX = bb.maxX, minY = bb.minY, maxY = bb.maxY;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const halfW = (w.uw * w.size) / 2;
    const halfH = w.size * 0.62;
    if (w.x - halfW < minX) minX = w.x - halfW;
    if (w.x + halfW > maxX) maxX = w.x + halfW;
    if (w.y - halfH < minY) minY = w.y - halfH;
    if (w.y + halfH > maxY) maxY = w.y + halfH;
  }
  const margin = 0.5;
  const box = {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin
  };
  box.w = box.maxX - box.minX;
  box.h = box.maxY - box.minY;

  return {
    box: box,
    words: words,
    rows: rows,
    bounds: bb,
    curve: points,
    message: message,
    forced: forced
  };
}

/* ==========================================================================
   3. THE PAGE
   ========================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  started: false,
  revealTimer: 0,
  letterTimer: 0,
  closeTimer: 0,
  statusTimer: 0,
  volTimer: 0,
  eggTaps: 0,
  musicOn: false
};

let els = {};
let layoutCache = null;

/* ---------- small helpers ------------------------------------------------ */

function byId(id) { return document.getElementById(id); }

function prefersReduced() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function round(v) { return Math.round(v * 1000) / 1000; }

function status(message) {
  els.status.textContent = message || '';
  clearTimeout(state.statusTimer);
  if (message) {
    state.statusTimer = setTimeout(function () { els.status.textContent = ''; }, 5200);
  }
}

/* ---------- text from CONFIG into the (no-JS fallback) markup ------------ */

function injectText() {
  const map = [
    ['js-eyebrow', CONFIG.opening.eyebrow],
    ['js-name', CONFIG.opening.name],
    ['js-tagline', CONFIG.opening.tagline],
    ['js-open-label', CONFIG.opening.button],
    ['js-final-title', CONFIG.main.title],
    ['js-final-heart', CONFIG.main.heart],
    ['js-final-sub', CONFIG.main.sub],
    ['js-letter-invite', CONFIG.letter.invite],
    ['js-letter-open', CONFIG.letter.open],
    ['js-letter-close', CONFIG.letter.close],
    ['js-letter-body', CONFIG.letter.body],
    ['js-egg-kicker', CONFIG.egg.kicker],
    ['js-egg-msg', CONFIG.egg.message]
  ];
  for (let i = 0; i < map.length; i++) {
    const el = byId(map[i][0]);
    if (el && map[i][1] != null) el.textContent = map[i][1];
  }
}

/* ---------- heart layout + rendering ------------------------------------- */

/** Measures text width per 1px of font size, using the same stack as CSS. */
function makeMeasurer(fontStack) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext && canvas.getContext('2d');
  const REF = 100;
  if (!ctx) {
    return function (text) { return text.length * 0.5; };
  }
  ctx.font = REF + 'px ' + fontStack;
  return function (text) {
    const w = ctx.measureText(text).width;
    return w > 0 ? w / REF : text.length * 0.5;
  };
}

function getLayout() {
  if (layoutCache) return layoutCache;
  const c = CONFIG.heart;
  layoutCache = buildHeartLayout({
    phrases: c.phrases,
    tokens: c.tokens,
    fill: c.fill,
    measure: makeMeasurer(c.font),
    baseSize: c.baseSize,
    minSize: c.minSize,
    pitchFactor: c.pitchFactor,
    pad: c.pad,
    gap: c.gap,
    points: heartPoints(HEART_SAMPLES)
  });
  return layoutCache;
}

function formationTime() {
  const c = CONFIG.heart;
  return c.baseDelay + c.stagger + c.delayJitter + c.wordDuration;
}

/** The heart curve as one SVG path command string (decimated for the DOM). */
function outlinePath(points) {
  const step = Math.max(1, Math.round(points.length / 240));
  let d = '';
  for (let i = 0; i < points.length; i += step) {
    d += (i ? 'L' : 'M') + round(points[i].x) + ' ' + round(points[i].y);
  }
  return d + 'Z';
}

/** Builds (or rebuilds) the SVG heart. Returns ms until it is fully formed. */
function buildHeart(animate) {
  const host = els.heart;
  host.textContent = '';

  const L = getLayout();
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'heart__svg');
  svg.setAttribute('viewBox',
    round(L.box.minX) + ' ' + round(L.box.minY) + ' ' + round(L.box.w) + ' ' + round(L.box.h));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'heart-title heart-desc');
  svg.style.aspectRatio = round(L.box.w) + ' / ' + round(L.box.h);

  const title = document.createElementNS(SVG_NS, 'title');
  title.setAttribute('id', 'heart-title');
  title.textContent = CONFIG.heart.ariaTitle;

  const desc = document.createElementNS(SVG_NS, 'desc');
  desc.setAttribute('id', 'heart-desc');
  desc.textContent = L.message;
  svg.appendChild(title);
  svg.appendChild(desc);

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'heart__words');

  /* A whisper-thin contour so the silhouette reads at a glance. It is only
     decoration: the words are the message, and they carry the accessible
     text (title + desc). */
  const outline = document.createElementNS(SVG_NS, 'path');
  outline.setAttribute('class', 'heart__outline');
  outline.setAttribute('d', outlinePath(L.curve || heartPoints(HEART_SAMPLES)));
  group.appendChild(outline);

  let len = 0;
  try {
    if (typeof outline.getTotalLength === 'function') len = outline.getTotalLength();
  } catch (err) { len = 0; }
  const drawOutline = animate && !prefersReduced() && len > 0;
  if (drawOutline) {
    outline.style.strokeDasharray = String(round(len));
    outline.style.strokeDashoffset = String(round(len));
  }

  const c = CONFIG.heart;
  const rng = mulberry32(c.seed);
  const cx = (L.box.minX + L.box.maxX) / 2;
  const cy = (L.box.minY + L.box.maxY) / 2;

  /* Words bloom outwards from the centre, nearest first. */
  const ordered = L.words.map(function (w, i) {
    return { w: w, i: i, d: Math.sqrt((w.x - cx) * (w.x - cx) + (w.y - cy) * (w.y - cy)) };
  }).sort(function (a, b) { return a.d - b.d; });

  const n = ordered.length;
  for (let r = 0; r < n; r++) {
    const w = ordered[r].w;
    const k = 0.6 + rng() * 0.26;                    // bloom start (fraction of radius)
    const jx = (rng() - 0.5) * 2.2;
    const jy = (rng() - 0.5) * 2.2;
    const delay = Math.round(
      c.baseDelay + (n > 1 ? (r / (n - 1)) * c.stagger : 0) + (rng() - 0.5) * c.delayJitter);
    const opacity = 0.74 + rng() * 0.26;             // restrained variation

    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'heart__word');
    t.setAttribute('x', round(w.x));
    t.setAttribute('y', round(w.y + w.size * 0.35)); // approximate vertical centring
    t.setAttribute('font-size', round(w.size));
    t.setAttribute('text-anchor', 'middle');
    t.textContent = w.text;
    t.style.setProperty('--dx', round((w.x - cx) * (k - 1) + jx) + 'px');
    t.style.setProperty('--dy', round((w.y - cy) * (k - 1) + jy) + 'px');
    t.style.setProperty('--d', delay + 'ms');
    t.style.setProperty('--o', opacity.toFixed(2));
    group.appendChild(t);
  }

  svg.appendChild(group);
  host.appendChild(svg);

  if (animate && !prefersReduced()) {
    // Two frames so the starting styles are committed before the transition.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        group.classList.add('is-formed');
        if (drawOutline) outline.style.strokeDashoffset = '0';
      });
    });
    return formationTime();
  }

  group.classList.add('is-static');
  group.classList.add('is-formed');
  return 0;
}

function whenFontsReady(timeoutMs) {
  if (!document.fonts || !document.fonts.ready) return Promise.resolve();
  return Promise.race([
    document.fonts.ready,
    new Promise(function (resolve) { setTimeout(resolve, timeoutMs); })
  ]);
}

function scheduleReveal(ms) {
  clearTimeout(state.revealTimer);
  state.revealTimer = setTimeout(function () {
    els.hero.classList.add('is-revealed');
  }, ms + 300);
}

/* ---------- scene one: opening ------------------------------------------- */

function wireOpening() {
  els.openBtn.addEventListener('click', function () {
    if (state.started) return;
    state.started = true;

    els.opening.classList.add('is-leaving');
    els.main.hidden = false;

    whenFontsReady(1200).then(function () {
      if (document.fonts && document.fonts.ready) layoutCache = null; // metrics are final now
      const ms = buildHeart(true);
      scheduleReveal(ms);
    });

    setTimeout(function () {
      els.opening.hidden = true;
      els.main.focus({ preventScroll: true });
    }, prefersReduced() ? 0 : 660);
  });
}

/* ---------- scene three/controls: replay --------------------------------- */

function wireReplay() {
  els.replayBtn.addEventListener('click', function () {
    if (!state.started) return;
    clearTimeout(state.revealTimer);
    closeLetter(true);
    closeEgg();
    state.eggTaps = 0;
    els.hero.classList.remove('is-revealed');
    const ms = buildHeart(true);
    scheduleReveal(ms);
    window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
  });
}

/* ---------- scene four: envelope + letter -------------------------------- */

function openLetter() {
  clearTimeout(state.closeTimer);
  els.letterPanel.classList.remove('is-closing');
  els.letterBtn.setAttribute('aria-expanded', 'true');
  els.envelope.classList.add('is-open');

  clearTimeout(state.letterTimer);
  state.letterTimer = setTimeout(function () {
    els.letterPanel.hidden = false;
    els.letterPaper.focus({ preventScroll: true });
    const r = els.letterPanel.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.bottom > vh || r.top < 0) {
      els.letterPanel.scrollIntoView({
        block: 'center',
        behavior: prefersReduced() ? 'auto' : 'smooth'
      });
    }
  }, prefersReduced() ? 0 : 430);
}

function closeLetter(immediate) {
  clearTimeout(state.letterTimer);
  els.letterBtn.setAttribute('aria-expanded', 'false');
  els.envelope.classList.remove('is-open');
  if (els.letterPanel.hidden) return;

  const finish = function () {
    els.letterPanel.hidden = true;
    els.letterPanel.classList.remove('is-closing');
  };
  clearTimeout(state.closeTimer);
  if (immediate || prefersReduced()) {
    finish();
  } else {
    els.letterPanel.classList.add('is-closing');
    state.closeTimer = setTimeout(finish, 260);
  }
  els.letterBtn.focus({ preventScroll: true });
}

function wireLetter() {
  els.letterBtn.addEventListener('click', function () {
    if (els.letterBtn.getAttribute('aria-expanded') === 'true') closeLetter();
    else openLetter();
  });
  els.letterClose.addEventListener('click', function () { closeLetter(); });
}

/* ---------- scene five: the hidden easter egg ---------------------------- */

function openEgg() {
  const d = els.egg;
  if (typeof d.showModal === 'function') {
    if (!d.open) d.showModal();
  } else {
    d.classList.add('egg--fallback');
    d.setAttribute('open', '');
    els.eggClose.focus();
  }
}

function closeEgg() {
  const d = els.egg;
  if (typeof d.close === 'function') {
    if (d.open) d.close();          // fires `close`, which resets the counter
  } else {
    d.removeAttribute('open');
    d.classList.remove('egg--fallback');
    resetEgg();
  }
}

function resetEgg() {
  state.eggTaps = 0;
  if (document.activeElement === els.egg || els.egg.contains(document.activeElement)) {
    els.secret.focus({ preventScroll: true });
  }
}

function wireEgg() {
  els.secret.addEventListener('click', function () {
    state.eggTaps += 1;
    if (state.eggTaps >= CONFIG.egg.taps) {
      state.eggTaps = 0;
      openEgg();
      return;
    }
    els.secret.classList.remove('is-nudge');
    void els.secret.offsetWidth;     // restart the tiny nudge animation
    els.secret.classList.add('is-nudge');
  });
  els.eggClose.addEventListener('click', closeEgg);
  els.egg.addEventListener('close', resetEgg);
}

/* ---------- optional music (off, and honest about it) -------------------- */

function wireMusic() {
  const audio = els.audio;
  const btn = els.musicBtn;
  const hasAudio = typeof CONFIG.audio.src === 'string' && CONFIG.audio.src.trim() !== '';

  if (hasAudio) {
    audio.src = CONFIG.audio.src;
  } else {
    btn.setAttribute('aria-disabled', 'true');
    btn.setAttribute('title', CONFIG.audio.missingHint);
  }

  function rampVolume(to, ms) {
    clearTimeout(state.volTimer);
    const steps = 12;
    const stepMs = Math.max(40, Math.round(ms / steps));
    let i = 0;
    audio.volume = 0;
    const step = function () {
      i += 1;
      audio.volume = Math.min(to, to * (i / steps));
      if (i < steps) state.volTimer = setTimeout(step, stepMs);
      else state.volTimer = 0;
    };
    state.volTimer = setTimeout(step, stepMs);
  }

  btn.addEventListener('click', function () {
    if (!hasAudio) { status(CONFIG.audio.missingHint); return; }
    if (state.musicOn) { audio.pause(); return; }
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(function () {
        state.musicOn = true;
        btn.setAttribute('aria-pressed', 'true');
        rampVolume(CONFIG.audio.volume, CONFIG.audio.fadeMs);
        status('Music on');
      }).catch(function () {
        state.musicOn = false;
        btn.setAttribute('aria-pressed', 'false');
        status(CONFIG.audio.failedHint);
      });
    }
  });

  audio.addEventListener('pause', function () {
    state.musicOn = false;
    clearTimeout(state.volTimer);
    btn.setAttribute('aria-pressed', 'false');
  });
  audio.addEventListener('play', function () {
    state.musicOn = true;
    btn.setAttribute('aria-pressed', 'true');
  });
  audio.addEventListener('error', function () {
    state.musicOn = false;
    btn.setAttribute('aria-pressed', 'false');
    status(CONFIG.audio.failedHint);
  });
}

/* ---------- canvases: ambient motes + tap hearts ------------------------- */

const fx = {
  bg: null, bgCtx: null,
  canvas: null, ctx: null,
  w: 0, h: 0, dpr: 1,
  particles: [],
  taps: [],
  raf: 0,
  running: false,
  lastT: 0,
  slow: 0,
  degraded: false
};

function motionOK() { return !prefersReduced() && !fx.degraded; }

function sizeCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  fx.dpr = dpr;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: w, h: h };
}

function resizeCanvases() {
  if (!fx.bg) return;
  const a = sizeCanvas(fx.bg, fx.bgCtx);
  fx.w = a.w; fx.h = a.h;
  sizeCanvas(fx.canvas, fx.ctx);
  // keep the motes spread over the new viewport
  for (let i = 0; i < fx.particles.length; i++) {
    const p = fx.particles[i];
    if (p.x > fx.w) p.x = Math.random() * fx.w;
    if (p.y > fx.h) p.y = Math.random() * fx.h;
  }
  drawAmbient(performance.now());
  drawTaps(0);
}

function makeParticles(count) {
  const rng = mulberry32(CONFIG.motion.particles * 7919 + 13);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: rng() * (fx.w || window.innerWidth),
      y: rng() * (fx.h || window.innerHeight),
      r: 0.5 + rng() * 1.4,
      vx: (rng() - 0.5) * 0.09,
      vy: -0.03 - rng() * 0.09,
      a: 0.16 + rng() * 0.34,
      phase: rng() * Math.PI * 2,
      warm: rng() > 0.62
    });
  }
  return out;
}

function drawAmbient(t) {
  const ctx = fx.bgCtx;
  if (!ctx) return;
  ctx.clearRect(0, 0, fx.w, fx.h);
  ctx.fillStyle = '#D89AA5';
  for (let i = 0; i < fx.particles.length; i++) {
    const p = fx.particles[i];
    const twinkle = 0.72 + 0.28 * Math.sin(t * 0.0011 + p.phase);
    ctx.globalAlpha = Math.max(0, p.a * twinkle);
    ctx.fillStyle = p.warm ? '#8E1830' : '#D89AA5';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.15, y + s * 0.1, x - s * 0.86, y - s * 0.9, x, y - s * 0.32);
  ctx.bezierCurveTo(x + s * 0.86, y - s * 0.9, x + s * 1.15, y + s * 0.1, x, y + s * 0.95);
  ctx.closePath();
}

function drawTaps(dt) {
  const ctx = fx.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, fx.w, fx.h);
  for (let i = fx.taps.length - 1; i >= 0; i--) {
    const h = fx.taps[i];
    h.life += dt;
    if (h.life >= h.max) { fx.taps.splice(i, 1); continue; }
    h.x += h.vx;
    h.y += h.vy;
    h.vy *= 0.985;
    h.vx *= 0.99;
    const k = h.life / h.max;
    const alpha = k < 0.22 ? k / 0.22 : 1 - (k - 0.22) / 0.78;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.85;
    ctx.fillStyle = '#D89AA5';
    heartPath(ctx, h.x, h.y, h.s * (1 + 0.2 * k));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function loop(t) {
  fx.raf = 0;
  if (document.hidden) { fx.running = false; return; }

  const dt = fx.lastT ? Math.min(t - fx.lastT, 64) : 16;
  fx.lastT = t;

  if (dt > 30) fx.slow += 1;
  else fx.slow = Math.max(0, fx.slow - 1);
  if (fx.slow > 90) {
    fx.slow = 0;
    if (fx.particles.length > 8) fx.particles.splice(0, Math.floor(fx.particles.length / 2));
    else fx.degraded = true;
  }

  const now = t;
  for (let i = 0; i < fx.particles.length; i++) {
    const p = fx.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.y < -6) { p.y = fx.h + 6; }
    if (p.x < -6) p.x = fx.w + 6;
    else if (p.x > fx.w + 6) p.x = -6;
  }
  drawAmbient(now);
  drawTaps(dt);

  if (motionOK() || fx.taps.length) {
    fx.raf = requestAnimationFrame(loop);
  } else {
    fx.running = false;
    fx.lastT = 0;
  }
}

function startLoop() {
  if (fx.running || document.hidden || !motionOK()) return;
  fx.running = true;
  fx.lastT = 0;
  fx.raf = requestAnimationFrame(loop);
}

function stopLoop() {
  fx.running = false;
  if (fx.raf) cancelAnimationFrame(fx.raf);
  fx.raf = 0;
}

function spawnHearts(x, y) {
  if (!motionOK() || !fx.canvas) return;
  const n = 2 + Math.floor(Math.random() * (CONFIG.motion.tapHearts - 1));
  for (let i = 0; i < n; i++) {
    fx.taps.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 1.1,
      vy: -0.55 - Math.random() * 0.75,
      s: 4.5 + Math.random() * 4,
      life: 0,
      max: 850 + Math.random() * 450
    });
  }
  startLoop();
}

function initCanvases() {
  fx.bg = byId('bg-canvas');
  fx.canvas = byId('fx-canvas');
  if (!fx.bg || !fx.canvas || !fx.bg.getContext) return;
  fx.bgCtx = fx.bg.getContext('2d');
  fx.ctx = fx.canvas.getContext('2d');
  if (!fx.bgCtx || !fx.ctx) return;

  resizeCanvases();
  fx.particles = makeParticles(CONFIG.motion.particles);
  drawAmbient(performance.now());

  if (!prefersReduced()) startLoop();

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else if (!prefersReduced()) startLoop();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvases, 180);
  });

  document.addEventListener('click', function (e) {
    if (!state.started || !motionOK()) return;
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('button, a, input, textarea, dialog, .envelope, .paper')) return;
    spawnHearts(e.clientX, e.clientY);
  });
}

/* ---------- boot --------------------------------------------------------- */

function init() {
  injectText();

  els = {
    opening: byId('opening-screen'),
    openBtn: byId('open-btn'),
    main: byId('main-screen'),
    hero: document.querySelector('.hero'),
    heart: byId('heart'),
    replayBtn: byId('replay-btn'),
    musicBtn: byId('music-btn'),
    status: byId('control-status'),
    secret: byId('secret-heart'),
    egg: byId('egg-dialog'),
    eggClose: byId('egg-close'),
    letterBtn: byId('letter-btn'),
    letterPanel: byId('letter-panel'),
    letterPaper: byId('letter-paper'),
    letterClose: byId('letter-close'),
    envelope: byId('envelope'),
    audio: byId('music')
  };

  if (!els.openBtn || !els.main || !els.heart) return;   // unexpected markup

  wireOpening();
  wireReplay();
  wireLetter();
  wireEgg();
  wireMusic();
  initCanvases();
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

/* Exposed for the Node-based layout tests in tests/heart-layout.test.js */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG: CONFIG,
    mulberry32: mulberry32,
    heartPoints: heartPoints,
    bounds: bounds,
    insideIntervals: insideIntervals,
    pointInPolygon: pointInPolygon,
    outlinePath: outlinePath,
    buildHeartLayout: buildHeartLayout
  };
}
