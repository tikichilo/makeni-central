/**
 * sda.js — Makeni Central SDA Church  v5
 * UI motion, interactions & enhancements
 *
 * CHANGES vs v4:
 *  § initDropdownNav — NEW §1b. Desktop dropdown nav (About/Youth/
 *    Ministries/Quick Links) moved here from copy-pasted inline scripts
 *    on index.html and pathfinders.html. Click/tap driven so touch
 *    devices work correctly; closes on outside click / Escape.
 *  § initMobileAccordion — NEW §1c. Mobile drawer accordion submenus,
 *    same de-duplication as above.
 *  § initNavbar — scroll handler now also toggles the `scrolled` class
 *    on <header> (drives the .nav-inner 80px→64px shrink defined in
 *    CSS), which previously only worked on pages that happened to carry
 *    their own inline scroll listener.
 *  § initHeroSlideshows — NEW §16b. Named hero slideshows (Pathfinders/
 *    AY/Adventurers) — auto-rotating bg slides with dot nav. Guarded,
 *    so safe to run globally; no-ops on pages without the markup.
 *  § initGenericSlideshows — NEW §16c. [data-slideshow] crossfade
 *    carousels used inside content sections (e.g. Honors on
 *    pathfinders.html).
 *
 *  IMPORTANT: this version supersedes the inline dropdown/accordion
 *  script that used to live inside index.html and the separate
 *  navigation script that used to live inside pathfinders.html.
 *  Both of those must be REMOVED from their pages now that sda.js
 *  owns this logic — see notes below the file.
 */

'use strict';


/* ═══════════════════════════════════════════════
   MOTION PREFERENCE — checked once, used everywhere
═══════════════════════════════════════════════ */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ═══════════════════════════════════════════════
   SHARED GUARD — run after DOM is ready
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);

function init() {
  initResponsive();      // §17 — fluid type + mobile spacing
  initNavbar();          // §1  — hamburger/drawer + scroll shrink
  initDropdownNav();     // §1b — desktop dropdown nav
  initMobileAccordion(); // §1c — mobile drawer accordion
  initScrollReveal();    // §2
  initHero();            // §3
  initCounters();        // §4
  initGiveButton();      // §5
  initPageTransitions(); // §8
  initGoldDividers();    // §9
  initToast();           // §10
  initCopyEmail();       // §11
  initBackToTop();       // §13
  initImageShimmer();    // §14
  initActiveNav();       // §15
  initHeroSlideshows();    // §16b — named page hero slideshows
  initGenericSlideshows(); // §16c — [data-slideshow] content carousels

  console.log(
    '%c✦ Makeni Central SDA — sda.js v5 loaded',
    'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;'
  );
}


/* ═══════════════════════════════════════════════
   §17. RESPONSIVE — fluid typography + mobile spacing
   Injected once into <head>; avoids a separate CSS file.
═══════════════════════════════════════════════ */
function initResponsive() {
  if (document.getElementById('sda-responsive-style')) return;

  const s = document.createElement('style');
  s.id = 'sda-responsive-style';
  s.textContent = `
    /* ── Fluid typography ─────────────────────────── */
    .font-display-lg, .text-display-lg {
      font-size: clamp(2rem, 4vw + 0.75rem, 3.5rem) !important;
      line-height: 1.1 !important;
    }
    .font-headline-lg, .text-headline-lg {
      font-size: clamp(1.625rem, 3vw + 0.5rem, 2.5rem) !important;
      line-height: 1.2 !important;
    }
    .font-headline-md, .text-headline-md {
      font-size: clamp(1.375rem, 2.5vw + 0.25rem, 2rem) !important;
      line-height: 1.3 !important;
    }

    /* ── Mobile section gap ───────────────────────── */
    @media (max-width: 767px) {
      .py-section-gap { padding-top: 60px !important; padding-bottom: 60px !important; }
      .pt-section-gap { padding-top: 60px !important; }
      .pb-section-gap { padding-bottom: 60px !important; }
      .mb-section-gap { margin-bottom: 60px !important; }
      .mt-section-gap { margin-top: 60px !important; }
    }

    /* ── Building page ────────────────────────────── */
    @media (max-width: 767px) {
      .grid.grid-rows-2.h-\\[600px\\] {
        height: auto !important;
      }
      .grid.grid-rows-2.h-\\[600px\\] > div {
        height: 220px !important;
        grid-column: auto !important;
        grid-row: auto !important;
      }
      [data-func="fund-raised"],
      [data-func="fund-goal"],
      [data-func="fund-percent"],
      [data-func="fund-donors"] {
        font-size: clamp(1.1rem, 4vw, 1.75rem) !important;
        word-break: break-word;
      }
    }

    /* ── Kids page ────────────────────────────────── */
    @media (max-width: 767px) {
      [data-func="stories"] .md\\:col-span-8 {
        flex-direction: column !important;
      }
      [data-func="stories"] .md\\:col-span-8 .md\\:w-1\\/2 {
        width: 100% !important;
        height: 200px !important;
      }
    }

    /* ── Youth page ───────────────────────────────── */
    @media (max-width: 767px) {
      #fab-new-discussion {
        width: 56px !important;
        height: 56px !important;
        padding: 0 !important;
        justify-content: center !important;
        border-radius: 50% !important;
      }
      #fab-new-discussion .fab-label { display: none !important; }

      [data-filter] {
        font-size: 12px !important;
        padding: 6px 14px !important;
      }
      .discussion-card { padding: 20px !important; }
    }

    /* ── FAB pulse ring ───────────────────────────── */
    @keyframes fabPulse {
      0%   { box-shadow: 0 0 0 0   rgba(254,217,119,0.5); }
      70%  { box-shadow: 0 0 0 12px rgba(254,217,119,0); }
      100% { box-shadow: 0 0 0 0   rgba(254,217,119,0); }
    }
    #fab-new-discussion { animation: fabPulse 2.5s ease-in-out infinite; }
    #fab-new-discussion:hover { animation: none; transform: scale(1.04); }
    #fab-new-discussion:active { transform: scale(0.96) !important; }

    /* ── Progress bar shimmer ─────────────────────── */
    @keyframes progressShimmer {
      0%   { background-position: 200% center; }
      100% { background-position: -200% center; }
    }
    [data-func="fund-bar"] {
      background: linear-gradient(90deg, #755b00 0%, #e6c364 50%, #755b00 100%) !important;
      background-size: 200% auto !important;
      animation: progressShimmer 3s linear infinite !important;
    }

    /* ── Map pin pulse ────────────────────────────── */
    @keyframes pinPulse {
      0%, 100% { box-shadow: 0 0 0 0   rgba(239,68,68,0.5); }
      50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
    }
    #pin-dot { animation: pinPulse 1.8s ease-in-out infinite; }

    /* ── Touch targets ────────────────────────────── */
    button, [role="button"], a { -webkit-tap-highlight-color: transparent; }
    @media (max-width: 767px) {
      .mobile-give, .hamburger-btn { min-height: 44px; min-width: 44px; }
    }

    /* ── Focus visible ────────────────────────────── */
    *:focus-visible {
      outline: 2px solid #755b00;
      outline-offset: 3px;
      border-radius: 4px;
    }

    /* ── Reduced motion overrides ─────────────────── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
  document.head.appendChild(s);

  const fabLabel = document.querySelector('#fab-new-discussion span:last-child');
  if (fabLabel && !fabLabel.classList.contains('material-symbols-outlined')) {
    fabLabel.classList.add('fab-label');
  }
}


/* ═══════════════════════════════════════════════
   §1. NAVBAR — scroll shrink / hide-on-scroll
       Hamburger / drawer wiring also lives here.
═══════════════════════════════════════════════ */
function initNavbar() {
  const header = document.querySelector('header');
  if (!header) return;

  header.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1), box-shadow 0.3s ease, border-color 0.3s ease';

  let lastScroll = 0;
  let drawerOpen = false;

  const drawer = document.getElementById('mobile-drawer');

  const hamburger = document.getElementById('hamburger-btn');
  if (hamburger && drawer) {
    function setDrawerOpen(state) {
      drawerOpen = state;
      hamburger.classList.toggle('open', state);
      hamburger.setAttribute('aria-expanded', String(state));
      drawer.classList.toggle('open', state);
      drawer.setAttribute('aria-hidden', String(!state));
      document.body.style.overflow = state ? 'hidden' : '';
    }

    hamburger.addEventListener('click', () => setDrawerOpen(!drawerOpen));

    document.addEventListener('click', e => {
      if (drawerOpen && !hamburger.contains(e.target) && !drawer.contains(e.target))
        setDrawerOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawerOpen) { setDrawerOpen(false); hamburger.focus(); }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && drawerOpen) setDrawerOpen(false);
      if (document.body.dataset.visitModalOpen || document.body.dataset.giveModalOpen) {
        document.body.style.overflow = 'hidden';
      }
    }, { passive: true });

    new MutationObserver(() => { drawerOpen = drawer.classList.contains('open'); })
      .observe(drawer, { attributes: true, attributeFilter: ['class'] });
  } else if (drawer) {
    new MutationObserver(() => { drawerOpen = drawer.classList.contains('open'); })
      .observe(drawer, { attributes: true, attributeFilter: ['class'] });
  }

  /* Scroll shrink + hide */
  const HIDE_THRESHOLD = window.innerWidth < 768 ? 80 : 120;

  window.addEventListener('scroll', () => {
    if (drawerOpen) return;
    const y = window.scrollY;

    // Drives .nav-inner 80px → 64px shrink (CSS: header.scrolled .nav-inner)
    header.classList.toggle('scrolled', y > 40);

    header.style.boxShadow         = y > 60 ? '0 4px 24px rgba(4,21,52,0.12)' : '';
    header.style.borderBottomColor = y > 60 ? '#e6c364' : '';

    if (!REDUCED_MOTION) {
      if (y > lastScroll + 8 && y > HIDE_THRESHOLD) {
        header.style.transform = 'translateY(-100%)';
      } else if (y < lastScroll - 4) {
        header.style.transform = 'translateY(0)';
      }
    }

    lastScroll = y;
  }, { passive: true });
}


/* ═══════════════════════════════════════════════
   §1b. DESKTOP DROPDOWN NAV — About / Youth / Ministries / Quick Links
   Click/tap driven (not just CSS :hover) so touch devices work
   correctly. Consolidated here from the duplicated inline copies
   that used to live in index.html and pathfinders.html.
═══════════════════════════════════════════════ */
function initDropdownNav() {
  const navItems = document.querySelectorAll('.nav-item');
  if (!navItems.length) return;

  navItems.forEach(item => {
    const trigger = item.querySelector('.nav-trigger');
    if (!trigger) return; // plain links (Home, News) have no dropdown

    trigger.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !item.classList.contains('nav-open');
      navItems.forEach(other => {
        other.classList.remove('nav-open');
        const t = other.querySelector('.nav-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('nav-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    item.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        item.classList.remove('nav-open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  });

  document.addEventListener('click', e => {
    navItems.forEach(item => {
      if (!item.contains(e.target)) {
        item.classList.remove('nav-open');
        const t = item.querySelector('.nav-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      }
    });
  });
}


/* ═══════════════════════════════════════════════
   §1c. MOBILE ACCORDION SUBMENUS — inside the drawer
   (About / Youth / Ministries / Quick Links). Consolidated
   here for the same reason as §1b.
═══════════════════════════════════════════════ */
function initMobileAccordion() {
  const triggers = document.querySelectorAll('.mobile-drawer .accordion-trigger');
  if (!triggers.length) return;

  triggers.forEach(trigger => {
    const panel = trigger.nextElementSibling;
    trigger.addEventListener('click', () => {
      const isOpen = trigger.classList.contains('open');

      triggers.forEach(t => {
        t.classList.remove('open');
        t.setAttribute('aria-expanded', 'false');
        if (t.nextElementSibling) t.nextElementSibling.style.maxHeight = null;
      });

      if (!isOpen) {
        trigger.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });
}


/* ═══════════════════════════════════════════════
   §2. SCROLL-REVEAL
═══════════════════════════════════════════════ */
function initScrollReveal() {
  const s = document.createElement('style');
  s.textContent = `
    [data-reveal] {
      opacity: 0;
      transform: translateY(32px);
      transition: opacity 0.65s cubic-bezier(.4,0,.2,1), transform 0.65s cubic-bezier(.4,0,.2,1);
      will-change: opacity, transform;
    }
    [data-reveal].revealed { opacity: 1; transform: translateY(0) !important; }
    [data-reveal="left"]  { transform: translateX(-32px); }
    [data-reveal="right"] { transform: translateX(32px); }
    [data-reveal="scale"] { transform: scale(0.92); opacity: 0; }
  `;
  document.head.appendChild(s);

  if (REDUCED_MOTION) {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('revealed'));
    return;
  }

  const heroSection = document.querySelector('section:first-of-type');

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
      if (el.closest('header') || el.closest('footer'))  return;
      if (heroSection && heroSection.contains(el))        return;
      if (el.classList.contains('hero-animate'))          return;
      if (el.hasAttribute('data-reveal'))                 return;
      el.setAttribute('data-reveal', 'up');
      el.style.transitionDelay = `${Math.min(i * 50, 300)}ms`;
    });
  });

  document.querySelectorAll('.grid .rounded-xl:not(header .rounded-xl):not(footer .rounded-xl)').forEach((el, i) => {
    if (el.closest('header') || el.closest('footer'))  return;
    if (heroSection && heroSection.contains(el))        return;
    if (el.hasAttribute('data-reveal'))                 return;
    el.setAttribute('data-reveal', 'up');
    el.style.transitionDelay = `${Math.min(i * 80, 300)}ms`;
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}


/* ═══════════════════════════════════════════════
   §3. HERO — entrance animation + Ken Burns + parallax
═══════════════════════════════════════════════ */
function initHero() {
  const hero = document.querySelector('section:first-of-type');
  if (!hero) return;

  const heroTitle = hero.querySelector('h1, h2');
  const heroSub   = hero.querySelector('p');
  const heroBtns  = [...hero.querySelectorAll('button, a[class*="bg-primary"], a[class*="bg-secondary"]')];

  const s = document.createElement('style');
  s.textContent = `
    @keyframes heroFadeUp {
      from { opacity: 0; transform: translateY(40px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .hero-animate {
      animation: heroFadeUp 0.9s cubic-bezier(.4,0,.2,1) both;
    }
    @keyframes kenBurns {
      from { transform: scale(1); }
      to   { transform: scale(1.08); }
    }
    .hero-bg-animate {
      animation: kenBurns 14s ease-out forwards;
      will-change: transform;
    }
  `;
  document.head.appendChild(s);

  if (!REDUCED_MOTION) {
    [heroTitle, heroSub, ...heroBtns].forEach((el, i) => {
      if (!el) return;
      el.classList.add('hero-animate');
      el.style.animationDelay = `${0.2 + i * 0.15}s`;
    });

    const bgDiv = hero.querySelector('[style*="background-image"]');
    const bgImg = hero.querySelector('img');
    if (bgDiv) bgDiv.classList.add('hero-bg-animate');
    else if (bgImg) bgImg.classList.add('hero-bg-animate');

    const parallaxTarget = bgDiv || bgImg;
    if (parallaxTarget && window.innerWidth >= 768) {
      window.addEventListener('scroll', () => {
        parallaxTarget.style.transform = `translateY(${window.scrollY * 0.18}px) scale(1.08)`;
      }, { passive: true });
    }
  }
}


/* ═══════════════════════════════════════════════
   §4. ANIMATED COUNTERS
═══════════════════════════════════════════════ */
function initCounters() {
  function animateCount(el) {
    const raw    = el.textContent.replace(/[^0-9.]/g, '');
    const target = parseFloat(raw);
    if (isNaN(target) || target === 0) return;

    const prefix  = el.textContent.match(/^[^0-9]*/)?.[0]  || '';
    const suffix  = el.textContent.match(/[^0-9.]*$/)?.[0] || '';
    const isFloat = el.textContent.includes('.');
    const start   = performance.now();
    const dur     = REDUCED_MOTION ? 0 : 1800;

    function step(now) {
      const t   = Math.min((now - start) / (dur || 1), 1);
      const val = target * (1 - Math.pow(1 - t, 3));
      el.textContent = prefix + (isFloat ? val.toFixed(1) : Math.floor(val)) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + (isFloat ? target.toFixed(1) : target) + suffix;
    }
    requestAnimationFrame(step);
  }

  const heroSection = document.querySelector('section:first-of-type');
  const statPattern = /^\s*[\$ZMW%K,]?[\d,]+(\.\d+)?[KMB%]?\s*$/;

  document.querySelectorAll('.font-display-lg, .font-headline-lg, [class*="text-5xl"], [class*="text-6xl"]').forEach(el => {
    if (!statPattern.test(el.textContent))                       return;
    if (el.closest('header') || el.closest('footer'))            return;
    if (heroSection && heroSection.contains(el))                  return;
    if (el.dataset.func && el.dataset.func.startsWith('fund-'))  return; // func.js owns these
    if (el.dataset.counterWired)                                  return;
    el.dataset.counterWired = '1';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { animateCount(el); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}

/* ═══════════════════════════════════════════════
   §5. GIVE BUTTON + MODAL
═══════════════════════════════════════════════ */
function initGiveButton() {
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
    @keyframes rippleAnim { to { transform: scale(4); opacity: 0; } }

    #give-modal {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(4,21,52,0.72); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #give-modal.active { opacity: 1; pointer-events: all; }
    #give-modal-box {
      background: #fff; border-radius: 20px; padding: 40px;
      max-width: 480px; width: 100%; position: relative;
      transform: translateY(30px) scale(0.96);
      transition: transform 0.35s cubic-bezier(.4,0,.2,1);
      box-shadow: 0 32px 80px rgba(4,21,52,0.25);
      max-height: 90vh; overflow-y: auto;
    }
    #give-modal.active #give-modal-box { transform: translateY(0) scale(1); }
    .give-amount-btn {
      padding: 12px 0; border: 2px solid #e2e2e2;
      border-radius: 10px; font-weight: 600; font-size: 16px;
      cursor: pointer; transition: all 0.2s;
      background: #fff; color: #041534; font-family: Inter, sans-serif;
    }
    .give-amount-btn:hover,
    .give-amount-btn.selected { border-color: #755b00; background: #fed977; }
    .give-input {
      width: 100%; border: 2px solid #e2e2e2; border-radius: 10px;
      padding: 14px 16px; font-size: 18px; outline: none;
      transition: border-color 0.2s; box-sizing: border-box;
      font-family: Inter, sans-serif;
    }
    .give-input:focus { border-color: #755b00; }
    .give-submit {
      width: 100%; background: #041534; color: #fff;
      border: none; border-radius: 12px; padding: 16px;
      font-size: 16px; font-weight: 600; cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-top: 8px; font-family: Inter, sans-serif;
    }
    .give-submit:hover  { background: #755b00; }
    .give-submit:active { transform: scale(0.98); }
    .modal-close-give {
      position: absolute; top: 16px; right: 16px;
      width: 36px; height: 36px; border-radius: 50%;
      border: none; background: #f3f3f4; cursor: pointer;
      font-size: 20px; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .modal-close-give:hover { background: #e2e2e2; }

    @media (max-width: 480px) {
      #give-modal-box { padding: 28px 20px; border-radius: 16px; }
      .give-amount-btn { font-size: 14px; }
    }
  `;
  document.head.appendChild(rippleStyle);

  if (!REDUCED_MOTION) {
    document.querySelectorAll('button, a[class*="bg-primary"], a[class*="bg-secondary"]').forEach(btn => {
      if (btn.dataset.rippleWired) return;
      btn.dataset.rippleWired = '1';
      btn.classList.add('btn-ripple');
      btn.addEventListener('click', e => {
        const rect   = btn.getBoundingClientRect();
        const size   = Math.max(rect.width, rect.height) * 2;
        const ripple = document.createElement('span');
        ripple.className = 'ripple-wave';
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px;`;
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      });
    });
  }

  const modal = document.createElement('div');
  modal.id = 'give-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Support Makeni Central SDA');
  modal.innerHTML = `
    <div id="give-modal-box">
      <button class="modal-close-give" aria-label="Close">✕</button>
      <h2 style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#041534;margin-bottom:6px;">
        Support the Church
      </h2>
      <p style="color:#45464e;font-size:14px;margin-bottom:24px;">
        Your gift helps us grow, serve, and build together.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
        <button class="give-amount-btn" data-amount="50">ZMW 50</button>
        <button class="give-amount-btn" data-amount="100">ZMW 100</button>
        <button class="give-amount-btn" data-amount="250">ZMW 250</button>
        <button class="give-amount-btn" data-amount="500">ZMW 500</button>
        <button class="give-amount-btn" data-amount="1000">ZMW 1,000</button>
        <button class="give-amount-btn" data-amount="custom" style="font-size:13px;">Custom</button>
      </div>
      <input class="give-input" id="give-custom-input" type="number"
             placeholder="Enter amount (ZMW)" min="1"
             style="display:none;margin-bottom:14px;" aria-label="Custom amount"/>
      <p style="font-size:13px;color:#75777f;margin-bottom:14px;">
        💳 Secure giving via mobile money or bank transfer.
      </p>
      <button class="give-submit btn-ripple">Give Now ✦</button>
      <p id="give-thanks" style="display:none;text-align:center;margin-top:16px;color:#755b00;font-weight:600;font-size:15px;">
        🙏 Thank you for your generosity!
      </p>
    </div>`;
  document.body.appendChild(modal);

  let selectedAmount = null;
  const customInput  = modal.querySelector('#give-custom-input');

  modal.querySelectorAll('.give-amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.give-amount-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAmount = btn.dataset.amount;
      customInput.style.display = selectedAmount === 'custom' ? 'block' : 'none';
      if (selectedAmount === 'custom') customInput.focus();
    });
  });

  modal.querySelector('.give-submit').addEventListener('click', async () => {
    const amount = selectedAmount === 'custom'
      ? parseFloat(customInput.value)
      : parseFloat(selectedAmount);
    if (!amount || amount <= 0) {
      window.SDAToast?.('Please select or enter an amount.', 'error');
      return;
    }
    const submitBtn = modal.querySelector('.give-submit');
    submitBtn.textContent = 'Processing…';
    submitBtn.disabled    = true;
    if (typeof apiPost === 'function') await apiPost('/donate', { amount, currency: 'ZMW' });
    modal.querySelector('#give-thanks').style.display = 'block';
    submitBtn.style.display = 'none';
    window.SDAToast?.('🙏 Gift recorded — thank you!', 'success', 4000);
    setTimeout(closeGiveModal, 2800);
  });

  function openGiveModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close-give').focus();
  }
  function closeGiveModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    modal.querySelector('#give-thanks').style.display = 'none';
    const sub = modal.querySelector('.give-submit');
    sub.style.display = ''; sub.disabled = false; sub.textContent = 'Give Now ✦';
    selectedAmount = null;
    customInput.value = ''; customInput.style.display = 'none';
    modal.querySelectorAll('.give-amount-btn').forEach(b => b.classList.remove('selected'));
  }

  modal.querySelector('.modal-close-give').addEventListener('click', closeGiveModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeGiveModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeGiveModal();
  });

  window.openGiveModal  = openGiveModal;
  window.closeGiveModal = closeGiveModal;

  function isGiveButton(btn) {
    if (btn.closest('#give-modal')) return false;
    if (btn.classList.contains('desktop-give'))    return true;
    if (btn.classList.contains('mobile-give'))     return true;
    if (btn.classList.contains('mobile-give-btn')) return true;
    const text = (btn.innerText || btn.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return text === 'give' || text.startsWith('give ') || text.endsWith(' give');
  }

  document.querySelectorAll('button, a').forEach(btn => {
    if (btn.dataset.giveWired) return;
    if (!isGiveButton(btn)) return;
    btn.dataset.giveWired = '1';
    btn.addEventListener('click', e => { e.preventDefault(); openGiveModal(); });
  });
}

/* ═══════════════════════════════════════════════
   §8. SMOOTH PAGE TRANSITIONS
═══════════════════════════════════════════════ */
function initPageTransitions() {
  if (REDUCED_MOTION) return;

  const overlay = document.createElement('div');
  overlay.id = 'page-transition';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:#041534;
    transform:scaleY(0);transform-origin:bottom;
    transition:transform 0.45s cubic-bezier(.76,0,.24,1);
    pointer-events:none;
  `;
  document.body.appendChild(overlay);

  const entry = document.createElement('div');
  entry.style.cssText = `
    position:fixed;inset:0;z-index:99998;
    background:#041534;
    transform:scaleY(1);transform-origin:top;
    transition:transform 0.5s cubic-bezier(.76,0,.24,1) 0.1s;
    pointer-events:none;
  `;
  document.body.appendChild(entry);

  requestAnimationFrame(() => requestAnimationFrame(() => { entry.style.transform = 'scaleY(0)'; }));
  entry.addEventListener('transitionend', () => entry.remove());

  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto') ||
        href.startsWith('http') || a.target === '_blank') return;
    e.preventDefault();
    overlay.style.transformOrigin = 'bottom';
    overlay.style.transform = 'scaleY(1)';
    overlay.addEventListener('transitionend', () => { window.location.href = href; }, { once: true });
  });
}


/* ═══════════════════════════════════════════════
   §9. GOLD DIVIDERS — animate width on scroll
═══════════════════════════════════════════════ */
function initGoldDividers() {
  document.querySelectorAll('.gold-divider').forEach(el => {
    if (REDUCED_MOTION) { el.style.width = '60px'; return; }
    el.style.width      = '0px';
    el.style.transition = 'width 0.8s cubic-bezier(.4,0,.2,1)';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { el.style.width = '60px'; obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}


/* ═══════════════════════════════════════════════
   §10. TOAST — yields to func.js's richer version
═══════════════════════════════════════════════ */
function initToast() {
  if (typeof window.SDAToast === 'function') return;

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    z-index:99990;display:flex;flex-direction:column;gap:10px;
    align-items:center;pointer-events:none;
  `;
  document.body.appendChild(wrap);

  const s = document.createElement('style');
  s.textContent = `
    .sda-toast {
      background:#041534;color:#fff;padding:12px 24px;
      border-radius:100px;font-size:14px;font-weight:600;
      border-left:4px solid #e6c364;
      box-shadow:0 8px 24px rgba(4,21,52,0.3);
      opacity:0;transform:translateY(20px);
      transition:all 0.35s cubic-bezier(.4,0,.2,1);
      pointer-events:all;white-space:nowrap;max-width:88vw;
    }
    .sda-toast.show{opacity:1;transform:translateY(0);}
    .sda-toast.t-success{border-color:#4caf50;}
    .sda-toast.t-error{border-color:#ba1a1a;background:#2d0a0a;}
  `;
  document.head.appendChild(s);

  window.SDAToast = function(message, type = 'info', duration = 3000) {
    const t = document.createElement('div');
    t.className = `sda-toast t-${type}`;
    t.textContent = message;
    wrap.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, duration);
  };
}


/* ═══════════════════════════════════════════════
   §11. COPY EMAIL — click-to-copy
═══════════════════════════════════════════════ */
function initCopyEmail() {
  document.querySelectorAll('p, a').forEach(el => {
    if (!el.textContent.includes('@makenicentralsda.org')) return;
    el.style.cursor = 'pointer';
    el.title = 'Click to copy email';
    el.addEventListener('click', () => {
      navigator.clipboard?.writeText('info@makenicentralsda.org').then(() => {
        window.SDAToast?.('✉ Email copied!', 'success');
      }).catch(() => {
        window.SDAToast?.('Could not copy — please copy manually.', 'error');
      });
    });
  });
}


/* ═══════════════════════════════════════════════
   §13. BACK-TO-TOP
   Sits above the Youth Board FAB on youth.html.
═══════════════════════════════════════════════ */
function initBackToTop() {
  const isYouth = document.body.dataset.page === 'youth';

  const btn = document.createElement('button');
  btn.innerHTML = `<span class="material-symbols-outlined">arrow_upward</span>`;
  btn.setAttribute('aria-label', 'Back to top');
  btn.style.cssText = `
    position:fixed;
    bottom:${isYouth ? '100px' : '90px'};
    right:28px;
    z-index:100;
    width:44px;height:44px;border-radius:50%;
    background:#041534;color:#fff;
    border:2px solid #e6c364;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 16px rgba(4,21,52,0.2);
    cursor:pointer;opacity:0;pointer-events:none;
    transition:opacity 0.3s ease,transform 0.2s ease;
  `;
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    const visible           = window.scrollY > 400;
    btn.style.opacity       = visible ? '1' : '0';
    btn.style.pointerEvents = visible ? 'auto' : 'none';
  }, { passive: true });

  btn.addEventListener('click',      () => window.scrollTo({ top: 0, behavior: REDUCED_MOTION ? 'auto' : 'smooth' }));
  btn.addEventListener('mouseenter', () => { if (!REDUCED_MOTION) btn.style.transform = 'scale(1.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
}


/* ═══════════════════════════════════════════════
   §14. IMAGE SHIMMER — loading placeholder
═══════════════════════════════════════════════ */
function initImageShimmer() {
  if (REDUCED_MOTION) return;

  const s = document.createElement('style');
  s.textContent = `
    img.img-loading {
      background: linear-gradient(90deg,#e2e2e2 25%,#f3f3f4 50%,#e2e2e2 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    img.img-loaded { animation: none; background: none; }
  `;
  document.head.appendChild(s);

  document.querySelectorAll('img').forEach(img => {
    img.classList.add('img-loading');
    if (img.complete) {
      img.classList.replace('img-loading', 'img-loaded');
    } else {
      img.addEventListener('load',  () => img.classList.replace('img-loading', 'img-loaded'), { once: true });
      img.addEventListener('error', () => img.classList.replace('img-loading', 'img-loaded'), { once: true });
    }
  });
}


/* ═══════════════════════════════════════════════
   §15. ACTIVE NAV LINK HIGHLIGHTER
═══════════════════════════════════════════════ */
function initActiveNav() {
  const page    = document.body.dataset.page || '';
  const pathMap = {
    index:    ['index.html', '/'],
    kids:     ['kids.html'],
    youth:    ['youth.html'],
    building: ['building.html'],
  };
  const matches = pathMap[page] || [];

  document.querySelectorAll('header nav a, .mobile-drawer nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const isActive = href === '#' || matches.some(m => href.endsWith(m));
    if (isActive) {
      a.classList.add('text-primary', 'border-b-2', 'border-secondary', 'pb-1');
      a.classList.remove('text-on-surface-variant');
    } else {
      a.classList.remove('text-primary', 'border-b-2', 'border-secondary', 'pb-1');
    }
  });
}


/* ═══════════════════════════════════════════════
   §16b. NAMED HERO SLIDESHOWS — Pathfinders/AY/Adventurers
   Auto-rotating bg slides with dot navigation. Guarded, so
   safe to run globally: no-ops on pages without the matching
   markup. Add one initNamedHeroSlideshow() call per page below.
═══════════════════════════════════════════════ */
function initNamedHeroSlideshow(rootId, dotsId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  const slides = root.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll(`#${dotsId} .hero-dot`);
  if (slides.length < 2) return;

  let current = 0;
  const intervalMs = 6000;
  let timer = null;

  function goTo(index) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  }
  function next() { goTo((current + 1) % slides.length); }
  function start() { stop(); if (!REDUCED_MOTION) timer = setInterval(next, intervalMs); }
  function stop() { if (timer) clearInterval(timer); }

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-index'), 10);
      if (!isNaN(idx) && idx !== current) { goTo(idx); start(); }
    });
  });

  goTo(0);
  start();
}

function initHeroSlideshows() {
  initNamedHeroSlideshow('pathfinders-hero-slideshow', 'pathfinders-hero-dots');
  // Add matching lines here as AY / Adventurers get their own hero slideshows:
  // initNamedHeroSlideshow('ay-hero-slideshow', 'ay-hero-dots');
  // initNamedHeroSlideshow('adventurers-hero-slideshow', 'adventurers-hero-dots');
}


/* ═══════════════════════════════════════════════
   §16c. GENERIC IN-PAGE SLIDESHOWS — [data-slideshow]
   Crossfade image carousels inside content sections
   (e.g. the Honors section on pathfinders.html).
═══════════════════════════════════════════════ */
function initGenericSlideshows() {
  document.querySelectorAll('[data-slideshow]').forEach(wrap => {
    if (wrap.dataset.slideshowWired) return;
    wrap.dataset.slideshowWired = '1';

    const slides = wrap.querySelectorAll('.slide');
    const dots = wrap.querySelectorAll('.slide-dot');
    if (slides.length < 2) return;

    let current = 0;
    const INTERVAL = 4500;
    let timer;

    function goTo(index) {
      slides[current].classList.remove('opacity-100');
      slides[current].classList.add('opacity-0');
      if (dots[current]) { dots[current].classList.remove('bg-white', 'w-5'); dots[current].classList.add('bg-white/50', 'w-2'); }

      current = index;

      slides[current].classList.remove('opacity-0');
      slides[current].classList.add('opacity-100');
      if (dots[current]) { dots[current].classList.remove('bg-white/50', 'w-2'); dots[current].classList.add('bg-white', 'w-5'); }
    }
    function next() { goTo((current + 1) % slides.length); }
    function restart() { clearInterval(timer); if (!REDUCED_MOTION) timer = setInterval(next, INTERVAL); }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => { goTo(i); restart(); });
    });

    goTo(0);
    restart();
  });
}

/* ── Contact Us: collapsed dropdown toggle ── */
function initContactToggle() {
  const btn  = document.getElementById('contact-toggle-btn');
  const list = document.getElementById('contact-call-list');
  if (!btn || !list) return;

  btn.addEventListener('click', function () {
    const isOpen = list.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

document.addEventListener('DOMContentLoaded', initContactToggle);