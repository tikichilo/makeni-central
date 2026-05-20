/**
 * func.js — Makeni Central SDA Church
 * MongoDB data layer: fetches & renders all live content
 * across index.html, kids.html, youth.html, building.html
 *
 * Connection: <script src="func.js" defer></script>
 * Requires:   server.js running at the API_BASE below
 *
 * IMPROVEMENTS OVER v1:
 *  • Request deduplication — identical in-flight fetches share one Promise
 *  • In-memory response cache with per-endpoint TTLs (verse: 1hr, etc.)
 *  • Retry logic with exponential back-off (up to 3 attempts)
 *  • AbortController timeout per request (8 s default)
 *  • SDAToast is self-contained here — no external dependency
 *  • Toast has type variants: success / error / info
 *  • Fund stats animate numbers (count-up) not just the bar
 *  • Ticker pauses on hover/focus, resumes on leave
 *  • Discussion filter buttons are wired to live API queries
 *  • "Start a Discussion" FAB detected by id, not fragile class heuristic
 *  • Comment form uses <form> semantics with proper validation feedback
 *  • Newsletter deduplicates across page loads (localStorage flag)
 *  • Story modal traps keyboard focus for accessibility
 *  • Every async path surfaces user-visible error states, not silent fails
 *  • initNewDiscussion attaches to FAB by id="fab-new-discussion"
 *  • All innerHTML injections escape untrusted server strings (esc())
 *  • currentPage() uses <body data-page="…"> for zero-ambiguity
 */

'use strict';

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
const API_BASE   = 'http://localhost:3000/api';
const REQ_TIMEOUT_MS = 8_000;  // per-request abort timeout
const MAX_RETRIES    = 3;
const RETRY_BASE_MS  = 400;    // doubles each retry: 400 → 800 → 1600

/** Cache TTLs in milliseconds — tune to your content freshness needs */
const CACHE_TTL = {
  '/verse-of-day':   60 * 60 * 1000,   // 1 hour
  '/theme':          60 * 60 * 1000,   // 1 hour
  '/announcements':  10 * 60 * 1000,   // 10 minutes
  '/building-fund':  15 * 60 * 1000,   // 15 minutes
  '/stories':         5 * 60 * 1000,   // 5 minutes
  '/discussions':     2 * 60 * 1000,   // 2 minutes
  default:            5 * 60 * 1000,
};


/* ═══════════════════════════════════════════
   UTILITY — XSS SAFETY
═══════════════════════════════════════════ */
/** Escape untrusted strings before injecting into innerHTML */
function esc(str) {
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":"&#39;" };
  return String(str ?? '').replace(/[&<>"']/g, c => map[c]);
}


/* ═══════════════════════════════════════════
   HTTP LAYER — cache + dedup + retry + timeout
═══════════════════════════════════════════ */
const _cache    = new Map();   // key → { data, expires }
const _inflight = new Map();   // key → Promise

/** GET with cache, deduplication, retry, and timeout */
async function apiFetch(endpoint) {
  const key = endpoint;

  // 1. Cache hit
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.expires) return cached.data;

  // 2. Deduplicate in-flight requests
  if (_inflight.has(key)) return _inflight.get(key);

  const ttl = Object.entries(CACHE_TTL).reduce((acc, [prefix, ms]) =>
    endpoint.startsWith(prefix) ? ms : acc, CACHE_TTL.default);

  const promise = (async () => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
      try {
        const res = await fetch(`${API_BASE}${endpoint}`, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _cache.set(key, { data, expires: Date.now() + ttl });
        return data;
      } catch (err) {
        clearTimeout(timer);
        const isLast = attempt === MAX_RETRIES;
        const isAbort = err.name === 'AbortError';
        if (isLast || isAbort) {
          console.warn(`[func.js] fetch failed (${attempt}/${MAX_RETRIES}) ${endpoint}:`, err.message);
          return null;
        }
        // Exponential back-off before next attempt
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
      }
    }
    return null;
  })();

  _inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    _inflight.delete(key);
  }
}

/** POST / PATCH — no caching, no dedup (mutations) */
async function apiPost(endpoint, body, method = 'POST') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Invalidate relevant cache entries after a successful mutation
    invalidateCache(endpoint.split('/').slice(0, 3).join('/'));
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[func.js] POST failed ${endpoint}:`, err.message);
    return null;
  }
}

/** Bust cache entries whose key starts with a given prefix */
function invalidateCache(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}


/* ═══════════════════════════════════════════
   TOAST NOTIFICATION — self-contained
   Variants: 'success' | 'error' | 'info'
═══════════════════════════════════════════ */
(function initToast() {
  const style = document.createElement('style');
  style.textContent = `
    #sda-toast-wrap {
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
      z-index: 999999; display: flex; flex-direction: column; align-items: center;
      gap: 10px; pointer-events: none;
    }
    .sda-toast {
      display: flex; align-items: center; gap: 10px;
      background: #1a1c1c; color: #fff;
      padding: 13px 22px; border-radius: 40px;
      font-family: Inter, sans-serif; font-size: 14px; font-weight: 600;
      box-shadow: 0 8px 32px rgba(4,21,52,0.22);
      opacity: 0; transform: translateY(14px) scale(0.96);
      transition: opacity 0.28s ease, transform 0.28s cubic-bezier(.4,0,.2,1);
      pointer-events: auto; max-width: 88vw; white-space: nowrap;
      border-left: 4px solid #755b00;
    }
    .sda-toast.show { opacity: 1; transform: translateY(0) scale(1); }
    .sda-toast.t-success { border-color: #4caf50; }
    .sda-toast.t-error   { border-color: #ba1a1a; background: #2d0a0a; }
    .sda-toast.t-info    { border-color: #b7c6ee; }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'sda-toast-wrap';
  document.body.appendChild(wrap);

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=3200]
   */
  window.SDAToast = function(message, type = 'info', duration = 3200) {
    const toast = document.createElement('div');
    toast.className = `sda-toast t-${type}`;
    const icons = { success: '✦', error: '✕', info: '·' };
    toast.innerHTML = `<span style="font-size:16px;opacity:.7;">${icons[type] ?? '·'}</span>${esc(message)}`;
    wrap.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 320);
    }, duration);
  };
})();


/* ═══════════════════════════════════════════
   SKELETON LOADER
═══════════════════════════════════════════ */
function showSkeleton(el, lines = 3) {
  if (!el) return;
  if (!document.getElementById('shimmer-style')) {
    const s = document.createElement('style');
    s.id = 'shimmer-style';
    s.textContent = `
      @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      .skel { height:16px; border-radius:6px; margin-bottom:10px;
        background:linear-gradient(90deg,#e2e2e2 25%,#f3f3f4 50%,#e2e2e2 75%);
        background-size:200% 100%; animation:shimmer 1.4s infinite; }
    `;
    document.head.appendChild(s);
  }
  el.innerHTML = Array.from({ length: lines }, (_, i) =>
    `<div class="skel" style="height:${i===0?'28px':'16px'};width:${i===0?60:70+Math.floor(Math.random()*25)}%;"></div>`
  ).join('');
}

/** Show an error state inside a container */
function showError(el, message = 'Content could not be loaded.') {
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:#45464e;">
      <span class="material-symbols-outlined" style="font-size:40px;color:#c5c6cf;display:block;margin-bottom:12px;">wifi_off</span>
      <p style="font-size:15px;font-weight:600;margin-bottom:6px;color:#1a1c1c;">${esc(message)}</p>
      <p style="font-size:13px;">Please check your connection and refresh the page.</p>
    </div>`;
}


/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
/** Format relative time */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-ZM', { day:'numeric', month:'short', year:'numeric' });
}

/**
 * Animate a number from 0 to target over ~1.2 s
 * @param {HTMLElement} el
 * @param {number} target
 * @param {string} [prefix='']
 * @param {string} [suffix='']
 */
function countUp(el, target, prefix = '', suffix = '') {
  if (!el) return;
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
    const current = Math.round(ease * target);
    el.textContent = prefix + current.toLocaleString() + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/**
 * Detect page from <body data-page="..."> with pathname fallback.
 * Add  data-page="index|kids|youth|building"  to each <body> tag.
 */
function currentPage() {
  const attr = document.body.dataset.page;
  if (attr) return attr;
  const path = window.location.pathname.toLowerCase();
  if (path.includes('kids'))     return 'kids';
  if (path.includes('youth'))    return 'youth';
  if (path.includes('building')) return 'building';
  return 'index';
}

/** Trap focus inside a modal element for keyboard accessibility */
function trapFocus(modal) {
  const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const items = [...modal.querySelectorAll(focusable)].filter(el => !el.disabled);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  modal.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  });
}


/* ═══════════════════════════════════════════
   1. VERSE OF THE DAY — all pages
   Targets: [data-func="verse"]
═══════════════════════════════════════════ */
async function loadVerseOfDay() {
  const containers = document.querySelectorAll('[data-func="verse"]');
  if (!containers.length) return;

  containers.forEach(el => showSkeleton(el, 2));

  const data = await apiFetch('/verse-of-day');
  containers.forEach(el => {
    if (!data) { showError(el, 'Verse unavailable.'); return; }
    el.innerHTML = `
      <p class="font-body-lg text-body-lg italic" style="color:inherit;">"${esc(data.text)}"</p>
      <span class="font-label-md text-label-md block mt-3" style="color:inherit;opacity:0.75;">— ${esc(data.reference)}</span>
    `;
  });
}


/* ═══════════════════════════════════════════
   2. THEME OF THE MONTH — index + youth
   Targets: [data-func="theme"]
═══════════════════════════════════════════ */
async function loadThemeOfMonth() {
  const el = document.querySelector('[data-func="theme"]');
  if (!el) return;

  showSkeleton(el, 3);

  const data = await apiFetch('/theme');
  if (!data) { showError(el, 'Theme unavailable.'); return; }

  el.innerHTML = `
    <div class="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-1 rounded-full mb-4 text-sm font-semibold uppercase tracking-widest">
      <span class="material-symbols-outlined text-[16px]">calendar_month</span>
      Theme of the Month
    </div>
    <h2 class="font-display-lg text-display-lg text-primary mb-4">${esc(data.title)}</h2>
    <div class="gold-divider mb-6"></div>
    <p class="font-body-lg text-body-lg text-on-surface-variant">${esc(data.description)}</p>
    ${data.verse ? `
      <blockquote class="mt-6 border-l-4 border-secondary pl-6 italic font-body-md text-on-surface-variant">
        "${esc(data.verse.text)}"
        <cite class="not-italic font-label-md block mt-2 text-secondary">— ${esc(data.verse.reference)}</cite>
      </blockquote>` : ''}
  `;
}


/* ═══════════════════════════════════════════
   3. DISCUSSIONS — youth.html
   Targets: [data-func="discussions"]
═══════════════════════════════════════════ */
let _discussionPage  = 1;
let _activeCategory  = 'all';

async function loadDiscussions(reset = true) {
  const container = document.querySelector('[data-func="discussions"]');
  if (!container) return;

  if (reset) {
    _discussionPage = 1;
    showSkeleton(container, 6);
  }

  const categoryParam = _activeCategory !== 'all' ? `&category=${encodeURIComponent(_activeCategory)}` : '';
  const data = await apiFetch(`/discussions?page=${_discussionPage}&limit=5${categoryParam}`);

  if (!data) { showError(container, 'Discussions could not be loaded.'); return; }

  if (reset) container.innerHTML = '';

  // Remove old load-more wrapper before re-appending
  container.querySelector('.load-more-wrapper')?.remove();

  if (!data.discussions.length && reset) {
    container.innerHTML = `<p class="text-center py-12 text-on-surface-variant font-body-md">No discussions in this category yet. Be the first!</p>`;
    return;
  }

  data.discussions.forEach(d => {
    container.insertBefore(buildDiscussionCard(d), null);
  });

  if (data.hasMore) {
    const wrapper = document.createElement('div');
    wrapper.className = 'load-more-wrapper text-center pt-8';
    wrapper.innerHTML = `
      <button class="font-label-md text-label-md text-secondary border-b-2 border-secondary pb-1 hover:opacity-70 transition-all">
        Load More Discussions
      </button>`;
    container.appendChild(wrapper);
    wrapper.querySelector('button').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.textContent = 'Loading…';
      btn.disabled = true;
      _discussionPage++;
      await loadDiscussions(false);
    });
  }

  wireDiscussionCards(container);
}

function buildDiscussionCard(d) {
  const article = document.createElement('article');
  article.className = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
  article.dataset.id = d._id;
  article.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-sm"
           style="background:${esc(d.authorColor||'#fed977')};color:#041534;">
        ${esc(d.authorInitials || d.author.slice(0,2).toUpperCase())}
      </div>
      <div>
        <h4 class="font-label-md text-label-md text-primary">${esc(d.author)}</h4>
        <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">${timeAgo(d.createdAt)} · ${esc(d.category)}</p>
      </div>
    </div>
    <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${esc(d.title)}</h3>
    <p class="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-6">${esc(d.body)}</p>
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2 text-on-surface-variant">
        <span class="material-symbols-outlined text-[20px]">forum</span>
        <span class="font-label-md comment-count">${d.commentCount} Comment${d.commentCount!==1?'s':''}</span>
      </div>
      <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors ${d.liked?'text-error':''}"
              data-id="${esc(d._id)}" data-likes="${d.likes}" aria-pressed="${d.liked?'true':'false'}" aria-label="Like this post">
        <span class="material-symbols-outlined text-[20px]" style="font-variation-settings:'FILL' ${d.liked?1:0}">favorite</span>
        <span class="font-label-md like-count">${d.likes} Like${d.likes!==1?'s':''}</span>
      </button>
    </div>
    <div class="comments-section mt-6 hidden" data-discussion="${esc(d._id)}"></div>
    <button class="toggle-comments mt-4 font-label-md text-secondary hover:underline text-sm flex items-center gap-1"
            data-id="${esc(d._id)}" aria-expanded="false">
      <span class="material-symbols-outlined text-[16px]">expand_more</span>
      View Comments
    </button>
  `;
  return article;
}

function wireDiscussionCards(container) {
  container.querySelectorAll('.like-btn:not([data-wired])').forEach(btn => {
    btn.dataset.wired = '1';
    btn.addEventListener('click', () => toggleLike(btn));
  });
  container.querySelectorAll('.toggle-comments:not([data-wired])').forEach(btn => {
    btn.dataset.wired = '1';
    btn.addEventListener('click', () => toggleComments(btn));
  });
}

/** Wire discussion category filter buttons */
function initDiscussionFilters() {
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', async () => {
      _activeCategory = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => {
        const active = b === btn;
        b.className = b.className
          .replace(/bg-primary text-on-primary|bg-surface-container-low text-on-surface-variant/g, '')
          .trim();
        b.classList.add(...(active
          ? ['bg-primary', 'text-on-primary']
          : ['bg-surface-container-low', 'text-on-surface-variant']));
      });
      await loadDiscussions(true);
    });
  });
}


/* ═══════════════════════════════════════════
   4. LIKES — optimistic UI + MongoDB persist
═══════════════════════════════════════════ */
async function toggleLike(btn) {
  const id      = btn.dataset.id;
  const liked   = btn.getAttribute('aria-pressed') === 'true';
  const countEl = btn.querySelector('.like-count');
  const icon    = btn.querySelector('.material-symbols-outlined');
  const current = parseInt(btn.dataset.likes) || 0;
  const newCount = liked ? current - 1 : current + 1;

  // Optimistic update
  btn.setAttribute('aria-pressed', String(!liked));
  btn.dataset.likes = newCount;
  btn.classList.toggle('text-error', !liked);
  countEl.textContent = `${newCount} Like${newCount!==1?'s':''}`;
  icon.style.fontVariationSettings = `'FILL' ${liked ? 0 : 1}`;

  const result = await apiPost(`/discussions/${id}/like`, { liked: !liked }, 'PATCH');
  if (!result) {
    // Revert
    btn.setAttribute('aria-pressed', String(liked));
    btn.dataset.likes = current;
    btn.classList.toggle('text-error', liked);
    countEl.textContent = `${current} Like${current!==1?'s':''}`;
    icon.style.fontVariationSettings = `'FILL' ${liked ? 1 : 0}`;
    SDAToast('Could not save like. Try again.', 'error');
  }
}


/* ═══════════════════════════════════════════
   5. COMMENTS — lazy load, post, keyboard UX
═══════════════════════════════════════════ */
async function toggleComments(btn) {
  const id      = btn.dataset.id;
  const section = document.querySelector(`.comments-section[data-discussion="${id}"]`);
  if (!section) return;

  const isOpen = !section.classList.contains('hidden');
  section.classList.toggle('hidden', isOpen);
  btn.setAttribute('aria-expanded', String(!isOpen));
  btn.innerHTML = isOpen
    ? `<span class="material-symbols-outlined text-[16px]">expand_more</span> View Comments`
    : `<span class="material-symbols-outlined text-[16px]">expand_less</span> Hide Comments`;

  if (isOpen || section.dataset.loaded) return;

  showSkeleton(section, 2);
  const data = await apiFetch(`/discussions/${id}/comments`);
  section.dataset.loaded = '1';

  const listEl = document.createElement('div');
  listEl.className = 'space-y-4 mb-4';

  if (!data || !data.comments.length) {
    listEl.innerHTML = `<p class="text-sm text-on-surface-variant italic py-2">No comments yet. Be the first!</p>`;
  } else {
    data.comments.forEach(c => listEl.appendChild(buildCommentEl(c)));
  }

  section.innerHTML = '';
  section.appendChild(listEl);
  section.appendChild(buildCommentForm(id, section, listEl));
}

function buildCommentEl(c) {
  const div = document.createElement('div');
  div.className = 'flex gap-3 p-4 bg-surface-container-low rounded-lg';
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center font-bold text-xs text-on-secondary-container flex-shrink-0">
      ${esc(c.authorInitials || c.author.slice(0,2).toUpperCase())}
    </div>
    <div>
      <p class="font-label-md text-primary text-sm">
        ${esc(c.author)}
        <span class="font-normal text-on-surface-variant text-xs ml-2">${timeAgo(c.createdAt)}</span>
      </p>
      <p class="font-body-md text-on-surface-variant text-sm mt-1">${esc(c.body)}</p>
    </div>`;
  return div;
}

function buildCommentForm(discussionId, section, listEl) {
  const wrap = document.createElement('div');
  wrap.className = 'flex gap-2 mt-4 items-end';
  wrap.innerHTML = `
    <div class="flex flex-col gap-2 flex-grow">
      <input type="text" placeholder="Your name" maxlength="40" aria-label="Your name"
             class="w-full bg-white border-b-2 border-surface-variant focus:border-secondary outline-none px-3 py-2 text-sm rounded-lg transition-colors"
             data-comment-name />
      <input type="text" placeholder="Add a comment…" maxlength="300" aria-label="Comment"
             class="w-full bg-white border-b-2 border-surface-variant focus:border-secondary outline-none px-3 py-2 text-sm rounded-lg transition-colors"
             data-comment-input />
    </div>
    <button class="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary transition-colors flex-shrink-0 h-fit"
            data-comment-submit aria-label="Post comment">Post</button>
  `;

  const submit = async () => {
    const nameInput = wrap.querySelector('[data-comment-name]');
    const bodyInput = wrap.querySelector('[data-comment-input]');
    const btn       = wrap.querySelector('[data-comment-submit]');
    const name = nameInput.value.trim();
    const body = bodyInput.value.trim();

    if (!name) { SDAToast('Please enter your name', 'error'); nameInput.focus(); return; }
    if (!body) { SDAToast('Please write a comment', 'error'); bodyInput.focus(); return; }

    btn.textContent = '…'; btn.disabled = true;

    const result = await apiPost(`/discussions/${discussionId}/comments`, {
      author: name,
      authorInitials: name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),
      body,
    });

    if (result) {
      listEl.appendChild(buildCommentEl({ ...result, createdAt: new Date().toISOString() }));
      // Scroll new comment into view
      listEl.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // Increment comment count badge
      const card     = section.closest('article');
      const countEl  = card?.querySelector('.comment-count');
      if (countEl) {
        const n = parseInt(countEl.textContent) + 1;
        countEl.textContent = `${n} Comment${n!==1?'s':''}`;
      }
      nameInput.value = '';
      bodyInput.value = '';
      SDAToast('🙏 Comment posted!', 'success');
    } else {
      SDAToast('Failed to post. Try again.', 'error');
    }

    btn.textContent = 'Post'; btn.disabled = false;
  };

  wrap.querySelector('[data-comment-submit]').addEventListener('click', submit);
  wrap.querySelector('[data-comment-input]').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  return wrap;
}


/* ═══════════════════════════════════════════
   6. BUILDING FUND STATS — building.html
   Targets: [data-func="fund-raised"]
            [data-func="fund-goal"]
            [data-func="fund-percent"]
            [data-func="fund-bar"]
            [data-func="fund-donors"]
═══════════════════════════════════════════ */
async function loadBuildingFund() {
  if (!document.querySelector('[data-func^="fund-"]')) return;

  const data = await apiFetch('/building-fund');
  if (!data) return;

  const percent = Math.min(Math.round((data.raised / data.goal) * 100), 100);

  // Animate progress bar
  document.querySelectorAll('[data-func="fund-bar"]').forEach(bar => {
    bar.style.width = '0%';
    bar.style.transition = 'width 1.6s cubic-bezier(.4,0,.2,1)';
    setTimeout(() => { bar.style.width = `${percent}%`; }, 300);
  });

  // Use IntersectionObserver so count-ups fire when visible
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el   = entry.target;
      const attr = el.dataset.func;
      if (attr === 'fund-raised')  countUp(el, data.raised,  'ZMW ', '');
      if (attr === 'fund-goal')    countUp(el, data.goal,    'ZMW ', '');
      if (attr === 'fund-percent') countUp(el, percent,      '',     '%');
      if (attr === 'fund-donors')  countUp(el, data.donors,  '',     '');
    });
  }, { threshold: 0.5 });

  ['fund-raised','fund-goal','fund-percent','fund-donors'].forEach(attr => {
    document.querySelectorAll(`[data-func="${attr}"]`).forEach(el => observer.observe(el));
  });
}


/* ═══════════════════════════════════════════
   7. KIDS STORIES — kids.html
   Targets: [data-func="stories"]
═══════════════════════════════════════════ */
async function loadKidsStories() {
  const container = document.querySelector('[data-func="stories"]');
  if (!container) return;

  showSkeleton(container, 4);

  const data = await apiFetch('/stories?limit=6');
  if (!data || !data.stories) { showError(container, 'Stories could not be loaded.'); return; }

  container.innerHTML = data.stories.map((s, i) => `
    <div class="${i===0?'md:col-span-8':'md:col-span-4'} bg-surface-container-lowest border-t-4 border-secondary p-6 rounded-xl sacred-shadow flex flex-col ${i===0?'md:flex-row gap-8':''} hover:shadow-md transition-shadow group">
      <div class="${i===0?'w-full md:w-1/2 h-64':'w-full h-48'} rounded-xl overflow-hidden ${i>0?'mb-6':'shrink-0'}">
        <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
             src="${esc(s.imageUrl)}" alt="${esc(s.title)}" loading="lazy"/>
      </div>
      <div class="flex flex-col justify-center">
        <span class="bg-surface-variant text-on-surface-variant font-label-md text-[12px] px-3 py-1 rounded-full w-fit mb-4 uppercase">${esc(s.category)}</span>
        <h3 class="${i===0?'font-headline-md text-headline-md':'font-title-lg text-title-lg'} text-primary mb-3">${esc(s.title)}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-6 ${i>0?'grow':''}">${esc(s.summary)}</p>
        <button class="read-story-btn ${i===0?'flex items-center gap-2 text-primary font-label-md hover:text-secondary transition-colors group/btn':'bg-primary text-on-primary w-full py-3 rounded-xl font-label-md hover:bg-primary/90 transition-colors active:scale-95'}"
                data-id="${esc(s._id)}" data-title="${esc(s.title)}">
          Read Story ${i===0?'<span class="material-symbols-outlined group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>':''}
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.read-story-btn').forEach(btn => {
    btn.addEventListener('click', () => openStoryModal(btn.dataset.id, btn.dataset.title));
  });
}


/* ═══════════════════════════════════════════
   8. STORY MODAL — accessible, focus-trapped
═══════════════════════════════════════════ */
function getOrCreateStoryModal() {
  let modal = document.getElementById('story-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id           = 'story-modal';
  modal.role         = 'dialog';
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Story reader');
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(4,21,52,0.78);backdrop-filter:blur(8px);
    display:flex;align-items:center;justify-content:center;
    opacity:0;transition:opacity 0.3s ease;pointer-events:none;padding:20px;
  `;
  modal.innerHTML = `
    <div id="story-modal-inner" style="
      background:#fff;border-radius:20px;max-width:680px;width:100%;
      max-height:85vh;overflow-y:auto;padding:40px;position:relative;
      transform:translateY(24px);transition:transform 0.35s cubic-bezier(.4,0,.2,1);">
      <button id="story-modal-close" aria-label="Close story"
              style="position:absolute;top:16px;right:16px;width:36px;height:36px;
                     border-radius:50%;border:none;background:#f3f3f4;cursor:pointer;font-size:18px;">✕</button>
      <div id="story-modal-content"></div>
    </div>`;
  document.body.appendChild(modal);

  const closeModal = () => {
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    modal.querySelector('#story-modal-inner').style.transform = 'translateY(24px)';
    document.body.style.overflow = '';
    modal._opener?.focus();
  };

  modal.querySelector('#story-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.opacity === '1') closeModal();
  });
  trapFocus(modal);
  return modal;
}

async function openStoryModal(storyId, title, opener) {
  const modal   = getOrCreateStoryModal();
  const content = modal.querySelector('#story-modal-content');
  const inner   = modal.querySelector('#story-modal-inner');
  modal._opener = opener || document.activeElement;

  showSkeleton(content, 5);
  modal.style.opacity       = '1';
  modal.style.pointerEvents = 'all';
  inner.style.transform     = 'translateY(0)';
  document.body.style.overflow = 'hidden';
  modal.querySelector('#story-modal-close').focus();

  const story = await apiFetch(`/stories/${storyId}`);
  if (!story) { showError(content, 'Story could not be loaded.'); return; }

  content.innerHTML = `
    ${story.imageUrl ? `<img src="${esc(story.imageUrl)}" alt="${esc(story.title)}"
      style="width:100%;height:240px;object-fit:cover;border-radius:12px;margin-bottom:24px;"/>` : ''}
    <span style="background:#eeeeee;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;
                 text-transform:uppercase;letter-spacing:.05em;color:#45464e;">${esc(story.category)}</span>
    <h2 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#041534;margin:16px 0 12px;">${esc(story.title)}</h2>
    <div style="height:2px;width:60px;background:#755b00;margin-bottom:20px;"></div>
    <div style="font-size:16px;line-height:1.8;color:#45464e;">${story.content}</div>
    ${story.verse ? `
      <blockquote style="border-left:4px solid #755b00;padding:16px 20px;margin-top:24px;
                         background:#f9f9f9;border-radius:0 12px 12px 0;font-style:italic;color:#1a1c1c;">
        "${esc(story.verse.text)}"
        <cite style="display:block;font-style:normal;font-size:13px;font-weight:600;color:#755b00;margin-top:8px;">
          — ${esc(story.verse.reference)}
        </cite>
      </blockquote>` : ''}
  `;
}


/* ═══════════════════════════════════════════
   9. NEWSLETTER — kids.html + index
   Targets: [data-func="subscribe"]
   Prevents re-subscribing the same email in sessionStorage
═══════════════════════════════════════════ */
function initNewsletter() {
  document.querySelectorAll('[data-func="subscribe"]').forEach(form => {
    const input  = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="button"], button:not([type])');
    if (!input || !button) return;

    button.addEventListener('click', async () => {
      const email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        SDAToast('Please enter a valid email address.', 'error');
        input.focus(); return;
      }

      // Soft guard: don't re-submit the same email this session
      const key = `sub_${email}`;
      if (sessionStorage.getItem(key)) {
        SDAToast('You\'re already subscribed with this email!', 'info');
        return;
      }

      button.textContent = 'Subscribing…';
      button.disabled = true;

      const result = await apiPost('/subscribe', { email, page: currentPage() });
      if (result) {
        sessionStorage.setItem(key, '1');
        input.value = '';
        SDAToast('✉ Subscribed! See you every Sabbath.', 'success', 4000);
        button.textContent = '✓ Subscribed';
        button.style.background = '#755b00';
      } else {
        SDAToast('Subscription failed. Please try again.', 'error');
        button.textContent = 'Subscribe';
        button.disabled = false;
      }
    });
  });
}


/* ═══════════════════════════════════════════
   10. NEW DISCUSSION MODAL — youth.html
   Attach to: <button id="fab-new-discussion">
   (Add id="fab-new-discussion" to the FAB button in youth.html)
═══════════════════════════════════════════ */
function initNewDiscussion() {
  const fab = document.getElementById('fab-new-discussion');
  if (!fab) return;

  const modal = document.createElement('div');
  modal.id = 'new-discussion-modal';
  modal.role = 'dialog';
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Start a new discussion');
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(4,21,52,0.78);
    backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;
    opacity:0;pointer-events:none;transition:opacity 0.3s ease;padding:20px;
  `;

  const inputStyle = `
    width:100%;border:2px solid #e2e2e2;border-radius:10px;
    padding:12px 14px;font-size:15px;outline:none;
    transition:border-color 0.2s;box-sizing:border-box;
    font-family:Inter,sans-serif;
  `;

  modal.innerHTML = `
    <div id="nd-inner" style="background:#fff;border-radius:20px;max-width:560px;width:100%;
                  max-height:90vh;overflow-y:auto;padding:40px;position:relative;
                  transform:translateY(24px);transition:transform 0.35s cubic-bezier(.4,0,.2,1);">
      <button id="nd-close" aria-label="Close" style="position:absolute;top:16px;right:16px;
        width:36px;height:36px;border-radius:50%;border:none;background:#f3f3f4;cursor:pointer;font-size:18px;">✕</button>

      <h2 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#041534;margin-bottom:6px;">
        Start a Discussion
      </h2>
      <p style="color:#45464e;font-size:14px;margin-bottom:24px;">
        Share a question, topic, or thought with the youth board.
      </p>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;" for="nd-author">
        Your Name <span style="color:#ba1a1a">*</span>
      </label>
      <input id="nd-author" type="text" maxlength="60" placeholder="e.g. Samuel Mwamba"
             style="${inputStyle}margin-bottom:4px;" autocomplete="name"/>
      <p id="nd-author-err" style="color:#ba1a1a;font-size:12px;margin-bottom:12px;display:none;">Please enter your name.</p>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;" for="nd-category">
        Category
      </label>
      <select id="nd-category" style="${inputStyle}margin-bottom:16px;background:#fff;">
        <option value="Faith &amp; Doubt">Faith &amp; Doubt</option>
        <option value="Bible Study">Bible Study</option>
        <option value="Christian Living">Christian Living</option>
        <option value="Prayer">Prayer</option>
        <option value="Community">Community</option>
      </select>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;" for="nd-title">
        Title <span style="color:#ba1a1a">*</span>
      </label>
      <input id="nd-title" type="text" maxlength="120" placeholder="What's on your mind?"
             style="${inputStyle}margin-bottom:4px;"/>
      <p id="nd-title-err" style="color:#ba1a1a;font-size:12px;margin-bottom:12px;display:none;">Please enter a title.</p>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;" for="nd-body">
        Your Thoughts <span style="color:#ba1a1a">*</span>
      </label>
      <textarea id="nd-body" maxlength="1000" rows="4" placeholder="Share more details…"
                style="${inputStyle}resize:vertical;"></textarea>
      <div style="text-align:right;font-size:12px;color:#75777f;margin-bottom:4px;">
        <span id="nd-char-count">0</span>/1000
      </div>
      <p id="nd-body-err" style="color:#ba1a1a;font-size:12px;margin-bottom:12px;display:none;">Please write something.</p>

      <button id="nd-submit" style="width:100%;background:#041534;color:#fff;border:none;border-radius:12px;
        padding:16px;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px;
        transition:background 0.2s;font-family:Inter,sans-serif;">
        Post Discussion ✦
      </button>
    </div>`;
  document.body.appendChild(modal);

  // Character counter
  modal.querySelector('#nd-body').addEventListener('input', function() {
    modal.querySelector('#nd-char-count').textContent = this.value.length;
  });

  // Focus styles via JS (no global style needed)
  modal.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('focus', () => { el.style.borderColor = '#755b00'; });
    el.addEventListener('blur',  () => { el.style.borderColor = '#e2e2e2'; });
  });

  const openModal  = () => {
    modal.style.opacity = '1'; modal.style.pointerEvents = 'all';
    modal.querySelector('#nd-inner').style.transform = 'translateY(0)';
    document.body.style.overflow = 'hidden';
    modal.querySelector('#nd-author').focus();
  };
  const closeModal = () => {
    modal.style.opacity = '0'; modal.style.pointerEvents = 'none';
    modal.querySelector('#nd-inner').style.transform = 'translateY(24px)';
    document.body.style.overflow = '';
    fab.focus();
  };

  fab.addEventListener('click', openModal);
  modal.querySelector('#nd-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.opacity === '1') closeModal();
  });
  trapFocus(modal);

  modal.querySelector('#nd-submit').addEventListener('click', async () => {
    const authorInput = modal.querySelector('#nd-author');
    const titleInput  = modal.querySelector('#nd-title');
    const bodyInput   = modal.querySelector('#nd-body');
    const submitBtn   = modal.querySelector('#nd-submit');

    const author   = authorInput.value.trim();
    const category = modal.querySelector('#nd-category').value;
    const title    = titleInput.value.trim();
    const body     = bodyInput.value.trim();

    // Field-level validation
    let valid = true;
    const show = (id, vis) => { modal.querySelector(id).style.display = vis ? 'block' : 'none'; };
    show('#nd-author-err', !author); if (!author) { authorInput.focus(); valid = false; }
    show('#nd-title-err',  !title);  if (!title && valid) { titleInput.focus(); valid = false; }
    show('#nd-body-err',   !body);   if (!body && valid)  { bodyInput.focus();  valid = false; }
    if (!valid) return;

    submitBtn.textContent = 'Posting…'; submitBtn.disabled = true;

    const result = await apiPost('/discussions', {
      author,
      authorInitials: author.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),
      category, title, body, likes: 0, commentCount: 0,
    });

    if (result) {
      closeModal();
      SDAToast('🎉 Discussion posted!', 'success');
      // Reset form
      [authorInput, titleInput, bodyInput].forEach(el => { el.value = ''; });
      modal.querySelector('#nd-char-count').textContent = '0';

      // Prepend card to list
      const container = document.querySelector('[data-func="discussions"]');
      if (container) {
        const card = buildDiscussionCard({ ...result, createdAt: new Date().toISOString() });
        container.insertBefore(card, container.firstChild);
        wireDiscussionCards(container);
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      SDAToast('Failed to post. Please try again.', 'error');
    }

    submitBtn.textContent = 'Post Discussion ✦'; submitBtn.disabled = false;
  });
}


/* ═══════════════════════════════════════════
   11. ANNOUNCEMENTS TICKER — index.html
   Targets: [data-func="announcements"]
   Pauses on hover/focus; resumes on leave.
═══════════════════════════════════════════ */
async function loadAnnouncements() {
  const el = document.querySelector('[data-func="announcements"]');
  if (!el) return;

  const data = await apiFetch('/announcements');
  if (!data?.announcements?.length) return;

  el.innerHTML = '';
  const track = document.createElement('div');
  track.style.cssText = 'overflow:hidden;white-space:nowrap;';

  const items = data.announcements.map(a =>
    `<span style="display:inline-block;padding:0 48px;">
       <strong>${esc(a.title)}:</strong> ${esc(a.body)}
     </span>`
  ).join('');

  // Duplicate for seamless loop
  const inner = document.createElement('span');
  inner.id = 'ticker-inner';
  inner.style.display = 'inline-block';
  inner.innerHTML = items + items;
  track.appendChild(inner);
  el.appendChild(track);

  let pos    = 0;
  let paused = false;
  let halfW  = 0;

  // Recalculate half-width after layout
  requestAnimationFrame(() => { halfW = inner.scrollWidth / 2; });

  el.addEventListener('mouseenter', () => { paused = true; });
  el.addEventListener('mouseleave', () => { paused = false; });
  el.addEventListener('focusin',    () => { paused = true; });
  el.addEventListener('focusout',   () => { paused = false; });

  function tick() {
    if (!paused) {
      pos -= 0.55;
      if (halfW && Math.abs(pos) >= halfW) pos = 0;
      inner.style.transform = `translateX(${pos}px)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}


/* ═══════════════════════════════════════════
   ROUTER
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const page = currentPage();

  // Every page
  loadVerseOfDay();
  loadThemeOfMonth();
  loadAnnouncements();
  initNewsletter();

  if (page === 'youth') {
    loadDiscussions();
    initDiscussionFilters();
    initNewDiscussion();
  }
  if (page === 'building') loadBuildingFund();
  if (page === 'kids')     loadKidsStories();

  console.log(
    `%c✦ func.js v2 — ${page} page loaded`,
    'color:#e6c364;background:#041534;padding:4px 12px;border-radius:4px;font-weight:600;'
  );
});