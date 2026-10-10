/* ==========================================================================
   tests/dom-audit.js
   Static cross-check between index.html, style.css and script.js — catches
   the classic "renamed an id in one file" breakages without a browser.

   Run:  node tests/dom-audit.js
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

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

function assert(cond, message) {
  if (!cond) throw new Error(message);
}
assert.ok = assert;

function assertEmpty(list, message) {
  if (list.length) throw new Error(message);
}

/* Strip comments so commented-out markup does not produce phantom ids. */
function stripComments(s, open, close) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const a = s.indexOf(open, i);
    if (a < 0) { out.push(s.slice(i)); break; }
    out.push(s.slice(i, a));
    const b = s.indexOf(close, a + open.length);
    i = b < 0 ? s.length : b + close.length;
  }
  return out.join('');
}

const htmlClean = stripComments(html, '<!--', '-->');
const cssClean = stripComments(css, '/*', '*/');
const jsClean = stripComments(js, '/*', '*/');

console.log('\nPROJECT AYESHA — static DOM audit');
console.log('---------------------------------');

/* ---------------------------------------------------------------- ids */
check('index.html declares ids exactly once (no duplicates)', () => {
  const ids = [...htmlClean.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  const seen = new Set();
  const dupes = ids.filter(id => (seen.has(id) ? true : (seen.add(id), false)));
  assertEmpty(dupes, 'duplicate id(s): ' + dupes.join(', '));
});

check('every id script.js asks for exists in index.html', () => {
  const declared = new Set([...htmlClean.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]));
  const wanted = new Set();
  for (const m of jsClean.matchAll(/byId\(\s*'([^']+)'\s*\)/g)) wanted.add(m[1]);
  for (const m of jsClean.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) wanted.add(m[1]);
  const missing = [...wanted].filter(id => !declared.has(id));
  assertEmpty(missing, 'script.js looks for missing id(s): ' + missing.join(', '));
  assert.ok(wanted.size > 0, 'no byId() calls found — audit is not running');
});

check('every id style.css targets exists in index.html', () => {
  const declared = new Set([...htmlClean.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]));
  const wanted = new Set();
  for (const m of cssClean.matchAll(/#([A-Za-z][\w-]*)/g)) {
    // ignore colour literals such as #A81E3A or #fff
    if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(m[1])) continue;
    wanted.add(m[1]);
  }
  const missing = [...wanted].filter(id => !declared.has(id));
  assertEmpty(missing, 'style.css targets missing id(s): ' + missing.join(', '));
});

check('every CONFIG text hook in script.js has a host element', () => {
  const declared = new Set([...htmlClean.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]));
  const hooks = [...jsClean.matchAll(/\['(js-[\w-]+)'/g)].map(m => m[1]);
  assert.ok(hooks.length >= 12, 'expected the injectText() map, found ' + hooks.length + ' hooks');
  const missing = hooks.filter(id => !declared.has(id));
  assertEmpty(missing, 'missing host element(s): ' + missing.join(', '));
});

/* ------------------------------------------------------------- assets */
check('local asset references resolve to real files', () => {
  const refs = [];
  for (const m of htmlClean.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) refs.push(m[1]);
  const missing = refs
    .filter(h => !/^(https?:|data:|#|mailto:|tel:)/.test(h))
    .filter(h => !fs.existsSync(path.join(root, h.split('?')[0].split('#')[0])));
  assertEmpty(missing, 'missing file(s): ' + missing.join(', '));
});

check('no remote dependency is required to render the page', () => {
  // Fonts are the only network request, and they are non-blocking + optional.
  const links = [...htmlClean.matchAll(/<link[^>]+href="(https?:[^"]+)"/g)].map(m => m[1]);
  assert.ok(links.every(u => u.includes('fonts.g')),
    'unexpected remote dependency: ' + links.join(' '));
  assert.ok(/<link[^>]+rel="stylesheet"[^>]+media="print"|<link[^>]+media="print"/.test(htmlClean),
    'the web-font stylesheet must load asynchronously (media="print")');
  assert.ok(!/<script[^>]+src="https?:/.test(htmlClean), 'remote script tag found');
});

check('script and stylesheet are referenced with relative paths', () => {
  assert.ok(/href="style\.css"/.test(htmlClean), 'style.css link missing');
  assert.ok(/src="script\.js"/.test(htmlClean), 'script.js tag missing');
});

/* ------------------------------------------------------------ hygiene */
check('script.js keeps every editable string inside CONFIG', () => {
  const before = jsClean.indexOf('const CONFIG');
  // The CONFIG object literal closes with a `};` at the start of a line.
  const end = jsClean.indexOf('\n};', before);
  assert.ok(before >= 0 && end > before, 'CONFIG block not found');
  const after = jsClean.slice(end);
  const literals = [...after.matchAll(/(?:textContent|innerHTML|placeholder)\s*=\s*'([^']{4,})'/g)]
    .map(m => m[1])
    .filter(s => !/^(is-|M |L |Z|px|0)/.test(s));
  assertEmpty(literals, 'hard-coded copy outside CONFIG: ' + literals.join(' | '));
});

check('no leftover debugging output', () => {
  const noisy = [...jsClean.matchAll(/\b(console\.(?:log|debug|dir|trace))\s*\(/g)].map(m => m[1]);
  assertEmpty(noisy, 'found ' + noisy.join(', '));
});

check('every class JS toggles is styled or documented', () => {
  const toggled = new Set();
  for (const m of jsClean.matchAll(/classList\.(?:add|remove|toggle)\(\s*'([\w-]+)'/g)) {
    toggled.add(m[1]);
  }
  const cssClasses = new Set([...cssClean.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => m[1]));
  const missing = [...toggled].filter(c => !cssClasses.has(c));
  assertEmpty(missing, 'class(es) toggled but never styled: ' + missing.join(', '));
});

check('index.html and script.js agree on the no-JS fallback', () => {
  assert.ok(/<noscript>/.test(htmlClean), 'no <noscript> fallback');
  assert.ok(/#main-screen\[hidden\]/.test(htmlClean), 'no-JS path never reveals #main-screen');
  assert.ok(/#opening-screen \{ display: none/.test(htmlClean), 'no-JS path never hides the opening');
});

console.log('---------------------------------');
console.log(passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) process.exitCode = 1;
