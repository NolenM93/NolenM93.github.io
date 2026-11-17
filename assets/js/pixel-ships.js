/* Shared Galaga-style pixel ships used by the hero scene and the playable game. */
(function (global) {
  "use strict";

  var C = {
    cyan: "#22d3ee",
    cyanHi: "#a5f3fc",
    cyanDim: "#155e75",
    orange: "#ff9b6a",
    orangeHi: "#ffd3ba",
    orangeDim: "#9a3412",
    spark: "#fff4d6",
    star: "#9ab0c8"
  };

  function pixelSprite(rows, colors) {
    var pw = rows[0].length;
    var ph = rows.length;
    var c = document.createElement("canvas");
    c.width = pw;
    c.height = ph;
    var g = c.getContext("2d");
    for (var y = 0; y < ph; y += 1) {
      for (var x = 0; x < pw; x += 1) {
        var ch = rows[y].charAt(x);
        if (ch === "." || !colors[ch]) continue;
        g.fillStyle = colors[ch];
        g.fillRect(x, y, 1, 1);
      }
    }
    return { canvas: c, w: pw, h: ph };
  }

  function makeSprites() {
    return {
      player: pixelSprite(
        [
          "......A......",
          ".....AAA.....",
          "....AABAA....",
          "...AA.A.AA...",
          "..AAAAAAAAA..",
          ".AAABABABAAA.",
          "AAAAABABAAAAA",
          "A.AAA...AAA.A",
          "..C.......C.."
        ],
        { A: C.cyan, B: C.cyanHi, C: C.orange }
      ),
      enemyCyan: pixelSprite(
        [
          ".A.........A.",
          "..A.......A..",
          ".AAAAAAAAAAA.",
          "AA.AABABAA.AA",
          "AAAAAAAAAAAAA",
          ".AAA.....AAA.",
          "..AA.....AA..",
          "...A.....A..."
        ],
        { A: C.cyan, B: C.cyanHi }
      ),
      enemyOrange: pixelSprite(
        [
          ".A.........A.",
          "A.A.......A.A",
          ".AAAAAAAAAAA.",
          "AA.AABBABB.AA",
          "AAAAAAAAAAAAA",
          ".AAA.AAA.AAA.",
          "..A.......A.."
        ],
        { A: C.orange, B: C.orangeHi }
      )
    };
  }

  function drawSprite(ctx, spr, x, y, scale, angle) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;
    var dw = spr.w * scale;
    var dh = spr.h * scale;
    ctx.drawImage(spr.canvas, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  global.NMShips = {
    C: C,
    pixelSprite: pixelSprite,
    makeSprites: makeSprites,
    drawSprite: drawSprite
  };
})(window);
