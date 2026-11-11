/**
 * お品書き（UdonMenu）
 *
 * ふみふみの「ふみかた」に応じて、できあがるうどんを決める純ロジックです。
 * どのうどんにも良し悪しはなく、ふみかたの個性を映します（やさしい足踏みには、やさしいうどん）。
 * まだ出会っていないうどんを少しだけ優先するので、遊ぶたびに図鑑が埋まっていきます。
 */
(function (root) {
  'use strict';

  var MENU = [
    {
      id: 'kake', name: 'かけうどん', en: 'Kake Udon', rarity: 1, trait: 'きほんの一杯',
      reason: 'まずは基本の一杯。だしの香りは、ふみふみした人だけのごほうびです。',
      hint: 'どんなふみかたでも。はじめの一歩に。'
    },
    {
      id: 'kitsune', name: 'きつねうどん', en: 'Kitsune Udon', rarity: 2, trait: 'リズム名人',
      reason: 'コン、コン、コン。きつねが跳ねるような、そろったリズムでした。',
      hint: 'おなじ間隔で、リズムよくふみつづけると…'
    },
    {
      id: 'tsukimi', name: '月見うどん', en: 'Tsukimi Udon', rarity: 2, trait: 'まんまるバランス',
      reason: '左右のつりあいが、満月のようにまんまるでした。',
      hint: '左右おなじくらい、交互にふむと…（CORE 2台）'
    },
    {
      id: 'ebiten', name: 'えび天うどん', en: 'Ebi-ten Udon', rarity: 2, trait: 'ちからもち',
      reason: '力強いふみこみで、えび天がサクッと揚がりました。',
      hint: 'しっかり力強くふみこむと…'
    },
    {
      id: 'niku', name: '肉うどん', en: 'Niku Udon', rarity: 2, trait: 'スタミナ自慢',
      reason: '最後までペースが落ちない、スタミナたっぷりのふみふみでした。',
      hint: '最後までおなじペースでふみきると…'
    },
    {
      id: 'curry', name: 'カレーうどん', en: 'Curry Udon', rarity: 2, trait: 'ハイテンポ',
      reason: 'ホットなハイテンポ！ 体もぽかぽか、スパイスが効いています。',
      hint: 'テンポよく、はやめにふむと…'
    },
    {
      id: 'zaru', name: 'ざるうどん', en: 'Zaru Udon', rarity: 2, trait: 'ゆったり上手',
      reason: 'あわてず、ゆったり。涼しげで落ち着いたふみふみでした。',
      hint: 'ゆっくり、でもリズムよくふむと…'
    },
    {
      id: 'wakame', name: 'わかめうどん', en: 'Wakame Udon', rarity: 2, trait: 'なめらか',
      reason: '力みのない、そろったふみこみ。波にゆれるわかめのようです。',
      hint: '毎回おなじ強さでふむと…'
    },
    {
      id: 'tanuki', name: 'たぬきうどん', en: 'Tanuki Udon', rarity: 1, trait: 'やさしい足どり',
      reason: 'ふんわりやさしい足どりで、天かすが花のように開きました。',
      hint: 'やさしく、そっとふむと…'
    },
    {
      id: 'ume', name: '梅うどん', en: 'Ume Udon', rarity: 1, trait: 'ひとやすみ上手',
      reason: 'ひとやすみを上手にはさめました。無理をしないのが、長つづきのコツです。',
      hint: 'とちゅうで、ひとやすみすると…'
    },
    {
      id: 'chikara', name: '力うどん', en: 'Chikara Udon', rarity: 3, trait: 'たくさんふんだ',
      reason: 'たくさんふんだ証。のび〜るおもち入りです。',
      hint: '「大盛り」より上のコースをふみきると…'
    },
    {
      id: 'nabeyaki', name: '鍋焼きうどん', en: 'Nabeyaki Udon', rarity: 3, trait: '名人の一杯',
      reason: 'ぜんぶそろった名人のふみふみ。具だくさんの土鍋でどうぞ。',
      hint: '総合スコアがとても高いと…'
    }
  ];

  var NEW_BONUS = 0.3;   // まだ図鑑にないうどんへの上乗せ

  function byId(id) {
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === id) return MENU[i];
    return null;
  }

  function axisScore(analysis, key) {
    for (var i = 0; i < analysis.axes.length; i++) {
      if (analysis.axes[i].key === key) return analysis.axes[i].score;
    }
    return null;
  }

  /**
   * @param {object} analysis UdonHealth.analyze() の結果
   * @param {object} [ctx]
   * @param {number} [ctx.target] コースの大きさ（もちもち度の目標。コンボなしなら、ふみ数とおなじ）
   * @param {boolean} [ctx.completed] コースを最後までふみきった
   * @param {number} [ctx.threshold] 感度のしきい値 [G]
   * @param {number} [ctx.pauses] 「ひとやすみ」ボタンを使った回数
   * @param {object} [ctx.collected] 図鑑 { id: 回数 }
   * @returns {{ id: string, item: object, isNew: boolean, candidates: Array }}
   */
  function pick(analysis, ctx) {
    ctx = ctx || {};
    var collected = ctx.collected || {};
    var cand = [{ id: 'kake', strength: 0.5 }];

    if (analysis && analysis.ok) {
      // 得意な観点（70 点以上）に対応するうどん。点が高いほど、いちばん得意ならさらに強く推す
      var axisMap = { rhythm: 'kitsune', balance: 'tsukimi', power: 'ebiten', stamina: 'niku', steady: 'wakame' };
      var push = function (id, key, min) {
        var s = axisScore(analysis, key);
        if (s === null || s < min) return;
        cand.push({ id: id, strength: 0.55 + 0.4 * (s - 70) / 30 + (analysis.bestAxis === key ? 0.05 : 0) });
      };
      for (var key in axisMap) push(axisMap[key], key, 70);
      push('curry', 'tempo', 85);                       // ハイテンポ（およそ 107 ふみ/分〜）

      // ぜんぶそろった名人の一杯
      if (analysis.total >= 85 && analysis.stepCount >= 40) cand.push({ id: 'nabeyaki', strength: 1.1 });

      // ゆっくり（80 ふみ/分以下）でもリズムがそろっている
      var rhythm = axisScore(analysis, 'rhythm');
      if (analysis.cadence > 0 && analysis.cadence <= 80 && rhythm !== null && rhythm >= 55) {
        cand.push({ id: 'zaru', strength: 0.75 + 0.2 * (rhythm - 55) / 45 });
      }
      // やさしい感度、またはそっとふんだ
      if ((ctx.threshold > 0 && ctx.threshold <= 0.32) || analysis.medianPeak < 0.5) {
        cand.push({ id: 'tanuki', strength: 0.65 });
      }
      // 大盛り以上をふみきった
      if (ctx.target >= 100 && ctx.completed) cand.push({ id: 'chikara', strength: 0.8 });
    }
    // ひとやすみした（ボタン、または長い間隔）
    if (ctx.pauses >= 1 || (analysis && analysis.restCount >= 1)) cand.push({ id: 'ume', strength: 0.62 });

    cand.forEach(function (c) {
      c.isNew = !collected[c.id];
      c.final = c.strength + (c.isNew ? NEW_BONUS : 0);
    });
    cand.sort(function (a, b) {
      if (b.final !== a.final) return b.final - a.final;
      return MENU.indexOf(byId(a.id)) - MENU.indexOf(byId(b.id));
    });
    var top = cand[0];
    return { id: top.id, item: byId(top.id), isNew: top.isNew, candidates: cand };
  }

  var UdonMenu = { MENU: MENU, byId: byId, pick: pick, NEW_BONUS: NEW_BONUS };

  root.UdonMenu = UdonMenu;
  if (typeof module !== 'undefined' && module.exports) module.exports = UdonMenu;
})(typeof globalThis !== 'undefined' ? globalThis : this);
