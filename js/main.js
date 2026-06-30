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
  const savedTheme = localStorage.getItem('theme') || 'dark';
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
      localStorage.setItem('theme', next);
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

  // ── Mobile menu ──
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      mobileBtn.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        mobileBtn.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ── Cursor spotlight (CSS variable, GPU-composited - zero layout cost) ──
  if (finePointer && !reduceMotion) {
    document.addEventListener('mousemove', e => {
      document.body.style.setProperty('--mouse-x', e.clientX + 'px');
      document.body.style.setProperty('--mouse-y', e.clientY + 'px');
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

  // ── Count-up animation ──
  function animateCount(el, target, decimals, prefix, suffix) {
    const duration = 1800;
    const start = performance.now();
    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = prefix + (decimals > 0 ? value.toFixed(decimals) : Math.round(value)) + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const countObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        animateCount(
          el,
          parseFloat(el.dataset.count),
          parseInt(el.dataset.decimals || '0'),
          el.dataset.prefix || '',
          el.dataset.suffix || ''
        );
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

  // ── Rotating logo sphere behind the name (cursor-reactive) ──
  const globeCanvas = document.getElementById('globe');
  if (globeCanvas && globeCanvas.getContext && typeof HERO_LOGOS !== 'undefined' && HERO_LOGOS.length) {
    const ctx = globeCanvas.getContext('2d');

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

    // Cut-out photo at the centre; the logos revolve around it (in front and behind)
    const photo = new Image();
    let photoOK = false;
    photo.onload = () => { photoOK = true; };
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

    let W = 0, H = 0, cx = 0, cy = 0, RAD = 0, base = 36;
    function resizeGlobe() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = globeCanvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      globeCanvas.width = Math.round(W * dpr);
      globeCanvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2;
      RAD = Math.min(W, H) * 0.43;     // orbit radius (around the photo)
      base = Math.min(W, H) * 0.04;    // logo base size (per-logo weight scales it up)
    }
    resizeGlobe();
    window.addEventListener('resize', resizeGlobe, { passive: true });

    let mx = -9999, my = -9999;
    if (finePointer) {
      window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
      window.addEventListener('mouseout', e => { if (!e.relatedTarget) { mx = -9999; my = -9999; } }, { passive: true });
    }

    let rx = -0.22, ry = 0, near = 0;
    function renderGlobe() {
      const rect = globeCanvas.getBoundingClientRect();
      const gcx = rect.left + rect.width / 2, gcy = rect.top + rect.height / 2;
      let tRx = -0.22, leanY = 0, influence = 0;
      if (mx > -9000) {
        const dx = mx - gcx, dy = my - gcy;
        influence = Math.max(0, 1 - Math.hypot(dx, dy) / (rect.width * 0.95));
        tRx = -0.22 + (dy / rect.height) * 0.7;
        leanY = (dx / rect.width) * 0.7;
      }
      near += (influence - near) * 0.07;
      ry += 0.0024 * (1 + near * 1.6);            // spins faster as the cursor nears
      rx += (tRx - rx) * 0.05;
      const ryEff = ry + leanY * near;            // leans toward the cursor

      ctx.clearRect(0, 0, W, H);
      const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ryEff), sY = Math.sin(ryEff);
      const proj = [];
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const x1 = p.x * cY - p.z * sY;
        const z1 = p.x * sY + p.z * cY;
        const y2 = p.y * cX - z1 * sX;
        const z2 = p.y * sX + z1 * cX;
        const persp = 2.2 / (2.2 + z2);
        proj.push({ logo: p.logo, sx: cx + x1 * RAD * persp, sy: cy + y2 * RAD * persp, depth: (z2 + 1) / 2, persp: persp });
      }
      proj.sort((a, b) => b.depth - a.depth);     // far → near
      const drawPhoto = () => {
        if (!photoOK) return;
        const ph = H * 0.78;
        const pw = ph * ((photo.naturalWidth / photo.naturalHeight) || 0.454);
        ctx.globalAlpha = 1;
        ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
      };
      let photoDrawn = false;
      for (const q of proj) {
        if (q.depth < 0.5 && !photoDrawn) { drawPhoto(); photoDrawn = true; }  // photo sits mid-sphere
        if (!q.logo.ok) continue;
        const front = 1 - q.depth;                 // 1 = nearest the viewer, 0 = farthest
        let size = base * q.persp * q.logo.w;
        let alpha = Math.max(0.3 + front * 0.7, q.logo.floor);
        if (mx > -9000) {
          const dd = Math.hypot(rect.left + q.sx - mx, rect.top + q.sy - my);
          if (dd < 75) { const b = 1 - dd / 75; size += b * base * 0.45; alpha = Math.min(1, alpha + b * 0.3); }
        }
        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
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
      const heroEl = document.getElementById('hero');
      new IntersectionObserver(es => {
        es.forEach(en => {
          if (en.isIntersecting && !raf) loop();
          else if (!en.isIntersecting && raf) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 }).observe(heroEl);
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
