'use strict';

// Copy and data for the landing page (index.html, ja/index.html, en/index.html).
//
// このファイルが LP の文章の「原本」です。文言を直すときはここだけを編集し、
// `npm run build:landing` で 3 つの HTML を作り直してください（HTML を直接編集しない）。
// t('日本語', 'English') の形で、日本語と英語を必ず対で書きます。
// 文中で使えるのは <br> と <code> だけです。

const t = (ja, en) => ({ ja, en });

const YT_LIST = 'PLP_ql9XSx6s2Dex83_jkLLz28Mw2X9P_2';
const P5 = 'https://editor.p5js.org/tetsuakibaba/sketches/';
const P5K = 'https://editor.p5js.org/kikukawayuya/sketches/';
const GH = 'https://github.com/Orphe-OSS/ORPHE-CORE.js';

const links = {
  github: GH,
  shop: 'https://shop.orphe.io/products/orphe-core-3-0',
  product: 'https://orphe.io/core',
  mountStore: 'https://shop.orphe.io/products/orphe-core-shoelace-mount?variant=41745003511987',
  insole: 'https://orphe-oss.github.io/ORPHE-INSOLE.js/',
  orphe: 'https://orphe.io/',
  tutorial: 'https://orphe-oss.github.io/ORPHE-CORE.js/tutorial',
  bluefy: 'https://apps.apple.com/jp/app/bluefy-web-ble-browser/id1492822055',
  playlist: `https://www.youtube.com/playlist?list=${YT_LIST}`,
};

const nav = {
  quickstart: t('Quick start', 'Quick start'),
  examples: t('Examples', 'Examples'),
  workshop: t('Workshop Materials', 'Workshop Materials'),
  api: t('API Reference', 'API Reference'),
  github: t('GitHub', 'GitHub'),
  buy: t('Buy ORPHE CORE 3.0', 'Buy ORPHE CORE 3.0'),
  langToggle: t('言語を切り替える', 'Switch language'),
};

const hero = {
  eyebrow: t('JAVASCRIPT LIBRARY FOR ORPHE CORE', 'JAVASCRIPT LIBRARY FOR ORPHE CORE'),
  title: t('足の動きを、<br>コードにつなぐ。', 'Connect foot motion<br>to your code.'),
  lead: t(
    'ORPHE CORE.js は、靴につけるモーションセンサ ORPHE CORE を、ブラウザの JavaScript から扱うためのライブラリです。センサ値と歩容データを受け取り、LED を制御して、ゲーム、ビジュアル、サウンド、研究用ツールまでブラウザだけで試作できます。',
    'ORPHE CORE.js is a library for using ORPHE CORE, a motion sensor worn on the shoe, from JavaScript in the browser. Read sensor values and gait data, control the LED, and prototype games, visuals, sound and research tools without leaving the browser.'
  ),
  tags: ['GAMES', 'VISUALS', 'SOUND', 'RESEARCH', 'EDUCATION'],
  ctaStart: t('3分で始める', 'Start in 3 minutes'),
  ctaMore: t('できることを見る', 'See what it can do'),
  meta: t('Chrome / Edge 対応 · ORPHE CORE 2.0 / 3.0', 'Works on Chrome / Edge · ORPHE CORE 2.0 / 3.0'),
  playBadge: 'PLAY NOW',
  playCta: t('SUPER VIRTUAL HURDLE を今すぐ遊ぶ', 'Play SUPER VIRTUAL HURDLE now'),
  playNote: t(
    'この画面も ORPHE CORE.js で動く Example です。CORE がなくてもキーボード（← 長押しで加速、→ でジャンプ）で遊べます。',
    'This screen is one of the examples, running on ORPHE CORE.js. No CORE yet? Play with the keyboard: hold ← to accelerate, → to jump.'
  ),
  imageAlt: t(
    'SUPER VIRTUAL HURDLE のプレイ画面。夜のスタジアムでハードルを跳ぶランナー',
    'SUPER VIRTUAL HURDLE gameplay: a runner clearing hurdles in a stadium at night'
  ),
};

const topLinks = [
  { key: 'github', label: 'SOURCE', name: 'GitHub', href: links.github, gc: 'click-link-github', gcTitle: 'Top link: GitHub' },
  { key: 'api', label: 'DOCS', name: 'API Reference', local: 'api_doc/', gc: 'click-link-api-reference', gcTitle: 'Top link: API Reference' },
  { key: 'buy', label: 'STORE', name: 'Buy ORPHE CORE 3.0', href: links.shop, gc: 'click-link-buy-core', gcTitle: 'Top link: Buy ORPHE CORE 3.0' },
  { key: 'workshop', label: 'YOUTUBE', name: 'Workshop Materials', href: '#workshop', gc: 'click-link-workshop', gcTitle: 'Top link: Workshop Materials', play: true },
  { key: 'insole', label: 'SISTER SDK', name: 'ORPHE INSOLE SDK', href: links.insole, gc: 'click-link-insole-sdk', gcTitle: 'Top link: ORPHE INSOLE SDK' },
];

const stats = [
  { num: '1', unit: 'LINE', text: t('script タグ1行で導入<br>インストール不要', 'One script tag<br>No install') },
  { num: '200', unit: 'HZ', text: t('ORPHE CORE 3.0 の<br>解析性能', 'Analysis rate of<br>ORPHE CORE 3.0') },
  { num: '6', unit: 'AXIS', text: t('加速度 XYZ<br>角速度 XYZ', 'Acceleration XYZ<br>Angular velocity XYZ') },
  { num: '30+', unit: 'EXAMPLES', text: t('動かせるサンプルと<br>ソースコード', 'Runnable samples<br>with source code') },
];

const hardware = {
  eyebrow: 'HARDWARE',
  title: t('靴ひもにつける、<br>約20gのセンサー。', 'A 20 g sensor<br>that rides on your laces.'),
  lead: t(
    'ORPHE CORE〈オルフェコア〉は、身体動作計測を新たなレベルに進めるセンサーデバイスです。歩行・走行のリアルタイム可視化や、研究クラスの動作計測を手軽に運用できます。',
    'ORPHE CORE is a sensor device that advances human motion measurement. It makes real-time visualization of walking and running, and research-class motion measurement, easy to operate.'
  ),
  imageAlt: t('ORPHE CORE 3.0 本体', 'ORPHE CORE 3.0, front view'),
  specs: [
    [t('サイズ', 'Size'), t('45 × 29 × 14 mm', '45 × 29 × 14 mm'), true],
    [t('重量', 'Weight'), t('約 20 g', 'Approx. 20 g'), true],
    [t('センサー', 'Sensors'), t('加速度 XYZ、角速度 XYZ', 'Acceleration XYZ, angular velocity XYZ')],
    [t('解析性能', 'Analysis rate'), t('200 Hz', '200 Hz'), true],
    [t('本体仕様', 'Body'), t('Bluetooth、フルカラー LED、micro USB、IPX7、約8時間駆動', 'Bluetooth, full-color LED, micro USB, IPX7, approx. 8 hours of battery')],
    [t('対応シューズ', 'Compatible shoes'), t('EASYRUN SHIBUYA 3.0、RUNWALK ORPHE', 'EASYRUN SHIBUYA 3.0, RUNWALK ORPHE')],
    [t('両足計測', 'Both feet'), t('ORPHE CORE 3.0 が2個必要です', 'Requires two ORPHE CORE 3.0 units')],
    [t('同梱品', 'In the box'), t('本体、シューレースマウント、充電用 USB ケーブル', 'Sensor, shoelace mount, USB charging cable')],
  ],
  buy: t('ショップで ORPHE CORE 3.0 を購入', 'Buy ORPHE CORE 3.0 at the shop'),
  product: t('ORPHE CORE 3.0 の製品ページ', 'ORPHE CORE 3.0 product page'),
  mount: {
    eyebrow: 'SHOELACE MOUNT',
    title: t('手持ちのシューズに、<br>正しく取り付ける。', 'Mount it correctly<br>on the shoes you own.'),
    body: t(
      'ORPHE Official Store で購入できるシューレースマウントを使うと、ORPHE CORE 2.0 / 3.0 を靴ひものある手持ちのシューズに取り付けられます。足の甲に固定して使います。向き、取り付け手順、左右の確認はガイドにまとめています。',
      'With the shoelace mount from the ORPHE Official Store, you can attach ORPHE CORE 2.0 / 3.0 to any laced shoes you already own. It sits on the instep. Orientation, mounting steps and left/right checks are covered in the guide.'
    ),
    imageAlt: t('シューレースマウントで靴ひもに取り付けた ORPHE CORE', 'ORPHE CORE attached to shoelaces with the shoelace mount'),
    guide: t('シューレースマウントの詳しい使い方', 'Shoelace mount guide'),
    store: t('ORPHE Official Store で購入', 'Buy at the ORPHE Official Store'),
  },
};

const how = {
  eyebrow: 'HOW IT WORKS',
  title: t('関数をひとつ書けば、<br>足の動きが届く。', 'Write one function.<br>Foot motion arrives.'),
  lead: t(
    'ORPHE-CORE.js は Web Bluetooth で ORPHE CORE に接続し、センサが測った値をコールバック関数に渡します。受け取った値をどう使うかは自由。グラフにする、音を鳴らす、キャラクターを走らせる、CSV に記録する。',
    'ORPHE-CORE.js connects to ORPHE CORE over Web Bluetooth and hands the measured values to your callback functions. What you do with them is up to you: draw a chart, play a sound, make a character run, or log a CSV.'
  ),
  codeTitle: t('あなたが書くコード', 'The code you write'),
  codeComment: t('// 加速度が届くたびに呼ばれる（単位は G）', '// Called every time acceleration arrives (in G)'),
  waveTitle: t('届くデータ', 'The data you get'),
  waveAlt: t(
    '歩行中の加速度 x・y・z のサンプル波形。接地のたびに z が跳ね上がる',
    'Sample waveform of acceleration x, y and z while walking; z spikes at each foot strike'
  ),
  strike: t('接地', 'strike'),
  waveCaption: t('サンプル波形（歩行4歩ぶんのイメージ）', 'Sample waveform (an illustration of four walking steps)'),
  points: [
    {
      label: 'WEB BLUETOOTH',
      title: t('ブラウザから、直接つながる', 'Connect straight from the browser'),
      body: t(
        'Web Bluetooth API で BLE 通信。Chrome や Edge を開けば、専用アプリなしで ORPHE CORE に接続できます。',
        'BLE communication through the Web Bluetooth API. Open Chrome or Edge and connect to ORPHE CORE with no dedicated app.'
      ),
    },
    {
      label: 'RAW + ANALYZED',
      title: t('生データも、解析結果も', 'Raw data and analyzed results'),
      body: t(
        '6軸モーションセンサの生データと、デバイス内で解析された歩容データを同時に取得できます。',
        'Get raw 6-axis motion sensor data and gait data analyzed on the device, at the same time.'
      ),
    },
    {
      label: 'START SMALL',
      title: t('最初の一歩は、LED から', 'Your first step: the LED'),
      body: t(
        'まずはフルカラー LED を光らせて接続を確認。そのままセンサ値の取得へ進めます。',
        'Light the full-color LED to confirm the connection, then move on to reading sensor values.'
      ),
    },
  ],
};

const data = {
  eyebrow: 'DATA',
  title: t('生の加速度から、<br>歩き方の解析まで。', 'From raw acceleration<br>to gait analysis.'),
  lead: t(
    'モーションセンサ値、歩容解析、足部の指標、デバイス制御。すべて JavaScript の関数として扱えます。',
    'Motion sensor values, gait analysis, foot metrics and device control: all available as JavaScript functions.'
  ),
  head: ['CATEGORY', 'VALUES', 'CALLBACK / METHOD', 'NOTIFICATION'],
  rows: [
    [t('モーションセンサ値', 'Motion sensor values'), t('加速度（G）', 'Acceleration (G)'), 'gotConvertedAcc', 'SENSOR_VALUES'],
    [null, t('角速度（deg/s）', 'Angular velocity (deg/s)'), 'gotConvertedGyro', 'SENSOR_VALUES'],
    [null, t('クォータニオン・オイラー角', 'Quaternion, Euler angles'), 'gotQuat · gotEuler', 'SENSOR_VALUES'],
    [t('歩容解析', 'Gait analysis'), t('歩数・歩行/走行の種別・方向・距離・立脚/遊脚時間', 'Steps, walk/run type, direction, distance, stance/swing duration'), 'gotGait', 'STEP_ANALYSIS'],
    [t('足部の指標', 'Foot metrics'), t('ストライド・プロネーション', 'Stride, pronation'), 'gotStride · gotPronation', 'STEP_ANALYSIS'],
    [null, t('着地衝撃・接地角', 'Landing impact, foot angle'), 'gotLandingImpact · gotFootAngle', 'STEP_ANALYSIS'],
    [t('デバイス制御', 'Device control'), t('LED・装着位置・センサリセット・デバイス情報', 'LED, mount position, sensor reset, device information'), 'setLED · setMountPosition · getDeviceInformation', null],
  ],
  anytime: t('いつでも', 'Any time'),
  note: t(
    'センサ値と歩容解析の両方がほしいときは、begin() に <code>STEP_ANALYSIS_AND_SENSOR_VALUES</code> を指定します。',
    'Need both sensor values and gait analysis? Pass <code>STEP_ANALYSIS_AND_SENSOR_VALUES</code> to begin().'
  ),
};

const quickstart = {
  eyebrow: 'QUICK START',
  title: t('3分で、最初の接続。', 'Your first connection in 3 minutes.'),
  steps: [
    [t('コードを貼る', 'Paste the code'), t('右のコードを index.html として保存します。読み込みは CDN から。', 'Save the code on the right as index.html. The library loads from the CDN.')],
    [t('Chrome か Edge で開く', 'Open it in Chrome or Edge'), t('Connect ORPHE を押して、一覧から自分の CORE を選びます。', 'Press Connect ORPHE and pick your CORE from the list.')],
    [t('LED が光れば成功', 'The LED lights up'), t('接続できました。次はコールバックを足して、センサ値を受け取ります。', 'You are connected. Next, add a callback and receive sensor values.')],
  ],
  p5: t('p5.js ですぐ試す', 'Try the p5.js starter'),
  vscode: t('VSCode で始める', 'Start with VSCode'),
  led: t('LED 制御を試す', 'Try LED control'),
  ledComment: t('// LED を点灯', '// turn the LED on'),
  copy: 'COPY',
  copied: 'COPIED',
  cdnLabel: 'CDN LINKS',
  toolkitNote: t('接続 UI・デバイス操作・設定まわりのツールキット', 'Toolkit for connection UI, device controls and settings'),
  firstCheck: 'FIRST CHECK',
  ledTitle: t('最初の確認は、LED で。', 'Check the connection with the LED.'),
  ledBody: t(
    '接続できたらフルカラー LED を点滅させて、そのままセンサ値の取得へ進めます。',
    'Once connected, blink the full-color LED, then go straight on to reading sensor values.'
  ),
  ledAlt: t('フルカラー LED が点滅している ORPHE CORE', 'ORPHE CORE with its full-color LED blinking'),
};

const lanes = {
  eyebrow: 'CHOOSE YOUR LANE',
  title: t('どこから始める？', 'Where do you start?'),
  lead: t(
    '作りたいものや開発環境に合わせて、入口を選べます。迷ったらレーン1から。',
    'Pick an entry point that fits what you want to build and how you work. Not sure? Take lane 1.'
  ),
  list: [
    {
      title: t('いますぐ試したい', 'I want to try it right now'),
      sub: t('環境構築なし。ブラウザだけで。', 'No setup. Just the browser.'),
      items: [
        { name: 'p5.js Web Editor', local: 'docs/getting-started-p5.html', gc: 'click-path-p5', body: t('ローカル環境を作らず、ブラウザ上ですぐに試します。', 'Try it in the browser without setting up a local environment.') },
        { name: 'Starter Templates', href: '#starter-templates', gc: 'click-path-starter-templates', body: t('センサー値、歩容データ、LED などの最小サンプルから始めます。', 'Start from minimal samples for sensor values, gait data, LED and more.') },
      ],
    },
    {
      title: t('自分の環境で作りたい', 'I want to build in my own setup'),
      sub: t('ローカルで書いて、アプリに育てる。', 'Write locally and grow it into an app.'),
      items: [
        { name: 'VSCode', local: 'docs/getting-started-vscode.html', gc: 'click-path-vscode', body: t('ローカルで HTML を書き、Live Server で動かします。', 'Write HTML locally and run it with Live Server.') },
        { name: 'CoreToolkit.js', local: 'docs/getting-started-coretoolkit.html', gc: 'click-path-coretoolkit', body: t('接続 UI、デバイス操作、設定まわりをすばやく追加します。', 'Quickly add connection UI, device controls and settings.') },
        { name: 'Desktop apps with Electron', local: 'docs/getting-started-electron.html', gc: 'click-path-electron', body: t('Electron を使ったデスクトップアプリの開発。', 'Build desktop apps with Electron.') },
      ],
    },
    {
      title: t('お手本から学びたい', 'I want to learn from working code'),
      sub: t('動くコードを読んで、改造する。', 'Read code that runs, then remix it.'),
      items: [
        { name: 'Examples', local: 'examples/', gc: 'click-path-examples-catalog', body: t('ゲーム、センサービューア、歩容解析、ガイド、スターターを目的別に探します。', 'Browse games, sensor viewers, gait analysis, guides and starters by purpose.') },
        { name: 'Technical Examples', href: '#motion-intelligence', gc: 'click-path-technical-examples', body: t('ジェスチャー認識、周波数解析、生データの記録。', 'Gesture recognition, frequency analysis and raw data recording.') },
      ],
    },
  ],
};

const audience = {
  eyebrow: "WHO IT'S FOR",
  title: t('つくる人、学ぶ人、<br>調べる人へ。', 'For people who build,<br>learn and investigate.'),
  cards: [
    {
      label: 'DEVELOPERS',
      title: t('Web 開発者・エンジニア', 'Web developers and engineers'),
      body: t('CDN から読み込むだけ。接続 UI は CoreToolkit.js で追加でき、Electron でデスクトップアプリにもできます。', 'Just load it from the CDN. Add connection UI with CoreToolkit.js, or turn your project into a desktop app with Electron.'),
    },
    {
      label: 'STUDENTS',
      title: t('学生・授業・ワークショップ', 'Students, classes and workshops'),
      body: t('p5.js Web Editor なら環境構築なし。ブラウザを開いたその場で、身体を使ったプログラミングを始められます。', 'With the p5.js Web Editor there is nothing to set up. Open a browser and start programming with your body right away.'),
    },
    {
      label: 'RESEARCHERS',
      title: t('研究・計測', 'Research and measurement'),
      body: t('歩行・走行をリアルタイムに可視化。生データの記録、周波数解析、ジェスチャー認識の Example から始められます。', 'Visualize walking and running in real time. Start from the examples for raw data recording, frequency analysis and gesture recognition.'),
    },
    {
      label: 'CREATORS',
      title: t('クリエイター・アーティスト', 'Creators and artists'),
      body: t('足の動きで音を鳴らし、映像を動かす。ビジュアル、サウンド、身体を使ったインターフェースの入力に。', 'Trigger sound and drive visuals with your feet. An input for visuals, sound and body-based interfaces.'),
    },
  ],
};

// Example cards. `dir` is the folder under examples/, `img` is relative to the site root.
const ex = (dir, img, name, tag, desc, extra = {}) => ({ dir, img, name, tag, desc, ...extra });
const th = (name) => `examples/_thumbnails/${name}`;

const examples = {
  eyebrow: 'EXAMPLES',
  title: t('動かして、コードを読む。<br>30以上の Examples。', 'Run it, then read the code.<br>30+ examples.'),
  all: t('すべての Example を目的別に探す', 'Browse all examples by purpose'),
  demo: 'DEMO',
  source: 'SOURCE',
  p5: 'P5.JS',
  play: {
    id: 'what-you-can-build',
    aliases: ['virtual-sports-examples', 'creative-examples'],
    heading: 'VIRTUAL SPORTS & CREATIVE',
    lead: t(
      '歩行・走行・足の動きで、陸上競技や対戦、グラフィック、サウンドの体験を作る Example です。',
      'Examples that turn walking, running and foot motion into track events, versus games, graphics and sound.'
    ),
    items: [
      ex('GAME-SUPER-HURDLE', th('super-hurdle.png'), t('SUPER VIRTUAL HURDLE', 'SUPER VIRTUAL HURDLE'), 'VIRTUAL SPORTS', t('夜のスタジアムを走る110mハードル。VS、スタミナ配分、走りの分析つき。', '110 m hurdles in a stadium at night, with VS mode, stamina pacing and run analysis.'), { gc: 'click-example-game-super-hurdle' }),
      ex('GAME-HURDLE', th('hurdle-110m.png'), t('110m ハードル走', '110m Hurdles'), 'VIRTUAL SPORTS · 2 CORES', t('Gait Analysis と足の動きで走る、Virtual Sports の代表 Example です。', 'The signature Virtual Sports example: run with gait analysis and foot motion.'), { gc: 'click-example-game-hurdle' }),
      ex('GAME-SUPER-PINGPONG', th('super-pingpong.png'), t('SUPER PINGPONG', 'SUPER PINGPONG'), 'CREATIVE', t('足首・太ももの運動で遊ぶ3Dの温泉卓球。キャラクター選択と動きの分析レポート付き。', '3D hot-spring ping-pong played with ankle and thigh exercises, with selectable characters and a movement report.'), { gc: 'click-example-game-super-pingpong' }),
      ex('GAME-UDON', th('udon.png'), t('UDON', 'UDON'), 'CREATIVE', t('足踏みでうどんをこねるゲーム。', 'Knead udon dough by stamping your feet.'), { gc: 'click-example-game-udon' }),
      ex('GAME-DDR', th('ddr.png'), t('ORPHE STEP BEAT', 'ORPHE STEP BEAT'), 'CREATIVE', t('音楽と足の動きを組み合わせたリズムゲーム。', 'A rhythm game that combines music and foot motion.'), { gc: 'click-example-game-ddr' }),
      ex('GAME-BOXING', th('boxing.png'), t('BOXING GAME', 'BOXING GAME'), 'CREATIVE', t('パンチ動作を使ったアクションゲーム。', 'An action game driven by punching motion.'), { gc: 'click-example-game-boxing' }),
      ex('GAME-PINGPONG', th('pingpong.png'), t('PINGPONG GAME', 'PINGPONG GAME'), 'CREATIVE', t('2人で遊べるシンプルな対戦ゲーム。', 'A simple versus game for two players.'), { gc: 'click-example-game-pingpong' }),
      ex('MOVEYOURFEET', th('move-your-feet.png'), t('MOVEYOURFEET', 'MOVEYOURFEET'), 'CREATIVE', t('足を動かして遊ぶエクササイズ系ゲーム。', 'An exercise game you play by moving your feet.'), { gc: 'click-example-move-your-feet' }),
      ex('drum_test', th('drum.png'), t('ORPHE CORE Gesture Drum', 'ORPHE CORE Gesture Drum'), 'CREATIVE', t('ジェスチャーで音を鳴らすドラムサンプラー。', 'A drum sampler you play with gestures.'), { gc: 'click-example-drum-test' }),
    ],
    sketchLabel: 'P5.JS SKETCHES',
    sketches: [
      ['3DBOX', `${P5}waUWo6ZZN`],
      ['ORPHEMIN', `${P5}PE438XURD`],
      ['ZANGEKI', `${P5}QiE0E88Gc`],
      ['ORPHE SHOOTING', `${P5}QUzPJzpVO`],
    ],
    category: t('Virtual Sports カテゴリを見る', 'See the Virtual Sports category'),
  },
  apps: {
    id: 'examples',
    heading: 'APPLICATION EXAMPLES',
    lead: t(
      'デバイス情報、LED 制御、センサー値や歩容データの可視化、外部 API 連携など、アプリ開発の起点になる Example です。',
      'Starting points for app development: device information, LED control, visualizing sensor and gait data, and connecting external APIs.'
    ),
    items: [
      ex('INFORMATION', 'examples/INFORMATION/teaser.gif', t('INFORMATION', 'INFORMATION'), 'DEVICE · SETUP', t('アプリを作る前に、ORPHE CORE のデバイス情報を確認します。', 'Check ORPHE CORE device information before building apps.')),
      ex('LIGHT', 'examples/LIGHT/teaser.gif', t('LIGHT', 'LIGHT'), 'LED · BEGINNER', t('ORPHE CORE に接続して、フルカラー LED を制御します。', 'Connect to ORPHE CORE and control the full-color LED.')),
      ex('VIEW', 'examples/VIEW/data-viewer.gif', t('VIEW', 'VIEW'), 'VIEWER · GAIT', t('センサー値と歩容解析の値をブラウザ上で確認します。', 'Inspect sensor values and gait analysis values in the browser.')),
      ex('VISUALIZE', th('visualize.png'), t('VISUALIZE', 'VISUALIZE'), 'SENSOR · CHART', t('SENSOR_VALUES をシンプルな画面で可視化します。', 'Visualize SENSOR_VALUES on a simple screen.')),
      ex('FOOT ANGLE', th('foot-angle.png'), t('FOOT ANGLE', 'FOOT ANGLE'), 'GAIT · FOOT ANGLE', t('歩容解析から得られる接地角や足角度を可視化します。', 'Visualize the landing angle and foot angle from gait analysis.'), { p5: `${P5}ozss3px1G` }),
      ex('PRONATION', th('pronation.png'), t('PRONATION', 'PRONATION'), 'GAIT · PRONATION', t('プロネーションや着地に関わる歩容データを可視化します。', 'Visualize gait data related to pronation and landing.')),
      ex('AIRWALKER', th('airwalker.png'), t('AIR WALKER', 'AIR WALKER'), 'DASHBOARD · ACTIVITY', t('歩数、動き、アクティビティをダッシュボードで表示します。', 'Show steps, motion and activity on a dashboard.')),
      ex('POSE', th('pose.png'), t('POSE', 'POSE'), 'POSE · CREATIVE', t('MediaPipe Pose と ORPHE CORE のセンサーデータを組み合わせます。', 'Combine MediaPipe Pose with ORPHE CORE sensor data.')),
      ex('OH1', th('oh1.png'), t('OH1', 'OH1'), 'BLE · HEART RATE', t('OH1 の心拍データと ORPHE CORE のモーションデータを連携します。', 'Link OH1 heart-rate data with ORPHE CORE motion data.')),
      ex('CORETOOLKIT-STARTER', th('coretoolkit-starter.png'), t('CORETOOLKIT STARTER', 'CORETOOLKIT STARTER'), 'CORETOOLKIT · UI', t('CoreToolkit.js の接続 UI とセンサーモニターからすばやく始めます。', 'Start quickly from the CoreToolkit.js connection UI and sensor monitor.'), { p5: `${P5}5nV83PG1A`, noSource: true }),
      ex('SENSOR-CALIBRATION', th('sensor-calibration.png'), t('SENSOR CALIBRATION', 'SENSOR CALIBRATION'), 'RECORDING · AI', t('ジェスチャー認識や AI 学習用にセンサーデータを記録します。', 'Record sensor data for gesture recognition and AI training.')),
      ex('GESTURE-DEMO', th('gesture-demo.png'), t('GESTURE DEMO', 'GESTURE DEMO'), 'GESTURE · SOUND', t('つま先タップ、かかとタップ、踏み込みをリアルタイムに検出します。', 'Detect toe taps, heel taps and stomps in real time.')),
    ],
  },
  starters: {
    id: 'starter-templates',
    heading: 'STARTER TEMPLATES',
    lead: t(
      '1つのデータ型や通知モードを小さく試すための最小サンプルです。コピーして自分のアプリの出発点に。',
      'Minimal samples for trying one data type or notification mode at a time. Copy one as the starting point of your own app.'
    ),
    // [file, thumbnail, name, description, p5 sketch id, hasSource]
    items: [
      ['LIGHT.html', 'starter-light.png', 'LIGHT', t('LED の制御', 'LED control'), 'X7O5PU87S', true],
      ['ACCELEROMETER.html', 'starter-accelerometer.png', 'ACCELEROMETER', t('加速度 {x, y, z}', 'Acceleration {x, y, z}'), 'WqUWEul5N', true],
      ['GYRO.html', 'starter-gyro.png', 'GYRO', t('角速度 {x, y, z}', 'Angular velocity {x, y, z}'), 'LvUXsj0WT', true],
      ['QUATERNION.html', 'starter-quaternion.png', 'QUATERNION', t('姿勢 {w, x, y, z}', 'Orientation {w, x, y, z}'), '4modSEX2J', true],
      ['EULER.html', 'starter-euler.png', 'EULER', t('姿勢 {pitch, roll, yaw}', 'Orientation {pitch, roll, yaw}'), 'WiTZ23rw2', true],
      ['STEPS.html', 'starter-steps.png', 'STEPS', t('歩数', 'Number of steps'), 'fTR9Jj0kC', true],
      ['STRIDE.html', 'starter-stride.png', 'STRIDE', t('ストライド', 'Stride data'), 'PbW-apAGP', true],
      ['PRONATION.html', 'starter-pronation.png', 'PRONATION', t('プロネーション', 'Pronation data'), 'FAw49ZU7g', true],
      ['ANALYSIS_AND_RAW.html', 'starter-analysis-and-sensor-values.png', 'STEP_ANALYSIS + SENSOR_VALUES', t('解析値と生センサー値を同時に受け取ります。', 'Receive analyzed values and raw sensor values together.'), '1mNA7vd1g', false],
    ],
    recipeLabel: 'P5.JS RECIPES',
    recipes: [
      ['TWO COREs', `${P5}XHZ2lHQtN`],
      ['GAIT / DURATION', `${P5K}uu_YYhowG`],
      ['ALL GAIT INFORMATION', `${P5K}boqkxL47u`],
      ['ALL GAIT AND SPEED', `${P5K}boqkxL47u`],
      ['GAIT AND RECORD', `${P5K}D-NbsGfcE`],
      ['SENSOR VALUES + GAIT DATA', `${P5K}boqkxL47u`],
    ],
  },
  technical: {
    id: 'motion-intelligence',
    heading: 'TECHNICAL EXAMPLES',
    lead: t(
      'ジェスチャー認識、時系列マッチング、周波数解析、データ可視化を試すための Example です。',
      'Examples for trying gesture recognition, time-series matching, frequency analysis and data visualization.'
    ),
    tag: 'GESTURE · DETECTION',
    name: 'GESTURE DEMO',
    dir: 'GESTURE-DEMO',
    img: th('gesture-demo.png'),
    body: t(
      'リアルタイムのジェスチャー検出を試す実用的な起点です。つま先タップ、かかとタップ、踏み込みを検出します。',
      'A practical starting point for real-time gesture detection. It detects toe taps, heel taps and stomps.'
    ),
    sketchLabel: 'P5.JS ANALYSIS SKETCHES',
    sketches: [
      ['FFT', `${P5}kfH-VPqK5`],
      ['PLOT', `${P5}3kT0WfHu7`],
      ['RMS', `${P5K}tOlve54S2`],
    ],
  },
};

const workshop = {
  eyebrow: 'ORPHE CORE WORKSHOP ON YOUTUBE',
  title: t('見ながら、一緒に作れる。<br>全7本の動画ワークショップ。', 'Watch and build along.<br>A 7-part video workshop.'),
  lead: t(
    'ORPHE CORE 3.0 と ORPHE-CORE.js で、モーションセンサを使った IoT プログラミングを進める動画シリーズです。PC への最初の接続から、ChatGPT と作るシューティングゲーム、FFT による周波数解析まで。画面を見ながら同じコードを書いていけます。',
    'A video series on IoT programming with a motion sensor, using ORPHE CORE 3.0 and ORPHE-CORE.js. From the first connection to your PC, to a shooting game built with ChatGPT, to frequency analysis with FFT. Follow the screen and write the same code. (Videos are in Japanese.)'
  ),
  startHere: 'START HERE',
  featuredNote: t('まずはここから。p5.js Web Editor を使って、最初の接続まで。', 'Start here: your first connection, using the p5.js Web Editor.'),
  cast: t(
    '出演：馬場 哲晃（東京都立大学 教授／ORPHE 技術顧問）<br>菊川 裕也（ORPHE CEO / Founder）',
    'With Tetsuaki Baba (Professor, Tokyo Metropolitan University / Technical Advisor, ORPHE)<br>and Yuya Kikukawa (CEO / Founder, ORPHE)'
  ),
  playlistCta: t('YouTube で再生リストを見る', 'Watch the playlist on YouTube'),
  playlistHead: 'PLAYLIST',
  playlistMeta: t('7 VIDEOS · 約2時間50分', '7 VIDEOS · APPROX. 2 H 50 MIN'),
  watch: t('YouTube で再生', 'Play on YouTube'),
  // [YouTube video id, episode label, length, title]
  episodes: [
    ['GChcShH6u7E', 'EP 01', '13 MIN', t('ORPHE CORE を PC に接続しよう！', 'Connect ORPHE CORE to your PC')],
    ['QQtIiS31JVk', 'EP 02', '23 MIN', t('CoreToolkit.js を使いこなそう！', 'Get the most out of CoreToolkit.js')],
    ['IHxyfFoqAOY', 'EP 03', '25 MIN', t('ZANGEKI アプリを作ってみよう！', 'Build the ZANGEKI app')],
    ['xZ0asvhgsaI', 'EP 04', '20 MIN', t('ChatGPT と一緒にシューティングゲームを作ろう！', 'Build a shooting game with ChatGPT')],
    ['A46HOM9F8cs', 'EP 05', '32 MIN', t('ORPHE CORE で移動距離を測ろう！', 'Measure travel distance with ORPHE CORE')],
    ['0S6JK9YBSWg', 'EP 06', '26 MIN', t('フーリエ変換を基本から学ぼう', 'Learn the Fourier transform from the basics')],
    ['vh9gOQ_eYfM', 'EP 09', '29 MIN', t('p5.js と ORPHE-CORE.js で FFT による周波数解析を実装する！', 'Implement FFT frequency analysis with p5.js and ORPHE-CORE.js')],
  ],
  ytList: YT_LIST,
  cards: {
    material: {
      tag: 'WORKSHOP · DFT / FFT',
      title: 'ORPHE CORE WS #7 / #8',
      body: t('YouTube の ORPHE CORE WS で扱った、フーリエ解析・DFT/FFT の教材です。', 'Materials on Fourier analysis and DFT/FFT covered in the ORPHE CORE WS on YouTube.'),
      alt: t('DFT Workshop：センサーデータを周波数解析で学ぶ', 'DFT Workshop: learning frequency analysis with sensor data'),
    },
    gallery: {
      tag: 'EDUCATION · STUDENT WORKS',
      title: 'TMU 2025 Workshop Gallery',
      body: t('東京都立大学での授業・ワークショップ成果をまとめたギャラリーです。学生が作った作品を見られます。', 'A gallery of results from classes and workshops at Tokyo Metropolitan University. See what the students built.'),
      alt: t('ORPHE-CORE.js Workshop in SHIBUYA の会場。講師の話を聞く参加者たち', 'ORPHE-CORE.js Workshop in SHIBUYA: participants listening to the instructor'),
    },
    tutorial: {
      tag: 'TUTORIAL',
      title: 'ORPHE-CORE.js Tutorial',
      body: t('手順を追って学習できる Tutorial ページを公開しています。楽しんでください！', 'A step-by-step tutorial page is available. Enjoy!'),
    },
  },
};

const api = {
  eyebrow: 'API',
  title: t('すべての API は、<br>リファレンスに。', 'The full API,<br>in the reference.'),
  lead: t(
    'jsdoc によって生成された Orphe クラスの API リファレンスです。メソッド、コールバック、オプションの詳細を確認できます。',
    'The API reference for the Orphe class, generated with jsdoc. Look up the details of methods, callbacks and options.'
  ),
  cta: 'API Reference for ORPHE-CORE.js',
  panelNote: t('主なメソッド', 'Main methods'),
  idComment: t('// 0 または 1。2台まで', '// 0 or 1; up to two devices'),
};

const closing = {
  eyebrow: 'GET STARTED',
  title: t('まずは、LED を光らせよう。', 'First, light up the LED.'),
  compat: t(
    'Web Bluetooth を使うため、Chrome や Edge などの Chromium 系ブラウザで動作します。Safari と Firefox では動作しません。iOS では Bluefy などの Web BLE 対応ブラウザをご利用ください。',
    'ORPHE-CORE.js uses Web Bluetooth, so it runs on Chromium-based browsers such as Chrome and Edge. It does not work on Safari or Firefox. On iOS, use a Web BLE capable browser such as Bluefy.'
  ),
};

module.exports = {
  links, nav, hero, topLinks, stats, hardware, how, data, quickstart, lanes, audience, examples, workshop, api, closing,
};
