/* Shared footer for every public page. */
(function installSiteFooter() {
  'use strict';

  const existingFooter = document.querySelector('footer');
  if (existingFooter) existingFooter.remove();

  const style = document.createElement('style');
  style.textContent = `
    .site-footer {
      background: #041534;
      color: #fff;
      border-top: 4px solid #e6c364;
      margin-top: 0;
    }
    .site-footer-inner {
      width: min(1280px, calc(100% - 48px));
      margin: 0 auto;
      padding: 64px 0 36px;
    }
    .site-footer-grid {
      display: grid;
      grid-template-columns: minmax(240px, 1.35fr) repeat(2, minmax(160px, 0.8fr)) minmax(240px, 1fr);
      gap: 48px;
    }
    .site-footer-brand {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 18px;
    }
    .site-footer-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      color: #041534;
      background: #e6c364;
      border-radius: 12px;
    }
    .site-footer-brand-name {
      margin: 0;
      color: #fff;
      font: 600 22px/1.2 Fraunces, Georgia, serif;
    }
    .site-footer-kicker {
      margin: 0;
      max-width: 290px;
      color: rgba(255,255,255,.68);
      font: 400 14px/1.75 Inter, sans-serif;
    }
    .site-footer-heading {
      margin: 4px 0 18px;
      color: #e6c364;
      font: 700 11px/1.2 Inter, sans-serif;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    .site-footer-list {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .site-footer a {
      color: rgba(255,255,255,.72);
      font: 500 14px/1.45 Inter, sans-serif;
      text-decoration: none;
      transition: color .2s ease, transform .2s ease;
    }
    .site-footer a:hover,
    .site-footer a:focus-visible { color: #fed977; }
    .site-footer-list a { display: inline-flex; align-items: center; gap: 8px; }
    .site-footer-contact {
      display: grid;
      gap: 14px;
    }
    .site-footer-contact a { display: flex; align-items: flex-start; gap: 10px; }
    .site-footer-contact .material-symbols-outlined { color: #e6c364; font-size: 20px; }
    .site-footer-socials { display: flex; gap: 10px; margin-top: 6px; }
    .site-footer-social {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      color: #fff !important;
      background: rgba(255,255,255,.1);
      border-radius: 10px;
    }
    .site-footer-social:hover,
    .site-footer-social:focus-visible { color: #041534 !important; background: #fed977; }
    .site-footer-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-top: 54px;
      padding-top: 22px;
      border-top: 1px solid rgba(255,255,255,.14);
    }
    .site-footer-bottom p {
      margin: 0;
      color: rgba(255,255,255,.5);
      font: 400 12px/1.5 Inter, sans-serif;
    }
    .site-footer-bottom a { color: rgba(255,255,255,.55); font-size: 12px; }
    @media (max-width: 900px) {
      .site-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 38px 28px; }
      .site-footer-brand { grid-column: 1 / -1; }
    }
    @media (max-width: 520px) {
      .site-footer-inner { width: min(100% - 40px, 420px); padding: 48px 0 28px; }
      .site-footer-grid { grid-template-columns: 1fr; gap: 30px; }
      .site-footer-brand { grid-column: auto; }
      .site-footer-bottom { align-items: flex-start; flex-direction: column; gap: 10px; margin-top: 38px; }
    }
  `;
  document.head.appendChild(style);

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.setAttribute('role', 'contentinfo');
  footer.innerHTML = `
    <div class="site-footer-inner">
      <div class="site-footer-grid">
        <div class="site-footer-brand">
          <span class="site-footer-mark" aria-hidden="true"><span class="material-symbols-outlined">church</span></span>
          <div>
            <p class="site-footer-brand-name">Makeni Central Church</p>
            <p class="site-footer-kicker">A community of faith, service, and hope in Lusaka, Zambia.</p>
          </div>
        </div>

        <nav aria-label="Footer explore links">
          <h2 class="site-footer-heading">Explore</h2>
          <ul class="site-footer-list" role="list">
            <li><a href="index.html">Home</a></li>
            <li><a href="index.html#gallery">Gallery</a></li>
            <li><a href="news.html">News</a></li>
            <li><a href="departments.html">Ministries</a></li>
          </ul>
        </nav>

        <nav aria-label="Footer community links">
          <h2 class="site-footer-heading">Community</h2>
          <ul class="site-footer-list" role="list">
            <li><a href="index.html#watch-live">Watch Live</a></li>
            <li><a href="youth.html">Youth Board</a></li>
            <li><a href="building.html">New Building</a></li>
            <li><a href="index.html#plan-visit-btn">Plan a Visit</a></li>
          </ul>
        </nav>

        <div class="site-footer-contact">
          <h2 class="site-footer-heading">Connect</h2>
          <a href="https://maps.google.com/?q=Makeni+Road,+Lusaka" target="_blank" rel="noopener noreferrer">
            <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
            <span>Makeni Road, Lusaka</span>
          </a>
          <a href="mailto:info@makenicentralsda.org">
            <span class="material-symbols-outlined" aria-hidden="true">mail</span>
            <span>info@makenicentralsda.org</span>
          </a>
          <a href="tel:+260977695623">
            <span class="material-symbols-outlined" aria-hidden="true">call</span>
            <span>0977 695 623</span>
          </a>
          <div class="site-footer-socials">
            <a class="site-footer-social" href="https://web.facebook.com/profile.php?id=100091185906540" target="_blank" rel="noopener noreferrer" aria-label="Makeni Central Church on Facebook">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z"/></svg>
            </a>
          </div>
        </div>
      </div>

      <div class="site-footer-bottom">
        <p>&copy; <span data-footer-year></span> Makeni Central Church. All rights reserved.</p>
        <a href="developer.html">Website by the Makeni Central team</a>
      </div>
    </div>`;

  document.body.appendChild(footer);
  footer.querySelector('[data-footer-year]').textContent = new Date().getFullYear();
})();
