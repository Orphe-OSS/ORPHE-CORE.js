/*
 * ジャンプの高さと比べる身近なもの。
 * svg は viewBox "0 0 w 100"（下端 y=100 が地面、上端 y=0 がそのものの一番上）で描いているので、
 * 高さ [cm] に比例して拡大すれば実際の大きさの比率になる。高さはおおよその目安。
 */
(function (root) {
  const OBJECTS = [
    { id: 'can', name: '缶ジュース', cm: 12, w: 56, svg: `
      <rect x="3" y="6" width="50" height="88" rx="5" fill="#e63946"/>
      <rect x="6" y="0" width="44" height="8" rx="3" fill="#b8bec7"/>
      <rect x="6" y="92" width="44" height="8" rx="3" fill="#b8bec7"/>
      <rect x="3" y="38" width="50" height="22" fill="#fff" opacity=".9"/>
      <rect x="11" y="10" width="6" height="80" rx="3" fill="#fff" opacity=".25"/>` },
    { id: 'bottle', name: 'ペットボトル（500ml）', cm: 21, w: 36, svg: `
      <rect x="12" y="0" width="12" height="8" rx="2" fill="#2a9d8f"/>
      <path d="M12 8 H24 L33 21 V26 H3 V21 Z" fill="#cfe8ea"/>
      <rect x="2" y="24" width="32" height="76" rx="6" fill="#bfe3ea"/>
      <rect x="2" y="46" width="32" height="20" fill="#457b9d"/>
      <rect x="7" y="28" width="4" height="66" rx="2" fill="#fff" opacity=".5"/>` },
    { id: 'cat', name: 'おすわりした猫', cm: 30, w: 80, svg: `
      <path d="M64 92 Q84 84 76 60" stroke="#e98c3f" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="40" cy="74" rx="25" ry="26" fill="#f4a261"/>
      <path d="M23 24 L25 0 L39 14 Z M57 24 L55 0 L41 14 Z" fill="#f4a261"/>
      <path d="M27 18 L28 6 L35 13 Z M53 18 L52 6 L45 13 Z" fill="#f7c59f"/>
      <circle cx="40" cy="30" r="19" fill="#f4a261"/>
      <circle cx="33" cy="28" r="2.6" fill="#333"/><circle cx="47" cy="28" r="2.6" fill="#333"/>
      <path d="M37 35 Q40 38 43 35" stroke="#333" stroke-width="1.5" fill="none"/>
      <ellipse cx="31" cy="97" rx="8" ry="4" fill="#f7c59f"/><ellipse cx="49" cy="97" rx="8" ry="4" fill="#f7c59f"/>` },
    { id: 'pin', name: 'ボウリングのピン', cm: 38, w: 36, svg: `
      <path d="M18 0 C26 0 27 10 24 18 C22 24 22 28 25 34 C34 48 34 80 28 100 H8 C2 80 2 48 11 34 C14 28 14 24 12 18 C9 10 10 0 18 0 Z" fill="#fafafa" stroke="#c9ced6" stroke-width="1.2"/>
      <rect x="12.6" y="20" width="10.8" height="2.6" fill="#d62828"/>
      <rect x="12.4" y="24.6" width="11.2" height="2.6" fill="#d62828"/>` },
    { id: 'ext', name: '消火器', cm: 48, w: 44, svg: `
      <path d="M28 14 Q44 30 40 62" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="6" y="22" width="30" height="78" rx="8" fill="#d62828"/>
      <rect x="14" y="10" width="14" height="14" rx="2" fill="#444"/>
      <path d="M18 10 L4 2 M24 9 L40 0" stroke="#333" stroke-width="3" stroke-linecap="round"/>
      <rect x="10" y="48" width="22" height="26" rx="2" fill="#fff"/>
      <rect x="13" y="54" width="16" height="3" fill="#d62828"/><rect x="13" y="61" width="12" height="3" fill="#d62828"/>` },
    { id: 'trash', name: 'ゴミ箱（45L）', cm: 60, w: 70, svg: `
      <rect x="25" y="0" width="20" height="7" rx="3" fill="#495057"/>
      <rect x="0" y="5" width="70" height="10" rx="4" fill="#6c757d"/>
      <path d="M5 15 H65 L60 100 H10 Z" fill="#adb5bd"/>
      <path d="M20 22 L22 92 M35 22 V92 M50 22 L48 92" stroke="#8d969e" stroke-width="3" stroke-linecap="round"/>` },
    { id: 'cone', name: 'カラーコーン', cm: 70, w: 64, svg: `
      <path d="M26 0 H38 L56 92 H8 Z" fill="#f77f00"/>
      <path d="M21.1 25 H42.9 L45.4 38 H18.6 Z M15.2 55 H48.8 L51.3 68 H12.7 Z" fill="#fff"/>
      <rect x="0" y="91" width="64" height="9" rx="2" fill="#d35400"/>` },
    { id: 'drum', name: 'ドラム缶', cm: 89, w: 66, svg: `
      <rect x="2" y="0" width="62" height="100" rx="4" fill="#2563eb"/>
      <rect x="2" y="0" width="62" height="4" fill="#1e3a8a"/><rect x="2" y="96" width="62" height="4" fill="#1e3a8a"/>
      <rect x="2" y="32" width="62" height="4" fill="#1e3a8a"/><rect x="2" y="64" width="62" height="4" fill="#1e3a8a"/>
      <rect x="10" y="6" width="6" height="88" fill="#fff" opacity=".2"/>` },
    { id: 'guitar', name: 'ギター（立てた状態）', cm: 100, w: 40, svg: `
      <rect x="14.5" y="0" width="11" height="11" rx="2" fill="#6b3e1f"/>
      <rect x="17.5" y="10" width="5" height="42" fill="#8b5a2b"/>
      <circle cx="20" cy="60" r="12.5" fill="#d4a373"/><circle cx="20" cy="82" r="17.5" fill="#d4a373"/>
      <circle cx="20" cy="65" r="4.5" fill="#3b2a1a"/>
      <rect x="13" y="85" width="14" height="3" rx="1" fill="#6b3e1f"/>
      <path d="M19 3 V86 M21 3 V86" stroke="#f1f1f1" stroke-width=".5"/>` },
  ];

  const cache = {};
  function objectImage(o) {
    if (!cache[o.id]) {
      cache[o.id] = new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.w} 100" width="${o.w * 4}" height="400">${o.svg}</svg>`);
      });
    }
    return cache[o.id];
  }

  /** 超えたもの（いちばん高いもの）と、次の目標 */
  function compareHeight(cm) {
    let cleared = null, next = null;
    for (const o of OBJECTS) { if (o.cm <= cm) cleared = o; else if (!next) next = o; }
    return { cleared, next };
  }

  Object.assign(root, { OBJECTS, objectImage, compareHeight });
})(typeof window !== 'undefined' ? window : globalThis);
