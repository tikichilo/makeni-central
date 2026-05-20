/**
 * sda.js — Makeni Central SDA Church  v3
 * UI motion, interactions & enhancements
 *
 * CHANGES vs v2:
 *  §12 Discussion cards — expand/collapse shim removed; youth.html owns its own
 *              toggleExpand() helper via inline script. sda.js no longer touches
 *              .line-clamp-2 cards at all.
 *  NEW §16 — Youth Board page logic (initYouthBoard). Runs only when
 *              document.body.dataset.page === 'youth'. Owns:
 *                • Filter buttons (aria-pressed + show/hide cards + empty state)
 *                • Like buttons (toggle fill + count)
 *                • Read-more / show-less (toggleExpand exposed on window)
 *                • "Start a Discussion" modal (open/close/submit/card injection)
 *                • Char counters for title + body fields
 *                • Dynamic footer year
 *              All other §§ are unchanged from v2.
 */

'use strict';


/* ═══════════════════════════════════════════════
   SHARED GUARD — run after DOM is ready
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);

function init() {
  initNavbar();
  initScrollReveal();
  initHero();
  initCounters();
  initGiveButton();
  initPageTransitions();
  initGoldDividers();
  initToast();
  initCopyEmail();
  initBackToTop();
  initImageShimmer();
  initActiveNav();
  initYouthBoard();   // §16 — no-op on non-youth pages

  console.log(
    '%c✦ Makeni Central SDA — sda.js v3 loaded',
    'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;'
  );
}


/* ═══════════════════════════════════════════════
   1. NAVBAR — scroll shrink / hide-on-scroll
═══════════════════════════════════════════════ */
function initNavbar() {
  const header = document.querySelector('header');
  if (!header) return;

  header.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1), box-shadow 0.3s ease, border-color 0.3s ease';

  let lastScroll = 0;
  let drawerOpen = false;

  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    const mo = new MutationObserver(() => {
      drawerOpen = drawer.classList.contains('open');
    });
    mo.observe(drawer, { attributes: true, attributeFilter: ['class'] });
  }

  window.addEventListener('scroll', () => {
    if (drawerOpen) return;
    const y = window.scrollY;

    if (y > 60) {
      header.style.boxShadow         = '0 4px 24px rgba(4,21,52,0.12)';
      header.style.borderBottomColor = '#e6c364';
    } else {
      header.style.boxShadow         = '';
      header.style.borderBottomColor = '';
    }

    if (y > lastScroll + 8 && y > 120) {
      header.style.transform = 'translateY(-100%)';
    } else if (y < lastScroll - 4) {
      header.style.transform = 'translateY(0)';
    }
    lastScroll = y;
  }, { passive: true });
}


/* ═══════════════════════════════════════════════
   2. SCROLL-REVEAL
═══════════════════════════════════════════════ */
function initScrollReveal() {
  const style = document.createElement('style');
  style.textContent = `
    [data-reveal] {
      opacity: 0;
      transform: translateY(32px);
      transition: opacity 0.65s cubic-bezier(.4,0,.2,1), transform 0.65s cubic-bezier(.4,0,.2,1);
    }
    [data-reveal].revealed { opacity: 1; transform: translateY(0); }
    [data-reveal="left"]  { transform: translateX(-32px); }
    [data-reveal="right"] { transform: translateX(32px); }
    [data-reveal="scale"] { transform: scale(0.92); }
    [data-reveal="left"].revealed,
    [data-reveal="right"].revealed,
    [data-reveal="scale"].revealed { transform: none; opacity: 1; }
  `;
  document.head.appendChild(style);

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
      if (el.closest('header') || el.closest('footer'))   return;
      if (heroSection && heroSection.contains(el))         return;
      if (el.classList.contains('hero-animate'))           return;
      if (el.hasAttribute('data-reveal'))                  return;
      el.setAttribute('data-reveal', 'up');
      el.style.transitionDelay = `${Math.min(i * 50, 300)}ms`;
    });
  });

  document.querySelectorAll('.grid .rounded-xl:not(header .rounded-xl):not(footer .rounded-xl)').forEach((el, i) => {
    if (el.closest('header') || el.closest('footer'))     return;
    if (heroSection && heroSection.contains(el))           return;
    if (el.hasAttribute('data-reveal'))                    return;
    el.setAttribute('data-reveal', 'up');
    el.style.transitionDelay = `${i * 80}ms`;
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}


/* ═══════════════════════════════════════════════
   3. HERO — entrance animation + parallax
═══════════════════════════════════════════════ */
function initHero() {
  const hero = document.querySelector('section:first-of-type');
  if (!hero) return;

  const heroTitle = hero.querySelector('h1, h2');
  const heroSub   = hero.querySelector('p');
  const heroBtns  = [...hero.querySelectorAll('button, a[class*="bg-primary"]')];

  const s = document.createElement('style');
  s.textContent = `
    @keyframes heroFadeUp {
      from { opacity: 0; transform: translateY(40px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .hero-animate {
      animation: heroFadeUp 0.9s cubic-bezier(.4,0,.2,1) both;
    }
  `;
  document.head.appendChild(s);

  [heroTitle, heroSub, ...heroBtns].forEach((el, i) => {
    if (!el) return;
    el.classList.add('hero-animate');
    el.style.animationDelay = `${0.2 + i * 0.15}s`;
  });

  const parallaxTarget = hero.querySelector('img') || hero.querySelector('[style*="background-image"]');
  if (parallaxTarget) {
    window.addEventListener('scroll', () => {
      parallaxTarget.style.transform = `translateY(${window.scrollY * 0.22}px)`;
    }, { passive: true });
  }
}


/* ═══════════════════════════════════════════════
   4. ANIMATED COUNTERS
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

    function step(now) {
      const t   = Math.min((now - start) / 1800, 1);
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
    if (el.dataset.func && el.dataset.func.startsWith('fund-'))  return;
    if (el.dataset.counterWired)                                  return;
    el.dataset.counterWired = '1';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { animateCount(el); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}


/* ═══════════════════════════════════════════════
   5. GIVE BUTTON + MODAL
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
  `;
  document.head.appendChild(rippleStyle);

  // Ripple on all buttons
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
      window.SDAToast && window.SDAToast('Please select or enter an amount.', 'error');
      return;
    }
    const submitBtn = modal.querySelector('.give-submit');
    submitBtn.textContent = 'Processing…';
    submitBtn.disabled    = true;
    if (typeof apiPost === 'function') await apiPost('/donate', { amount, currency: 'ZMW' });
    modal.querySelector('#give-thanks').style.display = 'block';
    submitBtn.style.display = 'none';
    window.SDAToast && window.SDAToast('🙏 Gift recorded — thank you!', 'success', 4000);
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

  document.querySelectorAll('.desktop-give, .mobile-give, .mobile-give-btn, button').forEach(btn => {
    if (btn.dataset.giveWired) return;
    const text   = btn.textContent.trim().toLowerCase();
    const isGive = btn.classList.contains('desktop-give')
                || btn.classList.contains('mobile-give')
                || btn.classList.contains('mobile-give-btn')
                || text === 'give';
    if (!isGive) return;
    btn.dataset.giveWired = '1';
    btn.addEventListener('click', openGiveModal);
  });
}


/* ═══════════════════════════════════════════════
   8. SMOOTH PAGE TRANSITIONS
═══════════════════════════════════════════════ */
function initPageTransitions() {
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
   9. GOLD DIVIDERS
═══════════════════════════════════════════════ */
function initGoldDividers() {
  document.querySelectorAll('.gold-divider').forEach(el => {
    el.style.width      = '0px';
    el.style.transition = 'width 0.8s cubic-bezier(.4,0,.2,1)';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { el.style.width = '60px'; obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}


/* ═══════════════════════════════════════════════
   10. TOAST
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
      pointer-events:all;white-space:nowrap;
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
   11. COPY EMAIL
═══════════════════════════════════════════════ */
function initCopyEmail() {
  document.querySelectorAll('p, a').forEach(el => {
    if (!el.textContent.includes('@makenicentralsda.org')) return;
    el.style.cursor = 'pointer';
    el.title = 'Click to copy email';
    el.addEventListener('click', () => {
      navigator.clipboard?.writeText('info@makenicentralsda.org').then(() => {
        window.SDAToast('✉ Email copied!', 'success');
      }).catch(() => {
        window.SDAToast('Could not copy — please copy manually.', 'error');
      });
    });
  });
}


/* ═══════════════════════════════════════════════
   13. BACK-TO-TOP
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
    const visible         = window.scrollY > 400;
    btn.style.opacity     = visible ? '1' : '0';
    btn.style.pointerEvents = visible ? 'auto' : 'none';
  }, { passive: true });

  btn.addEventListener('click',      () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
}


/* ═══════════════════════════════════════════════
   14. IMAGE SHIMMER
═══════════════════════════════════════════════ */
function initImageShimmer() {
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

  document.querySelectorAll('img[loading="lazy"]').forEach(img => {
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
   15. ACTIVE NAV LINK HIGHLIGHTER
═══════════════════════════════════════════════ */
function initActiveNav() {
  const page = document.body.dataset.page || '';
  const map  = { index: 'index.html', kids: 'kids.html', youth: 'youth.html', building: 'building.html' };
  const current = map[page];
  if (!current) return;

  document.querySelectorAll('header nav a').forEach(a => {
    const href     = a.getAttribute('href');
    const isActive = href === '#' || (current && href === current);
    if (isActive) {
      a.classList.add('text-primary', 'border-b-2', 'border-secondary', 'pb-1');
      a.classList.remove('text-on-surface-variant');
    }
  });
}


/* ═══════════════════════════════════════════════
   16. YOUTH BOARD
       Only runs on data-page="youth".
       Owns: filters, likes, read-more toggle,
       discussion modal (open/close/submit/inject).
═══════════════════════════════════════════════ */
function initYouthBoard() {
  if (document.body.dataset.page !== 'youth') return;

  /* ── Dynamic footer year ── */
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ── Filter buttons ── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      document.querySelectorAll('.filter-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');

      const cards = document.querySelectorAll('#discussions-list article[data-category]');
      let anyVisible = false;
      cards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });

      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.toggle('hidden', anyVisible);
    });
  });

  /* ── Like buttons (wire existing + expose helper for injected cards) ── */
  function wireLikeBtn(btn) {
    if (btn.dataset.likeWired) return;
    btn.dataset.likeWired = '1';
    let liked = false;
    btn.addEventListener('click', () => {
      liked = !liked;
      let count = parseInt(btn.dataset.count) || 0;
      count = liked ? count + 1 : count - 1;
      btn.dataset.count = count;
      const countEl = btn.querySelector('.like-count');
      if (countEl) countEl.textContent = count + ' Likes';
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.style.fontVariationSettings = liked ? "'FILL' 1" : "'FILL' 0";
      btn.style.color = liked ? '#ba1a1a' : '';
    });
  }
  document.querySelectorAll('.like-btn').forEach(wireLikeBtn);

  /* ── Read-more toggle (exposed on window for onclick="" in HTML) ── */
  window.toggleExpand = function(id, btn) {
    const el          = document.getElementById(id);
    if (!el) return;
    const isCollapsed = el.style.webkitLineClamp !== 'unset' && el.style.webkitLineClamp !== '';
    if (isCollapsed) {
      el.style.webkitLineClamp = 'unset';
      el.style.overflow        = 'visible';
      btn.textContent          = 'Show less';
    } else {
      el.style.webkitLineClamp = '2';
      el.style.overflow        = 'hidden';
      btn.textContent          = 'Read more';
    }
  };

  /* ── Discussion modal ── */
  const discModal = document.getElementById('discussion-modal');
  if (!discModal) return;

  window.openModal = function() {
    document.getElementById('modal-form-view').style.display = '';
    document.getElementById('modal-success-view').classList.remove('show');
    discModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const nameField = document.getElementById('disc-name');
      if (nameField) nameField.focus();
    }, 300);
  };

  window.closeModal = function() {
    discModal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
      ['disc-name', 'disc-title', 'disc-body'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const cat = document.getElementById('disc-category');
      if (cat) cat.value = '';
      const tc = document.getElementById('title-count'); if (tc) tc.textContent = '0 / 100';
      const bc = document.getElementById('body-count');  if (bc) bc.textContent = '0 / 1000';
      document.getElementById('modal-success-view').classList.remove('show');
      document.getElementById('modal-form-view').style.display = '';
    }, 300);
  };

  // Escape key + backdrop
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && discModal.classList.contains('open')) window.closeModal();
  });
  const backdrop = discModal.querySelector('.modal-backdrop');
  if (backdrop) backdrop.addEventListener('click', window.closeModal);

  // Char counters
  const titleField = document.getElementById('disc-title');
  const bodyField  = document.getElementById('disc-body');
  if (titleField) {
    titleField.addEventListener('input', function() {
      const len = this.value.length;
      const el  = document.getElementById('title-count');
      if (!el) return;
      el.textContent = len + ' / 100';
      el.classList.toggle('near-limit', len > 80);
    });
  }
  if (bodyField) {
    bodyField.addEventListener('input', function() {
      const len = this.value.length;
      const el  = document.getElementById('body-count');
      if (!el) return;
      el.textContent = len + ' / 1000';
      el.classList.toggle('near-limit', len > 850);
    });
  }

  // Submit
  window.submitDiscussion = function() {
    const name     = (document.getElementById('disc-name')?.value     || '').trim();
    const category = (document.getElementById('disc-category')?.value || '').trim();
    const title    = (document.getElementById('disc-title')?.value    || '').trim();
    const body     = (document.getElementById('disc-body')?.value     || '').trim();

    const fields = [
      { id: 'disc-name',     val: name },
      { id: 'disc-category', val: category },
      { id: 'disc-title',    val: title },
      { id: 'disc-body',     val: body },
    ];

    let valid = true;
    fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (!el) return;
      if (!f.val) {
        valid = false;
        el.style.borderColor = '#ba1a1a';
        el.style.boxShadow   = '0 0 0 3px rgba(186,26,26,0.12)';
        el.addEventListener('input', () => {
          el.style.borderColor = '';
          el.style.boxShadow   = '';
        }, { once: true });
      }
    });
    if (!valid) return;

    // Sanitise for innerHTML injection
    function esc(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const newCard  = document.createElement('article');
    newCard.className    = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
    newCard.dataset.category = category;
    newCard.style.cssText    = 'opacity:0;transform:translateY(-12px);transition:opacity 0.35s ease,transform 0.35s ease;';

    newCard.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container flex-shrink-0"
             aria-label="${esc(name)}">${esc(initials)}</div>
        <div>
          <h4 class="font-label-md text-label-md text-primary">${esc(name)}</h4>
          <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">Just now</p>
        </div>
      </div>
      <span class="card-category">${esc(category)}</span>
      <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${esc(title)}</h3>
      <p class="font-body-md text-body-md text-on-surface-variant mb-6">${esc(body)}</p>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2 text-on-surface-variant">
          <span class="material-symbols-outlined text-[20px]">forum</span>
          <span class="font-label-md">0 Comments</span>
        </div>
        <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
                aria-label="Like this post" data-count="0">
          <span class="material-symbols-outlined text-[20px]">favorite</span>
          <span class="font-label-md like-count">0 Likes</span>
        </button>
      </div>`;

    wireLikeBtn(newCard.querySelector('.like-btn'));

    const list = document.getElementById('discussions-list');
    if (list) list.insertBefore(newCard, list.firstChild);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      newCard.style.opacity   = '1';
      newCard.style.transform = 'translateY(0)';
    }));

    document.getElementById('modal-form-view').style.display = 'none';
    document.getElementById('modal-success-view').classList.add('show');
  };

  /* ── FAB wiring (in case onclick attr not present) ── */
  const fab = document.getElementById('fab-new-discussion');
  if (fab && !fab.dataset.youthWired) {
    fab.dataset.youthWired = '1';
    fab.addEventListener('click', window.openModal);
  }
}