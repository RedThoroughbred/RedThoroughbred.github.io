/* RedSynth Pad site: the theme toggle, things rising into place, and the opening's sound.
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
        if (next === system) { delete root.dataset.theme; localStorage.removeItem('rs-theme'); }
        else { root.dataset.theme = next; localStorage.setItem('rs-theme', next); }
      } catch (e) { root.dataset.theme = next; }
      document.querySelectorAll('.theme').forEach(label);
      document.dispatchEvent(new CustomEvent('rs-theme'));
    });
  });

  /* ---- Rising into place ---- */
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('main section .split, main section .grid, main .strip, main .facts, main .pair, main .nums, main ol.steps, main .doorway, main .price, .step .two, .roles, .flow').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight) return; // already in view: leave it be
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  /* ---- The opening: a muted film loops; Sound on plays RedSynth's piece in time with it.
     The piece was written to the film: its 10.8 s loop strikes at 4.5 s, and a phrase of four
     bars (2.7 s each) starts on every strike. Nothing sounds until the visitor asks. ---- */
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;
  const film = stage.querySelector('video');
  const music = stage.querySelector('audio');
  const button = stage.querySelector('.sound');
  const word = button.querySelector('.word');
  const hint = button.querySelector('small');
  const scan = stage.querySelector('.scanline');
  const bars = [...button.querySelectorAll('.bars i')];
  const LOOP = 10.8, BAR = 2.7;
  const FIRST = 4.5; // A's piece was written to a strike at 4.5 s
  // A's film strikes at 4.62 s (the app's own timing), its piece at 4.5 s: the film runs that much
  // ahead of the music so the two strike together.
  const LEAD = 0.12;

  if (reduced && film) { film.removeAttribute('autoplay'); film.pause(); }

  let ctx = null, analyser = null, data = null, raf = 0, level = 0, waiting = false;
  music.addEventListener('playing', () => {
    if (!waiting) return;
    waiting = false;
    if (film) { film.currentTime = (music.currentTime + LEAD) % LOOP; film.play().catch(() => {}); }
  });
  const wire = () => {
    if (ctx || !window.AudioContext) return;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(music);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      data = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      analyser.connect(ctx.destination);
    } catch (e) { ctx = null; analyser = null; }
  };

  const ripple = () => {
    if (reduced) return;
    const s = stage.getBoundingClientRect(), b = button.getBoundingClientRect();
    const size = Math.hypot(s.width, s.height) * 2;
    for (let i = 0; i < 3; i++) {
      const r = document.createElement('span');
      r.className = 'ripple';
      r.style.cssText = `left:${b.left - s.left + b.width / 2}px;top:${b.top - s.top + b.height / 2}px;width:${size}px;height:${size}px;animation-delay:${i * 0.22}s`;
      stage.querySelector('.screen').appendChild(r);
      setTimeout(() => r.remove(), 2600);
    }
  };

  const setState = (state) => {
    stage.classList.toggle('playing', state === 'playing');
    if (state === 'playing') { word.textContent = 'Sound off'; button.setAttribute('aria-pressed', 'true'); }
    else {
      word.textContent = state === 'ended' ? 'Play it again' : 'Sound on';
      button.setAttribute('aria-pressed', 'false');
      stage.style.setProperty('--level', 0);
      if (scan) scan.style.opacity = 0;
    }
    if (hint) hint.textContent = state === 'playing' ? 'RedSynth, playing these two pictures' : '39 s, played by RedSynth';
  };

  const tick = () => {
    const t = music.currentTime;
    // Keep the film on the music's clock.
    if (film && !waiting && !film.seeking && film.readyState > 1) {
      const want = (t + LEAD) % LOOP;
      if (Math.abs(film.currentTime - want) > 0.12) film.currentTime = want;
      if (film.paused) film.play().catch(() => {});
    }
    // The light follows the music's loudness.
    let target = 0;
    if (analyser) {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      target = Math.min(1, Math.sqrt(sum / data.length) * 4.5);
    } else {
      target = 0.35 + 0.25 * Math.sin(t * 2.3);
    }
    level += (target - level) * (target > level ? 0.35 : 0.08);
    if (!reduced) stage.style.setProperty('--level', level.toFixed(3));
    bars.forEach((bar, i) => {
      const b = Math.min(1, level * (0.7 + 0.5 * Math.abs(Math.sin(t * (5 + i * 1.7) + i))));
      bar.style.setProperty('--b', b.toFixed(2));
    });
    // The scan line crosses the film once a bar, from the first strike on.
    if (scan && !reduced) {
      if (t >= FIRST) {
        const p = ((t - FIRST) / BAR) % 1;
        scan.style.transform = `translateX(${p * stage.clientWidth}px)`;
        scan.style.opacity = (0.25 + 0.6 * level).toFixed(2);
      } else scan.style.opacity = 0;
    }
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    wire();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    music.currentTime = 0;
    // The film waits at its first frame until the music is really playing (it may still be
    // loading), then both start together.
    if (film) { film.pause(); film.currentTime = 0; }
    waiting = true;
    const p = music.play();
    setState('playing');
    ripple();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    if (p && p.catch) p.catch(() => { setState('idle'); if (hint) hint.textContent = 'The browser would not play it'; });
  };
  const stop = (state) => {
    music.pause();
    cancelAnimationFrame(raf);
    setState(state);
    if (reduced && film) film.pause();
  };

  button.addEventListener('click', () => (stage.classList.contains('playing') ? stop('idle') : start()));
  music.addEventListener('ended', () => stop('ended'));
  setState('idle');
})();

/* See it play: films autoplay muted while on screen (not with reduced motion); one plays with sound at a time. */
(() => {
  const vids = [...document.querySelectorAll('.film video')];
  if (!vids.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else { v.pause(); }
    }), { threshold: 0.35 });
    vids.forEach((v) => io.observe(v));
  }
  document.querySelectorAll('.film-sound').forEach((b) => b.addEventListener('click', () => {
    const v = b.parentElement.querySelector('video');
    const on = v.muted;
    vids.forEach((o) => { o.muted = true; const ob = o.parentElement.querySelector('.film-sound'); ob.textContent = 'Sound on'; ob.setAttribute('aria-pressed', 'false'); });
    const opening = document.querySelector('[data-stage] audio');
    if (on) {
      if (opening && !opening.paused) { const sb = document.querySelector('[data-stage] .sound'); if (sb) sb.click(); else opening.pause(); }
      v.muted = false; v.currentTime = 0; v.play().catch(() => {});
      b.textContent = 'Sound off'; b.setAttribute('aria-pressed', 'true');
    }
  }));
})();

/* The guide: "you are here" in the chapter list (the section in view is lit), and a Top button
   on long pages once you are well down them. */
(() => {
  const subs = [...document.querySelectorAll('.toc a.sub[href^="#"]')];
  const targets = subs.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (targets.length) {
    const light = () => {
      // The last section whose heading has passed the upper part of the screen.
      let current = null;
      for (const t of targets) { if (t.getBoundingClientRect().top < innerHeight * 0.45) current = t; }
      subs.forEach((a) => a.classList.toggle('here', current && a.getAttribute('href') === '#' + current.id));
    };
    addEventListener('scroll', () => requestAnimationFrame(light), { passive: true });
    light();
  }
  const main = document.querySelector('.doc main');
  if (!main) return;
  const top = document.createElement('a');
  top.className = 'fab-top';
  top.href = '#main';
  top.textContent = '↑ Top';
  top.setAttribute('aria-label', 'Back to the top of the page');
  top.hidden = true;
  document.body.appendChild(top);
  const check = () => {
    const long = document.documentElement.scrollHeight > innerHeight * 3;
    top.hidden = !(long && scrollY > innerHeight * 1.5);
  };
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  check();
})();
