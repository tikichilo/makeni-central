/* ═══════════════════════════════════════════
   GALLERY — Makeni Central SDA
   Home page photo gallery: filterable grid + lightbox viewer.
   Photos are managed from the admin dashboard (Gallery section) and
   served from GET /api/gallery — nothing to edit in this file when
   adding or removing photos.
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const CATEGORY_LABELS = {
    worship:   'Worship',
    youth:     'Youth',
    community: 'Community',
    baptism:   'Baptism',
    events:    'Events'
  };

  const grid       = document.getElementById('gallery-grid');
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');
  const lightbox   = document.getElementById('gallery-lightbox');

  // Gallery isn't on every page — bail quietly if this page has none of it.
  if (!grid || !lightbox) return;

  const lbFrame = document.getElementById('gallery-lightbox-frame');
  const lbTitle = document.getElementById('gallery-lightbox-title');
  const lbTag   = document.getElementById('gallery-lightbox-tag');
  const lbClose = document.getElementById('gallery-lightbox-close');
  const lbPrev  = document.getElementById('gallery-lightbox-prev');
  const lbNext  = document.getElementById('gallery-lightbox-next');

  let photos        = [];   // raw list from the server
  let currentFilter = 'all';
  let currentIndex  = 0;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Cycles a "tall" / "wide" span onto some tiles for visual variety —
  // purely cosmetic, works regardless of how many photos exist.
  function sizeFor(i) {
    if (i % 7 === 0) return 'tall';
    if (i % 5 === 3) return 'wide';
    return '';
  }

  async function loadPhotos() {
    grid.innerHTML = '<p class="gallery-status">Loading photos…</p>';
    try {
      const res = await fetch('/api/gallery');
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      photos = await res.json();
      render();
    } catch (err) {
      console.warn('[gallery] could not load photos:', err);
      grid.innerHTML = '<p class="gallery-status">Photos couldn\u2019t be loaded right now — please check back soon.</p>';
    }
  }

  function render() {
    if (!photos.length) {
      grid.innerHTML = '<p class="gallery-status">Photos coming soon — check back after our next service!</p>';
      return;
    }

    grid.innerHTML = photos.map(function (item, i) {
      const sizeClass = sizeFor(i) ? ' ' + sizeFor(i) : '';
      return (
        '<div class="gallery-item' + sizeClass + '" data-category="' + item.category + '" data-index="' + i + '" ' +
             'tabindex="0" role="button" aria-label="View photo: ' + escapeHtml(item.title) + '">' +
          '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.title) + '" loading="lazy">' +
          '<div class="gallery-caption">' +
            '<div class="cap-title">' + escapeHtml(item.title) + '</div>' +
            '<span class="cap-tag">' + (CATEGORY_LABELS[item.category] || item.category) + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    grid.querySelectorAll('.gallery-item').forEach(function (el) {
      el.addEventListener('click', function () {
        openLightbox(Number(el.dataset.index));
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(Number(el.dataset.index));
        }
      });
    });

    applyFilter();
  }

  function applyFilter() {
    grid.querySelectorAll('.gallery-item').forEach(function (el) {
      const match = currentFilter === 'all' || el.dataset.category === currentFilter;
      el.classList.toggle('gallery-hide', !match);
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentFilter = btn.dataset.filter;
      applyFilter();
    });
  });

  /* ── Lightbox ── */
  function visibleIndexes() {
    return photos
      .map(function (item, i) { return i; })
      .filter(function (i) {
        return currentFilter === 'all' || photos[i].category === currentFilter;
      });
  }

  function showAt(index) {
    const item = photos[index];
    currentIndex = index;

    lbFrame.innerHTML = '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.title) + '">';
    lbTitle.textContent = item.title;
    lbTag.textContent   = CATEGORY_LABELS[item.category] || item.category;
  }

  function openLightbox(index) {
    showAt(index);
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (lbClose) lbClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function step(dir) {
    const indexes = visibleIndexes();
    if (!indexes.length) return;
    const pos = indexes.indexOf(currentIndex);
    const nextPos = (pos + dir + indexes.length) % indexes.length;
    showAt(indexes[nextPos]);
  }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev)  lbPrev.addEventListener('click', function () { step(-1); });
  if (lbNext)  lbNext.addEventListener('click', function () { step(1); });

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  loadPhotos();
})();