/* ==========================================================================
   tests/smoke.test.js
   Executes the real script.js against a minimal DOM shim, so every interaction
   (open → heart build → reveal → replay → letter → easter egg → music → tap
   hearts) actually runs instead of only being read.

   This is NOT a browser: there is no layout, no CSS and no rendering. It
   proves the code executes without throwing, that DOM contracts hold (one
   SVG, elements revealed/hidden, aria state) and that no second animation
   loop appears after repeated replay/taps.

   Run:  node tests/smoke.test.js
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* --------------------------------------------------------------- DOM shim */

function makeEl(tag, attrs) {
  const a = Object.assign({}, attrs);
  const el = {
    tagName: String(tag).toUpperCase(),
    _a: a,
    _l: {},
    _text: '',
    children: [],
    parentNode: null,
    hidden: Object.prototype.hasOwnProperty.call(a, 'hidden'),
    offsetWidth: 100,
    classes: new Set(String(a['class'] || '').split(/\s+/).filter(Boolean)),
    style: {
      setProperty(k, v) { this[k] = v; },
      removeProperty(k) { delete this[k]; }
    }
  };

  el.classList = {
    add(c) { el.classes.add(c); },
    remove(c) { el.classes.delete(c); },
    contains(c) { return el.classes.has(c); },
    toggle(c) { el.classes.has(c) ? el.classes.delete(c) : el.classes.add(c); }
  };

  el.setAttribute = function (k, v) {
    el._a[k] = String(v);
    if (k === 'class') el.classes = new Set(String(v).split(/\s+/).filter(Boolean));
    if (k === 'open') el.open = true;
    if (k === 'hidden') el.hidden = true;
  };
  el.getAttribute = function (k) {
    return Object.prototype.hasOwnProperty.call(el._a, k) ? el._a[k] : null;
  };
  el.removeAttribute = function (k) {
    delete el._a[k];
    if (k === 'open') el.open = false;
    if (k === 'hidden') el.hidden = false;
  };
  el.hasAttribute = function (k) { return Object.prototype.hasOwnProperty.call(el._a, k); };

  Object.defineProperty(el, 'textContent', {
    get() { return el._text; },
    set(v) {
      el._text = String(v);
      if (v === '') el.children.length = 0;          // the DOM contract buildHeart relies on
    }
  });

  el.appendChild = function (child) {
    child.parentNode = el;
    el.children.push(child);
    return child;
  };
  el.removeChild = function (child) {
    const i = el.children.indexOf(child);
    if (i >= 0) el.children.splice(i, 1);
    child.parentNode = null;
    return child;
  };
  el.addEventListener = function (type, fn) { (el._l[type] = el._l[type] || []).push(fn); };
  el.removeEventListener = function (type, fn) {
    el._l[type] = (el._l[type] || []).filter(f => f !== fn);
  };
  el.focus = function () { document.activeElement = el; };
  el.blur = function () { if (document.activeElement === el) document.activeElement = null; };
  el.getBoundingClientRect = function () {
    return { top: 0, bottom: 120, left: 0, right: 390, width: 390, height: 120 };
  };
  el.scrollIntoView = function () { el.scrolledIntoView = true; };
  el.contains = function (node) {
    let n = node;
    while (n) { if (n === el) return true; n = n.parentNode; }
    return false;
  };
  el.closest = function (selector) {
    const parts = selector.split(',').map(s => s.trim()).filter(Boolean);
    let node = el;
    while (node && node.classList) {
      for (const p of parts) {
        if (p.startsWith('.')) { if (node.classes.has(p.slice(1))) return node; }
        else if (node.tagName === p.toUpperCase()) return node;
      }
      node = node.parentNode;
    }
    return null;
  };

  /* canvas + dialog behaviour */
  if (el.tagName === 'CANVAS') {
    el.clientWidth = 390;
    el.clientHeight = 780;
    el.getContext = function () { return ctx2d(); };
  }
  if (el.tagName === 'DIALOG') {
    el.open = false;
    el.showModal = function () { el.open = true; };
    el.close = function () {
      if (!el.open) return;
      el.open = false;
      (el._l.close || []).slice().forEach(f => f.call(el, { type: 'close' }));
    };
  }
  if (el.tagName === 'PATH' || el.tagName === 'SVG') {
    el.getTotalLength = function () { return 240; };
  }
  return el;
}

function ctx2d() {
  return {
    font: '', fillStyle: '', globalAlpha: 1,
    setTransform() {}, clearRect() {}, beginPath() {}, closePath() {},
    arc() {}, fill() {}, moveTo() {}, bezierCurveTo() {}, stroke() {},
    measureText(t) { return { width: String(t).length * 0.5 }; }
  };
}

/* Build an element for every tag used in the real markup. */
const registry = new Map();
const allElements = [];
const bodyEl = makeEl('body', {});
allElements.push(bodyEl);

const tagRe = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
let m;
while ((m = tagRe.exec(html)) !== null) {
  const tag = m[1];
  const raw = m[2];
  const attrs = {};
  const attrRe = /([\w-]+)\s*=\s*"([^"]*)"/g;
  let am;
  while ((am = attrRe.exec(raw)) !== null) attrs[am[1]] = am[2];
  /* boolean attributes such as `hidden` or `loop` carry no value */
  const rest = raw.replace(/([\w-]+)\s*=\s*"[^"]*"/g, ' ');
  for (const b of rest.matchAll(/(?:^|\s)([\w-]+)(?=\s|$)/g)) {
    if (!(b[1] in attrs)) attrs[b[1]] = '';
  }
  const el = makeEl(tag, attrs);
  allElements.push(el);
  if (attrs.id) registry.set(attrs.id, el);
}

const docListeners = {};
const extraElements = [];

const documentShim = {
  readyState: 'complete',
  hidden: false,
  activeElement: null,
  documentElement: { clientHeight: 780, clientWidth: 390 },
  fonts: { ready: Promise.resolve() },
  getElementById(id) { return registry.get(id) || null; },
  querySelector(sel) {
    const want = sel.startsWith('.') ? sel.slice(1) : sel;
    const cls = sel.startsWith('.');
    for (const el of allElements.concat(extraElements)) {
      if (cls ? el.classes.has(want) : el.tagName === want.toUpperCase()) return el;
    }
    return null;
  },
  createElement(tag) { const e = makeEl(tag, {}); extraElements.push(e); return e; },
  createElementNS(ns, tag) {
    const e = makeEl(tag, {});
    extraElements.push(e);
    e.namespaceURI = ns;
    return e;
  },
  addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
  removeEventListener(type, fn) {
    docListeners[type] = (docListeners[type] || []).filter(f => f !== fn);
  }
};

bodyEl.parentNode = documentShim;

const windowShim = {
  innerWidth: 390,
  innerHeight: 780,
  devicePixelRatio: 1,
  matchMedia() { return { matches: false, addEventListener() {}, addListener() {}, removeEventListener() {} }; },
  addEventListener() {},
  removeEventListener() {},
  scrollTo() {}
};

/* requestAnimationFrame that we can inspect for runaway loops */
const rafPending = new Map();
let rafSeq = 1;
function requestAnimationFrame(cb) {
  const id = rafSeq++;
  rafPending.set(id, cb);
  setTimeout(function () {
    const fn = rafPending.get(id);
    if (fn) { rafPending.delete(id); fn(performance.now()); }
  }, 16);
  return id;
}
function cancelAnimationFrame(id) { rafPending.delete(id); }

global.window = windowShim;
global.document = documentShim;
global.requestAnimationFrame = requestAnimationFrame;
global.cancelAnimationFrame = cancelAnimationFrame;

/* ------------------------------------------------------------- the test */

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
const assert = (c, msg) => { if (!c) throw new Error(msg); };

function fire(el, type, extra) {
  const e = Object.assign({
    target: el, currentTarget: el, clientX: 60, clientY: 300,
    preventDefault() {}, stopPropagation() {}
  }, extra || {});
  const nodes = [];
  let n = el;
  while (n) { nodes.push(n); n = n.parentNode; }
  nodes.reverse().forEach(node => {
    const list = (node._l && node._l[type]) || [];
    list.slice().forEach(fn => fn.call(node, e));
  });
  (docListeners[type] || []).slice().forEach(fn => fn.call(documentShim, e));
}
const click = el => fire(el, 'click');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function walk(node, out) {
  out = out || [];
  for (const c of (node.children || [])) { out.push(c); walk(c, out); }
  return out;
}

async function main() {
  console.log('\nPROJECT AYESHA — runtime smoke test (DOM shim, not a browser)');
  console.log('-------------------------------------------------------------');

  /* require runs script.js, which boots itself (readyState is "complete") */
  require('../script.js');
  const id = documentShim.getElementById;

  check('script boots and injects every CONFIG string', () => {
    assert(id('js-name').textContent === 'Ayesha', 'name not injected');
    assert(id('js-final-title').textContent === 'I Love You, Ayesha', 'title not injected');
    assert(id('js-letter-body').textContent.indexOf('Ayesha,') === 0, 'letter not injected');
    assert(id('main-screen').hidden === true, 'main screen should start hidden');
    assert(id('opening-screen').hidden !== true, 'opening screen should start visible');
  });

  click(id('open-btn'));
  await sleep(900);

  check('opening the surprise reveals the main screen', () => {
    assert(id('main-screen').hidden === false, 'main screen still hidden');
    assert(id('opening-screen').classList.contains('is-leaving'), 'opening never left');
    assert(id('opening-screen').hidden === true, 'opening screen not hidden after the fade');
  });

  check('the heart is rendered as one SVG with words and a contour', () => {
    const kids = id('heart').children;
    assert(kids.length === 1, 'expected exactly 1 child, got ' + kids.length);
    const svg = kids[0];
    assert(svg.tagName === 'SVG', 'child is not an <svg>');
    const nodes = walk(svg);
    const texts = nodes.filter(n => n.tagName === 'TEXT');
    const paths = nodes.filter(n => n.tagName === 'PATH');
    assert(texts.length >= 15, 'only ' + texts.length + ' word elements');
    assert(paths.length === 1, 'expected 1 contour path, got ' + paths.length);
    assert(svg.getAttribute('role') === 'img', 'svg is not exposed as an image');
    const desc = nodes.find(n => n.tagName === 'DESC');
    assert(desc && desc.textContent.indexOf('I love you, Ayesha') >= 0,
      'the accessible description is missing the phrases');
    assert(texts.every(t => t.getAttribute('text-anchor') === 'middle'),
      'every word must be centre-anchored');
  });

  await sleep(2600);

  check('the reveal follows the heart formation', () => {
    const hero = documentShim.querySelector('.hero');
    assert(hero.classList.contains('is-revealed'), 'reveal never fired');
  });

  /* ---- replay, three times in a row ---- */
  click(id('replay-btn'));
  await sleep(120);
  click(id('replay-btn'));
  await sleep(120);
  click(id('replay-btn'));
  await sleep(3200);

  check('replay rebuilds the heart without stacking SVGs or loops', () => {
    const kids = id('heart').children;
    assert(kids.length === 1, 'replay left ' + kids.length + ' SVGs behind');
    const texts = walk(kids[0]).filter(n => n.tagName === 'TEXT');
    assert(texts.length >= 15, 'replay lost words: ' + texts.length);
    const hero = documentShim.querySelector('.hero');
    assert(hero.classList.contains('is-revealed'), 'reveal did not fire after replay');
    assert(rafPending.size <= 6,
      rafPending.size + ' animation frames queued — looks like a duplicate loop');
  });

  /* ---- letter ---- */
  click(id('letter-btn'));
  await sleep(520);
  check('the secret letter opens and takes focus', () => {
    assert(id('letter-btn').getAttribute('aria-expanded') === 'true', 'aria-expanded not set');
    assert(id('letter-panel').hidden === false, 'panel stayed hidden');
    assert(documentShim.activeElement === id('letter-paper'), 'focus did not move to the paper');
    assert(id('envelope').classList.contains('is-open'), 'envelope did not open');
  });
  click(id('letter-close'));
  await sleep(400);
  check('the secret letter closes again', () => {
    assert(id('letter-btn').getAttribute('aria-expanded') === 'false', 'aria-expanded stuck');
    assert(id('letter-panel').hidden === true, 'panel still visible');
    assert(documentShim.activeElement === id('letter-btn'), 'focus did not return to the button');
  });

  /* ---- easter egg ---- */
  click(id('secret-heart'));
  click(id('secret-heart'));
  check('two taps only nudge (the dialog stays shut)', () => {
    assert(id('egg-dialog').open !== true, 'dialog opened too early');
    assert(id('secret-heart').classList.contains('is-nudge'), 'the nudge animation never ran');
  });
  click(id('secret-heart'));
  check('the third tap opens the easter egg', () => {
    assert(id('egg-dialog').open === true, 'dialog did not open');
  });
  click(id('egg-close'));
  check('the easter egg closes again', () => {
    assert(id('egg-dialog').open === false, 'dialog did not close');
  });
  click(id('secret-heart'));
  click(id('secret-heart'));
  check('the tap counter re-arms after the egg was closed', () => {
    assert(id('egg-dialog').open !== true, 'counter did not reset — opened after 2 taps');
  });
  click(id('secret-heart'));
  check('and the next three taps open it again', () => {
    assert(id('egg-dialog').open === true, 'dialog did not reopen');
  });
  click(id('egg-close'));

  /* ---- music ---- */
  click(id('music-btn'));
  check('music is honestly reported as unavailable', () => {
    assert(id('music-btn').getAttribute('aria-disabled') === 'true', 'button not marked disabled');
    assert(id('music-btn').getAttribute('title').indexOf('No audio file') === 0,
      'tooltip does not explain itself');
    assert(id('music-btn').getAttribute('aria-pressed') === 'false', 'claims to be playing');
    assert(id('control-status').textContent.indexOf('No audio file') >= 0,
      'no status message was shown');
    assert(id('music').getAttribute('src') === null, 'an audio src was invented');
  });

  /* ---- ambient loop + tap hearts ---- */
  for (let i = 0; i < 6; i++) fire(bodyEl, 'click');
  await sleep(120);
  check('tapping empty space spawns hearts without starting extra loops', () => {
    assert(rafPending.size <= 6, rafPending.size + ' queued frames after 6 taps');
  });

  documentShim.hidden = true;
  fire(documentShim, 'visibilitychange');
  const whenHidden = rafPending.size;
  documentShim.hidden = false;
  fire(documentShim, 'visibilitychange');
  await sleep(80);
  check('the animation loop pauses while the page is hidden', () => {
    assert(whenHidden <= 2, 'loop kept running while hidden (' + whenHidden + ' frames)');
    assert(rafPending.size <= 6, 'loop did not resume cleanly');
  });

  console.log('-------------------------------------------------------------');
  console.log(passed + ' passed, ' + failures.length + ' failed\n');
  if (failures.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);   // stop the ambient loop
}

main().catch(err => {
  console.error('\n  THREW: ' + err.stack);
  process.exitCode = 1;
  process.exit(1);
});
