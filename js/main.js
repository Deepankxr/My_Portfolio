document.addEventListener('DOMContentLoaded', () => {

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  // ── Smooth scrolling (Lenis) synced to GSAP ScrollTrigger ──
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    document.documentElement.style.scrollBehavior = 'auto';
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
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

  // ── Cursor spotlight (CSS variable, GPU-composited - zero layout cost) ──
  if (finePointer && !reduceMotion) {
    document.addEventListener('mousemove', e => {
      document.body.style.setProperty('--mouse-x', e.clientX + 'px');
      document.body.style.setProperty('--mouse-y', e.clientY + 'px');
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

  // ── Mouse parallax on hero image (landing page) ──
  const heroSection = document.getElementById('hero');
  const heroVisual = document.getElementById('hero-visual');
  if (heroSection && heroVisual && finePointer && !reduceMotion) {
    let ticking = false;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;

    heroSection.addEventListener('mousemove', e => {
      const rect = heroSection.getBoundingClientRect();
      targetX = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
      targetY = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
      if (!ticking) { requestAnimationFrame(animateParallax); ticking = true; }
    });
    heroSection.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });

    function animateParallax() {
      currentX += (targetX - currentX) * 0.07;
      currentY += (targetY - currentY) * 0.07;
      heroVisual.style.transform = `perspective(1000px) translate(${currentX * 14}px, ${currentY * 10}px) rotateY(${currentX * 3.5}deg) rotateX(${-currentY * 3.5}deg)`;
      ticking = Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001;
      if (ticking) requestAnimationFrame(animateParallax);
    }
  }

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

  // ── Work card flip ──
  document.querySelectorAll('.work-card').forEach(card => {
    function flip() { card.classList.toggle('is-flipped'); }

    card.addEventListener('click', flip);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });

    const closeBtn = card.querySelector('.work-card__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        card.classList.remove('is-flipped');
      });
    }
  });

  // ── Logo sphere orbiting the photo + scroll morph into a flowing line ──
  const globeCanvas = document.getElementById('globe');
  if (globeCanvas && globeCanvas.getContext && typeof HERO_LOGOS !== 'undefined' && HERO_LOGOS.length) {
    const ctx = globeCanvas.getContext('2d');
    const anchor = document.getElementById('globe-anchor') || globeCanvas;
    const marqueeEl = document.querySelector('.marquee-section');

    // Preload the logo images (Iconify icons get an explicit size so they rasterize crisply).
    const sized = u => u.indexOf('api.iconify.design') > -1
      ? u + (u.indexOf('?') > -1 ? '&' : '?') + 'width=96&height=96' : u;
    const logos = HERO_LOGOS.map(l => {
      const img = new Image();
      const o = { img, ok: false, w: l.w || 1, floor: l.floor || 0 };
      img.onload = () => { o.ok = true; };
      img.onerror = () => { o.ok = false; };
      img.src = sized(l.u);
      return o;
    });

    // Accent colour for the photo halo (tracks the theme)
    const hexToRgb = h => {
      h = (h || '').replace('#', '').trim();
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      const n = parseInt(h || '4DA3FF', 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    let col = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    new MutationObserver(() => {
      col = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Cut-out photo at the centre. Pre-composite a bottom dissolve into it so the hard
    // edge melts into the page; a soft accent halo is drawn behind it every frame.
    const photo = new Image();
    const photoCanvas = document.createElement('canvas');
    let photoOK = false;
    photo.onload = () => {
      photoCanvas.width = photo.naturalWidth;
      photoCanvas.height = photo.naturalHeight;
      const pctx = photoCanvas.getContext('2d');
      pctx.drawImage(photo, 0, 0);
      pctx.globalCompositeOperation = 'destination-out';
      const fade = pctx.createLinearGradient(0, photoCanvas.height * 0.68, 0, photoCanvas.height);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,1)');
      pctx.fillStyle = fade;
      pctx.fillRect(0, photoCanvas.height * 0.68, photoCanvas.width, photoCanvas.height * 0.32);
      // gentle edge melt: hair top and shoulder/arm sides dissolve softly into the
      // background (only the outer 10-12%, so the face itself stays fully crisp)
      let melt = pctx.createLinearGradient(0, 0, 0, photoCanvas.height * 0.10);
      melt.addColorStop(0, 'rgba(0,0,0,0.45)');
      melt.addColorStop(1, 'rgba(0,0,0,0)');
      pctx.fillStyle = melt;
      pctx.fillRect(0, 0, photoCanvas.width, photoCanvas.height * 0.10);
      melt = pctx.createLinearGradient(0, 0, photoCanvas.width * 0.12, 0);
      melt.addColorStop(0, 'rgba(0,0,0,0.55)');
      melt.addColorStop(1, 'rgba(0,0,0,0)');
      pctx.fillStyle = melt;
      pctx.fillRect(0, 0, photoCanvas.width * 0.12, photoCanvas.height);
      melt = pctx.createLinearGradient(photoCanvas.width, 0, photoCanvas.width * 0.88, 0);
      melt.addColorStop(0, 'rgba(0,0,0,0.55)');
      melt.addColorStop(1, 'rgba(0,0,0,0)');
      pctx.fillStyle = melt;
      pctx.fillRect(photoCanvas.width * 0.88, 0, photoCanvas.width * 0.12, photoCanvas.height);
      photoOK = true;
      if (reduceMotion) renderGlobe();
    };
    photo.src = 'assets/deepankar-cutout.webp';

    const N = logos.length;
    const GA = Math.PI * (3 - Math.sqrt(5));   // golden angle → even spread on the sphere
    const pts = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const t = GA * i;
      pts.push({ x: Math.cos(t) * r, y: y, z: Math.sin(t) * r, logo: logos[i] });
    }

    // Fixed full-viewport canvas: canvas coords = viewport coords
    let W = 0, H = 0;
    function resizeGlobe() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      globeCanvas.width = Math.round(W * dpr);
      globeCanvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeGlobe();
    window.addEventListener('resize', resizeGlobe, { passive: true });

    let mx = -9999, my = -9999;
    if (finePointer) {
      window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
      window.addEventListener('mouseout', e => { if (!e.relatedTarget) { mx = -9999; my = -9999; } }, { passive: true });
    }

    const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
    const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    let rx = -0.22, ry = 0, near = 0, sYs = window.scrollY, pS = 0;

    function renderGlobe() {
      const aRect = anchor.getBoundingClientRect();
      const acx = aRect.left + aRect.width / 2, acy = aRect.top + aRect.height / 2;
      const aMin = Math.min(aRect.width, aRect.height) || 1;
      const RAD = aMin * 0.43, base = aMin * 0.04;

      // Smoothed scroll drives the morph: 0 = sphere in the hero, 1 = logos lined up
      sYs += (window.scrollY - sYs) * 0.12;
      pS += (clamp01(sYs / (window.innerHeight * 0.85)) - pS) * 0.09;
      const drift = sYs * 0.35;
      const now = performance.now();

      // The line rides just above the marquee band, anchored to the page as it scrolls
      const mRect = marqueeEl ? marqueeEl.getBoundingClientRect() : null;
      const lineY = mRect ? mRect.top - 46 : aRect.bottom + 60;
      const lineFade = clamp01((lineY + 30) / 150);

      let tRx = -0.22, leanY = 0, influence = 0;
      if (mx > -9000) {
        const dx = mx - acx, dy = my - acy;
        influence = Math.max(0, 1 - Math.hypot(dx, dy) / (aRect.width * 0.95 || 1)) * (1 - pS);
        tRx = -0.22 + (dy / (aRect.height || 1)) * 0.7 * (1 - pS);
        leanY = (dx / (aRect.width || 1)) * 0.7;
      }
      near += (influence - near) * 0.07;
      ry += 0.0024 * (1 + near * 1.6);            // spins faster as the cursor nears
      rx += (tRx - rx) * 0.05;
      const ryEff = ry + leanY * near;            // leans toward the cursor

      ctx.clearRect(0, 0, W, H);

      const drawPhoto = () => {
        if (!photoOK || aRect.bottom < -60 || aRect.top > H + 60) return;
        const ph = aRect.height * 0.86;
        const pw = ph * (photoCanvas.width / photoCanvas.height);
        // soft accent halo behind the cut-out for premium depth
        const g = ctx.createRadialGradient(acx, acy + ph * 0.06, ph * 0.05, acx, acy + ph * 0.06, ph * 0.62);
        g.addColorStop(0, 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.30)');
        g.addColorStop(0.55, 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.12)');
        g.addColorStop(1, 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(acx - ph * 0.75, acy - ph * 0.6, ph * 1.5, ph * 1.3);
        ctx.drawImage(photoCanvas, acx - pw / 2, acy - ph / 2, pw, ph);
      };

      // Line slots: evenly spaced, endlessly drifting left, with a gentle bob
      const gap = Math.max(84, (W - 40) / N);
      const total = gap * N;
      const lineFor = i => {
        let x = i * gap + gap / 2 - drift;
        x = ((x % total) + total) % total;
        return { x: x + (W - total) / 2, y: lineY + Math.sin(now * 0.0018 + i * 0.7) * 3 };
      };

      const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ryEff), sY = Math.sin(ryEff);
      const proj = [];
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const x1 = p.x * cY - p.z * sY;
        const z1 = p.x * sY + p.z * cY;
        const y2 = p.y * cX - z1 * sX;
        const z2 = p.y * sX + z1 * cX;
        const persp = 2.2 / (2.2 + z2);
        // staggered peel-off: each logo leaves the sphere at its own moment
        const ti = easeIO(clamp01(pS * 1.35 - (i / N) * 0.35));
        const L = lineFor(i);
        const sxS = acx + x1 * RAD * persp, syS = acy + y2 * RAD * persp;
        proj.push({
          logo: p.logo, depth: (z2 + 1) / 2, persp: persp, ti: ti,
          sx: sxS + (L.x - sxS) * ti,
          sy: syS + (L.y - syS) * ti
        });
      }
      proj.sort((a, b) => b.depth - a.depth);     // far → near
      let photoDrawn = false;
      for (const q of proj) {
        if (q.depth < 0.5 && !photoDrawn) { drawPhoto(); photoDrawn = true; }  // photo sits mid-sphere
        if (!q.logo.ok) continue;
        const front = 1 - q.depth;                 // 1 = nearest the viewer, 0 = farthest
        const sphereSize = base * q.persp * q.logo.w;
        const lineSize = Math.min(30, base * 0.8) * (q.logo.w > 1.4 ? 1.3 : 1);
        let size = sphereSize + (lineSize - sphereSize) * q.ti;
        const sphereAlpha = Math.max(0.3 + front * 0.7, q.logo.floor);
        let alpha = sphereAlpha + (0.9 * lineFade - sphereAlpha) * q.ti;
        if (mx > -9000 && q.ti < 0.4) {
          const dd = Math.hypot(q.sx - mx, q.sy - my);
          if (dd < 75) { const b = 1 - dd / 75; size += b * base * 0.45; alpha = Math.min(1, alpha + b * 0.3); }
        }
        ctx.globalAlpha = clamp01(alpha);
        ctx.drawImage(q.logo.img, q.sx - size / 2, q.sy - size / 2, size, size);
      }
      if (!photoDrawn) drawPhoto();
      ctx.globalAlpha = 1;
    }

    if (reduceMotion) {
      setTimeout(renderGlobe, 500);               // single static frame once images load
    } else {
      let raf = null;
      const loop = () => { renderGlobe(); raf = requestAnimationFrame(loop); };
      // keep animating while the hero OR the marquee band is anywhere near the viewport
      const vis = new Set();
      const io = new IntersectionObserver(es => {
        es.forEach(en => { en.isIntersecting ? vis.add(en.target) : vis.delete(en.target); });
        if (vis.size && !raf) loop();
        else if (!vis.size && raf) { cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, W, H); }
      }, { threshold: 0, rootMargin: '140px 0px' });
      io.observe(document.getElementById('hero'));
      if (marqueeEl) io.observe(marqueeEl);
    }
  }

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

      const data = {
        name: formEl.querySelector('[name="name"]')?.value || '',
        email: formEl.querySelector('[name="email"]')?.value || '',
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
