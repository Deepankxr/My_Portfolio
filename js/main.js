document.addEventListener('DOMContentLoaded', () => {

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  // ── Smooth scrolling (Lenis) synced to GSAP ScrollTrigger ──
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    document.documentElement.style.scrollBehavior = 'auto';
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    window.lenis = lenis;   // shared with page modules (fence, work canvas) and tooling
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    // smooth in-page anchor links (offset for the fixed nav)
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id && id.length > 1) {
          const el = document.querySelector(id);
          if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -80 }); }
        }
      });
    });
  }

  // ── Year ──
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── Theme ──
  const html = document.documentElement;
  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('theme') || 'dark';
  } catch (e) {
    console.warn('localStorage is not accessible, defaulting to dark theme:', e);
  }
  html.setAttribute('data-theme', savedTheme);

  function updateThemeLabel() {
    document.querySelectorAll('.theme-mode-label').forEach(el => {
      el.textContent = html.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark';
    });
  }
  updateThemeLabel();

  document.querySelectorAll('#theme-toggle, #theme-toggle-mobile').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        console.warn('localStorage is not accessible, theme preference not saved:', e);
      }
      updateThemeLabel();
    });
  });

  // ── Scroll progress bar ──
  const progressBar = document.getElementById('scroll-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      const total = document.body.scrollHeight - window.innerHeight;
      progressBar.style.width = total > 0 ? (scrolled / total * 100) + '%' : '0%';
    }, { passive: true });
  }

  // ── Navbar scroll ──
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  // ── Liquid-glass card nav (hamburger expands the cards) ──
  const navRoot = document.getElementById('nav');
  const navBurger = document.getElementById('nav-burger');
  const navCards = document.getElementById('nav-cards');
  if (navRoot && navBurger && navCards) {
    const setNavOpen = open => {
      navRoot.classList.toggle('menu-open', open);
      navBurger.setAttribute('aria-expanded', open ? 'true' : 'false');
      navBurger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      navCards.setAttribute('aria-hidden', open ? 'false' : 'true');
    };
    navBurger.addEventListener('click', e => {
      e.stopPropagation();
      setNavOpen(!navRoot.classList.contains('menu-open'));
    });
    // Close when a card link is chosen
    navCards.querySelectorAll('a').forEach(link =>
      link.addEventListener('click', () => setNavOpen(false))
    );
    // Close on outside click or Escape
    document.addEventListener('click', e => {
      if (navRoot.classList.contains('menu-open') && !navRoot.contains(e.target)) setNavOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navRoot.classList.contains('menu-open')) setNavOpen(false);
    });
  }

  // ── Cursor spotlight ──
  // A fixed glow element moved with transform only. (Writing --mouse-x/--mouse-y on
  // <body> restyled every element on each mousemove, which cost more than the whole
  // fence frame; body::before stays as the no-JS fallback.)
  if (finePointer && !reduceMotion) {
    const spot = document.createElement('div');
    spot.className = 'cursor-spotlight';
    spot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spot);
    document.documentElement.classList.add('has-spotlight');
    let spotX = -9999, spotY = -9999, spotQueued = false;
    const moveSpot = () => {
      spotQueued = false;
      spot.style.transform = 'translate3d(' + spotX + 'px,' + spotY + 'px,0)';
    };
    document.addEventListener('mousemove', e => {
      spotX = e.clientX; spotY = e.clientY;
      if (!spotQueued) { spotQueued = true; requestAnimationFrame(moveSpot); }
    }, { passive: true });
  }

  // ── Click spark (reactbits.dev ClickSpark, ported to vanilla) ──
  // 8 accent-coloured lines radiate from every click/tap; the rAF loop only
  // runs while sparks are alive, and the colour tracks the active theme.
  if (!reduceMotion) {
    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.className = 'click-spark-canvas';
    sparkCanvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sparkCanvas);
    const sctx = sparkCanvas.getContext('2d');
    const sparks = [];
    const SPARK_COUNT = 8, SPARK_SIZE = 11, SPARK_RADIUS = 20, SPARK_DURATION = 450;
    let sparkRaf = 0, sparkDpr = 1;

    const sizeSparkCanvas = () => {
      sparkDpr = Math.min(window.devicePixelRatio || 1, 2);
      sparkCanvas.width = Math.round(window.innerWidth * sparkDpr);
      sparkCanvas.height = Math.round(window.innerHeight * sparkDpr);
    };
    sizeSparkCanvas();
    window.addEventListener('resize', sizeSparkCanvas);

    const sparkEase = t => t * (2 - t);   // ease-out, same as the source

    const drawSparks = now => {
      sctx.setTransform(sparkDpr, 0, 0, sparkDpr, 0, 0);
      sctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4DA3FF';
      sctx.strokeStyle = accent;
      sctx.lineWidth = 2;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const t = (now - s.t0) / SPARK_DURATION;
        if (t >= 1) { sparks.splice(i, 1); continue; }
        const eased = sparkEase(t);
        const dist = eased * SPARK_RADIUS;
        const len = SPARK_SIZE * (1 - eased);
        sctx.beginPath();
        sctx.moveTo(s.x + dist * Math.cos(s.a), s.y + dist * Math.sin(s.a));
        sctx.lineTo(s.x + (dist + len) * Math.cos(s.a), s.y + (dist + len) * Math.sin(s.a));
        sctx.stroke();
      }
      sparkRaf = sparks.length ? requestAnimationFrame(drawSparks) : 0;
    };

    document.addEventListener('click', e => {
      const now = performance.now();
      for (let i = 0; i < SPARK_COUNT; i++) {
        sparks.push({ x: e.clientX, y: e.clientY, a: (2 * Math.PI * i) / SPARK_COUNT, t0: now });
      }
      if (!sparkRaf) sparkRaf = requestAnimationFrame(drawSparks);
    }, { passive: true });
  }

  // (The hero cut-out stands still on its floor spot; the stage fence behind
  //  him carries the pointer parallax, see js/fence.js.)

  // ── Magnetic primary buttons (subtle pull toward cursor) ──
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.btn--primary').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${mx * 0.18}px, ${my * 0.32}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  // ── 3D tilt on About page photos (image follows the cursor) ──
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.about-section__side-photo').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.transition = 'transform 0.08s linear, box-shadow 0.45s var(--ease-out), border-color 0.3s';
        el.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 10).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 14).toFixed(2) + 'deg) scale3d(1.02, 1.02, 1.02)';
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = '';
        el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    });
  }

  // ── Scroll reveal ──
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });

  if (hasGSAP && !reduceMotion) {
    // GSAP-driven reveals: smoother and scroll-linked (elements "flow" up into place)
    document.documentElement.classList.add('has-gsap');
    gsap.utils.toArray('.reveal').forEach(el => {
      gsap.fromTo(el, { opacity: 0, y: 28 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%' }
      });
    });
  } else {
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  }

  // ── Section label line animation ──
  const labelObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        labelObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.section-label-row').forEach(el => labelObserver.observe(el));

  // ── Full-width photo wipe animation (about page) ──
  const photoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('photo-visible');
        photoObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.about-section__full-photo, .about-section__side-photo').forEach(el => photoObserver.observe(el));

  // ── Tool chip stagger animation (about page) ──
  const toolObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.tool').forEach(chip => {
          chip.classList.add('tool-visible');
        });
        toolObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.tool-list').forEach(list => toolObserver.observe(list));

  // ── Count-up animation (whole numbers grow with thousands separators: $2,500,000+) ──
  function animateCount(el, target, decimals, prefix, suffix, duration) {
    const start = performance.now();
    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      const text = decimals > 0
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('en-US');
      el.textContent = prefix + text + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const countObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const decimals = parseInt(el.dataset.decimals || '0');
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        if (reduceMotion) {
          el.textContent = prefix + (decimals > 0 ? target.toFixed(decimals) : Math.round(target).toLocaleString('en-US')) + suffix;
        } else {
          animateCount(el, target, decimals, prefix, suffix, parseInt(el.dataset.duration || '1800'));
        }
        countObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));

  // ── Ken Burns on event photos: play only while the frame is on screen ──
  // The CSS animation starts paused; this toggles .is-playing per frame so offscreen
  // photos cost nothing. Under reduced motion the CSS removes the animation entirely.
  const kbFrames = document.querySelectorAll('[data-kenburns]');
  if (kbFrames.length && !reduceMotion) {
    if ('IntersectionObserver' in window) {
      const kbObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => entry.target.classList.toggle('is-playing', entry.isIntersecting));
      }, { threshold: 0, rootMargin: '80px 0px' });
      kbFrames.forEach(el => kbObserver.observe(el));
    } else {
      kbFrames.forEach(el => el.classList.add('is-playing'));
    }
  }

  // ── Project budget bar (GSAP-smoothed fill, counting value, ultra state) ──
  function formatBudget(v) {
    v = Number(v);
    return v >= 50000 ? '$50,000+' : '$' + Math.round(v).toLocaleString('en-US');
  }

  document.querySelectorAll('.budget-range').forEach(range => {
    const bar   = document.getElementById(range.id + '-bar');
    const fill  = document.getElementById(range.id + '-fill');
    const out   = document.getElementById(range.id + '-val');
    const chips = bar && bar.parentElement.querySelectorAll('.budget-chip');
    if (!bar || !fill || !out) return;

    const MIN = Number(range.min), MAX = Number(range.max);
    const pctOf = v => (v - MIN) / (MAX - MIN) * 100;
    // shown holds the animated value, which trails the real input while GSAP eases it
    const shown = { v: Number(range.value) };
    let isUltra = null;

    const paint = () => {
      fill.style.width = pctOf(shown.v) + '%';
      out.textContent = formatBudget(shown.v);
      const ultra = Number(range.value) >= MAX;
      if (ultra !== isUltra) {
        isUltra = ultra;
        bar.classList.toggle('is-ultra', ultra);
        if (chips) chips.forEach(c => c.classList.toggle(
          'is-ultra-chip', ultra && c.dataset.budget === String(MAX)));
        // a small pop the moment it tips into the top bracket
        if (ultra && hasGSAP && !reduceMotion) {
          gsap.fromTo(bar, { scale: 1 },
            { scale: 1.022, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 });
        }
      }
    };

    // drag: follow the finger exactly, no lag
    range.addEventListener('input', () => {
      if (hasGSAP) gsap.killTweensOf(shown);
      shown.v = Number(range.value);
      paint();
      syncChips();
    });

    // chips: glide to the value instead of jumping
    function syncChips() {
      if (!chips) return;
      const v = Number(range.value);
      chips.forEach(c => c.classList.toggle('is-on', Number(c.dataset.budget) === v));
    }
    if (chips) chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const target = Number(chip.dataset.budget);
        range.value = target;
        syncChips();
        if (hasGSAP && !reduceMotion) {
          gsap.killTweensOf(shown);
          gsap.to(shown, { v: target, duration: 0.62, ease: 'power3.out', onUpdate: paint, onComplete: paint });
        } else {
          shown.v = target; paint();
        }
      });
    });

    paint();
  });

  // ── Webhook form submission ──
  async function submitToWebhook(data, source) {
    if (typeof WEBHOOK_URL === 'undefined' || !WEBHOOK_URL) return null;
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source, submitted_at: new Date().toISOString() })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function handleForm(formEl, source, statusId) {
    if (!formEl) return;
    const statusEl = statusId ? document.getElementById(statusId) : null;

    formEl.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = formEl.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled = true;
      if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }

      const budgetEl = formEl.querySelector('[name="budget"]');
      const data = {
        name: formEl.querySelector('[name="name"]')?.value || '',
        email: formEl.querySelector('[name="email"]')?.value || '',
        role: formEl.querySelector('[name="role"]')?.value || '',
        company: formEl.querySelector('[name="company"]')?.value || '',
        budget: budgetEl ? formatBudget(budgetEl.value) : '',
        budget_value: budgetEl ? Number(budgetEl.value) : null,
        message: formEl.querySelector('[name="message"]')?.value || '',
      };

      const result = await submitToWebhook(data, source);

      if (result === true) {
        btn.textContent = 'Sent.';
        btn.style.opacity = '0.55';
        if (statusEl) { statusEl.textContent = 'Your message was received.'; statusEl.className = 'form-status'; }
        formEl.reset();
      } else if (result === false) {
        btn.textContent = original;
        btn.disabled = false;
        if (statusEl) { statusEl.textContent = 'Something went wrong. Email sales@deepankar.xyz directly.'; statusEl.className = 'form-status error'; }
      } else {
        // No webhook configured - silent success (dev mode)
        btn.textContent = 'Sent.';
        btn.style.opacity = '0.55';
        formEl.reset();
      }
    });
  }

  handleForm(document.getElementById('contact-form'), 'landing_page', null);
  handleForm(document.getElementById('about-contact-form'), 'about_page', 'about-form-status');
});
