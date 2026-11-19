// level.js — STAGE 01 "DASH MEADOW".
//
// The course is written the way a side-scrolling stage is drawn: a strip of ground
// with heights, holes, things to jump on and things to wait for. `s` is metres
// along the course, heights are metres. The game shows the same strip twice: as a
// first-person 3D road you run into, and as the small side view at the top of the
// screen. No DOM, no three.js, no imports (the tests build and play it in Node).
//
// The course is about speed. A jump keeps the speed it is taken at:
//   - small holes (2 m or less) can be hopped at a walk;
//   - WIDE holes need a dash, and a dash needs a run-up: each one has a long,
//     clear runway in front of it, starting at a checkpoint;
//   - small footholds need a slower jump, or the jump flies past them;
//   - hammers and blink bridges need a stop, and stopping from a dash takes 8 m.
// rules.js works out the speed range of every hole from this file (findGaps);
// slow() marks a stretch where the road itself asks for a gentle pace.
//
// Layout rules the tests check or the bots depend on:
//   - a runway is one piece of ground, long enough for the run-up its hole needs;
//   - things that need a jump or a stop are far apart: a dash jump is 6.9 m long
//     and there must be time to see the next thing after landing
//     (10 m between creatures, 12 m of plain road before a hammer or a blink
//     bridge, 14 m after the landing of a wide hole);
//   - spikes stand still;
//   - slopes are stairs of 0.25 m: low enough to run up without jumping.

const GROUND_THICK = 60;   // ground blocks are pillars: solid all the way down

export function buildLevel() {
  const L = {
    name: 'DASH MEADOW', nameJa: 'ダッシュ草原',
    start: { s: 1.5, y: 0 },
    platforms: [], bridges: [], enemies: [], notes: [], bells: [], springs: [], hammers: [],
    checkpoints: [], signs: [], zones: [], slowZones: [], finale: null, goal: 0, length: 0,
  };
  let n = 0;
  const id = (k) => `${k}${n++}`;
  const heightAt = (s) => {
    let h = 0;
    for (const p of L.platforms) if (p.kind === 'ground' && s >= p.a && s <= p.b) h = Math.max(h, p.h);
    return h;
  };

  /** Ground from a to b with its top at h. */
  const ground = (a, b, h, extra = {}) => { const p = { a, b, h, thick: GROUND_THICK, belt: 0, safe: true, kind: 'ground', ...extra }; L.platforms.push(p); return p; };
  /** A slope from a (height h0) up to h1: stairs of 0.25 m, one per metre. Returns where it ends. */
  const slope = (a, h0, h1) => { let s = a; for (let h = h0 + 0.25; h <= h1 + 1e-9; h += 0.25) { ground(s, s + 1, h, { stair: true }); s += 1; } return s; };
  /** A thin platform in the air (can be walked under). */
  const float = (a, b, h) => L.platforms.push({ a, b, h, thick: 0.4, belt: 0, safe: true, kind: 'float' });
  const belt = (a, b, h, v) => ground(a, b, h, { belt: v, safe: false });
  const bridge = (a, b, h, phase) => L.bridges.push({ id: id('br'), a, b, h, thick: 0.3, belt: 0, safe: false, kind: 'bridge', phase });
  const jelly = (a, b, phase = 0, v = 1.5) => L.enemies.push({ id: id('e'), type: 'jelly', a, b, v, phase, h: heightAt(a) });
  /** The same size as a jelly, twice as fast. */
  const dasher = (a, b, phase = 0, v = 3.2) => L.enemies.push({ id: id('e'), type: 'dasher', a, b, v, phase, h: heightAt(a) });
  const spike = (s, base = null) => L.enemies.push({ id: id('e'), type: 'spike', a: s, b: s, v: 0, phase: 0, h: base ?? heightAt(s) });
  const note = (s, y) => L.notes.push({ id: id('n'), s, y });
  // Coins on the ground sit at knee height: seen from the runner's eyes they form a trail on
  // the road instead of a column in the middle of the view. Running through one collects it;
  // jumping over it does not.
  const LOW = 0.45;
  /** A trail of coins from a to b. `base` overrides the ground height (for floating platforms and bridges). */
  const line = (a, b, stepLen = 1.3, base = null) => { for (let s = a; s <= b + 1e-6; s += stepLen) note(s, (base ?? heightAt(s)) + LOW); };
  const one = (s) => note(s, heightAt(s) + LOW);
  /** Coins in an arc from a to b: the path of a jump. */
  const arc = (a, b, count, base, peak = 1.85) => { for (let i = 0; i < count; i++) { const u = count === 1 ? 0.5 : i / (count - 1); note(a + (b - a) * u, base + LOW + peak * Math.sin(Math.PI * u)); } };
  /** A coin block: jump and hit it with the head. */
  const bell = (s, extra = {}) => L.bells.push({ id: id('b'), s, y: (extra.base ?? heightAt(s)) + 2.3, notes: 3, fever: false, ...extra });
  const spring = (a, b) => L.springs.push({ id: id('sp'), a, b, h: heightAt(a) });
  const hammer = (a, phase) => L.hammers.push({ id: id('hm'), a, b: a + 1.6, h: heightAt(a), phase });
  const sign = (s, ja, en) => L.signs.push({ s, h: heightAt(s), ja, en });
  const zone = (s, name, ja, palette) => L.zones.push({ s, name, ja, palette });
  /** mid: the one checkpoint that also counts in normal mode (the others are for easy mode only). */
  const checkpoint = (s, extra = {}) => L.checkpoints.push({ s, y: heightAt(s), mid: false, ...extra });
  /** A stretch to take gently: no faster than max (m/s). The road is painted, the speed gauge shows the range. */
  const slow = (a, b, max) => L.slowZones.push({ a, b, max, h: heightAt(a) });

  // ------------------------------------------------------------ ZONE 1  SUNNY MEADOW: run, jump, and the first dash
  zone(0, 'SUNNY MEADOW', 'はじまりの草原', 0);
  ground(0, 18, 0);
  ground(18, 23, 0.75);           // the first thing to jump onto
  ground(23, 46, 0);
  ground(47.8, 74, 0);            // 46–47.8: the first hole, a hop. Then the first runway.
  ground(78.6, 92, 0);            // 74–78.6: the first WIDE hole (4.6 m): it needs a dash
  slope(92, 0, 2.0);              // 92–100: up to the sky
  ground(100, 112, 2.0);
  sign(2.5, '足ぶみで 前へ！', 'STAMP YOUR FEET TO RUN');
  line(5, 15, 1.3);
  dasher(9, 15, 0);               // the first thing on the road comes running at you
  sign(10, 'つま先UPで ジャンプ！', 'TOE UP TO JUMP');
  line(19.3, 22, 1.2);
  sign(23.5, '上から ふんづけろ！', 'STOMP IT FROM ABOVE');
  jelly(28, 32, 0);
  sign(32.5, 'ブロックは 頭でたたけ！', 'HIT THE BLOCK WITH YOUR HEAD');
  bell(36.5); bell(39);
  spike(41.5);                    // a spike, and a hole right behind it: at a jog two jumps, at a dash one
  line(42.8, 44.9, 1.05);
  arc(45.4, 48.4, 5, 0);
  line(50, 54, 1.3);
  checkpoint(56);                 // every runway starts at a checkpoint: out of hearts at a wide hole means "try the run-up again"
  sign(55, '足ぶみを つづけると ダッシュ！', 'KEEP STAMPING TO DASH');
  line(58, 72.6, 1.4);            // the trail down the runway
  sign(63, '広い穴は ダッシュで とびこえろ！', 'WIDE GAP: DASH, THEN JUMP');
  arc(73.6, 79, 7, 0, 1.75);      // the path of a dash jump
  line(80.5, 83.5, 1.5);
  bell(86); bell(88.4);
  jelly(85.5, 89.5, 0.5);         // right under the blocks: stomp it and the bounce reaches them
  line(92.5, 99.5, 1.75);

  // ------------------------------------------------------------ ZONE 2  SKY STEPS: slow down for small footholds
  zone(100, 'SKY STEPS', 'そらの足場', 1);
  checkpoint(101);
  sign(102, '小さな足場は ゆっくり！', 'SMALL STEPS: SLOW DOWN');   // nothing else on this stretch: it is for braking
  line(103, 107, 1.3);
  ground(113.8, 116.8, 2.0);      // 112–113.8     two small footholds in a row:
  ground(118.6, 121.6, 2.0);      // 116.8–118.6   a jump taken too fast flies past them
  ground(123.4, 136, 2.0);        // 121.6–123.4
  one(109); one(110.6);
  one(115.3); one(120.1);
  arc(111.6, 114.2, 3, 2.0, 1.2); arc(116.4, 119, 3, 2.0, 1.2); arc(121.2, 123.8, 3, 2.0, 1.2);
  sign(122, 'ジャンプ台で 大ジャンプ！', 'SPRINGBOARD = BIG JUMP');
  line(125, 128, 1.5);
  spring(129.6, 130.8);
  // upper road: the springboard throws you onto it
  // (it ends at 144 so that stepping off it comes down on plain ground, well before the blink bridge)
  float(134, 144, 6.0);
  line(135.5, 143, 1.0, 6.0);
  bell(139.5, { base: 6.0, notes: 5 });
  spike(142, 6.0);                // the upper road is not free either
  // lower road: for those who jump over the springboard
  ground(138, 152, 2.0);          // 136–138
  arc(135.4, 138.6, 3, 2.0, 1.0);
  line(140.5, 150.9, 1.3);
  sign(140, '光っている間に わたれ！', 'CROSS WHILE IT IS LIT');
  slow(142, 174, 5.5);            // blink bridges: come up to them gently, ready to stop
  bridge(152, 157, 2.0, 0);
  ground(157, 169, 2.0);          // long enough to stop on if the second bridge is dark
  bridge(169, 174, 2.0, 2.0);
  ground(174, 190, 2.0);          // the second runway
  ground(195.2, 208, 2.0);        // 190–195.2: WIDE hole (5.2 m)
  line(153, 156, 1, 2.0);
  line(158.5, 167.6, 1.3);
  jelly(161, 165, 1);             // between the two bridges
  line(170, 173, 1, 2.0);
  checkpoint(175);
  sign(173.5, 'ダッシュ！ 足ぶみを 止めるな', 'DASH! KEEP STAMPING');
  line(176, 188.6, 1.4);
  arc(189.6, 195.6, 7, 2.0, 1.75);
  line(197, 200, 1.5);
  bell(202.5); bell(204.9);
  dasher(201.5, 206.5, 0);        // waiting where the dash jump comes down
  ground(208, 248, 1.5);

  // ------------------------------------------------------------ ZONE 3  STONE GATE: stop, wait, go
  zone(208, 'STONE GATE', '石の門', 2);
  checkpoint(210, { mid: true });   // half way: in normal mode this is the only checkpoint
  sign(210.5, 'ハンマーの前で 止まれ！', 'STOP FOR THE HAMMER, THEN GO');
  hammer(224, 0); hammer(240, 1.33);            // 16 m apart: room to stop for each one, even from a dash
  one(224.8); one(240.8);                       // one under each hammer, for the brave
  line(212, 221, 1.5);
  line(228, 237, 1.5);
  line(243.5, 245, 1.5);
  arc(247.4, 250.6, 5, 1.5);      // 248–250
  sign(244.5, 'ぎゃく走ベルト！ 足ぶみを 止めるな', 'CONVEYOR: DO NOT STOP STAMPING');
  belt(250, 260, 1.5, -2);
  line(251.5, 259, 1.5);
  spike(255);                     // a jump from a belt that is pulling you back
  ground(260, 288, 1.5);          // a spike, then the third runway
  sign(260.5, 'トゲは ふめない！ とびこえろ', 'SPIKES: JUMP OVER, DO NOT STOMP');
  spike(264.2);
  ground(293.8, 316, 1.5);        // 288–293.8: the widest hole (5.8 m): only a full dash gets across
  checkpoint(271.5);
  sign(271, 'いちばん広い穴！ 全力ダッシュ', 'THE WIDEST GAP: FULL DASH');
  line(273, 286.6, 1.4);
  arc(287.6, 294.2, 8, 1.5, 1.75);
  sign(295, 'ダッシュの あとは ブレーキ！', 'AFTER THE DASH: BRAKE');
  line(296, 304, 1.6);
  hammer(309, 0.7);               // 15 m after the landing: stop stamping as soon as you land
  one(309.8);

  // ------------------------------------------------------------ ZONE 4  FINAL DASH
  zone(316, 'FINAL DASH', 'さいごの ダッシュ', 3);
  ground(316, 366, 1.5);
  checkpoint(317);
  sign(318, '金のブロックで フィーバー！', 'GOLD BLOCK = FEVER');
  bell(323.5, { fever: true, notes: 0 });
  line(326, 364, 1.2);
  jelly(330, 333, 0); spike(342); dasher(351, 355, 1); spike(364.5);
  slope(366, 1.5, 3.0);           // 366–372
  ground(372, 394, 3.0);          // the run-up
  line(366.5, 371.5, 1.25);
  sign(372.5, 'ふみきり板まで 全力ダッシュ！', 'FULL DASH TO THE BOARD, THEN JUMP');
  line(375, 391, 2);
  // the long jump: take off from the board at 394, land as far down the runway as you can
  ground(395.4, 418, 2.0, { finale: true });
  L.finale = { board: 394, pitEnd: 395.4, h: 3.0, landH: 2.0 };
  line(405.5, 408.5, 1);
  L.goal = 409.5;
  L.length = 418;

  L.platforms.sort((p, q) => p.a - q.a);
  L.notes.sort((p, q) => p.s - q.s);
  return L;
}
