/* ═══════════════════════════════════════════════
   DEPARTMENT DETAIL PAGE — shared behavior
   ═══════════════════════════════════════════════

   Call button: the phone number is split across three
   data-attributes (data-p1 / data-p2 / data-p3) instead of
   sitting in the page as one plain string, so it doesn't show
   up as a readable number to scrapers viewing the HTML source.

   On click, the three parts are joined and used to open the
   device's phone app via a tel: link — the visitor sees the
   real number appear in their own phone's call screen, not on
   the page itself.

   TO SET A REAL NUMBER: edit the data-p1/data-p2/data-p3
   attributes on the .call-btn element in the HTML — e.g. for
   +260 978 918 196, split it any way you like:
     data-p1="+260978" data-p2="918" data-p3="196"
*/

document.querySelectorAll('.call-btn').forEach((btn) => {
  btn.addEventListener('click', function (e) {
    e.preventDefault();

    const p1 = btn.dataset.p1 || '';
    const p2 = btn.dataset.p2 || '';
    const p3 = btn.dataset.p3 || '';
    const number = (p1 + p2 + p3).trim();

    if (!number) return; // no number configured yet — placeholder page

    const label = btn.querySelector('.call-label');
    if (label) label.textContent = 'Calling…';
    btn.classList.add('is-revealed');

    // Small delay so people register the state change before the
    // phone app takes over the screen.
    window.setTimeout(() => {
      window.location.href = 'tel:' + number;
      if (label) label.textContent = 'Tap to call again';
    }, 180);
  });
});

/* ── Hero photo: feed the leader photo into the blurred hero background ──
   Reads the src straight off the .leader-photo img already in the page,
   so nothing needs to be duplicated or hardcoded per department page. */
(function wireHeroPhoto(){
  const hero = document.querySelector('.dept-hero');
  const photo = document.querySelector('.leader-photo');
  const src = photo && photo.getAttribute('src');
  if (!hero || !src) return;
  hero.style.setProperty('--hero-photo', `url("${src}")`);
})();

/* ── Leader photo lightbox ──
   Clicking (or Enter/Space on) the leader photo opens a full-size popup.
   One lightbox element is built and reused, even if a page somehow has
   more than one leader photo. */
(function wirePhotoLightbox(){
  const frames = document.querySelectorAll('.leader-photo-frame');
  if (!frames.length) return;

  const lightbox = document.createElement('div');
  lightbox.className = 'photo-lightbox';
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.innerHTML = `
    <button class="photo-lightbox-close" aria-label="Close photo">
      <span class="material-symbols-outlined" aria-hidden="true">close</span>
    </button>
    <img class="photo-lightbox-img" src="" alt="">
  `;
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('.photo-lightbox-img');
  const closeBtn = lightbox.querySelector('.photo-lightbox-close');
  let lastFocused = null;

  function openLightbox(img){
    lightboxImg.src = img.getAttribute('src');
    lightboxImg.alt = img.getAttribute('alt') || '';
    lastFocused = document.activeElement;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox(){
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  frames.forEach((frame) => {
    const img = frame.querySelector('img');
    if (!img) return;

    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('aria-label', `View full photo of ${img.alt || 'department leader'}`);

    frame.addEventListener('click', () => openLightbox(img));
    frame.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(img);
      }
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
  });
})();

/* ── Scroll reveal ──
   Sections fade/slide in as they enter view. Falls back to "just show
   everything" for browsers without IntersectionObserver or when the
   visitor has reduced motion set. */
(function wireScrollReveal(){
  const targets = document.querySelectorAll('.dept-section, .leader-card');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  targets.forEach((el) => observer.observe(el));
})();