/* How it works: every figure drawn from assets/how/how.json, the numbers RedSynth's engine
   computed for the sunset (tests/site_media.rs in the engine's repo wrote them, through the
   same calls the app makes). Nothing here is made up: where a curve is a formula, it is the
   engine's formula (photo_object.rs, vowel_of_hue). Canvas 2D only, no libraries. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const PAL = ['#f0b45a', '#ff8a4c', '#e678c0', '#9276f2', '#5a90f5', '#4cc8da'];
  const INK = 'rgba(255,255,255,.88)', INK2 = 'rgba(255,255,255,.55)', INK3 = 'rgba(255,255,255,.22)';
  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  /** A canvas sized to its box at the screen's density; returns [ctx, width, height]. */
  function fit(c, h) {
    const w = c.clientWidth || c.parentNode.clientWidth;
    const d = DPR();
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    c.style.height = h + 'px';
    const g = c.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    return [g, w, h];
  }
  /** The heat ramp of the app's screens: black, violet, pink, amber, white. */
  const STOPS = [[0, [7, 8, 10]], [0.22, [40, 26, 86]], [0.45, [128, 80, 210]], [0.65, [230, 120, 192]], [0.84, [240, 180, 90]], [1, [255, 246, 226]]];
  function heat(t) {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) {
        const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
        const f = (t - a) / (b - a);
        return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * f));
      }
    }
    return STOPS[STOPS.length - 1][1];
  }
  function noteOf(ratio, base) {
    const m = base + 12 * Math.log2(ratio);
    const n = Math.round(m);
    const cents = Math.round((m - n) * 100);
    return { name: NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1), cents };
  }
  const fmtCents = (c) => (c === 0 ? '±0' : (c > 0 ? '+' : '−') + Math.abs(c)) + ' ct';

  /* One clip at a time, for every Play button on the page. */
  let clip = null, clipBtn = null;
  function playClip(btn) {
    const src = btn.dataset.audio;
    if (clipBtn === btn && clip && !clip.paused) { clip.pause(); btn.setAttribute('aria-pressed', 'false'); return; }
    if (clip) { clip.pause(); if (clipBtn) clipBtn.setAttribute('aria-pressed', 'false'); }
    clip = new Audio(src); clipBtn = btn;
    btn.setAttribute('aria-pressed', 'true');
    clip.addEventListener('ended', () => btn.setAttribute('aria-pressed', 'false'));
    clip.play().catch(() => btn.setAttribute('aria-pressed', 'false'));
    btn.dispatchEvent(new CustomEvent('clip-start', { bubbles: true }));
  }
  document.querySelectorAll('.play[data-audio]').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => playClip(b));
  });

  fetch('assets/how/how.json').then((r) => r.json()).then(start).catch(() => {
    document.querySelectorAll('.scope canvas').forEach((c) => { c.style.display = 'none'; });
  });

  function start(D) {
    const draws = [];
    const redraw = () => draws.forEach((f) => f());
    let rt = 0;
    new ResizeObserver(() => { cancelAnimationFrame(rt); rt = requestAnimationFrame(redraw); }).observe(document.querySelector('main'));

    /* ---------- 1. The five measures ---------- */
    {
      const c = $('c-reading'), r = D.reading;
      const rows = [['Warm', (r.warmth + 1) / 2, r.warmth.toFixed(2), 'cool', 'warm'], ['Colourful', r.colourful, r.colourful.toFixed(2), 'grey', 'pure colour'],
        ['Busy', r.busy, r.busy.toFixed(2), 'flat', 'every pixel differs'], ['Bright', r.bright, r.bright.toFixed(2), 'black', 'white'], ['Contrast', r.contrast, r.contrast.toFixed(2), 'flat', 'half black, half white']];
      draws.push(() => {
        const [g, w] = fit(c, 250);
        const x0 = 96, x1 = w - 56, top = 46;
        rows.forEach(([name, v, txt, lo, hi], i) => {
          const y = top + i * 40;
          g.fillStyle = INK; g.font = '600 14px -apple-system,system-ui,sans-serif'; g.textBaseline = 'middle';
          g.fillText(name, 14, y);
          g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(x0, y - 5, x1 - x0, 10, 5); g.fill();
          const grd = g.createLinearGradient(x0, 0, x1, 0);
          PAL.forEach((p, k) => grd.addColorStop(k / (PAL.length - 1), p));
          g.fillStyle = grd; g.beginPath(); g.roundRect(x0, y - 5, Math.max(10, (x1 - x0) * v), 10, 5); g.fill();
          g.fillStyle = INK; g.font = '600 13px ui-monospace,Menlo,monospace'; g.textAlign = 'right'; g.fillText(txt, w - 12, y); g.textAlign = 'left';
          g.fillStyle = INK2; g.font = '11px -apple-system,system-ui,sans-serif';
          g.fillText(lo, x0, y + 14); g.textAlign = 'right'; g.fillText(hi, x1, y + 14); g.textAlign = 'left';
        });
      });
    }

    /* ---------- 2. A row is a wave ---------- */
    {
      const pick = $('c-pick'), wave = $('c-wave'), input = $('row'), out = $('row-out');
      let row = D.salient_row; // the row the eye goes to first
      input.value = row + 1;
      // The row's colours, from the picture itself, to colour the wave.
      const img = new Image(); let px = null;
      img.onload = () => { const o = document.createElement('canvas'); o.width = 256; o.height = 64; const og = o.getContext('2d'); og.drawImage(img, 0, 0); try { px = og.getImageData(0, 0, 256, 64).data; } catch (e) { px = null; } redrawRows(); };
      img.src = 'assets/how/sunset-picture.png';
      let phase = 0;
      const drawPick = () => {
        const w = pick.clientWidth, h = pick.clientHeight, d = DPR();
        pick.width = w * d; pick.height = h * d;
        const g = pick.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
        const rh = h / 64, y = row * rh;
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, w, y); g.fillRect(0, y + rh, w, h - y - rh);
        g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.shadowColor = '#f0b45a'; g.shadowBlur = 10;
        g.strokeRect(0.75, y - 0.5, w - 1.5, rh + 1); g.shadowBlur = 0;
      };
      const drawWave = () => {
        const [g, w, h] = fit(wave, Math.round(Math.min(260, Math.max(170, wave.clientWidth * 0.4))));
        const vals = D.rows[row];
        const cycle = vals.concat(vals.slice().reverse()); // there and back: one cycle of 512
        const mean = cycle.reduce((a, b) => a + b, 0) / cycle.length;
        let peak = 1e-6; cycle.forEach((v) => { peak = Math.max(peak, Math.abs(v - mean)); });
        const pad = 14, mid = h / 2, amp = (h / 2 - pad) * 0.92;
        // the axis and the cycle marks
        g.strokeStyle = INK3; g.lineWidth = 1; g.setLineDash([3, 4]);
        g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();
        g.beginPath(); g.moveTo(w / 2, pad); g.lineTo(w / 2, h - pad); g.stroke(); g.setLineDash([]);
        g.fillStyle = INK2; g.font = '11px -apple-system,system-ui,sans-serif';
        g.fillText('one cycle: across and back', 8, 16); g.fillText('the next cycle', w / 2 + 8, 16);
        const n = cycle.length * 2;
        const X = (i) => (i / (n - 1)) * w;
        const Y = (i) => mid - ((cycle[i % cycle.length] - mean) / peak) * amp;
        // fill under, then the stroke coloured by the pixel it came from
        const fill = g.createLinearGradient(0, pad, 0, h - pad);
        fill.addColorStop(0, 'rgba(230,120,192,.28)'); fill.addColorStop(1, 'rgba(90,144,245,.04)');
        g.beginPath(); g.moveTo(0, mid);
        for (let i = 0; i < n; i++) g.lineTo(X(i), Y(i));
        g.lineTo(w, mid); g.closePath(); g.fillStyle = fill; g.fill();
        g.lineWidth = 2.2; g.lineJoin = 'round';
        for (let i = 1; i < n; i++) {
          const k = i % cycle.length, x = k < 256 ? k : 511 - k;
          g.strokeStyle = px ? `rgb(${Math.min(255, px[(row * 256 + x) * 4] + 40)},${Math.min(255, px[(row * 256 + x) * 4 + 1] + 40)},${Math.min(255, px[(row * 256 + x) * 4 + 2] + 40)})` : INK;
          g.beginPath(); g.moveTo(X(i - 1), Y(i - 1)); g.lineTo(X(i), Y(i)); g.stroke();
        }
        // the read point
        const i = Math.floor(phase * n) % n;
        g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 14;
        g.beginPath(); g.arc(X(i), Y(i), 4.5, 0, 7); g.fill(); g.shadowBlur = 0;
      };
      const redrawRows = () => { out.textContent = `${row + 1} of 64`; drawPick(); drawWave(); };
      draws.push(redrawRows);
      input.addEventListener('input', () => { row = input.value - 1; redrawRows(); });
      const frame = $('pick');
      const choose = (e) => {
        const r = frame.getBoundingClientRect();
        row = Math.max(0, Math.min(63, Math.floor(((e.clientY - r.top) / r.height) * 64)));
        input.value = row + 1; redrawRows();
      };
      let down = false;
      frame.addEventListener('pointerdown', (e) => { down = true; frame.setPointerCapture(e.pointerId); choose(e); });
      frame.addEventListener('pointermove', (e) => { if (down) choose(e); });
      frame.addEventListener('pointerup', () => { down = false; });
      frame.style.cursor = 'ns-resize'; frame.style.touchAction = 'none';
      if (!reduced) {
        let last = 0, visible = false;
        new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(wave);
        const loop = (t) => { if (visible) { phase = (phase + (t - last) / 4000) % 1; drawWave(); } last = t; requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      }
    }

    /* ---------- 3. The strike: the pattern map and the tones ---------- */
    {
      const S = D.spectrum, M = D.modes, n = M.ratio.length;
      const spec = $('c-spec'), chord = $('c-chord'), out = $('mode-out');
      // The heat map, once, at its own resolution; drawn scaled and smoothed.
      const off = document.createElement('canvas'); off.width = S.w; off.height = S.h;
      const og = off.getContext('2d'), im = og.createImageData(S.w, S.h);
      S.v.forEach((v, i) => { const [r, gg, b] = heat(Math.pow(v, 1.35)); im.data.set([r, gg, b, 255], i * 4); });
      og.putImageData(im, 0, 0);
      let hot = 0, ring = null; // the tone pointed at; a strike's start time
      const spot = (i) => [M.spots[2 * i], M.spots[2 * i + 1]];
      // Shown only as wide as the tones reach (a sunset's stripes are nearly all horizontal).
      let uMax = 8; for (let i = 0; i < n; i++) uMax = Math.max(uMax, Math.abs(M.spots[2 * i]));
      const uR = Math.min(S.reach[0], Math.ceil(uMax * 1.6 / 4) * 4);
      const place = (u, v, w, h) => [((u + uR) / (2 * uR)) * w, ((v + S.reach[1]) / (2 * S.reach[1])) * h];
      let geo = [];
      const drawSpec = (now) => {
        const [g, w, h] = fit(spec, Math.round(Math.min(340, spec.clientWidth / 1.7)));
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        const cells = S.w / (2 * S.reach[0]); // cells per cycle across
        g.drawImage(off, (S.reach[0] - uR) * cells, 0, 2 * uR * cells, S.h, 0, 0, w, h);
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
        geo = [];
        const t = ring == null ? null : (now - ring) / 1000;
        for (let i = n - 1; i >= 0; i--) {
          const [u, v] = spot(i), [x, y] = place(u, v, w, h), [mx, my] = place(-u, -v, w, h);
          const col = PAL[i % PAL.length];
          const live = t == null ? 1 : Math.exp(-t / M.decay[i]);
          const r = 4 + 7 * M.level[i] * (t == null ? 1 : 0.6 + 0.9 * live);
          g.globalAlpha = 0.3; g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.arc(mx, my, r * 0.7, 0, 7); g.stroke();
          g.globalAlpha = t == null ? 1 : 0.35 + 0.65 * live;
          g.shadowColor = col; g.shadowBlur = i === hot ? 22 : 10 + 20 * (t == null ? 0 : live);
          g.strokeStyle = i === hot ? '#fff' : col; g.lineWidth = i === hot ? 2.5 : 1.8;
          g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.shadowBlur = 0;
          if (n <= 30 && (i < 8 || i === hot)) { g.fillStyle = INK; g.font = '600 11px ui-monospace,Menlo,monospace'; g.fillText(String(i + 1), x + r + 3, y - r); }
          g.globalAlpha = 1;
          geo[i] = [x, y];
        }
      };
      const top = Math.max(...M.ratio);
      const lx = (ratio, w) => 40 + (Math.log2(ratio) / Math.log2(Math.max(16, top * 1.1))) * (w - 60);
      const drawChord = (now) => {
        const [g, w, h] = fit(chord, 150);
        const base = h - 34, t = ring == null ? null : (now - ring) / 1000;
        g.strokeStyle = INK3; g.lineWidth = 1; g.beginPath(); g.moveTo(30, base); g.lineTo(w - 10, base); g.stroke();
        g.fillStyle = INK2; g.font = '11px -apple-system,system-ui,sans-serif'; g.textAlign = 'center';
        [1, 2, 4, 8, 16].forEach((k) => { const x = lx(k, w); if (x > w - 10) return; g.fillRect(x - 0.5, base, 1, 5); g.fillText(k === 1 ? 'the note' : k + '×', x, base + 18); });
        g.textAlign = 'left';
        for (let i = 0; i < n; i++) {
          const x = lx(M.ratio[i], w), live = t == null ? 1 : Math.exp(-t / M.decay[i]);
          const hgt = (base - 16) * M.level[i] * (t == null ? 1 : 0.15 + 0.85 * live);
          const col = PAL[i % PAL.length];
          g.strokeStyle = i === hot ? '#fff' : col; g.lineWidth = i === hot ? 3 : 2; g.shadowColor = col; g.shadowBlur = 8;
          g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - hgt); g.stroke(); g.shadowBlur = 0;
          g.fillStyle = i === hot ? '#fff' : col; g.beginPath(); g.arc(x, base - hgt, 3 + 3 * Math.min(1, M.decay[i] / 2), 0, 7); g.fill();
        }
      };
      const say = (i) => {
        const nn = noteOf(M.ratio[i], 50);
        out.textContent = `Tone ${i + 1}: ${M.ratio[i].toFixed(3)}× the note. On D3 that is ${nn.name} ${fmtCents(nn.cents)}, rings ${M.decay[i].toFixed(2)} s.`;
      };
      const both = (now) => { drawSpec(now); drawChord(now); };
      draws.push(() => both(performance.now()));
      const nearest = (e) => {
        const r = spec.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        let best = 0, bd = 1e9;
        geo.forEach(([gx, gy], i) => { const dd = (gx - x) ** 2 + (gy - y) ** 2; if (dd < bd) { bd = dd; best = i; } });
        return best;
      };
      spec.addEventListener('pointermove', (e) => { const i = nearest(e); if (i !== hot) { hot = i; say(i); both(performance.now()); } });
      spec.addEventListener('pointerdown', (e) => { hot = nearest(e); say(hot); both(performance.now()); });
      // A strike: each tone fades with its own ring, as the sound does.
      document.querySelector('[data-strike]').addEventListener('clip-start', () => {
        if (reduced) return;
        ring = performance.now();
        const go = (now) => { both(now); if (now - ring < 4500) requestAnimationFrame(go); else { ring = null; both(now); } };
        requestAnimationFrame(go);
      });
      // The table: the first eight tones on D3.
      const tb = document.querySelector('#t-modes tbody');
      for (let i = 0; i < Math.min(8, n); i++) {
        const nn = noteOf(M.ratio[i], 50);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${M.ratio[i].toFixed(3)}</td><td>${nn.name} ${fmtCents(nn.cents)}</td><td>${Math.round(M.level[i] * 100)} %</td><td>${M.decay[i].toFixed(2)} s</td>`;
        tb.appendChild(tr);
      }
    }

    /* ---------- 4. The sing: columns as harmonics ---------- */
    {
      const C = D.columns, nc = C.count, nh = C.harmonics;
      const map = $('c-cols'), bars = $('c-colspec'), input = $('col'), out = $('col-out');
      $('read-s').textContent = C.read_s.toFixed(1) + ' s';
      const off = document.createElement('canvas'); off.width = nc; off.height = nh;
      const og = off.getContext('2d'), im = og.createImageData(nc, nh);
      let mx = 1e-6; C.amps.forEach((v) => { mx = Math.max(mx, v); });
      // Shown on a log scale (40 dB deep): harmonic 1 is far louder than the rest.
      const LOG = (v) => Math.max(0, 1 + Math.log10(Math.max(v, 1e-9)) / 2);
      for (let c = 0; c < nc; c++) for (let k = 0; k < nh; k++) {
        const v = C.amps[c * nh + k] / mx, [r, g, b] = heat(LOG(v));
        im.data.set([r, g, b, 255], ((nh - 1 - k) * nc + c) * 4);
      }
      og.putImageData(im, 0, 0);
      let pos = 31.5, auto = !reduced, last = 0;
      const drawCols = () => {
        const [g, w, h] = fit(map, Math.round(Math.min(300, map.clientWidth * 0.46)));
        const L = 30, B = h - 8, T = 30, W = w - L - 10, H = B - T;
        g.imageSmoothingEnabled = false; g.drawImage(off, L, T, W, H);
        g.fillStyle = INK2; g.font = '11px -apple-system,system-ui,sans-serif'; g.textAlign = 'right';
        [1, 10, 20, 30, 40].forEach((k) => g.fillText(String(k), L - 6, B - ((k - 0.5) / nh) * H + 4));
        g.textAlign = 'left';
        const x = L + ((pos + 0.5) / nc) * W;
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.shadowColor = '#f0b45a'; g.shadowBlur = 14;
        g.beginPath(); g.moveTo(x, T - 6); g.lineTo(x, B + 2); g.stroke(); g.shadowBlur = 0;
      };
      const drawBars = () => {
        const [g, w, h] = fit(bars, 120);
        const c = Math.max(0, Math.min(nc - 1, Math.round(pos)));
        const bw = (w - 40) / nh;
        for (let k = 0; k < nh; k++) {
          const v = LOG(C.amps[c * nh + k] / mx);
          const [r, gg, b] = heat(0.35 + 0.65 * v);
          g.fillStyle = `rgb(${r},${gg},${b})`;
          const bh = Math.max(1, (h - 30) * v);
          g.fillRect(30 + k * bw + 1, h - 18 - bh, Math.max(1, bw - 2), bh);
        }
        g.fillStyle = INK2; g.font = '11px -apple-system,system-ui,sans-serif';
        g.fillText('harmonic 1', 30, h - 4); g.textAlign = 'right'; g.fillText('40', w - 10, h - 4); g.textAlign = 'left';
        out.textContent = `${c + 1} of 64`;
      };
      const both = () => { drawCols(); drawBars(); };
      draws.push(both);
      input.addEventListener('input', () => { auto = false; pos = input.value - 1; both(); });
      if (!reduced) {
        let visible = false;
        new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(map);
        // Left to right in read_s, then back, as a held note reads it.
        let t0 = 0;
        const loop = (t) => {
          if (visible && auto) {
            t0 += (t - last) / 1000;
            const p = (t0 / C.read_s) % 2, f = p < 1 ? p : 2 - p;
            pos = f * (nc - 1); input.value = Math.round(pos) + 1; both();
          }
          last = t; requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
    }

    /* ---------- 5. The vowel: the engine's own formula (photo_object.rs, vowel_of_hue) ---------- */
    {
      const c = $('c-vowel'), out = $('vowel-out'), V = D.vowel, hue0 = D.reading.hue;
      const formant = (hue) => { const turn = (((hue + 30) % 360) + 360) % 360 / 360; return 2400 * Math.pow(2, -2.5 * (0.5 - Math.abs(turn - 0.5)) * 2); };
      const vowel = (f) => (f < 550 ? 'oo' : f < 850 ? 'oh' : f < 1300 ? 'ah' : f < 1900 ? 'eh' : 'ee');
      let hover = null;
      const draw = () => {
        const [g, w, h] = fit(c, 240);
        const L = 44, R = w - 14, T = 34, B = h - 40;
        const lo = Math.log2(380), hi = Math.log2(2700);
        const Y = (f) => B - ((Math.log2(f) - lo) / (hi - lo)) * (B - T);
        const X = (hue) => L + (hue / 360) * (R - L);
        // vowel bands
        [[380, 550, 'oo'], [550, 850, 'oh'], [850, 1300, 'ah'], [1300, 1900, 'eh'], [1900, 2700, 'ee']].forEach(([a, b, nm], i) => {
          g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,0)'; g.fillRect(L, Y(b), R - L, Y(a) - Y(b));
          g.fillStyle = INK2; g.font = '600 12px -apple-system,system-ui,sans-serif'; g.fillText(nm, 12, (Y(a) + Y(b)) / 2 + 4);
        });
        // the hue strip
        for (let x = L; x < R; x++) { g.fillStyle = `hsl(${((x - L) / (R - L)) * 360},85%,58%)`; g.fillRect(x, B + 8, 1.2, 12); }
        g.fillStyle = INK2; g.font = '11px -apple-system,system-ui,sans-serif';
        g.fillText('0°', L, B + 34); g.textAlign = 'right'; g.fillText('360°', R, B + 34); g.textAlign = 'left';
        // the curve
        g.lineWidth = 2.5; g.shadowBlur = 8;
        for (let hue = 0; hue < 360; hue += 2) {
          g.strokeStyle = `hsl(${hue},90%,66%)`; g.shadowColor = g.strokeStyle;
          g.beginPath(); g.moveTo(X(hue), Y(formant(hue))); g.lineTo(X(hue + 2), Y(formant(hue + 2))); g.stroke();
        }
        g.shadowBlur = 0;
        // the sunset
        const sx = X(hue0), sy = Y(V.formant_hz);
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, B + 6); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 16; g.beginPath(); g.arc(sx, sy, 5.5, 0, 7); g.fill(); g.shadowBlur = 0;
        g.fillStyle = INK; g.font = '600 12px -apple-system,system-ui,sans-serif'; g.textAlign = 'right';
        g.fillText(`this sunset: "${V.name}", ${V.formant_hz} Hz`, sx - 10, sy + 4); g.textAlign = 'left';
        if (hover != null) {
          const hx = X(hover), hy = Y(formant(hover));
          g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, 6, 0, 7); g.stroke();
        }
      };
      draws.push(draw);
      const at = (e) => { const r = c.getBoundingClientRect(); const L = 44, R = r.width - 14; return Math.max(0, Math.min(359, ((e.clientX - r.left - L) / (R - L)) * 360)); };
      c.addEventListener('pointermove', (e) => {
        hover = at(e); const f = formant(hover);
        out.textContent = `At ${Math.round(hover)}° the vowel is "${vowel(f)}", about ${Math.round(f)} Hz.`; draw();
      });
      c.addEventListener('pointerleave', () => { hover = null; draw(); });
    }

    /* ---------- 6. Shimmer: patches and where the eye goes ---------- */
    {
      const c = $('c-grains'), G = D.grains;
      const draw = () => {
        const w = c.clientWidth, h = c.clientHeight, d = DPR();
        if (!w || !h) return;
        c.width = w * d; c.height = h * d;
        const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
        // where the eye goes: the saliency map, 64 × 64 over the whole picture
        const off = document.createElement('canvas'); off.width = 64; off.height = 64;
        const og = off.getContext('2d'), im = og.createImageData(64, 64);
        let best = 0;
        G.saliency.forEach((v, i) => { if (v > G.saliency[best]) best = i; im.data.set([255, 190, 110, Math.round(255 * Math.min(1, Math.pow(v, 1.1) * 1.1))], i * 4); });
        og.putImageData(im, 0, 0);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, h);
        g.imageSmoothingEnabled = true; g.globalCompositeOperation = 'lighter'; g.drawImage(off, 0, 0, w, h); g.globalCompositeOperation = 'source-over';
        // the patches
        const cw = w / 8, ch = h / 8;
        G.detail.forEach((v, i) => {
          const x = (i % 8) * cw, y = Math.floor(i / 8) * ch;
          g.strokeStyle = `rgba(146,200,255,${0.12 + 0.85 * v})`; g.lineWidth = 0.8 + 2.4 * v;
          g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
        });
        // where the walk starts: the engine's own point (row, column), else the saliency peak
        const st = G.start || [Math.floor(best / 64) / 63, (best % 64) / 63];
        const bx = Math.min(w - 12, Math.max(12, st[1] * w)), by = Math.min(h - 12, Math.max(12, st[0] * h));
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.shadowColor = '#f0b45a'; g.shadowBlur = 14;
        g.beginPath(); g.arc(bx, by, 10, 0, 7); g.stroke(); g.shadowBlur = 0;
        g.fillStyle = '#fff'; g.font = '600 12px -apple-system,system-ui,sans-serif';
        g.textAlign = bx > w / 2 ? 'right' : 'left';
        g.fillText('the grains start here', bx > w / 2 ? bx - 16 : bx + 16, by + 4); g.textAlign = 'left';
      };
      draws.push(draw);
      const photo = c.parentNode.querySelector('img');
      if (photo && !photo.complete) photo.addEventListener('load', draw);
    }

    /* ---------- 7. Signature ---------- */
    $('seed').textContent = D.seed.replace(/(.{4})(?=.)/g, '$1 ');
    if ($('fp')) $('fp').textContent = D.fingerprint;

    /* ---------- 9. The space's tones ---------- */
    {
      const c = $('c-space'), P = D.space;
      $('stems').textContent = P.stem_cents.map((x) => (x < 0 ? '−' : '+') + Math.abs(Math.round(x))).join(', ').replace(/, ([^,]*)$/, ' and $1');
      const draw = () => {
        const [g, w, h] = fit(c, 190);
        const base = h - 34, top = Math.max(...P.solved_ratio), L = 20, R = w - 16;
        const X = (r) => L + (Math.log2(r) / Math.log2(top)) * (R - L);
        g.strokeStyle = INK3; g.beginPath(); g.moveTo(L, base); g.lineTo(R, base); g.stroke();
        P.solved_ratio.forEach((r) => { g.strokeStyle = 'rgba(146,118,242,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(r), base); g.lineTo(X(r), base - 18); g.stroke(); });
        let mx = 1e-6; P.level.forEach((v) => { mx = Math.max(mx, v); });
        P.ratio.forEach((r, i) => {
          const hh = 20 + (base - 60) * (P.level[i] / mx);
          const col = PAL[i % PAL.length];
          g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = 8;
          g.beginPath(); g.moveTo(X(r), base); g.lineTo(X(r), base - hh); g.stroke(); g.shadowBlur = 0;
        });
        g.fillStyle = INK2; g.font = '11px -apple-system,system-ui,sans-serif'; g.textAlign = 'center';
        [1, 2, 3, 4, 8, 16, 32].forEach((k) => { if (k > top) return; const x = X(k); g.fillStyle = INK2; g.fillRect(x - 0.5, base, 1, 6); g.fillText(k === 1 ? 'note' : k + '×', x, base + 18); });
        g.textAlign = 'left';
        g.fillStyle = INK2; g.textAlign = 'right'; g.fillText(`${P.solved} solved (short lines) · the ${P.ratio.length} a strike plays (tall)`, R, h - 4); g.textAlign = 'left';
      };
      draws.push(draw);
    }

    redraw();
  }
})();
