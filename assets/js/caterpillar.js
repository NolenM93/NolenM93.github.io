/* Pixel-art Space Invaders caterpillar cursor. Off by default, remembered. */
(function () {
  "use strict";

  var toggle = document.getElementById("caterpillar-toggle");
  var canvas = document.getElementById("caterpillar-canvas");
  if (!toggle || !canvas) return;

  var KEY = "nm-caterpillar-mode";
  var SEGMENTS = 11;
  var SPACING = 22;
  var ATTRACT = 120;
  var RELEASE = 150;
  var LATCH_HIT = 16;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarsePointer = window.matchMedia("(pointer: coarse)");
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    toggle.hidden = true;
    return;
  }

  var enabled = false;
  var raf = 0;
  var last = 0;
  var mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, inside: false };
  var segs = [];
  var latched = null;
  var latchPoint = { x: 0, y: 0 };
  var clickables = [];
  var scanClock = 0;
  var sprHead = null;
  var sprBodyA = null;
  var sprBodyB = null;
  var w = 1;
  var h = 1;

  function pixelSprite(rows, colors) {
    var pw = rows[0].length;
    var ph = rows.length;
    var c = document.createElement("canvas");
    c.width = pw;
    c.height = ph;
    var g = c.getContext("2d");
    var y;
    var x;
    for (y = 0; y < ph; y += 1) {
      for (x = 0; x < pw; x += 1) {
        var ch = rows[y].charAt(x);
        if (ch === "." || !colors[ch]) continue;
        g.fillStyle = colors[ch];
        g.fillRect(x, y, 1, 1);
      }
    }
    return { canvas: c, w: pw, h: ph };
  }

  function bake() {
    var green = "#7CFF4A";
    var greenHi = "#d8ff9a";
    var greenDeep = "#22c55e";
    var lime = "#4ade80";
    var eye = "#0b1016";
    var glow = "#22d3ee";
    sprHead = pixelSprite(
      [
        "D.A.A.A.D",
        "DAAAAAAAD",
        "DABB.BBAD",
        "DAAAAAAAD",
        "DACECECAD",
        "DAAAAAAAD",
        "DAA...AAD",
        "D.A...A.D"
      ],
      { A: green, B: eye, C: glow, E: greenHi, D: "#052e16" }
    );
    sprBodyA = pixelSprite(
      [
        "D.AAAAA.D",
        "DAABABAAD",
        "DAAAAAAAD",
        "D.AA.AA.D",
        "DA.....AD"
      ],
      { A: lime, B: greenHi, D: "#052e16" }
    );
    sprBodyB = pixelSprite(
      [
        "D.AAAAA.D",
        "DAABABAAD",
        "DAAAAAAAD",
        "D.AA.AA.D",
        "DA.....AD"
      ],
      { A: greenDeep, B: lime, D: "#041c10" }
    );
  }

  function blocked() {
    return reduceMotion.matches || coarsePointer.matches || navigator.maxTouchPoints > 2;
  }

  function readWanted() {
    try {
      return localStorage.getItem(KEY) === "on";
    } catch (err) {
      return false;
    }
  }

  function writeWanted(on) {
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch (err) {
      /* ignore */
    }
  }

  function makeSegs() {
    segs = [];
    var i;
    for (i = 0; i < SEGMENTS; i += 1) {
      segs.push({
        x: mouse.x - i * SPACING,
        y: mouse.y,
        vx: 0,
        vy: 0
      });
    }
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function isVisibleEl(el) {
    if (!el || el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    if (el === toggle) return true;
    var style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
    var r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8;
  }

  function collectClickables() {
    var nodes = document.querySelectorAll('a[href], button, [role="button"], input, select, textarea, summary');
    clickables = [];
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (el === toggle) {
        clickables.push(el);
        continue;
      }
      if (el.classList.contains("skip")) continue;
      if (isVisibleEl(el)) clickables.push(el);
    }
  }

  function distToRect(x, y, r) {
    var cx = Math.max(r.left, Math.min(x, r.right));
    var cy = Math.max(r.top, Math.min(y, r.bottom));
    var dx = x - cx;
    var dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function closestEdgePoint(x, y, r) {
    var inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    if (!inside) {
      return {
        x: Math.max(r.left, Math.min(x, r.right)),
        y: Math.max(r.top, Math.min(y, r.bottom))
      };
    }
    var dl = x - r.left;
    var dr = r.right - x;
    var dt = y - r.top;
    var db = r.bottom - y;
    var m = Math.min(dl, dr, dt, db);
    if (m === dl) return { x: r.left, y: y };
    if (m === dr) return { x: r.right, y: y };
    if (m === dt) return { x: x, y: r.top };
    return { x: x, y: r.bottom };
  }

  function nearestClickable(x, y) {
    var best = null;
    var bestD = ATTRACT;
    var i;
    for (i = 0; i < clickables.length; i += 1) {
      var el = clickables[i];
      var r = el.getBoundingClientRect();
      var d = distToRect(x, y, r);
      if (d < bestD) {
        bestD = d;
        best = { el: el, rect: r, dist: d };
      }
    }
    return best;
  }

  function spring(seg, tx, ty, stiff, damp) {
    seg.vx += (tx - seg.x) * stiff;
    seg.vy += (ty - seg.y) * stiff;
    seg.vx *= damp;
    seg.vy *= damp;
    seg.x += seg.vx;
    seg.y += seg.vy;
  }

  function constrain(a, b, dist) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (d > dist) {
      var f = (d - dist) / d;
      b.x -= dx * f * 0.55;
      b.y -= dy * f * 0.55;
      b.vx -= dx * f * 0.12;
      b.vy -= dy * f * 0.12;
    }
  }

  function step(dt) {
    scanClock += dt;
    if (scanClock > 0.18) {
      scanClock = 0;
      collectClickables();
    }

    var near = nearestClickable(mouse.x, mouse.y);
    var head = segs[0];
    var targetX = mouse.x;
    var targetY = mouse.y;
    var stretch = 0;

    if (latched) {
      var lr = latched.getBoundingClientRect();
      var md = distToRect(mouse.x, mouse.y, lr);
      if (md > RELEASE || lr.width < 4) {
        head.vx += (mouse.x - head.x) * 0.18;
        head.vy += (mouse.y - head.y) * 0.18;
        latched = null;
      } else {
        latchPoint = closestEdgePoint(head.x, head.y, lr);
        targetX = latchPoint.x;
        targetY = latchPoint.y;
        stretch = 1;
      }
    } else if (near) {
      var edge = closestEdgePoint(mouse.x, mouse.y, near.rect);
      var lean = 1 - near.dist / ATTRACT;
      targetX = mouse.x + (edge.x - mouse.x) * (0.35 + lean * 0.5);
      targetY = mouse.y + (edge.y - mouse.y) * (0.35 + lean * 0.5);
      stretch = lean;
      if (near.dist <= LATCH_HIT || distToRect(head.x, head.y, near.rect) <= LATCH_HIT) {
        latched = near.el;
        latchPoint = closestEdgePoint(head.x, head.y, near.rect);
      }
    }

    var stiff = latched ? 0.46 : 0.26;
    spring(head, targetX, targetY, stiff, latched ? 0.58 : 0.72);

    var trailX = 0;
    var trailY = 1;
    if (latched && latched.getBoundingClientRect) {
      var lr2 = latched.getBoundingClientRect();
      var cx = lr2.left + lr2.width / 2;
      var cy = lr2.top + lr2.height / 2;
      trailX = head.x - cx;
      trailY = head.y - cy;
      var mouseDx = mouse.x - head.x;
      var mouseDy = mouse.y - head.y;
      var mouseDist = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
      if (mouseDist > 36) {
        trailX = mouseDx;
        trailY = mouseDy;
      }
    } else {
      trailX = mouse.x - head.x;
      trailY = mouse.y - head.y;
    }
    var trailLen = Math.sqrt(trailX * trailX + trailY * trailY) || 1;
    trailX /= trailLen;
    trailY /= trailLen;

    var i;
    for (i = 1; i < segs.length; i += 1) {
      var prev = segs[i - 1];
      var seg = segs[i];
      var space = SPACING + stretch * 8 * (i < 3 ? 1 : 0.4);
      var followX;
      var followY;
      if (latched) {
        var stepDist = space;
        var stretchDist = Math.sqrt((mouse.x - head.x) * (mouse.x - head.x) + (mouse.y - head.y) * (mouse.y - head.y));
        if (stretchDist > 40) {
          stepDist = Math.max(space * 0.75, Math.min(space * 1.35, stretchDist / (segs.length - 1)));
        }
        followX = head.x + trailX * stepDist * i;
        followY = head.y + trailY * stepDist * i;
        spring(seg, followX, followY, 0.28, 0.66);
      } else {
        var dx = prev.x - seg.x;
        var dy = prev.y - seg.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        followX = prev.x - (dx / dist) * space;
        followY = prev.y - (dy / dist) * space;
        spring(seg, followX, followY, 0.3, 0.68);
        constrain(prev, seg, space + 6);
      }
    }

    var idle = 1 / (1 + Math.hypot(head.vx, head.vy) * 0.12);
    var now = performance.now() / 1000;
    for (i = 0; i < segs.length; i += 1) {
      var n = segs[i === 0 ? 1 : i - 1];
      var s = segs[i];
      var px = n.x - s.x;
      var py = n.y - s.y;
      var plen = Math.sqrt(px * px + py * py) || 1;
      var wx = -py / plen;
      var wy = px / plen;
      var amp = (latched ? 0.6 : 2.1) * idle;
      s.x += wx * Math.sin(now * 7 + i * 0.85) * amp * dt * 60 * 0.04;
      s.y += wy * Math.sin(now * 7 + i * 0.85) * amp * dt * 60 * 0.04;
    }
  }

  function drawSpr(spr, x, y, scale, angle) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;
    var dw = spr.w * scale;
    var dh = spr.h * scale;
    ctx.drawImage(spr.canvas, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var i;
    for (i = segs.length - 1; i >= 1; i -= 1) {
      var seg = segs[i];
      var prev = segs[i - 1];
      var ang = Math.atan2(prev.y - seg.y, prev.x - seg.x);
      drawSpr(i % 2 ? sprBodyA : sprBodyB, seg.x, seg.y, 3.8, ang);
    }
    var head = segs[0];
    var neck = segs[1] || head;
    var hang = Math.atan2(head.y - neck.y, head.x - neck.x);
    if (latched) {
      hang = Math.atan2(latchPoint.y - neck.y, latchPoint.x - neck.x);
    } else {
      var look = nearestClickable(head.x, head.y);
      if (look && look.dist < ATTRACT) {
        var edge = closestEdgePoint(head.x, head.y, look.rect);
        hang = Math.atan2(edge.y - neck.y, edge.x - neck.x);
      }
    }
    drawSpr(sprHead, head.x, head.y, 4.4, hang + Math.PI / 2);
    ctx.fillStyle = "rgba(165, 243, 252, 0.9)";
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick(now) {
    if (!enabled) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
    if (!last) last = now;
    var dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!mouse.inside) return;
    step(dt);
    draw();
  }

  function setEnabled(on) {
    enabled = !!on && !blocked();
    toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
    document.body.classList.toggle("caterpillar-on", enabled);
    canvas.hidden = !enabled;
    canvas.setAttribute("aria-hidden", enabled ? "true" : "true");
    if (enabled) {
      makeSegs();
      collectClickables();
      resize();
      last = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    } else {
      latched = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function applyFromStorage() {
    setEnabled(readWanted());
  }

  toggle.addEventListener("click", function () {
    if (blocked()) {
      setEnabled(false);
      return;
    }
    var next = toggle.getAttribute("aria-pressed") !== "true";
    writeWanted(next);
    setEnabled(next);
  });

  window.addEventListener(
    "pointermove",
    function (event) {
      if (event.pointerType === "touch") return;
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.inside = true;
    },
    { passive: true }
  );
  window.addEventListener("pointerleave", function () {
    mouse.inside = false;
  });
  window.addEventListener("blur", function () {
    mouse.inside = false;
  });
  window.addEventListener("resize", function () {
    if (enabled) {
      resize();
      collectClickables();
    }
  });

  function onBlockChange() {
    if (blocked()) {
      toggle.hidden = true;
      setEnabled(false);
    } else {
      toggle.hidden = false;
      applyFromStorage();
    }
  }
  reduceMotion.addEventListener("change", onBlockChange);
  coarsePointer.addEventListener("change", onBlockChange);

  bake();
  resize();
  if (blocked()) {
    toggle.hidden = true;
    toggle.setAttribute("aria-pressed", "false");
    return;
  }
  applyFromStorage();
})();
