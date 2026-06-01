/**
 * func.js — Makeni Central SDA Church  v4
 * API-driven features: fund tracker, stories, youth board,
 * discussion modal, toast system, and shared API utilities.
 *
 * Division of responsibility (func.js owns):
 *  • SDAToast          — richer toast (installed before DOMContentLoaded;
 *                        sda.js §10 yields to it automatically)
 *  • apiPost           — shared fetch helper (used by sda.js Give modal)
 *  • Fund tracker      — [data-func="fund-*"] live data
 *  • Kids stories      — [data-func="stories"] carousel / grid
 *  • Youth board       — §16: filters, likes, read-more toggle,
 *                        "Start a Discussion" modal (open/close/submit/inject),
 *                        char counters, FAB wiring, dynamic footer year
 *
 * sda.js owns everything else (UI motion, navbar, hero, counters,
 * Give modal, scroll-reveal, back-to-top, image shimmer, active nav).
 *
 * CHANGES vs v3 (sda.js side — for reference):
 *  § Responsive fluid typography + mobile spacing now injected by sda.js §17.
 *  § @media (prefers-reduced-motion) respected throughout sda.js.
 *  § Hamburger / drawer wiring moved from inline page scripts into sda.js §1.
 *  § initYouthBoard moved here from sda.js (this file is the authoritative owner).
 */

'use strict';


/* ═══════════════════════════════════════════════
   TOAST — installed immediately (before DOM ready)
   so the Give modal in sda.js can always find it.
   sda.js §10 checks typeof window.SDAToast and
   skips its own simpler version if this is present.
═══════════════════════════════════════════════ */
(function installToast() {
  if (typeof window.SDAToast === 'function') return; // already installed

  const wrap = document.createElement('div');
  wrap.id = 'sda-toast-wrap';
  wrap.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    z-index:99990;display:flex;flex-direction:column;gap:10px;
    align-items:center;pointer-events:none;
  `;

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
    .sda-toast.show { opacity:1; transform:translateY(0); }
    .sda-toast.t-success { border-color:#4caf50; }
    .sda-toast.t-error   { border-color:#ba1a1a; background:#2d0a0a; }
  `;

  // Append once DOM exists
  function mount() {
    if (!document.getElementById('sda-toast-wrap')) {
      document.head.appendChild(s);
      document.body.appendChild(wrap);
    }
  }
  if (document.body) { mount(); }
  else { document.addEventListener('DOMContentLoaded', mount, { once: true }); }

  window.SDAToast = function(message, type = 'info', duration = 3000) {
    // Ensure mounted even if called very early
    if (!wrap.parentNode) mount();
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
})();


/* ═══════════════════════════════════════════════
   SHARED API HELPER
   Used by sda.js Give modal and any func.js feature
   that needs to POST JSON to the server.
═══════════════════════════════════════════════ */
async function apiPost(endpoint, payload) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[func.js] apiPost failed:', endpoint, err);
    return null;
  }
}


/* ═══════════════════════════════════════════════
   DOM-READY INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', funcInit);

function funcInit() {
  initHeroSlideshow(); // index.html
  initFundTracker();   // building.html
  initStories();       // kids.html
  initYouthBoard();    // §16 — youth.html only

  console.log(
    '%c✦ Makeni Central SDA — func.js v4 loaded',
    'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;'
  );
}


/* ═══════════════════════════════════════════════
   HERO SLIDESHOW — index.html
   Crossfades between hero-slide divs with Ken Burns
   per slide. Dots below allow manual navigation.
   Pauses on user interaction, resumes after 8 s.
═══════════════════════════════════════════════ */
function initHeroSlideshow() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.hero-dots .hero-dot');

  if (!slides.length) return;

  const INTERVAL  = 6000;  // ms between auto-advances
  const RESUME_DELAY = 8000; // ms before resuming after manual nav

  let current    = 0;
  let timer      = null;
  let resumeTimer = null;

  function goTo(index) {
    // Remove active/prev classes from current slide
    slides[current].classList.remove('active');
    slides[current].classList.add('prev');
    if (dots[current]) {
      dots[current].classList.remove('active');
      dots[current].setAttribute('aria-selected', 'false');
    }

    // After fade-out transition, remove 'prev'
    const leaving = slides[current];
    setTimeout(() => leaving.classList.remove('prev'), 1300);

    // Reset the Ken Burns animation on the incoming slide by toggling a class
    current = (index + slides.length) % slides.length;
    const incoming = slides[current];
    incoming.style.animation = 'none';
    incoming.offsetHeight; // reflow to restart animation
    incoming.style.animation = '';
    incoming.classList.add('active');

    if (dots[current]) {
      dots[current].classList.add('active');
      dots[current].setAttribute('aria-selected', 'true');
    }
  }

  function next() {
    goTo(current + 1);
  }

  function startAuto() {
    stopAuto();
    timer = setInterval(next, INTERVAL);
  }

  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // Dot click — manual navigation
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (i === current) return;
      stopAuto();
      clearTimeout(resumeTimer);
      goTo(i);
      resumeTimer = setTimeout(startAuto, RESUME_DELAY);
    });
  });

  // Pause on hover over the section
  const section = document.querySelector('[aria-label="Welcome hero"]');
  if (section) {
    section.addEventListener('mouseenter', stopAuto);
    section.addEventListener('mouseleave', startAuto);
  }

  // Keyboard nav (left/right arrows) when section is focused
  document.addEventListener('keydown', e => {
    if (!section) return;
    if (e.key === 'ArrowRight') { stopAuto(); goTo(current + 1); clearTimeout(resumeTimer); resumeTimer = setTimeout(startAuto, RESUME_DELAY); }
    if (e.key === 'ArrowLeft')  { stopAuto(); goTo(current - 1); clearTimeout(resumeTimer); resumeTimer = setTimeout(startAuto, RESUME_DELAY); }
  });

  // Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  startAuto();
}


/* ═══════════════════════════════════════════════
   FUND TRACKER — building.html
   Reads [data-func="fund-*"] elements and animates
   them to match the latest server data.
═══════════════════════════════════════════════ */
function initFundTracker() {
  const raised  = document.querySelector('[data-func="fund-raised"]');
  const goal    = document.querySelector('[data-func="fund-goal"]');
  const percent = document.querySelector('[data-func="fund-percent"]');
  const donors  = document.querySelector('[data-func="fund-donors"]');
  const bar     = document.querySelector('[data-func="fund-bar"]');

  if (!raised && !goal && !percent && !donors && !bar) return;

  // Animate a numeric element from 0 to target
  function animateValue(el, target, prefix, suffix, isFloat) {
    if (!el) return;
    const start = performance.now();
    const dur   = 1800;
    function step(now) {
      const t   = Math.min((now - start) / dur, 1);
      const val = target * (1 - Math.pow(1 - t, 3));
      el.textContent = prefix + (isFloat ? val.toFixed(1) : Math.floor(val).toLocaleString()) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + (isFloat ? target.toFixed(1) : target.toLocaleString()) + suffix;
    }
    requestAnimationFrame(step);
  }

  // Wire up with IntersectionObserver so animation plays on scroll-into-view
  function observeOnce(el, cb) {
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { cb(); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  }

  // Fetch live data — gracefully falls back to HTML values if fetch fails
  fetch('/api/fund')
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .then(data => {
      if (!data) return; // keep static HTML values

      const raisedVal  = Number(data.raised)  || 0;
      const goalVal    = Number(data.goal)     || 0;
      const donorsVal  = Number(data.donors)   || 0;
      const pct        = goalVal ? Math.min(Math.round((raisedVal / goalVal) * 100), 100) : 0;

      observeOnce(raised,  () => animateValue(raised,  raisedVal,  'ZMW ', '', false));
      observeOnce(goal,    () => animateValue(goal,    goalVal,    'ZMW ', '', false));
      observeOnce(percent, () => animateValue(percent, pct,        '',    '%', false));
      observeOnce(donors,  () => animateValue(donors,  donorsVal,  '',    '', false));

      if (bar) {
        observeOnce(bar, () => {
          bar.style.width = `${pct}%`;
          bar.setAttribute('aria-valuenow', pct);
        });
      }
    });
}


/* ═══════════════════════════════════════════════
   STORIES — kids.html
   [data-func="stories"] container: wires up
   a simple prev/next carousel if navigation
   arrows are present, otherwise does nothing
   (grid layout works without JS).
═══════════════════════════════════════════════ */
function initStories() {
  const container = document.querySelector('[data-func="stories"]');
  if (!container) return;

  const prevBtn = container.querySelector('[data-stories-prev]');
  const nextBtn = container.querySelector('[data-stories-next]');
  const track   = container.querySelector('[data-stories-track]');

  if (!prevBtn || !nextBtn || !track) return; // no carousel UI — grid mode

  const cards      = [...track.children];
  const cardCount  = cards.length;
  let   current    = 0;

  function goTo(index) {
    current = (index + cardCount) % cardCount;
    track.style.transform = `translateX(-${current * 100}%)`;
    prevBtn.setAttribute('aria-disabled', current === 0 ? 'true' : 'false');
    nextBtn.setAttribute('aria-disabled', current === cardCount - 1 ? 'true' : 'false');
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  // Keyboard arrow support
  container.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  });

  goTo(0); // initialise
}


/* ═══════════════════════════════════════════════
   §16. YOUTH BOARD — youth.html only
   Owns: filters, likes, read-more toggle,
   "Start a Discussion" modal (open/close/submit/inject),
   char counters, FAB wiring, dynamic footer year.
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

  // Submit — also posts to API if available
  window.submitDiscussion = async function() {
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

    // POST to server (fire-and-forget; UI responds immediately)
    apiPost('/api/discussions', { name, category, title, body });

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