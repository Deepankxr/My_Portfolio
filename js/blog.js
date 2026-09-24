/* ═══════════════════════════════════════════════════════
   BLOG · the reading platform
   ─────────────────────────────────────────────────────────
   thoughts.html   search as you type (title, excerpt, category), topic
                   chips with counts, the featured latest essay, and the
                   filter state in the URL (?topic=...&q=...) with back/forward.
   blog/*.html     table of contents (a sticky rail on desktop, a
                   collapsible panel on smaller screens) that follows the
                   section being read, time left, previous/next essay,
                   "More in <category>", and a copy link button.
   Everything here is an enhancement. Without it the index lists every
   essay as plain links and each article reads top to bottom as HTML.
   Post pages also load js/posts.js (window.BLOG_POSTS).
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var doc = document;
  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = function () { return !!(reduceMq && reduceMq.matches); };

  // ── Helpers ──
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function make(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fold(s) {
    s = String(s || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.replace(/[\u2018\u2019]/g, "'");
  }
  function slugify(s) {
    return fold(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function escHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  // Small line icons, drawn at 24x24 like the rest of the site
  var ICONS = {
    arrowR: 'M5 12h14M13 6l6 6-6 6',
    arrowL: 'M19 12H5M11 6l-6 6 6 6',
    arrowUp: 'M12 19V5M6 11l6-6 6 6',
    link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
    check: 'M5 12.5l4.5 4.5L19 7',
    chevron: 'M6 9l6 6 6-6',
    grid: 'M4 5h16M4 12h16M4 19h10'
  };
  function icon(name, size) {
    var s = doc.createElementNS(SVG_NS, 'svg');
    s.setAttribute('width', size || 16);
    s.setAttribute('height', size || 16);
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var p = doc.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', ICONS[name]);
    s.appendChild(p);
    return s;
  }

  // Scroll through Lenis when main.js runs it, so the motion matches the rest of the site
  function scrollToY(y, instant) {
    y = Math.max(0, Math.round(y));
    var lenis = window.lenis;
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(y, instant || reduced() ? { immediate: true } : {});
    } else {
      window.scrollTo({ top: y, behavior: instant || reduced() ? 'auto' : 'smooth' });
    }
  }
  // Lenis measures the page on a debounce; after this file changes the page
  // height, measure now so the scroll range is right straight away
  function resizeScroller() {
    var lenis = window.lenis;
    if (lenis && typeof lenis.resize === 'function') {
      try { lenis.resize(); } catch (e) { /* older Lenis: its own observer catches up */ }
    }
  }
  // Clearance under the fixed glass nav when jumping to a heading
  function navClearance() {
    var nav = doc.getElementById('nav');
    var shell = nav && nav.querySelector('.nav-shell');
    var b = shell ? shell.getBoundingClientRect().bottom : 80;
    return clamp(b, 56, 120) + 28;
  }

  // One polite live region per page for short confirmations. It is created
  // before anything is announced, so screen readers pick up the first change.
  var liveEl = null, liveTimer = 0;
  function ensureLive() {
    if (!liveEl) {
      liveEl = make('p', 'blog-vh');
      liveEl.setAttribute('role', 'status');
      doc.body.appendChild(liveEl);
    }
    return liveEl;
  }
  function announce(text) {
    ensureLive();
    clearTimeout(liveTimer);
    liveEl.textContent = '';
    liveTimer = setTimeout(function () { liveEl.textContent = text; }, 80);
  }

  // Copy text with the Clipboard API; the textarea route covers older browsers
  function legacyCopy(text) {
    var ta = make('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  // ═══════════════════════════════════════════════════════
  // INDEX · thoughts.html
  // ═══════════════════════════════════════════════════════
  function initIndex(index) {
    var list = $('[data-blog-list]', index);
    if (!list) return;
    var form = $('[data-blog-search]');
    var input = form && $('input', form);
    var clearBtn = $('[data-blog-clear]');
    var chipsWrap = $('[data-blog-topics]');
    var feature = $('[data-blog-feature]', index);
    var heading = $('[data-blog-heading]', index);
    var countEl = $('[data-blog-count]', index);
    var live = $('[data-blog-live]', index);
    var empty = $('[data-blog-empty]', index);
    var emptyTitle = $('[data-blog-empty-title]', index);
    var anyTopicBtn = $('[data-blog-anytopic]', index);
    var resets = $$('[data-blog-reset]', index);
    var bar = $('.blog-bar', index);

    // ── Read the rows once: the static HTML is the source of truth ──
    var rows = $$('.blog-post', list).map(function (li, i) {
      var link = $('.blog-post__link', li);
      var ex = $('.blog-post__excerpt', li);
      var cat = li.getAttribute('data-category') || (($('.blog-tag', li) || {}).textContent || '');
      var r = {
        el: li, link: link, ex: ex,
        title: link ? link.textContent : '',
        excerpt: ex ? ex.textContent : '',
        category: cat.trim(),
        topic: li.getAttribute('data-topic') || slugify(cat),
        minutes: parseInt(li.getAttribute('data-minutes'), 10) || 0,
        featured: li.hasAttribute('data-featured'),
        marked: '', shown: !li.hidden
      };
      r.hay = fold(r.title + ' ' + r.excerpt + ' ' + r.category);
      var num = $('.blog-post__num', li);
      if (num) num.textContent = (i < 9 ? '0' : '') + (i + 1);
      return r;
    });
    if (!rows.length) return;

    // ── Topics and totals, recounted from the rows ──
    var topics = { all: { label: 'All', count: rows.length } };
    var order = [];
    var totalMinutes = 0;
    rows.forEach(function (r) {
      totalMinutes += r.minutes;
      if (!topics[r.topic]) { topics[r.topic] = { label: r.category, count: 0 }; order.push(r.topic); }
      topics[r.topic].count++;
    });

    var chips = chipsWrap ? $$('.blog-chip', chipsWrap) : [];
    function setChipCount(chip, n) {
      var badge = $('.blog-chip__n', chip);
      if (!badge) return;
      badge.textContent = '';
      badge.appendChild(doc.createTextNode(String(n)));
      badge.appendChild(make('span', 'blog-vh', n === 1 ? ' essay' : ' essays'));
    }
    if (chipsWrap) {
      var have = {};
      chips.forEach(function (c) {
        var t = c.getAttribute('data-topic');
        have[t] = true;
        if (!topics[t]) { c.hidden = true; return; }
        setChipCount(c, topics[t].count);
      });
      // a category added to the list without a chip still gets one
      order.forEach(function (t) {
        if (have[t]) return;
        var c = make('button', 'blog-chip', topics[t].label + ' ');
        c.type = 'button';
        c.setAttribute('data-topic', t);
        c.setAttribute('aria-pressed', 'false');
        c.appendChild(make('span', 'blog-chip__n'));
        setChipCount(c, topics[t].count);
        chipsWrap.appendChild(c);
        chips.push(c);
      });
    }

    // ── State <-> URL ──
    var state = { topic: 'all', q: '' };
    function readUrl() {
      var p = new URLSearchParams(window.location.search);
      var t = slugify(p.get('topic') || 'all');
      return { topic: topics[t] ? t : 'all', q: (p.get('q') || '').slice(0, 80) };
    }
    function writeUrl(push) {
      var p = new URLSearchParams(window.location.search);
      if (state.topic !== 'all') p.set('topic', state.topic); else p.delete('topic');
      var q = state.q.trim();
      if (q) p.set('q', q); else p.delete('q');
      var qs = p.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      if (url === window.location.pathname + window.location.search + window.location.hash) return;
      try { window.history[push ? 'pushState' : 'replaceState']({ blog: true }, '', url); } catch (e) { /* file:// or sandboxed */ }
    }

    // ── Matching ──
    function tokensOf(q) {
      return fold(q).split(/\s+/).map(function (t) {
        return t.replace(/^["'\u201c\u201d(]+|["'\u201c\u201d).,;:!?]+$/g, '');
      }).filter(Boolean).slice(0, 8);
    }
    function markup(text, toks) {
      var re = new RegExp('(' + toks.slice().sort(function (a, b) { return b.length - a.length; }).map(escRe).join('|') + ')', 'gi');
      return text.split(re).map(function (part, i) {
        return i % 2 ? '<mark>' + escHtml(part) + '</mark>' : escHtml(part);
      }).join('');
    }
    function highlight(r, toks) {
      var key = toks.join(' ');
      if (r.marked === key) return;
      r.marked = key;
      if (!toks.length) {
        if (r.link) r.link.textContent = r.title;
        if (r.ex) r.ex.textContent = r.excerpt;
        return;
      }
      if (r.link) r.link.innerHTML = markup(r.title, toks);
      if (r.ex) r.ex.innerHTML = markup(r.excerpt, toks);
    }
    function matches(r, toks, topic) {
      if (topic !== 'all' && r.topic !== topic) return false;
      for (var i = 0; i < toks.length; i++) if (r.hay.indexOf(toks[i]) < 0) return false;
      return true;
    }

    // ── Rows that scroll into view rise in (only ever hidden by this script) ──
    var waitIO = null;
    if (!reduced() && 'IntersectionObserver' in window) {
      waitIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.remove('is-waiting');
          waitIO.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -6% 0px' });
    }
    function stopWaiting() {
      if (!waitIO) return;
      waitIO.disconnect();
      waitIO = null;
      rows.forEach(function (r) { r.el.classList.remove('is-waiting'); });
    }

    var announceTimer = 0, wasFiltering = false;
    function apply(opts) {
      opts = opts || {};
      var toks = tokensOf(state.q);
      var q = state.q.trim();
      var filtering = state.topic !== 'all' || toks.length > 0;
      var shown = 0, anyTopic = 0, entering = [];

      rows.forEach(function (r) {
        var ok = matches(r, toks, state.topic);
        // the latest essay lives in the featured card until a filter is on
        var vis = ok && (filtering || !r.featured);
        if (toks.length && state.topic !== 'all' && matches(r, toks, 'all')) anyTopic++;
        if (ok) shown++;
        if (vis && !r.shown) entering.push(r.el);
        if (r.el.hidden !== !vis) r.el.hidden = !vis;
        r.shown = vis;
        highlight(r, ok ? toks : []);
      });

      index.classList.toggle('is-filtering', filtering);
      if (feature) feature.hidden = filtering;
      if (empty) empty.hidden = shown > 0;
      list.hidden = shown === 0;

      var label = state.topic !== 'all' ? topics[state.topic].label : '';
      var quoted = '\u201c' + q + '\u201d';
      var text;
      if (!filtering) {
        text = plural(rows.length, 'essay', 'essays') + ' · ' + totalMinutes + ' minutes of reading · newest first';
      } else if (shown) {
        text = plural(shown, 'essay', 'essays') + (label ? ' in ' + label : '') +
          (q ? (shown === 1 ? ' matches ' : ' match ') + quoted : '');
      } else {
        text = 'No essays' + (label ? ' in ' + label : '') + ' match ' + quoted;
      }
      if (heading) heading.textContent = !filtering ? 'All essays' : (label || 'Search results');
      if (countEl) countEl.textContent = text;

      if (emptyTitle && !shown) {
        emptyTitle.textContent = 'Nothing' + (label ? ' in ' + label : '') + ' matches ' + quoted + ' yet.';
      }
      if (anyTopicBtn) {
        anyTopicBtn.hidden = !(anyTopic && !shown);
        if (anyTopic) anyTopicBtn.textContent = 'Search every topic (' + anyTopic + ')';
      }

      chips.forEach(function (c) {
        var on = c.getAttribute('data-topic') === state.topic;
        if (c.getAttribute('aria-pressed') !== String(on)) c.setAttribute('aria-pressed', String(on));
      });
      if (input && !opts.fromInput && input.value !== state.q) input.value = state.q;
      if (form) form.classList.toggle('has-value', !!state.q);
      if (clearBtn) clearBtn.hidden = !state.q;
      resets.forEach(function (b) { if (b.closest('.blog-bar')) b.hidden = !filtering; });

      if (live && !opts.silent) {
        clearTimeout(announceTimer);
        announceTimer = setTimeout(function () { live.textContent = text; }, opts.fromInput ? 450 : 60);
      }

      if (filtering !== wasFiltering || opts.animate) resizeScroller();
      wasFiltering = filtering;

      if (opts.animate && entering.length && !reduced()) {
        stopWaiting();
        entering.forEach(function (el, i) {
          el.classList.remove('is-entering');
          el.style.setProperty('--i', Math.min(i, 8));
        });
        void list.offsetWidth;   // restart the animation on rows shown again
        entering.forEach(function (el) { el.classList.add('is-entering'); });
      }
    }
    // the content of a row animates together, so the first one to finish ends it
    list.addEventListener('animationend', function (e) {
      var row = e.target.closest ? e.target.closest('.blog-post') : null;
      if (row && row.classList.contains('is-entering')) row.classList.remove('is-entering');
    });

    function setState(next, how) {
      var changed = next.topic !== state.topic || next.q !== state.q;
      state.topic = next.topic;
      state.q = next.q;
      if (!changed && !how.force) return;
      apply({ animate: !how.silent, fromInput: how.fromInput, silent: how.silent });
      if (how.url) writeUrl(how.url === 'push');
    }

    // ── Wiring ──
    if (chipsWrap) {
      chipsWrap.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('.blog-chip') : null;
        if (!chip || !chipsWrap.contains(chip)) return;
        var t = chip.getAttribute('data-topic') || 'all';
        // pressing the active topic again goes back to everything
        if (t === state.topic && t !== 'all') t = 'all';
        setState({ topic: t, q: state.q }, { url: 'push' });
      });
    }

    var urlTimer = 0;
    if (input) {
      input.addEventListener('input', function () {
        setState({ topic: state.topic, q: input.value.slice(0, 80) }, { fromInput: true });
        clearTimeout(urlTimer);
        urlTimer = setTimeout(function () { writeUrl(false); }, 350);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (input.value) {
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
            setState({ topic: state.topic, q: '' }, { url: 'replace' });
          } else {
            input.blur();
          }
        } else if (e.key === 'ArrowDown') {
          // straight from the search field to the first result
          var first = firstResultLink();
          if (first) { e.preventDefault(); first.focus(); }
        }
      });
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearTimeout(urlTimer);
        writeUrl(false);
        // on a phone, put the keyboard away and show what matched
        if (window.matchMedia && window.matchMedia('(hover: none)').matches && input) input.blur();
        if (bar) {
          var r = bar.getBoundingClientRect();
          if (r.top > window.innerHeight * 0.7 || r.top < 0) scrollToY(r.top + window.scrollY - navClearance());
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (input) { input.value = ''; input.focus(); }
        setState({ topic: state.topic, q: '' }, { url: 'replace' });
      });
    }
    resets.forEach(function (b) {
      b.addEventListener('click', function () {
        if (input) input.value = '';
        setState({ topic: 'all', q: '' }, { url: 'push' });
        var target = (chips[0] && !chips[0].hidden) ? chips[0] : input;
        if (b.closest('.blog-empty') && target) target.focus({ preventScroll: true });
      });
    });
    if (anyTopicBtn) {
      anyTopicBtn.addEventListener('click', function () {
        setState({ topic: 'all', q: state.q }, { url: 'push' });
      });
    }

    function firstResultLink() {
      if (feature && !feature.hidden) return $('.blog-feature__link', feature);
      for (var i = 0; i < rows.length; i++) if (!rows[i].el.hidden) return rows[i].link;
      return null;
    }

    // "/" jumps to the search field from anywhere on the page
    doc.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || !input) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      var r = form.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) scrollToY(r.top + window.scrollY - window.innerHeight * 0.3);
      input.focus({ preventScroll: true });
    });

    window.addEventListener('popstate', function () {
      var s = readUrl();
      setState(s, {});
    });

    // ── First render: honour a shared link before anything paints ──
    var initial = readUrl();
    state.topic = initial.topic;
    state.q = initial.q;
    apply({ silent: true });
    if (initial.topic !== 'all' || initial.q) {
      writeUrl(false);   // tidy an unknown topic out of the address bar
    } else if (waitIO) {
      // rows below the fold rise in as they arrive
      var vh = window.innerHeight;
      rows.forEach(function (r) {
        if (r.el.hidden) return;
        if (r.el.getBoundingClientRect().top > vh) {
          r.el.classList.add('is-waiting');
          waitIO.observe(r.el);
        }
      });
    }

    // Keyboard hint only where there is a keyboard
    if (form && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      form.classList.add('has-key');
    }
  }

  // ═══════════════════════════════════════════════════════
  // POST · blog/*.html
  // ═══════════════════════════════════════════════════════
  function currentSlug() {
    var c = $('link[rel="canonical"]');
    var path = (c && c.getAttribute('href')) || window.location.pathname;
    var m = path.split('#')[0].split('?')[0].match(/([^\/]+?)(?:\.html)?\/?$/);
    return m ? m[1] : '';
  }

  function initPost(article) {
    var posts = window.BLOG_POSTS || [];
    var slug = currentSlug();
    var idx = -1;
    for (var i = 0; i < posts.length; i++) if (posts[i].slug === slug) { idx = i; break; }
    var post = idx > -1 ? posts[idx] : null;
    var catEl = $('.post-meta .post-cat');
    var category = post ? post.category : (catEl ? catEl.textContent.trim() : '');
    var minutes = post ? post.minutes : (function () {
      var m = ($('.post-meta') || {}).textContent;
      m = m && m.match(/(\d+)\s*min/);
      return m ? parseInt(m[1], 10) : 0;
    })();
    var INDEX_URL = '../thoughts.html';
    // topic links land on the filtered list itself, below the index header
    var topicUrl = function (cat) { return INDEX_URL + '?topic=' + slugify(cat) + '#essays'; };
    var canonical = $('link[rel="canonical"]');
    var shareUrl = (canonical && canonical.href) || window.location.href.split('#')[0];
    var container = article.parentNode;

    // ── The category in the header opens the index on that topic ──
    if (catEl && category && !$('a', catEl)) {
      var catLink = make('a', 'post-cat__link', catEl.textContent);
      catLink.href = topicUrl(category);
      catLink.setAttribute('aria-label', 'More essays in ' + category);
      catEl.textContent = '';
      catEl.appendChild(catLink);
    }

    // ── Sections ──
    var heads = $$('h2', article).filter(function (h) { return h.parentNode === article; });
    var used = {};
    heads.forEach(function (h) {
      if (!h.id) {
        var base = slugify(h.textContent.replace(/^\s*\d+[.)]\s*/, '')) || 'section';
        if (/^\d/.test(base)) base = 'section-' + base;
        var id = base, n = 2;
        while (used[id] || doc.getElementById(id)) id = base + '-' + n++;
        h.id = id;
      }
      used[h.id] = true;
    });
    if (!article.id) article.id = 'essay';

    // Copy link: the button itself confirms (label and icon), and the live
    // region says it for screen readers
    ensureLive();
    function copyButton(cls, label) {
      var b = make('button', cls);
      var text = make('span', 'post-copy__label', label);
      var timer = 0;
      b.type = 'button';
      b.appendChild(icon('link', 15));
      b.appendChild(text);
      b.addEventListener('click', function () {
        copyText(shareUrl).then(function (ok) {
          clearTimeout(timer);
          b.classList.toggle('is-copied', !!ok);
          b.classList.toggle('is-failed', !ok);
          text.textContent = ok ? 'Link copied' : 'Copy failed: use the address bar';
          b.replaceChild(icon(ok ? 'check' : 'link', 15), b.firstChild);
          announce(ok ? 'Link copied to the clipboard.' : 'Could not copy the link. Copy it from the address bar.');
          timer = setTimeout(function () {
            b.classList.remove('is-copied', 'is-failed');
            text.textContent = label;
            b.replaceChild(icon('link', 15), b.firstChild);
          }, 2600);
        });
      });
      return b;
    }

    var tocLinks = [];      // every TOC anchor, both lists
    var railLinks = [];     // the desktop rail's anchors, in order
    var railList = null, railFill = null, railTime = null, rail = null, toc = null;

    if (heads.length >= 2) {
      var entries = [{ id: article.id, label: 'Introduction' }].concat(heads.map(function (h) {
        return { id: h.id, label: h.textContent.trim() };
      }));

      var buildList = function (cls, collect) {
        var ol = make('ol', 'toc-list ' + cls);
        ol.setAttribute('role', 'list');
        entries.forEach(function (en, k) {
          var li = make('li', 'toc-item');
          var a = make('a', 'toc-link', en.label);
          a.href = '#' + en.id;
          a.setAttribute('data-toc', String(k));
          li.appendChild(a);
          ol.appendChild(li);
          tocLinks.push(a);
          if (collect) collect.push(a);
        });
        return ol;
      };

      // Desktop rail: sticky beside the article
      rail = make('div', 'post-rail');
      var railInner = make('div', 'post-rail__inner');
      var railNav = make('nav', 'post-rail__nav');
      railNav.setAttribute('aria-label', 'On this page');
      railNav.appendChild(make('p', 'post-rail__label', 'On this page'));
      // the track draws the rail; its fill grows through each section as it is read
      var track = make('div', 'toc-track');
      railFill = make('span', 'toc-fill');
      railFill.setAttribute('aria-hidden', 'true');
      railList = buildList('toc-list--rail', railLinks);
      track.appendChild(railFill);
      track.appendChild(railList);
      railNav.appendChild(track);
      railInner.appendChild(railNav);

      var railMeta = make('div', 'post-rail__meta');
      railTime = make('p', 'post-rail__time', minutes ? minutes + ' min read' : '');
      railMeta.appendChild(railTime);
      var railActions = make('div', 'post-rail__actions');
      railActions.appendChild(copyButton('post-copy post-copy--rail', 'Copy link'));
      var topBtn = make('button', 'post-rail__top');
      topBtn.type = 'button';
      topBtn.appendChild(icon('arrowUp', 15));
      topBtn.appendChild(make('span', null, 'Back to top'));
      topBtn.addEventListener('click', function () {
        scrollToY(0);
        var back = $('.post-back');
        if (back) back.focus({ preventScroll: true });
      });
      railActions.appendChild(topBtn);
      railMeta.appendChild(railActions);
      railInner.appendChild(railMeta);
      rail.appendChild(railInner);
      container.classList.add('post-layout');
      container.insertBefore(rail, article);

      // Smaller screens: a collapsible panel after the opening paragraph
      toc = make('nav', 'post-toc');
      toc.setAttribute('aria-label', 'On this page');
      var toggle = make('button', 'post-toc__toggle');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'post-toc-list');
      toggle.appendChild(icon('grid', 16));
      toggle.appendChild(make('span', 'post-toc__title', 'On this page'));
      toggle.appendChild(make('span', 'post-toc__count', plural(heads.length, 'section', 'sections')));
      var chev = icon('chevron', 16);
      chev.setAttribute('class', 'post-toc__chev');
      toggle.appendChild(chev);
      var tocBody = buildList('toc-list--panel');
      tocBody.id = 'post-toc-list';
      tocBody.hidden = true;
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        tocBody.hidden = !open;
        toc.classList.toggle('is-open', open);
      });
      toc.appendChild(toggle);
      toc.appendChild(tocBody);
      var lede = $('.post-body__lede', article) || $('p', article);
      if (lede && lede.parentNode === article) article.insertBefore(toc, lede.nextSibling);
      else article.insertBefore(toc, article.firstChild);

      // Jumping to a section: scroll under the nav, keep focus with the reader
      var onTocClick = function (e) {
        var a = e.target.closest ? e.target.closest('a.toc-link') : null;
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
        var id = a.getAttribute('href').slice(1);
        var target = doc.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var y = target === article ? article.getBoundingClientRect().top + window.scrollY - navClearance()
          : target.getBoundingClientRect().top + window.scrollY - navClearance();
        scrollToY(y);
        try { window.history.replaceState(window.history.state, '', '#' + id); } catch (err) { /* ignore */ }
        if (target !== article) {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      };
      railList.addEventListener('click', onTocClick);
      tocBody.addEventListener('click', onTocClick);
    }

    // ── Share row at the end of the text ──
    var source = $('.post-source', article);
    var share = make('div', 'post-share');
    share.appendChild(make('p', 'post-share__label', 'Share this essay'));
    share.appendChild(copyButton('post-copy', 'Copy link'));
    if (source && source.parentNode === article) article.insertBefore(share, source);
    else article.appendChild(share);

    // ── Keep reading: previous / next, then the rest of the category ──
    if (post) {
      var prev = idx > 0 ? posts[idx - 1] : null;
      var next = idx < posts.length - 1 ? posts[idx + 1] : null;
      var more = make('section', 'post-more');
      more.setAttribute('aria-labelledby', 'post-more-title');
      var inner = make('div', 'container');
      var head = make('div', 'post-more__head');
      var h = make('h2', 'post-more__title', 'Keep reading');
      h.id = 'post-more-title';
      head.appendChild(h);
      var all = make('a', 'post-more__all', 'All ' + posts.length + ' essays');
      all.href = INDEX_URL;
      all.appendChild(icon('arrowR', 14));
      head.appendChild(all);
      inner.appendChild(head);

      var pager = make('nav', 'post-pager');
      pager.setAttribute('aria-label', 'Previous and next essay');
      var pagerCard = function (p, dir) {
        var a = make('a', 'post-pager__link post-pager__link--' + dir);
        var d = make('span', 'post-pager__dir');
        if (p) {
          a.href = p.slug + '.html';
          a.rel = dir === 'prev' ? 'prev' : 'next';
          if (dir === 'prev') d.appendChild(icon('arrowL', 14));
          d.appendChild(doc.createTextNode(dir === 'prev' ? 'Previous essay' : 'Next essay'));
          if (dir === 'next') d.appendChild(icon('arrowR', 14));
          a.appendChild(d);
          a.appendChild(make('span', 'post-pager__name', p.title));
          a.appendChild(make('span', 'post-pager__meta', p.category + ' · ' + p.minutes + ' min read'));
        } else {
          // the ends of the list lead back to the index instead of a dead end
          a.href = INDEX_URL;
          a.classList.add('post-pager__link--index');
          if (dir === 'prev') d.appendChild(icon('arrowL', 14));
          d.appendChild(doc.createTextNode('The archive'));
          if (dir === 'next') d.appendChild(icon('arrowR', 14));
          a.appendChild(d);
          a.appendChild(make('span', 'post-pager__name', dir === 'prev' ? 'This is the newest essay. See all ' + posts.length : 'That was the oldest essay. See all ' + posts.length));
          a.appendChild(make('span', 'post-pager__meta', 'Search by title or browse by topic'));
        }
        return a;
      };
      pager.appendChild(pagerCard(prev, 'prev'));
      pager.appendChild(pagerCard(next, 'next'));
      inner.appendChild(pager);

      var skip = {};
      skip[slug] = true;
      if (prev) skip[prev.slug] = true;
      if (next) skip[next.slug] = true;
      var same = posts.filter(function (p) { return p.category === category && !skip[p.slug]; }).slice(0, 3);
      var picks = same.length ? same : posts.filter(function (p) { return !skip[p.slug]; }).slice(0, 3);
      if (picks.length) {
        var rel = make('div', 'post-related');
        var rh = make('h3', 'post-related__title', same.length ? 'More in ' + category : 'Latest essays');
        rh.id = 'post-related-title';
        rel.setAttribute('role', 'group');
        rel.setAttribute('aria-labelledby', rh.id);
        rel.appendChild(rh);
        var ul = make('ul', 'post-related__list');
        ul.setAttribute('role', 'list');
        picks.forEach(function (p) {
          var li = make('li', 'post-related__item');
          var a = make('a', 'post-related__link');
          a.href = p.slug + '.html';
          a.appendChild(make('span', 'post-related__name', p.title));
          a.appendChild(make('span', 'post-related__meta', (same.length ? '' : p.category + ' · ') + p.minutes + ' min read'));
          li.appendChild(a);
          ul.appendChild(li);
        });
        rel.appendChild(ul);
        if (same.length) {
          var topicAll = make('a', 'post-related__all', 'Every ' + category + ' essay');
          topicAll.href = topicUrl(category);
          topicAll.appendChild(icon('arrowR', 14));
          rel.appendChild(topicAll);
        }
        inner.appendChild(rel);
      }
      more.appendChild(inner);
      container.parentNode.insertBefore(more, container.nextSibling);
    }

    // the page grew: the rail, the share row and "Keep reading"
    resizeScroller();
    if (!tocLinks.length) return;

    // ── Follow the reader: active section, rail fill, time left ──
    var targets = [article].concat(heads);
    var endEl = source || $('.post-cta', article);
    var tops = [], endY = 0, railTops = [], railH = 0, railOn = false;
    var active = -1, lastFill = -1, lastTime = '';
    var queued = false;

    function measure() {
      var sy = window.scrollY;
      tops = targets.map(function (t, k) {
        var top = t.getBoundingClientRect().top + sy;
        return k === 0 ? top : top - 8;
      });
      endY = endEl ? endEl.getBoundingClientRect().top + sy : article.getBoundingClientRect().bottom + sy;
      railOn = !!(rail && rail.offsetParent !== null);
      if (railOn) {
        var lr = railList.getBoundingClientRect();
        railTops = railLinks.map(function (a) {
          var r = a.getBoundingClientRect();
          return r.top - lr.top + r.height / 2;
        });
        railH = lr.height || 1;
      }
    }

    function update() {
      queued = false;
      var sy = window.scrollY;
      var vh = window.innerHeight;
      var line = sy + Math.min(vh * 0.32, 280);   // where the eye is
      var k = 0;
      while (k + 1 < tops.length && tops[k + 1] <= line) k++;
      var start = tops[k];
      var end = k + 1 < tops.length ? tops[k + 1] : endY;
      var f = line <= start ? 0 : end > start ? clamp((line - start) / (end - start), 0, 1) : 1;
      var begun = line > tops[0];

      if (k !== active) {
        active = k;
        tocLinks.forEach(function (a) {
          var on = a.getAttribute('data-toc') === String(k);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      }

      if (railOn && railTops.length) {
        var a0 = railTops[k];
        var a1 = k + 1 < railTops.length ? railTops[k + 1] : railH;
        var fill = begun ? (a0 + (a1 - a0) * f) / railH : 0;
        fill = Math.round(clamp(fill, 0, 1) * 1000) / 1000;
        if (fill !== lastFill) {
          lastFill = fill;
          railFill.style.transform = 'scaleY(' + fill + ')';
        }
      }

      if (railTime && minutes) {
        var p = clamp((line - tops[0]) / Math.max(1, endY - tops[0]), 0, 1);
        var t = p <= 0.02 ? minutes + ' min read' : p >= 0.985 ? 'Finished' : Math.max(1, Math.round(minutes * (1 - p))) + ' min left';
        if (t !== lastTime) { lastTime = t; railTime.textContent = t; }
      }
    }
    function queue() { if (!queued) { queued = true; window.requestAnimationFrame(update); } }
    function remeasure() { resizeScroller(); measure(); queue(); }

    measure();
    update();
    window.addEventListener('scroll', queue, { passive: true });
    var resizeTimer = 0;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(remeasure, 120); }, { passive: true });
    window.addEventListener('load', remeasure);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(remeasure);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(remeasure, 80); });
      ro.observe(article);
    }

    // A shared #section link lands on its heading once the ids exist
    if (window.location.hash.length > 1) {
      var target = null;
      try { target = doc.getElementById(decodeURIComponent(window.location.hash.slice(1))); } catch (e) { target = null; }
      if (target && target !== article && heads.indexOf(target) > -1) {
        window.requestAnimationFrame(function () {
          scrollToY(target.getBoundingClientRect().top + window.scrollY - navClearance(), true);
        });
      }
    }
  }

  // ── Boot ──
  // Index filters run as soon as this file executes, so a shared ?topic= link
  // never flashes the full list. Post tools wait for DOMContentLoaded so they
  // are built after main.js has wired the page's own in-page links.
  var index = $('[data-blog-index]');
  if (index) initIndex(index);

  function bootPost() {
    var article = $('article.post-body');
    if (article) initPost(article);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bootPost);
  else bootPost();
})();
