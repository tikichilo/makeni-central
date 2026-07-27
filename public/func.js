/**
 * func.js — Makeni Central SDA Church  v4.4
 * API-driven features: fund tracker, stories, youth board,
 * discussion modal, leaders grid, toast system, and shared
 * API utilities.
 *
 * Division of responsibility (func.js owns):
 *  • SDAToast          — richer toast (installed before DOMContentLoaded;
 *                        sda.js §10 yields to it automatically)
 *  • apiPost           — shared fetch helper (used by sda.js Give modal)
 *  • Fund tracker      — [data-func="fund-*"] live data
 *  • Kids stories      — [data-func="stories"] carousel / grid
 *  • Leaders grid      — [data-func="leaders"] on leaders.html:
 *                        fetches /api/leaders, renders cards, owns the
 *                        department filter pills
 *  • Youth board       — §16: filters, likes, read-more toggle,
 *                        "Start a Discussion" modal (open/close/submit/inject),
 *                        char counters, FAB wiring, dynamic footer year,
 *                        comment threads (view/add) per discussion
 *
 * sda.js owns everything else (UI motion, navbar, hero, counters,
 * Give modal, scroll-reveal, back-to-top, image shimmer, active nav,
 * dropdown nav, mobile accordion).
 *
 * CHANGES v4.3 → v4.4 (bugfix pass):
 *  § Filter pills — FIXED. The "FILTER BY" buttons in youth.html now
 *    carry the `.filter-btn` class the click handler was already
 *    looking for (it previously matched nothing, so the pills did not
 *    do anything). The handler now also swaps the active/inactive
 *    Tailwind classes itself, instead of only flipping aria-pressed
 *    with no matching CSS — so the selected pill visibly highlights.
 *    The currently-active filter is now re-applied after
 *    loadDiscussions() swaps in the API-fetched cards, so a filter
 *    chosen while the board was still loading doesn't get lost.
 *  § submitDiscussion — FIXED. Previously always showed the "Discussion
 *    Posted!" success view even if the POST to /api/discussions failed
 *    (apiPost returning null), silently losing the post. Now checks
 *    result.success, disables the submit button while the request is
 *    in flight (via new #disc-submit-btn id in youth.html) to stop
 *    double-submits, shows a toast + re-enables the form on failure,
 *    and only shows success once the server actually confirms it.
 *    The freshly-posted card now also gets a working "Read more" link
 *    like every other card, instead of being permanently truncated.
 *  § footer-year — youth.html now has the #footer-year span the code
 *    was already trying to update, so the copyright year keeps itself
 *    current instead of silently no-op'ing.
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

  function mount() {
    if (!document.getElementById('sda-toast-wrap')) {
      document.head.appendChild(s);
      document.body.appendChild(wrap);
    }
  }
  if (document.body) { mount(); }
  else { document.addEventListener('DOMContentLoaded', mount, { once: true }); }

  window.SDAToast = function(message, type = 'info', duration = 3000) {
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

/* Shared HTML-escape helper — used by leaders grid + youth board */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Shared slugify helper — used by leaders grid to derive data-dept
   from a department name if the API doesn't supply a slug directly. */
function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* Shared "time ago" formatter — used by the discussion board and by
   the comments modal so both read the same relative time style. */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* Shared initials helper — "Chanda Mwale" -> "CM" */
function initialsOf(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* Comment-count button markup — used by the static cards in youth.html,
   loadDiscussions() (API-fetched cards), and submitDiscussion() (the
   freshly-posted card), so all three stay visually and behaviorally
   identical. `id` is '' for demo cards without a real discussion _id. */
function commentButtonHtml(id, title, count) {
  return `
    <button class="comment-count-btn flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
            data-id="${escHtml(id || '')}" data-title="${escHtml(title || '')}" aria-label="View comments">
      <span class="material-symbols-outlined text-[20px]">forum</span>
      <span class="font-label-md comment-count">${count || 0} Comments</span>
    </button>`;
}


/* ═══════════════════════════════════════════════
   DOM-READY INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', funcInit);

function funcInit() {
  initHeroSlideshow(); // index.html
  initFundTracker();   // building.html
  initStories();       // kids.html
  initLeadersGrid();   // leaders.html
  initYouthBoard();    // §16 — youth.html only

  console.log(
    '%c✦ Makeni Central SDA — func.js v4.4 loaded',
    'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;'
  );
}


/* ═══════════════════════════════════════════════
   HERO SLIDESHOW — index.html
   Slides are no longer hardcoded in the HTML. On load this fetches
   GET /api/hero-slideshow, which returns every image currently in
   public/slideshow/ (HEIC/HEIF included — the server converts those
   to JPEG) in a freshly randomized order. Drop photos into that
   folder and they show up here automatically, no HTML edits needed.
═══════════════════════════════════════════════ */
async function initHeroSlideshow() {
  const track    = document.getElementById('hero-slideshow');
  const dotsWrap = document.getElementById('hero-dots');
  const section  = document.querySelector('[aria-label="Welcome hero"]');
  if (!track) return;

  const FALLBACK_IMAGE = 'images/church.jpg'; // shown if the API is empty or fails
  const INTERVAL        = 6000;
  const RESUME_DELAY    = 8000;

  let images = [];
  try {
    const res  = await fetch('/api/hero-slideshow', { cache: 'no-store' });
    const data = res.ok ? await res.json() : null;
    images = Array.isArray(data && data.images) ? data.images : [];
  } catch (e) {
    console.warn('[hero] could not load slideshow images:', e);
  }
  if (!images.length) images = [FALLBACK_IMAGE];

  // Build one .hero-slide per image, and a matching dot, however
  // many came back.
  track.innerHTML = images.map(function (src, i) {
    return '<div class="hero-slide' + (i === 0 ? ' active' : '') + '" style="background-image:url(\'' + src + '\');"></div>';
  }).join('');

  if (dotsWrap) {
    dotsWrap.innerHTML = images.map(function (_, i) {
      return '<button class="hero-dot' + (i === 0 ? ' active' : '') + '" role="tab" aria-selected="' + (i === 0) + '" aria-label="Slide ' + (i + 1) + '"></button>';
    }).join('');
  }

  const slides = track.querySelectorAll('.hero-slide');
  const dots   = dotsWrap ? dotsWrap.querySelectorAll('.hero-dot') : [];
  if (!slides.length) return;

  // Preload every slide up front so rotating to it later never shows
  // a blank flash while the browser fetches it for the first time.
  images.forEach(function (src) {
    const img = new Image();
    img.src = src;
  });

  let current     = 0;
  let timer       = null;
  let resumeTimer = null;

  function goTo(index) {
    slides[current].classList.remove('active');
    slides[current].classList.add('prev');
    if (dots[current]) {
      dots[current].classList.remove('active');
      dots[current].setAttribute('aria-selected', 'false');
    }

    const leaving = slides[current];
    setTimeout(() => leaving.classList.remove('prev'), 1300);

    current = (index + slides.length) % slides.length;
    const incoming = slides[current];
    incoming.style.animation = 'none';
    incoming.offsetHeight;
    incoming.style.animation = '';
    incoming.classList.add('active');

    if (dots[current]) {
      dots[current].classList.add('active');
      dots[current].setAttribute('aria-selected', 'true');
    }
  }

  function next() { goTo(current + 1); }

  // No point auto-rotating a single slide (or hammering setInterval
  // if the folder ever ends up with just one photo in it).
  function startAuto() { stopAuto(); if (slides.length > 1) timer = setInterval(next, INTERVAL); }
  function stopAuto()  { if (timer) { clearInterval(timer); timer = null; } }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (i === current) return;
      stopAuto();
      clearTimeout(resumeTimer);
      goTo(i);
      resumeTimer = setTimeout(startAuto, RESUME_DELAY);
    });
  });

  if (section) {
    section.addEventListener('mouseenter', stopAuto);
    section.addEventListener('mouseleave', startAuto);
  }

  document.addEventListener('keydown', e => {
    if (!section) return;
    if (e.key === 'ArrowRight') { stopAuto(); goTo(current + 1); clearTimeout(resumeTimer); resumeTimer = setTimeout(startAuto, RESUME_DELAY); }
    if (e.key === 'ArrowLeft')  { stopAuto(); goTo(current - 1); clearTimeout(resumeTimer); resumeTimer = setTimeout(startAuto, RESUME_DELAY); }
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  startAuto();
}

/* ═══════════════════════════════════════════════
   FUND TRACKER — building.html
═══════════════════════════════════════════════ */
function initFundTracker() {
  const raised  = document.querySelector('[data-func="fund-raised"]');
  const goal    = document.querySelector('[data-func="fund-goal"]');
  const percent = document.querySelector('[data-func="fund-percent"]');
  const donors  = document.querySelector('[data-func="fund-donors"]');
  const bar     = document.querySelector('[data-func="fund-bar"]');

  if (!raised && !goal && !percent && !donors && !bar) return;

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

  function observeOnce(el, cb) {
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { cb(); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  }

  fetch('/api/fund')
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .then(data => {
      if (!data) return;

      const raisedVal = Number(data.raised) || 0;
      const goalVal   = Number(data.goal)   || 0;
      const donorsVal = Number(data.donors) || 0;
      const pct       = goalVal ? Math.min(Math.round((raisedVal / goalVal) * 100), 100) : 0;

      observeOnce(raised,  () => animateValue(raised,  raisedVal, 'ZMW ', '', false));
      observeOnce(goal,    () => animateValue(goal,    goalVal,   'ZMW ', '', false));
      observeOnce(percent, () => animateValue(percent, pct,       '',    '%', false));
      observeOnce(donors,  () => animateValue(donors,  donorsVal, '',    '', false));

      if (bar) {
        observeOnce(bar, () => {
          bar.style.width = `${pct}%`;
          bar.setAttribute('aria-valuenow', pct);
        });
      }
    });
}

/* ═══════════════════════════════════════════════
   §17. LEADERS GRID — leaders.html
   Fetches /api/leaders and renders cards into
   [data-func="leaders"]. Owns the .dept-filter pills
   so filtering works whether cards are the static
   fallback markup or freshly injected from the API.
═══════════════════════════════════════════════ */
function initLeadersGrid() {
  const grid = document.querySelector('[data-func="leaders"]');
  if (!grid) return;

  const filters = document.querySelectorAll('.dept-filter');

  /* ── Filter wiring — re-queries cards each click so it works
     against whichever set (static or API-rendered) is currently
     in the DOM. ── */
  function wireFilters() {
    filters.forEach(btn => {
      if (btn.dataset.filterWired) return;
      btn.dataset.filterWired = '1';
      btn.addEventListener('click', () => {
        filters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const dept  = btn.dataset.dept;
        const cards = grid.querySelectorAll('.leader-card');
        cards.forEach(card => {
          const show = dept === 'all' || card.dataset.dept === dept;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }
  wireFilters();

  /* ── Card builder — matches the markup/classes already used by
     the static fallback cards in leaders.html, so styling and
     scroll-reveal (sda.js picks up .sacred-shadow automatically)
     both work identically for API-rendered cards. ── */
  function buildCard(leader) {
    const name       = leader.name || 'Unnamed Leader';
    const photo      = leader.photo || '';
    const phone      = leader.phone || '';
    const department = leader.department || 'Department';
    const deptSlug   = leader.departmentSlug || slugify(department);
    const deptDesc   = leader.departmentDescription || '';
    const deptUrl    = leader.departmentUrl || '#';

    const card = document.createElement('article');
    card.className = 'leader-card flex flex-col h-full';
    card.dataset.dept = deptSlug;

    const photoBlock = photo
      ? `<div class="img-wrap rounded-xl sacred-shadow border border-outline-variant/30">
           <img src="${escHtml(photo)}" alt="${escHtml(name)}" loading="lazy"/>
         </div>`
      : `<div class="img-placeholder rounded-xl sacred-shadow border border-outline-variant/30">
           <span class="material-symbols-outlined ph-icon">account_circle</span>
           <span class="ph-label">Photo coming soon</span>
         </div>`;

    const phoneBlock = phone
      ? `<a class="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors" href="tel:${escHtml(phone)}">
           <span class="material-symbols-outlined text-[18px]">phone</span>
           <span>Contact ${escHtml(name.split(' ')[0] || name)}</span>
         </a>`
      : `<div class="flex items-center gap-2 text-outline font-label-md text-label-md">
           <span class="material-symbols-outlined text-[18px]">phone</span>
           <span>Available Soon</span>
         </div>`;

    card.innerHTML = `
      <div class="relative aspect-[3/4] mb-[-40px] z-10 px-4">${photoBlock}</div>
      <div class="leader-card-body bg-surface-container-lowest p-8 pt-16 rounded-xl sacred-shadow flex flex-col h-full">
        <span class="font-label-md text-label-md text-secondary uppercase tracking-[0.08em] block mb-2">${escHtml(department)}</span>
        <h3 class="font-title-lg text-title-lg text-primary mb-3">${escHtml(name)}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-6 line-clamp-2">${escHtml(deptDesc)}</p>
        <div class="mt-auto space-y-4">
          ${phoneBlock}
          <a class="inline-flex items-center gap-1 text-secondary font-bold font-label-md text-label-md hover:underline" href="${escHtml(deptUrl)}">
            View ${escHtml(department)} <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>`;

    // Placeholder fallback if the photo URL 404s/fails to load
    const img = card.querySelector('img');
    if (img) {
      img.addEventListener('error', () => {
        const wrap = img.closest('.img-wrap');
        if (!wrap) return;
        wrap.outerHTML = `
          <div class="img-placeholder rounded-xl sacred-shadow border border-outline-variant/30">
            <span class="material-symbols-outlined ph-icon">account_circle</span>
            <span class="ph-label">Photo coming soon</span>
          </div>`;
      }, { once: true });
    }

    return card;
  }

  fetch('/api/leaders')
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .then(data => {
      if (!Array.isArray(data) || !data.length) return; // keep static fallback cards

      grid.querySelectorAll('.leader-card').forEach(c => c.remove());

      data.forEach(leader => grid.appendChild(buildCard(leader)));

      // Re-apply whatever filter is currently active (defaults to "All")
      const activeBtn = document.querySelector('.dept-filter.active') || filters[0];
      if (activeBtn) activeBtn.click();
    })
    .catch(err => {
      console.warn('[func.js] initLeadersGrid fetch failed, keeping static cards:', err);
    });
}


/* ═══════════════════════════════════════════════
   §16. YOUTH BOARD — youth.html only
═══════════════════════════════════════════════ */
function initYouthBoard() {
  if (document.body.dataset.page !== 'youth') return;

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function wireLikeBtn(btn) {
    if (btn.dataset.likeWired) return;
    btn.dataset.likeWired = '1';
    let liked = false;
    btn.addEventListener('click', async () => {
      if (liked) return;
      liked = true;

      let count = parseInt(btn.dataset.count) || 0;
      count++;
      btn.dataset.count = count;

      const countEl = btn.querySelector('.like-count');
      if (countEl) countEl.textContent = count + ' Likes';

      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.style.fontVariationSettings = "'FILL' 1";
      btn.style.color = '#ba1a1a';

      const id = btn.dataset.id;
      if (id) {
        try {
          const res = await fetch(`/api/discussions/${id}/like`, { method: 'POST' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
          console.warn('[func.js] like failed to save:', e);
          window.SDAToast?.('Your like didn\u2019t save — check your connection.', 'error');
        }
      }
    });
  }
  document.querySelectorAll('.like-btn').forEach(wireLikeBtn);

  /* ═══════════════════════════════════════════
     COMMENTS — #comments-modal wiring
     Opens on any .comment-count-btn click, whether that button
     lives on a static demo card, an API-fetched card, or a
     freshly-posted card. `data-id` is the discussion's Mongo _id
     (empty string for demo cards, which get a read-only preview).
  ═══════════════════════════════════════════ */
  const commentsModal = document.getElementById('comments-modal');

  function wireCommentBtn(btn) {
    if (!btn || btn.dataset.commentWired) return;
    btn.dataset.commentWired = '1';
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id || '';
      const title = btn.dataset.title || 'Discussion';
      window.openCommentsModal(id, title, btn);
    });
  }
  document.querySelectorAll('.comment-count-btn').forEach(wireCommentBtn);
  window.wireCommentBtn = wireCommentBtn; // exposed so newly-injected cards can wire themselves

  if (commentsModal) {
    const commentsList     = document.getElementById('comments-list');
    const commentsEmpty    = document.getElementById('comments-empty');
    const commentsSubtitle = document.getElementById('comments-modal-subtitle');
    const commentNameField = document.getElementById('comment-name');
    const commentBodyField = document.getElementById('comment-body');
    const commentBodyCount = document.getElementById('comment-body-count');
    const commentSubmitBtn = document.getElementById('comment-submit-btn');

    let activeDiscussionId    = '';
    let activeCommentCountBtn = null;

    function renderComment(c) {
      const wrap = document.createElement('div');
      wrap.className = 'comment-item';
      wrap.style.cssText = 'padding:14px 0;border-bottom:1px solid #e2e2e2;';
      wrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="width:30px;height:30px;border-radius:50%;background:#fed977;display:flex;align-items:center;justify-content:center;
                      font-family:Inter,sans-serif;font-size:12px;font-weight:700;color:#785d00;flex-shrink:0;">${escHtml(initialsOf(c.name))}</div>
          <span style="font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#041534;">${escHtml(c.name)}</span>
          <span style="font-family:Inter,sans-serif;font-size:11px;color:#75777f;">${timeAgo(c.createdAt)}</span>
        </div>
        <p style="font-family:Inter,sans-serif;font-size:14px;color:#45464e;line-height:1.5;margin-left:40px;">${escHtml(c.body)}</p>`;
      return wrap;
    }

    async function loadComments(id) {
      if (!commentsList) return;
      commentsList.innerHTML = `<p style="text-align:center;color:#75777f;font-size:13px;padding:16px 0;">Loading comments…</p>`;
      if (commentsEmpty) commentsEmpty.classList.add('hidden');

      if (!id) {
        commentsList.innerHTML = '';
        if (commentsEmpty) {
          commentsEmpty.classList.remove('hidden');
          commentsEmpty.querySelector('p').textContent = 'This is a preview post — comments aren\u2019t available yet.';
        }
        return;
      }

      try {
        const res = await fetch(`/api/discussions/${id}/comments`);
        const data = res.ok ? await res.json() : [];

        commentsList.innerHTML = '';
        if (!Array.isArray(data) || !data.length) {
          if (commentsEmpty) {
            commentsEmpty.classList.remove('hidden');
            commentsEmpty.querySelector('p').textContent = 'No comments yet — be the first to reply.';
          }
          return;
        }

        data.forEach(c => commentsList.appendChild(renderComment(c)));
      } catch (err) {
        console.warn('[func.js] loadComments failed:', err);
        commentsList.innerHTML = `<p style="text-align:center;color:#ba1a1a;font-size:13px;padding:16px 0;">Couldn\u2019t load comments — try again shortly.</p>`;
      }
    }

    window.openCommentsModal = function(id, title, sourceBtn) {
      activeDiscussionId    = id;
      activeCommentCountBtn = sourceBtn || null;

      if (commentsSubtitle) commentsSubtitle.textContent = title;
      if (commentNameField) commentNameField.value = '';
      if (commentBodyField) commentBodyField.value = '';
      if (commentBodyCount) commentBodyCount.textContent = '0 / 500';
      if (commentSubmitBtn) commentSubmitBtn.style.display = id ? '' : 'none';

      commentsModal.classList.add('open');
      document.body.style.overflow = 'hidden';
      loadComments(id);

      setTimeout(() => { if (id && commentNameField) commentNameField.focus(); }, 300);
    };

    window.closeCommentsModal = function() {
      commentsModal.classList.remove('open');
      document.body.style.overflow = '';
    };

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && commentsModal.classList.contains('open')) window.closeCommentsModal();
    });
    const commentsBackdrop = commentsModal.querySelector('.modal-backdrop');
    if (commentsBackdrop) commentsBackdrop.addEventListener('click', window.closeCommentsModal);

    if (commentBodyField) {
      commentBodyField.addEventListener('input', function() {
        const len = this.value.length;
        if (commentBodyCount) {
          commentBodyCount.textContent = len + ' / 500';
          commentBodyCount.classList.toggle('near-limit', len > 425);
        }
      });
    }

    window.submitComment = async function() {
      if (!activeDiscussionId) return; // preview post — nothing to submit against

      const name = (commentNameField?.value || '').trim();
      const body = (commentBodyField?.value || '').trim();

      const fields = [
        { el: commentNameField, val: name },
        { el: commentBodyField, val: body },
      ];
      let valid = true;
      fields.forEach(f => {
        if (!f.el) return;
        if (!f.val) {
          valid = false;
          f.el.style.borderColor = '#ba1a1a';
          f.el.style.boxShadow   = '0 0 0 3px rgba(186,26,26,0.12)';
          f.el.addEventListener('input', () => {
            f.el.style.borderColor = '';
            f.el.style.boxShadow   = '';
          }, { once: true });
        }
      });
      if (!valid) return;

      if (commentSubmitBtn) { commentSubmitBtn.disabled = true; commentSubmitBtn.style.opacity = '0.7'; }

      const result = await apiPost(`/api/discussions/${activeDiscussionId}/comments`, { name, body });

      if (commentSubmitBtn) { commentSubmitBtn.disabled = false; commentSubmitBtn.style.opacity = ''; }

      if (!result || !result.success) {
        window.SDAToast?.('Could not post your comment — please try again.', 'error');
        return;
      }

      if (commentsEmpty) commentsEmpty.classList.add('hidden');
      if (commentsList) commentsList.appendChild(renderComment(result.comment));
      if (commentsList) commentsList.scrollTop = commentsList.scrollHeight;

      if (commentNameField) commentNameField.value = '';
      if (commentBodyField) commentBodyField.value = '';
      if (commentBodyCount) commentBodyCount.textContent = '0 / 500';

      const newCount = typeof result.commentCount === 'number' ? result.commentCount : null;
      if (activeCommentCountBtn) {
        const countEl = activeCommentCountBtn.querySelector('.comment-count');
        if (countEl) {
          const current = newCount !== null ? newCount : (parseInt(countEl.textContent, 10) || 0) + 1;
          countEl.textContent = current + ' Comments';
        }
      }

      window.SDAToast?.('Reply posted!', 'success');
    };
  }

  /* ═══════════════════════════════════════════
     FILTER PILLS — "FILTER BY" row above the board.
     Re-queries cards on every click so it works against whichever
     set (static demo cards or API-fetched cards) is currently in
     the DOM, and keeps both aria-pressed *and* the visible
     active/inactive Tailwind classes in sync.
  ═══════════════════════════════════════════ */
  const FILTER_ACTIVE_CLASSES   = ['bg-primary', 'text-on-primary'];
  const FILTER_INACTIVE_CLASSES = ['bg-surface-container-low', 'text-on-surface-variant'];

  function applyFilter(filter) {
    const cards = document.querySelectorAll('#discussions-list article[data-category]');
    let anyVisible = false;
    cards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });

    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.classList.toggle('hidden', anyVisible);
  }

  function wireFilterBtn(btn) {
    if (btn.dataset.filterWired) return;
    btn.dataset.filterWired = '1';
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      document.querySelectorAll('.filter-btn').forEach(b => {
        b.setAttribute('aria-pressed', 'false');
        b.classList.remove(...FILTER_ACTIVE_CLASSES);
        b.classList.add(...FILTER_INACTIVE_CLASSES);
      });
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.remove(...FILTER_INACTIVE_CLASSES);
      btn.classList.add(...FILTER_ACTIVE_CLASSES);

      applyFilter(filter);
    });
  }
  document.querySelectorAll('.filter-btn').forEach(wireFilterBtn);

  async function loadDiscussions() {
    const list = document.getElementById('discussions-list');
    if (!list) return;

    try {
      const res = await fetch('/api/discussions');
      if (!res.ok) return;

      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return;

      list.querySelectorAll('article').forEach(a => a.remove());

      function wireReadMore(btn) {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        const p = btn.previousElementSibling;
        if (!p) return;
        btn.addEventListener('click', () => {
          const expanded = p.classList.toggle('expanded');
          p.classList.toggle('line-clamp-2', !expanded);
          btn.textContent = expanded ? 'Show less' : 'Read more';
        });
      }

      data.forEach(d => {
        const initials = initialsOf(d.name);

        const card = document.createElement('article');
        card.className        = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
        card.dataset.category = d.category;
        card.dataset.id       = d._id;

        card.innerHTML = `
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container flex-shrink-0"
                 aria-label="${escHtml(d.name)}">${escHtml(initials)}</div>
            <div>
              <h4 class="font-label-md text-label-md text-primary">${escHtml(d.name)}</h4>
              <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">${timeAgo(d.createdAt)} in ${escHtml(d.category)}</p>
            </div>
          </div>
          <span class="card-category">${escHtml(d.category)}</span>
          <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${escHtml(d.title)}</h3>
          <p class="card-body font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-2">${escHtml(d.body)}</p>
          <button class="read-more-btn">Read more</button>
          <div class="flex items-center gap-6 mt-4">
            ${commentButtonHtml(d._id, d.title, d.comments || 0)}
            <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
                    aria-label="Like this post" data-count="${d.likes || 0}" data-id="${escHtml(d._id)}">
              <span class="material-symbols-outlined text-[20px]">favorite</span>
              <span class="font-label-md like-count">${d.likes || 0} Likes</span>
            </button>
          </div>`;

        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
          list.insertBefore(card, emptyState);
        } else {
          list.appendChild(card);
        }

        wireLikeBtn(card.querySelector('.like-btn'));
        wireReadMore(card.querySelector('.read-more-btn'));
        wireCommentBtn(card.querySelector('.comment-count-btn'));
      });

      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.add('hidden');

      // Re-apply whatever filter the visitor already had selected
      // (defaults to "All Topics"), so a choice made while these
      // cards were still loading isn't lost when they land.
      const activeFilterBtn = document.querySelector('.filter-btn[aria-pressed="true"]');
      if (activeFilterBtn) applyFilter(activeFilterBtn.dataset.filter);

    } catch (err) {
      console.warn('[func.js] loadDiscussions failed:', err);
    }
  }

  loadDiscussions();

  function wireReadMore(btn) {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    const p = btn.previousElementSibling;
    if (!p) return;

    btn.addEventListener('click', () => {
      const expanded = p.classList.toggle('expanded');
      p.classList.toggle('line-clamp-2', !expanded);
      btn.textContent = expanded ? 'Show less' : 'Read more';
    });
  }
  document.querySelectorAll('.read-more-btn').forEach(wireReadMore);

  window.toggleExpand = function(id, btn) {
    const el = document.getElementById(id);
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

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && discModal.classList.contains('open')) window.closeModal();
  });
  const backdrop = discModal.querySelector('.modal-backdrop');
  if (backdrop) backdrop.addEventListener('click', window.closeModal);

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

    const submitBtn = document.getElementById('disc-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }

    const result = await apiPost('/api/discussions', { name, category, title, body });

    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }

    if (!result || !result.success) {
      window.SDAToast?.('Could not post your discussion — please try again.', 'error');
      return; // keep the form open with what they typed so they can retry
    }

    const initials = initialsOf(name);
    const newCard  = document.createElement('article');
    newCard.className        = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
    newCard.dataset.category = category;
    newCard.dataset.id       = result.id;
    newCard.style.cssText    = 'opacity:0;transform:translateY(-12px);transition:opacity 0.35s ease,transform 0.35s ease;';

    newCard.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container flex-shrink-0"
             aria-label="${escHtml(name)}">${escHtml(initials)}</div>
        <div>
          <h4 class="font-label-md text-label-md text-primary">${escHtml(name)}</h4>
          <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">Just now in ${escHtml(category)}</p>
        </div>
      </div>
      <span class="card-category">${escHtml(category)}</span>
      <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${escHtml(title)}</h3>
      <p class="card-body font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-2">${escHtml(body)}</p>
      <button class="read-more-btn">Read more</button>
      <div class="flex items-center gap-6 mt-4">
        ${commentButtonHtml(result.id, title, 0)}
        <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
                aria-label="Like this post" data-count="0" data-id="${escHtml(result.id)}">
          <span class="material-symbols-outlined text-[20px]">favorite</span>
          <span class="font-label-md like-count">0 Likes</span>
        </button>
      </div>`;

    wireLikeBtn(newCard.querySelector('.like-btn'));
    wireReadMore(newCard.querySelector('.read-more-btn'));
    wireCommentBtn(newCard.querySelector('.comment-count-btn'));

    const list = document.getElementById('discussions-list');
    if (list) list.insertBefore(newCard, list.firstChild);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      newCard.style.opacity   = '1';
      newCard.style.transform = 'translateY(0)';
    }));

    // Respect whichever filter is currently active — if the visitor
    // is viewing a specific category and just posted in a different
    // one, don't leave their own new card invisible without explanation.
    const activeFilterBtn = document.querySelector('.filter-btn[aria-pressed="true"]');
    if (activeFilterBtn && activeFilterBtn.dataset.filter !== 'all' && activeFilterBtn.dataset.filter !== category) {
      newCard.style.display = 'none';
    }

    document.getElementById('modal-form-view').style.display = 'none';
    document.getElementById('modal-success-view').classList.add('show');
  };

  const fab = document.getElementById('fab-new-discussion');
  if (fab && !fab.dataset.youthWired) {
    fab.dataset.youthWired = '1';
    fab.addEventListener('click', window.openModal);
  }
}
/* ── Watch Live: status badge + button ── */
function initWatchLive() {
  const FB_PAGE_URL = 'https://www.facebook.com/profile.php?id=100091185906540'; // TODO: replace

  const dot        = document.getElementById('live-dot');
  const statusText = document.getElementById('live-status-text');
  const btnText    = document.getElementById('watch-live-btn-text');
  const watchBtn   = document.getElementById('watch-live-btn');
  if (!dot) return;

  // Live window: Saturday, 10:30 AM – 1:00 PM (song service through end of sermon)
  function isLiveNow() {
    const now = new Date();
    if (now.getDay() !== 6) return false; // 6 = Saturday
    const minutes = now.getHours() * 60 + now.getMinutes();
    const start = 10 * 60 + 30; // 10:30
    const end   = 13 * 60;      // 13:00
    return minutes >= start && minutes <= end;
  }

  function updateLiveStatus() {
    const live = isLiveNow();
    dot.classList.toggle('is-live', live);
    if (statusText) statusText.textContent = live ? 'LIVE NOW' : 'Streams Every Saturday';
    if (btnText)    btnText.textContent    = live ? 'Watch Live Now' : 'Watch on Facebook';
    if (watchBtn)   watchBtn.href = live ? FB_PAGE_URL + '/live_videos' : FB_PAGE_URL;
  }

  updateLiveStatus();
  setInterval(updateLiveStatus, 60000); // re-check every minute, in case a visit spans the start time
}