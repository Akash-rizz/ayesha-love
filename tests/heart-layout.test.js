/* ==========================================================================
   tests/heart-layout.test.js
   Dependency-free checks for the word-heart geometry in ../script.js

   Run:  node tests/heart-layout.test.js
   ========================================================================== */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = require('../script.js');
const { CONFIG, heartPoints, bounds, insideIntervals, pointInPolygon, outlinePath, buildHeartLayout } = app;

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok   ' + name);
  } catch (err) {
    failures.push(name + ' :: ' + err.message);
    console.log('  FAIL ' + name + '\n       ' + err.message);
  }
}

/* Rough serif metrics (Playfair-class): enough to expose layout problems
   without needing a font engine. The browser uses real measureText(). */
const AVG = { upper: 0.64, lower: 0.47, space: 0.25, other: 0.32 };
function approxMeasure(text) {
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') w += AVG.space;
    else if (ch >= 'A' && ch <= 'Z') w += AVG.upper;
    else if (ch >= 'a' && ch <= 'z') w += AVG.lower;
    else w += AVG.other;
  }
  return w;
}

const points = heartPoints(1400);
const bb = bounds(points);

const layout = buildHeartLayout({
  phrases: CONFIG.heart.phrases,
  tokens: CONFIG.heart.tokens,
  fill: CONFIG.heart.fill,
  measure: approxMeasure,
  baseSize: CONFIG.heart.baseSize,
  minSize: CONFIG.heart.minSize,
  pitchFactor: CONFIG.heart.pitchFactor,
  pad: CONFIG.heart.pad,
  gap: CONFIG.heart.gap,
  points: points
});

console.log('\nPROJECT AYESHA — heart layout checks');
console.log('-------------------------------------');
console.log('curve bounds   : x ' + bb.minX.toFixed(2) + ' … ' + bb.maxX.toFixed(2) +
            '   y ' + bb.minY.toFixed(2) + ' … ' + bb.maxY.toFixed(2));
console.log('viewBox        : ' + layout.box.w.toFixed(2) + ' x ' + layout.box.h.toFixed(2));
console.log('rows / words   : ' + layout.rows.length + ' / ' + layout.words.length +
            '   (forced: ' + layout.forced + ')');
console.log('phrase words   : ' + layout.words.filter(w => !w.token).length +
            '   filler tokens: ' + layout.words.filter(w => w.token).length);
console.log('sizes          : ' +
            Math.min(...layout.words.map(w => w.size)).toFixed(2) + ' … ' +
            Math.max(...layout.words.map(w => w.size)).toFixed(2) + '  (base ' +
            CONFIG.heart.baseSize + ')');
console.log('');

/* ------------------------------------------------------------------ shape */
check('heart curve is symmetric across the vertical axis', () => {
  assert.ok(Math.abs(bb.minX + bb.maxX) < 1e-9, 'x bounds are not mirrored');
});

check('heart has a low point and two raised lobes', () => {
  assert.ok(bb.maxY > 16, 'expected a sharp bottom point near y=17, got ' + bb.maxY);
  assert.ok(bb.minY < -10, 'expected raised lobes near y=-11.7, got ' + bb.minY);
  const cleft = insideIntervals(points, -6.5);   // between the lobes
  const body = insideIntervals(points, 0);       // solid middle
  assert.strictEqual(cleft.length, 2, 'expected two lobes above the cleft');
  assert.strictEqual(body.length, 1, 'expected one span through the middle');
  assert.ok(body[0][1] - body[0][0] > 28, 'middle of the heart should be wide');
});

check('insideIntervals returns spans that are genuinely inside', () => {
  for (const y of [-9, -6, -3, 0, 4, 8, 12, 15]) {
    const spans = insideIntervals(points, y);
    assert.ok(spans.length >= 1, 'no spans at y=' + y);
    for (const [x0, x1] of spans) {
      const mid = (x0 + x1) / 2;
      assert.ok(pointInPolygon(points, mid, y), 'midpoint (' + mid + ',' + y + ') is outside');
    }
    assert.ok(!pointInPolygon(points, spans[0][0] - 0.3, y),
      'left of the leftmost span at y=' + y + ' should be outside');
    assert.ok(!pointInPolygon(points, spans[spans.length - 1][1] + 0.3, y),
      'right of the rightmost span at y=' + y + ' should be outside');
  }
});

check('pointInPolygon sanity', () => {
  assert.strictEqual(pointInPolygon(points, 0, 0), true, 'centre should be inside');
  assert.strictEqual(pointInPolygon(points, 0, -13), false, 'above the lobes is outside');
  assert.strictEqual(pointInPolygon(points, 0, 17.4), false, 'below the tip is outside');
});

/* ------------------------------------------------------- phrase placement */
check('every configured phrase appears in the heart', () => {
  const texts = layout.words.map(w => w.text);
  for (const p of CONFIG.heart.phrases) {
    assert.ok(texts.includes(p.text), 'missing phrase: "' + p.text + '"');
  }
});

check('no phrase had to be force-placed (layout fits naturally)', () => {
  assert.strictEqual(layout.forced, 0, layout.forced + ' phrase(s) did not fit');
});

check('every word keeps its size readable', () => {
  for (const w of layout.words) {
    assert.ok(w.size >= CONFIG.heart.minSize * 0.9,
      '"' + w.text + '" shrank to ' + w.size.toFixed(2));
    assert.ok(w.size <= CONFIG.heart.baseSize * 1.2 + 1e-6,
      '"' + w.text + '" grew to ' + w.size.toFixed(2));
  }
});

check('every word sits inside the heart outline', () => {
  for (const w of layout.words) {
    assert.ok(pointInPolygon(points, w.x, w.y),
      '"' + w.text + '" centre (' + w.x.toFixed(1) + ',' + w.y.toFixed(1) + ') is outside');
  }
});

check('no word crosses the heart boundary horizontally', () => {
  for (const w of layout.words) {
    const half = (w.uw * w.size) / 2;
    const spans = insideIntervals(points, w.y);
    const fits = spans.some(([x0, x1]) => w.x - half >= x0 - 0.02 && w.x + half <= x1 + 0.02);
    assert.ok(fits, '"' + w.text + '" [' + (w.x - half).toFixed(1) + ' … ' +
      (w.x + half).toFixed(1) + '] escapes the row at y=' + w.y.toFixed(1));
  }
});

check('words in the same row never overlap', () => {
  const byRow = new Map();
  for (const w of layout.words) {
    if (!byRow.has(w.row)) byRow.set(w.row, []);
    byRow.get(w.row).push(w);
  }
  for (const [row, list] of byRow) {
    list.sort((a, b) => a.x - b.x);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      const prevRight = prev.x + (prev.uw * prev.size) / 2;
      const curLeft = cur.x - (cur.uw * cur.size) / 2;
      assert.ok(curLeft - prevRight > 0.05,
        'row ' + row + ': "' + prev.text + '" touches "' + cur.text + '" (' +
        (curLeft - prevRight).toFixed(2) + ')');
    }
  }
});

check('rows are far enough apart for the type size used', () => {
  const ys = [...new Set(layout.words.map(w => w.y))].sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) {
    const a = layout.words.filter(w => w.y === ys[i - 1]).map(w => w.size);
    const b = layout.words.filter(w => w.y === ys[i]).map(w => w.size);
    const gapY = ys[i] - ys[i - 1];
    assert.ok(gapY >= Math.max(...a) * 0.9,
      'rows ' + (ys[i - 1]).toFixed(1) + ' / ' + ys[i].toFixed(1) +
      ' are only ' + gapY.toFixed(2) + ' apart');
  }
});

/* ------------------------------------------------------------ composition */
check('the hero phrase occupies the widest row', () => {
  const hero = CONFIG.heart.phrases.find(p => p.hero);
  const placed = layout.words.find(w => w.text === hero.text);
  const widestRow = layout.rows.reduce((best, r) => (r.cap > best.cap ? r : best), layout.rows[0]);
  assert.ok(placed, 'hero phrase missing');
  assert.strictEqual(placed.row, widestRow.index,
    'hero is in row ' + placed.row + ', widest is ' + widestRow.index);
});

check('the heart fills a portrait-friendly box', () => {
  const ratio = layout.box.w / layout.box.h;
  assert.ok(ratio > 0.95 && ratio < 1.55, 'aspect ratio ' + ratio.toFixed(2) + ' looks wrong');
  assert.ok(layout.words.length >= 15, 'only ' + layout.words.length + ' words in the heart');
  assert.ok(layout.rows.length >= 6, 'only ' + layout.rows.length + ' rows');
});

check('the composition is deterministic across runs', () => {
  const again = buildHeartLayout({
    phrases: CONFIG.heart.phrases,
    tokens: CONFIG.heart.tokens,
    fill: CONFIG.heart.fill,
    measure: approxMeasure,
    baseSize: CONFIG.heart.baseSize,
    minSize: CONFIG.heart.minSize,
    pitchFactor: CONFIG.heart.pitchFactor,
    pad: CONFIG.heart.pad,
    gap: CONFIG.heart.gap,
    points: heartPoints(1400)
  });
  assert.strictEqual(JSON.stringify(again.words), JSON.stringify(layout.words));
});

check('longer custom phrase lists still fit (no dropped words)', () => {
  const extra = CONFIG.heart.phrases.concat([
    { text: 'Every ordinary day with you is my favourite day' },
    { text: 'Always yours' }
  ]);
  const l = buildHeartLayout({
    phrases: extra, tokens: CONFIG.heart.tokens, fill: false,
    measure: approxMeasure,
    baseSize: CONFIG.heart.baseSize, minSize: CONFIG.heart.minSize,
    pitchFactor: CONFIG.heart.pitchFactor, pad: CONFIG.heart.pad,
    gap: CONFIG.heart.gap, points: points
  });
  for (const p of extra) {
    assert.ok(l.words.some(w => w.text === p.text), 'dropped: ' + p.text);
  }
  assert.ok(l.forced <= 2, l.forced + ' phrases needed forcing');
});

/* ------------------------------------------------------------- contour */
check('the heart has a closed contour path for the outline', () => {
  const d = outlinePath(points);
  assert.ok(d.charAt(0) === 'M', 'path must start with a move command');
  assert.ok(d.slice(-1) === 'Z', 'path must be closed');
  assert.strictEqual((d.match(/M/g) || []).length, 1, 'expected a single subpath');
  assert.ok((d.match(/L/g) || []).length >= 100, 'contour is too coarse to look smooth');
});

/* ------------------------------------------------------------ filler */
check('filler words vary instead of repeating one token', () => {
  const filler = layout.words.filter(w => w.token).map(w => w.text);
  assert.ok(filler.length >= 6, 'expected the heart to be filled, got ' + filler.length);
  const distinct = new Set(filler);
  assert.ok(distinct.size >= 3, 'filler repeats too much: ' + filler.join(' '));
  for (const t of distinct) {
    const n = filler.filter(x => x === t).length;
    assert.ok(n <= Math.ceil(filler.length * 0.5),
      '"' + t + '" is ' + n + ' of ' + filler.length + ' filler words');
  }
});

/* --------------------------------------------------- visual SVG snapshot */
function svgPreview() {
  const W = Math.round(layout.box.w * 24);
  const H = Math.round(layout.box.h * 24);
  const body = layout.words.map(w =>
    '  <text x="' + w.x.toFixed(2) + '" y="' + (w.y + w.size * 0.35).toFixed(2) +
    '" font-size="' + w.size.toFixed(2) + '" text-anchor="middle">' +
    w.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>').join('\n');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
    '" viewBox="' + layout.box.minX.toFixed(2) + ' ' + layout.box.minY.toFixed(2) + ' ' +
    layout.box.w.toFixed(2) + ' ' + layout.box.h.toFixed(2) + '" font-family="Georgia, serif">' +
    '\n  <rect x="' + layout.box.minX + '" y="' + layout.box.minY + '" width="' + layout.box.w +
    '" height="' + layout.box.h + '" fill="#080708"/>\n' + body + '\n</svg>\n';
}

fs.writeFileSync(path.join(__dirname, 'heart-preview.svg'), svgPreview());
/* Same data the PNG preview renders: python3 tests/render_preview.py tests/layout.json out.png */
fs.writeFileSync(path.join(__dirname, 'layout.json'), JSON.stringify(layout));
console.log('  wrote tests/heart-preview.svg + tests/layout.json\n');

console.log('-------------------------------------');
console.log(passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) process.exitCode = 1;
