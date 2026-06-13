(function () {
  const LANGUAGE_STORAGE_KEY = 'orphe-core-js-language';

  const uiText = {
    ja: {
      documentTitle: 'ORPHE-CORE.js Examples | IMUセンサー・歩容解析・Virtual Sports',
      toggle: 'English',
      title: 'ORPHE COREで作れるものを探す。',
      lead: '接続やLED制御から、センサー値の取得、Gait Analysis、記録・解析、ゲーム、クリエイティブ表現まで、目的に合わせてExampleを選べます。',
      category: 'カテゴリー',
      allCategories: 'すべてのカテゴリー',
      difficulty: '難易度',
      allLevels: 'すべてのレベル',
      search: '検索',
      searchPlaceholder: 'タイトル・トピック・データで検索',
      stats: (total, filtered) => `${total}件中 ${filtered}件を表示`,
      empty: '条件に合うExampleがありません。',
      loadError: (message) => `examples/catalog.json を読み込めませんでした: ${message}`,
      thumbnailFallback: 'サムネイル準備中',
      deviceUnit: (count) => `${count}台`
    },
    en: {
      documentTitle: 'ORPHE-CORE.js Examples | IMU Sensor, Gait Analysis, Virtual Sports',
      toggle: '日本語',
      title: 'Find examples by what you want to build.',
      lead: 'Choose an example for your goal, from connection and LED control to sensor values, Gait Analysis, recording, games, and creative coding.',
      category: 'Category',
      allCategories: 'All categories',
      difficulty: 'Difficulty',
      allLevels: 'All levels',
      search: 'Search',
      searchPlaceholder: 'Search title, topic, or data',
      stats: (total, filtered) => `${filtered} of ${total} examples shown`,
      empty: 'No examples match these filters.',
      loadError: (message) => `Could not load examples/catalog.json: ${message}`,
      thumbnailFallback: 'Thumbnail coming soon',
      deviceUnit: (count) => `${count} ${count === 1 ? 'CORE' : 'COREs'}`
    }
  };

  const categoryLabels = {
    ja: {
      'getting-started': 'はじめる',
      'sensor-basics': 'センサー基礎',
      'gait-analysis': 'Gait Analysis',
      'recording-analysis': '記録・解析',
      'virtual-sports': 'Virtual Sports',
      'playable-app': '遊べるアプリ',
      'creative-coding': 'Creative Coding',
      'research-integration': '研究・連携',
      'workshop-archive': 'ワークショップ',
      'developer-tool': '開発ツール',
      'internal-test': '内部テスト'
    },
    en: {
      'getting-started': 'Getting Started',
      'sensor-basics': 'Sensor Basics',
      'gait-analysis': 'Gait Analysis',
      'recording-analysis': 'Recording and Analysis',
      'virtual-sports': 'Virtual Sports',
      'playable-app': 'Playable Apps',
      'creative-coding': 'Creative Coding',
      'research-integration': 'Research and Integrations',
      'workshop-archive': 'Workshops',
      'developer-tool': 'Developer Tools',
      'internal-test': 'Internal Tests'
    }
  };

  const categoryOrder = [
    'getting-started',
    'sensor-basics',
    'gait-analysis',
    'recording-analysis',
    'virtual-sports',
    'playable-app',
    'creative-coding',
    'research-integration',
    'developer-tool',
    'workshop-archive',
    'internal-test'
  ];

  const difficultyLabels = {
    ja: {
      beginner: '初級',
      intermediate: '中級',
      advanced: '上級'
    },
    en: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced'
    }
  };

  const entryTextJa = {
    information: {
      title: 'デバイス情報',
      value: 'ORPHE COREのデバイス情報を確認します。'
    },
    light: {
      title: 'LEDを制御する',
      value: 'ORPHE COREに接続し、LED制御を試す最初のExampleです。'
    },
    'coretoolkit-starter': {
      title: 'CoreToolkit Starter',
      value: 'CoreToolkit.jsで接続UIとセンサーモニターをすばやく立ち上げます。'
    },
    view: {
      title: 'センサービューア',
      value: 'センサー値とGait Analysisの値をブラウザ上で確認します。'
    },
    visualize: {
      title: 'センサー値の可視化',
      value: 'SENSOR_VALUESをシンプルな画面で可視化します。'
    },
    'foot-angle': {
      title: 'Foot Angle Visualizer',
      value: 'Gait Analysisから得られる足角度を可視化します。'
    },
    pronation: {
      title: 'Pronation Visualizer',
      value: 'プロネーションや接地に関わる歩行データを可視化します。'
    },
    airwalker: {
      title: 'Air Walker',
      value: '歩数や動き、アクティビティをダッシュボードで表示します。'
    },
    pose: {
      title: 'Pose + ORPHE CORE',
      value: 'MediaPipe PoseとORPHE COREのデータを組み合わせます。'
    },
    oh1: {
      title: 'OH1 Heart Rate',
      value: '外部BLE心拍センサーとORPHE COREを連携します。'
    },
    'sensor-calibration': {
      title: 'Sensor Calibration',
      value: 'キャリブレーション用にセンサーデータを記録・確認します。'
    },
    'gesture-demo': {
      title: 'Gesture Demo',
      value: 'ORPHE COREのデータからジェスチャー検出を試す起点です。'
    },
    'game-hurdle': {
      title: '110m ハードル走',
      value: 'Gait Analysisと足の動きで走る、Virtual Sportsの代表Exampleです。'
    },
    'game-sprint-100m-vs': {
      title: '100m走 VS',
      value: '2台のORPHE COREで対戦するバーチャル短距離走です。'
    },
    'game-hurdle-400m-vs': {
      title: '400mハードル走 VS',
      value: '2台のORPHE COREで走りとジャンプを競う対戦Exampleです。'
    },
    'game-udon': {
      title: 'うどんふみふみゲーム',
      value: '足踏みでうどんをこねる、わかりやすい身体動作ゲームです。'
    },
    'move-your-feet': {
      title: '足パタパタゲーム',
      value: '足を動かして遊ぶエクササイズ系ゲームです。'
    },
    'game-pingpong': {
      title: 'ピンポンゲーム',
      value: '2人で遊べるシンプルな対戦ゲームです。'
    },
    'drum-test': {
      title: 'ドラムゲーム',
      value: '身体の動きで音を鳴らすサウンドExampleです。'
    },
    'orphe-piano': {
      title: 'Orphe Piano',
      value: 'ORPHE COREの動き、StepSUM、PD由来の音階テーブルで元作品のピアノサンプルを鳴らすWeb版移植です。'
    },
    'game-boxing': {
      title: 'ボクシングゲーム',
      value: 'パンチ動作を使うアクションゲームです。'
    },
    'game-ddr': {
      title: 'DDRゲーム',
      value: '音楽と足の動きを組み合わせたリズムゲームです。'
    },
    'game-mario': {
      title: '2Dアクションゲーム',
      value: '足の動きでキャラクターを操作するアクションゲームです。'
    },
    'game-pk': {
      title: 'PKゲーム',
      value: 'キック動作を使ったゲームExampleです。'
    },
    'game-shooting': {
      title: 'シューティングゲーム',
      value: '身体動作を入力に使うシューティングゲームです。'
    },
    'game-shooting2': {
      title: '3Dシューティングゲーム',
      value: '3D表現と身体動作を組み合わせたゲームExampleです。'
    },
    'workshop-07': {
      title: 'Fourier / DFT Workshop',
      value: 'YouTubeのORPHE CORE WSで扱ったDFT/FFT教材です。'
    },
    'starter-light': {
      title: 'LED Starter',
      value: 'LED制御からORPHE COREの接続を試します。'
    },
    'starter-accelerometer': {
      title: 'Accelerometer Starter',
      value: '加速度データを取得する最小構成です。'
    },
    'starter-gyro': {
      title: 'Gyro Starter',
      value: '角速度データを取得する最小構成です。'
    },
    'starter-quaternion': {
      title: 'Quaternion Starter',
      value: '姿勢推定に使うクォータニオンを取得します。'
    },
    'starter-euler': {
      title: 'Euler Starter',
      value: 'ロール・ピッチ・ヨーの姿勢角を取得します。'
    },
    'starter-steps': {
      title: 'Steps Starter',
      value: '歩数などのGait Analysisデータを取得します。'
    },
    'starter-stride': {
      title: 'Stride Starter',
      value: 'ストライド関連のGait Analysisデータを確認します。'
    },
    'starter-pronation': {
      title: 'Pronation Starter',
      value: 'プロネーション関連のGait Analysisデータを確認します。'
    },
    'starter-analysis-and-sensor-values': {
      title: 'Step Analysis + Sensor Values Starter',
      value: 'STEP_ANALYSISとSENSOR_VALUESを同時に扱う起点です。'
    },
    'guide-p5': {
      title: 'p5.jsではじめる',
      value: 'p5.jsでORPHE COREを使う流れを確認します。'
    },
    'guide-vscode': {
      title: 'VSCodeではじめる',
      value: 'VSCodeとローカルサーバでExampleを動かす手順です。'
    },
    'guide-led': {
      title: 'LED制御ガイド',
      value: 'LEDの制御を通して接続と基本操作を学びます。'
    },
    'guide-coretoolkit': {
      title: 'CoreToolkit.jsガイド',
      value: 'CoreToolkit.jsで接続UIと設定UIを使う手順です。'
    },
    'guide-electron': {
      title: 'Electronガイド',
      value: 'Electronでデスクトップアプリ化する入口です。'
    },
    'ws-tmu2025': {
      title: 'TMU 2025 授業成果ギャラリー',
      value: '東京都立大学での授業・ワークショップ成果を参照できます。'
    },
    'app-orphe-terminal': {
      title: 'ORPHE TERMINAL',
      value: 'ORPHE COREのデータを扱う開発用ツールです。'
    }
  };

  const fallbackCategoryByType = {
    'starter-template': 'sensor-basics',
    guide: 'getting-started',
    workshop: 'workshop-archive',
    tool: 'developer-tool',
    'internal-test': 'internal-test'
  };

  const gallery = document.querySelector('#gallery');
  const stats = document.querySelector('#stats');
  const categoryFilter = document.querySelector('#categoryFilter');
  const difficultyFilter = document.querySelector('#difficultyFilter');
  const searchFilter = document.querySelector('#searchFilter');
  const languageToggle = document.querySelector('#languageToggle');
  const pageTitle = document.querySelector('#pageTitle');
  const pageLead = document.querySelector('#pageLead');
  const categoryLabel = document.querySelector('#categoryLabel');
  const categoryAllOption = document.querySelector('#categoryAllOption');
  const difficultyLabelElement = document.querySelector('#difficultyLabel');
  const difficultyAllOption = document.querySelector('#difficultyAllOption');
  const searchLabel = document.querySelector('#searchLabel');

  let allEntries = [];
  let lang = document.documentElement.dataset.lang || 'ja';

  function normalizeLanguage(value) {
    return value === 'ja' ? 'ja' : 'en';
  }

  function getInitialLanguage() {
    let storedLanguage = '';
    try {
      storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || '';
    } catch (error) {
      storedLanguage = '';
    }
    if (storedLanguage === 'ja' || storedLanguage === 'en') return storedLanguage;
    const browserLanguage = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^ja\b/i.test(browserLanguage) ? 'ja' : 'en';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeLink(value) {
    if (!value) return '#';
    if (/^https?:\/\//.test(value)) return value;
    return value.startsWith('../') ? value : `../${value}`;
  }

  function demoLink(entry) {
    if (entry.links?.demo) return normalizeLink(entry.links.demo);
    if (!entry.path) return '#';
    if (entry.path.endsWith('.html')) return normalizeLink(entry.path);
    return normalizeLink(`${entry.path.replace(/\/?$/, '/')}index.html`);
  }

  function categoryFor(entry) {
    if (entry.category) return entry.category;
    if ((entry.topics || []).includes('game')) return 'playable-app';
    if ((entry.topics || []).includes('gait-analysis')) return 'gait-analysis';
    return fallbackCategoryByType[entry.type] || 'research-integration';
  }

  function difficultyFor(entry) {
    return entry.difficulty || (entry.type === 'starter-template' || entry.type === 'guide' ? 'beginner' : 'intermediate');
  }

  function difficultyLabel(entry) {
    const difficulty = difficultyFor(entry);
    return difficultyLabels[lang][difficulty] || difficulty;
  }

  function displayTitle(entry) {
    if (lang === 'ja') return entryTextJa[entry.id]?.title || entry.title || entry.id;
    return entry.title || entryTextJa[entry.id]?.title || entry.id;
  }

  function displayValue(entry) {
    if (lang === 'ja') return entryTextJa[entry.id]?.value || entry.value || '';
    return entry.value || entryTextJa[entry.id]?.value || '';
  }

  function sortValue(entry, index) {
    return Number.isInteger(entry.sort_order) ? entry.sort_order : 10000 + index;
  }

  function orderIndex(values, value) {
    const index = values.indexOf(value);
    return index === -1 ? values.length : index;
  }

  function isPublicEntry(entry) {
    if (entry.type === 'internal-test') return false;
    if (entry.public_navigation === 'hidden') return false;
    return entry.status === 'public' || entry.status === 'public-candidate';
  }

  function populateFilters(entries) {
    const categories = [...new Set(entries.map(categoryFor))]
      .sort((a, b) => orderIndex(categoryOrder, a) - orderIndex(categoryOrder, b) || a.localeCompare(b));
    const difficultyOrder = ['beginner', 'intermediate', 'advanced'];
    const difficulties = [...new Set(entries.map(difficultyFor))]
      .sort((a, b) => orderIndex(difficultyOrder, a) - orderIndex(difficultyOrder, b) || a.localeCompare(b));

    categoryFilter.insertAdjacentHTML('beforeend', categories.map((category) => {
      const label = categoryLabels[lang][category] || category;
      return `<option value="${escapeHtml(category)}">${escapeHtml(label)}</option>`;
    }).join(''));

    difficultyFilter.insertAdjacentHTML('beforeend', difficulties.map((difficulty) => (
      `<option value="${escapeHtml(difficulty)}">${escapeHtml(difficultyLabels[lang][difficulty] || difficulty)}</option>`
    )).join(''));
  }

  function localizeFilterOptions() {
    [...categoryFilter.options].forEach((option) => {
      option.textContent = option.value ? (categoryLabels[lang][option.value] || option.value) : uiText[lang].allCategories;
    });
    [...difficultyFilter.options].forEach((option) => {
      option.textContent = option.value ? (difficultyLabels[lang][option.value] || option.value) : uiText[lang].allLevels;
    });
  }

  function updateStaticText() {
    const text = uiText[lang];
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.title = text.documentTitle;
    languageToggle.textContent = text.toggle;
    pageTitle.textContent = text.title;
    pageLead.textContent = text.lead;
    categoryLabel.textContent = text.category;
    categoryAllOption.textContent = text.allCategories;
    difficultyLabelElement.textContent = text.difficulty;
    difficultyAllOption.textContent = text.allLevels;
    searchLabel.textContent = text.search;
    searchFilter.placeholder = text.searchPlaceholder;
  }

  function applyLanguage(nextLanguage, options = {}) {
    lang = normalizeLanguage(nextLanguage);
    updateStaticText();
    localizeFilterOptions();
    render();
    if (options.persist) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch (error) {
        // Ignore storage failures in private or restricted browser contexts.
      }
    }
  }

  function applyInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const difficulty = params.get('difficulty');
    const query = params.get('q');

    if (category && [...categoryFilter.options].some((option) => option.value === category)) {
      categoryFilter.value = category;
    }
    if (difficulty && [...difficultyFilter.options].some((option) => option.value === difficulty)) {
      difficultyFilter.value = difficulty;
    }
    if (query) {
      searchFilter.value = query;
    }
  }

  function entryMatches(entry) {
    const category = categoryFilter.value;
    const difficulty = difficultyFilter.value;
    const query = searchFilter.value.trim().toLowerCase();

    if (category && categoryFor(entry) !== category) return false;
    if (difficulty && difficultyFor(entry) !== difficulty) return false;
    if (!query) return true;

    const haystack = [
      displayTitle(entry),
      displayValue(entry),
      entry.title,
      entry.value,
      ...(entry.topics || []),
      ...(entry.data || []),
      ...(entry.audience || [])
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  function card(entry) {
    const thumbnail = entry.thumbnail
      ? `<img src="${escapeHtml(normalizeLink(entry.thumbnail))}" alt="">`
      : `<span>${escapeHtml(uiText[lang].thumbnailFallback)}</span>`;
    const devices = entry.device_count || entry.devices || 1;

    return `
      <a class="card" href="${escapeHtml(demoLink(entry))}">
        <div class="thumb">${thumbnail}</div>
        <div class="card-body">
          <h3>${escapeHtml(displayTitle(entry))}</h3>
          <p>${escapeHtml(displayValue(entry))}</p>
          <div class="meta">
            <span class="pill">${escapeHtml(difficultyLabel(entry))}</span>
            <span class="pill">${escapeHtml(uiText[lang].deviceUnit(devices))}</span>
          </div>
        </div>
      </a>
    `;
  }

  function render() {
    const filtered = allEntries.filter(entryMatches);
    const groups = new Map();

    filtered.forEach((entry) => {
      const category = categoryFor(entry);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(entry);
    });

    stats.textContent = uiText[lang].stats(allEntries.length, filtered.length);

    if (!filtered.length) {
      gallery.innerHTML = `<div class="empty">${escapeHtml(uiText[lang].empty)}</div>`;
      return;
    }

    gallery.innerHTML = [...groups.entries()].map(([category, entries]) => {
      const cards = entries
        .sort((a, b) => sortValue(a, a._index) - sortValue(b, b._index) || displayTitle(a).localeCompare(displayTitle(b)))
        .map(card)
        .join('');
      return `
        <section class="category">
          <h2>${escapeHtml(categoryLabels[lang][category] || category)}</h2>
          <div class="grid">${cards}</div>
        </section>
      `;
    }).join('');
  }

  function setError(error) {
    gallery.innerHTML = `<div class="error">${escapeHtml(uiText[lang].loadError(error.message))}</div>`;
  }

  updateStaticText();

  fetch('catalog.json')
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    })
    .then((catalog) => {
      allEntries = (catalog.entries || [])
        .filter(isPublicEntry)
        .map((entry, index) => ({ ...entry, _index: index }))
        .sort((a, b) => sortValue(a, a._index) - sortValue(b, b._index) || displayTitle(a).localeCompare(displayTitle(b)));
      populateFilters(allEntries);
      applyInitialFilters();
      applyLanguage(getInitialLanguage());
      render();
    })
    .catch(setError);

  [categoryFilter, difficultyFilter, searchFilter].forEach((control) => {
    control.addEventListener('input', render);
  });

  languageToggle.addEventListener('click', () => {
    applyLanguage(lang === 'ja' ? 'en' : 'ja', { persist: true });
  });
}());
