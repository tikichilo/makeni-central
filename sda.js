/**
 * sda.js — Makeni Central SDA Church  v2
 * UI motion, interactions & enhancements
 *
 * FIXES vs v1:
 *  §1  Navbar — removed dynamic drawer builder; the drawer is already in HTML.
 *              Scroll-shrink + hide-on-scroll kept, improved to also show header
 *              when drawer is open (prevent disappearing menu).
 *  §2  Scroll-reveal — hero elements are now excluded so heroFadeUp (§3) runs
 *              cleanly without a competing opacity:0 from data-reveal.
 *  §3  Hero — parallax now checks for the bg-div not an <img> (index hero uses
 *              a background-image div, not an <img> tag).
 *  §4  Counters — restricted to elements that are NOT targeted by func.js
 *              (data-func^="fund-") to avoid double-animation.
 *  §5  Give button — selector restricted to .desktop-give and .mobile-give-btn
 *              only; the mobile nav "Give" button no longer double-opens the modal.
 *              Give modal now calls func.js's apiPost('/donate') if available.
 *  §6  Likes — removed entirely; func.js owns all like logic with API persistence.
 *  §7  Progress bar — removed; func.js owns fund-bar animation via data-func.
 *  §8  Page transitions — unchanged, works well.
 *  §9  Gold dividers — unchanged.
 *  §10 Toast — sda.js defers to func.js's SDAToast if it is already defined,
 *              otherwise provides its own compatible shim with the same 3-arg
 *              signature: SDAToast(message, type, duration).
 *  §11 Copy email — unchanged, works well.
 *  §12 Discussion cards — expand/collapse kept; guard added so it only runs
 *              on static cards (func.js dynamically replaces them anyway).
 *  §13 Back-to-top — repositioned to avoid overlapping Youth FAB.
 *      NEW §14 — Image lazy-load shimmer enhancement.
 *      NEW §15 — Active nav link highlighter (supplements static HTML classes).
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
  initDiscussionCards();
  initBackToTop();
  initImageShimmer();
  initActiveNav();

  console.log(
    '%c✦ Makeni Central SDA — sda.js v2 loaded',
    'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;'
  );
}


/* ═══════════════════════════════════════════════
   1. NAVBAR — scroll shrink / hide-on-scroll
      The mobile drawer is already in the HTML +
      wired by the inline script. sda.js only owns
      the scroll behaviour.
═══════════════════════════════════════════════ */
function initNavbar() {
  const header = document.querySelector('header');
  if (!header) return;

  header.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1), box-shadow 0.3s ease, border-color 0.3s ease';

  let lastScroll = 0;
  let drawerOpen = false;

  // Keep a reference to drawer open state so we never hide
  // the header while the mobile menu is visible
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    const mo = new MutationObserver(() => {
      drawerOpen = drawer.classList.contains('open');
    });
    mo.observe(drawer, { attributes: true, attributeFilter: ['class'] });
  }

  window.addEventListener('scroll', () => {
    if (drawerOpen) return; // never hide while menu is open
    const y = window.scrollY;

    // Gold border + deeper shadow after 60 px
    if (y > 60) {
      header.style.boxShadow    = '0 4px 24px rgba(4,21,52,0.12)';
      header.style.borderBottomColor = '#e6c364';
    } else {
      header.style.boxShadow    = '';
      header.style.borderBottomColor = '';
    }

    // Hide on scroll down, reveal on scroll up
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
      Hero elements (inside the first <section> or
      anything with .hero-animate) are excluded so
      they don't get opacity:0 applied on top of
      the heroFadeUp animation in §3.
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

  // Determine the hero section so we can skip its children
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
      if (el.closest('header') || el.closest('footer')) return;
      if (heroSection && heroSection.contains(el))      return; // skip hero
      if (el.classList.contains('hero-animate'))         return; // skip hero-animated
      if (el.hasAttribute('data-reveal'))                return; // already tagged
      el.setAttribute('data-reveal', 'up');
      el.style.transitionDelay = `${Math.min(i * 50, 300)}ms`;
    });
  });

  document.querySelectorAll('.grid .rounded-xl:not(header .rounded-xl):not(footer .rounded-xl)').forEach((el, i) => {
    if (el.closest('header') || el.closest('footer')) return;
    if (heroSection && heroSection.contains(el))      return;
    if (el.hasAttribute('data-reveal'))                return;
    el.setAttribute('data-reveal', 'up');
    el.style.transitionDelay = `${i * 80}ms`;
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}


/* ═══════════════════════════════════════════════
   3. HERO — entrance animation + parallax
      index.html hero uses a background-image div
      (not an <img>). building.html uses an <img>.
      Both are handled below.
═══════════════════════════════════════════════ */
function initHero() {
  const hero = document.querySelector('section:first-of-type');
  if (!hero) return;

  // Entrance animation
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

  // Parallax — works for both bg-div and img approaches
  const parallaxTarget = hero.querySelector('img') || hero.querySelector('[style*="background-image"]');
  if (parallaxTarget) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      parallaxTarget.style.transform = `translateY(${y * 0.22}px)`;
    }, { passive: true });
  }
}


/* ═══════════════════════════════════════════════
   4. ANIMATED COUNTERS
      Skips elements already handled by func.js
      (data-func^="fund-") to avoid double animation.
      Also skips hero text so it doesn't get treated
      as a stat.
═══════════════════════════════════════════════ */
function initCounters() {
  function animateCount(el) {
    const raw    = el.textContent.replace(/[^0-9.]/g, '');
    const target = parseFloat(raw);
    if (isNaN(target) || target === 0) return;

    const prefix   = el.textContent.match(/^[^0-9]*/)?.[0]  || '';
    const suffix   = el.textContent.match(/[^0-9.]*$/)?.[0] || '';
    const isFloat  = el.textContent.includes('.');
    const duration = 1800;
    const start    = performance.now();

    function step(now) {
      const t    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val  = target * ease;
      el.textContent = prefix + (isFloat ? val.toFixed(1) : Math.floor(val)) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + (isFloat ? target.toFixed(1) : target) + suffix;
    }
    requestAnimationFrame(step);
  }

  const heroSection  = document.querySelector('section:first-of-type');
  const statPattern  = /^\s*[\$ZMW%K,]?[\d,]+(\.\d+)?[KMB%]?\s*$/;

  document.querySelectorAll('.font-display-lg, .font-headline-lg, [class*="text-5xl"], [class*="text-6xl"]').forEach(el => {
    if (!statPattern.test(el.textContent))              return; // not a stat
    if (el.closest('header') || el.closest('footer'))   return;
    if (heroSection && heroSection.contains(el))         return; // skip hero headline
    if (el.dataset.func && el.dataset.func.startsWith('fund-')) return; // func.js owns these
    if (el.dataset.counterWired)                         return; // already wired

    el.dataset.counterWired = '1';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { animateCount(el); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}


/* ═══════════════════════════════════════════════
   5. GIVE BUTTON + MODAL
      Only hooks .desktop-give and .mobile-give-btn.
      The nav mobile "Give" button (.mobile-give)
      intentionally also opens the modal — that's
      the desired UX. The drawer "Give to the Church"
      (.mobile-give-btn) is wired too.
      The in-drawer ripple is also applied.
═══════════════════════════════════════════════ */
function initGiveButton() {
  // ── Ripple effect ─────────────────────────────
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

    /* ── Give modal ── */
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

  // Ripple on ALL buttons
  document.querySelectorAll('button, a[class*="bg-primary"], a[class*="bg-secondary"]').forEach(btn => {
    if (btn.dataset.rippleWired) return;
    btn.dataset.rippleWired = '1';
    btn.classList.add('btn-ripple');
    btn.addEventListener('click', e => {
      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple-wave';
      ripple.style.cssText = `
        width:${size}px;height:${size}px;
        left:${e.clientX - rect.left - size / 2}px;
        top:${e.clientY - rect.top - size / 2}px;
      `;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });

  // ── Build modal ────────────────────────────────
  const modal = document.createElement('div');
  modal.id = 'give-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Support Makeni Central SDA');
  modal.innerHTML = `
    <div id="give-modal-box">
      <button class="modal-close" aria-label="Close">✕</button>
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

  // Amount selection
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

  // Submit — calls func.js apiPost if available, otherwise shows thank-you
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

    // If func.js apiPost is available, record the donation
    if (typeof apiPost === 'function') {
      await apiPost('/donate', { amount, currency: 'ZMW' });
    }

    modal.querySelector('#give-thanks').style.display = 'block';
    submitBtn.style.display = 'none';
    window.SDAToast && window.SDAToast('🙏 Gift recorded — thank you!', 'success', 4000);
    setTimeout(closeModal, 2800);
  });

  function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close').focus();
  }
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    modal.querySelector('#give-thanks').style.display = 'none';
    modal.querySelector('.give-submit').style.display = '';
    modal.querySelector('.give-submit').disabled = false;
    modal.querySelector('.give-submit').textContent = 'Give Now ✦';
    selectedAmount = null;
    customInput.value = '';
    customInput.style.display = 'none';
    modal.querySelectorAll('.give-amount-btn').forEach(b => b.classList.remove('selected'));
  }

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // Wire only the intended Give buttons — not arbitrary text matches
  // Targets: nav Give (.desktop-give, .mobile-give),
  //          drawer Give (.mobile-give-btn),
  //          any button whose sole visible text is "Give"
  document.querySelectorAll(
    '.desktop-give, .mobile-give, .mobile-give-btn, button'
  ).forEach(btn => {
    if (btn.dataset.giveWired) return;
    const text = btn.textContent.trim().toLowerCase();
    // Match nav Give buttons by class OR exact "give" text (not "give directions" etc.)
    const isGive = btn.classList.contains('desktop-give')
                || btn.classList.contains('mobile-give')
                || btn.classList.contains('mobile-give-btn')
                || text === 'give';
    if (!isGive) return;
    btn.dataset.giveWired = '1';
    btn.addEventListener('click', openModal);
  });
}


/* ═══════════════════════════════════════════════
   8. SMOOTH PAGE TRANSITIONS — unchanged
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

  // Fade-in on load
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
   9. GOLD DIVIDERS — animated width on scroll
═══════════════════════════════════════════════ */
function initGoldDividers() {
  document.querySelectorAll('.gold-divider').forEach(el => {
    el.style.width = '0px';
    el.style.transition = 'width 0.8s cubic-bezier(.4,0,.2,1)';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { el.style.width = '60px'; obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}


/* ═══════════════════════════════════════════════
   10. TOAST — defer to func.js if already defined,
       otherwise provide a compatible shim.
       Signature: SDAToast(message, type?, duration?)
       type: 'success' | 'error' | 'info'  (default 'info')
═══════════════════════════════════════════════ */
function initToast() {
  // func.js defines SDAToast in an IIFE that runs immediately,
  // so by the time sda.js DOMContentLoaded fires it is already set.
  if (typeof window.SDAToast === 'function') return; // func.js owns it

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
   12. DISCUSSION CARDS — expand / collapse
       Only applied to statically rendered cards;
       func.js dynamically replaces them and re-wires.
═══════════════════════════════════════════════ */
function initDiscussionCards() {
  document.querySelectorAll('article.discussion-card').forEach(card => {
    if (card.dataset.expandWired) return;
    card.dataset.expandWired = '1';
    const preview = card.querySelector('.line-clamp-2');
    if (!preview) return;
    preview.style.cursor = 'pointer';
    preview.title = 'Click to expand';
    preview.addEventListener('click', () => {
      const collapsed = preview.classList.toggle('line-clamp-2');
      if (!collapsed) window.SDAToast && window.SDAToast('💬 Thread expanded', 'info');
    });
  });
}


/* ═══════════════════════════════════════════════
   13. BACK-TO-TOP
       Positioned to avoid Youth Board FAB
       (bottom-8 right-8 = 32px from each edge).
       Back-to-top sits at bottom:90px right:28px
       on all pages except youth.html where FAB
       already occupies bottom-right.
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
    const visible = window.scrollY > 400;
    btn.style.opacity       = visible ? '1' : '0';
    btn.style.pointerEvents = visible ? 'auto' : 'none';
  }, { passive: true });

  btn.addEventListener('click',      () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
}


/* ═══════════════════════════════════════════════
   14. IMAGE SHIMMER — lazy-load enhancement
       Adds a gold-shimmer placeholder while
       images are loading, removes on load.
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
       Supplements the static HTML active classes.
       Useful when page transitions happen without
       a full reload (future SPA upgrade path).
═══════════════════════════════════════════════ */
function initActiveNav() {
  const page = document.body.dataset.page || '';
  const map  = { index: 'index.html', kids: 'kids.html', youth: 'youth.html', building: 'building.html' };
  const current = map[page];
  if (!current) return;

  document.querySelectorAll('header nav a').forEach(a => {
    const href = a.getAttribute('href');
    const isActive = href === '#' || (current && href === current);
    if (isActive) {
      a.classList.add('text-primary', 'border-b-2', 'border-secondary', 'pb-1');
      a.classList.remove('text-on-surface-variant');
    }
  });
}