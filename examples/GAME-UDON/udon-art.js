/**
 * うどんふみふみのイラスト（UdonArt）
 *
 * 元の udon.png / asi.png の持ち味（太い墨色のふちどり・ベタ塗り・丸い線端のピクトグラム調）を
 * そのまま SVG で描き起こし、うどん 12 種類ぶんのバリエーションに広げたものです。
 * どれも文字列の SVG を返すだけなので、DOM に差し込んでも、Image にして canvas に描いても使えます。
 */
(function (root) {
  'use strict';

  var INK = '#231815';
  var C = {
    ink: INK,
    shu: '#E15C3A',        // 朱（背景）
    dough: '#F2EFE9',      // 生地
    skin: '#FAD4BC',       // 肌
    teal: '#84B8AE',       // 元の丼の青緑
    ai: '#2E6FB7',         // 藍（もちもち度のバー）
    cream: '#FBF6EC',
    broth: '#E9C27A',      // だし
    negi: '#8CC152',
    negiLight: '#DDF0B5',
    pink: '#F39BB0',
    yolk: '#F7B500',
    age: '#E8A33D',
    ageDark: '#C47F22',
    wood: '#E3B877',
    woodDark: '#B98545'
  };

  var uid = 0;

  function attrs(o) {
    var s = '';
    for (var k in o) if (o[k] !== undefined && o[k] !== null) s += ' ' + k + '="' + o[k] + '"';
    return s;
  }

  /** ふちどり付きの図形。sw = 線の太さ */
  function path(d, fill, sw, extra) {
    return '<path' + attrs(Object.assign({
      d: d, fill: fill || 'none', stroke: INK, 'stroke-width': sw === undefined ? 8 : sw,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }, extra || {})) + '/>';
  }

  function ellipse(cx, cy, rx, ry, fill, sw, extra) {
    return '<ellipse' + attrs(Object.assign({
      cx: cx, cy: cy, rx: rx, ry: ry, fill: fill || 'none', stroke: INK, 'stroke-width': sw === undefined ? 8 : sw
    }, extra || {})) + '/>';
  }

  function circle(cx, cy, r, fill, sw, extra) { return ellipse(cx, cy, r, r, fill, sw, extra); }

  /** ふちどりのない線（模様・ハイライト用） */
  function line(d, color, w, extra) {
    return '<path' + attrs(Object.assign({
      d: d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, extra || {})) + '/>';
  }

  function group(inner, extra) { return '<g' + attrs(extra || {}) + '>' + inner + '</g>'; }

  // ---------------------------------------------------------------------------
  // 具（トッピング）
  // ---------------------------------------------------------------------------

  /** 麺の束: 墨の太線の上に白線を重ねて「ふちどりされた麺」にする */
  function noodles(paths, w) {
    w = w || 13;
    var ink = '', white = '';
    paths.forEach(function (d) {
      ink += line(d, INK, w + 7);
      white += line(d, '#FFFDF8', w);
    });
    return ink + white;
  }

  /** 丼の中でうねる麺（基本形）。dy でずらして重ねる */
  function noodleBundle(dy) {
    var out = [];
    var base = [
      'M70,146 C116,118 158,190 212,156 S310,126 340,160',
      'M56,168 C104,140 154,212 212,178 S316,148 350,184',
      'M62,190 C108,164 154,232 214,200 S312,172 342,204',
      'M84,210 C124,190 160,244 216,220 S300,198 322,218'
    ];
    for (var i = 0; i < base.length; i++) out.push(base[i]);
    return group(noodles(out), dy ? { transform: 'translate(0,' + dy + ')' } : {});
  }

  function negi(x, y, r, rot) {
    r = r || 10;
    return group(
      ellipse(0, 0, r, r * 0.8, C.negi, 5) + ellipse(0, 0, r * 0.38, r * 0.28, C.negiLight, 0),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ')' }
    );
  }

  function negiScatter(list) {
    return list.map(function (p) { return negi(p[0], p[1], p[2], p[3]); }).join('');
  }

  /** かまぼこ（半月） */
  function kamaboko(x, y, s, rot) {
    s = s || 1;
    return group(
      path('M-34,12 A34,34 0 0 1 34,12 Z', C.pink, 7) +
      path('M-23,12 A23,23 0 0 1 23,12 Z', '#FFFDF8', 0),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ') scale(' + s + ')' }
    );
  }

  /** なると */
  function naruto(x, y, s) {
    s = s || 1;
    var pts = [];
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      var r = i % 2 ? 22 : 26;
      pts.push((Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r * 0.86).toFixed(1));
    }
    return group(
      '<polygon points="' + pts.join(' ') + '" fill="#FFFDF8" stroke="' + INK + '" stroke-width="7" stroke-linejoin="round"/>' +
      line('M-10,2 C-10,-10 10,-10 10,1 C10,8 0,10 -2,3 C-3,-1 3,-2 3,1', C.pink, 5),
      { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }
    );
  }

  /** 油揚げ */
  function age(x, y, rot, s) {
    return group(
      path('M-62,-20 Q0,-34 60,-22 Q68,2 58,26 Q0,38 -60,26 Q-70,2 -62,-20 Z', C.age, 8) +
      line('M-34,-6 Q-18,-12 -4,-8', C.ageDark, 5) +
      line('M8,8 Q24,2 40,6', C.ageDark, 5) +
      line('M-30,14 Q-20,10 -10,13', C.ageDark, 5),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ') scale(' + (s || 1) + ')' }
    );
  }

  /** 月見（卵） */
  function egg(x, y, s) {
    s = s || 1;
    return group(
      path('M-50,2 C-54,-22 -22,-34 4,-30 C34,-34 56,-14 50,8 C46,30 14,34 -6,30 C-30,34 -48,22 -50,2 Z', '#FFFDF8', 8) +
      ellipse(0, -1, 22, 18, C.yolk, 7) +
      line('M-10,-8 Q-5,-13 2,-12', '#FFE9A6', 5),
      { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }
    );
  }

  /** えび天 */
  function ebiten(x, y, rot, s) {
    return group(
      // しっぽ
      path('M52,-58 L84,-96 L92,-62 L112,-70 L96,-40 L70,-36 Z', '#EF5B3C', 7) +
      // ころも（もこもこ）
      path('M-66,44 C-82,30 -74,8 -58,6 C-62,-10 -40,-22 -28,-12 C-22,-30 2,-34 10,-20 C20,-38 44,-38 48,-22 ' +
        'C66,-34 82,-16 72,-2 C82,12 70,30 54,24 C52,40 30,44 22,32 C14,48 -8,50 -14,36 C-24,52 -46,50 -48,38 C-52,48 -60,50 -66,44 Z',
        '#F5BE4F', 8) +
      line('M-40,14 Q-34,8 -28,14', '#D9942A', 5) +
      line('M-6,2 Q0,-4 6,2', '#D9942A', 5) +
      line('M30,-6 Q36,-12 42,-6', '#D9942A', 5) +
      line('M8,22 Q14,16 20,22', '#D9942A', 5),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ') scale(' + (s || 1) + ')' }
    );
  }

  /** 牛肉のひとひら */
  function meat(x, y, rot, color) {
    return group(
      path('M-44,-6 C-36,-24 -14,-10 0,-18 C16,-26 36,-22 44,-8 C52,6 36,12 30,18 C16,28 2,14 -12,20 C-28,28 -52,12 -44,-6 Z',
        color || '#A9684A', 7) +
      line('M-24,0 Q-10,-8 2,0 T26,-2', '#E7B9A0', 5),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ')' }
    );
  }

  /** わかめ */
  function wakame(x, y, rot, s) {
    return group(
      path('M-56,-4 C-46,-26 -26,-6 -12,-20 C2,-34 20,-14 34,-24 C48,-32 62,-14 54,0 C62,14 44,26 32,18 ' +
        'C18,30 2,14 -10,24 C-26,34 -40,16 -52,18 C-64,18 -64,4 -56,-4 Z', '#2F7D5B', 7) +
      line('M-38,2 C-22,-6 -10,8 6,0 S34,-4 40,2', '#7CC39F', 5),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ') scale(' + (s || 1) + ')' }
    );
  }

  /** 天かす */
  function tenkasu(list) {
    return list.map(function (p) {
      var r = p[2] || 9;
      return path(
        'M' + (p[0] - r) + ',' + p[1] +
        ' c0,' + (-r * 0.9) + ' ' + (r * 0.8) + ',' + (-r * 1.1) + ' ' + r + ',' + (-r * 0.5) +
        ' c' + (r * 0.9) + ',' + (-r * 0.3) + ' ' + (r * 1.2) + ',' + (r * 0.6) + ' ' + (r * 0.7) + ',' + (r * 1.0) +
        ' c' + (-r * 0.2) + ',' + (r * 0.8) + ' ' + (-r * 1.5) + ',' + (r * 0.6) + ' ' + (-r * 1.7) + ',' + (-r * 0.5) + ' Z',
        '#F2C867', 5);
    }).join('');
  }

  /** 梅干し */
  function ume(x, y, s) {
    s = s || 1;
    return group(
      path('M-24,2 C-28,-14 -12,-26 2,-24 C18,-26 30,-12 26,4 C26,18 12,26 -2,24 C-14,26 -24,16 -24,2 Z', '#D8303F', 7) +
      line('M-10,-6 Q-2,-14 8,-10', '#F58A93', 5) +
      line('M-8,10 Q0,6 6,10', '#A81E2C', 4),
      { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }
    );
  }

  /** 大葉 */
  function shiso(x, y, rot, s) {
    return group(
      path('M-46,6 L-36,-6 L-30,-2 L-20,-18 L-12,-10 L0,-26 L8,-14 L22,-24 L26,-8 L42,-10 L36,6 L46,16 L28,18 L24,30 ' +
        'L8,22 L-2,34 L-12,22 L-26,28 L-30,14 Z', '#5FAE57', 7) +
      line('M-34,8 Q0,2 34,6', '#2F7D3A', 4) +
      line('M-10,6 L-4,-10 M8,5 L14,-8 M-6,7 L-2,20 M12,6 L16,16', '#2F7D3A', 3.5),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ') scale(' + (s || 1) + ')' }
    );
  }

  /** 焼きもち */
  function mochi(x, y, rot, s) {
    return group(
      path('M-40,-20 C-28,-30 -10,-22 2,-34 C16,-24 30,-28 42,-18 C48,-4 46,14 40,24 C20,30 -20,30 -40,24 C-48,12 -48,-6 -40,-20 Z',
        '#FFFDF8', 8) +
      line('M-22,-8 L-6,-16 M-8,0 L12,-12 M8,6 L24,-4', '#C9822B', 6) +
      line('M-24,14 Q-6,20 14,16', '#E8DFD0', 5),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ') scale(' + (s || 1) + ')' }
    );
  }

  /** しいたけ */
  function shiitake(x, y, s) {
    s = s || 1;
    return group(
      ellipse(0, 0, 30, 22, '#8A5A3C', 7) +
      line('M-12,-8 L12,8 M12,-8 L-12,8', '#F3E2C8', 6),
      { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }
    );
  }

  /** のり（きざみ） */
  function nori(list) {
    return list.map(function (p) {
      return line('M' + p[0] + ',' + p[1] + ' q' + p[2] + ',' + p[3] + ' ' + (p[2] * 2) + ',' + (p[3] * 0.4), INK, 6);
    }).join('');
  }

  /** にんじん・じゃがいも（カレー用のごろっとした具） */
  function chunk(x, y, color, rot) {
    return group(path('M-16,-10 Q0,-18 16,-10 Q20,2 14,12 Q0,18 -14,12 Q-20,2 -16,-10 Z', color, 6),
      { transform: 'translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ')' });
  }

  // ---------------------------------------------------------------------------
  // 器
  // ---------------------------------------------------------------------------

  var BODY = 'M26,170 C30,270 100,344 164,344 L236,344 C300,344 370,270 374,170 Z';

  function bodyPattern(kind, color) {
    if (kind === 'dash') {
      return line('M42,205 A158,68 0 0 0 358,205', color, 14, { 'stroke-dasharray': '36 26' }) +
        line('M72,243 A128,58 0 0 0 328,243', color, 14, { 'stroke-dasharray': '36 26', 'stroke-dashoffset': 18 });
    }
    if (kind === 'dots') {
      return line('M42,205 A158,68 0 0 0 358,205', color, 17, { 'stroke-dasharray': '0.1 38' }) +
        line('M72,243 A128,58 0 0 0 328,243', color, 17, { 'stroke-dasharray': '0.1 38', 'stroke-dashoffset': 19 });
    }
    if (kind === 'band') {
      return line('M34,196 A166,72 0 0 0 366,196', color, 26) +
        line('M62,236 A138,60 0 0 0 338,236', color, 9);
    }
    if (kind === 'stripes') {
      var s = '';
      for (var x = 40; x <= 360; x += 32) {
        var t = (x - 200) / 174;
        s += line('M' + x + ',' + (200 + 38 * (1 - t * t)).toFixed(0) + ' L' + (200 + (x - 200) * 0.74).toFixed(0) + ',330', color, 10);
      }
      return s;
    }
    if (kind === 'waves') {
      var w = '';
      var rows = [[230, 54, 6], [268, 86, 5], [304, 118, 4]];
      rows.forEach(function (r, ri) {
        for (var i = 0; i < r[2]; i++) {
          var cx = r[1] + i * 56 + (ri % 2 ? 0 : 0);
          w += line('M' + (cx - 24) + ',' + r[0] + ' a24,22 0 0 1 48,0', color, 8) +
            line('M' + (cx - 12) + ',' + r[0] + ' a12,11 0 0 1 24,0', color, 6);
        }
      });
      return w;
    }
    return '';
  }

  /**
   * 丼（ななめ上から見た形）。元の udon.png と同じ、青緑＋白い点線の器が基本。
   * opts: { color, rim, pattern, patternColor, soup, inside(中身の SVG), over(ふちより手前に出す SVG) }
   */
  function bowl(opts) {
    var id = 'ub' + (++uid);
    var color = opts.color || C.teal;
    return '' +
      '<defs>' +
      '<clipPath id="' + id + 'b"><path d="' + BODY + '"/></clipPath>' +
      '<clipPath id="' + id + 's"><ellipse cx="200" cy="170" rx="151" ry="57"/></clipPath>' +
      '</defs>' +
      // 高台
      '<rect x="152" y="330" width="96" height="36" rx="10" fill="' + (opts.foot || '#FFFDF8') + '" stroke="' + INK + '" stroke-width="11"/>' +
      // 胴
      path(BODY, color, 12) +
      group(bodyPattern(opts.pattern || 'dash', opts.patternColor || '#FFFFFF'), { 'clip-path': 'url(#' + id + 'b)' }) +
      path(BODY, 'none', 12) +
      // ふち
      ellipse(200, 170, 174, 74, opts.rim || color, 12) +
      // つゆ
      ellipse(200, 170, 151, 57, opts.soup || C.broth, 9) +
      group(opts.inside || '', { 'clip-path': 'url(#' + id + 's)' }) +
      ellipse(200, 170, 151, 57, 'none', 9) +
      (opts.over || '');
  }

  /** 湯気（CSS の .udon-steam でゆらす） */
  function steam(x, y, color) {
    var c = color || INK;
    return group(
      line('M0,0 c-14,-16 14,-28 0,-46 c-12,-16 10,-26 0,-40', c, 8, { class: 'udon-steam s1' }) +
      line('M44,10 c-14,-16 14,-28 0,-46 c-12,-16 10,-26 0,-40', c, 8, { class: 'udon-steam s2' }) +
      line('M-44,10 c-14,-16 14,-28 0,-46 c-12,-16 10,-26 0,-40', c, 8, { class: 'udon-steam s3' }),
      { transform: 'translate(' + x + ',' + y + ')', opacity: 0.9 }
    );
  }

  // ---------------------------------------------------------------------------
  // うどん 12 種
  // ---------------------------------------------------------------------------

  var DISHES = {
    // 元の udon.png へのオマージュ: 箸で持ち上げた 4 本の麺
    kake: function () {
      var lifted = noodles([
        'M168,176 L166,64', 'M190,180 L189,58', 'M212,180 L213,54', 'M234,176 L238,50'
      ], 11);
      var sticks = line('M118,84 L300,34', INK, 26) + line('M118,84 L300,34', '#C98A4B', 13) +
        line('M112,54 L296,10', INK, 26) + line('M112,54 L296,10', '#C98A4B', 13);
      return bowl({
        inside: noodleBundle(0) + kamaboko(108, 176, 0.9, -12) + negiScatter([[286, 160, 11, 10], [304, 184, 10, -20], [268, 196, 9, 30]]),
        over: lifted + sticks
      });
    },

    kitsune: function () {
      return bowl({
        color: C.ai, pattern: 'dots',
        inside: noodleBundle(-4) + age(196, 168, -8, 1.12) + negiScatter([[92, 160, 11, 10], [106, 190, 9, -20], [306, 150, 10, 30], [296, 198, 9, 0]])
      }) + steam(200, 78);
    },

    tsukimi: function () {
      return bowl({
        color: '#2F3E6E', pattern: 'dots', patternColor: '#F7D774',
        inside: noodleBundle(0) + egg(200, 164, 1.1) + negiScatter([[98, 178, 10, 10], [118, 150, 9, -20], [300, 186, 10, 30]]) +
          kamaboko(294, 150, 0.7, 14)
      }) + steam(200, 78);
    },

    ebiten: function () {
      return bowl({
        color: C.cream, pattern: 'stripes', patternColor: C.ai, foot: C.ai,
        inside: noodleBundle(0) + negiScatter([[92, 172, 11, 10], [112, 196, 9, -20], [120, 148, 9, 40]]),
        over: ebiten(254, 146, -14, 0.8) + ebiten(150, 166, 8, 0.8)
      });
    },

    niku: function () {
      return bowl({
        color: '#4B4541', pattern: 'band', patternColor: '#EADBC0', foot: '#EADBC0', soup: '#D9A968',
        inside: noodleBundle(0) + meat(160, 152, -10) + meat(232, 162, 12, '#B8734A') + meat(188, 190, 4, '#96583C') +
          meat(262, 196, -16) + negiScatter([[108, 190, 11, 10], [300, 160, 10, -20], [130, 148, 8, 0], [214, 136, 9, 20]])
      }) + steam(200, 78);
    },

    curry: function () {
      return bowl({
        color: C.cream, pattern: 'dash', patternColor: C.shu, foot: C.shu, soup: '#E0A030',
        inside: noodleBundle(0) +
          // とろっとかかったルウ
          path('M150,104 C210,96 300,110 352,150 C372,186 330,236 250,236 C214,238 196,214 170,206 C140,198 150,172 176,164 ' +
            'C204,154 196,134 168,130 C140,126 128,108 150,104 Z', '#C9801F', 7) +
          line('M222,128 q14,-8 28,0 M286,196 q12,-8 24,0 M226,206 q10,-6 20,0', '#F2B84B', 6) +
          chunk(252, 160, '#F28B2D', -10) + chunk(304, 172, '#F7DFA0', 16) + chunk(210, 184, '#F7DFA0', -24) +
          chunk(276, 206, '#F28B2D', 30) +
          negiScatter([[100, 176, 11, 0], [128, 200, 9, 20], [122, 150, 9, -30]])
      }) + steam(200, 78);
    },

    wakame: function () {
      return bowl({
        color: '#A9D8C6', pattern: 'waves', patternColor: '#FFFFFF',
        inside: noodleBundle(0) + wakame(160, 158, -8, 1.05) + wakame(240, 186, 10, 0.95) +
          kamaboko(292, 150, 0.72, 16) + negiScatter([[100, 190, 10, 10], [206, 136, 9, 30], [306, 192, 9, -10]])
      }) + steam(200, 78);
    },

    tanuki: function () {
      return bowl({
        color: '#86AC52', pattern: 'dots',
        inside: noodleBundle(0) +
          tenkasu([[150, 160, 10], [176, 146, 9], [204, 160, 11], [232, 150, 9], [186, 178, 10], [220, 182, 9], [248, 172, 10],
            [164, 196, 8], [200, 200, 9], [132, 180, 8], [268, 156, 8], [240, 200, 8]]) +
          naruto(298, 182, 0.8) + negiScatter([[100, 164, 10, 10], [114, 194, 9, -20], [284, 140, 8, 20]])
      }) + steam(200, 78);
    },

    ume: function () {
      return bowl({
        color: '#F3B5C1', pattern: 'dash',
        inside: noodleBundle(0) + shiso(190, 170, -12, 1.1) + ume(200, 166, 1.1) +
          line('M110,150 q10,-8 20,0 q10,8 20,0 M250,196 q10,-8 20,0 q10,8 20,0 M262,146 q10,-8 20,0', '#9A8B4A', 6) +
          negiScatter([[104, 188, 9, 10], [300, 172, 10, 30]])
      }) + steam(200, 78);
    },

    chikara: function () {
      return bowl({
        color: '#D9463A', pattern: 'band', patternColor: '#FFFDF8',
        inside: noodleBundle(0) + mochi(166, 160, -8, 1) + mochi(244, 178, 10, 0.95) +
          kamaboko(300, 150, 0.7, 18) + negiScatter([[100, 184, 10, 10], [206, 204, 9, 30], [118, 150, 8, -10]])
      }) + steam(200, 78);
    },

    // ざる: 竹ざる＋つゆの猪口（猪口は元の丼の色）
    zaru: function () {
      var id = 'uz' + (++uid);
      var weave = '';
      for (var i = -5; i <= 5; i++) {
        weave += line('M' + (186 + i * 34) + ',150 L' + (186 + i * 30) + ',300', C.woodDark, 5);
      }
      for (var j = 0; j < 4; j++) {
        weave += line('M20,' + (176 + j * 30) + ' Q186,' + (214 + j * 30) + ' 352,' + (176 + j * 30), C.woodDark, 5);
      }
      var nest = function (x, y, rot) {
        return group(
          ellipse(0, 0, 54, 30, '#FFFDF8', 8) +
          line('M-36,2 C-30,-16 30,-16 36,2', INK, 6) +
          line('M-22,8 C-16,-4 16,-4 22,8', INK, 6) +
          line('M-8,12 C-4,6 4,6 8,12', INK, 5),
          { transform: 'translate(' + x + ',' + y + ') rotate(' + rot + ')' }
        );
      };
      var mound = nest(118, 206, -10) + nest(232, 196, 8) + nest(176, 256, 0);
      return '' +
        '<defs><clipPath id="' + id + '"><ellipse cx="186" cy="226" rx="160" ry="84"/></clipPath></defs>' +
        // ざるの縁と編み目
        ellipse(186, 232, 174, 96, C.woodDark, 11) +
        ellipse(186, 226, 160, 84, C.wood, 9) +
        group(weave, { 'clip-path': 'url(#' + id + ')', opacity: 0.75 }) +
        ellipse(186, 226, 160, 84, 'none', 9) +
        mound +
        nori([[104, 196, 9, -6], [222, 186, 9, 6], [164, 246, 9, -5], [240, 204, 7, 6], [126, 212, 7, 5]]) +
        // 猪口
        group(
          path('M-46,-22 C-44,26 -26,44 0,44 C26,44 44,26 46,-22 Z', C.teal, 10) +
          line('M-34,6 A40,16 0 0 0 34,6', '#FFFFFF', 9, { 'stroke-dasharray': '16 12' }) +
          ellipse(0, -22, 46, 17, C.teal, 10) +
          ellipse(0, -22, 35, 10, '#5B3A22', 6),
          { transform: 'translate(330,326)' }
        ) +
        // 薬味
        group(
          ellipse(0, 0, 34, 15, '#FFFDF8', 8) + negi(-10, -3, 8, 10) + negi(6, 1, 7, -20) +
          path('M12,-6 q10,-10 16,0 q2,8 -8,8 q-8,0 -8,-8 Z', '#9CCB5A', 5),
          { transform: 'translate(336,170)' }
        );
    },

    // 鍋焼き: 土鍋に具だくさん
    nabeyaki: function () {
      var id = 'un' + (++uid);
      var body = 'M30,176 C34,268 96,330 160,330 L240,330 C304,330 366,268 370,176 Z';
      return '' +
        '<defs><clipPath id="' + id + '"><ellipse cx="200" cy="174" rx="150" ry="58"/></clipPath>' +
        '<clipPath id="' + id + 'b"><path d="' + body + '"/></clipPath></defs>' +
        // 持ち手
        path('M12,150 q-14,24 4,46 l26,-6 l-4,-36 Z', '#6B4A3A', 10) +
        path('M388,150 q14,24 -4,46 l-26,-6 l4,-36 Z', '#6B4A3A', 10) +
        '<rect x="150" y="318" width="100" height="34" rx="10" fill="#3F2B22" stroke="' + INK + '" stroke-width="11"/>' +
        path(body, '#6B4A3A', 12) +
        group(line('M34,214 A166,70 0 0 0 366,214', '#3F2B22', 30) +
          line('M60,262 A140,58 0 0 0 340,262', '#8C6A56', 8, { 'stroke-dasharray': '2 20' }), { 'clip-path': 'url(#' + id + 'b)' }) +
        path(body, 'none', 12) +
        ellipse(200, 174, 176, 76, '#8C6A56', 12) +
        ellipse(200, 174, 150, 58, '#DDB06A', 9) +
        group(
          noodleBundle(4) +
          wakame(112, 190, -20, 0.62) +
          egg(160, 186, 0.78) +
          shiitake(262, 196, 0.86) +
          kamaboko(300, 160, 0.72, 20) + kamaboko(122, 152, 0.66, -22) +
          negiScatter([[214, 208, 9, 10], [236, 140, 8, -20], [190, 138, 8, 30]]) +
          circle(96, 172, 6, '#FFF6DF', 3) + circle(318, 196, 5, '#FFF6DF', 3) + circle(210, 176, 5, '#FFF6DF', 3),
          { 'clip-path': 'url(#' + id + ')' }
        ) +
        ellipse(200, 174, 150, 58, 'none', 9) +
        ebiten(236, 140, -10, 0.86) +
        steam(196, 66);
    }
  };

  /**
   * うどんのイラストを SVG 文字列で返す。
   * @param {string} id  kake | kitsune | tsukimi | ebiten | niku | curry | zaru | wakame | tanuki | ume | chikara | nabeyaki
   * @param {object} [opts] { size: px, locked: true で「まだ出会っていない」シルエット, title }
   */
  function dish(id, opts) {
    opts = opts || {};
    var draw = DISHES[id] || DISHES.kake;
    var inner = draw();
    var cls = 'udon-dish udon-dish--' + id + (opts.locked ? ' is-locked' : '');
    var size = opts.size ? ' width="' + opts.size + '" height="' + opts.size + '"' : '';
    var filter = '';
    if (opts.locked) {
      var fid = 'ul' + (++uid);
      filter = '<defs><filter id="' + fid + '"><feColorMatrix type="matrix" values="0 0 0 0 0.14  0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 0.9 0"/></filter></defs>';
      inner = group(inner, { filter: 'url(#' + fid + ')', opacity: 0.28 });
    }
    return '<svg class="' + cls + '" viewBox="-10 -20 420 420"' + size + ' xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      (opts.title || id) + '">' + filter + inner + '</svg>';
  }

  // ---------------------------------------------------------------------------
  // 足・小物
  // ---------------------------------------------------------------------------

  /**
   * 元の asi.png を描き起こした足（横向き・つま先が左）。
   * opts.core = LED の色を渡すと、足の甲に ORPHE CORE を付ける。
   */
  function leg(opts) {
    opts = opts || {};
    var coreSvg = '';
    if (opts.core) {
      coreSvg = group(
        '<rect x="-58" y="-26" width="116" height="52" rx="26" fill="#2B2A2A" stroke="' + INK + '" stroke-width="14"/>' +
        '<circle cx="28" cy="0" r="12" fill="' + opts.core + '" class="udon-core-led"/>' +
        line('M-34,0 L-2,0', '#6E6C6A', 9),
        { transform: 'translate(196,790) rotate(-25)' }
      );
    }
    return '<svg class="udon-leg" viewBox="0 0 465 910" xmlns="http://www.w3.org/2000/svg"' +
      (opts.width ? ' width="' + opts.width + '" height="' + Math.round(opts.width * 910 / 465) + '"' : '') + ' aria-hidden="true">' +
      path('M206,12 L444,12 L402,728 C402,760 420,800 430,838 C438,872 424,894 396,894 L60,894 C22,894 4,876 14,858 ' +
        'C22,846 40,842 60,836 L226,766 C242,758 248,744 246,724 Z', C.skin, 22) +
      line('M36,862 C60,850 110,846 150,852', INK, 16) +
      line('M52,852 L58,884 M88,848 L94,884 M124,848 L130,884', INK, 14) +
      coreSvg +
      '</svg>';
  }

  /** 足あと（HUD の左右インジケータ用）。side: 'L' | 'R' */
  function footprint(side, fill) {
    var f = fill || '#FFFDF8';
    var body =
      path('M50,52 C28,52 20,78 24,104 C28,132 30,150 40,166 C50,180 74,180 82,164 C92,146 92,124 90,100 C88,74 76,52 50,52 Z', f, 9) +
      circle(26, 34, 11, f, 7) + circle(46, 22, 10, f, 7) + circle(66, 20, 9, f, 7) +
      circle(83, 28, 8, f, 7) + circle(96, 42, 7, f, 7);
    return '<svg class="udon-footprint" viewBox="0 0 116 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      (side === 'R' ? group(body, { transform: 'translate(116,0) scale(-1,1)' }) : body) + '</svg>';
  }

  /**
   * ORPHE INSOLE の足うらマップ（上から見たインソールと、6 つの圧力センサ）。side: 'L' | 'R'
   * センサの丸には class="udon-pad" と data-ch（0〜5）が付く。ゲーム中は game.js が r と fill-opacity を書きかえる。
   * opts.layout = センサの位置（insole-pressure.js の LAYOUT。x: 0 = 外側 … 1 = 内側、y: 0 = つま先 … 1 = かかと）
   * opts.values = センサごとの押しぐあい 0〜1（リザルトの静止画用）
   */
  function insoleMap(side, opts) {
    opts = opts || {};
    var layout = opts.layout || [];
    var values = opts.values || [];
    // 左足（親指側 = 右）で描いて、右足は左右を反転する
    var body = path('M60,8 C92,8 110,34 110,72 C110,104 98,122 96,146 C94,172 100,186 96,204 C92,220 78,226 62,226 ' +
      'C44,226 30,218 26,200 C22,180 26,162 22,140 C18,112 10,96 10,68 C10,32 30,8 60,8 Z', opts.fill || '#FFFDF8', 9);
    layout.forEach(function (pt, i) {
      var v = Math.max(0, Math.min(1, values[i] || 0));
      var cx = (10 + pt.x * 100).toFixed(1), cy = (8 + pt.y * 218).toFixed(1);
      body += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="rgba(35,24,21,0.1)"/>' +
        '<circle class="udon-pad" data-ch="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + (5 + 9 * v).toFixed(1) +
        '" fill="' + C.shu + '" fill-opacity="' + (v > 0 ? 0.25 + 0.75 * v : 0).toFixed(2) + '"/>';
    });
    // 圧力の中心（ゲーム中だけ動かす）
    body += '<circle class="udon-cop" cx="60" cy="117" r="6" fill="' + INK + '" opacity="0"/>';
    return '<svg class="udon-insolemap" viewBox="0 0 120 234" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      (side === 'R' ? '右足' : '左足') + 'の足うらの圧力">' +
      (side === 'R' ? group(body, { transform: 'translate(120,0) scale(-1,1)' }) : body) + '</svg>';
  }

  /** のれん。labels は 1 枚ごとの文字 */
  function noren(labels, opts) {
    opts = opts || {};
    var n = labels.length;
    var w = 150, gap = 6, h = opts.height || 230;
    var total = n * w + (n - 1) * gap;
    var s = '<svg class="udon-noren" viewBox="-30 0 ' + (total + 60) + ' ' + (h + 60) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      labels.join('') + '">';
    // 竿
    s += line('M-16,22 L' + (total + 16) + ',22', INK, 26) + line('M-16,22 L' + (total + 16) + ',22', C.woodDark, 13);
    for (var i = 0; i < n; i++) {
      var x = i * (w + gap);
      var sway = (i % 2 ? 1 : -1) * 3;
      s += '<g class="udon-noren-panel p' + i + '">' +
        path('M' + x + ',30 L' + (x + w) + ',30 L' + (x + w + sway) + ',' + (h + 20) + ' Q' + (x + w / 2) + ',' + (h + 34) + ' ' + (x + sway) + ',' + (h + 20) + ' Z',
          opts.color || '#2B4C7E', 9) +
        // 乳（竿に通す輪）
        '<rect x="' + (x + 18) + '" y="8" width="26" height="34" rx="6" fill="' + (opts.color || '#2B4C7E') + '" stroke="' + INK + '" stroke-width="8"/>' +
        '<rect x="' + (x + w - 44) + '" y="8" width="26" height="34" rx="6" fill="' + (opts.color || '#2B4C7E') + '" stroke="' + INK + '" stroke-width="8"/>' +
        '<text x="' + (x + w / 2) + '" y="' + (h * 0.62) + '" text-anchor="middle" class="udon-noren-text" fill="#FFFDF8">' + labels[i] + '</text>' +
        '</g>';
    }
    return s + '</svg>';
  }

  /** 落款ふうのはんこ */
  function stamp(text, color) {
    var chars = String(text).split('');
    var size = chars.length <= 2 ? 86 : 62;
    var body = '';
    if (chars.length <= 2) {
      chars.forEach(function (ch, i) {
        body += '<text x="100" y="' + (chars.length === 1 ? 132 : 92 + i * 84) + '" text-anchor="middle" font-size="' +
          (chars.length === 1 ? 120 : size) + '" class="udon-stamp-text" fill="#FFFDF8">' + ch + '</text>';
      });
    } else {
      chars.slice(0, 3).forEach(function (ch, i) {
        body += '<text x="100" y="' + (70 + i * 54) + '" text-anchor="middle" font-size="' + 54 + '" class="udon-stamp-text" fill="#FFFDF8">' + ch + '</text>';
      });
    }
    return '<svg class="udon-stamp" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="10" y="10" width="180" height="180" rx="26" fill="' + (color || '#D8303F') + '" stroke="' + INK + '" stroke-width="10"/>' +
      '<rect x="26" y="26" width="148" height="148" rx="16" fill="none" stroke="#FFFDF8" stroke-width="5" opacity="0.85"/>' +
      body + '</svg>';
  }

  /** 星（めずらしさ） */
  function stars(n, max) {
    var s = '';
    for (var i = 0; i < (max || 3); i++) {
      s += '<path transform="translate(' + (i * 46 + 22) + ',24)" d="M0,-20 L5.9,-6.2 L20.9,-6.2 L8.8,3.4 L12.9,17.8 L0,9 L-12.9,17.8 L-8.8,3.4 L-20.9,-6.2 L-5.9,-6.2 Z" fill="' +
        (i < n ? C.yolk : 'rgba(35,24,21,0.14)') + '" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>';
    }
    return '<svg class="udon-stars" viewBox="0 0 ' + ((max || 3) * 46) + ' 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="めずらしさ ' + n + '">' + s + '</svg>';
  }

  var UdonArt = {
    COLORS: C,
    INK: INK,
    dish: dish,
    dishIds: Object.keys(DISHES),
    leg: leg,
    footprint: footprint,
    insoleMap: insoleMap,
    noren: noren,
    stamp: stamp,
    stars: stars,
    steam: steam,
    /** SVG 文字列を canvas で使える Image にする */
    toImage: function (svg) {
      var img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return img;
    }
  };

  root.UdonArt = UdonArt;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonArt;
})(typeof globalThis !== 'undefined' ? globalThis : this);
