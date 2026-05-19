/**
 * sda.js — Makeni Central SDA Church
 * Modern UI motion, interactions & enhancements
 * Drop this file in your project root and add:
 *   <script src="sda.js" defer></script>
 * just before </body> on every page.
 */

'use strict';

/* ═══════════════════════════════════════════════
   1. NAVBAR — scroll shrink + mobile drawer
═══════════════════════════════════════════════ */
(function initNavbar() {
  const header = document.querySelector('header');
  if (!header) return;

  // ── Scroll-shrink effect ──────────────────────
  let lastScroll = 0;
  function onScroll() {
    const y = window.scrollY;
    if (y > 60) {
      header.style.boxShadow = '0 4px 24px rgba(4,21,52,0.12)';
      header.style.borderBottomColor = '#e6c364';
    } else {
      header.style.boxShadow = '';
      header.style.borderBottomColor = '';
    }

    // Hide on scroll down, reveal on scroll up
    if (y > lastScroll + 8 && y > 120) {
      header.style.transform = 'translateY(-100%)';
    } else if (y < lastScroll - 4) {
      header.style.transform = 'translateY(0)';
    }
    lastScroll = y;
  }
  header.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1), box-shadow 0.3s ease, border-color 0.3s ease';
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Mobile hamburger drawer ───────────────────
  const nav = header.querySelector('nav');
  if (!nav) return;

  // Build toggle button
  const burger = document.createElement('button');
  burger.setAttribute('aria-label', 'Open menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.className = 'md:hidden flex flex-col gap-[5px] justify-center items-center w-10 h-10 rounded-lg hover:bg-surface-container transition-colors';
  burger.innerHTML = `
    <span class="burger-line block w-6 h-0.5 bg-primary rounded-full transition-all duration-300 origin-center"></span>
    <span class="burger-line block w-6 h-0.5 bg-primary rounded-full transition-all duration-300"></span>
    <span class="burger-line block w-6 h-0.5 bg-primary rounded-full transition-all duration-300 origin-center"></span>
  `;

  // Insert before Give button
  const giveBtn = header.querySelector('button');
  if (giveBtn) header.querySelector('.flex.justify-between').insertBefore(burger, giveBtn);

  // Build drawer
  const drawer = document.createElement('div');
  drawer.id = 'mobile-drawer';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.style.cssText = `
    position: fixed; top: 80px; left: 0; right: 0; z-index: 40;
    background: rgba(249,249,249,0.97); backdrop-filter: blur(16px);
    border-bottom: 2px solid #fed977;
    padding: 24px 20px 32px;
    transform: translateY(-110%);
    transition: transform 0.4s cubic-bezier(.4,0,.2,1), opacity 0.3s ease;
    opacity: 0;
    display: flex; flex-direction: column; gap: 0;
  `;

  // Clone nav links into drawer
  const links = nav.querySelectorAll('a');
  links.forEach((link, i) => {
    const clone = link.cloneNode(true);
    clone.style.cssText = `
      display: block; padding: 14px 0;
      font-size: 18px; font-weight: 600;
      border-bottom: 1px solid #e2e2e2;
      transform: translateX(-20px);
      opacity: 0;
      transition: transform 0.35s ease ${i * 60}ms, opacity 0.35s ease ${i * 60}ms, color 0.2s;
    `;
    drawer.appendChild(clone);
  });
  document.body.appendChild(drawer);

  let open = false;
  function toggleDrawer() {
    open = !open;
    burger.setAttribute('aria-expanded', open);
    drawer.setAttribute('aria-hidden', !open);

    if (open) {
      drawer.style.transform = 'translateY(0)';
      drawer.style.opacity = '1';
      document.body.style.overflow = 'hidden';
      // Animate links in
      drawer.querySelectorAll('a').forEach(a => {
        requestAnimationFrame(() => {
          a.style.transform = 'translateX(0)';
          a.style.opacity = '1';
        });
      });
    } else {
      drawer.style.transform = 'translateY(-110%)';
      drawer.style.opacity = '0';
      document.body.style.overflow = '';
      drawer.querySelectorAll('a').forEach((a, i) => {
        a.style.transform = 'translateX(-20px)';
        a.style.opacity = '0';
      });
    }

    // Animate burger → X
    const lines = burger.querySelectorAll('.burger-line');
    if (open) {
      lines[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      lines[1].style.opacity = '0';
      lines[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      lines.forEach(l => { l.style.transform = ''; l.style.opacity = ''; });
    }
  }

  burger.addEventListener('click', toggleDrawer);
  // Close on link click
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { if (open) toggleDrawer(); }));
})();


/* ═══════════════════════════════════════════════
   2. SCROLL-REVEAL — fade + rise animations
═══════════════════════════════════════════════ */
(function initScrollReveal() {
  const style = document.createElement('style');
  style.textContent = `
    [data-reveal] {
      opacity: 0;
      transform: translateY(32px);
      transition: opacity 0.65s cubic-bezier(.4,0,.2,1), transform 0.65s cubic-bezier(.4,0,.2,1);
    }
    [data-reveal].revealed {
      opacity: 1;
      transform: translateY(0);
    }
    [data-reveal="left"]  { transform: translateX(-32px); }
    [data-reveal="right"] { transform: translateX(32px); }
    [data-reveal="scale"] { transform: scale(0.92); }
    [data-reveal="left"].revealed,
    [data-reveal="right"].revealed,
    [data-reveal="scale"].revealed { transform: none; opacity: 1; }
  `;
  document.head.appendChild(style);

  // Auto-tag elements that should animate in
  const selectors = [
    'section h2', 'section h3',
    'article.discussion-card',
    '.gold-divider',
    '.sacred-shadow',
    '.bg-white\\/5',
    'section p.font-body-lg',
  ];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (!el.closest('header') && !el.closest('footer')) {
        if (!el.hasAttribute('data-reveal')) {
          el.setAttribute('data-reveal', 'up');
          el.style.transitionDelay = `${Math.min(i * 50, 300)}ms`;
        }
      }
    });
  });

  // Also tag value tiles, testimonial cards
  document.querySelectorAll('.grid .rounded-xl:not(header .rounded-xl):not(footer .rounded-xl)').forEach((el, i) => {
    if (!el.hasAttribute('data-reveal')) {
      el.setAttribute('data-reveal', 'up');
      el.style.transitionDelay = `${i * 80}ms`;
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
})();


/* ═══════════════════════════════════════════════
   3. HERO — parallax + animated entrance
═══════════════════════════════════════════════ */
(function initHero() {
  const hero = document.querySelector('section:first-of-type, .hero-section');
  if (!hero) return;

  // Entrance animation for hero text
  const heroTitle = hero.querySelector('h1, h2');
  const heroSub   = hero.querySelector('p');
  const heroBtns  = hero.querySelectorAll('button, a[class*="bg-primary"]');

  const entranceStyle = document.createElement('style');
  entranceStyle.textContent = `
    @keyframes heroFadeUp {
      from { opacity: 0; transform: translateY(40px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .hero-animate { animation: heroFadeUp 0.9s cubic-bezier(.4,0,.2,1) both; }
  `;
  document.head.appendChild(entranceStyle);

  [heroTitle, heroSub, ...heroBtns].forEach((el, i) => {
    if (!el) return;
    el.classList.add('hero-animate');
    el.style.animationDelay = `${0.2 + i * 0.15}s`;
  });

  // Subtle parallax on hero background / image
  const heroImg = hero.querySelector('img');
  if (heroImg) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      heroImg.style.transform = `translateY(${y * 0.25}px)`;
    }, { passive: true });
  }
})();


/* ═══════════════════════════════════════════════
   4. ANIMATED COUNTER — for stats / numbers
═══════════════════════════════════════════════ */
(function initCounters() {
  function animateCount(el) {
    const raw = el.textContent.replace(/[^0-9.]/g, '');
    const target = parseFloat(raw);
    if (isNaN(target) || target === 0) return;

    const prefix = el.textContent.match(/^[^0-9]*/)?.[0] || '';
    const suffix = el.textContent.match(/[^0-9.]*$/)?.[0] || '';
    const isFloat = el.textContent.includes('.');
    const duration = 1800;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const value = target * ease;
      el.textContent = prefix + (isFloat ? value.toFixed(1) : Math.floor(value)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = prefix + (isFloat ? target.toFixed(1) : target) + suffix;
    }
    requestAnimationFrame(step);
  }

  // Find elements that look like stats (e.g. "ZMW 2.3M", "68%", "1,200")
  const statPatterns = /^\s*[\$ZMW%K,]?[\d,]+(\.\d+)?[KMB%]?\s*$/;
  document.querySelectorAll('.font-display-lg, .font-headline-lg, [class*="text-5xl"], [class*="text-6xl"]').forEach(el => {
    if (statPatterns.test(el.textContent) && !el.closest('header') && !el.closest('footer')) {
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          animateCount(el);
          obs.disconnect();
        }
      }, { threshold: 0.5 });
      obs.observe(el);
    }
  });
})();


/* ═══════════════════════════════════════════════
   5. DONATION / GIVE BUTTON — ripple + modal
═══════════════════════════════════════════════ */
(function initGiveButton() {
  // Ripple effect on all primary buttons
  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `
    .btn-ripple { position: relative; overflow: hidden; }
    .ripple-wave {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,0.3);
      transform: scale(0);
      animation: rippleAnim 0.6s linear;
      pointer-events: none;
    }
    @keyframes rippleAnim {
      to { transform: scale(4); opacity: 0; }
    }
    /* Give modal */
    #give-modal {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(4,21,52,0.7); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #give-modal.active { opacity: 1; pointer-events: all; }
    #give-modal-box {
      background: #fff; border-radius: 20px; padding: 40px;
      max-width: 480px; width: 90%; position: relative;
      transform: translateY(30px) scale(0.96);
      transition: transform 0.35s cubic-bezier(.4,0,.2,1);
      box-shadow: 0 32px 80px rgba(4,21,52,0.25);
    }
    #give-modal.active #give-modal-box {
      transform: translateY(0) scale(1);
    }
    .give-amount-btn {
      padding: 12px 0; border: 2px solid #e2e2e2;
      border-radius: 10px; font-weight: 600; font-size: 16px;
      cursor: pointer; transition: all 0.2s;
      background: #fff; color: #041534;
    }
    .give-amount-btn:hover, .give-amount-btn.selected {
      border-color: #755b00; background: #fed977; color: #041534;
    }
    .give-input {
      width: 100%; border: 2px solid #e2e2e2; border-radius: 10px;
      padding: 14px 16px; font-size: 18px; outline: none;
      transition: border-color 0.2s;
    }
    .give-input:focus { border-color: #755b00; }
    .give-submit {
      width: 100%; background: #041534; color: #fff;
      border: none; border-radius: 12px; padding: 16px;
      font-size: 16px; font-weight: 600; cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-top: 8px;
    }
    .give-submit:hover { background: #755b00; }
    .give-submit:active { transform: scale(0.98); }
    .modal-close {
      position: absolute; top: 16px; right: 16px;
      width: 36px; height: 36px; border-radius: 50%;
      border: none; background: #f3f3f4; cursor: pointer;
      font-size: 20px; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .modal-close:hover { background: #e2e2e2; }
  `;
  document.head.appendChild(rippleStyle);

  // Add ripple to all primary buttons
  document.querySelectorAll('button, a[class*="bg-primary"], a[class*="bg-secondary"]').forEach(btn => {
    btn.classList.add('btn-ripple');
    btn.addEventListener('click', function(e) {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple-wave';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px;`;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });

  // Build Give modal
  const modal = document.createElement('div');
  modal.id = 'give-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Support Makeni Central SDA');
  modal.innerHTML = `
    <div id="give-modal-box">
      <button class="modal-close" aria-label="Close">✕</button>
      <h2 style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#041534;margin-bottom:6px;">Support the Church</h2>
      <p style="color:#45464e;font-size:14px;margin-bottom:24px;">Your gift helps us grow, serve, and build together.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
        <button class="give-amount-btn" data-amount="50">ZMW 50</button>
        <button class="give-amount-btn" data-amount="100">ZMW 100</button>
        <button class="give-amount-btn" data-amount="250">ZMW 250</button>
        <button class="give-amount-btn" data-amount="500">ZMW 500</button>
        <button class="give-amount-btn" data-amount="1000">ZMW 1,000</button>
        <button class="give-amount-btn" data-amount="custom" style="font-size:13px;">Custom</button>
      </div>
      <input class="give-input" id="give-custom-input" type="number" placeholder="Enter custom amount (ZMW)" style="display:none;margin-bottom:14px;" min="1"/>
      <p style="font-size:13px;color:#75777f;margin-bottom:14px;">💳 Secure giving via mobile money or bank transfer.</p>
      <button class="give-submit btn-ripple">Give Now ✦</button>
      <p id="give-thanks" style="display:none;text-align:center;margin-top:16px;color:#755b00;font-weight:600;font-size:15px;">🙏 Thank you for your generosity!</p>
    </div>
  `;
  document.body.appendChild(modal);

  let selectedAmount = null;
  modal.querySelectorAll('.give-amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.give-amount-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAmount = btn.dataset.amount;
      const customInput = modal.querySelector('#give-custom-input');
      if (selectedAmount === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
      }
    });
  });

  modal.querySelector('.give-submit').addEventListener('click', () => {
    modal.querySelector('#give-thanks').style.display = 'block';
    setTimeout(() => closeModal(), 2200);
  });

  function openModal()  { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
  function closeModal() { modal.classList.remove('active'); document.body.style.overflow = ''; }

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Hook all "Give" / "Support" / "Donate" buttons
  document.querySelectorAll('button').forEach(btn => {
    const text = btn.textContent.trim().toLowerCase();
    if (text === 'give' || text.includes('support') || text.includes('giving') || text.includes('donate')) {
      btn.addEventListener('click', openModal);
    }
  });
})();


/* ═══════════════════════════════════════════════
   6. LIKE BUTTON — heart toggle on Youth Board
═══════════════════════════════════════════════ */
(function initLikes() {
  const likeStyle = document.createElement('style');
  likeStyle.textContent = `
    @keyframes heartPop {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.5); }
      70%  { transform: scale(0.85); }
      100% { transform: scale(1); }
    }
    .liked .material-symbols-outlined { animation: heartPop 0.4s ease; color: #ba1a1a !important; font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important; }
  `;
  document.head.appendChild(likeStyle);

  document.querySelectorAll('button').forEach(btn => {
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon && icon.textContent.trim() === 'favorite') {
      btn.addEventListener('click', () => {
        const isLiked = btn.classList.toggle('liked');
        const countSpan = btn.querySelector('.font-label-md');
        if (countSpan) {
          const match = countSpan.textContent.match(/\d+/);
          if (match) {
            const n = parseInt(match[0]);
            countSpan.textContent = `${isLiked ? n + 1 : n - 1} Likes`;
          }
        }
      });
    }
  });
})();


/* ═══════════════════════════════════════════════
   7. PROGRESS BAR — animated building fundraiser
═══════════════════════════════════════════════ */
(function initProgressBar() {
  // Only runs on building.html (looks for progress-bar or goal elements)
  const progressEls = document.querySelectorAll('[class*="progress"], [class*="goal"]');
  progressEls.forEach(el => {
    const bar = el.querySelector('[style*="width"]') || el.querySelector('.bg-secondary');
    if (!bar) return;
    const targetWidth = bar.style.width || '68%';
    bar.style.width = '0%';
    bar.style.transition = 'width 1.6s cubic-bezier(.4,0,.2,1)';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setTimeout(() => { bar.style.width = targetWidth; }, 200);
        obs.disconnect();
      }
    });
    obs.observe(el);
  });
})();


/* ═══════════════════════════════════════════════
   8. SMOOTH PAGE TRANSITIONS
═══════════════════════════════════════════════ */
(function initPageTransitions() {
  const overlay = document.createElement('div');
  overlay.id = 'page-transition';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: #041534;
    transform: scaleY(0); transform-origin: bottom;
    transition: transform 0.45s cubic-bezier(.76,0,.24,1);
    pointer-events: none;
  `;
  document.body.appendChild(overlay);

  // Fade in on load
  const entryOverlay = document.createElement('div');
  entryOverlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99998;
    background: #041534;
    transform: scaleY(1); transform-origin: top;
    transition: transform 0.5s cubic-bezier(.76,0,.24,1) 0.1s;
    pointer-events: none;
  `;
  document.body.appendChild(entryOverlay);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { entryOverlay.style.transform = 'scaleY(0)'; });
  });
  entryOverlay.addEventListener('transitionend', () => entryOverlay.remove());

  // Exit on internal link click
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('http') || a.target === '_blank') return;
    e.preventDefault();
    overlay.style.transformOrigin = 'bottom';
    overlay.style.transform = 'scaleY(1)';
    overlay.addEventListener('transitionend', () => { window.location.href = href; }, { once: true });
  });
})();


/* ═══════════════════════════════════════════════
   9. GOLD DIVIDER — animated width on scroll
═══════════════════════════════════════════════ */
(function initGoldDividers() {
  document.querySelectorAll('.gold-divider').forEach(el => {
    el.style.width = '0px';
    el.style.transition = 'width 0.8s cubic-bezier(.4,0,.2,1)';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        el.style.width = '60px';
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
})();


/* ═══════════════════════════════════════════════
   10. TOAST NOTIFICATION SYSTEM
═══════════════════════════════════════════════ */
window.SDAToast = (function() {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 99990; display: flex; flex-direction: column; gap: 10px; align-items: center;
    pointer-events: none;
  `;
  document.body.appendChild(container);

  const toastStyle = document.createElement('style');
  toastStyle.textContent = `
    .sda-toast {
      background: #041534; color: #fff; padding: 12px 24px;
      border-radius: 100px; font-size: 14px; font-weight: 600;
      border-left: 4px solid #e6c364;
      box-shadow: 0 8px 24px rgba(4,21,52,0.3);
      opacity: 0; transform: translateY(20px);
      transition: all 0.35s cubic-bezier(.4,0,.2,1);
      pointer-events: all;
      white-space: nowrap;
    }
    .sda-toast.show { opacity: 1; transform: translateY(0); }
  `;
  document.head.appendChild(toastStyle);

  return function(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'sda-toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
  };
})();


/* ═══════════════════════════════════════════════
   11. COPY EMAIL — click to copy contact address
═══════════════════════════════════════════════ */
(function initCopyEmail() {
  document.querySelectorAll('p, a').forEach(el => {
    if (el.textContent.includes('@makenicentralsda.org')) {
      el.style.cursor = 'pointer';
      el.title = 'Click to copy email';
      el.addEventListener('click', () => {
        navigator.clipboard.writeText('info@makenicentralsda.org').then(() => {
          window.SDAToast('✉ Email copied to clipboard!');
        });
      });
    }
  });
})();


/* ═══════════════════════════════════════════════
   12. DISCUSSION CARD — expand/collapse
═══════════════════════════════════════════════ */
(function initDiscussionCards() {
  document.querySelectorAll('article.discussion-card').forEach(card => {
    const preview = card.querySelector('.line-clamp-2');
    if (!preview) return;

    preview.style.cursor = 'pointer';
    preview.title = 'Click to expand';

    const fullText = preview.textContent;
    preview.style.transition = 'all 0.3s ease';

    preview.addEventListener('click', () => {
      if (preview.classList.contains('line-clamp-2')) {
        preview.classList.remove('line-clamp-2');
        window.SDAToast('💬 Thread expanded');
      } else {
        preview.classList.add('line-clamp-2');
      }
    });
  });
})();


/* ═══════════════════════════════════════════════
   13. BACK-TO-TOP BUTTON
═══════════════════════════════════════════════ */
(function initBackToTop() {
  const btn = document.createElement('button');
  btn.innerHTML = `<span class="material-symbols-outlined">arrow_upward</span>`;
  btn.setAttribute('aria-label', 'Back to top');
  btn.style.cssText = `
    position: fixed; bottom: 90px; right: 28px; z-index: 100;
    width: 44px; height: 44px; border-radius: 50%;
    background: #041534; color: #fff; border: 2px solid #e6c364;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(4,21,52,0.2);
    cursor: pointer; opacity: 0; pointer-events: none;
    transition: opacity 0.3s ease, transform 0.2s ease;
  `;
  // Avoid overlapping the Youth Board FAB
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    } else {
      btn.style.opacity = '0';
      btn.style.pointerEvents = 'none';
    }
  }, { passive: true });

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
})();


/* ═══════════════════════════════════════════════
   INIT COMPLETE
═══════════════════════════════════════════════ */
console.log('%c✦ Makeni Central SDA — sda.js loaded', 'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;');