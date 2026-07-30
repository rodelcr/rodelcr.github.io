// Ambient lensed starfield.
//
// A field of twinkling stars with one or two invisible point masses drifting
// through it. Stars behind a mass are deflected and stretched into tangential
// arcs by the real point-lens equations -- as a mass crosses a dense patch you
// briefly get an Einstein ring. Far from any mass the magnification tends to 1
// and stars degrade to plain twinkling points.
//
// Colours come from the --star-* custom properties in _sass/_themes.scss so the
// palette lives in one place and the dark/light inversion is a CSS edit.

(function () {
  'use strict';

  var canvas = document.getElementById('starfield');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  // ---- Tunables -----------------------------------------------------------

  var AREA_PER_STAR = 3800;   // px^2 of viewport per star
  var MAX_STARS = 600;
  var STAR_MIN_R = 0.5;       // px, unlensed radius
  var STAR_MAX_R = 1.9;
  var TWINKLE_MIN_HZ = 0.08;
  var TWINKLE_MAX_HZ = 0.45;

  var THETA_E_MIN = 80;       // px, Einstein radius of a drifting mass
  var THETA_E_MAX = 140;
  var MASS_SPEED_MIN = 6;     // px/s
  var MASS_SPEED_MAX = 14;

  var LENS_CUTOFF = 3.2;      // beta/theta_E past which we skip the lens maths
                              // (mu < 1.01 there, so it is invisible anyway)
  var COUNTER_CUTOFF = 2.2;   // beta/theta_E past which the counter-image is
                              // too faint to bother drawing
  var MAX_TANGENTIAL = 14;    // cap on arc stretch, else the ring smears
  var MAX_ARC_PX = 64;        // hard cap on drawn arc length
  var RING_GLOW = 0.30;       // small alpha lift near theta_E; lensing conserves
                              // surface brightness, so this is pure garnish

  var TEMP_DECAY = 0.95;      // per 60fps frame, as in the reference site
  var TEMP_MAX = 2.0;

  // ---- State --------------------------------------------------------------

  var stars = [];
  var masses = [];
  var w = 0, h = 0, dpr = 1;
  var scrollTemp = 0;
  var lastScrollY = window.pageYOffset || 0;
  var lastScrollT = 0;
  var rafId = null;
  var lastFrameT = 0;
  var palette = null;

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ---- Palette ------------------------------------------------------------

  function parseHex(str) {
    var s = (str || '').trim().replace(/^#/, '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (s.length !== 6) return null;
    var n = parseInt(s, 16);
    if (isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var warm = parseHex(cs.getPropertyValue('--star-warm')) || [255, 244, 214];
    var cool = parseHex(cs.getPropertyValue('--star-cool')) || [202, 222, 255];
    var blend = (cs.getPropertyValue('--star-blend') || 'lighter').trim();
    var alpha = parseFloat(cs.getPropertyValue('--star-alpha'));
    palette = {
      warm: warm,
      cool: cool,
      blend: blend === 'multiply' ? 'multiply' : 'lighter',
      alpha: isNaN(alpha) ? 0.9 : alpha
    };
    // Precompute each star's rgb prefix so the draw loop only appends alpha.
    for (var i = 0; i < stars.length; i++) tintStar(stars[i]);
  }

  function tintStar(s) {
    var t = s.temp;
    var r = Math.round(palette.warm[0] + (palette.cool[0] - palette.warm[0]) * t);
    var g = Math.round(palette.warm[1] + (palette.cool[1] - palette.warm[1]) * t);
    var b = Math.round(palette.warm[2] + (palette.cool[2] - palette.warm[2]) * t);
    s.rgb = 'rgba(' + r + ',' + g + ',' + b + ',';
  }

  // ---- Field construction -------------------------------------------------

  function rand(a, b) { return a + Math.random() * (b - a); }

  function buildStars() {
    var n = Math.min(MAX_STARS, Math.round((w * h) / AREA_PER_STAR));
    stars.length = 0;
    for (var i = 0; i < n; i++) {
      var s = {
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(STAR_MIN_R, STAR_MAX_R),
        // Bias towards faint stars so the field has depth rather than reading
        // as uniform confetti.
        base: Math.pow(Math.random(), 1.5) * 0.85 + 0.15,
        temp: Math.random(),
        phase: Math.random() * Math.PI * 2,
        rate: rand(TWINKLE_MIN_HZ, TWINKLE_MAX_HZ) * Math.PI * 2,
        depth: rand(0.15, 0.55)
      };
      tintStar(s);
      stars.push(s);
    }
  }

  function buildMasses() {
    var n = w < 700 ? 1 : 2;
    masses.length = 0;
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var speed = rand(MASS_SPEED_MIN, MASS_SPEED_MAX);
      masses.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        thetaE: rand(THETA_E_MIN, THETA_E_MAX)
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
    buildMasses();
  }

  // ---- Drawing ------------------------------------------------------------

  function draw(t, temp) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = palette.blend;
    ctx.lineCap = 'round';

    var globalAlpha = palette.alpha;
    // Scrolling agitates the field: deeper twinkle and a slightly larger
    // Einstein radius, so the lensing pulses and then settles.
    var twinkleBoost = 1 + temp * 0.9;
    var thetaScale = 1 + temp * 0.12;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 1 + s.depth * twinkleBoost * Math.sin(s.phase + s.rate * t);
      if (tw < 0) tw = 0;
      var alpha = globalAlpha * s.base * tw;
      if (alpha <= 0.004) continue;

      // Nearest mass wins; overlapping lenses are not worth the maths here.
      var m = null, beta = Infinity, dx = 0, dy = 0;
      for (var j = 0; j < masses.length; j++) {
        var mj = masses[j];
        var ddx = s.x - mj.x, ddy = s.y - mj.y;
        var d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < beta) { beta = d; m = mj; dx = ddx; dy = ddy; }
      }

      var thetaE = m ? m.thetaE * thetaScale : 0;

      if (!m || beta > LENS_CUTOFF * thetaE) {
        ctx.fillStyle = s.rgb + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (beta < 0.5) beta = 0.5;               // keep the unit vector sane
      var ux = dx / beta, uy = dy / beta;
      var root = Math.sqrt(beta * beta + 4 * thetaE * thetaE);

      // Point-lens image positions. theta_plus sits outside the Einstein
      // radius on the star's side; theta_minus is the parity-flipped
      // counter-image inside it, on the far side of the mass.
      drawImage(m, ux, uy, (beta + root) / 2, thetaE, s, alpha, 1);
      if (beta < COUNTER_CUTOFF * thetaE) {
        drawImage(m, ux, uy, Math.abs((beta - root) / 2), thetaE, s, alpha, -1);
      }
    }
  }

  // Draw one lensed image as a tangential arc. A point lens has zero
  // convergence, so the eigenvalues of the lens mapping are 1 -/+ (theta_E/theta)^2:
  // the image is stretched tangentially and thinned radially. Total
  // magnification is the product, mu = theta^4 / |theta^4 - theta_E^4|.
  function drawImage(m, ux, uy, theta, thetaE, s, alpha, side) {
    if (theta < 0.4) return;
    var q = (thetaE * thetaE) / (theta * theta);

    var tangential = 1 / Math.abs(1 - q);
    if (!isFinite(tangential) || tangential > MAX_TANGENTIAL) {
      tangential = MAX_TANGENTIAL;
    }
    var radial = 1 / (1 + q);

    var arcLen = Math.min(2 * s.r * tangential, MAX_ARC_PX);
    var width = 2 * s.r * radial;

    // Lensing conserves surface brightness -- the arc is brighter because it
    // covers more area, which the larger path already gives us. RING_GLOW is
    // a small deliberate lift so the ring reads on screen.
    var a = alpha * (1 + RING_GLOW * Math.min(tangential / MAX_TANGENTIAL, 1));
    if (a > 1) a = 1;

    var cx = m.x + ux * theta * side;
    var cy = m.y + uy * theta * side;

    if (arcLen <= width * 1.2) {
      ctx.fillStyle = s.rgb + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(cx, cy, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    var mid = Math.atan2(cy - m.y, cx - m.x);
    var half = (arcLen / 2) / theta;
    ctx.strokeStyle = s.rgb + a.toFixed(3) + ')';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(m.x, m.y, theta, mid - half, mid + half);
    ctx.stroke();
  }

  // ---- Loop ---------------------------------------------------------------

  function step(now) {
    rafId = window.requestAnimationFrame(step);
    if (document.hidden) { lastFrameT = now; return; }

    var dt = lastFrameT ? (now - lastFrameT) / 1000 : 0.016;
    lastFrameT = now;
    if (dt > 0.1) dt = 0.1;                     // after a tab switch, don't lurch

    scrollTemp *= Math.pow(TEMP_DECAY, dt * 60);
    if (scrollTemp < 0.001) scrollTemp = 0;

    var speedScale = 1 + scrollTemp * 1.5;
    for (var i = 0; i < masses.length; i++) {
      var m = masses[i];
      m.x += m.vx * dt * speedScale;
      m.y += m.vy * dt * speedScale;
      var pad = m.thetaE * LENS_CUTOFF;
      if (m.x < -pad) m.x = w + pad;
      if (m.x > w + pad) m.x = -pad;
      if (m.y < -pad) m.y = h + pad;
      if (m.y > h + pad) m.y = -pad;
    }

    draw(now / 1000, scrollTemp);
  }

  function start() {
    if (rafId !== null) return;
    lastFrameT = 0;
    rafId = window.requestAnimationFrame(step);
  }

  function stop() {
    if (rafId === null) return;
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var now = performance.now();
    var dt = now - lastScrollT;
    if (dt > 0 && dt < 200) {
      var boost = Math.min((Math.abs(y - lastScrollY) / dt) * 2, TEMP_MAX);
      if (boost > scrollTemp) scrollTemp = boost;
    }
    lastScrollY = y;
    lastScrollT = now;
  }

  // ---- Wiring -------------------------------------------------------------

  function applyMotionPreference() {
    if (motionQuery.matches) {
      stop();
      window.removeEventListener('scroll', onScroll);
      scrollTemp = 0;
      draw(0, 0);                               // one static frame, then nothing
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
      start();
    }
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      resize();
      draw(performance.now() / 1000, scrollTemp);
    }, 150);
  });

  // The theme toggle in assets/js/theme.js flips html[data-theme]; re-read the
  // palette so the field inverts immediately with no reload.
  new MutationObserver(function () {
    readPalette();
    // Repaint now so the inversion is instant even while the loop is paused.
    draw(performance.now() / 1000, scrollTemp);
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  if (motionQuery.addEventListener) {
    motionQuery.addEventListener('change', applyMotionPreference);
  } else if (motionQuery.addListener) {
    motionQuery.addListener(applyMotionPreference);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    // rAF is paused in a hidden tab, so nothing was painted while we were away
    // and lastFrameT is stale. Reset the clock and put a frame up immediately
    // rather than waiting for the loop to catch up.
    lastFrameT = 0;
    draw(performance.now() / 1000, scrollTemp);
  });

  readPalette();   // must precede resize(): buildStars() tints as it goes
  resize();
  draw(0, 0);      // paint immediately; don't wait for the first rAF tick
  applyMotionPreference();
})();
