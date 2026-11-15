#!/usr/bin/env node
'use strict';

// Builds the landing page into index.html, ja/index.html and en/index.html.
//
//   node scripts/build-landing.js          write the three files
//   node scripts/build-landing.js --check  exit 1 if a committed file is out of date
//
// The copy lives in scripts/landing/content.js. Every page carries both languages
// (<span class="ja"> / <span class="en">); js/landing.js and the inline script in <head>
// decide which one is shown. The three files differ only in <head> metadata, the forced
// language and the relative path prefix.

const fs = require('fs');
const path = require('path');
const c = require('./landing/content.js');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://orphe-oss.github.io/ORPHE-CORE.js/';
const GH_TREE = `${c.links.github}/tree/main/examples/`;
const GH_STARTER = `${c.links.github}/blob/main/starter-templates/`;
const CDN = `https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js@v${pkg.version}/js/`;

const VARIANTS = [
  { file: 'index.html', prefix: './', lang: 'en', forced: '', url: SITE },
  { file: 'en/index.html', prefix: '../', lang: 'en', forced: 'en', url: `${SITE}en/` },
  { file: 'ja/index.html', prefix: '../', lang: 'ja', forced: 'ja', url: `${SITE}ja/` },
];

const META = {
  en: {
    title: 'ORPHE-CORE.js | JavaScript SDK for Foot-Mounted IMU and Gait Analysis',
    description: 'ORPHE-CORE.js is a JavaScript SDK for ORPHE CORE, a foot-mounted IMU sensor. Build Web Bluetooth apps for gait analysis, motion data, virtual sports, education, and research.',
    ogTitle: 'ORPHE-CORE.js | Foot-Mounted IMU and Gait Analysis JavaScript SDK',
    ogDescription: 'Build Web Bluetooth apps for ORPHE CORE: foot-mounted IMU data, gait analysis, virtual sports, education, and research tools.',
    twitterDescription: 'JavaScript SDK for ORPHE CORE, Web Bluetooth, foot-mounted IMU data, gait analysis, and motion-based web apps.',
    ldDescription: 'ORPHE-CORE.js is a JavaScript SDK for ORPHE CORE, a foot-mounted IMU sensor for gait analysis, motion data, virtual sports, education, and research.',
    locale: 'en_US',
    altLocale: 'ja_JP',
  },
  ja: {
    title: 'ORPHE-CORE.js | 足部IMUセンサー・歩容解析のためのJavaScript SDK',
    description: 'ORPHE-CORE.jsは、足部装着型IMUセンサーORPHE COREをWeb Bluetooth経由で扱うJavaScript SDKです。歩容解析、モーションデータ、Virtual Sports、教育、研究用Webアプリを作れます。',
    ogTitle: 'ORPHE-CORE.js | 足部IMUセンサー・歩容解析のためのJavaScript SDK',
    ogDescription: 'ORPHE COREの足部IMUデータ、歩容解析、Virtual Sports、教育、研究用WebアプリをJavaScriptで作れます。',
    twitterDescription: 'ORPHE CORE、Web Bluetooth、足部IMUデータ、歩容解析、身体動作WebアプリのためのJavaScript SDK。',
    ldDescription: 'ORPHE-CORE.jsは、歩容解析、モーションデータ、Virtual Sports、教育、研究に使える足部装着型IMUセンサーORPHE COREのJavaScript SDKです。',
    locale: 'ja_JP',
    altLocale: 'en_US',
  },
};

const LOGO_PATHS = [
  'M174.7,162H97c-36.22,0-66.44-28.76-67-65A66.07,66.07,0,0,1,96,30h38.35a1,1,0,0,0,.83-1.56L116.59.88A2,2,0,0,0,114.94,0H97.21C44.27,0,.39,42.34,0,95.27A96,96,0,0,0,96,192h98.12a1,1,0,0,0,.83-1.56l-18.59-27.56A2,2,0,0,0,174.7,162Z',
  'M254.79,0H157.88a1,1,0,0,0-.83,1.56l18.59,27.56a2,2,0,0,0,1.66.88H255c36.22,0,66.44,28.76,67,65a66.07,66.07,0,0,1-66,67H217.65a1,1,0,0,0-.83,1.56l18.59,27.56a2,2,0,0,0,1.65.88H256a96,96,0,0,0,96-96.73C351.61,42.34,307.73,0,254.79,0Z',
  'M496,32a64,64,0,1,0,64,64A64,64,0,0,0,496,32Zm0,106.67A42.67,42.67,0,1,1,538.67,96,42.72,42.72,0,0,1,496,138.67Z',
  'M681.08,113.91a1,1,0,0,1,.43-1.47A40,40,0,0,0,705,75.36C704.65,53.4,686.24,36,664.28,36H606a1,1,0,0,0-1,1V155a1,1,0,0,0,1,1h18a1,1,0,0,0,1-1V57a1,1,0,0,1,1-1h38.52c10.84,0,20.08,8.43,20.47,19.27A20,20,0,0,1,665,96H646.88a1,1,0,0,0-.83,1.56l38.83,57.56a2,2,0,0,0,1.65.88h21.06a1,1,0,0,0,.83-1.56Z',
  'M809.21,36H751a1,1,0,0,0-1,1V155a1,1,0,0,0,1,1h18a1,1,0,0,0,1-1V57a1,1,0,0,1,1-1h38.52c10.84,0,20.08,8.43,20.47,19.27A20,20,0,0,1,810,96H786.88a1,1,0,0,0-.83,1.56l11.85,17.56a2,2,0,0,0,1.65.88H810a40,40,0,0,0,40-39.22C850.42,54.36,831.64,36,809.21,36Z',
  'M1052,56h63a1,1,0,0,0,1-1V37a1,1,0,0,0-1-1h-83a1,1,0,0,0-1,1V155a1,1,0,0,0,1,1h83a1,1,0,0,0,1-1V137a1,1,0,0,0-1-1h-63a1,1,0,0,1-1-1V107a1,1,0,0,1,1-1h52.12a1,1,0,0,0,.83-1.56L1093.1,86.88a2,2,0,0,0-1.65-.88H1052a1,1,0,0,1-1-1V57A1,1,0,0,1,1052,56Z',
  'M984,36H966a1,1,0,0,0-1,1V85a1,1,0,0,1-1,1H916.88a1,1,0,0,0-.83,1.56l11.85,17.56a2,2,0,0,0,1.65.88H964a1,1,0,0,1,1,1v48a1,1,0,0,0,1,1h18a1,1,0,0,0,1-1V37A1,1,0,0,0,984,36Z',
];

// Sample acceleration waveform (four walking steps). Illustration only.
const WAVE = {
  z: '0.0,69.6 6.7,67.5 13.3,67.1 20.0,60.2 26.7,22.0 33.3,41.7 40.0,77.0 46.7,78.8 53.3,66.9 60.0,65.5 66.7,65.7 73.3,67.3 80.0,69.8 86.7,72.5 93.3,72.3 100.0,73.9 106.7,75.9 113.3,77.4 120.0,76.7 126.7,76.0 133.3,76.8 140.0,73.5 146.7,74.1 153.3,71.2 160.0,69.1 166.7,67.4 173.3,66.3 180.0,62.0 186.7,21.1 193.3,42.2 200.0,78.4 206.7,78.5 213.3,68.1 220.0,64.6 226.7,65.7 233.3,67.6 240.0,70.4 246.7,71.5 253.3,72.8 260.0,74.8 266.7,75.5 273.3,75.8 280.0,77.2 286.7,76.8 293.3,75.0 300.0,74.8 306.7,73.3 313.3,72.6 320.0,70.6 326.7,67.8 333.3,67.9 340.0,60.3 346.7,21.7 353.3,42.7 360.0,77.3 366.7,78.8 373.3,66.9 380.0,66.0 386.7,67.4 393.3,68.5 400.0,70.9 406.7,71.2 413.3,73.7 420.0,74.8 426.7,75.8 433.3,76.2 440.0,77.3 446.7,77.3 453.3,75.6 460.0,75.0 466.7,72.2 473.3,72.2 480.0,70.4 486.7,69.5 493.3,67.5 500.0,60.7 506.7,21.6 513.3,42.5 520.0,77.0 526.7,78.7 533.3,67.2 540.0,64.7 546.7,65.7 553.3,69.0 560.0,69.1 566.7,71.1 573.3,73.0 580.0,75.5 586.7,74.6 593.3,76.2 600.0,76.6 606.7,77.2 613.3,76.4 620.0,75.5 626.7,72.7 633.3,71.5 640.0,69.7',
  x: '0.0,129.7 6.7,126.1 13.3,121.3 20.0,118.6 26.7,112.6 33.3,110.0 40.0,119.6 46.7,126.9 53.3,130.9 60.0,135.2 66.7,141.3 73.3,146.3 80.0,151.3 86.7,156.1 93.3,158.3 100.0,159.5 106.7,160.0 113.3,159.1 120.0,155.3 126.7,153.9 133.3,149.2 140.0,144.5 146.7,139.2 153.3,133.2 160.0,128.6 166.7,124.0 173.3,122.4 180.0,118.3 186.7,112.2 193.3,109.9 200.0,118.8 206.7,126.3 213.3,130.4 220.0,135.2 226.7,140.7 233.3,145.6 240.0,150.9 246.7,153.9 253.3,158.8 260.0,159.7 266.7,158.9 273.3,158.1 280.0,156.0 286.7,152.6 293.3,147.7 300.0,144.5 306.7,139.7 313.3,133.3 320.0,128.8 326.7,124.0 333.3,121.1 340.0,119.0 346.7,112.6 353.3,111.4 360.0,118.8 366.7,125.6 373.3,132.5 380.0,136.4 386.7,140.7 393.3,146.7 400.0,150.0 406.7,155.1 413.3,159.0 420.0,160.3 426.7,160.2 433.3,158.1 440.0,156.0 446.7,152.1 453.3,149.2 460.0,143.7 466.7,139.2 473.3,133.0 480.0,128.2 486.7,125.7 493.3,123.3 500.0,120.2 506.7,113.9 513.3,111.4 520.0,120.2 526.7,126.1 533.3,131.5 540.0,136.0 546.7,140.4 553.3,145.4 560.0,150.7 566.7,154.5 573.3,158.3 580.0,160.6 586.7,159.6 593.3,159.7 600.0,157.5 606.7,154.0 613.3,148.2 620.0,143.0 626.7,137.8 633.3,132.7 640.0,128.1',
  y: '0.0,196.9 6.7,197.1 13.3,198.8 20.0,202.5 26.7,215.3 33.3,221.1 40.0,213.7 46.7,214.3 53.3,213.0 60.0,208.9 66.7,204.2 73.3,199.3 80.0,195.8 86.7,196.8 93.3,197.6 100.0,202.5 106.7,207.5 113.3,210.4 120.0,213.2 126.7,215.0 133.3,212.6 140.0,207.5 146.7,202.7 153.3,198.5 160.0,197.6 166.7,196.8 173.3,197.1 180.0,203.4 186.7,216.1 193.3,220.7 200.0,214.3 206.7,214.0 213.3,211.1 220.0,207.1 226.7,204.8 233.3,199.7 240.0,196.7 246.7,197.1 253.3,197.8 260.0,202.6 266.7,207.2 273.3,209.9 280.0,212.8 286.7,213.4 293.3,211.4 300.0,208.5 306.7,203.1 313.3,199.2 320.0,195.7 326.7,197.1 333.3,197.6 340.0,202.5 346.7,215.1 353.3,221.3 360.0,214.5 366.7,214.9 373.3,212.0 380.0,208.3 386.7,203.7 393.3,198.2 400.0,196.5 406.7,195.3 413.3,196.8 420.0,202.5 426.7,205.6 433.3,210.6 440.0,213.9 446.7,214.0 453.3,211.6 460.0,208.3 466.7,203.8 473.3,200.0 480.0,195.7 486.7,196.2 493.3,197.4 500.0,202.1 506.7,215.6 513.3,220.4 520.0,214.8 526.7,214.5 533.3,213.0 540.0,208.1 546.7,203.9 553.3,199.4 560.0,196.6 566.7,196.6 573.3,197.9 580.0,201.8 586.7,206.3 593.3,211.7 600.0,213.9 606.7,214.8 613.3,213.1 620.0,207.7 626.7,203.8 633.3,200.4 640.0,197.4',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => String(s).replace(/<br>/g, ' ').replace(/<[^>]+>/g, '');

// Both languages, wrapped so CSS can show one of them.
const L = (text) => (text.ja === text.en
  ? text.ja
  : `<span class="ja" lang="ja">${text.ja}</span><span class="en" lang="en">${text.en}</span>`);

const ICON = {
  arrow: '<svg class="lp-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  out: '<svg class="lp-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>',
  play: '<svg class="lp-icon lp-icon-fill" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
};

const logo = (cls) => `<svg class="${cls}" viewBox="0 0 1116 192" role="img" aria-label="ORPHE">${LOGO_PATHS.map((d) => `<path d="${d}"/>`).join('')}<rect x="885" y="36" width="20" height="120" rx="1"/></svg>`;
const gc = (id, title) => (id ? ` data-goatcounter-click="${id}"${title ? ` data-goatcounter-title="${esc(title)}"` : ''}` : '');
const ext = (href) => (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '');

function build(v) {
  const meta = META[v.lang];
  const local = (p) => v.prefix + encodeURI(p);
  const alt = (text) => esc(text[v.lang]);
  const href = (item) => (item.local ? local(item.local) : item.href);

  const sectionHead = (o, extra = '') => `
      <div class="lp-head">
        <p class="lp-eyebrow">${esc(o.eyebrow)}</p>
        <h2>${L(o.title)}</h2>${o.lead ? `
        <p class="lp-lead">${L(o.lead)}</p>` : ''}${extra}
      </div>`;

  const chips = (label, list) => `
      <div class="lp-chips">
        <span class="lp-chips-label">${esc(label)}</span>
        ${list.map(([name, url]) => `<a class="lp-chip" href="${url}" target="_blank" rel="noopener">${esc(name)}</a>`).join('\n        ')}`;

  const groupHead = (g) => `
      <div class="lp-group-head" id="${g.id}">${(g.aliases || []).map((id) => `<span class="lp-anchor" id="${id}"></span>`).join('')}
        <h3>${esc(g.heading)}</h3>
        <p>${L(g.lead)}</p>
      </div>`;

  const exampleCard = (e, size) => {
    const demo = local(`examples/${e.dir}/`);
    const name = plain(e.name.en);
    return `
        <article class="lp-card lp-card-${size}">
          <a class="lp-card-media" href="${demo}" target="_blank"${gc(e.gc, e.gc ? `Example: ${name}` : '')}><img src="${local(e.img)}" alt="${esc(name)}" loading="lazy"></a>
          <p class="lp-tag">${esc(e.tag)}</p>
          <h4>${L(e.name)}</h4>
          <p class="lp-card-desc">${L(e.desc)}</p>
          <p class="lp-card-links">
            <a class="lp-pill" href="${demo}" target="_blank">${c.examples.demo}</a>${e.noSource ? '' : `
            <a class="lp-textlink" href="${GH_TREE}${encodeURI(e.dir)}" target="_blank" rel="noopener">${c.examples.source}</a>`}${e.p5 ? `
            <a class="lp-textlink" href="${e.p5}" target="_blank" rel="noopener">${c.examples.p5}</a>` : ''}
          </p>
        </article>`;
  };

  const starterCard = ([file, thumb, name, desc, p5, hasSource]) => `
        <article class="lp-card lp-card-s">
          <a class="lp-card-media" href="${local(`starter-templates/${file}`)}" target="_blank"><img src="${local(`examples/_thumbnails/${thumb}`)}" alt="${esc(name)} starter" loading="lazy"></a>
          <h4 class="lp-mono">${esc(name)}</h4>
          <p class="lp-card-desc">${L(desc)}</p>
          <p class="lp-card-links">
            <a class="lp-pill" href="${local(`starter-templates/${file}`)}" target="_blank">${c.examples.demo}</a>${hasSource ? `
            <a class="lp-textlink" href="${GH_STARTER}${file}" target="_blank" rel="noopener">${c.examples.source}</a>` : ''}
            <a class="lp-textlink" href="https://editor.p5js.org/tetsuakibaba/sketches/${p5}" target="_blank" rel="noopener">${c.examples.p5}</a>
          </p>
        </article>`;

  const yt = (id) => `https://www.youtube.com/watch?v=${id}&amp;list=${c.workshop.ytList}`;
  const ytThumb = (id, size) => `https://i.ytimg.com/vi/${id}/${size}.jpg`;
  const [firstEp] = c.workshop.episodes;
  const hurdle = local('examples/GAME-SUPER-HURDLE/');
  const cdnLine = (file) => `&lt;script src="${CDN}${file}" crossorigin="anonymous" type="text/javascript"&gt;&lt;/script&gt;`;
  const tech = c.examples.technical;

  return `<!doctype html>
<html lang="${v.lang}"${v.forced ? ` data-preferred-language="${v.forced}"` : ''}>
<!-- Generated by scripts/build-landing.js from scripts/landing/content.js. Do not edit by hand. -->

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(meta.title)}</title>
  <meta name="description"
    content="${esc(meta.description)}">
  <link rel="canonical" href="${v.url}">
  <link rel="alternate" hreflang="x-default" href="${SITE}">
  <link rel="alternate" hreflang="en" href="${SITE}en/">
  <link rel="alternate" hreflang="ja" href="${SITE}ja/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ORPHE-CORE.js">
  <meta property="og:title" content="${esc(meta.ogTitle)}">
  <meta property="og:description"
    content="${esc(meta.ogDescription)}">
  <meta property="og:url" content="${v.url}">
  <meta property="og:image" content="${SITE}images/ORPHE_TRACK_scene_03.jpg">
  <meta property="og:locale" content="${meta.locale}">
  <meta property="og:locale:alternate" content="${meta.altLocale}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.ogTitle)}">
  <meta name="twitter:description"
    content="${esc(meta.twitterDescription)}">
  <meta name="twitter:image" content="${SITE}images/ORPHE_TRACK_scene_03.jpg">
  <script>
    (function () {
      var storageKey = 'orphe-core-js-language';
      var forced = document.documentElement.dataset.preferredLanguage || '';
      var preferred = '';
      try {
        preferred = localStorage.getItem(storageKey) || '';
      } catch (error) {
        preferred = '';
      }
      if (forced === 'ja' || forced === 'en') preferred = forced;
      if (preferred !== 'ja' && preferred !== 'en') {
        var browser = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
        preferred = /^ja\\b/i.test(browser) ? 'ja' : 'en';
      }
      document.documentElement.lang = preferred;
      document.documentElement.dataset.lang = preferred;
    })();
  </script>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "name": "ORPHE-CORE.js",
      "alternateName": "ORPHE CORE JavaScript SDK",
      "url": "${v.url}",
      "codeRepository": "https://github.com/Orphe-OSS/ORPHE-CORE.js",
      "programmingLanguage": "JavaScript",
      "runtimePlatform": "Web Bluetooth API",
      "applicationCategory": "DeveloperApplication",
      "keywords": "ORPHE CORE, foot-mounted IMU, gait analysis, Web Bluetooth, JavaScript SDK, wearable sensor, smart footwear, motion sensor",
      "description": "${meta.ldDescription}",
      "publisher": {
        "@type": "Organization",
        "name": "ORPHE Inc.",
        "url": "https://orphe.io/"
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=JetBrains+Mono:wght@400;700&amp;family=Noto+Sans+JP:wght@400;500;700;900&amp;display=swap" rel="stylesheet">
  <link href="${v.prefix}css/landing.css" rel="stylesheet">
  <script src="${v.prefix}js/site-analytics.js"></script>
</head>

<body>
  <header class="lp-nav">
    <a class="lp-brand" href="${c.links.orphe}" aria-label="ORPHE">${logo('lp-logo')}<span>CORE.JS</span></a>
    <nav aria-label="Main">
      <a href="#start-in-3-minutes">${L(c.nav.quickstart)}</a>
      <a href="#what-you-can-build">${L(c.nav.examples)}</a>
      <a href="#workshop">${L(c.nav.workshop)}</a>
      <a href="${local('api_doc/')}" target="_blank">${L(c.nav.api)}</a>
      <a href="${c.links.github}" target="_blank" rel="noopener">${L(c.nav.github)}</a>
    </nav>
    <div class="lp-nav-side">
      <button class="lp-lang" type="button" data-lang-toggle aria-label="${alt(c.nav.langToggle)}">JA / EN</button>
      <a class="lp-btn lp-btn-ghost lp-btn-s" href="${c.links.shop}" target="_blank" rel="noopener">${L(c.nav.buy)}</a>
    </div>
  </header>

  <main>
    <section class="lp-hero" aria-labelledby="landing-title">
      <div class="lp-hero-copy">
        <p class="lp-eyebrow">${L(c.hero.eyebrow)}</p>
        <h1 id="landing-title">${L(c.hero.title)}</h1>
        <p class="lp-hero-lead">${L(c.hero.lead)}</p>
        <p class="lp-hero-tags">${c.hero.tags.map((tag) => `<span>${tag}</span>`).join('')}</p>
        <p class="lp-actions">
          <a class="lp-btn lp-btn-primary lp-btn-l" href="#start-in-3-minutes"${gc('click-hero-quickstart', 'Hero: Start in 3 minutes')}>${L(c.hero.ctaStart)}${ICON.arrow}</a>
          <a class="lp-btn lp-btn-ghost lp-btn-l" href="#how-it-works"${gc('click-hero-examples', 'Hero: See what it can do')}>${L(c.hero.ctaMore)}</a>
        </p>
        <p class="lp-hero-meta">${L(c.hero.meta)} · v${pkg.version}</p>
      </div>
      <a class="lp-hero-media" href="${hurdle}" target="_blank"${gc('click-hero-play-super-hurdle', 'Hero: Play SUPER VIRTUAL HURDLE')}>
        <img src="${local('examples/_thumbnails/super-hurdle.png')}" alt="${alt(c.hero.imageAlt)}">
        <span class="lp-hero-play">
          <span class="lp-play-btn" aria-hidden="true">${ICON.play}</span>
          <span class="lp-hero-play-text"><span class="lp-badge">${c.hero.playBadge}</span><strong>${L(c.hero.playCta)}</strong></span>
        </span>
      </a>
      <p class="lp-hero-note">${L(c.hero.playNote)}</p>
    </section>

    <section class="lp-toplinks" aria-label="Important links">
      ${c.topLinks.map((item) => `<a href="${href(item)}"${ext(href(item))}${item.key === 'api' ? ' target="_blank"' : ''}${gc(item.gc, item.gcTitle)}>
        <span><small>${item.label}</small><strong>${item.name}</strong></span>${item.play ? ICON.play : ICON.out}
      </a>`).join('\n      ')}
    </section>

    <section class="lp-stats" aria-label="Key facts">
      ${c.stats.map((s) => `<div><p class="lp-stat-num">${s.num}<span>${s.unit}</span></p><p class="lp-stat-text">${L(s.text)}</p></div>`).join('\n      ')}
    </section>

    <section class="lp-section" id="core-specs">${sectionHead(c.hardware)}
      <div class="lp-plate">
        <figure class="lp-device">
          <div class="lp-device-row">
            <div class="lp-device-photo"><img src="${local('images/product/orphe-core-3-front.jpg')}" alt="${alt(c.hardware.imageAlt)}"></div>
            <span class="lp-dim lp-dim-v" aria-hidden="true"></span>
            <span class="lp-dim-label">45 mm</span>
          </div>
          <span class="lp-dim lp-dim-h" aria-hidden="true"></span>
          <figcaption class="lp-dim-label">29 mm</figcaption>
        </figure>
        <div class="lp-specs">
          <p class="lp-specs-title">ORPHE CORE 3.0</p>
          <dl>
            ${c.hardware.specs.map(([k, val, mono]) => `<div><dt>${L(k)}</dt><dd${mono ? ' class="lp-mono"' : ''}>${L(val)}</dd></div>`).join('\n            ')}
          </dl>
        </div>
      </div>
      <p class="lp-linkrow">
        <a href="${c.links.shop}" target="_blank" rel="noopener"${gc('click-link-buy-core', 'Hardware: Buy ORPHE CORE 3.0')}>${L(c.hardware.buy)}</a>
        <a href="${c.links.product}" target="_blank" rel="noopener">${L(c.hardware.product)}</a>
      </p>
      <div class="lp-split" id="shoelace-mount">
        <img class="lp-photo" src="${local('images/shoelace-mount-on-shoe.webp')}" alt="${alt(c.hardware.mount.imageAlt)}" loading="lazy">
        <div class="lp-split-copy">
          <p class="lp-eyebrow">${c.hardware.mount.eyebrow}</p>
          <h3>${L(c.hardware.mount.title)}</h3>
          <p class="lp-lead">${L(c.hardware.mount.body)}</p>
          <p class="lp-linkrow">
            <a href="${local('docs/shoelace-mount-guide.html')}"${gc('click-shoelace-mount-guide', 'Shoelace mount: Detailed guide')}>${L(c.hardware.mount.guide)}</a>
            <a href="${c.links.mountStore}" target="_blank" rel="noopener"${gc('click-shoelace-mount-store', 'Shoelace mount: Store')}>${L(c.hardware.mount.store)}</a>
          </p>
        </div>
      </div>
    </section>

    <section class="lp-section" id="how-it-works">${sectionHead(c.how)}
      <div class="lp-pair">
        <div class="lp-panel">
          <p class="lp-panel-bar"><strong>${L(c.how.codeTitle)}</strong><span>JavaScript</span></p>
          <pre class="lp-code"><code><span class="k">const</span> core = <span class="k">new</span> Orphe(0);
core.setup();

<span class="c">${L(c.how.codeComment)}</span>
core.gotConvertedAcc = <span class="k">function</span> (acc) {
  drawWave(acc.x, acc.y, acc.z);
};

<span class="k">await</span> core.begin(<span class="s">'SENSOR_VALUES'</span>);</code></pre>
        </div>
        <figure class="lp-panel">
          <p class="lp-panel-bar"><strong>${L(c.how.waveTitle)}</strong><span>gotConvertedAcc(acc) · G</span></p>
          <svg class="lp-wave" viewBox="0 0 640 250" role="img" aria-label="${alt(c.how.waveAlt)}">
            <g class="lp-wave-grid"><line x1="0" y1="70" x2="640" y2="70"/><line x1="0" y1="140" x2="640" y2="140"/><line x1="0" y1="205" x2="640" y2="205"/></g>
            <g class="lp-wave-strike">${[26.7, 186.7, 346.7, 506.7].map((x) => `<line x1="${x}" y1="22" x2="${x}" y2="238"/><text x="${x + 6}" y="16">${esc(c.how.strike[v.lang])}</text>`).join('')}</g>
            <polyline class="lp-wave-z" points="${WAVE.z}"/>
            <polyline class="lp-wave-x" points="${WAVE.x}"/>
            <polyline class="lp-wave-y" points="${WAVE.y}"/>
            <text class="lp-wave-label lp-wave-lz" x="632" y="56">acc.z</text>
            <text class="lp-wave-label lp-wave-lx" x="632" y="106">acc.x</text>
            <text class="lp-wave-label lp-wave-ly" x="632" y="186">acc.y</text>
          </svg>
          <figcaption>${L(c.how.waveCaption)}</figcaption>
        </figure>
      </div>
      <div class="lp-points">
        ${c.how.points.map((p) => `<div><p class="lp-tag">${p.label}</p><h3>${L(p.title)}</h3><p>${L(p.body)}</p></div>`).join('\n        ')}
      </div>
    </section>

    <section class="lp-section" id="data-you-can-get">${sectionHead(c.data)}
      <div class="lp-table-wrap">
        <table class="lp-table">
          <thead><tr>${c.data.head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${c.data.rows.map(([cat, values, fn, type]) => `<tr><th scope="row">${cat ? L(cat) : ''}</th><td>${L(values)}</td><td class="lp-mono">${fn}</td><td class="lp-mono ${type === 'SENSOR_VALUES' ? 'lp-t-sensor' : type ? 'lp-t-step' : 'lp-t-any'}">${type || L(c.data.anytime)}</td></tr>`).join('\n            ')}
          </tbody>
        </table>
      </div>
      <p class="lp-note">${L(c.data.note)}</p>
    </section>

    <section class="lp-section" id="start-in-3-minutes">
      <div class="lp-pair lp-pair-top">
        <div class="lp-head">
          <p class="lp-eyebrow">${c.quickstart.eyebrow}</p>
          <h2>${L(c.quickstart.title)}</h2>
          <ol class="lp-steps">
            ${c.quickstart.steps.map(([title, body], i) => `<li><span class="lp-step-num">${i + 1}</span><div><strong>${L(title)}</strong><p>${L(body)}</p></div></li>`).join('\n            ')}
          </ol>
          <p class="lp-actions">
            <a class="lp-btn lp-btn-primary" href="${local('docs/getting-started-p5.html')}"${gc('click-guide-p5', 'Guide: p5.js starter')}>${L(c.quickstart.p5)}</a>
            <a class="lp-btn lp-btn-ghost" href="${local('docs/getting-started-vscode.html')}"${gc('click-guide-vscode', 'Guide: VSCode')}>${L(c.quickstart.vscode)}</a>
            <a class="lp-btn lp-btn-ghost" href="${local('docs/getting-started-led.html')}"${gc('click-guide-led', 'Guide: LED control')}>${L(c.quickstart.led)}</a>
          </p>
        </div>
        <div class="lp-panel">
          <p class="lp-panel-bar"><strong>index.html</strong><button class="lp-copy" type="button" data-copy-target="lp-quickstart-code">${c.quickstart.copy}</button></p>
          <pre class="lp-code" id="lp-quickstart-code"><code>&lt;<span class="k">button</span> onclick=<span class="s">"connectOrphe()"</span>&gt;Connect ORPHE&lt;/<span class="k">button</span>&gt;
&lt;<span class="k">script</span> src=<span class="s">"${CDN}ORPHE-CORE.js"</span>&gt;&lt;/<span class="k">script</span>&gt;
&lt;<span class="k">script</span>&gt;
  <span class="k">var</span> core = <span class="k">new</span> Orphe(0);
  window.onload = <span class="k">function</span> () {
    core.setup();
  };
  <span class="k">async function</span> connectOrphe() {
    <span class="k">await</span> core.begin(<span class="s">'STEP_ANALYSIS_AND_SENSOR_VALUES'</span>);
    core.setLED(1, 0);
  }
&lt;/<span class="k">script</span>&gt;</code></pre>
        </div>
      </div>
      <div class="lp-pair lp-pair-gap">
        <div class="lp-panel lp-panel-pad">
          <p class="lp-tag">${c.quickstart.cdnLabel}</p>
          <p class="lp-cdn-name">ORPHE-CORE.js</p>
          <p class="lp-cdn"><code id="lp-cdn-core">${cdnLine('ORPHE-CORE.js')}</code><button class="lp-copy" type="button" data-copy-target="lp-cdn-core">${c.quickstart.copy}</button></p>
          <p class="lp-cdn-name">CoreToolkit.js <small>${L(c.quickstart.toolkitNote)}</small></p>
          <p class="lp-cdn"><code id="lp-cdn-toolkit">${cdnLine('CoreToolkit.js')}</code><button class="lp-copy" type="button" data-copy-target="lp-cdn-toolkit">${c.quickstart.copy}</button></p>
        </div>
        <div class="lp-panel lp-panel-pad lp-led">
          <img src="${local('images/led_blinking.gif')}" alt="${alt(c.quickstart.ledAlt)}" loading="lazy">
          <div>
            <p class="lp-tag">${c.quickstart.firstCheck}</p>
            <h3>${L(c.quickstart.ledTitle)}</h3>
            <p>${L(c.quickstart.ledBody)}</p>
            <p class="lp-linkrow"><a href="${local('docs/getting-started-led.html')}"${gc('click-guide-led', 'Guide: LED control')}>${L(c.quickstart.led)}${ICON.arrow}</a></p>
          </div>
        </div>
      </div>
    </section>

    <section class="lp-section" id="start-building">${sectionHead(c.lanes)}
      <div class="lp-lanes">
        ${c.lanes.list.map((lane, i) => `<div class="lp-lane">
          <div class="lp-lane-head"><span class="lp-lane-num">${i + 1}</span><div><h3>${L(lane.title)}</h3><p>${L(lane.sub)}</p></div></div>
          ${lane.items.map((item) => `<a href="${href(item)}"${gc(item.gc, `Start building: ${item.name}`)}><span><strong>${item.name}</strong><span class="lp-lane-desc">${L(item.body)}</span></span>${ICON.arrow}</a>`).join('\n          ')}
        </div>`).join('\n        ')}
      </div>
    </section>

    <section class="lp-section" id="who-its-for">${sectionHead(c.audience)}
      <div class="lp-audience">
        ${c.audience.cards.map((card) => `<div class="lp-panel lp-panel-pad"><p class="lp-tag">${card.label}</p><h3>${L(card.title)}</h3><p>${L(card.body)}</p></div>`).join('\n        ')}
      </div>
    </section>

    <section class="lp-section" id="examples-top">
      <div class="lp-head-row">${sectionHead(c.examples)}
        <a class="lp-more" href="${local('examples/')}"${gc('click-examples-catalog', 'Examples: catalog')}>${L(c.examples.all)}${ICON.arrow}</a>
      </div>
${groupHead(c.examples.play)}
      <div class="lp-grid lp-grid-l">${c.examples.play.items.map((e) => exampleCard(e, 'l')).join('')}
      </div>${chips(c.examples.play.sketchLabel, c.examples.play.sketches)}
        <a class="lp-chips-more" href="${local('examples/')}?category=virtual-sports">${L(c.examples.play.category)}</a>
      </div>
${groupHead(c.examples.apps)}
      <div class="lp-grid lp-grid-m">${c.examples.apps.items.map((e) => exampleCard(e, 'm')).join('')}
      </div>
${groupHead(c.examples.starters)}
      <div class="lp-grid lp-grid-s">${c.examples.starters.items.map(starterCard).join('')}
      </div>${chips(c.examples.starters.recipeLabel, c.examples.starters.recipes)}
      </div>
${groupHead(tech)}
      <div class="lp-split">
        <a class="lp-card-media" href="${local(`examples/${tech.dir}/`)}" target="_blank"><img src="${local(tech.img)}" alt="${tech.name}" loading="lazy"></a>
        <div class="lp-split-copy">
          <p class="lp-tag">${tech.tag}</p>
          <h4 class="lp-h-l">${tech.name}</h4>
          <p class="lp-lead">${L(tech.body)}</p>
          <p class="lp-card-links">
            <a class="lp-pill" href="${local(`examples/${tech.dir}/`)}" target="_blank">${c.examples.demo}</a>
            <a class="lp-textlink" href="${GH_TREE}${tech.dir}" target="_blank" rel="noopener">${c.examples.source}</a>
          </p>${chips(tech.sketchLabel, tech.sketches)}
          </div>
        </div>
      </div>
    </section>

    <section class="lp-band" id="workshop">
      <div class="lp-section lp-section-flush">${sectionHead(c.workshop)}
        <div class="lp-theater">
          <div class="lp-theater-main">
            <a class="lp-player" href="${yt(firstEp[0])}" target="_blank" rel="noopener"${gc('click-workshop-featured', 'Workshop: Episode 1')}>
              <img src="${ytThumb(firstEp[0], 'maxresdefault')}" alt="" loading="lazy">
              <span class="lp-player-badges"><span class="lp-badge">${c.workshop.startHere}</span><span class="lp-badge lp-badge-dark">${firstEp[1]} · ${firstEp[2]}</span></span>
              <span class="lp-play-btn lp-play-btn-l" aria-hidden="true">${ICON.play}</span>
              <span class="lp-player-title"><strong>${L(firstEp[3])}</strong><span>${L(c.workshop.featuredNote)}</span></span>
            </a>
            <div class="lp-theater-foot">
              <p class="lp-cast">${L(c.workshop.cast)}</p>
              <a class="lp-btn lp-btn-primary" href="${c.links.playlist}" target="_blank" rel="noopener"${gc('click-workshop-playlist', 'Workshop: YouTube playlist')}>${ICON.play}${L(c.workshop.playlistCta)}</a>
            </div>
          </div>
          <div class="lp-playlist">
            <p class="lp-playlist-head"><span>${c.workshop.playlistHead}</span><span>${L(c.workshop.playlistMeta)}</span></p>
            ${c.workshop.episodes.map(([id, no, len, title]) => `<a href="${yt(id)}" target="_blank" rel="noopener"><img src="${ytThumb(id, 'mqdefault')}" alt="" loading="lazy"><span><small>${no} · ${len}</small><strong>${L(title)}</strong></span>${ICON.play}</a>`).join('\n            ')}
          </div>
        </div>
        <div class="lp-grid lp-grid-l lp-grid-top">
          <article class="lp-card lp-card-l">
            <a class="lp-card-media" href="${local('examples/WORKSHOP_07/')}" target="_blank"><img src="${local('examples/_thumbnails/workshop-07.png')}" alt="${alt(c.workshop.cards.material.alt)}" loading="lazy"></a>
            <p class="lp-tag">${c.workshop.cards.material.tag}</p>
            <h4>${c.workshop.cards.material.title}</h4>
            <p class="lp-card-desc">${L(c.workshop.cards.material.body)}</p>
            <p class="lp-card-links"><a class="lp-pill" href="${local('examples/WORKSHOP_07/')}" target="_blank">MATERIAL</a><a class="lp-textlink" href="${c.links.playlist}" target="_blank" rel="noopener">YOUTUBE</a></p>
          </article>
          <article class="lp-card lp-card-l">
            <a class="lp-card-media lp-card-media-tmu" href="${local('ws/tmu2025/')}" target="_blank"><img src="${local('examples/_thumbnails/ws-tmu2025.png')}" alt="${alt(c.workshop.cards.gallery.alt)}" loading="lazy"></a>
            <p class="lp-tag">${c.workshop.cards.gallery.tag}</p>
            <h4>${c.workshop.cards.gallery.title}</h4>
            <p class="lp-card-desc">${L(c.workshop.cards.gallery.body)}</p>
            <p class="lp-card-links"><a class="lp-pill" href="${local('ws/tmu2025/')}" target="_blank">GALLERY</a></p>
          </article>
          <article class="lp-card lp-card-l">
            <a class="lp-card-media lp-card-media-type" href="${c.links.tutorial}" target="_blank" aria-label="${c.workshop.cards.tutorial.title}"><span class="lp-type-big">STEP<br>BY STEP</span><span class="lp-mono">01 → 02 → 03 → …</span></a>
            <p class="lp-tag">${c.workshop.cards.tutorial.tag}</p>
            <h4>${c.workshop.cards.tutorial.title}</h4>
            <p class="lp-card-desc">${L(c.workshop.cards.tutorial.body)}</p>
            <p class="lp-card-links"><a class="lp-pill" href="${c.links.tutorial}" target="_blank">TUTORIAL</a></p>
          </article>
        </div>
      </div>
    </section>

    <section class="lp-section" id="api">
      <div class="lp-pair lp-pair-center">${sectionHead(c.api, `
        <p class="lp-actions"><a class="lp-btn lp-btn-ghost" href="${local('api_doc/')}" target="_blank"${gc('click-link-api-reference', 'API: API Reference')}>${c.api.cta}${ICON.out}</a></p>`)}
        <div class="lp-panel">
          <p class="lp-panel-bar"><strong>class Orphe</strong><span>${L(c.api.panelNote)}</span></p>
          <pre class="lp-code lp-code-loose"><code><span class="k">new</span> Orphe(id) <span class="c">${L(c.api.idComment)}</span>
.setup(names, options)
.begin(notification_type, options)
.stop()
.setLED(on_off, pattern)
.setMountPosition(position)
.resetMotionSensorAttitude()
.getDeviceInformation()</code></pre>
        </div>
      </div>
    </section>

    <section class="lp-closing">
      <p class="lp-eyebrow">${c.closing.eyebrow}</p>
      <h2>${L(c.closing.title)}</h2>
      <a class="lp-btn lp-btn-primary lp-btn-l" href="#start-in-3-minutes"${gc('click-closing-quickstart', 'Closing: Start in 3 minutes')}>${L(c.hero.ctaStart)}${ICON.arrow}</a>
      <p class="lp-note">${L(c.closing.compat)}</p>
    </section>
  </main>

  <footer class="lp-footer">
    ${logo('lp-logo lp-logo-s')}
    <nav aria-label="Footer">
      <a href="${c.links.github}" target="_blank" rel="noopener">GitHub</a>
      <a href="${local('api_doc/')}" target="_blank">API Reference</a>
      <a href="${c.links.shop}" target="_blank" rel="noopener">Buy ORPHE CORE 3.0</a>
      <a href="#workshop">Workshop Materials</a>
      <a href="${c.links.tutorial}" target="_blank">Tutorial</a>
      <a href="${c.links.insole}" target="_blank" rel="noopener">ORPHE INSOLE SDK</a>
      <a href="${c.links.orphe}" target="_blank" rel="noopener">orphe.io</a>
    </nav>
    <p>&copy; 2022 Tetsuaki BABA</p>
  </footer>

  <script src="${v.prefix}js/landing.js"></script>
</body>

</html>
`;
}

function main() {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const v of VARIANTS) {
    const file = path.join(ROOT, v.file);
    const html = build(v);
    if (check) {
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (current !== html) {
        stale += 1;
        console.error(`out of date: ${v.file} (run: npm run build:landing)`);
      }
    } else {
      fs.writeFileSync(file, html);
      console.log(`wrote ${v.file}`);
    }
  }
  if (stale) process.exit(1);
  if (check) console.log('landing pages are up to date');
}

main();
