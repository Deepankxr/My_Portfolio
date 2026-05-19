document.addEventListener('DOMContentLoaded', () => {

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

  // ── Cursor spotlight (CSS variable, GPU-composited — zero layout cost) ──
  if (window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', e => {
      document.body.style.setProperty('--mouse-x', e.clientX + 'px');
      document.body.style.setProperty('--mouse-y', e.clientY + 'px');
    }, { passive: true });
  }

  // ── Mouse parallax on hero image (landing page) ──
  const heroSection = document.getElementById('hero');
  const heroVisual = document.getElementById('hero-visual');
  if (heroSection && heroVisual && window.matchMedia('(pointer: fine)').matches) {
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
      heroVisual.style.transform = `translate(${currentX * 14}px, ${currentY * 10}px)`;
      ticking = Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001;
      if (ticking) requestAnimationFrame(animateParallax);
    }
  }

  // ── Scroll reveal ──
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px -20px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ── Section label line animation ──
  const labelObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        labelObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.section-label-row').forEach(el => labelObserver.observe(el));

  // ── Full-width photo wipe animation (about page) ──
  const photoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('photo-visible');
        photoObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.02 });
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
  }, { threshold: 0.02 });
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
  }, { threshold: 0.1 });
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
        // No webhook configured — silent success (dev mode)
        btn.textContent = 'Sent.';
        btn.style.opacity = '0.55';
        formEl.reset();
      }
    });
  }

  handleForm(document.getElementById('contact-form'), 'landing_page', null);
  handleForm(document.getElementById('about-contact-form'), 'about_page', 'about-form-status');
});
