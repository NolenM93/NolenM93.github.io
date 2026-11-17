/* Playable Space Invaders style shooter using the same ships as the hero. */
(function () {
  "use strict";

  var root = document.getElementById("space-game");
  var clip = document.getElementById("space-game-clip");
  var openBtn = document.getElementById("play-game-btn");
  var canvas = document.getElementById("game-canvas");
  var overlay = document.getElementById("game-overlay");
  var intro = document.getElementById("game-intro");
  var titleEl = document.getElementById("game-title-card");
  var chooseEl = document.getElementById("game-choose");
  var overEl = document.getElementById("game-over");
  var overScore = document.getElementById("game-over-score");
  var overHigh = document.getElementById("game-over-high");
  var touchEl = document.getElementById("game-touch");
  var scoreEl = document.querySelector("[data-game-score]");
  var highEl = document.querySelector("[data-game-high]");
  var livesEl = document.querySelector("[data-game-lives]");
  var levelEl = document.querySelector("[data-game-level]");
  var restartBtn = document.getElementById("game-restart");
  var closeBtn = document.getElementById("game-close");
  if (!root || !openBtn || !canvas || !window.NMShips) return;

  var C = window.NMShips.C;
  var sprites = window.NMShips.makeSprites();
  var drawSprite = window.NMShips.drawSprite;
  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  var HS_KEY = "nm-space-highscore";
  var DIFFS = {
    easy: {
      name: "Easy",
      cols: 5,
      rows: 3,
      enemySpeed: 28,
      drop: 10,
      playerSpeed: 280,
      playerCooldown: 0.34,
      shotMin: 1.35,
      shotMax: 2.15,
      shotSpeed: 100,
      diveMin: 3.2,
      diveMax: 5.0,
      diveDur: 2.8
    },
    medium: {
      name: "Medium",
      cols: 6,
      rows: 4,
      enemySpeed: 46,
      drop: 14,
      playerSpeed: 320,
      playerCooldown: 0.26,
      shotMin: 0.8,
      shotMax: 1.35,
      shotSpeed: 150,
      diveMin: 2.0,
      diveMax: 3.3,
      diveDur: 2.3
    },
    hard: {
      name: "Hard",
      cols: 7,
      rows: 4,
      enemySpeed: 70,
      drop: 18,
      playerSpeed: 360,
      playerCooldown: 0.2,
      shotMin: 0.42,
      shotMax: 0.8,
      shotSpeed: 220,
      diveMin: 1.1,
      diveMax: 1.9,
      diveDur: 1.85
    }
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var isPhone = window.matchMedia("(max-width: 768px)").matches || navigator.maxTouchPoints > 1;
  var dprCap = isPhone ? 1.5 : 2;
  var EXPAND_MS = reduceMotion.matches ? 80 : 1250;
  var INTRO_MS = reduceMotion.matches ? 120 : 900;

  var state = "closed";
  var openTimer = 0;
  var introTimer = 0;
  var difficulty = "medium";
  var wave = 1;
  var score = 0;
  var lives = 3;
  var high = 0;
  try {
    high = parseInt(localStorage.getItem(HS_KEY) || "0", 10) || 0;
  } catch (err) {
    high = 0;
  }

  var w = 1;
  var h = 1;
  var last = 0;
  var raf = 0;
  var time = 0;
  var keys = { left: false, right: false, fire: false };
  var touchHold = { left: false, right: false, fire: false };
  var player = { x: 0, y: 0, cooldown: 0, flash: 0, invuln: 0, scale: 2.6 };
  var enemies = [];
  var shots = [];
  var particles = [];
  var stars = [];
  var formX = 0;
  var formY = 0;
  var formDir = 1;
  var nextDive = 2;
  var nextEnemyShot = 1;
  var entering = 0;

  function cfg() {
    return DIFFS[difficulty] || DIFFS.medium;
  }

  function speedMul() {
    return 1 + (wave - 1) * 0.16;
  }

  function setHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (highEl) highEl.textContent = String(high);
    if (livesEl) livesEl.textContent = String(Math.max(0, lives));
    if (levelEl) {
      if (state === "playing" || state === "dead") {
        var label = cfg().name.toUpperCase();
        levelEl.textContent = wave > 1 ? label + " " + wave : label;
      } else {
        levelEl.textContent = "-";
      }
    }
  }

  function saveHigh() {
    if (score > high) {
      high = score;
      try {
        localStorage.setItem(HS_KEY, String(high));
      } catch (err) {
        /* ignore quota / private mode */
      }
    }
    setHud();
  }

  function lockScroll(on) {
    document.documentElement.classList.toggle("is-playing-game", on);
    document.body.classList.toggle("is-playing-game", on);
  }

  function pauseHero(on) {
    if (!window.NMHeroScene) return;
    if (on) window.NMHeroScene.pause();
    else window.NMHeroScene.resume();
  }

  function seedStars() {
    stars = [];
    var n = isPhone ? 42 : 80;
    for (var i = 0; i < n; i += 1) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        z: 0.35 + Math.random() * 1.4,
        s: Math.random() < 0.12 ? 2 : 1
      });
    }
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    var cw = canvas.clientWidth;
    var ch = canvas.clientHeight;
    if (cw < 8 || ch < 8) return;
    w = cw;
    h = ch;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.y = h * 0.88;
    if (!player.x) player.x = w / 2;
    player.scale = w < 420 ? 2.2 : 2.7;
    layoutHomes();
  }

  function layoutHomes() {
    var d = cfg();
    var marginX = Math.max(28, w * 0.08);
    var gapX = (w - marginX * 2) / Math.max(1, d.cols - 1);
    var top = h * 0.12;
    var rowH = Math.min(46, h * 0.09);
    enemies.forEach(function (en) {
      en.homeX = marginX + en.col * gapX;
      en.homeY = top + en.row * rowH;
    });
  }

  function spawnWave() {
    var d = cfg();
    enemies = [];
    formX = 0;
    formY = 0;
    formDir = 1;
    nextDive = d.diveMin;
    nextEnemyShot = d.shotMin;
    entering = 0.65;
    for (var row = 0; row < d.rows; row += 1) {
      for (var col = 0; col < d.cols; col += 1) {
        var cyan = row === d.rows - 1 || (row === d.rows - 2 && col % 2 === 0);
        enemies.push({
          col: col,
          row: row,
          cyan: cyan,
          homeX: 0,
          homeY: 0,
          x: 0,
          y: 0,
          mode: "form",
          t: 0,
          alive: true,
          scale: cyan ? (w < 420 ? 2.0 : 2.5) : w < 420 ? 1.8 : 2.2,
          fromX: 0,
          fromY: 0,
          c1x: 0,
          c1y: 0,
          c2x: 0,
          c2y: 0
        });
      }
    }
    layoutHomes();
    enemies.forEach(function (en) {
      en.x = en.homeX;
      en.y = en.homeY - 80;
    });
  }

  function resetRun(diff) {
    difficulty = diff || difficulty;
    wave = 1;
    score = 0;
    lives = 3;
    shots = [];
    particles = [];
    keys.left = keys.right = keys.fire = false;
    touchHold.left = touchHold.right = touchHold.fire = false;
    player.x = w / 2;
    player.y = h * 0.88;
    player.cooldown = 0;
    player.flash = 0;
    player.invuln = 1.25;
    spawnWave();
    setHud();
  }

  function spawnShot(x, y, vy, ally) {
    if (shots.length > 36) shots.shift();
    shots.push({ x: x, y: y, vy: vy, ally: ally, life: 2.6 });
  }

  function burst(x, y, color, n) {
    var count = n || (isPhone ? 7 : 12);
    for (var i = 0; i < count; i += 1) {
      var a = Math.random() * Math.PI * 2;
      var sp = 50 + Math.random() * 110;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3,
        color: color
      });
    }
  }

  function hitTest(ax, ay, bx, by, r) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy < r * r;
  }

  function bezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }

  function startDive(en) {
    if (!en.alive || en.mode === "dive") return;
    en.mode = "dive";
    en.t = 0;
    en.fromX = en.x;
    en.fromY = en.y;
    var side = en.x > w / 2 ? 1 : -1;
    en.c1x = en.x + side * w * 0.18;
    en.c1y = en.y + h * 0.2;
    en.c2x = player.x - side * 40;
    en.c2y = player.y - 20;
  }

  function hurtPlayer() {
    if (player.invuln > 0) return;
    lives -= 1;
    player.flash = 0.22;
    player.invuln = 1.4;
    burst(player.x, player.y - 4, C.orangeHi, 14);
    setHud();
    if (lives <= 0) {
      saveHigh();
      showOver();
    }
  }

  function showOverlay(mode) {
    if (!overlay) return;
    overlay.hidden = false;
    overlay.dataset.mode = mode;
    if (intro) intro.hidden = mode === "over";
    if (overEl) overEl.hidden = mode !== "over";
    if (titleEl) titleEl.hidden = mode !== "title" && mode !== "choose";
    if (chooseEl) chooseEl.hidden = mode !== "choose";
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  function showOver() {
    state = "dead";
    lockScroll(true);
    if (overScore) overScore.textContent = String(score);
    if (overHigh) overHigh.textContent = String(high);
    showOverlay("over");
    if (closeBtn) closeBtn.focus();
  }

  function showChoose() {
    state = "choose";
    showOverlay("choose");
    var first = chooseEl && chooseEl.querySelector("[data-diff]");
    if (first) first.focus();
  }

  function startPlay(diff) {
    difficulty = diff || difficulty;
    state = "playing";
    resetRun(difficulty);
    hideOverlay();
    lockScroll(true);
    canvas.focus({ preventScroll: true });
  }

  function aliveEnemies() {
    var n = 0;
    for (var i = 0; i < enemies.length; i += 1) {
      if (enemies[i].alive) n += 1;
    }
    return n;
  }

  function step(dt) {
    time += dt;
    var d = cfg();
    var mul = speedMul();
    var left = keys.left || touchHold.left;
    var right = keys.right || touchHold.right;
    var fire = keys.fire || touchHold.fire;

    if (entering > 0) entering = Math.max(0, entering - dt);

    player.cooldown -= dt;
    player.flash = Math.max(0, player.flash - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    if (left) player.x -= d.playerSpeed * dt;
    if (right) player.x += d.playerSpeed * dt;
    player.x = Math.max(22, Math.min(w - 22, player.x));
    player.y = h * 0.88;
    if (fire && player.cooldown <= 0 && state === "playing") {
      spawnShot(player.x, player.y - 16, -380, true);
      player.cooldown = d.playerCooldown;
    }

    if (state !== "playing") return;

    var speed = d.enemySpeed * mul;
    formX += formDir * speed * dt;
    var edge = Math.max(16, w * 0.045);
    if (formX > edge || formX < -edge) {
      formDir *= -1;
      formX = Math.max(-edge, Math.min(edge, formX));
      formY += d.drop;
    }

    nextDive -= dt;
    if (nextDive <= 0 && entering <= 0) {
      var divers = enemies.filter(function (en) {
        return en.alive && en.mode === "form";
      });
      if (divers.length) startDive(divers[(Math.random() * divers.length) | 0]);
      nextDive = (d.diveMin + Math.random() * (d.diveMax - d.diveMin)) / mul;
    }

    nextEnemyShot -= dt;
    if (nextEnemyShot <= 0 && entering <= 0) {
      var shooters = enemies.filter(function (en) {
        return en.alive;
      });
      if (shooters.length) {
        var sh = shooters[(Math.random() * shooters.length) | 0];
        spawnShot(sh.x, sh.y + 12, d.shotSpeed * mul, false);
      }
      nextEnemyShot = (d.shotMin + Math.random() * (d.shotMax - d.shotMin)) / mul;
    }

    enemies.forEach(function (en) {
      if (!en.alive) return;
      var hx = en.homeX + formX;
      var hy = en.homeY + formY + Math.sin(time * 1.2 + en.col) * 3;
      if (en.mode === "form") {
        if (entering > 0) {
          en.x = hx;
          en.y += (hy - en.y) * Math.min(1, dt * 4);
        } else {
          en.x = hx;
          en.y = hy;
        }
        if (entering <= 0 && en.y > player.y - 28) {
          lives = 0;
          setHud();
          saveHigh();
          showOver();
        }
      } else {
        en.t += dt / (d.diveDur / mul);
        if (en.t >= 1) {
          en.mode = "form";
          en.t = 0;
        } else {
          en.x = bezier(en.fromX, en.c1x, en.c2x, hx, en.t);
          en.y = bezier(en.fromY, en.c1y, en.c2y, hy, en.t);
        }
        if (hitTest(en.x, en.y, player.x, player.y, 16)) hurtPlayer();
      }
    });

    for (var i = shots.length - 1; i >= 0; i -= 1) {
      var s = shots[i];
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.y < -24 || s.y > h + 24) {
        shots.splice(i, 1);
        continue;
      }
      if (s.ally) {
        for (var j = 0; j < enemies.length; j += 1) {
          var en = enemies[j];
          if (!en.alive) continue;
          if (hitTest(s.x, s.y, en.x, en.y, 14)) {
            en.alive = false;
            en.mode = "form";
            score += en.cyan ? 250 : 100;
            saveHigh();
            burst(en.x, en.y, en.cyan ? C.cyanHi : C.orangeHi, isPhone ? 8 : 13);
            shots.splice(i, 1);
            break;
          }
        }
      } else if (hitTest(s.x, s.y, player.x, player.y, 13)) {
        shots.splice(i, 1);
        hurtPlayer();
      }
    }

    if (state === "playing" && aliveEnemies() === 0 && enemies.length) {
      wave += 1;
      score += 500;
      saveHigh();
      spawnWave();
      setHud();
    }

    for (var p = particles.length - 1; p >= 0; p -= 1) {
      var pt = particles[p];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 50 * dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    stars.forEach(function (st) {
      st.y += (0.04 + st.z * 0.06) * dt;
      if (st.y > 1) {
        st.y -= 1;
        st.x = Math.random();
      }
    });
  }

  function draw() {
    ctx.fillStyle = "#070b10";
    ctx.fillRect(0, 0, w, h);
    stars.forEach(function (st) {
      ctx.globalAlpha = 0.22 + st.z * 0.42;
      ctx.fillStyle = C.star;
      ctx.fillRect(st.x * w, st.y * h, st.s, st.s);
    });
    ctx.globalAlpha = 1;

    shots.forEach(function (s) {
      ctx.fillStyle = s.ally ? C.cyanHi : C.orange;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(s.x - 3, s.y - (s.ally ? 8 : 6), 6, s.ally ? 12 : 10);
      ctx.globalAlpha = 1;
      ctx.fillRect(s.x - 1.5, s.y - (s.ally ? 8 : 6), 3, s.ally ? 11 : 9);
    });

    enemies.forEach(function (en) {
      if (!en.alive) return;
      var spr = en.cyan ? sprites.enemyCyan : sprites.enemyOrange;
      var ang = 0;
      if (en.mode === "dive") ang = Math.atan2(player.y - en.y, player.x - en.x) - Math.PI / 2;
      drawSprite(ctx, spr, en.x, en.y, en.scale, ang);
    });

    if (state === "playing" || state === "dead") {
      if (player.invuln > 0) ctx.globalAlpha = 0.45 + Math.sin(time * 28) * 0.35;
      else if (player.flash > 0) ctx.globalAlpha = 0.55 + Math.sin(time * 40) * 0.25;
      drawSprite(ctx, sprites.player, player.x, player.y, player.scale, 0);
      ctx.globalAlpha = 1;
    }

    particles.forEach(function (pt) {
      ctx.globalAlpha = Math.max(0, pt.life * 3);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 2, 2);
    });
    ctx.globalAlpha = 1;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!last) last = now;
    var dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state === "closed" || state === "closing") return;
    if (state === "playing") step(dt);
    if (w > 8) draw();
  }

  function openGame() {
    if (state !== "closed") {
      if (state !== "opening") closeGame();
      return;
    }
    state = "opening";
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("is-game-open");
    openBtn.setAttribute("aria-expanded", "true");
    pauseHero(true);
    seedStars();
    showOverlay("title");
    if (titleEl) titleEl.hidden = false;
    if (chooseEl) chooseEl.hidden = true;
    if (overEl) overEl.hidden = true;
    setHud();
    requestAnimationFrame(function () {
      resize();
      root.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
    });
    window.clearTimeout(openTimer);
    window.clearTimeout(introTimer);
    openTimer = window.setTimeout(function () {
      if (state !== "opening") return;
      state = "intro";
      resize();
      root.scrollIntoView({ behavior: "auto", block: "start" });
      introTimer = window.setTimeout(function () {
        if (state !== "intro" && state !== "opening") return;
        showChoose();
      }, INTRO_MS);
    }, EXPAND_MS);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function closeGame() {
    window.clearTimeout(openTimer);
    window.clearTimeout(introTimer);
    state = "closing";
    keys.left = keys.right = keys.fire = false;
    touchHold.left = touchHold.right = touchHold.fire = false;
    lockScroll(false);
    pauseHero(false);
    root.classList.remove("is-open");
    document.documentElement.classList.remove("is-game-open");
    root.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("aria-expanded", "false");
    hideOverlay();
    window.setTimeout(function () {
      if (!root.classList.contains("is-open")) state = "closed";
    }, EXPAND_MS);
    openBtn.focus();
  }

  function onKey(event, down) {
    var key = event.key;
    var playing = state === "playing";
    if (playing && (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown" || key === " " || key === "Spacebar" || key === "a" || key === "A" || key === "d" || key === "D")) {
      event.preventDefault();
    }
    if (key === "ArrowLeft" || key === "a" || key === "A") keys.left = down;
    if (key === "ArrowRight" || key === "d" || key === "D") keys.right = down;
    if (key === " " || key === "Spacebar") keys.fire = down;
    if (down && key === "Escape") {
      if (state === "choose" || state === "intro" || state === "dead" || state === "opening") closeGame();
    }
  }

  function bindTouch() {
    if (!touchEl) return;
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) touchEl.classList.add("is-visible");
    else touchEl.classList.remove("is-visible");
    Array.prototype.forEach.call(touchEl.querySelectorAll("[data-touch]"), function (btn) {
      var which = btn.getAttribute("data-touch");
      var set = function (on) {
        if (which === "left") touchHold.left = on;
        if (which === "right") touchHold.right = on;
        if (which === "fire") touchHold.fire = on;
      };
      btn.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        btn.setPointerCapture(event.pointerId);
        set(true);
      });
      btn.addEventListener("pointerup", function () {
        set(false);
      });
      btn.addEventListener("pointercancel", function () {
        set(false);
      });
      btn.addEventListener("lostpointercapture", function () {
        set(false);
      });
    });
    var coarseMq = window.matchMedia("(pointer: coarse)");
    if (coarseMq.addEventListener) {
      coarseMq.addEventListener("change", function () {
        if (coarseMq.matches) touchEl.classList.add("is-visible");
        else touchEl.classList.remove("is-visible");
      });
    }
  }

  function preventPageScroll(event) {
    if (state === "playing") event.preventDefault();
  }

  openBtn.addEventListener("click", openGame);
  if (closeBtn) closeBtn.addEventListener("click", closeGame);
  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      if (state !== "playing" && state !== "dead") return;
      startPlay(difficulty);
    });
  }
  if (chooseEl) {
    chooseEl.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-diff]");
      if (!btn) return;
      startPlay(btn.getAttribute("data-diff"));
    });
  }
  var overRestart = document.getElementById("game-over-restart");
  if (overRestart) {
    overRestart.addEventListener("click", function () {
      if (state !== "dead") return;
      startPlay(difficulty);
    });
  }
  document.addEventListener("keydown", function (event) {
    onKey(event, true);
  });
  document.addEventListener("keyup", function (event) {
    onKey(event, false);
  });
  window.addEventListener("touchmove", preventPageScroll, { passive: false });
  window.addEventListener("wheel", preventPageScroll, { passive: false });
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(canvas);
  }
  bindTouch();
  setHud();

  window.NMSpaceGame = {
    open: openGame,
    close: closeGame,
    getState: function () {
      return state;
    }
  };
})();
