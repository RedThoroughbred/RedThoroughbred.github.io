/* Seal site: the theme toggle, copy buttons on commands, and things rising into place.
   No libraries, no network requests beyond this site's own files. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const systemLight = () => matchMedia('(prefers-color-scheme: light)').matches;

  /* ---- Theme: follows the system until the visitor picks; picking the system's own theme
     forgets the choice, so the page follows the system again. ---- */
  const current = () => root.dataset.theme || (systemLight() ? 'light' : 'dark');
  const label = (b) => b.setAttribute('aria-label', current() === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
  document.querySelectorAll('.theme').forEach((b) => {
    label(b);
    b.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      const system = systemLight() ? 'light' : 'dark';
      try {
        if (next === system) { delete root.dataset.theme; localStorage.removeItem('seal-theme'); }
        else { root.dataset.theme = next; localStorage.setItem('seal-theme', next); }
      } catch (e) { root.dataset.theme = next; }
      document.querySelectorAll('.theme').forEach(label);
    });
  });

  /* ---- On a narrow screen the header's links scroll sideways: show the current one ---- */
  const nav = document.querySelector('header.top nav');
  const here = nav && nav.querySelector('a[aria-current]');
  if (nav && here && nav.scrollWidth > nav.clientWidth) {
    nav.scrollLeft = Math.max(0, here.offsetLeft - nav.offsetLeft - (nav.clientWidth - here.offsetWidth) / 2);
  }

  /* ---- Copy buttons: hidden until this script runs, so they never sit there doing nothing ---- */
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok;
  };
  document.querySelectorAll('.code .copy').forEach((button) => {
    const code = button.parentElement.querySelector('code');
    const word = button.querySelector('span');
    if (!code || !word) return;
    button.hidden = false;
    let timer = 0;
    button.addEventListener('click', async () => {
      const ok = await copyText(code.textContent);
      word.textContent = ok ? 'Copied' : 'Select and copy';
      button.classList.toggle('done', ok);
      clearTimeout(timer);
      timer = setTimeout(() => { word.textContent = 'Copy'; button.classList.remove('done'); }, 1800);
    });
  });

  /* ---- Rising into place ---- */
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('main .split, main .trio, main .points, main .looks, main .ledger, main .halves, main .doors, main .lockflow, main .twocol, main ol.gindex').forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) return; // already in view: leave it be
      el.classList.add('reveal');
      io.observe(el);
    });
  }
})();
