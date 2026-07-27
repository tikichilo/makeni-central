/**
 * youth-board.js — Makeni Central SDA Church
 * Standalone controller for the Youth Voice discussion board (youth.html).
 *
 * Zero dependencies — does NOT need sda.js or func.js to be loaded, does
 * NOT call any function defined in either of them, and does NOT expect
 * anything from them to exist. Everything the board needs (toast, API
 * calls, helpers) is self-contained in this one file.
 *
 * ── WHY THIS FIXES "the modal won't open" ──────────────────────────────
 * If some other script on the page (most likely sda.js, e.g. its
 * click-outside-to-close-menu logic) has a document-level click listener
 * that calls stopPropagation() during the CAPTURE phase, it can prevent
 * a click from ever reaching your button's own onclick handler — the
 * click just dies in transit. You'd see nothing in the console, because
 * nothing errors; the click simply never arrives.
 *
 * This file works around that by registering its OWN capturing listener
 * on `document`, and — critically — this script tag must be the FIRST
 * <script> on the page, before sda.js. Capturing listeners on the same
 * node fire in the order they were registered, so if this script runs
 * first, it always gets first look at every click. Once it recognizes a
 * click as belonging to the discussion board, it calls
 * stopImmediatePropagation() so nothing added later — sda.js included —
 * can interfere with it.
 *
 * ── HOW TO USE ──────────────────────────────────────────────────────
 * In youth.html, change the bottom of <body> to:
 *
 *     <script src="youth-board.js" defer></script>
 *     <script src="sda.js" defer></script>
 *     <script src="func.js" defer></script>
 *
 * youth-board.js MUST come first. Order of sda.js / func.js after it
 * doesn't matter.
 *
 * Optional cleanup (not required, just avoids double-fetching the
 * discussion list): in func.js's funcInit(), comment out or delete the
 * line `initYouthBoard();` — this file replaces that section entirely.
 * Nothing will double-fire on click either way, because this script's
 * stopImmediatePropagation() stops the event before func.js's own
 * button listeners would ever see it — but func.js's initYouthBoard()
 * would still independently fetch /api/discussions and rebuild the
 * list a second time, which is wasted work (and a possible flicker).
 */

'use strict';

(function () {

  /* ── tiny self-contained helpers (no external deps) ── */

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initialsOf(name) {
    return String(name || '')
      .split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
    return new Date(dateStr).toLocaleDateString();
  }

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
      console.warn('[youth-board] apiPost failed:', endpoint, err);
      return null;
    }
  }

  /* ── tiny built-in toast — doesn't rely on func.js's SDAToast ── */
  let toastWrap = null;
  function toast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
        'z-index:99990;display:flex;flex-direction:column;gap:10px;' +
        'align-items:center;pointer-events:none;';
      const style = document.createElement('style');
      style.textContent =
        '.yb-toast{background:#041534;color:#fff;padding:12px 24px;border-radius:100px;' +
        'font-family:Inter,sans-serif;font-size:14px;font-weight:600;border-left:4px solid #e6c364;' +
        'box-shadow:0 8px 24px rgba(4,21,52,0.3);opacity:0;transform:translateY(20px);' +
        'transition:all .35s cubic-bezier(.4,0,.2,1);pointer-events:all;white-space:nowrap;max-width:88vw;}' +
        '.yb-toast.show{opacity:1;transform:translateY(0);}' +
        '.yb-toast.success{border-color:#4caf50;}' +
        '.yb-toast.error{border-color:#ba1a1a;background:#2d0a0a;}';
      document.head.appendChild(style);
      document.body.appendChild(toastWrap);
    }
    const t = document.createElement('div');
    t.className = 'yb-toast ' + type;
    t.textContent = message;
    toastWrap.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, duration);
  }

  const $ = (id) => document.getElementById(id);

  /* ── state ── */
  let activeDiscussionId = '';
  let activeCommentBtn   = null;

  /* ═══════════════════════ MODAL: discussion ═══════════════════════ */

  function openDiscussionModal() {
    const modal = $('discussion-modal');
    if (!modal) return;
    $('modal-form-view').style.display = '';
    $('modal-success-view').classList.remove('show');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('disc-name')?.focus(), 300);
  }

  function closeDiscussionModal() {
    const modal = $('discussion-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
      ['disc-name', 'disc-title', 'disc-body'].forEach(id => { const el = $(id); if (el) el.value = ''; });
      const cat = $('disc-category'); if (cat) cat.value = '';
      const tc = $('title-count'); if (tc) tc.textContent = '0 / 100';
      const bc = $('body-count');  if (bc) bc.textContent = '0 / 1000';
      $('modal-success-view')?.classList.remove('show');
      const fv = $('modal-form-view'); if (fv) fv.style.display = '';
    }, 300);
  }

  function commentButtonHtml(id, title, count) {
    return '<button class="comment-count-btn flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"' +
      ' data-id="' + escHtml(id || '') + '" data-title="' + escHtml(title || '') + '" aria-label="View comments">' +
      '<span class="material-symbols-outlined text-[20px]">forum</span>' +
      '<span class="font-label-md comment-count">' + (count || 0) + ' Comments</span></button>';
  }

  async function submitDiscussion() {
    const name     = ($('disc-name')?.value     || '').trim();
    const category = ($('disc-category')?.value || '').trim();
    const title    = ($('disc-title')?.value    || '').trim();
    const body     = ($('disc-body')?.value     || '').trim();

    const fields = [
      { id: 'disc-name', val: name }, { id: 'disc-category', val: category },
      { id: 'disc-title', val: title }, { id: 'disc-body', val: body },
    ];
    let valid = true;
    fields.forEach(f => {
      const el = $(f.id); if (!el) return;
      if (!f.val) {
        valid = false;
        el.style.borderColor = '#ba1a1a';
        el.style.boxShadow   = '0 0 0 3px rgba(186,26,26,0.12)';
        el.addEventListener('input', () => { el.style.borderColor = ''; el.style.boxShadow = ''; }, { once: true });
      }
    });
    if (!valid) return;

    const submitBtn = $('disc-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }

    const result = await apiPost('/api/discussions', { name, category, title, body });

    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }

    if (!result || !result.success) {
      toast('Could not post your discussion — please try again.', 'error');
      return; // keep the form open with what they typed so they can retry
    }

    const initials = initialsOf(name);
    const newCard = document.createElement('article');
    newCard.className        = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
    newCard.dataset.category = category;
    newCard.dataset.id       = result.id;
    newCard.style.cssText    = 'opacity:0;transform:translateY(-12px);transition:opacity .35s ease,transform .35s ease;';
    newCard.innerHTML =
      '<div class="flex items-center gap-3 mb-4">' +
        '<div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container flex-shrink-0" aria-label="' + escHtml(name) + '">' + escHtml(initials) + '</div>' +
        '<div><h4 class="font-label-md text-label-md text-primary">' + escHtml(name) + '</h4>' +
        '<p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">Just now in ' + escHtml(category) + '</p></div></div>' +
      '<span class="card-category">' + escHtml(category) + '</span>' +
      '<h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">' + escHtml(title) + '</h3>' +
      '<p class="card-body font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-2">' + escHtml(body) + '</p>' +
      '<button class="read-more-btn">Read more</button>' +
      '<div class="flex items-center gap-6 mt-4">' +
        commentButtonHtml(result.id, title, 0) +
        '<button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors" aria-label="Like this post" data-count="0" data-id="' + escHtml(result.id) + '">' +
          '<span class="material-symbols-outlined text-[20px]">favorite</span>' +
          '<span class="font-label-md like-count">0 Likes</span></button></div>';

    const list = $('discussions-list');
    if (list) list.insertBefore(newCard, list.firstChild);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      newCard.style.opacity = '1'; newCard.style.transform = 'translateY(0)';
    }));

    const activeFilterBtn = document.querySelector('.filter-btn[aria-pressed="true"]');
    if (activeFilterBtn && activeFilterBtn.dataset.filter !== 'all' && activeFilterBtn.dataset.filter !== category) {
      newCard.style.display = 'none';
    }

    $('modal-form-view').style.display = 'none';
    $('modal-success-view').classList.add('show');
  }

  /* ═══════════════════════ MODAL: comments ═══════════════════════ */

  function renderComment(c) {
    const wrap = document.createElement('div');
    wrap.className = 'comment-item';
    wrap.style.cssText = 'padding:14px 0;border-bottom:1px solid #e2e2e2;';
    wrap.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
        '<div style="width:30px;height:30px;border-radius:50%;background:#fed977;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;font-size:12px;font-weight:700;color:#785d00;flex-shrink:0;">' + escHtml(initialsOf(c.name)) + '</div>' +
        '<span style="font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#041534;">' + escHtml(c.name) + '</span>' +
        '<span style="font-family:Inter,sans-serif;font-size:11px;color:#75777f;">' + timeAgo(c.createdAt) + '</span></div>' +
      '<p style="font-family:Inter,sans-serif;font-size:14px;color:#45464e;line-height:1.5;margin-left:40px;">' + escHtml(c.body) + '</p>';
    return wrap;
  }

  async function loadComments(id) {
    const list = $('comments-list'), empty = $('comments-empty');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;color:#75777f;font-size:13px;padding:16px 0;">Loading comments…</p>';
    empty?.classList.add('hidden');

    if (!id) {
      list.innerHTML = '';
      if (empty) { empty.classList.remove('hidden'); empty.querySelector('p').textContent = 'This is a preview post — comments aren\u2019t available yet.'; }
      return;
    }
    try {
      const res = await fetch(`/api/discussions/${id}/comments`);
      const data = res.ok ? await res.json() : [];
      list.innerHTML = '';
      if (!Array.isArray(data) || !data.length) {
        if (empty) { empty.classList.remove('hidden'); empty.querySelector('p').textContent = 'No comments yet — be the first to reply.'; }
        return;
      }
      data.forEach(c => list.appendChild(renderComment(c)));
    } catch (err) {
      console.warn('[youth-board] loadComments failed:', err);
      list.innerHTML = '<p style="text-align:center;color:#ba1a1a;font-size:13px;padding:16px 0;">Couldn\u2019t load comments — try again shortly.</p>';
    }
  }

  function openCommentsModal(id, title, sourceBtn) {
    const modal = $('comments-modal');
    if (!modal) return;
    activeDiscussionId = id;
    activeCommentBtn   = sourceBtn || null;

    const subtitle = $('comments-modal-subtitle');
    if (subtitle) subtitle.textContent = title;
    const nameField = $('comment-name'), bodyField = $('comment-body'), bodyCount = $('comment-body-count');
    if (nameField) nameField.value = '';
    if (bodyField) bodyField.value = '';
    if (bodyCount) bodyCount.textContent = '0 / 500';
    const submitBtn = $('comment-submit-btn');
    if (submitBtn) submitBtn.style.display = id ? '' : 'none';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    loadComments(id);
    setTimeout(() => { if (id) nameField?.focus(); }, 300);
  }

  function closeCommentsModal() {
    const modal = $('comments-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function submitComment() {
    if (!activeDiscussionId) return; // preview post — nothing to submit against

    const nameField = $('comment-name'), bodyField = $('comment-body');
    const name = (nameField?.value || '').trim();
    const body = (bodyField?.value || '').trim();

    let valid = true;
    [[nameField, name], [bodyField, body]].forEach(([el, val]) => {
      if (!el) return;
      if (!val) {
        valid = false;
        el.style.borderColor = '#ba1a1a';
        el.style.boxShadow   = '0 0 0 3px rgba(186,26,26,0.12)';
        el.addEventListener('input', () => { el.style.borderColor = ''; el.style.boxShadow = ''; }, { once: true });
      }
    });
    if (!valid) return;

    const submitBtn = $('comment-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }

    const result = await apiPost(`/api/discussions/${activeDiscussionId}/comments`, { name, body });

    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }

    if (!result || !result.success) { toast('Could not post your comment — please try again.', 'error'); return; }

    $('comments-empty')?.classList.add('hidden');
    const list = $('comments-list');
    if (list) { list.appendChild(renderComment(result.comment)); list.scrollTop = list.scrollHeight; }

    if (nameField) nameField.value = '';
    if (bodyField) bodyField.value = '';
    const bodyCount = $('comment-body-count'); if (bodyCount) bodyCount.textContent = '0 / 500';

    const newCount = typeof result.commentCount === 'number' ? result.commentCount : null;
    if (activeCommentBtn) {
      const countEl = activeCommentBtn.querySelector('.comment-count');
      if (countEl) {
        const current = newCount !== null ? newCount : (parseInt(countEl.textContent, 10) || 0) + 1;
        countEl.textContent = current + ' Comments';
      }
    }
    toast('Reply posted!', 'success');
  }

  /* ═══════════════════════ likes ═══════════════════════ */

  const likedButtons = new WeakSet();
  async function handleLikeClick(btn) {
    if (likedButtons.has(btn)) return;
    likedButtons.add(btn);

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
        console.warn('[youth-board] like failed to save:', e);
        toast('Your like didn\u2019t save — check your connection.', 'error');
      }
    }
  }

  /* ═══════════════════════ filters ═══════════════════════ */

  const FILTER_ACTIVE   = ['bg-primary', 'text-on-primary'];
  const FILTER_INACTIVE = ['bg-surface-container-low', 'text-on-surface-variant'];

  function applyFilter(filter) {
    const cards = document.querySelectorAll('#discussions-list article[data-category]');
    let anyVisible = false;
    cards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    $('empty-state')?.classList.toggle('hidden', anyVisible);
  }

  function handleFilterClick(btn) {
    const filter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.setAttribute('aria-pressed', 'false');
      b.classList.remove(...FILTER_ACTIVE);
      b.classList.add(...FILTER_INACTIVE);
    });
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.remove(...FILTER_INACTIVE);
    btn.classList.add(...FILTER_ACTIVE);
    applyFilter(filter);
  }

  /* ═══════════════════════ read more ═══════════════════════ */

  function handleReadMoreClick(btn) {
    const p = btn.previousElementSibling;
    if (!p) return;
    const expanded = p.classList.toggle('expanded');
    p.classList.toggle('line-clamp-2', !expanded);
    btn.textContent = expanded ? 'Show less' : 'Read more';
  }

  /* ═══════════════════════ load discussions from API ═══════════════════════ */

  async function loadDiscussions() {
    const list = $('discussions-list');
    if (!list) return;
    try {
      const res = await fetch('/api/discussions');
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return;

      list.querySelectorAll('article').forEach(a => a.remove());

      data.forEach(d => {
        const card = document.createElement('article');
        card.className        = 'discussion-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/30 sacred-shadow';
        card.dataset.category = d.category;
        card.dataset.id       = d._id;
        card.innerHTML =
          '<div class="flex items-center gap-3 mb-4">' +
            '<div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-bold text-on-secondary-container flex-shrink-0" aria-label="' + escHtml(d.name) + '">' + escHtml(initialsOf(d.name)) + '</div>' +
            '<div><h4 class="font-label-md text-label-md text-primary">' + escHtml(d.name) + '</h4>' +
            '<p class="text-[12px] text-on-surface-variant uppercase tracking-tighter">' + timeAgo(d.createdAt) + ' in ' + escHtml(d.category) + '</p></div></div>' +
          '<span class="card-category">' + escHtml(d.category) + '</span>' +
          '<h3 class="font-headline-md text-headline-md text-primary mb-3 leading-tight">' + escHtml(d.title) + '</h3>' +
          '<p class="card-body font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-2">' + escHtml(d.body) + '</p>' +
          '<button class="read-more-btn">Read more</button>' +
          '<div class="flex items-center gap-6 mt-4">' +
            commentButtonHtml(d._id, d.title, d.comments || 0) +
            '<button class="like-btn flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors" aria-label="Like this post" data-count="' + (d.likes || 0) + '" data-id="' + escHtml(d._id) + '">' +
              '<span class="material-symbols-outlined text-[20px]">favorite</span>' +
              '<span class="font-label-md like-count">' + (d.likes || 0) + ' Likes</span></button></div>';

        const emptyState = $('empty-state');
        if (emptyState) list.insertBefore(card, emptyState); else list.appendChild(card);
      });

      $('empty-state')?.classList.add('hidden');

      const activeFilterBtn = document.querySelector('.filter-btn[aria-pressed="true"]');
      if (activeFilterBtn) applyFilter(activeFilterBtn.dataset.filter);
    } catch (err) {
      console.warn('[youth-board] loadDiscussions failed:', err);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     THE ACTUAL FIX — one capturing click listener on `document`.
     Registered as early as this script can run. Must be the FIRST
     <script> tag on the page (before sda.js) so this listener is added
     before any competing one, guaranteeing it fires first on every click.
  ═══════════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    const t = e.target;

    // "Start a Discussion" — sidebar CTA, floating FAB, and the
    // empty-state CTA all share onclick="openModal()".
    if (t.closest('[onclick="openModal()"]')) {
      e.preventDefault(); e.stopImmediatePropagation(); openDiscussionModal(); return;
    }

    if (t.closest('#discussion-modal .modal-close-btn, #discussion-modal [onclick="closeModal()"]')) {
      e.preventDefault(); e.stopImmediatePropagation(); closeDiscussionModal(); return;
    }

    if (t.closest('#discussion-modal .modal-backdrop')) {
      e.stopImmediatePropagation(); closeDiscussionModal(); return;
    }

    if (t.closest('#disc-submit-btn')) {
      e.preventDefault(); e.stopImmediatePropagation(); submitDiscussion(); return;
    }

    const commentBtn = t.closest('.comment-count-btn');
    if (commentBtn) {
      e.preventDefault(); e.stopImmediatePropagation();
      openCommentsModal(commentBtn.dataset.id || '', commentBtn.dataset.title || 'Discussion', commentBtn);
      return;
    }

    if (t.closest('#comments-modal .modal-close-btn, #comments-modal [onclick="closeCommentsModal()"]')) {
      e.preventDefault(); e.stopImmediatePropagation(); closeCommentsModal(); return;
    }

    if (t.closest('#comments-modal .modal-backdrop')) {
      e.stopImmediatePropagation(); closeCommentsModal(); return;
    }

    if (t.closest('#comment-submit-btn')) {
      e.preventDefault(); e.stopImmediatePropagation(); submitComment(); return;
    }

    const likeBtn = t.closest('.like-btn');
    if (likeBtn) { e.preventDefault(); e.stopImmediatePropagation(); handleLikeClick(likeBtn); return; }

    const filterBtn = t.closest('.filter-btn');
    if (filterBtn) { e.preventDefault(); e.stopImmediatePropagation(); handleFilterClick(filterBtn); return; }

    const readMoreBtn = t.closest('.read-more-btn');
    if (readMoreBtn) { e.preventDefault(); e.stopImmediatePropagation(); handleReadMoreClick(readMoreBtn); return; }
  }, true); // <-- capture phase. This is the whole trick.

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('discussion-modal')?.classList.contains('open')) closeDiscussionModal();
    if ($('comments-modal')?.classList.contains('open')) closeCommentsModal();
  });

  /* ── char counters ── */
  function wireCounters() {
    const titleField = $('disc-title'), bodyField = $('disc-body');
    if (titleField) titleField.addEventListener('input', function () {
      const len = this.value.length, el = $('title-count');
      if (el) { el.textContent = len + ' / 100'; el.classList.toggle('near-limit', len > 80); }
    });
    if (bodyField) bodyField.addEventListener('input', function () {
      const len = this.value.length, el = $('body-count');
      if (el) { el.textContent = len + ' / 1000'; el.classList.toggle('near-limit', len > 850); }
    });
    const commentBodyField = $('comment-body');
    if (commentBodyField) commentBodyField.addEventListener('input', function () {
      const len = this.value.length, el = $('comment-body-count');
      if (el) { el.textContent = len + ' / 500'; el.classList.toggle('near-limit', len > 425); }
    });
  }

  /* ── init ── */
  function init() {
    if (document.body.dataset.page !== 'youth') return; // youth.html only

    const yearEl = $('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    wireCounters();
    loadDiscussions();

    console.log(
      '%c✦ youth-board.js loaded (standalone, sda.js-independent)',
      'color:#e6c364;background:#041534;padding:6px 14px;border-radius:4px;font-weight:600;'
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposed as a fallback in case anything still calls these by name
  // directly — harmless even if both fire, since the capturing listener
  // above already stops the click before any inline onclick on the same
  // element would get a chance to run a second time.
  window.openModal          = openDiscussionModal;
  window.closeModal         = closeDiscussionModal;
  window.submitDiscussion   = submitDiscussion;
  window.openCommentsModal  = openCommentsModal;
  window.closeCommentsModal = closeCommentsModal;
  window.submitComment      = submitComment;

})();