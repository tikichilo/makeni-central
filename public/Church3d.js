/*!
 * church3d.js — Makeni Central SDA Church · new sanctuary, interactive 3D model
 * Requires Three.js r128 (global THREE) loaded BEFORE this file:
 *   https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
 *
 * Usage (auto):   <div data-church3d data-fallback="images/jjz.png"></div>
 * Usage (manual): const v = Church3D.mount(el, { wheelZoom:'ctrl', touchAction:'pan-y' });
 *
 * Artist's impression modelled from the architect's render — final build may vary.
 */
(function (global) {
  'use strict';

  /* ───────────────────────── helpers ───────────────────────── */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function srgb(THREE, tex) {
    if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
  }
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* ───────────────────────── procedural textures ───────────────────────── */
  function makeTextures(THREE, R) {
    function tex(c, repeat) {
      var t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      t.anisotropy = 8;
      srgb(THREE, t);
      return t;
    }
    var T = {};

    // Natural stone cladding
    var c = canvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#6f6454'; g.fillRect(0, 0, 256, 256);
    var pal = ['#dcd0b6', '#cfc2a6', '#c4b69a', '#e4dac4', '#b9ab90', '#d3c7ac'];
    var y = 0;
    while (y < 256) {
      var h = 22 + Math.floor(R() * 14); if (y + h > 256) h = 256 - y;
      var x = -Math.floor(R() * 40);
      while (x < 256) {
        var w = 44 + Math.floor(R() * 50);
        g.fillStyle = pal[Math.floor(R() * pal.length)];
        g.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
        for (var i = 0; i < 14; i++) {
          g.fillStyle = 'rgba(60,50,35,' + (R() * 0.12) + ')';
          g.fillRect(x + R() * w, y + R() * h, 2 + R() * 3, 1 + R() * 2);
        }
        x += w;
      }
      y += h;
    }
    T.stone = tex(c);

    // Interlocking pavers
    c = canvas(512, 512); g = c.getContext('2d');
    g.fillStyle = '#34363c'; g.fillRect(0, 0, 512, 512);
    var greys = ['#6a6c73', '#74767d', '#5f6168', '#7d7f86', '#686a70', '#807c78'];
    for (var row = 0; row < 32; row++) {
      var off = (row % 2) * 16;
      for (var bx = -32; bx < 512; bx += 32) {
        g.fillStyle = greys[Math.floor(R() * greys.length)];
        g.fillRect(bx + off + 1, row * 16 + 1, 30, 14);
      }
    }
    T.paver = tex(c);

    // Slate roof
    c = canvas(256, 256); g = c.getContext('2d');
    g.fillStyle = '#1b1f26'; g.fillRect(0, 0, 256, 256);
    var sl = ['#2e3440', '#343b48', '#2a303b', '#3a4252', '#30363f'];
    for (var r2 = 0; r2 < 16; r2++) {
      var o2 = (r2 % 2) * 16;
      for (var sx = -32; sx < 256; sx += 32) {
        g.fillStyle = sl[Math.floor(R() * sl.length)];
        g.fillRect(sx + o2 + 1, r2 * 16 + 1, 30, 14);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(sx + o2 + 1, r2 * 16 + 1, 30, 2);
      }
    }
    T.roof = tex(c);

    // Lit window glass
    c = canvas(64, 128); g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#1a2431'); gr.addColorStop(0.55, '#2a2d31'); gr.addColorStop(1, '#7a5426');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
    [[18, 40, 14], [46, 34, 12], [32, 62, 16], [12, 84, 10], [52, 80, 12]].forEach(function (b) {
      var rg = g.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]);
      rg.addColorStop(0, 'rgba(255,214,150,0.75)'); rg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 64, 128);
    });
    g.fillStyle = 'rgba(160,200,240,0.10)';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 0); g.lineTo(0, 60); g.fill();
    T.win = tex(c);
    T.win.wrapS = T.win.wrapT = THREE.ClampToEdgeWrapping;

    // Soft glow sprite
    c = canvas(128, 128); g = c.getContext('2d');
    var rg2 = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg2.addColorStop(0, 'rgba(255,205,130,0.95)');
    rg2.addColorStop(0.35, 'rgba(255,190,110,0.35)');
    rg2.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = rg2; g.fillRect(0, 0, 128, 128);
    T.glow = tex(c);
    T.glow.wrapS = T.glow.wrapT = THREE.ClampToEdgeWrapping;

    // Cloud sprite
    c = canvas(256, 128); g = c.getContext('2d');
    for (var k = 0; k < 18; k++) {
      var cx = 40 + R() * 176, cy = 54 + R() * 30, cr = 22 + R() * 30;
      var cg = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cg.addColorStop(0, 'rgba(255,255,255,0.9)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg; g.fillRect(0, 0, 256, 128);
    }
    T.cloud = tex(c);
    T.cloud.wrapS = T.cloud.wrapT = THREE.ClampToEdgeWrapping;

    // Sky gradient
    c = canvas(8, 512); g = c.getContext('2d');
    var sg = g.createLinearGradient(0, 0, 0, 512);
    sg.addColorStop(0, '#2d6bd0'); sg.addColorStop(0.45, '#5f9be3');
    sg.addColorStop(0.75, '#a9cdef'); sg.addColorStop(0.92, '#dfe6ea'); sg.addColorStop(1, '#efe3cc');
    g.fillStyle = sg; g.fillRect(0, 0, 8, 512);
    T.sky = tex(c);
    T.sky.wrapS = T.sky.wrapT = THREE.ClampToEdgeWrapping;

    return T;
  }

  /* ───────────────────────── custom geometry ───────────────────────── */
  function hipRoofGeometry(THREE, x0, x1, z0, z1, y0, y1, tx0, tx1, tz0, tz1) {
    var pos = [], uv = [], S = 5;
    function quad(a, b, c, d) {
      [a, b, c, a, c, d].forEach(function (p) { pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); });
    }
    var rise = y1 - y0;
    var sZ = Math.sqrt(rise * rise + (z1 - tz1) * (z1 - tz1));
    var sX = Math.sqrt(rise * rise + (x1 - tx1) * (x1 - tx1));
    quad([x0, y0, z1, x0 / S, 0], [x1, y0, z1, x1 / S, 0], [tx1, y1, tz1, tx1 / S, sZ / S], [tx0, y1, tz1, tx0 / S, sZ / S]);
    quad([x1, y0, z0, x1 / S, 0], [x0, y0, z0, x0 / S, 0], [tx0, y1, tz0, tx0 / S, sZ / S], [tx1, y1, tz0, tx1 / S, sZ / S]);
    quad([x1, y0, z1, z1 / S, 0], [x1, y0, z0, z0 / S, 0], [tx1, y1, tz0, tz0 / S, sX / S], [tx1, y1, tz1, tz1 / S, sX / S]);
    quad([x0, y0, z0, z0 / S, 0], [x0, y0, z1, z1 / S, 0], [tx0, y1, tz1, tz1 / S, sX / S], [tx0, y1, tz0, tz0 / S, sX / S]);
    quad([tx0, y1, tz1, tx0 / S, tz1 / S], [tx1, y1, tz1, tx1 / S, tz1 / S], [tx1, y1, tz0, tx1 / S, tz0 / S], [tx0, y1, tz0, tx0 / S, tz0 / S]);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  function frondGeometry(THREE) {
    var seg = 7, L = 3.2, pos = [], uv = [], idx = [];
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var x = t * L * 0.95;
      var y = L * (0.75 * t - 0.95 * t * t);
      var wv = 0.42 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.08)) * (1 - 0.35 * t) + 0.02;
      pos.push(x, y, -wv, x, y, wv);
      uv.push(0, t, 1, t);
      if (i < seg) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ───────────────────────── the model ───────────────────────── */
  function buildModel(THREE, scene) {
    var R = rng(11), T = makeTextures(THREE, R);
    var root = new THREE.Group();
    scene.add(root);
    var occluders = [];

    var Y0 = 0.35;   // podium top
    var WT = 9.55;   // wall top
    var CX = -0.7;   // building centre-x

    /* materials */
    var M = {
      cream:  new THREE.MeshStandardMaterial({ color: 0xe6d8ae, roughness: 0.92 }),
      creamL: new THREE.MeshStandardMaterial({ color: 0xeee3c4, roughness: 0.9 }),
      soffit: new THREE.MeshStandardMaterial({ color: 0xcfc29c, roughness: 1 }),
      podium: new THREE.MeshStandardMaterial({ color: 0xdcd2bb, roughness: 0.75 }),
      band:   new THREE.MeshStandardMaterial({ color: 0xcfc9ba, roughness: 0.8 }),
      grey:   new THREE.MeshStandardMaterial({ color: 0xa3a09a, roughness: 0.8 }),
      dark:   new THREE.MeshStandardMaterial({ color: 0x2c3037, roughness: 0.7 }),
      bronze: new THREE.MeshStandardMaterial({ color: 0xa97c36, roughness: 0.5, metalness: 0.25 }),
      steel:  new THREE.MeshStandardMaterial({ color: 0xaab2ba, roughness: 0.4, metalness: 0.4 }),
      slate:  new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.85, side: THREE.DoubleSide }),
      glass:  new THREE.MeshBasicMaterial({ map: T.win }),
      lawn:   new THREE.MeshStandardMaterial({ color: 0x587a45, roughness: 1 }),
      soil:   new THREE.MeshStandardMaterial({ color: 0x3a2b1f, roughness: 1 }),
      kerb:   new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.8 }),
      white:  new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.6 }),
      trunk:  new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }),
      line:   new THREE.MeshBasicMaterial({ color: 0xe9e9e4 }),
      lampTop:new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
      frond1: new THREE.MeshLambertMaterial({ color: 0x3c7a31, side: THREE.DoubleSide }),
      frond2: new THREE.MeshLambertMaterial({ color: 0x2f6a2a, side: THREE.DoubleSide }),
      tire:   new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9 }),
      hub:    new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.4, metalness: 0.5 })
    };
    var shrubMats = [0x2f5e2b, 0x3b7133, 0x2a5527, 0x467a38].map(function (c) {
      return new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
    });
    var glowMat = new THREE.SpriteMaterial({
      map: T.glow, color: 0xffc77a, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.38, fog: false
    });

    /* primitives */
    function mesh(geo, mat, x, y, z, cast, recv) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = cast !== false;
      m.receiveShadow = recv !== false;
      root.add(m);
      return m;
    }
    function box(w, h, d, mat, x, y, z, cast) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast); }
    function boxE(x0, x1, y0, y1, z0, z1, mat, cast) {
      return box(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, cast);
    }
    function plane(w, h, mat, x, y, z) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z); root.add(m); return m;
    }
    function glow(x, y, z, s, op) {
      var sp = new THREE.Sprite(op ? glowMat.clone() : glowMat);
      if (op) sp.material.opacity = op;
      sp.position.set(x, y, z); sp.scale.set(s, s, 1); root.add(sp); return sp;
    }
    function stoneMat(rx, ry) {
      var t = T.stone.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    }

    /* ── ground ── */
    var lawn = mesh(new THREE.CircleGeometry(320, 48), M.lawn, 0, -0.05, 0, false, true);
    lawn.rotation.x = -Math.PI / 2;

    var paverTex = T.paver.clone(); paverTex.needsUpdate = true; paverTex.repeat.set(27.5, 13);
    var lot = mesh(new THREE.PlaneGeometry(110, 52),
      new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.85 }), 4, 0, 34, false, true);
    lot.rotation.x = -Math.PI / 2;

    // parking bay lines
    for (var li = 0; li <= 16; li++) {
      var ln = plane(0.12, 5.4, M.line, -26 + li * 3.4, 0.03, 19.5);
      ln.rotation.x = -Math.PI / 2;
    }
    var stop = plane(54.4, 0.12, M.line, 1.2, 0.03, 16.8); stop.rotation.x = -Math.PI / 2;

    // podium
    boxE(-27.5, 26.5, 0, Y0, -8.5, 13.5, M.podium, false);

    /* ── main volumes ── */
    var wingR = boxE(2.5, 24.5, Y0, WT, -6, 6, M.cream);
    var entBay = boxE(-9.5, 2.5, Y0, WT, -6, 4, M.cream);
    var midBlk = boxE(-14.5, -9.5, Y0, WT, -6, 3.8, M.cream);
    var colBack = boxE(-26.5, -14.5, Y0, WT, -6, -5.6, M.cream);
    occluders.push(wingR, entBay, midBlk, colBack);

    /* ── stone feature pier + pediment ── */
    var sx0 = -14.5, sx1 = -9.5, sy0 = Y0, sy1 = WT + 0.05, sz0 = 3.8, sz1 = 7.4;
    var sw = sx1 - sx0, sh = sy1 - sy0, sd = sz1 - sz0;
    var pierMats = [stoneMat(sd / 2.4, sh / 2.4), stoneMat(sd / 2.4, sh / 2.4),
      stoneMat(sw / 2.4, sd / 2.4), stoneMat(sw / 2.4, sd / 2.4),
      stoneMat(sw / 2.4, sh / 2.4), stoneMat(sw / 2.4, sh / 2.4)];
    var pier = mesh(new THREE.BoxGeometry(sw, sh, sd), pierMats, (sx0 + sx1) / 2, (sy0 + sy1) / 2, (sz0 + sz1) / 2);
    occluders.push(pier);

    var shp = new THREE.Shape();
    shp.moveTo(-2.7, 0); shp.lineTo(2.7, 0); shp.lineTo(0, 4.1); shp.lineTo(-2.7, 0);
    var pedGeo = new THREE.ExtrudeGeometry(shp, { depth: 3.4, bevelEnabled: false });
    var ped = mesh(pedGeo, [stoneMat(1 / 2.4, 1 / 2.4), stoneMat(1 / 2.4, 1 / 2.4)], (sx0 + sx1) / 2, WT + 0.05, 3.9);
    occluders.push(ped);
    boxE(-14.85, -9.15, WT - 0.55, WT + 0.05, 3.55, 7.65, M.band);        // cornice
    boxE(-14.7, -9.3, Y0, Y0 + 0.5, 3.7, 7.55, M.grey);                   // plinth

    /* ── roof (hip) + skylight ── */
    var roofGeo = hipRoofGeometry(THREE, -27.2, 25.8, -7.6, 7.6, 9.6, 13.0, -23.1, 21.7, -3.5, 3.5);
    var roof = mesh(roofGeo, M.slate, 0, 0, 0);
    occluders.push(roof);

    var soffit = plane(53, 15.2, M.soffit, CX, 9.58, 0); soffit.rotation.x = Math.PI / 2;
    // fascia
    boxE(-27.25, 25.85, 9.2, 9.65, 7.5, 7.7, M.dark);
    boxE(-27.25, 25.85, 9.2, 9.65, -7.7, -7.5, M.dark);
    boxE(-27.3, -27.1, 9.2, 9.65, -7.6, 7.6, M.dark);
    boxE(25.7, 25.9, 9.2, 9.65, -7.6, 7.6, M.dark);

    var skyGeo = new THREE.ConeGeometry(4.55, 3.2, 4, 1, true);
    var skyMat = new THREE.MeshPhongMaterial({
      color: 0xa6cdea, transparent: true, opacity: 0.62, shininess: 120,
      specular: 0xffffff, side: THREE.DoubleSide, emissive: 0x1c2b3a
    });
    var sky = mesh(skyGeo, skyMat, CX, 13.0 + 1.6, 0, false, false);
    sky.rotation.y = Math.PI / 4;
    var skyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(skyGeo), new THREE.LineBasicMaterial({ color: 0xd9dde2 }));
    skyEdges.position.copy(sky.position); skyEdges.rotation.copy(sky.rotation); root.add(skyEdges);
    boxE(CX - 3.3, CX + 3.3, 13.0, 13.25, -3.3, 3.3, M.steel);
    glow(CX, 14.2, 0, 7, 0.35);

    /* ── colonnade (left wing) ── */
    var colX = [-25.2, -22.9, -20.6, -18.3, -16.0];
    colX.forEach(function (cx) {
      boxE(cx - 0.5, cx + 0.5, Y0, WT, 6.5, 7.5, M.creamL);
      boxE(cx - 0.5, cx + 0.5, Y0, WT, 2.5, 3.5, M.creamL);
      boxE(cx - 0.62, cx + 0.62, Y0, Y0 + 0.35, 6.38, 7.62, M.band);
    });
    boxE(-26.0, -14.5, WT - 0.6, WT, 6.4, 7.6, M.creamL);                 // front beam

    /* ── entrance bay ── */
    boxE(-9.35, -8.05, Y0, WT, 5.9, 7.2, M.creamL);                       // big pier left
    boxE(1.45, 2.55, Y0, WT, 5.9, 7.2, M.creamL);                         // big pier right
    var col = mesh(new THREE.CylinderGeometry(0.26, 0.26, WT - Y0, 20), M.steel, -3.4, (WT + Y0) / 2, 6.5);
    boxE(-9.35, 2.55, 8.75, WT, 5.7, 7.2, M.creamL);                      // lintel

    var ex = [-9.5, -6.5, -3.5, -0.5, 2.5];
    for (var ci = 0; ci < 4; ci++) {
      var pw = ex[ci + 1] - ex[ci];
      plane(pw, 4.55, M.glass, (ex[ci] + ex[ci + 1]) / 2, (Y0 + 4.9) / 2, 4.03);
      plane(pw, 4.4, M.glass, (ex[ci] + ex[ci + 1]) / 2, (5.1 + 9.5) / 2, 4.03);
    }
    ex.forEach(function (mx) { boxE(mx - 0.07, mx + 0.07, Y0, 9.5, 4.0, 4.2, M.bronze); });
    boxE(-9.5, 2.5, 4.9, 5.1, 4.0, 4.2, M.bronze);
    boxE(-9.5, 2.5, 9.4, 9.6, 4.0, 4.2, M.bronze);
    [-6.5, -5.0, -3.5].forEach(function (dx) { boxE(dx - 0.05, dx + 0.05, Y0, 3.95, 4.0, 4.25, M.bronze); });
    boxE(-6.5, -3.5, 3.9, 4.0, 4.0, 4.25, M.bronze);
    [-5.2, -4.8].forEach(function (hx) { boxE(hx - 0.03, hx + 0.03, 1.5, 2.4, 4.2, 4.3, M.steel); });
    glow(-7.8, 8.0, 3.9, 3.2, 0.5); glow(-4.8, 8.2, 3.9, 3.6, 0.55); glow(-1.8, 7.8, 3.9, 3.2, 0.5);

    /* ── right wing: pilasters, band, windows, door ── */
    [2.0, 8.0, 14.0, 20.0, 24.2].forEach(function (px) {
      boxE(px - 0.55, px + 0.55, Y0, WT, 5.9, 7.2, M.creamL);
    });
    boxE(2.5, 24.5, 4.75, 5.15, 5.95, 6.35, M.grey);

    function win(x, y, w, h, z) {
      boxE(x - w / 2 - 0.12, x + w / 2 + 0.12, y - h / 2 - 0.12, y + h / 2 + 0.12, z, z + 0.2, M.bronze, false);
      plane(w, h, M.glass, x, y, z + 0.215);
      boxE(x - 0.035, x + 0.035, y - h / 2, y + h / 2, z + 0.2, z + 0.26, M.bronze, false);
      boxE(x - w / 2 - 0.25, x + w / 2 + 0.25, y - h / 2 - 0.22, y - h / 2 - 0.1, z, z + 0.32, M.grey, false);
    }
    [3.9, 6.1, 9.9, 12.1, 15.9, 18.1, 22.1].forEach(function (wx) { win(wx, 7.3, 1.15, 2.2, 6.0); });
    win(5, 2.9, 1.5, 1.7, 6.0); win(17, 2.9, 1.5, 1.7, 6.0);

    // right-wing door
    boxE(20.95, 23.25, Y0, 3.75, 6.0, 6.2, M.bronze, false);
    plane(2.0, 3.25, M.glass, 22.1, (Y0 + 3.6) / 2, 6.215);
    boxE(22.05, 22.15, Y0, 3.6, 6.2, 6.26, M.bronze, false);

    /* ── lighting fixtures ── */
    function sconce(x, y, z) {
      box(0.2, 0.55, 0.22, M.dark, x, y, z, false);
      glow(x, y + 0.9, z + 0.4, 2.2);
      glow(x, y - 0.9, z + 0.4, 1.8);
    }
    sconce(-12, 4.5, 7.55);
    sconce(-8.7, 4.4, 7.3);
    [2.0, 8.0, 14.0, 20.0].forEach(function (x) { sconce(x, 4.4, 7.3); });
    colX.forEach(function (x) { sconce(x, 4.4, 7.6); });

    function bollard(x, z, y) {
      box(0.28, 1.0, 0.28, M.dark, x, y + 0.5, z, true);
      box(0.3, 0.22, 0.3, M.lampTop, x, y + 1.1, z, false);
      glow(x, y + 1.15, z, 2.2);
    }
    bollard(-28.5, 14.2, 0.3); bollard(31.5, 14.2, 0.3);
    bollard(-7, 11.6, Y0); bollard(6, 11.6, Y0); bollard(16, 11.6, Y0);

    /* ── vegetation ── */
    var frondGeo = frondGeometry(THREE);
    function palm(x, y, z, h, s, seed) {
      var r = rng(seed || 3), g = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, h, 8), M.trunk);
      trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
      var n = 10;
      for (var i = 0; i < n; i++) {
        var f = new THREE.Mesh(frondGeo, i % 2 ? M.frond1 : M.frond2);
        f.rotation.order = 'YZX';
        f.rotation.y = (i / n) * Math.PI * 2 + r() * 0.4;
        f.rotation.z = 0.25 + r() * 0.35;
        f.position.y = h;
        var sc = s * (0.85 + r() * 0.3);
        f.scale.set(sc, sc, sc);
        f.castShadow = true;
        g.add(f);
      }
      g.position.set(x, y, z);
      root.add(g);
      return g;
    }
    function shrub(x, y, z, r) {
      var m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), shrubMats[Math.floor(R() * shrubMats.length)]);
      m.position.set(x, y + r * 0.7, z);
      m.scale.y = 0.8; m.rotation.y = R() * 3;
      m.castShadow = false; m.receiveShadow = true;
      root.add(m);
    }
    function bed(x0, x1, z0, z1, y, density) {
      boxE(x0, x1, y, y + 0.3, z0, z1, M.kerb, false);
      boxE(x0 + 0.15, x1 - 0.15, y + 0.3, y + 0.34, z0 + 0.15, z1 - 0.15, M.soil, false);
      var step = 1 / density;
      for (var x = x0 + 0.5; x < x1 - 0.4; x += step) {
        for (var z = z0 + 0.4; z < z1 - 0.3; z += step * 0.9) {
          shrub(x + (R() - 0.5) * 0.4, y + 0.3, z + (R() - 0.5) * 0.3, 0.32 + R() * 0.25);
        }
      }
    }
    bed(-14.2, -8.8, 7.9, 9.3, Y0, 1.1);
    bed(3.2, 23.8, 7.9, 9.1, Y0, 1.1);
    bed(-31.5, -24.5, 11.5, 17.5, 0, 0.9);
    bed(27.5, 34.5, 11.5, 17.5, 0, 0.9);

    palm(-11.5, Y0 + 0.3, 8.6, 4.6, 1.15, 5);
    palm(10.8, Y0 + 0.3, 8.5, 4.2, 1.1, 6);
    palm(16.8, Y0 + 0.3, 8.5, 4.0, 1.1, 7);
    palm(22.3, Y0 + 0.3, 8.5, 3.8, 1.05, 8);
    palm(-28, 0.3, 14.5, 5.2, 1.3, 9);
    palm(31, 0.3, 14.8, 4.6, 1.2, 10);
    palm(-30.2, 0.3, 12.6, 2.8, 0.95, 12);

    [0.0, 4.6].forEach(function (px, i) {
      var pot = mesh(new THREE.CylinderGeometry(0.52, 0.38, 1.1, 18), M.white, px, Y0 + 0.55, 8.3);
      palm(px, Y0 + 1.0, 8.3, 0.7, 0.42, 20 + i);
    });

    /* background trees */
    var leaf = [0x2f5a2a, 0x3a6a30, 0x284f26, 0x44732f].map(function (c) {
      return new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
    });
    var bloom = new THREE.MeshStandardMaterial({ color: 0xd36a8a, flatShading: true, roughness: 1 });
    function tree(x, z, h, mat) {
      var g = new THREE.Group();
      var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, h * 0.5, 7), M.trunk);
      tr.position.y = h * 0.25; g.add(tr);
      for (var i = 0; i < 4; i++) {
        var rr = h * (0.15 + R() * 0.07);
        var c = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), mat || leaf[Math.floor(R() * leaf.length)]);
        c.position.set((R() - 0.5) * h * 0.4, h * (0.5 + R() * 0.3), (R() - 0.5) * h * 0.4);
        c.scale.y = 0.85; g.add(c);
      }
      g.position.set(x, 0, z); root.add(g);
    }
    var placed = 0, tries = 0;
    while (placed < 64 && tries < 600) {
      tries++;
      var ang = R() * Math.PI * 2, rad = 40 + R() * 48;
      var tx = Math.cos(ang) * rad, tz = Math.sin(ang) * rad;
      if (tz > -2 && tz < 64 && tx > -52 && tx < 62) continue;
      tree(tx, tz, 11 + R() * 7, (R() < 0.03) ? bloom : null);
      placed++;
    }
    tree(36, -18, 13, bloom);

    /* ── cars ── */
    function car(color, kind, x, z, rotY) {
      var g = new THREE.Group(), suv = kind === 'suv';
      var paint = new THREE.MeshPhongMaterial({ color: color, shininess: 90, specular: 0x666666 });
      var glass = new THREE.MeshPhongMaterial({ color: 0x10141a, shininess: 120, specular: 0x99aabb });
      var L = suv ? 4.6 : 4.8, W = 1.88, bh = suv ? 0.95 : 0.7, y0 = 0.3;
      function add(geo, mat, px, py, pz) {
        var m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz);
        m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
      }
      add(new THREE.BoxGeometry(W, bh, L), paint, 0, y0 + bh / 2, 0);
      var ch = suv ? 0.7 : 0.55, cl = suv ? L * 0.62 : L * 0.5;
      add(new THREE.BoxGeometry(W * 0.9, ch, cl), glass, 0, y0 + bh + ch / 2, -0.15);
      add(new THREE.BoxGeometry(W * 0.88, 0.07, cl * 0.96), paint, 0, y0 + bh + ch + 0.03, -0.15);
      var wg = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18), hg = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12);
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (p) {
        var w = add(wg, M.tire, p[0] * (W / 2 - 0.05), 0.34, p[1] * L * 0.32); w.rotation.z = Math.PI / 2;
        var h = add(hg, M.hub, p[0] * (W / 2 - 0.04), 0.34, p[1] * L * 0.32); h.rotation.z = Math.PI / 2;
      });
      var head = new THREE.MeshBasicMaterial({ color: 0xfff3d8 }), tail = new THREE.MeshBasicMaterial({ color: 0xd1121c });
      [-0.6, 0.6].forEach(function (hx) {
        add(new THREE.BoxGeometry(0.42, 0.1, 0.06), head, hx, y0 + bh * 0.7, L / 2 + 0.01);
        add(new THREE.BoxGeometry(0.42, 0.1, 0.06), tail, hx, y0 + bh * 0.7, -L / 2 - 0.01);
      });
      g.position.set(x, 0, z); g.rotation.y = rotY; root.add(g);
    }
    car(0x0b0c10, 'sedan', -14.1, 19.5, Math.PI + 0.06);
    car(0xf2f2f0, 'suv', 6.3, 19.5, Math.PI - 0.05);
    car(0xa9adb3, 'sedan', 16.5, 19.5, Math.PI + 0.04);
    car(0x6d727a, 'sedan', 26.7, 19.5, Math.PI - 0.03);

    /* ── people ── */
    function person(x, y, z, ry) {
      var g = new THREE.Group();
      var suit = new THREE.MeshLambertMaterial({ color: 0x15171c }), skin = new THREE.MeshLambertMaterial({ color: 0x6b4a36 });
      [-0.1, 0.1].forEach(function (lx) {
        var l = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.85, 8), suit); l.position.set(lx, 0.43, 0); g.add(l);
      });
      var b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.72, 10), suit); b.position.y = 1.2; g.add(b);
      var h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); h.position.y = 1.7; g.add(h);
      g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
    }
    person(-17.6, Y0, 10.6, 1.4);
    person(22.4, Y0, 10.2, -1.6);

    /* ── sky + clouds ── */
    var skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 20),
      new THREE.MeshBasicMaterial({ map: T.sky, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyDome.renderOrder = -10;
    scene.add(skyDome);
    var cloudMat = new THREE.SpriteMaterial({ map: T.cloud, transparent: true, depthWrite: false, opacity: 0.92, fog: false });
    for (var ki = 0; ki < 11; ki++) {
      var ca = R() * Math.PI * 2, cr = 380, sp = new THREE.Sprite(cloudMat);
      sp.position.set(Math.cos(ca) * cr, 70 + R() * 110, Math.sin(ca) * cr);
      var cs = 110 + R() * 90; sp.scale.set(cs, cs * 0.45, 1); scene.add(sp);
    }

    /* ── lights ── */
    scene.fog = new THREE.Fog(0xcfdcea, 130, 380);
    scene.add(new THREE.HemisphereLight(0xdceaff, 0x716b5d, 0.72));
    var ambient = new THREE.AmbientLight(0xffffff, 0.16);
    scene.add(ambient);
    var sun = new THREE.DirectionalLight(0xffe5c4, 1.25);
    sun.position.set(42, 30, 50);
    sun.target.position.set(0, 0, 8);
    sun.castShadow = true;
    var sc = sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 50; sc.bottom = -50; sc.near = 5; sc.far = 190;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 4;
    scene.add(sun, sun.target);
    [[-5, 3.2, 9.5, 0.9, 16], [12, 3.2, 10, 0.8, 16], [-20.5, 3.5, 4.5, 1.0, 14]].forEach(function (p) {
      var pl = new THREE.PointLight(0xffc27a, p[3], p[4], 2);
      pl.position.set(p[0], p[1], p[2]); scene.add(pl);
    });

    /* ── hotspots ── */
    var hotspots = [
      { id: 'entrance', title: 'Main Entrance', text: 'A glazed, double-height entrance bay with a warm, welcoming foyer.',
        pos: [-6.0, 4.6, 4.5], view: { theta: 0.15, phi: 1.36, radius: 30, target: [-6, 4.5, 4] } },
      { id: 'skylight', title: 'Glass Skylight', text: 'A pyramid skylight crowns the roof and brings daylight in.',
        pos: [CX, 16.6, 0], view: { theta: -0.6, phi: 1.05, radius: 34, target: [CX, 12, 0] } },
      { id: 'colonnade', title: 'Covered Colonnade', text: 'A shaded colonnade walkway for arrivals, fellowship and shelter.',
        pos: [-20.6, 3.2, 8.0], view: { theta: -0.35, phi: 1.38, radius: 32, target: [-20, 4, 6] } },
      { id: 'stone', title: 'Stone Feature Pier', text: 'Natural stone cladding anchors the façade and carries the gable feature.',
        pos: [-12, 8.2, 7.9], view: { theta: -0.2, phi: 1.3, radius: 28, target: [-12, 7, 6] } }
    ];

    return { root: root, occluders: occluders, hotspots: hotspots };
  }

  /* ───────────────────────── viewer ───────────────────────── */
  var CSS = [
    '.c3d{position:relative;overflow:hidden;background:#9db9d6;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}',
    '.c3d canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;outline:none}',
    '.c3d canvas.c3d-grabbing{cursor:grabbing}',
    '.c3d-loader{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#fff;font:600 13px Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;background:linear-gradient(#2d6bd0,#a9cdef);z-index:5;transition:opacity .6s}',
    '.c3d-loader i{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.35);border-top-color:#fed977;animation:c3dspin 1s linear infinite}',
    '@keyframes c3dspin{to{transform:rotate(360deg)}}',
    '.c3d-ready .c3d-loader{opacity:0;pointer-events:none}',
    '.c3d-context-lost:after{content:"3D view paused — restore the browser tab or reload to continue";position:absolute;inset:auto 12px 58px;z-index:8;text-align:center;padding:10px 14px;border-radius:10px;background:rgba(10,25,50,.82);color:#fff;font:600 12px Inter,system-ui,sans-serif}',
    '.c3d-ui{position:absolute;right:16px;bottom:16px;display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;z-index:6;max-width:calc(100% - 32px)}',
    '.c3d-btn{font:600 12px Inter,system-ui,sans-serif;letter-spacing:.04em;color:#fff;background:rgba(10,25,50,.72);border:1px solid rgba(254,217,119,.45);padding:8px 12px;border-radius:999px;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:background .2s,color .2s}',
    '.c3d-btn:hover,.c3d-btn:focus-visible,.c3d-btn.on{background:#fed977;color:#0a1932;outline:none}',
    '.c3d-hint{position:absolute;left:50%;top:16px;transform:translateX(-50%);z-index:6;color:#fff;font:600 12px Inter,system-ui,sans-serif;background:rgba(10,25,50,.7);padding:8px 14px;border-radius:999px;letter-spacing:.04em;white-space:nowrap;pointer-events:none;transition:opacity .8s}',
    '.c3d-hint.gone{opacity:0}',
    '.c3d-note{position:absolute;left:16px;bottom:16px;z-index:6;color:rgba(255,255,255,.85);font:500 11px Inter,system-ui,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none}',
    '.c3d-hot{position:absolute;left:0;top:0;z-index:4;width:30px;height:30px;margin:-15px 0 0 -15px;border:0;padding:0;background:none;cursor:pointer;transition:opacity .25s;will-change:transform}',
    '.c3d-dot{position:absolute;inset:7px;border-radius:50%;background:#fed977;box-shadow:0 0 0 3px rgba(10,25,50,.55),0 0 14px rgba(254,217,119,.9);animation:c3dpulse 2s ease-in-out infinite}',
    '@keyframes c3dpulse{50%{transform:scale(1.25)}}',
    '.c3d-tip{position:absolute;left:34px;top:50%;transform:translateY(-50%);white-space:nowrap;color:#fff;background:rgba(10,25,50,.85);font:600 12px Inter,system-ui,sans-serif;padding:6px 10px;border-radius:8px;opacity:0;pointer-events:none;transition:opacity .2s}',
    '.c3d-hot:hover .c3d-tip,.c3d-hot:focus-visible .c3d-tip{opacity:1}',
    '.c3d-card{position:absolute;left:16px;top:56px;max-width:280px;z-index:7;color:#fff;background:rgba(10,25,50,.88);border-left:4px solid #fed977;border-radius:10px;padding:14px 16px;font:400 13px/1.5 Inter,system-ui,sans-serif;opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .25s,transform .25s}',
    '.c3d-card.show{opacity:1;transform:none;pointer-events:auto}',
    '.c3d-card b{display:block;font:700 15px "Playfair Display",Georgia,serif;margin-bottom:4px;color:#fed977}',
    '.c3d-card button{position:absolute;right:8px;top:6px;background:none;border:0;color:#fff;font-size:18px;cursor:pointer;line-height:1}',
    '@media (max-width:640px){.c3d-btn{padding:7px 10px;font-size:11px}.c3d-ui{right:10px;bottom:10px}.c3d-note{display:none}.c3d-card{left:10px;right:10px;max-width:none}}',
    '@media (prefers-reduced-motion:reduce){.c3d-dot{animation:none}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('c3d-css')) return;
    var s = document.createElement('style'); s.id = 'c3d-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mount(el, options) {
    var THREE = global.THREE;
    var o = {
      autoRotate: true,        // slow spin until the visitor interacts
      wheelZoom: true,         // true | false | 'ctrl' (needs Ctrl/Cmd — keeps page scroll free)
      touchAction: 'none',     // 'none' = full touch control · 'pan-y' = swipe sideways to rotate, page still scrolls
      ui: true,                // preset-view buttons
      hint: true,              // "drag to rotate" hint
      hotspots: true,
      note: true,              // artist's-impression note
      fallbackImage: null,     // shown if WebGL is unavailable
      onReady: null
    };
    for (var k in options) if (options[k] !== undefined) o[k] = options[k];

    injectCSS();
    el.classList.add('c3d');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

    function fallback() {
      if (o.fallbackImage) {
        el.style.background = 'center / cover no-repeat url("' + o.fallbackImage + '")';
      }
      el.classList.add('c3d-ready');
    }
    if (!THREE) { console.error('[Church3D] Three.js not found — load three.min.js first.'); fallback(); return null; }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { fallback(); return null; }

    var isSmall = global.matchMedia && global.matchMedia('(max-width: 768px)').matches;
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, isSmall ? 1.5 : 2));
    // Three.js r128 uses outputEncoding; newer releases use outputColorSpace.
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping || THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var cv = renderer.domElement;
    var contextLost = false;
    cv.addEventListener('webglcontextlost', function (event) {
      event.preventDefault();
      contextLost = true;
      el.classList.add('c3d-context-lost');
    }, false);
    cv.addEventListener('webglcontextrestored', function () {
      contextLost = false;
      el.classList.remove('c3d-context-lost');
      last = performance.now();
    }, false);
    cv.tabIndex = 0;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Interactive 3D model of the new Makeni Central SDA Church building. Drag to rotate, use arrow keys to turn, plus and minus to zoom.');
    cv.style.touchAction = o.touchAction;
    el.insertBefore(cv, el.firstChild);

    var loader = document.createElement('div');
    loader.className = 'c3d-loader';
    loader.innerHTML = '<i></i><span>Loading 3D model</span>';
    el.appendChild(loader);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcfdcea);
    var camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1400);

    var model = buildModel(THREE, scene);
    var sunLight = null;
    scene.traverse(function (n) { if (n.isDirectionalLight) sunLight = n; });
    sunLight.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);

    /* ── view state ── */
    var TARGET = [-0.7, 4.8, 2];
    var DEF = { theta: -0.55, phi: 1.3 };
    var MIN_R = 20, MAX_R = 120;
    var fitR = 60;
    var cur = { theta: DEF.theta, phi: DEF.phi, radius: 60, tx: TARGET[0], ty: TARGET[1], tz: TARGET[2] };
    var goal = { theta: cur.theta, phi: cur.phi, radius: cur.radius, tx: cur.tx, ty: cur.ty, tz: cur.tz };

    function nearestTheta(t) { return t + Math.PI * 2 * Math.round((goal.theta - t) / (Math.PI * 2)); }
    function setView(v, instant) {
      var tg = v.target || TARGET;
      goal.theta = nearestTheta(v.theta); goal.phi = clamp(v.phi, 0.25, 1.52);
      goal.radius = clamp(v.radius || fitR, MIN_R, MAX_R);
      goal.tx = tg[0]; goal.ty = tg[1]; goal.tz = tg[2];
      if (instant) for (var k in goal) cur[k] = goal[k];
      lastInput = performance.now();
    }
    var VIEWS = {
      reset:  function () { return { theta: DEF.theta, phi: DEF.phi, radius: fitR }; },
      front:  function () { return { theta: 0, phi: 1.38, radius: fitR * 0.92 }; },
      side:   function () { return { theta: -1.5, phi: 1.34, radius: fitR * 0.95 }; },
      aerial: function () { return { theta: -0.7, phi: 0.62, radius: fitR * 1.05 }; }
    };

    /* ── sizing ── */
    var W = 1, H = 1;
    function resize() {
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      W = w; H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      var tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      var tanH = tanV * camera.aspect;
      var prevFit = fitR;
      fitR = clamp(1.25 * 29 / tanH, 50, 118);
      MAX_R = Math.max(95, fitR * 1.3);
      if (!started) { cur.radius = goal.radius = fitR; } else if (Math.abs(goal.radius - prevFit) < 0.01) { goal.radius = fitR; }
    }
    var started = false;
    resize(); started = true;
    var ro = null;
    if ('ResizeObserver' in global) { ro = new ResizeObserver(resize); ro.observe(el); }
    else global.addEventListener('resize', resize);

    /* ── input ── */
    var ptrs = {}, pinchDist = 0, lastInput = performance.now(), userMoved = false;
    var cleanups = [];
    function on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); cleanups.push(function () { t.removeEventListener(ev, fn, opt); }); }
    function touched() { lastInput = performance.now(); if (!userMoved) { userMoved = true; if (hintEl) hintEl.classList.add('gone'); } }
    function count() { return Object.keys(ptrs).length; }

    on(cv, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      cv.classList.add('c3d-grabbing');
      if (count() === 2) { var p = Object.keys(ptrs).map(function (i) { return ptrs[i]; }); pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
      touched();
    });
    on(cv, 'pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (count() === 1) {
        var tilt = !(e.pointerType === 'touch' && o.touchAction !== 'none');
        goal.theta -= dx * 0.0065;
        if (tilt) goal.phi = clamp(goal.phi - dy * 0.0055, 0.25, 1.52);
      } else if (count() === 2) {
        var q = Object.keys(ptrs).map(function (i) { return ptrs[i]; });
        var d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y);
        if (pinchDist) goal.radius = clamp(goal.radius * (pinchDist / d), MIN_R, MAX_R);
        pinchDist = d;
      }
      touched();
    });
    function up(e) {
      delete ptrs[e.pointerId];
      if (!count()) cv.classList.remove('c3d-grabbing');
      pinchDist = 0;
    }
    on(cv, 'pointerup', up); on(cv, 'pointercancel', up); on(cv, 'lostpointercapture', up);
    on(cv, 'wheel', function (e) {
      if (!o.wheelZoom) return;
      if (o.wheelZoom === 'ctrl' && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      goal.radius = clamp(goal.radius * Math.exp(e.deltaY * 0.0012), MIN_R, MAX_R);
      touched();
    }, { passive: false });
    on(cv, 'dblclick', function () { setView(VIEWS.reset()); closeCard(); });
    on(cv, 'keydown', function (e) {
      var used = true;
      if (e.key === 'ArrowLeft') goal.theta += 0.12;
      else if (e.key === 'ArrowRight') goal.theta -= 0.12;
      else if (e.key === 'ArrowUp') goal.phi = clamp(goal.phi - 0.08, 0.25, 1.52);
      else if (e.key === 'ArrowDown') goal.phi = clamp(goal.phi + 0.08, 0.25, 1.52);
      else if (e.key === '+' || e.key === '=') goal.radius = clamp(goal.radius * 0.9, MIN_R, MAX_R);
      else if (e.key === '-' || e.key === '_') goal.radius = clamp(goal.radius * 1.1, MIN_R, MAX_R);
      else used = false;
      if (used) { e.preventDefault(); touched(); }
    });

    /* ── UI ── */
    var hintEl = null, cardEl = null, autoBtn = null, autoOn = !!o.autoRotate;
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) autoOn = false;

    if (o.hint) {
      hintEl = document.createElement('div'); hintEl.className = 'c3d-hint';
      hintEl.textContent = (o.touchAction === 'none' ? 'Drag to rotate' : 'Swipe sideways to rotate') + (o.wheelZoom === true ? ' · Scroll to zoom' : o.wheelZoom === 'ctrl' ? ' · Ctrl + scroll to zoom' : '');
      el.appendChild(hintEl);
      setTimeout(function () { if (hintEl) hintEl.classList.add('gone'); }, 7000);
    }
    if (o.note) {
      var note = document.createElement('div'); note.className = 'c3d-note';
      note.textContent = "Artist's impression — final building may vary";
      el.appendChild(note);
    }
    if (o.ui) {
      var ui = document.createElement('div'); ui.className = 'c3d-ui';
      [['Front', 'front'], ['Side', 'side'], ['Aerial', 'aerial'], ['Reset', 'reset']].forEach(function (b) {
        var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'c3d-btn'; btn.textContent = b[0];
        btn.addEventListener('click', function () { setView(VIEWS[b[1]]()); closeCard(); });
        ui.appendChild(btn);
      });
      autoBtn = document.createElement('button'); autoBtn.type = 'button'; autoBtn.className = 'c3d-btn' + (autoOn ? ' on' : '');
      autoBtn.textContent = 'Auto-rotate'; autoBtn.setAttribute('aria-pressed', autoOn);
      autoBtn.addEventListener('click', function () {
        autoOn = !autoOn; autoBtn.classList.toggle('on', autoOn); autoBtn.setAttribute('aria-pressed', autoOn); lastInput = 0;
      });
      ui.appendChild(autoBtn);
      el.appendChild(ui);
    }

    cardEl = document.createElement('div'); cardEl.className = 'c3d-card'; el.appendChild(cardEl);
    function closeCard() { cardEl.classList.remove('show'); }
    function openCard(h) {
      cardEl.innerHTML = '<button type="button" aria-label="Close">&times;</button><b></b><span></span>';
      cardEl.querySelector('b').textContent = h.title;
      cardEl.querySelector('span').textContent = h.text;
      cardEl.querySelector('button').addEventListener('click', closeCard);
      cardEl.classList.add('show');
    }

    var hotEls = [];
    if (o.hotspots) {
      model.hotspots.forEach(function (h) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'c3d-hot'; b.setAttribute('aria-label', h.title);
        b.innerHTML = '<span class="c3d-dot"></span><span class="c3d-tip"></span>';
        b.querySelector('.c3d-tip').textContent = h.title;
        b.addEventListener('click', function () { setView(h.view); openCard(h); touched(); });
        el.appendChild(b);
        hotEls.push({ el: b, v: new THREE.Vector3(h.pos[0], h.pos[1], h.pos[2]), data: h });
      });
    }
    var ray = new THREE.Raycaster(), tmp = new THREE.Vector3(), dir = new THREE.Vector3();
    function updateHotspots() {
      for (var i = 0; i < hotEls.length; i++) {
        var hs = hotEls[i];
        tmp.copy(hs.v).project(camera);
        var vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
        if (vis) {
          dir.copy(hs.v).sub(camera.position);
          var dist = dir.length(); dir.normalize();
          ray.set(camera.position, dir); ray.far = dist - 0.05;
          if (ray.intersectObjects(model.occluders, false).length) vis = false;
        }
        hs.el.style.opacity = vis ? 1 : 0;
        hs.el.style.pointerEvents = vis ? 'auto' : 'none';
        hs.el.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * W).toFixed(1) + 'px,' + ((-tmp.y * 0.5 + 0.5) * H).toFixed(1) + 'px)';
      }
    }

    /* ── loop ── */
    var visible = true, raf = 0, last = performance.now(), shown = false;
    var io = null;
    if ('IntersectionObserver' in global) {
      io = new IntersectionObserver(function (en) {
        visible = !!(en[0] && en[0].isIntersecting);
        last = performance.now();
      }, { threshold: 0.01 });
      io.observe(el);
    }
    function onVisibilityChange() { last = performance.now(); }
    on(document, 'visibilitychange', onVisibilityChange);
    function step(dt) {
      if (autoOn && !count() && performance.now() - lastInput > 3500) goal.theta -= dt * 0.14;
      var k = 1 - Math.exp(-dt * 8);
      cur.theta += (goal.theta - cur.theta) * k;
      cur.phi += (goal.phi - cur.phi) * k;
      cur.radius += (goal.radius - cur.radius) * k;
      cur.tx += (goal.tx - cur.tx) * k; cur.ty += (goal.ty - cur.ty) * k; cur.tz += (goal.tz - cur.tz) * k;
      var sp = Math.sin(cur.phi);
      camera.position.set(
        cur.tx + cur.radius * sp * Math.sin(cur.theta),
        cur.ty + cur.radius * Math.cos(cur.phi),
        cur.tz + cur.radius * sp * Math.cos(cur.theta));
      camera.lookAt(cur.tx, cur.ty, cur.tz);
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      if (!visible || document.hidden || contextLost) return;
      step(dt);
      renderer.render(scene, camera);
      if (hotEls.length) updateHotspots();
      if (!shown) {
        shown = true; el.classList.add('c3d-ready');
        setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 800);
        if (typeof o.onReady === 'function') o.onReady(api);
      }
    }
    cur.radius = goal.radius = fitR;
    raf = requestAnimationFrame(frame);

    var api = {
      setView: function (name) { if (VIEWS[name]) setView(VIEWS[name]()); },
      setAutoRotate: function (v) { autoOn = !!v; if (autoBtn) autoBtn.classList.toggle('on', autoOn); },
      camera: camera, scene: scene, renderer: renderer,
      dispose: function () {
        cancelAnimationFrame(raf);
        cleanups.forEach(function (f) { f(); });
        if (ro) ro.disconnect(); else global.removeEventListener('resize', resize);
        if (io) io.disconnect();
        scene.traverse(function (n) {
          if (n.geometry) n.geometry.dispose();
          if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
        });
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
        while (el.firstChild) el.removeChild(el.firstChild);
        el.classList.remove('c3d', 'c3d-ready', 'c3d-context-lost');
      }
    };
    return api;
  }

  /* ───────────────────────── auto-init ───────────────────────── */
  function auto() {
    var nodes = document.querySelectorAll('[data-church3d]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], d = n.dataset, wz = d.wheel;
      mount(n, {
        wheelZoom: wz === 'ctrl' ? 'ctrl' : wz === 'off' ? false : true,
        touchAction: d.touch === 'pan-y' ? 'pan-y' : 'none',
        ui: d.ui !== 'off',
        hint: d.hint !== 'off',
        hotspots: d.hotspots !== 'off',
        autoRotate: d.autorotate !== 'off',
        fallbackImage: d.fallback || null
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

  global.Church3D = { mount: mount, buildModel: buildModel };
})(window);