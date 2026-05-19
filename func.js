/**
 * func.js — Makeni Central SDA Church
 * MongoDB data layer: fetches & renders all live content
 * across index.html, kids.html, youth.html, building.html
 *
 * Connection: <script src="../func.js" defer></script>
 * Requires:   server.js running at the API_BASE below
 */

'use strict';

/* ═══════════════════════════════════════════
   CONFIG — change this to your server address
═══════════════════════════════════════════ */
const API_BASE = 'http://localhost:3000/api';
// When deployed, replace with e.g. 'https://yourserver.com/api'


/* ═══════════════════════════════════════════
   UTILITY HELPERS
═══════════════════════════════════════════ */

/** Generic fetch wrapper with error handling */
async function apiFetch(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[func.js] API fetch failed for ${endpoint}:`, err.message);
    return null;
  }
}

/** POST / PATCH wrapper */
async function apiPost(endpoint, body, method = 'POST') {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[func.js] API post failed for ${endpoint}:`, err.message);
    return null;
  }
}

/** Skeleton loader — replaces element content while fetching */
function showSkeleton(el, lines = 3) {
  if (!el) return;
  el.innerHTML = Array.from({ length: lines }, (_, i) => `
    <div style="
      height:${i === 0 ? '28px' : '16px'};
      width:${i === 0 ? '60%' : 70 + Math.random() * 25 + '%'};
      background:linear-gradient(90deg,#e2e2e2 25%,#f3f3f4 50%,#e2e2e2 75%);
      background-size:200% 100%;
      animation:shimmer 1.4s infinite;
      border-radius:6px;
      margin-bottom:10px;
    "></div>
  `).join('');

  if (!document.getElementById('shimmer-style')) {
    const s = document.createElement('style');
    s.id = 'shimmer-style';
    s.textContent = `@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
    document.head.appendChild(s);
  }
}

/** Format relative time: "2 hours ago" */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Detect which page we're on */
function currentPage() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('kids'))     return 'kids';
  if (path.includes('youth'))    return 'youth';
  if (path.includes('building')) return 'building';
  return 'index';
}


/* ═══════════════════════════════════════════
   1. VERSE OF THE DAY — all pages
   Targets: [data-func="verse"]
   MongoDB collection: verses
═══════════════════════════════════════════ */
async function loadVerseOfDay() {
  const containers = document.querySelectorAll('[data-func="verse"]');
  if (!containers.length) return;

  containers.forEach(el => showSkeleton(el, 2));

  const data = await apiFetch('/verse-of-day');
  if (!data) return;

  containers.forEach(el => {
    el.innerHTML = `
      <p class="font-body-lg text-body-lg italic" style="color:inherit;">"${data.text}"</p>
      <span class="font-label-md text-label-md block mt-3" style="color:inherit;opacity:0.75;">— ${data.reference}</span>
    `;
  });
}


/* ═══════════════════════════════════════════
   2. THEME OF THE MONTH — index + youth
   Targets: [data-func="theme"]
   MongoDB collection: themes
═══════════════════════════════════════════ */
async function loadThemeOfMonth() {
  const el = document.querySelector('[data-func="theme"]');
  if (!el) return;

  showSkeleton(el, 3);

  const data = await apiFetch('/theme');
  if (!data) return;

  el.innerHTML = `
    <div class="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-1 rounded-full mb-4 text-sm font-semibold uppercase tracking-widest">
      <span class="material-symbols-outlined text-[16px]">calendar_month</span>
      Theme of the Month
    </div>
    <h2 class="font-display-lg text-display-lg text-primary mb-4">${data.title}</h2>
    <div class="gold-divider mb-6"></div>
    <p class="font-body-lg text-body-lg text-on-surface-variant">${data.description}</p>
    ${data.verse ? `<blockquote class="mt-6 border-l-4 border-secondary pl-6 italic font-body-md text-on-surface-variant">"${data.verse.text}" <cite class="not-italic font-label-md block mt-2 text-secondary">— ${data.verse.reference}</cite></blockquote>` : ''}
  `;
}


/* ═══════════════════════════════════════════
   3. DISCUSSIONS — youth.html
   Targets: [data-func="discussions"]
   MongoDB collection: discussions
═══════════════════════════════════════════ */
async function loadDiscussions() {
  const container = document.querySelector('[data-func="discussions"]');
  if (!container) return;

  showSkeleton(container, 6);

  const data = await apiFetch('/discussions?page=1&limit=5');
  if (!data || !data.discussions) return;

  container.innerHTML = data.discussions.map(d => `
    <article class="discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow"
             data-id="${d._id}">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
             style="background:${d.authorColor || '#fed977'};color:#041534;">
          ${d.authorInitials || d.author.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h4 class="font-label-md text-label-md text-primary">${d.author}</h4>
          <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">
            ${timeAgo(d.createdAt)} in ${d.category}
          </p>
        </div>
      </div>
      <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${d.title}</h3>
      <p class="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-6">${d.body}</p>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2 text-on-surface-variant">
          <span class="material-symbols-outlined text-[20px]">forum</span>
          <span class="font-label-md comment-count">${d.commentCount} Comment${d.commentCount !== 1 ? 's' : ''}</span>
        </div>
        <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors ${d.liked ? 'liked' : ''}"
                data-id="${d._id}" data-likes="${d.likes}">
          <span class="material-symbols-outlined text-[20px]">favorite</span>
          <span class="font-label-md like-count">${d.likes} Like${d.likes !== 1 ? 's' : ''}</span>
        </button>
      </div>
      <!-- Comments section (lazy loaded) -->
      <div class="comments-section mt-6 hidden" data-discussion="${d._id}"></div>
      <button class="toggle-comments mt-4 font-label-md text-secondary hover:underline text-sm flex items-center gap-1"
              data-id="${d._id}">
        <span class="material-symbols-outlined text-[16px]">expand_more</span>
        View Comments
      </button>
    </article>
  `).join('');

  // Load more button
  if (data.hasMore) {
    const loadMoreBtn = document.createElement('div');
    loadMoreBtn.className = 'text-center pt-8';
    loadMoreBtn.innerHTML = `
      <button id="load-more-discussions" data-page="2"
              class="font-label-md text-label-md text-secondary border-b-2 border-secondary pb-1 hover:opacity-70 transition-all">
        Load More Discussions
      </button>
    `;
    container.appendChild(loadMoreBtn);
    loadMoreBtn.querySelector('button').addEventListener('click', loadMoreDiscussions);
  }

  // Wire up like buttons
  container.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleLike(btn));
  });

  // Wire up comment toggles
  container.querySelectorAll('.toggle-comments').forEach(btn => {
    btn.addEventListener('click', () => toggleComments(btn));
  });
}

/** Load more discussions (pagination) */
async function loadMoreDiscussions(e) {
  const btn = e.currentTarget;
  const page = parseInt(btn.dataset.page);
  btn.textContent = 'Loading…';

  const data = await apiFetch(`/discussions?page=${page}&limit=5`);
  if (!data) { btn.textContent = 'Load More Discussions'; return; }

  const container = document.querySelector('[data-func="discussions"]');
  const loadMoreWrapper = btn.closest('div');

  data.discussions.forEach(d => {
    const article = document.createElement('article');
    article.className = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
    article.dataset.id = d._id;
    article.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
             style="background:${d.authorColor || '#fed977'};color:#041534;">
          ${d.authorInitials || d.author.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h4 class="font-label-md text-label-md text-primary">${d.author}</h4>
          <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">
            ${timeAgo(d.createdAt)} in ${d.category}
          </p>
        </div>
      </div>
      <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${d.title}</h3>
      <p class="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-6">${d.body}</p>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2 text-on-surface-variant">
          <span class="material-symbols-outlined text-[20px]">forum</span>
          <span class="font-label-md comment-count">${d.commentCount} Comments</span>
        </div>
        <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
                data-id="${d._id}" data-likes="${d.likes}">
          <span class="material-symbols-outlined text-[20px]">favorite</span>
          <span class="font-label-md like-count">${d.likes} Likes</span>
        </button>
      </div>
      <div class="comments-section mt-6 hidden" data-discussion="${d._id}"></div>
      <button class="toggle-comments mt-4 font-label-md text-secondary hover:underline text-sm flex items-center gap-1"
              data-id="${d._id}">
        <span class="material-symbols-outlined text-[16px]">expand_more</span>
        View Comments
      </button>
    `;
    container.insertBefore(article, loadMoreWrapper);
    article.querySelector('.like-btn').addEventListener('click', () => toggleLike(article.querySelector('.like-btn')));
    article.querySelector('.toggle-comments').addEventListener('click', () => toggleComments(article.querySelector('.toggle-comments')));
  });

  if (data.hasMore) {
    btn.dataset.page = page + 1;
    btn.textContent = 'Load More Discussions';
  } else {
    loadMoreWrapper.remove();
  }
}


/* ═══════════════════════════════════════════
   4. LIKES — toggle & persist to MongoDB
   MongoDB collection: discussions (likes field)
═══════════════════════════════════════════ */
async function toggleLike(btn) {
  const id = btn.dataset.id;
  const liked = btn.classList.contains('liked');
  const countEl = btn.querySelector('.like-count');
  const current = parseInt(btn.dataset.likes) || 0;

  // Optimistic UI update
  btn.classList.toggle('liked');
  const newCount = liked ? current - 1 : current + 1;
  btn.dataset.likes = newCount;
  countEl.textContent = `${newCount} Like${newCount !== 1 ? 's' : ''}`;

  // Persist to MongoDB
  const result = await apiPost(`/discussions/${id}/like`, { liked: !liked }, 'PATCH');
  if (!result) {
    // Revert on failure
    btn.classList.toggle('liked');
    btn.dataset.likes = current;
    countEl.textContent = `${current} Like${current !== 1 ? 's' : ''}`;
    window.SDAToast && window.SDAToast('Could not save like. Try again.');
  }
}


/* ═══════════════════════════════════════════
   5. COMMENTS — load, display & post
   MongoDB collection: comments
═══════════════════════════════════════════ */
async function toggleComments(btn) {
  const id = btn.dataset.id;
  const section = document.querySelector(`.comments-section[data-discussion="${id}"]`);
  if (!section) return;

  const isOpen = !section.classList.contains('hidden');
  if (isOpen) {
    section.classList.add('hidden');
    btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">expand_more</span> View Comments`;
    return;
  }

  section.classList.remove('hidden');
  btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">expand_less</span> Hide Comments`;

  if (section.dataset.loaded) return; // already fetched
  showSkeleton(section, 2);

  const data = await apiFetch(`/discussions/${id}/comments`);
  section.dataset.loaded = 'true';

  if (!data || !data.comments.length) {
    section.innerHTML = `<p class="text-sm text-on-surface-variant italic">No comments yet. Be the first to respond!</p>`;
  } else {
    section.innerHTML = `
      <div class="space-y-4 mb-4">
        ${data.comments.map(c => `
          <div class="flex gap-3 p-4 bg-surface-container-low rounded-lg">
            <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center font-bold text-xs text-on-secondary-container flex-shrink-0">
              ${c.authorInitials || c.author.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p class="font-label-md text-primary text-sm">${c.author}
                <span class="font-normal text-on-surface-variant text-xs ml-2">${timeAgo(c.createdAt)}</span>
              </p>
              <p class="font-body-md text-on-surface-variant text-sm mt-1">${c.body}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Add comment form
  const form = document.createElement('div');
  form.className = 'flex gap-3 mt-4';
  form.innerHTML = `
    <input type="text" placeholder="Your name" maxlength="40"
           class="w-28 bg-white border-b-2 border-surface-variant focus:border-secondary outline-none px-3 py-2 text-sm rounded-lg transition-colors"
           data-comment-name />
    <input type="text" placeholder="Add a comment…" maxlength="300"
           class="flex-grow bg-white border-b-2 border-surface-variant focus:border-secondary outline-none px-3 py-2 text-sm rounded-lg transition-colors"
           data-comment-input />
    <button class="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary transition-colors"
            data-comment-submit="${id}">Post</button>
  `;
  section.appendChild(form);

  form.querySelector('[data-comment-submit]').addEventListener('click', () => postComment(id, section, form));
  form.querySelector('[data-comment-input]').addEventListener('keydown', e => {
    if (e.key === 'Enter') postComment(id, section, form);
  });
}

async function postComment(discussionId, section, form) {
  const nameInput  = form.querySelector('[data-comment-name]');
  const bodyInput  = form.querySelector('[data-comment-input]');
  const name = nameInput.value.trim();
  const body = bodyInput.value.trim();

  if (!name) { window.SDAToast && window.SDAToast('Please enter your name'); nameInput.focus(); return; }
  if (!body) { window.SDAToast && window.SDAToast('Please write a comment'); bodyInput.focus(); return; }

  const submitBtn = form.querySelector('[data-comment-submit]');
  submitBtn.textContent = 'Posting…';
  submitBtn.disabled = true;

  const result = await apiPost(`/discussions/${discussionId}/comments`, {
    author: name,
    authorInitials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    body,
  });

  if (result) {
    // Append new comment to UI
    const list = section.querySelector('.space-y-4');
    if (list) {
      const newComment = document.createElement('div');
      newComment.className = 'flex gap-3 p-4 bg-surface-container-low rounded-lg';
      newComment.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center font-bold text-xs text-on-secondary-container flex-shrink-0">
          ${result.authorInitials}
        </div>
        <div>
          <p class="font-label-md text-primary text-sm">${result.author}
            <span class="font-normal text-on-surface-variant text-xs ml-2">Just now</span>
          </p>
          <p class="font-body-md text-on-surface-variant text-sm mt-1">${result.body}</p>
        </div>
      `;
      list.appendChild(newComment);
    }

    // Update comment count in card
    const card = section.closest('article');
    const countEl = card?.querySelector('.comment-count');
    if (countEl) {
      const n = parseInt(countEl.textContent) + 1;
      countEl.textContent = `${n} Comment${n !== 1 ? 's' : ''}`;
    }

    nameInput.value = '';
    bodyInput.value = '';
    window.SDAToast && window.SDAToast('🙏 Comment posted!');
  } else {
    window.SDAToast && window.SDAToast('Failed to post. Try again.');
  }

  submitBtn.textContent = 'Post';
  submitBtn.disabled = false;
}


/* ═══════════════════════════════════════════
   6. BUILDING FUND STATS — building.html
   Targets: [data-func="fund-raised"],
            [data-func="fund-goal"],
            [data-func="fund-percent"],
            [data-func="fund-bar"],
            [data-func="fund-donors"]
   MongoDB collection: buildingFund
═══════════════════════════════════════════ */
async function loadBuildingFund() {
  const hasAny = document.querySelector('[data-func^="fund-"]');
  if (!hasAny) return;

  const data = await apiFetch('/building-fund');
  if (!data) return;

  const percent = Math.min(Math.round((data.raised / data.goal) * 100), 100);

  const set = (attr, val) => {
    document.querySelectorAll(`[data-func="${attr}"]`).forEach(el => { el.textContent = val; });
  };

  set('fund-raised',  `ZMW ${data.raised.toLocaleString()}`);
  set('fund-goal',    `ZMW ${data.goal.toLocaleString()}`);
  set('fund-percent', `${percent}%`);
  set('fund-donors',  data.donors.toLocaleString());

  // Animate the progress bar
  document.querySelectorAll('[data-func="fund-bar"]').forEach(bar => {
    bar.style.width = '0%';
    bar.style.transition = 'width 1.6s cubic-bezier(.4,0,.2,1)';
    setTimeout(() => { bar.style.width = `${percent}%`; }, 300);
  });
}


/* ═══════════════════════════════════════════
   7. KIDS STORIES — kids.html
   Targets: [data-func="stories"]
   MongoDB collection: stories
═══════════════════════════════════════════ */
async function loadKidsStories() {
  const container = document.querySelector('[data-func="stories"]');
  if (!container) return;

  showSkeleton(container, 4);

  const data = await apiFetch('/stories?limit=6');
  if (!data || !data.stories) return;

  container.innerHTML = data.stories.map((s, i) => `
    <div class="${i === 0 ? 'md:col-span-8' : 'md:col-span-4'} bg-surface-container-lowest border-t-4 border-secondary p-6 rounded-xl sacred-shadow flex flex-col ${i === 0 ? 'md:flex-row gap-8' : ''} hover:shadow-md transition-shadow group">
      <div class="${i === 0 ? 'w-full md:w-1/2 h-64' : 'w-full h-48'} rounded-xl overflow-hidden ${i > 0 ? 'mb-6' : 'shrink-0'}">
        <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
             src="${s.imageUrl}" alt="${s.title}" loading="lazy"/>
      </div>
      <div class="flex flex-col justify-center">
        <span class="bg-surface-variant text-on-surface-variant font-label-md text-[12px] px-3 py-1 rounded-full w-fit mb-4 uppercase">${s.category}</span>
        <h3 class="${i === 0 ? 'font-headline-md text-headline-md' : 'font-title-lg text-title-lg'} text-primary mb-3">${s.title}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-6 ${i > 0 ? 'grow' : ''}">${s.summary}</p>
        <button class="read-story-btn ${i === 0 ? 'flex items-center gap-2 text-primary font-label-md hover:text-secondary transition-colors' : 'bg-primary text-on-primary w-full py-3 rounded-xl font-label-md hover:bg-primary/90 transition-colors active:scale-95'}"
                data-id="${s._id}" data-title="${s.title}">
          Read Story ${i === 0 ? '<span class="material-symbols-outlined">arrow_forward</span>' : ''}
        </button>
      </div>
    </div>
  `).join('');

  // Wire up read buttons
  container.querySelectorAll('.read-story-btn').forEach(btn => {
    btn.addEventListener('click', () => openStoryModal(btn.dataset.id, btn.dataset.title));
  });
}

/** Story reader modal */
async function openStoryModal(storyId, title) {
  let modal = document.getElementById('story-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'story-modal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(4,21,52,0.75);backdrop-filter:blur(8px);
      display:flex;align-items:center;justify-content:center;
      opacity:0;transition:opacity 0.3s ease;pointer-events:none;
      padding:20px;
    `;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;max-width:680px;width:100%;max-height:85vh;
                  overflow-y:auto;padding:40px;position:relative;
                  transform:translateY(24px);transition:transform 0.35s cubic-bezier(.4,0,.2,1);">
        <button id="story-modal-close" style="position:absolute;top:16px;right:16px;width:36px;height:36px;
          border-radius:50%;border:none;background:#f3f3f4;cursor:pointer;font-size:18px;" aria-label="Close">✕</button>
        <div id="story-modal-content"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#story-modal-close').addEventListener('click', () => {
      modal.style.opacity = '0'; modal.style.pointerEvents = 'none';
      modal.querySelector('div').style.transform = 'translateY(24px)';
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.querySelector('#story-modal-close').click(); });
  }

  const content = modal.querySelector('#story-modal-content');
  showSkeleton(content, 5);
  modal.style.opacity = '1'; modal.style.pointerEvents = 'all';
  modal.querySelector('div').style.transform = 'translateY(0)';

  const story = await apiFetch(`/stories/${storyId}`);
  if (!story) { content.innerHTML = '<p>Story could not be loaded.</p>'; return; }

  content.innerHTML = `
    ${story.imageUrl ? `<img src="${story.imageUrl}" alt="${story.title}" style="width:100%;height:240px;object-fit:cover;border-radius:12px;margin-bottom:24px;"/>` : ''}
    <span style="background:#eeeeee;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#45464e;">${story.category}</span>
    <h2 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#041534;margin:16px 0 12px;">${story.title}</h2>
    <div style="height:2px;width:60px;background:#755b00;margin-bottom:20px;"></div>
    <div style="font-size:16px;line-height:1.8;color:#45464e;">${story.content}</div>
    ${story.verse ? `<blockquote style="border-left:4px solid #755b00;padding:16px 20px;margin-top:24px;background:#f9f9f9;border-radius:0 12px 12px 0;font-style:italic;color:#1a1c1c;">"${story.verse.text}" <cite style="display:block;font-style:normal;font-size:13px;font-weight:600;color:#755b00;margin-top:8px;">— ${story.verse.reference}</cite></blockquote>` : ''}
  `;
}


/* ═══════════════════════════════════════════
   8. NEWSLETTER SUBSCRIBE — kids.html + index
   Targets: form with [data-func="subscribe"]
   MongoDB collection: subscribers
═══════════════════════════════════════════ */
function initNewsletter() {
  document.querySelectorAll('[data-func="subscribe"]').forEach(form => {
    const input  = form.querySelector('input[type="email"]');
    const button = form.querySelector('button');
    if (!input || !button) return;

    button.addEventListener('click', async () => {
      const email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        window.SDAToast && window.SDAToast('Please enter a valid email address');
        input.focus(); return;
      }

      button.textContent = 'Subscribing…';
      button.disabled = true;

      const result = await apiPost('/subscribe', { email, page: currentPage() });

      if (result) {
        input.value = '';
        window.SDAToast && window.SDAToast('✉ Subscribed! See you every Sabbath.');
        button.textContent = '✓ Subscribed';
        button.style.background = '#755b00';
      } else {
        button.textContent = 'Subscribe';
        button.disabled = false;
        window.SDAToast && window.SDAToast('Subscription failed. Try again.');
      }
    });
  });
}


/* ═══════════════════════════════════════════
   9. NEW DISCUSSION — youth.html FAB
   MongoDB collection: discussions
═══════════════════════════════════════════ */
function initNewDiscussion() {
  const fab = document.querySelector('button[class*="rounded-full"]');
  if (!fab || !fab.textContent.includes('Discussion')) return;

  // Build modal
  const modal = document.createElement('div');
  modal.id = 'new-discussion-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(4,21,52,0.75);
    backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;
    opacity:0;pointer-events:none;transition:opacity 0.3s ease;padding:20px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;max-width:560px;width:100%;
                padding:40px;position:relative;
                transform:translateY(24px);transition:transform 0.35s cubic-bezier(.4,0,.2,1);">
      <button id="nd-close" style="position:absolute;top:16px;right:16px;width:36px;height:36px;
        border-radius:50%;border:none;background:#f3f3f4;cursor:pointer;font-size:18px;" aria-label="Close">✕</button>
      <h2 style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#041534;margin-bottom:6px;">Start a Discussion</h2>
      <p style="color:#45464e;font-size:14px;margin-bottom:24px;">Share a question, topic, or thought with the youth board.</p>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Your Name</label>
      <input id="nd-author" type="text" maxlength="60" placeholder="e.g. Samuel Mwamba"
             style="width:100%;border:2px solid #e2e2e2;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;margin-bottom:16px;transition:border-color 0.2s;"
             onfocus="this.style.borderColor='#755b00'" onblur="this.style.borderColor='#e2e2e2'"/>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Category</label>
      <select id="nd-category"
              style="width:100%;border:2px solid #e2e2e2;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;margin-bottom:16px;background:#fff;">
        <option>Faith &amp; Doubt</option>
        <option>Bible Study</option>
        <option>Christian Living</option>
        <option>Prayer</option>
        <option>Community</option>
      </select>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Title</label>
      <input id="nd-title" type="text" maxlength="120" placeholder="What's on your mind?"
             style="width:100%;border:2px solid #e2e2e2;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;margin-bottom:16px;transition:border-color 0.2s;"
             onfocus="this.style.borderColor='#755b00'" onblur="this.style.borderColor='#e2e2e2'"/>

      <label style="display:block;font-size:12px;font-weight:600;color:#45464e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Your Thoughts</label>
      <textarea id="nd-body" maxlength="1000" rows="4" placeholder="Share more details…"
                style="width:100%;border:2px solid #e2e2e2;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;resize:vertical;transition:border-color 0.2s;"
                onfocus="this.style.borderColor='#755b00'" onblur="this.style.borderColor='#e2e2e2'"></textarea>

      <button id="nd-submit"
              style="width:100%;background:#041534;color:#fff;border:none;border-radius:12px;padding:16px;
                     font-size:15px;font-weight:600;cursor:pointer;margin-top:20px;transition:background 0.2s;">
        Post Discussion ✦
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  const open  = () => { modal.style.opacity='1'; modal.style.pointerEvents='all'; modal.querySelector('div').style.transform='translateY(0)'; document.body.style.overflow='hidden'; };
  const close = () => { modal.style.opacity='0'; modal.style.pointerEvents='none'; modal.querySelector('div').style.transform='translateY(24px)'; document.body.style.overflow=''; };

  fab.addEventListener('click', open);
  modal.querySelector('#nd-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#nd-submit').addEventListener('click', async () => {
    const author   = modal.querySelector('#nd-author').value.trim();
    const category = modal.querySelector('#nd-category').value;
    const title    = modal.querySelector('#nd-title').value.trim();
    const body     = modal.querySelector('#nd-body').value.trim();

    if (!author) { window.SDAToast && window.SDAToast('Please enter your name'); return; }
    if (!title)  { window.SDAToast && window.SDAToast('Please enter a title'); return; }
    if (!body)   { window.SDAToast && window.SDAToast('Please write something'); return; }

    const submitBtn = modal.querySelector('#nd-submit');
    submitBtn.textContent = 'Posting…'; submitBtn.disabled = true;

    const result = await apiPost('/discussions', {
      author,
      authorInitials: author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      category, title, body,
      likes: 0, commentCount: 0,
    });

    if (result) {
      close();
      window.SDAToast && window.SDAToast('🎉 Discussion posted!');
      // Prepend new card to list
      const container = document.querySelector('[data-func="discussions"]');
      if (container) {
        const article = document.createElement('article');
        article.className = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
        article.dataset.id = result._id;
        article.innerHTML = `
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold flex-shrink-0 text-on-secondary-container">
              ${result.authorInitials}
            </div>
            <div>
              <h4 class="font-label-md text-label-md text-primary">${result.author}</h4>
              <p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">Just now in ${result.category}</p>
            </div>
          </div>
          <h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">${result.title}</h3>
          <p class="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-6">${result.body}</p>
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-2 text-on-surface-variant">
              <span class="material-symbols-outlined text-[20px]">forum</span>
              <span class="font-label-md comment-count">0 Comments</span>
            </div>
            <button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors" data-id="${result._id}" data-likes="0">
              <span class="material-symbols-outlined text-[20px]">favorite</span>
              <span class="font-label-md like-count">0 Likes</span>
            </button>
          </div>
        `;
        container.insertBefore(article, container.firstChild);
        article.querySelector('.like-btn').addEventListener('click', () => toggleLike(article.querySelector('.like-btn')));
      }
    } else {
      window.SDAToast && window.SDAToast('Failed to post. Try again.');
    }

    submitBtn.textContent = 'Post Discussion ✦'; submitBtn.disabled = false;
  });
}


/* ═══════════════════════════════════════════
   10. ANNOUNCEMENTS TICKER — index.html
   Targets: [data-func="announcements"]
   MongoDB collection: announcements
═══════════════════════════════════════════ */
async function loadAnnouncements() {
  const el = document.querySelector('[data-func="announcements"]');
  if (!el) return;

  const data = await apiFetch('/announcements');
  if (!data || !data.announcements.length) return;

  el.innerHTML = '';
  const ticker = document.createElement('div');
  ticker.style.cssText = 'overflow:hidden;white-space:nowrap;';

  const items = data.announcements.map(a =>
    `<span style="display:inline-block;padding:0 48px;"><strong>${a.title}:</strong> ${a.body}</span>`
  ).join('');

  ticker.innerHTML = `<span id="ticker-inner" style="display:inline-block;">${items}${items}</span>`;
  el.appendChild(ticker);

  let pos = 0;
  const inner = ticker.querySelector('#ticker-inner');
  const halfWidth = inner.scrollWidth / 2;

  function tick() {
    pos -= 0.6;
    if (Math.abs(pos) >= halfWidth) pos = 0;
    inner.style.transform = `translateX(${pos}px)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}


/* ═══════════════════════════════════════════
   ROUTER — run the right functions per page
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const page = currentPage();

  // All pages get verse + theme + newsletter + announcements
  loadVerseOfDay();
  loadThemeOfMonth();
  loadAnnouncements();
  initNewsletter();

  if (page === 'youth') {
    loadDiscussions();
    initNewDiscussion();
  }

  if (page === 'building') {
    loadBuildingFund();
  }

  if (page === 'kids') {
    loadKidsStories();
  }

  console.log(`%c✦ func.js — ${page} page loaded`, 'color:#e6c364;background:#041534;padding:4px 12px;border-radius:4px;font-weight:600;');
});