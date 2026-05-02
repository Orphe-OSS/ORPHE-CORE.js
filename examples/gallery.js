(function () {
  const categoryLabels = {
    'getting-started': 'はじめる',
    'sensor-basics': 'センサー基礎',
    'gait-analysis': 'Gait Analysis',
    'recording-analysis': '記録・解析',
    'playable-app': '遊べるアプリ',
    'creative-coding': 'Creative Coding',
    'research-integration': '研究・連携',
    'workshop-archive': 'ワークショップ',
    'developer-tool': '開発ツール',
    'internal-test': '内部テスト'
  };

  const categoryOrder = [
    'getting-started',
    'sensor-basics',
    'gait-analysis',
    'recording-analysis',
    'playable-app',
    'creative-coding',
    'research-integration',
    'developer-tool',
    'workshop-archive',
    'internal-test'
  ];

  const difficultyLabels = {
    beginner: '初級',
    intermediate: '中級',
    advanced: '上級'
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
      value: '足の動きとGait Analysisを使った代表的なゲームExampleです。'
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
    'game-boxing': {
      title: 'ボクシングゲーム',
      value: 'パンチ動作を使うアクションゲームです。'
    },
    'game-ddr': {
      title: 'DDRゲーム',
      value: '音楽と足の動きを組み合わせたリズムゲームです。'
    },
    dtw: {
      title: 'DTW Example',
      value: '時系列データの類似度を扱う解析Exampleです。'
    },
    'game-fireball-mario': {
      title: 'Fireball Action',
      value: '足の動きで操作するゲームExampleです。'
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
      value: 'ワークショップで使ったフーリエ解析・DFTのExampleです。'
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
      title: 'TMU 2025 Workshop Gallery',
      value: 'ワークショップ参加者による制作例をまとめたページです。'
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

  let allEntries = [];

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
    return difficultyLabels[difficulty] || difficulty;
  }

  function displayTitle(entry) {
    return entryTextJa[entry.id]?.title || entry.title || entry.id;
  }

  function displayValue(entry) {
    return entryTextJa[entry.id]?.value || entry.value || '';
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
      const label = categoryLabels[category] || category;
      return `<option value="${escapeHtml(category)}">${escapeHtml(label)}</option>`;
    }).join(''));

    difficultyFilter.insertAdjacentHTML('beforeend', difficulties.map((difficulty) => (
      `<option value="${escapeHtml(difficulty)}">${escapeHtml(difficultyLabels[difficulty] || difficulty)}</option>`
    )).join(''));
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
      : `<span>サムネイル準備中</span>`;
    const devices = entry.device_count || entry.devices || 1;

    return `
      <a class="card" href="${escapeHtml(demoLink(entry))}">
        <div class="thumb">${thumbnail}</div>
        <div class="card-body">
          <h3>${escapeHtml(displayTitle(entry))}</h3>
          <p>${escapeHtml(displayValue(entry))}</p>
          <div class="meta">
            <span class="pill">${escapeHtml(difficultyLabel(entry))}</span>
            <span class="pill">${devices}台</span>
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

    stats.textContent = `${allEntries.length}件中 ${filtered.length}件を表示`;

    if (!filtered.length) {
      gallery.innerHTML = '<div class="empty">条件に合うExampleがありません。</div>';
      return;
    }

    gallery.innerHTML = [...groups.entries()].map(([category, entries]) => {
      const cards = entries
        .sort((a, b) => sortValue(a, a._index) - sortValue(b, b._index) || displayTitle(a).localeCompare(displayTitle(b)))
        .map(card)
        .join('');
      return `
        <section class="category">
          <h2>${escapeHtml(categoryLabels[category] || category)}</h2>
          <div class="grid">${cards}</div>
        </section>
      `;
    }).join('');
  }

  function setError(error) {
    gallery.innerHTML = `<div class="error">examples/catalog.json を読み込めませんでした: ${escapeHtml(error.message)}</div>`;
  }

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
      render();
    })
    .catch(setError);

  [categoryFilter, difficultyFilter, searchFilter].forEach((control) => {
    control.addEventListener('input', render);
  });
}());
