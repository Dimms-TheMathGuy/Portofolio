(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) root.classList.add('motion');
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------------- language ---------------- */
  function setLang(l) {
    root.setAttribute('data-lang', l); root.setAttribute('lang', l);
    $('#lang-en').setAttribute('aria-pressed', String(l === 'en'));
    $('#lang-id').setAttribute('aria-pressed', String(l === 'id'));
    store('mda-lang', l);
    $$('[data-car]').forEach(function (c) { if (c._sync) c._sync(); });
  }
  var saved = store('mda-lang');
  setLang(saved === 'en' || saved === 'id' ? saved : ((navigator.language || '').toLowerCase().indexOf('id') === 0 ? 'id' : 'en'));
  $('#lang-en').addEventListener('click', function () { setLang('en'); });
  $('#lang-id').addEventListener('click', function () { setLang('id'); });

  /* ---------------- mobile menu ---------------- */
  var menu = $('#menu'), openBtn = $('#menu-open');
  function menuSet(o) { menu.hidden = !o; openBtn.setAttribute('aria-expanded', String(o)); document.body.style.overflow = o ? 'hidden' : ''; if (o) $('#menu-close').focus(); }
  openBtn.addEventListener('click', function () { menuSet(true); });
  $('#menu-close').addEventListener('click', function () { menuSet(false); openBtn.focus(); });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { menuSet(false); }); });

  /* ---------------- surface (the travelling object) ---------------- */
  function f(x, y) {
    return 0.95 * Math.exp(-((x - 1.1) * (x - 1.1) + (y - 0.7) * (y - 0.7)) / 0.7)
      + 0.7 * Math.exp(-((x + 1.4) * (x + 1.4) + (y + 1.1) * (y + 1.1)) / 0.55)
      + 0.55 * Math.exp(-((x + 1.2) * (x + 1.2) + (y - 1.5) * (y - 1.5)) / 0.45)
      - 1.15 * Math.exp(-((x - 0.3) * (x - 0.3) + (y + 0.4) * (y + 0.4)) / 1.3)
      + 0.12 * Math.sin(2.1 * x) * Math.cos(1.8 * y);
  }
  // deterministic annealing walk on f
  var walk = (function () {
    var s = 7, rnd = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    var gauss = function () { var u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    var x = 2.3, y = 2.2, T = 1.2, pts = [[x, y]];
    for (var k = 0; k < 700 && pts.length < 90; k++) {
      var nx = clamp(x + gauss() * 0.2, -2.9, 2.9), ny = clamp(y + gauss() * 0.2, -2.9, 2.9);
      var d = f(nx, ny) - f(x, y);
      if (d <= 0 || rnd() < Math.exp(-d / T)) { x = nx; y = ny; pts.push([x, y]); }
      T *= 0.985;
    }
    return pts;
  })();

  function drawSurface(cv, theta, prog, sizePx) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var S = sizePx || cv.clientWidth || 400;
    if (cv.width !== Math.round(S * dpr)) { cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr); }
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    var el = 0.62, ce = Math.cos(el), se = Math.sin(el), ct = Math.cos(theta), st = Math.sin(theta);
    var sc = S / 8.4, cx = S / 2, cy = S * 0.54;
    function P(x, y, z) {
      var X = x * ct - y * st, Y = x * st + y * ct;
      return [cx + X * sc, cy + (Y * se - z * 1.45 * ce) * sc, Y];
    }
    var N = 30, R = 3;
    g.lineWidth = 0.8;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i <= N; i++) {
        var a = -R + (2 * R * i) / N;
        g.beginPath();
        var depth = 0;
        for (var j = 0; j <= N; j++) {
          var b = -R + (2 * R * j) / N;
          var p = pass ? P(a, b, f(a, b)) : P(b, a, f(b, a));
          depth += p[2];
          if (j) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
        }
        depth /= N + 1;
        g.strokeStyle = 'rgba(20,28,43,' + (0.22 + 0.2 * (depth + R) / (2 * R)).toFixed(3) + ')';
        g.stroke();
      }
    }
    // annealing walk (blue drawn line)
    var n = Math.max(2, Math.floor(walk.length * prog));
    g.beginPath();
    for (var k = 0; k < n; k++) {
      var w = walk[k], q = P(w[0], w[1], f(w[0], w[1]) + 0.04);
      if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
    }
    g.strokeStyle = '#2C4A8F'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
    var h = walk[n - 1], hp = P(h[0], h[1], f(h[0], h[1]) + 0.04);
    g.fillStyle = '#2C4A8F'; g.beginPath(); g.arc(hp[0], hp[1], 3.4, 0, Math.PI * 2); g.fill();
  }
  // static renders in the slots (visible when the traveller is off)
  function drawStatics() { $$('[data-surface]').forEach(function (c) { drawSurface(c, parseFloat(c.getAttribute('data-angle') || '0.6'), 1); }); }
  drawStatics();

  /* ---------------- traveller + wordmark (scroll-bound, reversible) ---------------- */
  var trav = $('#traveller'), TS = 520;
  var stops = [], travelOn = false;
  var wmLetters = $$('#wm-hero span'), hero = $('#top');
  var canTravel = function () { return !reduce && window.innerWidth >= 900; };
  function absRect(el) { var r = el.getBoundingClientRect(); return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }; }
  function computeStops() {
    travelOn = canTravel();
    root.classList.toggle('travel', travelOn);
    if (!travelOn) return;
    var vh = window.innerHeight;
    var hs = absRect($('#slot-hero canvas')), ms = absRect($('#slot-method canvas')), demo = absRect($('#demo'));
    var mScroll = Math.max(ms.y + ms.h / 2 - vh / 2, 1);
    var cHero = { x: hs.x + hs.w / 2, y: hs.y + hs.h / 2 };
    var cM = { x: ms.x + ms.w / 2, y: vh / 2 };
    stops = [
      { at: 0, x: cHero.x, y: cHero.y, r: 0, s: hs.w / TS, o: 1 },
      { at: mScroll * 0.5, x: window.innerWidth * 0.52, y: vh * 0.58, r: 24, s: (hs.w + ms.w) / 2 / TS * 0.92, o: 1 },
      { at: mScroll, x: cM.x, y: cM.y, r: 0, s: ms.w / TS, o: 1 },
      { at: Math.min(mScroll + vh * 0.3, demo.y - vh * 0.2), x: cM.x, y: cM.y - vh * 0.3, r: -10, s: ms.w / TS * 0.9, o: 0 }
    ];
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function sample(y) {
    if (y <= stops[0].at) return stops[0];
    for (var i = 1; i < stops.length; i++) {
      var a = stops[i - 1], b = stops[i];
      if (y <= b.at) {
        var t = ease((y - a.at) / Math.max(b.at - a.at, 1));
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: a.r + (b.r - a.r) * t, s: a.s + (b.s - a.s) * t, o: a.o + (b.o - a.o) * t };
      }
    }
    return stops[stops.length - 1];
  }
  var t0 = performance.now(), lastY = -1, visible = true;
  function frame(now) {
    var y = window.scrollY;
    if (travelOn) {
      var p = sample(y);
      if (p.o > 0.01) {
        trav.style.visibility = 'visible';
        trav.style.opacity = p.o.toFixed(3);
        trav.style.transform = 'translate(' + (p.x - (TS * p.s) / 2).toFixed(1) + 'px,' + (p.y - (TS * p.s) / 2).toFixed(1) + 'px) scale(' + p.s.toFixed(4) + ') rotate(' + p.r.toFixed(2) + 'deg)';
        trav.style.transformOrigin = '0 0';
        var sec = (now - t0) / 1000;
        drawSurface(trav, 0.6 + sec * 0.1 + y * 0.0012, 0.25 + 0.75 * ((sec * 0.08) % 1), TS);
      } else {
        trav.style.visibility = 'hidden';
      }
    }
    if (y !== lastY && hero) {
      var hp = clamp(y / (hero.offsetHeight * 0.8), 0, 1), n = wmLetters.length;
      wmLetters.forEach(function (s, i) {
        if (!root.classList.contains('motion')) return;
        var off = (i - (n - 1) / 2);
        s.style.transform = (hp > 0 && window.innerWidth > 560) ? 'translate(' + (off * hp * 40).toFixed(1) + 'px,' + (hp * 24 + Math.abs(off) * hp * 8).toFixed(1) + 'px)' : '';
      });
      lastY = y;
    }
    requestAnimationFrame(frame);
  }
  function relayout() { computeStops(); drawStatics(); lastY = -1; }
  window.addEventListener('resize', function () { clearTimeout(relayout._t); relayout._t = setTimeout(relayout, 120); });
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  relayout();
  requestAnimationFrame(frame);

  /* ---------------- demonstration ---------------- */
  var svgNS = 'http://www.w3.org/2000/svg';
  var W = 800, H = 340, L = 70, Rr = 770, Tp = 26, B = 292;
  function el(tag, attrs, parent) { var e = document.createElementNS(svgNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function txt(x, y, s, parent, anchor) { var t = el('text', { x: x, y: y, 'text-anchor': anchor || 'start' }, parent); t.textContent = s; return t; }
  var gGrid = $('#plot-grid'), gBack = $('#plot-back'), gFront = $('#plot-front'), main = $('#plot-main');
  var INK = '#141C2B', INK2 = '#4A5364', HAIR = 'rgba(20,28,43,.16)';
  function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
  function axes(xl, yl, yt, xt) {
    clear(gGrid);
    yt.forEach(function (t) { el('line', { x1: L, x2: Rr, y1: t[0], y2: t[0], stroke: HAIR }, gGrid); txt(L - 10, t[0] + 4, t[1], gGrid, 'end'); });
    xt.forEach(function (t) { txt(t[0], B + 20, t[1], gGrid, 'middle'); });
    el('line', { x1: L, x2: Rr, y1: B, y2: B, stroke: INK }, gGrid);
    txt(Rr, B + 40, xl, gGrid, 'end'); txt(L, Tp - 8, yl, gGrid);
  }
  var variants = {
    anneal: function () {
      var d = [[0, 2119], [9000, 2119], [10000, 2012], [11000, 1988], [12000, 1890], [13000, 1873], [14000, 1800], [15000, 1790], [16000, 1752], [17000, 1722], [18000, 1698.57]];
      var X = function (i) { return L + (i / 18000) * (Rr - L); }, Y = function (c) { return Tp + ((2160 - c) / (2160 - 1660)) * (B - Tp); };
      axes('iteration', 'total distance', [[Y(2100), '2100'], [Y(1900), '1900'], [Y(1700), '1700']], [[X(0), '0'], [X(6000), '6k'], [X(12000), '12k'], [X(18000), '18k']]);
      clear(gBack); clear(gFront);
      el('line', { x1: L, x2: Rr, y1: Y(2119), y2: Y(2119), stroke: INK2, 'stroke-dasharray': '3 5' }, gBack);
      txt(L + 8, Y(2119) - 8, 'nearest neighbor 2119.00', gBack);
      el('line', { x1: L, x2: Rr, y1: Y(1698.57), y2: Y(1698.57), stroke: INK2, 'stroke-dasharray': '3 5' }, gBack);
      txt(L + 8, Y(1698.57) - 8, 'simulated annealing 1698.57', gBack);
      el('circle', { cx: X(18000), cy: Y(1698.57), r: 4, fill: '#2C4A8F' }, gFront);
      main.style.strokeWidth = '2.4';
      return d.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
    },
    iso: function () {
      clear(gGrid); clear(gBack); clear(gFront);
      var cx = 400, cy = 160, Rc = 128;
      el('line', { x1: 150, y1: 70, x2: 650, y2: 255, stroke: INK2, 'stroke-dasharray': '10 6' }, gBack);
      el('circle', { cx: cx, cy: cy, r: Rc, fill: 'none', stroke: INK, 'stroke-dasharray': '6 6' }, gBack);
      txt(cx + Rc + 14, cy - 60, 'circle · 833 m', gBack); txt(cx + Rc + 14, cy - 42, '2.18 km²', gBack);
      txt(150, 62, 'KRL line', gBack);
      var N = 48, pts = [];
      for (var i = 0; i < N; i++) {
        var a = (i / N) * Math.PI * 2;
        var v = 0.66 + 0.13 * Math.sin(2 * a + 0.5) + 0.1 * Math.sin(3 * a + 1.7) + 0.07 * Math.sin(5 * a + 0.3) + 0.04 * Math.sin(8 * a + 2.1);
        pts.push([cx + Math.cos(a) * Rc * v, cy + Math.sin(a) * Rc * v]);
      }
      el('circle', { cx: cx, cy: cy, r: 4.5, fill: INK }, gFront);
      txt(cx - Rc - 14, cy + 70, 'walking isochrone', gFront, 'end'); txt(cx - Rc - 14, cy + 88, '0.92 km²', gFront, 'end');
      txt(cx, 316, 'Sudirman · 10-minute walk', gFront, 'middle');
      main.style.strokeWidth = '2.6';
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var j = 0; j < N; j++) {
        var p0 = pts[(j - 1 + N) % N], p1 = pts[j], p2 = pts[(j + 1) % N], p3 = pts[(j + 2) % N];
        d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return d + ' Z';
    },
    susp: function () {
      // quarter-car, RK4, illustrative parameters
      var ms = 250, mu = 40, ks = 16000, cs = 1000, kt = 180000, dt = 0.002, Tend = 4;
      var r = function (t) { return t >= 0.4 && t <= 0.7 ? 0.06 * Math.pow(Math.sin(Math.PI * (t - 0.4) / 0.3), 2) : 0; };
      var fn = function (t, s) {
        var xs = s[0], vs = s[1], xu = s[2], vu = s[3], fsus = -ks * (xs - xu) - cs * (vs - vu);
        return [vs, fsus / ms, vu, (-fsus - kt * (xu - r(t))) / mu];
      };
      var s = [0, 0, 0, 0], out = [], ro = [];
      for (var t = 0; t <= Tend + 1e-9; t += dt) {
        if (Math.round(t / dt) % 5 === 0) { out.push([t, s[0]]); ro.push([t, r(t)]); }
        var k1 = fn(t, s), k2 = fn(t + dt / 2, s.map(function (v, i) { return v + dt / 2 * k1[i]; }));
        var k3 = fn(t + dt / 2, s.map(function (v, i) { return v + dt / 2 * k2[i]; })), k4 = fn(t + dt, s.map(function (v, i) { return v + dt * k3[i]; }));
        s = s.map(function (v, i) { return v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); });
      }
      var X = function (t) { return L + (t / Tend) * (Rr - L); }, Y0 = 190, Yk = 1900;
      var Y = function (v) { return Y0 - v * Yk; };
      axes('time (s)', 'displacement', [[Y(0.06), '6 cm'], [Y(0.03), '3 cm'], [Y(0), '0'], [Y(-0.03), '−3 cm']], [[X(0), '0'], [X(1), '1'], [X(2), '2'], [X(3), '3'], [X(4), '4']]);
      clear(gBack); clear(gFront);
      var rp = ro.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
      el('path', { d: rp, fill: 'none', stroke: INK2, 'stroke-width': 1.2, 'stroke-dasharray': '4 4' }, gBack);
      txt(X(0.72), Y(0.062), 'road r(t)', gBack);
      txt(X(1.35), Y(0.045), 'body xₛ(t)', gFront);
      main.style.strokeWidth = '2';
      return out.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
    }
  };
  var current = 'anneal', drawnOnce = false;
  function draw(v, animate) {
    current = v;
    main.setAttribute('d', variants[v]());
    $$('[data-for]').forEach(function (e) { e.hidden = e.getAttribute('data-for') !== v; });
    $$('.variants button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); });
    var len = main.getTotalLength();
    main.style.transition = 'none';
    if (animate && !reduce) {
      main.style.strokeDasharray = len + ' ' + len;
      main.style.strokeDashoffset = String(len);
      main.getBoundingClientRect();
      main.style.transition = 'stroke-dashoffset 2s cubic-bezier(.4,.1,.2,1)';
      main.style.strokeDashoffset = '0';
    } else { main.style.strokeDasharray = 'none'; main.style.strokeDashoffset = '0'; }
  }
  $$('.variants button').forEach(function (b) { b.addEventListener('click', function () { draw(b.getAttribute('data-v'), true); }); });
  draw('anneal', false);
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !drawnOnce) { drawnOnce = true; draw(current, true); io.disconnect(); } }); }, { threshold: 0.45 });
    io.observe($('.panel'));
  }

  /* ---------------- carousels ---------------- */
  var lb = $('#lb'), lbImg = $('#lb-img'), lbCap = $('#lb-cap'), lbSet = null, lbIdx = 0, lbReturn = null;
  $$('[data-car]').forEach(function (car) {
    var track = $('.car-track', car), slides = $$('.slide', car), n = slides.length;
    var count = $('.car-count', car), cap = $('.car-cap', car), bar = $('.car-prog i', car), prev = $('.car-prev', car), next = $('.car-next', car);
    slides.forEach(function (s) { var im = $('img', s), w = +im.getAttribute('width'), h = +im.getAttribute('height'); if (w && h) s.style.setProperty('--ar', (w / h).toFixed(4)); });
    var idx = 0;
    function pad(v) { return (v < 10 ? '0' : '') + v; }
    function sync() {
      count.textContent = pad(idx + 1) + ' / ' + pad(n);
      var fc = $('figcaption', slides[idx]); cap.innerHTML = fc ? fc.innerHTML : '';
      bar.style.width = (100 / n) + '%'; bar.style.left = (idx * 100 / n) + '%';
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      prev.disabled = idx === 0 && track.scrollLeft < 4; next.disabled = idx === n - 1 || atEnd;
    }
    car._sync = sync;
    function nearest() {
      var sl = track.scrollLeft, best = 0, bd = Infinity;
      slides.forEach(function (s, i) { var d = Math.abs(s.offsetLeft - track.offsetLeft - sl); if (d < bd) { bd = d; best = i; } });
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) best = Math.max(best, lastVisible());
      return best;
    }
    function lastVisible() { var r = track.scrollLeft + track.clientWidth, k = 0; slides.forEach(function (s, i) { if (s.offsetLeft - track.offsetLeft + s.offsetWidth / 2 <= r) k = i; }); return k; }
    function go(i) { idx = clamp(i, 0, n - 1); track.scrollTo({ left: slides[idx].offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' }); sync(); }
    var raf = 0;
    track.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { idx = nearest(); sync(); }); }, { passive: true });
    prev.addEventListener('click', function () { go(idx - 1); });
    next.addEventListener('click', function () { go(idx + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    });
    slides.forEach(function (s, i) {
      $('.zoom', s).addEventListener('click', function (e) { lbReturn = e.currentTarget; openLb(slides, i); });
      $('.zoom', s).setAttribute('aria-label', ($('img', s).alt || 'Image') + ' — enlarge');
    });
    window.addEventListener('resize', sync);
    sync();
  });
  function showLb() {
    var s = lbSet[lbIdx], im = $('img', s), fc = $('figcaption', s);
    lbImg.src = im.currentSrc || im.src; lbImg.alt = im.alt; lbCap.innerHTML = (fc ? fc.innerHTML : '') + ' <span style="opacity:.6">· ' + (lbIdx + 1) + ' / ' + lbSet.length + '</span>';
    $('.lb-prev').disabled = lbIdx === 0; $('.lb-next').disabled = lbIdx === lbSet.length - 1;
  }
  function openLb(set, i) { lbSet = set; lbIdx = i; showLb(); lb.hidden = false; document.body.style.overflow = 'hidden'; $('.lb-x').focus(); }
  function closeLb() { lb.hidden = true; lbImg.removeAttribute('src'); document.body.style.overflow = ''; if (lbReturn) lbReturn.focus(); }
  $('.lb-x').addEventListener('click', closeLb);
  $('.lb-prev').addEventListener('click', function () { if (lbIdx > 0) { lbIdx--; showLb(); } });
  $('.lb-next').addEventListener('click', function () { if (lbIdx < lbSet.length - 1) { lbIdx++; showLb(); } });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.hidden) {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight' && lbIdx < lbSet.length - 1) { lbIdx++; showLb(); }
      if (e.key === 'ArrowLeft' && lbIdx > 0) { lbIdx--; showLb(); }
    } else if (!menu.hidden && e.key === 'Escape') { menuSet(false); openBtn.focus(); }
  });
  var sx = 0;
  lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) { if (dx < 0 && lbIdx < lbSet.length - 1) lbIdx++; else if (dx > 0 && lbIdx > 0) lbIdx--; showLb(); }
  });


  /* ---------------- background field: ASCII + equations, reacts to the pointer ---------------- */
  (function () {
    var cv = document.getElementById('bgfield'); if (!cv) return;
    var g = cv.getContext('2d'), dpr = 1, W = 0, H = 0, C = 17, cols = 0, rows = 0;
    var ramp = ' .·:-=+*#%';
    var eqs = ['∇²φ = 0', 'e^{iπ} + 1 = 0', '∂u/∂t = α∇²u', 'P(θ|x) ∝ P(x|θ)P(θ)', 'min Σ cᵢⱼ xᵢⱼ',
      'Av = λv', 'σ(z) = 1/(1+e⁻ᶻ)', 'H(X) = −Σ p log p', '‖x − π(PX)‖²', 'x′ = Hx', 'e^{−Δ/T}', 'Π = A / πr²',
      'det(A − λI) = 0', '∫ f(x) dx', 'softmax(Wh)', '∇·F = ρ', 'F₁ = 2PR/(P+R)', 'Σ wⱼ x̃ⱼ', 'max −Σ T ln T', 'ẋ = Ax + Br'];
    var seed = 11, rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var spots = eqs.map(function (e) { return { t: e, x: rnd(), y: rnd() * 1.6, s: 13 + Math.floor(rnd() * 6), v: 0.15 + rnd() * 0.25 }; });
    var mx = -9999, my = -9999, mA = 0, target = 0, last = 0, t0 = performance.now();
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cols = Math.ceil(W / C) + 1; rows = Math.ceil(H / C) + 1;
    }
    window.addEventListener('resize', size); size();
    window.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; mx = e.clientX; my = e.clientY; target = 1; }, { passive: true });
    document.addEventListener('pointerleave', function () { target = 0; });
    window.addEventListener('blur', function () { target = 0; });
    function draw(now) {
      requestAnimationFrame(draw);
      if (document.hidden || now - last < 42) return;
      last = now;
      mA += (target - mA) * 0.15;
      var t = reduce ? 0 : (now - t0) / 1000, sy = window.scrollY;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.font = '12px "Courier Prime", "Courier New", monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
      var R = 170, R2 = R * R, off = sy * 0.04;
      for (var j = 0; j < rows; j++) {
        var y = j * C + C / 2;
        for (var i = 0; i < cols; i++) {
          var x = i * C + C / 2;
          var v = Math.sin(i * 0.19 + t * 0.35) + Math.sin(j * 0.23 - t * 0.27 + off) + Math.sin((i + j) * 0.09 + t * 0.18);
          v = (v + 3) / 6;
          var dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy, near = 0;
          if (mA > 0.01 && d2 < R2) { near = (1 - Math.sqrt(d2) / R); near = near * near * mA; }
          var k = Math.floor(v * v * ramp.length * 0.9 + near * 6);
          if (k <= 0) continue;
          if (k >= ramp.length) k = ramp.length - 1;
          var a = 0.05 + v * 0.03 + near * 0.5;
          g.fillStyle = near > 0.05 ? 'rgba(44,74,143,' + a.toFixed(3) + ')' : 'rgba(20,28,43,' + a.toFixed(3) + ')';
          g.fillText(ramp[k], x, y);
        }
      }
      g.textAlign = 'left';
      for (var s = 0; s < spots.length; s++) {
        var p = spots[s], px = p.x * W, py = ((p.y * H - sy * p.v - t * 4) % (H * 1.6) + H * 1.6) % (H * 1.6) - H * 0.3;
        g.font = 'italic ' + p.s + 'px "Newsreader", Georgia, serif';
        var w = g.measureText(p.t).width, cx = px + w / 2, ddx = cx - mx, ddy = py - my;
        var nr = mA > 0.01 ? Math.max(0, 1 - Math.sqrt(ddx * ddx + ddy * ddy) / 220) * mA : 0;
        g.fillStyle = nr > 0.05 ? 'rgba(44,74,143,' + (0.1 + nr * 0.4).toFixed(3) + ')' : 'rgba(20,28,43,0.09)';
        g.fillText(p.t, px, py);
      }
    }
    if (coarse) mA = 0;
    requestAnimationFrame(draw);
  })();

  /* ---------------- entry motion (transform only) ---------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var targets = $$('.proj, .mini, .panel');
    targets.forEach(function (t) { var r = t.getBoundingClientRect(); if (r.top > window.innerHeight) t.classList.add('rv'); });
    var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io2.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) { io2.observe(t); });
  }
})();
