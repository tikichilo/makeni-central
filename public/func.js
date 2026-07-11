/**
 * func.js — Makeni Central SDA Church  v4.2
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
 *                        char counters, FAB wiring, dynamic footer year
 *
 * sda.js owns everything else (UI motion, navbar, hero, counters,
 * Give modal, scroll-reveal, back-to-top, image shimmer, active nav,
 * dropdown nav, mobile accordion).
 *
 * CHANGES v4.1 → v4.2:
 *  § initLeadersGrid — NEW §17. Fetches /api/leaders on leaders.html,
 *    renders leader cards (photo w/ placeholder fallback, name,
 *    department, short description, phone, department link), and wires
 *    the .dept-filter pills. Falls back gracefully to the static HTML
 *    cards already in the page if the fetch fails or the endpoint isn't
 *    built yet. Supersedes the inline filter script that used to live
 *    at the bottom of leaders.html — remove that inline block now that
 *    this owns it (see notes after the file).
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
    '%c✦ Makeni Central SDA — func.js v4.2 loaded',
    'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;'
  );
}


/* ═══════════════════════════════════════════════
   HERO SLIDESHOW — index.html
═══════════════════════════════════════════════ */
function initHeroSlideshow() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.hero-dots .hero-dot');

  if (!slides.length) return;

  const INTERVAL     = 6000;
  const RESUME_DELAY = 8000;

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

  function startAuto() { stopAuto(); timer = setInterval(next, INTERVAL); }
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

  const section = document.querySelector('[aria-label="Welcome hero"]');
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
   STORIES — kids.html
═══════════════════════════════════════════════ */
function initStories() {
  const container = document.querySelector('[data-func="stories"]');
  if (!container) return;

  const prevBtn = container.querySelector('[data-stories-prev]');
  const nextBtn = container.querySelector('[data-stories-next]');
  const track   = container.querySelector('[data-stories-track]');

  if (!prevBtn || !nextBtn || !track) return;

  const cards     = [...track.children];
  const cardCount = cards.length;
  let   current   = 0;

  function goTo(index) {
    current = (index + cardCount) % cardCount;
    track.style.transform = `translateX(-${current * 100}%)`;
    prevBtn.setAttribute('aria-disabled', current === 0 ? 'true' : 'false');
    nextBtn.setAttribute('aria-disabled', current === cardCount - 1 ? 'true' : 'false');
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  container.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  });

  goTo(0);
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
          await fetch(`/api/discussions/${id}/like`, { method: 'POST' });
        } catch (e) { /* silent fail — UI already updated */ }
      }
    });
  }
  document.querySelectorAll('.like-btn').forEach(wireLikeBtn);

  async function loadDiscussions() {
    const list = document.getElementById('discussions-list');
    if (!list) return;

    try {
      const res = await fetch('/api/discussions');
      if (!res.ok) return;

      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return;

      list.querySelectorAll('article').forEach(a => a.remove());

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
        const initials = d.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

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
            <div class="flex items-center gap-2 text-on-surface-variant">
              <span class="material-symbols-outlined text-[20px]">forum</span>
              <span class="font-label-md">${d.comments || 0} Comments</span>
            </div>
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
      });

      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.classList.add('hidden');

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

    const result = await apiPost('/api/discussions', { name, category, title, body });

    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const newCard  = document.createElement('article');
    newCard.className        = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
    newCard.dataset.category = category;
    if (result?.id) newCard.dataset.id = result.id;
    newCard.style.cssText    = 'opacity:0;transform:translateY(-12px);transition:opacity 0.35s ease,transform 0.35s ease;';

    newCard.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container flex-shrink-0"
             aria-label="${escHtml(name)}">${escHtml(initials)}</div>
        <div>
          <h4 class="font-label-md text-label-md text-primary">${escHtml(name)}</h4>
          <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">Just now</p>
        </div>
      </div>
      <span class="card-category">${escHtml(category)}</span>
      <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${escHtml(title)}</h3>
      <p class="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-6">${escHtml(body)}</p>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2 text-on-surface-variant">
          <span class="material-symbols-outlined text-[20px]">forum</span>
          <span class="font-label-md">0 Comments</span>
        </div>
        <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
                aria-label="Like this post" data-count="0" ${result?.id ? `data-id="${result.id}"` : ''}>
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

  const fab = document.getElementById('fab-new-discussion');
  if (fab && !fab.dataset.youthWired) {
    fab.dataset.youthWired = '1';
    fab.addEventListener('click', window.openModal);
  }
}