/* ═══════════════════════════════════════════════════════
   work.js: live "system canvases" for 03 Selected Work and the
   scroll focus state of the 04 Experience ledger.

   Self-contained IIFE, no dependencies, does nothing when the sections
   are absent. One rAF loop that only runs while a canvas is on screen
   (IntersectionObserver) and the tab is visible. Motion is transform and
   opacity only. Works with Lenis because it reads native scroll.
   prefers-reduced-motion: static, fully lit diagrams, no pulses.

   Desktop (split): the four canvases are moved into one sticky frame and
   morph into each other as the case-study text scrolls past.
   Narrower screens: each case study keeps its own canvas, which runs
   while it is in view.
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var win = window;
  var doc = document;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var LUT_N = 48;

  // run timeline (ms)
  var T_TRIGGER = 560;   // trigger node spins before the first hand-off
  var T_TRAVEL = 860;    // one pulse, node to node
  var T_GAP = 300;       // pause on a node before the next hand-off
  var T_SETTLE = 420;    // last node spins, then the run succeeds
  var T_HOLD = 3600;     // fully lit hold
  var T_RESET = 900;     // fade back before the next run
  var T_ENTER = 720;     // morph time before a run starts

  var reduceMq = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var splitMq = win.matchMedia ? win.matchMedia('(min-width: 1024px) and (min-height: 600px)') : null;

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function mkEl(tag, cls) {
    var el = doc.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function svgEl(tag, attrs) {
    var el = doc.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function f1(v) { return Math.round(v * 10) / 10; }

  function afterPaint(fn) {
    win.requestAnimationFrame(function () { win.requestAnimationFrame(fn); });
  }

  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  function listen(mq, fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  /* ─────────────────────────── scene model ─────────────────────────── */

  function buildScene(cv, caseEl, index) {
    var stage = cv.querySelector('[data-cs-stage]');
    if (!stage) return null;
    var s = {
      cv: cv, caseEl: caseEl, index: index, slot: cv.parentNode, stage: stage,
      nodes: {}, list: [], edges: [], waves: [], events: [],
      logs: [].slice.call(cv.querySelectorAll('.cs-log__list li')),
      status: cv.querySelector('[data-cs-status]'), statusText: null, statusState: '',
      running: false, t0: 0, k: 0, moving: null, moveT: 0,
      laid: false, entered: false, visible: false, leaveToken: 0
    };
    if (s.status) s.statusText = s.status.querySelector('.cs-log__text');

    [].forEach.call(stage.querySelectorAll('[data-node]'), function (el, i) {
      var n = {
        id: el.getAttribute('data-node'), el: el,
        label: el.querySelector('.cs-node__label'),
        agent: el.classList.contains('cs-node--agent'),
        subs: [], x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0, lb: 0
      };
      el.style.setProperty('--i', i);
      var ring = mkEl('i', 'cs-node__ring'); ring.setAttribute('aria-hidden', 'true');
      var chk = mkEl('i', 'cs-node__check'); chk.setAttribute('aria-hidden', 'true');
      el.appendChild(ring);
      el.appendChild(chk);
      s.nodes[n.id] = n;
      s.list.push(n);
    });

    var svg = svgEl('svg', { 'class': 'cs-wires', 'aria-hidden': 'true', focusable: 'false' });
    var gWire = svgEl('g'), gMark = svgEl('g'), gLit = svgEl('g');
    svg.appendChild(gWire); svg.appendChild(gMark); svg.appendChild(gLit);
    var pulseLayer = mkEl('div', 'cs-pulses');
    pulseLayer.setAttribute('aria-hidden', 'true');
    stage.insertBefore(pulseLayer, stage.firstChild);
    stage.insertBefore(svg, pulseLayer);
    s.svg = svg;
    var zoom = mkEl('div', 'cs-zoom');
    zoom.setAttribute('aria-hidden', 'true');
    zoom.innerHTML = '<i></i><i></i><i></i>';
    stage.appendChild(zoom);

    var bar = cv.querySelector('.cs-canvas__bar');
    if (bar) {
      var name = bar.querySelector('.cs-canvas__name');
      var btn = mkEl('button', 'cs-replay');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Replay the run' + (name ? ': ' + name.textContent : ''));
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v5h5"/></svg>';
      bar.insertBefore(btn, bar.querySelector('.cs-canvas__env'));
      s.replay = btn;
    }

    (stage.getAttribute('data-edges') || '').trim().split(/\s+/).forEach(function (tok) {
      var m = /^(\w+)([>-])(\w+)$/.exec(tok);
      if (!m || !s.nodes[m[1]] || !s.nodes[m[3]]) return;
      var sub = m[2] === '-';
      var wireCls = 'cs-wire' + (sub ? ' cs-wire--sub' : '');
      var e = {
        key: tok, from: s.nodes[m[1]], to: s.nodes[m[3]], sub: sub,
        lut: new Float32Array(LUT_N * 2), pulses: [],
        base: svgEl('path', { 'class': wireCls }),
        lit: svgEl('g', { 'class': 'cs-lit' }),
        litPath: svgEl('path', { 'class': wireCls }),
        port: svgEl('path', { 'class': 'cs-port' }),
        litPort: svgEl('path', { 'class': 'cs-port' }),
        arrow: sub ? null : svgEl('path', { 'class': 'cs-arrow' }),
        litArrow: sub ? null : svgEl('path', { 'class': 'cs-arrow' })
      };
      gWire.appendChild(e.base);
      if (e.arrow) gMark.appendChild(e.arrow);
      gMark.appendChild(e.port);
      e.lit.appendChild(e.litPath);
      if (e.litArrow) e.lit.appendChild(e.litArrow);
      e.lit.appendChild(e.litPort);
      gLit.appendChild(e.lit);
      ['cs-pulse', 'cs-pulse cs-pulse--t1', 'cs-pulse cs-pulse--t2'].forEach(function (c) {
        var p = mkEl('i', c);
        pulseLayer.appendChild(p);
        e.pulses.push(p);
      });
      if (sub) e.from.subs.push(e);
      s.edges.push(e);
    });

    s.waves = (stage.getAttribute('data-run') || '').split('|').map(function (w) {
      var wave = { edges: [], fire: [], subOnly: false };
      w.trim().split(/\s+/).forEach(function (tok) {
        if (!tok) return;
        if (s.nodes[tok]) { wave.fire.push(s.nodes[tok]); return; }
        for (var j = 0; j < s.edges.length; j++) {
          if (s.edges[j].key === tok) { wave.edges.push(s.edges[j]); return; }
        }
      });
      wave.subOnly = wave.edges.length > 0 && wave.edges.every(function (e) { return e.sub; });
      return wave;
    });

    var ev = [{ t: 0, type: 'fire', w: 0 }];
    var t = T_TRIGGER;
    for (var k = 1; k < s.waves.length; k++) {
      ev.push({ t: t, type: 'depart', w: k });
      ev.push({ t: t + T_TRAVEL, type: 'arrive', w: k });
      t += T_TRAVEL + T_GAP;
    }
    var end = t - T_GAP + T_SETTLE;
    ev.push({ t: end, type: 'finish' });
    ev.push({ t: end + T_HOLD, type: 'reset' });
    ev.push({ t: end + T_HOLD + T_RESET, type: 'loop' });
    s.events = ev;
    return s;
  }

  // Read node boxes (offset* ignore the transforms used for motion), then
  // write wire geometry. Runs on resize / mode change / font load only.
  function layoutScene(s) {
    var W = s.stage.clientWidth, H = s.stage.clientHeight;
    if (!W || !H) { s.laid = false; return; }
    var i, n;
    for (i = 0; i < s.list.length; i++) {
      n = s.list[i];
      n.x = n.el.offsetLeft; n.y = n.el.offsetTop;
      n.w = n.el.offsetWidth; n.h = n.el.offsetHeight;
      n.cx = n.x + n.w / 2; n.cy = n.y + n.h / 2;
      n.lb = n.label ? n.y + n.label.offsetTop + n.label.offsetHeight + 6 : n.y + n.h + 4;
    }
    s.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    for (i = 0; i < s.edges.length; i++) {
      var e = s.edges[i], a = e.from, b = e.to;
      var sx, sy, tx, ty, k, d, arrow = '', port = '';
      if (e.sub) {
        // agent sub-connection: diamond port on the agent's bottom edge, dashed wire down
        var idx = a.subs.indexOf(e);
        sx = a.x + a.w * (idx + 1) / (a.subs.length + 1); sy = a.y + a.h;
        tx = b.cx; ty = b.y;
        k = Math.max(16, (ty - sy) * 0.5);
        d = 'M' + f1(sx) + ' ' + f1(sy) + 'C' + f1(sx) + ' ' + f1(sy + k) + ' ' + f1(tx) + ' ' + f1(ty - k) + ' ' + f1(tx) + ' ' + f1(ty);
        port = 'M' + f1(sx) + ' ' + f1(sy - 4.5) + 'L' + f1(sx + 4.5) + ' ' + f1(sy) + 'L' + f1(sx) + ' ' + f1(sy + 4.5) + 'L' + f1(sx - 4.5) + ' ' + f1(sy) + 'Z';
      } else {
        var down = a.agent ? a.y + a.h : a.lb;
        var horizontal = b.x - (a.x + a.w) > 20 || b.y < down + 10;
        if (horizontal) {
          // n8n style: out of the right side, into the left side, with an arrowhead
          sx = a.x + a.w; sy = a.cy; tx = b.x - 7; ty = b.cy;
          k = Math.max(26, Math.abs(tx - sx) * 0.5);
          d = 'M' + f1(sx) + ' ' + f1(sy) + 'C' + f1(sx + k) + ' ' + f1(sy) + ' ' + f1(tx - k) + ' ' + f1(ty) + ' ' + f1(tx) + ' ' + f1(ty);
          arrow = 'M' + f1(b.x - 8) + ' ' + f1(ty - 4.5) + 'L' + f1(b.x - 0.5) + ' ' + f1(ty) + 'L' + f1(b.x - 8) + ' ' + f1(ty + 4.5) + 'Z';
          port = 'M' + f1(sx - 3.5) + ' ' + f1(sy) + 'a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0Z';
        } else {
          // wrapped row on narrow canvases: leave under the label, enter from the top
          sx = a.cx; sy = down; tx = b.cx; ty = b.y - 7;
          k = Math.max(20, (ty - sy) * 0.55);
          d = 'M' + f1(sx) + ' ' + f1(sy) + 'C' + f1(sx) + ' ' + f1(sy + k) + ' ' + f1(tx) + ' ' + f1(ty - k) + ' ' + f1(tx) + ' ' + f1(ty);
          arrow = 'M' + f1(tx - 4.5) + ' ' + f1(b.y - 8) + 'L' + f1(tx) + ' ' + f1(b.y - 0.5) + 'L' + f1(tx + 4.5) + ' ' + f1(b.y - 8) + 'Z';
        }
      }
      e.base.setAttribute('d', d);
      e.litPath.setAttribute('d', d);
      e.port.setAttribute('d', port);
      e.litPort.setAttribute('d', port);
      if (e.arrow) { e.arrow.setAttribute('d', arrow); e.litArrow.setAttribute('d', arrow); }

      var L = e.base.getTotalLength();
      for (var j = 0; j < LUT_N; j++) {
        var pt = e.base.getPointAtLength(L * j / (LUT_N - 1));
        e.lut[j * 2] = pt.x;
        e.lut[j * 2 + 1] = pt.y;
      }
    }
    s.laid = true;
  }

  function placePulses(e, p) {
    var lut = e.lut, last = LUT_N - 1;
    for (var j = 0; j < 3; j++) {
      var q = p - j * 0.05;
      if (q < 0) q = 0;
      var fi = q * last, i0 = fi | 0, fr = fi - i0, i1 = i0 < last ? i0 + 1 : i0;
      var x = lut[i0 * 2] + (lut[i1 * 2] - lut[i0 * 2]) * fr;
      var y = lut[i0 * 2 + 1] + (lut[i1 * 2 + 1] - lut[i0 * 2 + 1]) * fr;
      e.pulses[j].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
  }

  function setPulses(e, on) {
    for (var j = 0; j < 3; j++) e.pulses[j].classList.toggle('is-go', on);
  }

  function setStatus(s, state) {
    if (!s.status || s.statusState === state) return;
    s.statusState = state;
    s.status.classList.toggle('is-running', state === 'run');
    s.status.classList.toggle('is-ok', state === 'ok');
    if (s.statusText) s.statusText.textContent = state === 'run' ? 'Running' : state === 'ok' ? 'Succeeded' : 'Waiting';
  }

  // running nodes complete when the next hand-off leaves; an agent keeps
  // spinning while its own sub-nodes are being called
  function settle(s, wave) {
    for (var i = 0; i < s.list.length; i++) {
      var n = s.list[i], cl = n.el.classList;
      if (!cl.contains('is-run')) continue;
      if (wave && wave.subOnly && n.agent && wave.edges[0].from === n) continue;
      cl.remove('is-run');
      cl.add('is-done');
    }
  }

  function applyEvent(s, ev) {
    var w, i, e;
    if (ev.type === 'fire') {
      w = s.waves[0];
      for (i = 0; i < w.fire.length; i++) w.fire[i].el.classList.add('is-run');
      if (s.logs[0]) s.logs[0].classList.add('is-on');
      setStatus(s, 'run');
    } else if (ev.type === 'depart') {
      w = s.waves[ev.w];
      settle(s, w);
      for (i = 0; i < w.edges.length; i++) { placePulses(w.edges[i], 0); setPulses(w.edges[i], true); }
      s.moving = w;
      s.moveT = ev.t;
    } else if (ev.type === 'arrive') {
      w = s.waves[ev.w];
      for (i = 0; i < w.edges.length; i++) {
        e = w.edges[i];
        setPulses(e, false);
        e.lit.classList.add('is-lit');
        e.to.el.classList.add('is-run');
      }
      if (s.logs[ev.w]) s.logs[ev.w].classList.add('is-on');
      s.moving = null;
    } else if (ev.type === 'finish') {
      settle(s, null);
      setStatus(s, 'ok');
    } else if (ev.type === 'reset') {
      clearState(s, false);
    }
  }

  function tick(s, now) {
    var t = now - s.t0;
    if (t < 0) return;
    var ev = s.events;
    while (s.k < ev.length && ev[s.k].t <= t) {
      var e = ev[s.k++];
      if (e.type === 'loop') { s.k = 0; s.t0 = now; t = 0; continue; }
      applyEvent(s, e);
    }
    if (s.moving) {
      var p = (t - s.moveT) / T_TRAVEL;
      p = ease(p < 0 ? 0 : p > 1 ? 1 : p);
      var edges = s.moving.edges;
      for (var i = 0; i < edges.length; i++) placePulses(edges[i], p);
    }
  }

  function clearState(s, quiet) {
    if (quiet) s.stage.classList.add('is-quiet');
    for (var i = 0; i < s.list.length; i++) s.list[i].el.classList.remove('is-run', 'is-done');
    for (i = 0; i < s.edges.length; i++) { s.edges[i].lit.classList.remove('is-lit'); setPulses(s.edges[i], false); }
    for (i = 0; i < s.logs.length; i++) s.logs[i].classList.remove('is-on');
    s.moving = null;
    setStatus(s, 'wait');
    if (quiet) afterPaint(function () { s.stage.classList.remove('is-quiet'); });
  }

  function showAll(s) {
    s.running = false;
    s.moving = null;
    s.stage.classList.remove('is-from', 'is-leaving');
    s.stage.classList.add('is-in');
    for (var i = 0; i < s.list.length; i++) { s.list[i].el.classList.remove('is-run'); s.list[i].el.classList.add('is-done'); }
    for (i = 0; i < s.edges.length; i++) { s.edges[i].lit.classList.add('is-lit'); setPulses(s.edges[i], false); }
    for (i = 0; i < s.logs.length; i++) s.logs[i].classList.add('is-on');
    setStatus(s, 'ok');
  }

  /* ─────────────────────────── 03 Selected Work ─────────────────────────── */

  function initWork(sec) {
    if (sec.hasAttribute('data-cs-ready')) return;
    sec.setAttribute('data-cs-ready', '');
    var caseEls = [].slice.call(sec.querySelectorAll('[data-cs-case]'));
    var frame = sec.querySelector('[data-cs-frame]');
    var stageEl = sec.querySelector('.cs-stage') || sec;
    var scenes = [];
    caseEls.forEach(function (c, i) {
      var cv = c.querySelector('[data-cs-canvas]');
      var s = cv ? buildScene(cv, c, i) : null;
      if (s) scenes.push(s);
    });
    if (!scenes.length) return;

    var reel = sec.querySelector('[data-cs-reel]');
    var segs = [].slice.call(sec.querySelectorAll('[data-cs-seg]'));
    var fills = segs.map(function (a) { return a.querySelector('.cs-progress__fill'); });
    var fillVals = fills.map(function () { return -1; });
    var reduced = !!(reduceMq && reduceMq.matches);
    var canSplit = !!frame;
    var split = false, active = -1, secVisible = false, raf = 0, scrollDirty = false;
    var cost = { n: 0, sum: 0, max: 0 };

    sec.classList.add('is-live');
    sec.classList.toggle('is-still', reduced);
    scenes.forEach(function (s) {
      if (!s.replay) return;
      s.replay.addEventListener('click', function () {
        if (reduced) return;
        if (split && s.index !== active) return;
        s.stage.classList.add('is-in');
        s.entered = true;
        if (!split) s.visible = true;   // the observer stops it once it leaves view
        start(s, 120);
      });
    });

    function kick() { if (!raf) raf = win.requestAnimationFrame(loop); }

    function start(s, delay, fresh) {
      if (reduced) { showAll(s); return; }
      if (!fresh) clearState(s, true);
      s.running = true;
      s.k = 0;
      s.moving = null;
      s.t0 = performance.now() + (delay || 0);
      kick();
    }

    function stop(s) {
      s.running = false;
      if (s.moving) {
        for (var i = 0; i < s.moving.edges.length; i++) setPulses(s.moving.edges[i], false);
        s.moving = null;
      }
    }

    function enter(s, from) {
      s.leaveToken++;
      s.stage.classList.remove('is-leaving');
      clearState(s, true);
      var morph = from && from.laid && s.laid && from.list.length;
      for (var j = 0; j < s.list.length; j++) {
        var n = s.list[j], st = n.el.style;
        if (morph) {
          var m = from.list[Math.min(j, from.list.length - 1)];
          st.setProperty('--fx', f1(m.cx - n.cx) + 'px');
          st.setProperty('--fy', f1(m.cy - n.cy) + 'px');
        } else {
          st.removeProperty('--fx');
          st.removeProperty('--fy');
        }
      }
      s.stage.classList.add('is-from', 'is-in');
      s.entered = true;
      afterPaint(function () { s.stage.classList.remove('is-from'); });
    }

    function leave(s, to) {
      stop(s);
      var token = ++s.leaveToken;
      if (to && s.laid && to.laid) {
        for (var j = 0; j < s.list.length; j++) {
          var n = s.list[j], m = to.list[Math.min(j, to.list.length - 1)];
          n.el.style.setProperty('--tx', f1(m.cx - n.cx) + 'px');
          n.el.style.setProperty('--ty', f1(m.cy - n.cy) + 'px');
        }
      }
      s.stage.classList.add('is-leaving');
      win.setTimeout(function () {
        if (token !== s.leaveToken) return;
        s.stage.classList.remove('is-leaving', 'is-in');
        s.entered = false;
        clearState(s, true);
      }, 700);
    }

    function activate(i) {
      var prev = active > -1 ? scenes[active] : null, next = scenes[i];
      if (!next || prev === next) return;
      active = i;
      for (var c = 0; c < scenes.length; c++) scenes[c].caseEl.classList.toggle('is-current', c === i);
      for (c = 0; c < segs.length; c++) {
        if (c === i) segs[c].setAttribute('aria-current', 'step');
        else segs[c].removeAttribute('aria-current');
      }
      if (reel) reel.style.transform = 'translate3d(0,' + (-1.25 * i) + 'em,0)';
      if (prev) {
        prev.cv.classList.remove('is-active');
        if (reduced) prev.stage.classList.remove('is-in');
        else leave(prev, next);
      }
      next.cv.classList.add('is-active');
      if (reduced) { showAll(next); return; }
      enter(next, prev);
      if (secVisible && !doc.hidden) start(next, prev ? T_ENTER : T_ENTER * 0.6, true);
      else stop(next);
    }

    // read the four article rects first, then write classes and fills
    function syncScroll() {
      var line = win.innerHeight * 0.5, idx = 0, rects = [];
      for (var i = 0; i < scenes.length; i++) {
        var r = scenes[i].caseEl.getBoundingClientRect();
        rects.push(r);
        if (r.top <= line) idx = i;
      }
      var ri = rects[idx];
      var frac = (line - ri.top) / (ri.height || 1);
      frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
      if (idx !== active) activate(idx);
      for (i = 0; i < fills.length; i++) {
        var v = i < idx ? 1 : i > idx ? 0 : Math.round(frac * 500) / 500;
        if (v !== fillVals[i] && fills[i]) {
          fillVals[i] = v;
          fills[i].style.transform = 'scaleX(' + v + ')';
        }
      }
    }

    function loop(now) {
      raf = 0;
      var t0 = performance.now();
      if (split && scrollDirty) { scrollDirty = false; syncScroll(); }
      var any = false;
      for (var i = 0; i < scenes.length; i++) {
        if (scenes[i].running) { tick(scenes[i], now); any = true; }
      }
      var dt = performance.now() - t0;
      cost.n++; cost.sum += dt; if (dt > cost.max) cost.max = dt;
      if (any && !doc.hidden) raf = win.requestAnimationFrame(loop);
    }

    function layoutAll() { for (var i = 0; i < scenes.length; i++) layoutScene(scenes[i]); }

    function resumeVisible() {
      if (reduced || doc.hidden) return;
      if (split) {
        if (secVisible && active > -1 && !scenes[active].running) start(scenes[active], 200);
      } else {
        scenes.forEach(function (s) {
          if (!s.visible || s.running) return;
          if (!s.entered) { enter(s, null); start(s, T_ENTER * 0.6, true); }
          else start(s, 200);
        });
      }
    }

    var io = null;
    if ('IntersectionObserver' in win) {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var en = entries[i], el = en.target;
          if (el === stageEl) {
            secVisible = en.isIntersecting;
            if (!split) continue;
            if (secVisible) { scrollDirty = true; kick(); resumeVisible(); }
            else scenes.forEach(stop);
            continue;
          }
          if (split) continue;
          var s = null;
          for (var j = 0; j < scenes.length; j++) if (scenes[j].cv === el) s = scenes[j];
          if (!s) continue;
          var vis = en.isIntersecting && en.intersectionRatio >= 0.3;
          if (vis === s.visible) continue;
          s.visible = vis;
          if (!vis) { stop(s); continue; }
          if (reduced) { showAll(s); continue; }
          if (!s.entered) { enter(s, null); start(s, T_ENTER * 0.6, true); }
          else start(s, 250);
        }
      }, { threshold: [0, 0.3] });
    }

    function observeAll() {
      if (!io) { secVisible = true; return; }
      io.disconnect();
      io.observe(stageEl);
      scenes.forEach(function (s) { io.observe(s.cv); });
    }

    function setSplit(on) {
      on = !!(on && canSplit);
      scenes.forEach(stop);
      split = on;
      sec.classList.toggle('is-split', on);
      scenes.forEach(function (s) {
        var target = on ? frame : s.slot;
        if (s.cv.parentNode !== target) target.appendChild(s.cv);
        s.leaveToken++;
        s.cv.classList.remove('is-active');
        s.stage.classList.remove('is-in', 'is-leaving', 'is-from');
        s.entered = false;
        s.visible = false;
        clearState(s, true);
      });
      if (!on) caseEls.forEach(function (c) { c.classList.remove('is-current'); });
      active = -1;
      fillVals = fills.map(function () { return -1; });
      win.requestAnimationFrame(function () {
        layoutAll();
        if (split) syncScroll();
        else if (!io) scenes.forEach(showAll);
        else if (reduced) scenes.forEach(showAll);
        observeAll();
      });
    }

    if ('ResizeObserver' in win) {
      var ro = new win.ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          for (var j = 0; j < scenes.length; j++) {
            if (scenes[j].stage === entries[i].target) layoutScene(scenes[j]);
          }
        }
      });
      scenes.forEach(function (s) { ro.observe(s.stage); });
    } else {
      var rt = 0;
      win.addEventListener('resize', function () {
        win.clearTimeout(rt);
        rt = win.setTimeout(layoutAll, 150);
      });
    }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { win.requestAnimationFrame(layoutAll); });

    win.addEventListener('scroll', function () {
      if (split && secVisible) { scrollDirty = true; kick(); }
    }, { passive: true });
    win.addEventListener('resize', function () {
      if (split) { scrollDirty = true; kick(); }
    });

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) scenes.forEach(stop);
      else resumeVisible();
    });

    listen(splitMq, function (e) { setSplit(e.matches); });
    listen(reduceMq, function (e) {
      reduced = e.matches;
      sec.classList.toggle('is-still', reduced);
      if (reduced) {
        scenes.forEach(function (s) { stop(s); if (!split || s.index === active) showAll(s); });
      } else {
        scenes.forEach(function (s) { s.entered = s.stage.classList.contains('is-in'); });
        resumeVisible();
      }
    });

    setSplit(splitMq ? splitMq.matches : false);

    // Verification hooks. bench() runs the pure tick function without
    // scheduling any animation frames.
    win.__work = {
      cost: function () {
        return { frames: cost.n, avgMs: cost.n ? Math.round(cost.sum / cost.n * 10000) / 10000 : 0, maxMs: Math.round(cost.max * 1000) / 1000 };
      },
      bench: function (n) {
        n = n || 600;
        var s = scenes[active > -1 ? active : 0], was = s.running;
        s.running = true; s.k = 0; s.t0 = 0; s.moving = null;
        var t0 = performance.now();
        for (var i = 0; i < n; i++) tick(s, i * 16.667);
        var ms = (performance.now() - t0) / n;
        s.running = false;
        if (was) start(s, 0);
        else clearState(s, true);
        return { frames: n, msPerFrame: Math.round(ms * 10000) / 10000 };
      },
      state: function () {
        return {
          split: split, active: active, visible: secVisible, reduced: reduced,
          running: scenes.filter(function (s) { return s.running; }).map(function (s) { return s.index; }),
          t: active > -1 ? Math.round(performance.now() - scenes[active].t0) : null,
          k: active > -1 ? scenes[active].k : null
        };
      }
    };
  }

  /* ─────────────────────────── 04 Experience ─────────────────────────── */

  // The ledger row crossing the middle of the viewport gets its accent rule
  // and outcome highlight, so touch screens see the same state as hover.
  function initLedger(sec) {
    if (sec.hasAttribute('data-xp-ready')) return;
    sec.setAttribute('data-xp-ready', '');
    var rows = [].slice.call(sec.querySelectorAll('.xp-row'));
    if (!rows.length || !('IntersectionObserver' in win)) return;
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) entries[i].target.classList.toggle('is-focus', entries[i].isIntersecting);
    }, { rootMargin: '-49% 0px -49% 0px' });
    rows.forEach(function (r) { io.observe(r); });
  }

  onReady(function () {
    var work = doc.querySelector('[data-cs]');
    var xp = doc.querySelector('[data-xp]');
    if (work) initWork(work);
    if (xp) initLedger(xp);
  });
})();
