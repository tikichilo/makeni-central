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
