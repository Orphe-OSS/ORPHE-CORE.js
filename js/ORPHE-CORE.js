var orphe_js_version_date = `
Last modified: 2026/01/31 23:52:51
`;
/**
ORPHE-CORE.js is javascript library for ORPHE CORE Module, inspired by BlueJelly.js
Class形式で記述を変更したバージョン
v1.3 Date Time機能の追加
v1.2 クラス記述形式に変更
v1.1 2024/05/29
v1.0 2021/05/01
@module Orphe
@author Tetsuaki BABA
@version 1.3.4

@see https://github.com/Orphe-OSS/ORPHE-CORE.js
*/

// 外部スクリプトを読み込む関数
// 同じ src / 同じファイル名の <script> が既に DOM に挿入されていれば skip。
function loadScript(src) {
  const fileName = src.split('/').pop();
  if (fileName) {
    const already = Array.from(document.scripts).some(s => {
      if (!s.src) return false;
      return s.src === src || s.src.endsWith('/' + fileName);
    });
    if (already) return;
  }
  const script = document.createElement('script');
  script.src = src;
  script.type = 'text/javascript';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

// 外部スクリプトの読み込み (float16.min.js / quaternion.js)
// 注意: ORPHE-CORE.js は HTML のトップで synchronous に評価される。その
// 時点では HTML 後続の <script src=".../float16.min.js"> タグはまだ
// パーサーに渡っておらず document.scripts にも現れない。素朴に loadScript
// を即時呼ぶと、SDK 自身の自動補填と HTML の静的 <script> の両方が走り、
// `class float16 already declared` で全コードが死ぬ。
// → DOMContentLoaded を待つ。この時点では parser-blocking な静的 <script>
//    は全て解析・実行済みなので、loadScript の dedup チェックが効く。
function _orpheAutoLoadOptionalLibs() {
  loadScript('https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js@main/js/float16.min.js');
  loadScript('https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js@main/js/quaternion.js');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _orpheAutoLoadOptionalLibs, { once: true });
} else {
  _orpheAutoLoadOptionalLibs();
}


/**
 * 自動的に決められた配列サイズでunshiftしてくれるクラス
 * sensor valuesのデータを保持するクラスです。sensor valuesのデータは、加速度、ジャイロ、クォータニオンの3つのデータを保持します。interpotion処理を行うために、過去のデータを保持する用途に使用します。
 */
class FixedSizeArray {
  constructor(size) {
    this.size = size;
    this.array = [];
  }
  setSize(size) {
    this.size = size;
  }
  push(element) {
    if (this.array.length >= this.size) {
      this.array.shift(); // 先頭の要素を削除
    }
    this.array.push(element); // 新しい要素を追加
  }

  getArray() {
    return this.array;
  }
}




/**
 * Orpheクラス内部で利用されるタイムスタンプクラスです。BLE通信のデータ取得タイミングにおける実測周波数を取得するために利用されます。Orpheクラス内部で本当は宣言したかったのですが、jsdoc がクラス内部クラス定義に対応していないため、外部に出しています。無念。  
 * @class
 */
class OrpheTimestamp {
  /**
   * タイムスタンプクラスのコンストラクタです。
   */
  constructor() {
    this.start = 0;
  }

  /**
   * 前回呼び出した時刻からの経過時間をミリ秒で返します。
   * @returns {number} 前回呼び出した時刻からの経過時間をミリ秒で返します。
   */
  millis() {
    const blenow = performance.now();
    let diff = (blenow - this.start);
    this.start = blenow;
    return diff;
  }
  /**
   * 前回呼び出した時刻からの経過時間を周波数として返します。
   * @returns {float} 周波数[Hz]
   */
  getHz() {
    let t = this.millis();
    if (t <= 15) return -1;
    else return 1000 / t;
  }
}

/**
 * ORPHE CORE Module Javascript class
* @class
* @type {Object} 
* @property {string} ORPHE_INFORMATION "01a9d6b5-ff6e-444a-b266-0be75e85c064" SERVICE_UUID
* @property {string} ORPHE_DEVICE_INFORMATION "24354f22-1c46-430e-a4ab-a1eeabbcdfc0" CHARACTERISTIC_UUID
* 
* @property {string} ORPHE_OTHER_SERVICE "db1b7aca-cda5-4453-a49b-33a53d3f0833" SERVICE_UUID
* @property {string} ORPHE_SENSOR_VALUES "f3f9c7ce-46ee-4205-89ac-abe64e626c0f" CHARACTERISTIC_UUID
* @property {string} ORPHE_STEP_ANALYSIS "4eb776dc-cf99-4af7-b2d3-ad0f791a79dd" CHARACTERISTIC_UUID
*/
class Orphe {
  /**
   * 初期化関数 
   * @param {number}[id=0] id コアの番号（0 or 1）を指定します。
   */
  constructor(id = 0) {

    this.defaultGotData = this.gotData;
    this.timestamp = new OrpheTimestamp();

    Object.defineProperty(this, 'ORPHE_INFORMATION', { value: "01a9d6b5-ff6e-444a-b266-0be75e85c064", writable: true });
    Object.defineProperty(this, 'ORPHE_DEVICE_INFORMATION', { value: "24354f22-1c46-430e-a4ab-a1eeabbcdfc0", writable: true });
    Object.defineProperty(this, 'ORPHE_DATE_TIME', { value: "f53eeeb1-b2e8-492a-9673-10e0f1c29026", writable: true });
    Object.defineProperty(this, 'ORPHE_OTHER_SERVICE', { value: "db1b7aca-cda5-4453-a49b-33a53d3f0833", writable: false });
    Object.defineProperty(this, 'ORPHE_SENSOR_VALUES', { value: "f3f9c7ce-46ee-4205-89ac-abe64e626c0f", writable: false });
    Object.defineProperty(this, 'ORPHE_STEP_ANALYSIS', { value: "4eb776dc-cf99-4af7-b2d3-ad0f791a79dd", writable: false });

    // Object.defineProperty(this, 'ORPHE_INFORMATION', { value: "01A9D6B5-FF6E-444A-B266-0BE75E85C064", writable: true });
    // Object.defineProperty(this, 'ORPHE_DEVICE_INFORMATION', { value: "24354F22-1C46-430E-A4AB-A1EEABBCDFC0", writable: true });
    // Object.defineProperty(this, 'ORPHE_DATE_TIME', { value: "F53EEEB1-B2E8-492A-9673-10E0F1C29026", writable: true });
    // Object.defineProperty(this, 'ORPHE_OTHER_SERVICE', { value: "DB1B7ACA-CDA5-4453-A49B-33A53D3F0833", writable: false });
    // Object.defineProperty(this, 'ORPHE_SENSOR_VALUES', { value: "F3F9C7CE-46EE-4205-89AC-ABE64E626C0F", writable: false });
    // Object.defineProperty(this, 'ORPHE_STEP_ANALYSIS', { value: "4EB776DC-CF99-4AF7-B2D3-AD0F791A79DD", writable: false });


    // Initialize member variables
    this.bluetoothDevice = null;
    this.dataCharacteristic = null;// 通知を行うcharacteristicを保持する
    this.dataChangedEventHandlerMap = {}; // イベントハンドラを保持するマップ
    this.hashUUID = {}; // UUIDを保持するハッシュ
    this.hashUUID_lastConnected; // 最後に接続したUUIDを保持する
    this.id = id;

    // BleSharedBridge: 複数タブ間接続共有
    this._bridge = null;
    this._isBridgeSecondary = false;
    this._lastBluetoothDeviceStorageKey = `orphe_last_bluetooth_device_${id}`;
    this._usingRememberedBluetoothDevice = false;
    this._rememberedBluetoothDeviceUnavailable = false;
    this._autoReconnectEnabled = false;
    this._autoReconnectInProgress = false;
    this._autoReconnectNotificationType = 'STEP_ANALYSIS';
    this._autoReconnectOptions = {};
    this._autoReconnectDevice = null;
    this._autoReconnectDisconnectHandler = (event) => this._handleAutoReconnectDisconnect(event);
    this._suppressAutoReconnectErrors = false;
    this._lastAutoReconnectError = null;
    this._gattOperationQueue = Promise.resolve();
    this.array_device_information = new DataView(new ArrayBuffer(20));// device information用の配列

    /**
   * デバイスインフォメーションを取得して保存しておく連想配列です。begin()を呼び出すとデバイスから値を取得して初期化されます。
   * @property {Object} device_information - デバイス情報
   * @property {number} device_information.battery - バッテリー残量（少ない:0、普通:1、多い:2）
   * @property {number} device_information.lr - コアモジュール取り付け位置（左右情報）
  bit0 : left(0) / right(1)
  bit1 : 0(足底) / 1(足背)
  足底 : 左、右：0=(0000 0000b), 1=(0000 0001b)、
  足背 : 左、右：2(=0000 0010b), 3(=0000 0011b)
   * @property {number} device_information.rec_mode - 記録モード。記録してない, 記録中, 一時停止中：0, 1, 2
   * @property {number} device_information.rec_auto_run - 自動RUN記録　Off, On：0, 1
   * @property {number} device_information.led_brightness - LEDの明るさ（0-255）
   * @property {Object} device_information.range - 加速度とジャイロセンサの感度設定
   * @property {number} device_information.range.acc - 加速度レンジ（ 2, 4, 8, 16(g)：0, 1, 2, 3）
   * @property {number} device_information.range.gyro - ジャイロレンジ（250, 500, 1000, 2000(°/s)：0, 1, 2, 3）
  */
    this.device_information = '';

    /**
     * 歩容解析のデータを保存しておく連想配列です。
     * @property {Object} gait - 歩容解析のデータ
     * @property {number} gait.type - 歩容のタイプ（0: 通常歩行, 1: 走行, 2: ランニング）
     * @property {number} gait.direction - 歩容の向き（0: 前進, 1: 後退, 2: 左, 3: 右）
     * @property {number} gait.calorie - 消費カロリー
     * @property {number} gait.distance - 移動距離
     * @property {number} gait.steps - 歩数
     * @property {number} gait.standing_phase_duration - 立ち上がり時間
     * @property {number} gait.swing_phase_duration - 振り出し時間
     */
    this.gait = {
      type: 0,
      direction: 0,
      calorie: 0,
      distance: 0,
      steps: 0,
      standing_phase_duration: 0,
      swing_phase_duration: 0
    }
    /**
     * ストライドのデータを保存しておく連想配列です。
     * @property {Object} stride - ストライドのデータ
     * @property {number} stride.foot_angle - 足首の角度
     * @property {number} stride.x - X軸方向のストライド
     * @property {number} stride.y - Y軸方向のストライド
     * @property {number} stride.z - Z軸方向のストライド
     * @property {number} stride.steps - 歩数
     * 
     */
    this.stride = {
      foot_angle: 0,
      x: 0,
      y: 0,
      z: 0,
      steps: 0,
    }
    /**
   * プロネーションのデータを保存しておく連想配列です。
   * @property {Object} pronation - プロネーションのデータ
   * @property {number} pronation.landing_impact - 着地衝撃
   * @property {number} pronation.x - X軸方向のプロネーション
   * @property {number} pronation.y - Y軸方向のプロネーション
   * @property {number} pronation.z - Z軸方向のプロネーション
   * @property {number} pronation.steps - 歩数
   */
    this.pronation = {
      landing_impact: 0,
      x: 0,
      y: 0,
      z: 0,
      steps: 0,
    }
    /**
     * 歩数カウントを保存する変数
     */
    this.steps_number = 0;

    /**
     * クォータニオンを保存する連想配列です。
     * @property {Object} quat - クォータニオン
     * @property {number} quat.w - w
     * @property {number} quat.x - x
     * @property {number} quat.y - y
     * @property {number} quat.z - z
     * 
     */
    this.quat = {
      w: 0.0, x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * 加速度値から2回積分で基準フレーム間の移動距離を求めた変数です
     * @property {Object} delta - 距離
     * @property {number} delta.x - X軸方向の距離
     * @property {number} delta.y - Y軸方向の距離
     * @property {number} delta.z - Z軸方向の距離
     *    */
    this.delta = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * オイラー角を保存する連想配列です。this.quatから計算されています。
     * @property {Object} euler - オイラー角
     * @property {number} euler.pitch - ピッチ
     * @property {number} euler.roll - ロール
     * @property {number} euler.yaw - ヨー
     */
    this.euler = {
      pitch: 0.0,
      roll: 0.0,
      yaw: 0.0
    }

    /**
     * ジャイロセンサの値を保存する連想配列です。
     * @property {Object} gyro - ジャイロセンサの値
     * @property {number} gyro.x - X軸方向のジャイロセンサの値
     * @property {number} gyro.y - Y軸方向のジャイロセンサの値
     * @property {number} gyro.z - Z軸方向のジャイロセンサの値
     */
    this.gyro = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * 加速度センサの値を保存する連想配列です。
     * @property {Object} acc - 加速度センサの値
     * @property {number} acc.x - X軸方向の加速度センサの値
     * @property {number} acc.y - Y軸方向の加速度センサの値
     * @property {number} acc.z - Z軸方向の加速度センサの値
     */
    this.acc = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * ジャイロレンジに合わせて変換したジャイロセンサの値を保存する連想配列です。
     * @property {Object} converted_gyro - ジャイロセンサの値
     * @property {number} converted_gyro.x - X軸方向のジャイロセンサの値
     * @property {number} converted_gyro.y - Y軸方向のジャイロセンサの値
     * @property {number} converted_gyro.z - Z軸方向のジャイロセンサの値
     */
    this.converted_gyro = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * 加速度レンジに合わせて変換した加速度センサの値を保存する連想配列です。
     * @property {Object} converted_acc - 加速度センサの値
     * @property {number} converted_acc.x - X軸方向の加速度センサの値
     * @property {number} converted_acc.y - Y軸方向の加速度センサの値
     * @property {number} converted_acc.z - Z軸方向の加速度センサの値
     */
    this.converted_acc = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * データ欠損時に線形補完をするかどうかのオプション設定（beginのオプションで設定可能）。この設定は200Hz sensor_valuesのacc, gyro, quatのみに適用されます。
     * 
     * @property {Object} interpolation - 線形補間の設定
     * @property {boolean} interpolation.enabled - 線形補間の有効化/無効化　true: 有効, false: 無効
     * @property {number} interpolation.max_consecutive_missing - 線形補間する最大の連続欠損数
     */
    this.interpolation = {
      enabled: false,
      max_consecutive_missing: 1
    }

    this.history_sensor_values = {
      acc: new FixedSizeArray(4),
      gyro: new FixedSizeArray(4),
      quat: new FixedSizeArray(4),
      converted_acc: new FixedSizeArray(4),
      converted_gyro: new FixedSizeArray(4)
    }

    this.half_round_trip_time = 0;
    // メンバ変数の初期化ここまで
    //////////////////////////

  }


  /**
  * gotData()がユーザ側でオーバーライドされているかどうかを返す関数です。これを見て，デバッグモード（ORPHE TERMINAL）を有効にするかどうかを判断します。オーバーライドするとgotData()以外の関数はコールバックされません．
  * 
 */
  isGotDataOverridden() {
    return this.gotData !== this.defaultGotData;
  }
  /**
   * UUIDを設定する関数です。UUIDはsetup()で利用するキャラクタリスティック（DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS）の指定に利用されます。
   * @param {string} name 
   * @param {string} serviceUUID 
   * @param {string} characteristicUUID 
   * 
   */
  setUUID(name, serviceUUID, characteristicUUID) {
    this.hashUUID[name] = { 'serviceUUID': serviceUUID, 'characteristicUUID': characteristicUUID };
  }
  /**
   * 最初に必要な初期化処理メソッドです。利用するキャラクタリスティック（DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS）の指定の他、オプションを指定することができます。オプションでは生データの取得を指定することができます。通常利用では引数を省略して setup() が呼び出されることが多いです。
   * @param {string[]} [string[]=["DEVICE_INFORMATION", "SENSOR_VALUES", "STEP_ANALYSIS"]] DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS
   * @param {object} [options = {interpolation}] - interpolationは未実装
   *
   */
  setup(names = ['DEVICE_INFORMATION', 'DATE_TIME', 'SENSOR_VALUES', 'STEP_ANALYSIS'],
    options = {
      interpolation: {
        enabled: false, // 線形補間の有効化/無効化
        max_consecutive_missing: 1 // 線形補間する最大の連続欠損数
      }
    }
  ) {

    this.interpolation = options.interpolation;
    this.history_sensor_values.acc.setSize(this.interpolation.max_consecutive_missing);
    this.history_sensor_values.gyro.setSize(this.interpolation.max_consecutive_missing);
    this.history_sensor_values.quat.setSize(this.interpolation.max_consecutive_missing);
    this.history_sensor_values.converted_acc.setSize(this.interpolation.max_consecutive_missing);
    this.history_sensor_values.converted_gyro.setSize(this.interpolation.max_consecutive_missing);

    for (const name of names) {
      if (name == 'DEVICE_INFORMATION') {
        this.setUUID(name, this.ORPHE_INFORMATION, this.ORPHE_DEVICE_INFORMATION);
      }
      else if (name == 'DATE_TIME') {
        this.setUUID(name, this.ORPHE_INFORMATION, this.ORPHE_DATE_TIME);
      }
      else if (name == 'SENSOR_VALUES') {
        this.setUUID(name, this.ORPHE_OTHER_SERVICE, this.ORPHE_SENSOR_VALUES);
      }
      else if (name == 'STEP_ANALYSIS') {
        this.setUUID(name, this.ORPHE_OTHER_SERVICE, this.ORPHE_STEP_ANALYSIS);
      }
    }
  }

  /**
   *  begin BLE connection 
   * SENSOR_VALUESまたはSTEP_ANALYSISのセンサー値の取得を開始します。
   * @param {string} [notification_type="STEP_ANALYSIS"] STEP_ANALYSIS, SENSOR_VALUES, STEP_ANALYSIS_AND_SENSOR_VALUES
   * @param {object} [options={range:{acc:-1, gyro:-1}}] {range:{acc:[2,4,8,16],gyro:[250,500,1000,2000]}
   * @async
   * @return {Promise<string>} 
   * 
   */
  async begin(
    str_type = 'STEP_ANALYSIS',
    options = {
      range: { acc: -1, gyro: -1 }
    }
  ) {
    // ----------------------------------------------
    // @Depricated beginの引数である RAW, ANALYSISに関して混乱を招くので、setup()でのUUID設定に合わせ
    // RAW: SENSOR_VALUES, ANALYSIS: STEP_ANALYSIS に変更することとした。しばらくは両方の引数を受け付ける
    if (str_type == 'RAW') {
      str_type = 'SENSOR_VALUES';
      console.warn("RAW is deprecated. Please use SENSOR_VALUES instead.");
    }
    if (str_type == 'ANALYSIS') {
      str_type = 'STEP_ANALYSIS';
      console.warn("ANALYSIS is deprecated. Please use STEP_ANALYSIS instead.");
    }
    if (str_type == 'ANALYSIS_AND_RAW') {
      str_type = 'STEP_ANALYSIS_AND_SENSOR_VALUES';
      console.warn("ANALYSIS_AND_RAW is deprecated. Please use STEP_ANALYSIS_AND_SENSOR_VALUES instead.");
    }
    // Deprecated開始: 2024/05/25
    // ----------------------------------------------


    const {
      range = { acc: -1, gyro: -1 },
      autoReconnect = false
    } = options;
    this.notification_type = str_type;
    if (autoReconnect) {
      this._enableAutoReconnect(str_type, options);
    } else if (!this._autoReconnectInProgress) {
      this._disableAutoReconnect();
    }

    if (this._bridge) {
      this._bridge.release();
      this._bridge = null;
      this._isBridgeSecondary = false;
    }

    // ── BleSharedBridge: 別タブに Primary が存在するか確認 ──────────────
    if (typeof BleSharedBridge !== 'undefined' && options.useSharedBridge !== false) {
      const bridge = new BleSharedBridge(this.id);
      if (bridge.isRemotePrimaryAvailable()) {
        return this._beginAsSecondary(bridge, str_type);
      }
    }
    // ────────────────────────────────────────────────────────────────────

    await this.scan('DEVICE_INFORMATION', options);
    let obj = await this.getDeviceInformation();

    if (range.acc == 16) obj.range.acc = 3;
    if (range.acc == 8) obj.range.acc = 2;
    if (range.acc == 4) obj.range.acc = 1;
    if (range.acc == 2) obj.range.acc = 0;
    if (range.gyro == 2000) obj.range.gyro = 3;
    if (range.gyro == 1000) obj.range.gyro = 2;
    if (range.gyro == 500) obj.range.gyro = 1;
    if (range.gyro == 250) obj.range.gyro = 0;

    // 設定値の書き換え    CORE 2の場合、デバイス情報の書き込みに時間がかかることがあるため、現状コードはスキップさせます
    await this.setDeviceInformation(obj);
    console.log("Device Information set:", obj);

    await new Promise(resolve => setTimeout(resolve, 500));

    // DateTimeキャラクタリスティックを利用して時刻を同期する．現在のPC時間とデータ取得にかかる統計値からその分コアの時計を進めておく．
    await this.syncCoreTime();

    // ここで実際にnotifyを開始しています．
    return new Promise((resolve, reject) => {

      if (str_type == "STEP_ANALYSIS") {

        this.startNotify('STEP_ANALYSIS').then(() => {
          resolve("done begin(); STEP ANALYSIS");
        })
          .catch(err => {
            reject('User cancel.')
          }
          );
      }
      else if (str_type == "SENSOR_VALUES") {
        this.startNotify('SENSOR_VALUES').then(() => {
          resolve("done begin(); SENSOR VALUES");
        });
      }
      else if (str_type == "STEP_ANALYSIS_AND_SENSOR_VALUES") {
        this.startNotify('STEP_ANALYSIS').then(() => {
          this.startNotify('SENSOR_VALUES').then(() => {
            resolve("done begin(); STEP_ANALYSIS and SENSOR VALUES");
          });
        });
      }
      })
      .then(async (result) => {
        if (result && this.bluetoothDevice) {
          this._rememberBluetoothDevice(this.bluetoothDevice);
          this._attachAutoReconnectDisconnectHandler(this.bluetoothDevice);
        }

        // BleSharedBridge: BLE接続成功後にこのタブを Primary として登録
        if (typeof BleSharedBridge !== 'undefined' && options.useSharedBridge !== false && result) {
          this._bridge = new BleSharedBridge(this.id);
          this._isBridgeSecondary = false;
          this._bridge.claimPrimary();

          // Primary の BLE が予期せず切断された場合、他タブへ通知する
          if (this.bluetoothDevice && !this._bridgeBleDisconnectHooked) {
            this._bridgeBleDisconnectHooked = true;
            this.bluetoothDevice.addEventListener('gattserverdisconnected', () => {
              if (this._bridge && this._bridge.isPrimary) {
                this._bridge.broadcastDisconnect();
                this._bridge = null;
              }
            });
          }
        }
        return result;
      })
      .catch(error => {  // ダイアログのキャンセルはそのまま閉じる
        this._reportError(error);
        return;
      });

  }


  _reportError(error) {
    if (this._suppressAutoReconnectErrors) {
      this._lastAutoReconnectError = error;
      return;
    }
    this.onError(error);
  }

  _enableAutoReconnect(str_type, options = {}) {
    this._autoReconnectEnabled = true;
    this._autoReconnectNotificationType = str_type;
    this._autoReconnectOptions = Object.assign({}, options, { autoReconnect: true });
  }

  _disableAutoReconnect() {
    this._autoReconnectEnabled = false;
    this._autoReconnectInProgress = false;
    this._suppressAutoReconnectErrors = false;
  }

  _autoReconnectIntervalMs() {
    const interval = Number(this._autoReconnectOptions.reconnectIntervalMs);
    return Number.isFinite(interval) && interval >= 0 ? interval : 3000;
  }

  _autoReconnectMaxAttempts() {
    const attempts = Number(this._autoReconnectOptions.reconnectMaxAttempts);
    return Number.isFinite(attempts) && attempts > 0 ? attempts : 120;
  }

  _autoReconnectWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _attachAutoReconnectDisconnectHandler(device) {
    if (!device?.addEventListener) return;
    if (this._autoReconnectDevice === device) return;
    if (this._autoReconnectDevice?.removeEventListener) {
      try {
        this._autoReconnectDevice.removeEventListener('gattserverdisconnected', this._autoReconnectDisconnectHandler);
      } catch (_) {}
    }
    this._autoReconnectDevice = device;
    device.addEventListener('gattserverdisconnected', this._autoReconnectDisconnectHandler);
  }

  async _restoreAutoReconnectDevice() {
    if (this.bluetoothDevice) return true;
    const rememberedDevice = await this._requestRememberedBluetoothDevice();
    if (!rememberedDevice) return false;
    this.bluetoothDevice = rememberedDevice;
    this._usingRememberedBluetoothDevice = true;
    this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
    this._attachAutoReconnectDisconnectHandler(this.bluetoothDevice);
    this.onScan(this.bluetoothDevice.name);
    return true;
  }

  _handleAutoReconnectDisconnect() {
    if (!this._autoReconnectEnabled || this._autoReconnectInProgress) return;
    if (this._bridge && this._bridge.isPrimary) {
      this._bridge.broadcastDisconnect();
      this._bridge = null;
    }
    this._startAutoReconnect();
  }

  async _startAutoReconnect() {
    if (!this._autoReconnectEnabled || this._autoReconnectInProgress) return;

    this._autoReconnectInProgress = true;
    const startedAt = Date.now();
    const maxAttempts = this._autoReconnectMaxAttempts();
    const intervalMs = this._autoReconnectIntervalMs();
    let lastError = null;

    for (let attempt = 1; this._autoReconnectEnabled && attempt <= maxAttempts; attempt++) {
      this.onReconnectAttempt({ attempt, maxAttempts, intervalMs });

      try {
        const hasDevice = await this._restoreAutoReconnectDevice();
        if (!hasDevice) throw new Error('Last connected Bluetooth device not found. Please reconnect manually.');

        this._lastAutoReconnectError = null;
        this._suppressAutoReconnectErrors = true;
        const result = await this.begin(this._autoReconnectNotificationType, this._autoReconnectOptions);
        this._suppressAutoReconnectErrors = false;

        if (result) {
          this._autoReconnectInProgress = false;
          this.onReconnectSuccess({
            attempt,
            maxAttempts,
            elapsedMs: Date.now() - startedAt,
            result,
          });
          return;
        }

        lastError = this._lastAutoReconnectError || new Error('Auto reconnect attempt failed.');
      } catch (error) {
        this._suppressAutoReconnectErrors = false;
        lastError = error;
      }

      if (!this._autoReconnectEnabled || attempt >= maxAttempts) break;
      await this._autoReconnectWait(intervalMs);
    }

    this._autoReconnectInProgress = false;
    const error = lastError || new Error('Auto reconnect failed.');
    this.onReconnectFailed({ maxAttempts, elapsedMs: Date.now() - startedAt, error });
    this._reportError(error);
  }



  /**
   * stop and disconnect GATT connection
   */
  stop() {
    this.reset();
  }

  /**
   * set LED mode
   * @param {int} on_off 0: turning off the LED, 1: turning on the LED
   * @param {int} pattern 0-4
   */
  setLED(on_off, pattern) {
    const data = new Uint8Array([0x02, on_off, pattern]);
    this.write('DEVICE_INFORMATION', data);
  }
  /**
   * sets the LED Brightness
   * @param {uint8} value 0-255, 0:turning off the LED
   */
  setLEDBrightness(value) {
    this.array_device_information.setUint8(2, value);
    this.write('DEVICE_INFORMATION', this.array_device_information);
  }
  /**
   * set Mount Position of Core module
   * @param {int} position 0-3, 0:left-instep, 1:right-instep, 2:left-plantar, 3:right-plantar
   */
  async setMountPosition(position) {
    if (position < 0 || position > 3) {
      throw new Error("Invalid position");
    }
    let obj = await this.getDeviceInformation();
    obj.lr = parseInt(position);
    this.setDeviceInformation(obj);
  }

  /**
   * Reset motion sensor attitude, quaternion culculation.
   */
  resetMotionSensorAttitude() {
    const data = new Uint8Array([0x03]);
    return this.write('DEVICE_INFORMATION', data);
  }
  /**
   * Reset Analysis logs in the core module.
   */
  resetAnalysisLogs() {
    const data = new Uint8Array([4]);
    const writePromise = this.write('DEVICE_INFORMATION', [4]);
    this.gait = {
      type: 0,
      direction: 0,
      calorie: 0,
      distance: 0,
      steps: 0,
      standing_phase_duration: 0,
      swing_phase_duration: 0
    };

    this.stride = {
      foot_angle: 0,
      x: 0,
      y: 0,
      z: 0,
      steps: 0
    };

    this.pronation = {
      landing_impact: 0,
      x: 0,
      y: 0,
      z: 0,
      steps: 0
    };

    this.steps_number = 0;
    return writePromise;
  }
  scan(uuid, options = {}) {
    if (this.bluetoothDevice) {
      if (options.forceDeviceSelection || this._isBluetoothDeviceDisallowed(this.bluetoothDevice, options)) {
        if (this.bluetoothDevice?.gatt?.connected) {
          try { this.bluetoothDevice.gatt.disconnect(); } catch (_) {}
        }
        this.bluetoothDevice = null;
        this.dataCharacteristic = null;
        this._usingRememberedBluetoothDevice = false;
      } else {
        return Promise.resolve();
      }
    }

    const useRememberedDevice = !options.forceDeviceSelection &&
      !this._rememberedBluetoothDeviceUnavailable &&
      this._getLastBluetoothDeviceInfo();
    return (useRememberedDevice ? this._requestRememberedBluetoothDevice() : Promise.resolve(null))
      .then(device => {
        if (!device) return this.requestDevice(uuid, options);
        if (this._isBluetoothDeviceDisallowed(device, options)) {
          this.forgetLastBluetoothDevice();
          const error = new Error('This ORPHE CORE is already assigned to another slot.');
          error.name = 'DuplicateBluetoothDeviceError';
          throw error;
        }
        this.bluetoothDevice = device;
        this._usingRememberedBluetoothDevice = true;
        this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
        this.onScan(this.bluetoothDevice.name);
      })
      .catch(error => {
        this._reportError(error);
        throw error;
      });
  }
  /**
   * Execute requestDevice()
   * @param {string} uuid 
   * 
   */
  requestDevice(uuid, connectionOptions = {}) {
    let requestOptions = {
      /*
      ORPHE core module name: CR-2, CR-3
      service UUIDを ORPHE_OTHER_SERVICE に指定することで，ORPHE core moduleのみを検出することができます．さらに，namePrefixを指定することで，CR-2, CR-3のみを検出することができます．
      */
      filters: [
        { services: [this.ORPHE_INFORMATION] }
        // { namePrefix: ['CR-'] }
      ],
      acceptAllDevices: false,
      optionalServices: [
        this.ORPHE_INFORMATION,
        this.ORPHE_OTHER_SERVICE
      ]
    }

    return navigator.bluetooth.requestDevice(requestOptions)
      .then(device => {
        if (this._isBluetoothDeviceDisallowed(device, connectionOptions)) {
          const error = new Error('This ORPHE CORE is already assigned to another slot.');
          error.name = 'DuplicateBluetoothDeviceError';
          throw error;
        }
        this.bluetoothDevice = device;
        this._usingRememberedBluetoothDevice = false;
        this._rememberedBluetoothDeviceUnavailable = false;
        this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
        this.onScan(this.bluetoothDevice.name);
      });
  }

  _isBluetoothDeviceDisallowed(device, options = {}) {
    if (!device) return false;
    const disallowedIds = options.disallowBluetoothDeviceIds || [];
    return !!device.id && Array.isArray(disallowedIds) && disallowedIds.includes(device.id);
  }

  /**
   * 前回デバイスの記憶を使わず、必ずブラウザのBLE選択ダイアログを表示する。
   * 接続済みCOREから別COREへ手動で切り替える場合に利用する。
   * @param {string} uuid
   */
  selectBluetoothDevice(uuid = 'DEVICE_INFORMATION', options = {}) {
    this._disableAutoReconnect();
    this.forgetLastBluetoothDevice();
    if (this._bridge) {
      if (this._bridge.isPrimary) this._bridge.broadcastDisconnect();
      else this._bridge.release();
      this._bridge = null;
      this._isBridgeSecondary = false;
    }
    if (this.bluetoothDevice?.gatt?.connected) {
      try { this.bluetoothDevice.gatt.disconnect(); } catch (_) {}
    }
    this.bluetoothDevice = null;
    this.dataCharacteristic = null;
    this._usingRememberedBluetoothDevice = false;
    this._rememberedBluetoothDeviceUnavailable = false;
    return this.requestDevice(uuid, options);
  }

  /**
   * 最後に接続成功した Bluetooth デバイス情報を忘れる。
   * 次回 begin() 時に手動選択ダイアログから別デバイスへ切り替えたい場合に利用する。
   */
  forgetLastBluetoothDevice() {
    this._rememberedBluetoothDeviceUnavailable = false;
    try { localStorage.removeItem(this._lastBluetoothDeviceStorageKey); } catch (_) {}
  }

  _rememberBluetoothDevice(device) {
    if (!device) return;
    this._rememberedBluetoothDeviceUnavailable = false;
    try {
      localStorage.setItem(this._lastBluetoothDeviceStorageKey, JSON.stringify({
        deviceId: this.id,
        bluetoothId: device.id || '',
        bluetoothName: device.name || '',
        lastConnectedAt: Date.now(),
      }));
    } catch (_) {}
  }

  _getLastBluetoothDeviceInfo() {
    try {
      const raw = localStorage.getItem(this._lastBluetoothDeviceStorageKey);
      if (!raw) return null;
      const info = JSON.parse(raw);
      if (!info || (!info.bluetoothId && !info.bluetoothName)) return null;
      return info;
    } catch (_) {
      return null;
    }
  }

  _findLastBluetoothDevice(devices) {
    const info = this._getLastBluetoothDeviceInfo();
    return this._findBluetoothDevice(devices, info);
  }

  _findBluetoothDevice(devices, info) {
    if (!info || !Array.isArray(devices)) return null;
    const bluetoothId = info.bluetoothId || info.id || '';
    const bluetoothName = info.bluetoothName || info.name || '';

    if (bluetoothId) {
      const matchedById = devices.find(device => device.id === bluetoothId);
      if (matchedById) return matchedById;
    }

    if (bluetoothName) {
      const matchedByName = devices.filter(device => device.name === bluetoothName);
      if (matchedByName.length === 1) return matchedByName[0];
    }

    return null;
  }

  async _requestRememberedBluetoothDevice() {
    if (!navigator.bluetooth?.getDevices) return null;
    try {
      const devices = await navigator.bluetooth.getDevices();
      return this._findLastBluetoothDevice(devices);
    } catch (_) {
      return null;
    }
  }

  /**
   * GATT通信を始めるための関数。read, write, startNotify, stopNotifyが呼び出されるとscanと一緒に呼び出されます。
   * @param {string} uuid 
   *
   */
  connectGATT(uuid) {
    if (!this.bluetoothDevice) {
      var error = "No Bluetooth Device";
      this._reportError(error);
      return Promise.reject(error);
    }
    if (this.bluetoothDevice.gatt.connected && this.dataCharacteristic) {
      if (this.hashUUID_lastConnected == uuid)
        return Promise.resolve();
    }
    this.hashUUID_lastConnected = uuid;

    return this.bluetoothDevice.gatt.connect()
      .then(server => {
        return server.getPrimaryService(this.hashUUID[uuid].serviceUUID);
      })
      .then(service => {
        return service.getCharacteristic(this.hashUUID[uuid].characteristicUUID);
      })
      .then(characteristic => {
        this.dataCharacteristic = characteristic;
        this.onConnectGATT(uuid);
        this.onConnect(uuid);
      })
      .catch(error => {
        this._reportError(error);
        if (this._usingRememberedBluetoothDevice) {
          this._rememberedBluetoothDeviceUnavailable = true;
          this._usingRememberedBluetoothDevice = false;
          this.bluetoothDevice = null;
          this.dataCharacteristic = null;
        }
        throw error;
      });
  }
  /**
   * サーバからのデータを受信したときに呼び出される関数です。この関数は、characteristicvaluechangedイベントが発生したときに呼び出されます。
   * @param {function} self 
   * @param {string} uuid 
   * 
   */
  dataChanged(self, uuid) {
    return function (event) {
      self.onRead(event.target.value, uuid);
    }
  }

  _queueGattOperation(operation) {
    const run = this._gattOperationQueue.catch(() => {}).then(operation);
    this._gattOperationQueue = run.catch(() => {});
    return run;
  }

  /**
   * サーバからデータを読み込む。notificationからはonReadで呼び出されるので、この関数を利用するのは DEVICE_INFORMATION characteristicのみです。
   * @param {string} uuid DEVICE_INFORMATION
   * 
   */
  read(uuid) {
    return this._queueGattOperation(() => (this.scan(uuid))
      .then(() => {
        return this.connectGATT(uuid);
      })
      .then(() => {
        return this.dataCharacteristic.readValue();
      })
      .catch(error => {
        this._reportError(error);
        throw error;
      }));
  }
  /**
   * write data to the BLE device。実際にwriteを利用するのは DEVICE_INFORMATION characteristicのみです。
   * @param {string} uuid DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS
   * @param {dataView} array_value write bytes
   * 
   */
  write(uuid, array_value) {
    return this._queueGattOperation(() => (this.scan(uuid))
      .then(() => {
        return this.connectGATT(uuid);
      })
      .then(() => {
        const data = Uint8Array.from(array_value);
        return this.dataCharacteristic.writeValue(data);
      })
      .then(() => {
        this.onWrite(uuid);
      })
      .catch(error => {
        this._reportError(error);
        throw error;
      }));
  }
  /**
   * Start Notification
   * @param {string} uuid 
   * 
   */
  startNotify(uuid) {
    return this._queueGattOperation(() => this.scan(uuid)
      .then(() => this.connectGATT(uuid))
      .then(() => this.dataCharacteristic.startNotifications())
      .then(() => {
        this.dataChangedEventHandlerMap[uuid] = this.dataChanged(this, uuid);
        this.dataCharacteristic.addEventListener('characteristicvaluechanged', this.dataChangedEventHandlerMap[uuid]);
        this.onStartNotify(uuid);
      })
      .catch(error => {
        console.error('startNotify: Error : ' + error);
        this._reportError(error);
        throw error;
      }));
  }
  /**
   * Stop Notification
   * @param {string} uuid 
   * 
   */
  stopNotify(uuid) {
    return this._queueGattOperation(() => this.scan(uuid) // BLEデバイスのスキャンを開始します。
      .then(() => {
        return this.connectGATT(uuid); // GATTサーバーに接続します。
      })
      .then(() => {
        // stopNotificationsメソッドを呼び出してNotificationを停止します。
        // このメソッドはPromiseを返すため、その完了を待つ必要があります。
        return this.dataCharacteristic.stopNotifications();
      })
      .then(() => {
        // Notificationを停止した後のコールバック関数を呼び出します。
        // this.dataCharacteristic.removeEventListener('characteristicvaluechanged', this.dataChanged(this, uuid));
        // イベントハンドラを解除
        if (this.dataChangedEventHandlerMap[uuid]) {
          this.dataCharacteristic.removeEventListener(
            'characteristicvaluechanged',
            this.dataChangedEventHandlerMap[uuid]
          );
          // 登録されたハンドラをマップから削除
          delete this.dataChangedEventHandlerMap[uuid];
        }
        this.onStopNotify(uuid);
      })
      .catch(error => {
        this._reportError(error);
        throw error;
      }));

  }
  isConnected() {
    if (!this.bluetoothDevice) {
      return false;
    }
    return this.bluetoothDevice.gatt.connected;
  }

  /**
   * BLEデバイスとの接続を切断します。デバイス接続をマニュアルで切断する場合には reset() を利用してください。切断だけでなくクラス内のメンバ変数もクリア初期化する必要があり、reset()を利用するとそれらの処理が行われます。
   * 
   */
  disconnect() {
    if (!this.bluetoothDevice) {
      var error = "No Bluetooth Device";
      this._reportError(error);
      return;
    }

    if (this.bluetoothDevice.gatt.connected) {
      this.bluetoothDevice.gatt.disconnect();
    } else {
      var error = "Bluetooth Device is already disconnected";
      this._reportError(error);
      return;
    }
  }
  /**
   * this.device_informationの連想配列形式でデータを渡すことで、コアモジュールのデバイス設定ができます。
   * @param {object} obj 
   */
  setDeviceInformation(obj) {
    const senddata = new Uint8Array([0x01, obj.lr, obj.led_brightness, 0, obj.rec_auto_run, obj.time01, obj.time02, obj.range.acc, obj.range.gyro]);
    return this.write('DEVICE_INFORMATION', senddata);
  }

  /**
   * COREモジュールの時刻を PCの時刻 + random_trip_time/2 で同期します。
   * 
   * @param {number}[n=3] n - 平均値算出のためのサンプル数
   * @return {object} {sum_round_trip_time, average_round_trip_time, standard_time, adjusted_time, round_trip_times}
   */
  async syncCoreTime(n = 3) {
    let average_round_trip_time = 0;
    let sum_round_trip_time = 0;
    let core_time;
    let round_trip_times = [];
    for (let i = 0; i < n; i++) {
      core_time = await this.getDateTime();
      sum_round_trip_time += core_time.round_trip_time;
      round_trip_times.push(core_time.round_trip_time);
    }
    average_round_trip_time = sum_round_trip_time / n;
    const now = new Date();
    const standard_time = now.getTime();
    const adjusted_time = parseInt(standard_time + Math.round(average_round_trip_time / 2));
    core_time.date.setTime(adjusted_time);

    await this.setDateTime(core_time.date);
    this.half_round_trip_time = Math.round(average_round_trip_time / 2);
    return { sum_round_trip_time, average_round_trip_time, standard_time, adjusted_time, round_trip_times };

  }
  /**
   * [YY, MM, DD, hh, mm, ss, (sub)ss]の配列を渡すことで、コアモジュールの日時設定ができます。
   */
  async setDateTime(set_date) {
    const array = new Uint8Array(7);
    array[0] = set_date.getFullYear() - 2000;
    array[1] = set_date.getMonth() + 1;
    array[2] = set_date.getDate();
    array[3] = set_date.getHours();
    array[4] = set_date.getMinutes();
    array[5] = set_date.getSeconds();
    array[6] = parseInt(set_date.getMilliseconds() / 10);
    const senddata = new Uint8Array([array[0], array[1], array[2], array[3], array[4], array[5], array[6]]);
    await this.write('DATE_TIME', senddata);
  }

  /**
   * 接続情報をクリアします。
   */
  clear() {
    this.bluetoothDevice = null;
    this.dataCharacteristic = null;
    this.onClear();
  }
  /**
   * reset(disconnect & clear)
   */
  reset() {
    this._disableAutoReconnect();
    const wasBridgeSecondary = this._isBridgeSecondary;

    // BleSharedBridge: 切断を他タブに通知してリソース解放
    if (this._bridge) {
      if (this._bridge.isPrimary) this._bridge.broadcastDisconnect();
      else this._bridge.release();
      this._bridge = null;
      this._isBridgeSecondary = false;
    }

    if (!wasBridgeSecondary && this.bluetoothDevice?.gatt?.connected) {
      this.disconnect(); //disconnect() is not Promise Object
    }
    this.clear();
    this.onReset();
  }

  /**
   * Secondary として begin する（BleSharedBridge 用内部メソッド）
   * @param {BleSharedBridge} bridge
   * @param {string} str_type
   * @returns {Promise<string>}
   */
  _beginAsSecondary(bridge, str_type) {
    if (this._bridge && this._bridge !== bridge) this._bridge.release();
    this._bridge = bridge;
    this._isBridgeSecondary = true;

    // Primary から受信するコールバック名の一覧。
    // onRead() 内で発火するものをすべて列挙する。
    const BRIDGE_CALLBACK_NAMES = [
      'gotAcc', 'gotGyro', 'gotQuat', 'gotEuler',
      'gotConvertedAcc', 'gotConvertedGyro', 'gotDelta',
      'gotGait', 'gotType', 'gotDirection', 'gotDistance', 'gotCalorie',
      'gotStandingPhaseDuration', 'gotSwingPhaseDuration',
      'gotStride', 'gotFootAngle',
      'gotPronation', 'gotLandingImpact',
      'gotStepsNumber', 'gotBLEFrequency',
    ];
    const callbacks = {};
    for (const name of BRIDGE_CALLBACK_NAMES) {
      callbacks[name] = (d) => this[name](d);
    }
    callbacks.onPrimaryLost = () => this._handlePrimaryLost(str_type);

    bridge.subscribeAsSecondary(callbacks);
    this.onConnect('BRIDGE_SECONDARY');
    return Promise.resolve('done begin(); BRIDGE SECONDARY');
  }

  /**
   * Primary 喪失時の処理。ランダム遅延を挟んでリーダー選出を行い、
   * - 他タブが先に Primary になった → Secondary に戻る
   * - 自分が先着 → Fast Reconnect で BLE 接続
   * - Fast Reconnect 不可 → 手動接続を促す
   * @param {string} str_type
   */
  async _handlePrimaryLost(str_type) {
    // 多重発火ガード
    if (!this._isBridgeSecondary) return;
    this._isBridgeSecondary = false;

    if (this._bridge) {
      this._bridge.release();
      this._bridge = null;
    }
    this.onDisconnect();

    // 全 Secondary が同時に再接続するのを避けるためランダム遅延
    const delay = Math.random() * BleSharedBridge.ELECTION_MAX_DELAY_MS;
    await new Promise(r => setTimeout(r, delay));

    // 遅延中に他タブが Primary を取っていれば Secondary として再購読
    const probe = new BleSharedBridge(this.id);
    if (probe.isRemotePrimaryAvailable()) {
      await this._beginAsSecondary(probe, str_type);
      return;
    }

    // Fast Reconnect: ペアリング済みデバイスならダイアログなしで接続
    if (navigator.bluetooth?.getDevices) {
      try {
        const devices = await navigator.bluetooth.getDevices();
        const lastDeviceInfo = this._getLastBluetoothDeviceInfo();
        const selectedDevice = this._findBluetoothDevice(devices, this.bluetoothDevice);
        if (selectedDevice) {
          this.bluetoothDevice = selectedDevice;
          this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
          await this.begin(str_type);
          return;
        }
        const rememberedDevice = this._findLastBluetoothDevice(devices);
        if (rememberedDevice) {
          this.bluetoothDevice = rememberedDevice;
          this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
          await this.begin(str_type);
          return;
        }
        if (!lastDeviceInfo && devices.length === 1) {
          this.bluetoothDevice = devices[0];
          this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
          await this.begin(str_type);
          return;
        }
        if (lastDeviceInfo && devices.length > 0) {
          this._reportError('Last connected Bluetooth device not found. Please reconnect manually.');
          return;
        }
        if (devices.length > 1) {
          this._reportError('Multiple paired devices found. Please reconnect manually.');
          return;
        }
      } catch (_) {}
    }

    this._reportError('Primary tab closed. Please reconnect manually.');
  }





  /**
   * BleSharedBridge 用: 単一コールバックのデータを配信
   * @param {string} callbackName
   * @param {Object} data
   */
  _notifyBridge(callbackName, data) {
    if (this._bridge && this._bridge.isPrimary) {
      this._bridge.broadcast(callbackName, data);
    }
  }

  /**
   * BleSharedBridge 用: 複数コールバックをまとめて配信（メッセージ数を削減）
   * @param {Object<string, Object>} batch
   */
  _notifyBridgeBatch(batch) {
    if (this._bridge && this._bridge.isPrimary) {
      this._bridge.broadcastBatch(batch);
    }
  }

  // Readコールバック
  /**
   * Incoming byte callback function. コアモジュールから送信されるデータを受信するコールバック関数です。それぞれのUUIDに対応するデータを正しく整形して対応するコールバック関数に渡します。ユーザはコールバック関数を手元のコードでオーバーライドして利用します。gotData()がユーザによってオーバーライドされている場合は、gotData以外のnotifyに伴うコールバック関数はすべて呼び出されないことに注意してください。
   * @param {dataView} data incoming bytes
   * @param {string} uuid 
   */
  onRead(data, uuid) {
    let ret = this.timestamp.getHz();
    if (ret > 0) this.gotBLEFrequency(ret);

    // 生データモニタリングの場合はそのままデータをgotDataで渡して、returnする（データ欠損以外の他の処理は行わない）
    if (this.isGotDataOverridden() == true) {
      this.gotData(data, uuid);
      // データ欠損チェック
      if (uuid == 'SENSOR_VALUES') {
        // 魔改造200Hzの場合はヘッダが50
        if (data.getUint8(0) == 50) {
          if (this.serial_number) {
            const serial_number_prev = this.serial_number;
            this.serial_number = data.getUint16(1);

            // データ欠損が生じた場合
            if (this.serial_number - serial_number_prev != 1) {

              // 線形補完を有効にしている場合
              if (this.interpolation.enabled == true) {

              }
              // ユーザ用コールバック関数の呼び出し
              this.lostData(this.serial_number, serial_number_prev);

            }

          }
          else {
            this.serial_number = data.getUint16(1);
          }
        }
      }
      return;
    }

    // デバイス情報Readの場合    
    if (uuid == 'DEVICE_INFORMATION') {
      console.log(this.array_device_information);

      /*
      read pay load
                  0: バッテリー残量
                  1: 左右
                  2: 記録モード
                  3: 自動ラン記録
                  4: LEDの明るさ
                  5: モーターの強さ
                  6: ログの単位時間(上位)
                  7: ログの単位時間(下位)
                  8: 加速度レンジ
                  9: ジャイロレンジ
                  --------------
                  write pay load
                  0: ヘッダー1
                  1: 左右
                  2: LEDの明るさ
                  3: モーターの強さ
                  4: 自動ラン記録On,Off
                  5: ログの単位時間(上位)
                  6: ログの単位時間(下位)
                  7: 加速度レンジ
                  8: ジャイロレンジ
                  9-19: 0
      */
      this.array_device_information.setUint8(0, 1);
      this.array_device_information.setUint8(1, data.getUint8(1));
      this.array_device_information.setUint8(2, data.getUint8(4));
      this.array_device_information.setUint8(3, data.getUint8(5));
      this.array_device_information.setUint8(4, data.getUint8(3));
      this.array_device_information.setUint8(5, data.getUint8(6));
      this.array_device_information.setUint8(6, data.getUint8(7));
      this.array_device_information.setUint8(7, data.getUint8(8));
      this.array_device_information.setUint8(8, data.getUint8(9));
      for (let i = 9; i <= 19; i++) {
        this.array_device_information.setUint8(i, 0);
      }
      this.device_information = {
        battery: data.getUint8(0),
        lr: data.getUint8(1),
        rec_mode: data.getUint8(2),
        rec_auto_run: data.getUint8(3),
        led_brightness: data.getUint8(4),
        time01: data.getUint8(6),
        time02: data.getUint8(7),
        range: {
          acc: data.getUint8(8),
          gyro: data.getUint8(9)
        }
      }
    }
    else if (uuid == 'STEP_ANALYSIS') {
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);

      const {
        Float16Array, isFloat16Array, isTypedArray,
        getFloat16, setFloat16,
        hfround,
      } = float16;
      const header = data.getUint8(1);
      const steps_now = data.getUint16(2);
      if ((0 <= header && header <= 2) && steps_now > this.steps_number) {
        this.gotStepsNumber({ value: steps_now });
        this._notifyBridge('gotStepsNumber', { value: steps_now });
        this.steps_number = steps_now;
      }

      // Gait Overview
      if (data.getUint8(1) == 0 && steps_now > this.gait.steps) {
        let type = data.getUint8(4);
        type = type & 0b11000000;
        type = type >>> 6;
        let direction = data.getUint8(4);
        direction = direction & 0b00111000;
        direction = direction >>> 3;
        const calorie = getFloat16(data, 6);
        const dist = data.getFloat32(8);
        this.gait.type = type;
        this.gait.direction = direction;
        this.gait.calorie = calorie;
        this.gait.distance = dist;
        this.gait.steps = steps_now;
        this.gait.standing_phase_duration = data.getFloat32(12);
        this.gait.swing_phase_duration = data.getFloat32(16);
        this.gotGait(this.gait);
        this.gotType({ value: this.gait.type });
        this.gotDistance({ value: this.gait.distance });
        this.gotDirection({ value: this.gait.direction });
        this.gotCalorie({ value: this.gait.calorie });
        this.gotStandingPhaseDuration({ value: this.gait.standing_phase_duration });
        this.gotSwingPhaseDuration({ value: this.gait.swing_phase_duration });
        this._notifyBridgeBatch({
          gotGait: this.gait,
          gotType: { value: this.gait.type },
          gotDistance: { value: this.gait.distance },
          gotDirection: { value: this.gait.direction },
          gotCalorie: { value: this.gait.calorie },
          gotStandingPhaseDuration: { value: this.gait.standing_phase_duration },
          gotSwingPhaseDuration: { value: this.gait.swing_phase_duration },
        });
      }
      // Stride
      else if (data.getUint8(1) == 1 && steps_now > this.stride.steps) {
        this.stride.foot_angle = data.getFloat32(4);
        this.stride.x = data.getFloat32(8);
        this.stride.y = data.getFloat32(12);
        this.stride.z = data.getFloat32(16);
        this.stride.steps = steps_now;
        this.gotFootAngle({ value: this.stride.foot_angle });
        this.gotStride({
          x: this.stride.x,
          y: this.stride.y,
          z: this.stride.z,
          steps_number: this.stride.steps
        });
        this._notifyBridgeBatch({
          gotFootAngle: { value: this.stride.foot_angle },
          gotStride: { x: this.stride.x, y: this.stride.y, z: this.stride.z, steps_number: this.stride.steps },
        });
      }
      // Pronation
      else if (data.getUint8(1) == 2 && steps_now > this.pronation.steps) {
        this.pronation.landing_impact = data.getFloat32(4);
        this.pronation.x = data.getFloat32(8);
        this.pronation.y = data.getFloat32(12);
        this.pronation.z = data.getFloat32(16);
        this.pronation.steps = steps_now;
        this.gotPronation({
          x: this.pronation.x,
          y: this.pronation.y,
          z: this.pronation.z
        });
        this.gotLandingImpact({ value: this.pronation.landing_impact });
        this._notifyBridgeBatch({
          gotPronation: { x: this.pronation.x, y: this.pronation.y, z: this.pronation.z },
          gotLandingImpact: { value: this.pronation.landing_impact },
        });

      }
      // Stride Attitude -- Not implemented
      else if (data.getUint8(1) == 3) {

      }
      // Quat and delta
      else if (data.getUint8(1) == 4) {
        this.quat = {
          w: getFloat16(data, 6),
          x: getFloat16(data, 8),
          y: getFloat16(data, 10),
          z: getFloat16(data, 12)
        }
        this.delta = {
          x: getFloat16(data, 14),
          y: getFloat16(data, 16),
          z: getFloat16(data, 18)
        }

        let q = new Quaternion(this.quat.w, this.quat.x, this.quat.y, this.quat.z);
        this.euler = q.toEuler();

        this.gotQuat(this.quat);
        this.gotDelta(this.delta);
        this.gotEuler(this.euler);
        this._notifyBridgeBatch({
          gotQuat: this.quat,
          gotDelta: this.delta,
          gotEuler: this.euler,
        });
      }
      // Sensor test
      else if (data.getUint8(1) == 5) {

      }
      // delta elapsed time test
      else if (data.getUint8(1) == 6) {

      }
    }
    else if (uuid == 'SENSOR_VALUES') {


      // 魔改造200Hzの場合はヘッダが50
      if (data.getUint8(0) == 50) {

        // データ欠損チェック
        if (this.serial_number) {
          const serial_number_prev = this.serial_number;
          this.serial_number = data.getUint16(1);
          if (this.serial_number - serial_number_prev != 1) {
            this.lostData(this.serial_number, serial_number_prev);
          }
        }
        else {
          this.serial_number = data.getUint16(1);
        }

        // エラー処理
        if (data.byteLength != 92) {
          console.warn("SENSOR VALUES: Data length is not 92");
          return
        }


        // COREから送られてきたタイムスタンプをUNIXタイムスタンプに変換
        function toTimestamp(hours, minutes, seconds, milliseconds) {
          // 現在の日付を取得
          const now = new Date();

          // Dateオブジェクトに時間を設定
          now.setHours(hours);
          now.setMinutes(minutes);
          now.setSeconds(seconds);
          now.setMilliseconds(milliseconds);

          // タイムスタンプ（ミリ秒）を返す
          return now.getTime();
        }
        let timestamp = toTimestamp(
          data.getUint8(3),
          data.getUint8(4),
          data.getUint8(5),
          data.getUint16(6)
        )

        let gyroRange = this.device_information.range.gyro;
        let accRange = this.device_information.range.acc;


        // 値を変換
        if (gyroRange == 0) gyroRange = 250;
        if (gyroRange == 1) gyroRange = 500;
        if (gyroRange == 2) gyroRange = 1000;
        if (gyroRange == 3) gyroRange = 2000;
        if (accRange == 0) accRange = 2;
        if (accRange == 1) accRange = 4;
        if (accRange == 2) accRange = 8;
        if (accRange == 3) accRange = 16;

        let t_start = timestamp;

        // それぞれの値は29毎で、4つ分ある。データの順番は古いデータから順番にpushされている。なので、最新が4番目、最古が1番目となる。
        for (let i = 3; i >= 0; i--) {

          // 2番目以降のtimestampは最初のタイムスタンプとの差分になっているため
          // t_startに数値を足す処理を行って、各パケットのtimestampを算出する
          if (i == 3) {
            timestamp = t_start;
          }
          else {
            timestamp = timestamp + data.getUint8(28 + 21 * i);
          }
          this.quat = {
            w: data.getInt16(8 + 21 * i) / 32768,
            x: data.getInt16(10 + 21 * i) / 32768,
            y: data.getInt16(12 + 21 * i) / 32768,
            z: data.getInt16(14 + 21 * i) / 32768,
            timestamp: timestamp,
            serial_number: this.serial_number,
            packet_number: 3 - i
          }
          this.history_sensor_values.quat.push(this.quat);

          this.gyro = {
            x: data.getInt16(16 + 21 * i) / 32768,
            y: data.getInt16(18 + 21 * i) / 32768,
            z: data.getInt16(20 + 21 * i) / 32768,
            timestamp: timestamp,
            serial_number: this.serial_number,
            packet_number: 3 - i
          }
          this.history_sensor_values.gyro.push(this.gyro);

          this.acc = {
            x: data.getInt16(22 + 21 * i) / 32768,
            y: data.getInt16(24 + 21 * i) / 32768,
            z: data.getInt16(26 + 21 * i) / 32768,
            timestamp: timestamp,
            serial_number: this.serial_number,
            packet_number: 3 - i
          }
          this.history_sensor_values.acc.push(this.acc);

          // ジャイロと加速度補正をかけたものを別途作成
          this.converted_gyro = {
            x: this.gyro.x * gyroRange,
            y: this.gyro.y * gyroRange,
            z: this.gyro.z * gyroRange,
            timestamp: timestamp,
            serial_number: this.serial_number,
            packet_number: 3 - i
          };
          this.history_sensor_values.converted_gyro.push(this.converted_gyro);

          this.converted_acc = {
            x: this.acc.x * accRange,
            y: this.acc.y * accRange,
            z: this.acc.z * accRange,
            timestamp: timestamp,
            serial_number: this.serial_number,
            packet_number: 3 - i
          };
          this.history_sensor_values.converted_acc.push(this.converted_acc);

          this.gotAcc(this.acc);
          this.gotQuat(this.quat);
          this.gotGyro(this.gyro);
          this.gotConvertedAcc(this.converted_acc);
          this.gotConvertedGyro(this.converted_gyro);
          let q = new Quaternion(this.quat.w, this.quat.x, this.quat.y, this.quat.z);
          this.euler = q.toEuler();
          this.gotEuler(this.euler);
          this._notifyBridgeBatch({
            gotAcc: this.acc,
            gotQuat: this.quat,
            gotGyro: this.gyro,
            gotConvertedAcc: this.converted_acc,
            gotConvertedGyro: this.converted_gyro,
            gotEuler: this.euler,
          });
        }

      }
      // 通常のupdate sensor valuesであればヘッダは40。このときにはserial_numberはパケットに含まれていない
      else if (data.getUint8(0) == 40) {

        // CORE 2.0 の通常 SENSOR_VALUES は quaternion が Q14 形式で入る。
        // Q15 (/32768) として読むと norm が約 0.5 になり、Euler 角が不安定になる。
        const quatScale = 16384;
        this.quat = {
          w: data.getInt16(1) / quatScale,
          x: data.getInt16(3) / quatScale,
          y: data.getInt16(5) / quatScale,
          z: data.getInt16(7) / quatScale
        }
        this.gyro = {
          x: data.getInt8(9) / 127,
          y: data.getInt8(10) / 127,
          z: data.getInt8(11) / 127
        }
        this.acc = {
          x: data.getInt8(14) / 127,
          y: data.getInt8(15) / 127,
          z: data.getInt8(16) / 127
        }
        // ジャイロと加速度補正をかけたものを別途作成
        let gyroRange = this.device_information.range.gyro;
        let accRange = this.device_information.range.acc;

        // 値を変換
        if (gyroRange == 0) gyroRange = 250;
        if (gyroRange == 1) gyroRange = 500;
        if (gyroRange == 2) gyroRange = 1000;
        if (gyroRange == 3) gyroRange = 2000;
        if (accRange == 0) accRange = 2;
        if (accRange == 1) accRange = 4;
        if (accRange == 2) accRange = 8;
        if (accRange == 3) accRange = 16;

        this.converted_gyro = {
          x: this.gyro.x * gyroRange,
          y: this.gyro.y * gyroRange,
          z: this.gyro.z * gyroRange,
        };
        this.converted_acc = {
          x: this.acc.x * accRange,
          y: this.acc.y * accRange,
          z: this.acc.z * accRange,
        };

        this.gotAcc(this.acc);
        this.gotQuat(this.quat);
        this.gotGyro(this.gyro);
        this.gotConvertedAcc(this.converted_acc);
        this.gotConvertedGyro(this.converted_gyro);
        let q = new Quaternion(this.quat.w, this.quat.x, this.quat.y, this.quat.z).normalize();
        this.euler = q.toEuler();
        this.gotEuler(this.euler);
        this._notifyBridgeBatch({
          gotAcc: this.acc,
          gotQuat: this.quat,
          gotGyro: this.gyro,
          gotConvertedAcc: this.converted_acc,
          gotConvertedGyro: this.converted_gyro,
          gotEuler: this.euler,
        });
      }
    }
  }

  /**
   * Date Timeを取得する
   * 0	year	0-255	西暦から2000を引いた数
   * 1	month		
   * 2	day		
   * 3	hour		
   * 4	minute		
   * 5	second		
   * 6	subsecond
   * 
   * @returns {Promise<object>} date_timeを連想配列形式{timestamp, data,round_trip_time}で返す。dataにはCOREから直接送信されてきたdataviewが格納されている。round_trip_timeはデータを取得にかかった時間[ms]。
   */
  async getDateTime() {
    return new Promise((resolve, reject) => {
      const startTime = performance.now(); // 関数開始時の時間を取得
      this.read('DATE_TIME').then((data) => {
        const endTime = performance.now(); // データの取得が完了したので，時間を記録
        const date = new Date(
          data.getUint8(0) + 2000,
          data.getUint8(1),
          data.getUint8(2),
          data.getUint8(3),
          data.getUint8(4),
          data.getUint8(5),
          data.getUint8(6) * 10 // 10ms単位で送られてくる
        );
        const elapsedTime = endTime - startTime; // 経過時間を計算
        this.date_time = {
          date: date,
          data: data,
          round_trip_time: Math.floor(elapsedTime)
        };
        resolve(this.date_time);
      }).catch(error => {  // ダイアログのキャンセルはそのまま閉じる
        console.log('Error: ' + error);
        this._reportError(error);
        reject(error);
      });
    });
  }

  /**
   * 呼び出すと現在のデバイス設定を取得します。連想配列形式でリターンされます。asyncに対応させているので、awaitを利用して呼び出すことをおすすめします。
   * @returns {Promise<object>} device_informationを連想配列形式で返す
   */
  async getDeviceInformation() {
    return new Promise((resolve, reject) => {
      this.read('DEVICE_INFORMATION').then((data) => {
        this.array_device_information.setUint8(0, 1);
        this.array_device_information.setUint8(1, data.getUint8(1));
        this.array_device_information.setUint8(2, data.getUint8(4));
        this.array_device_information.setUint8(3, data.getUint8(5));
        this.array_device_information.setUint8(4, data.getUint8(3));
        this.array_device_information.setUint8(5, data.getUint8(6));
        this.array_device_information.setUint8(6, data.getUint8(7));
        this.array_device_information.setUint8(7, data.getUint8(8));
        this.array_device_information.setUint8(8, data.getUint8(9));
        for (let i = 9; i <= 19; i++) {
          this.array_device_information.setUint8(i, 0);
        }
        this.device_information = {
          battery: data.getUint8(0),
          lr: data.getUint8(1),
          rec_mode: data.getUint8(2),
          rec_auto_run: data.getUint8(3),
          led_brightness: data.getUint8(4),
          range: {
            acc: data.getUint8(8),
            gyro: data.getUint8(9)
          },
          data: data
        }
        resolve(this.device_information);
      }).catch(error => {  // ダイアログのキャンセルはそのまま閉じる
        console.log('Error: ' + error);
        this._reportError(error);
        reject(error);
      });
    });
  }


  //--------------------------------------------------
  //一般開発ユーザからアクセス可能な関数のプロトタイプ定義
  /**
   * ORPHE TERMINAL用に作成した関数。onReadで受け取ったデータをそのまま渡す。このメソッドがユーザ側でオーバーライドされると、その他のnotifyに伴うコールバック関数（gotAcc等）はすべて呼び出されなくなるので注意してください。dataview形式なので、取り扱い方法については ORPHE TERMINALのソースを参照するとよい。
   * @param {dataview} data onReadで取得したすべてのデータ
   */
  gotData(data) { }

  /**
   * コアモジュールのクオータニオン情報を取得する
   * @param {Object} quat {w,x,y,z} クオータニオンの取得
   */
  gotQuat(quat) { }
  /**
   * ジャイロ（x,y,zの角速度）を取得する
   * @param {Object} gyro {x,y,z} ジャイロの取得
   */
  gotGyro(gyro) { }
  /**
   * 加速度を取得する。加速度レンジに応じて変換された値がほしい場合は、gotConvertedAccを利用すること
   * 対応CharacteristicはSENSOR_VALUES
   * @param {Object} acc {x,y,z} 加速度の取得
   */
  gotAcc(acc) { }
  /**
   * ジャイロレンジに応じて変換された値を取得する。
   * @param {Object} gyro {x,y,z} ジャイロレンジに応じて変換したジャイロの取得
   */
  gotConvertedGyro(gyro) { }
  /**
   * コアモジュールで設定されている加速度レンジに応じて変換された値を取得する。
   * @param {Object} acc {x,y,z} 加速度レンジに応じて変換した加速度の取得
   */
  gotConvertedAcc(acc) { }
  /**
   * 加速度値を2回積分して各x,y,zの単位時間の移動距離を取得する。
   * @param {Object} delta {x,y,z} x,y,zの前回フレームからの移動距離
   */
  gotDelta(delta) { }
  /**
   * コアモジュールのオイラー角を取得する。オイラー角の取得は破綻する可能性があるため、姿勢を取る場合はクオータニオンを利用すること
   * @param {Object} euler {pitch, roll, yaw} オイラー角
   */
  gotEuler(euler) { }
  /**
   * 歩容解析の取得
   * @param {Object} gait {type, direction, calorie, distance} 歩行解析の取得
   */
  gotGait(gait) { }
  /**
   * 現在の歩容タイプを取得する
   * @param {Object} type {value} 0:none, 1:walk, 2:run, 3:stand 
   */
  gotType(type) { }
  /**
   * ランニングの方向を取得する
   * @param {Object} direction {value} 0:none, 1:foward, 2:backward, 3:inside, 4:outside
   */
  gotDirection(direction) { }
  /**
   * 総消費カロリーを取得する
   * @param {Object} calorie {value}
   */
  gotCalorie(calorie) { }

  /**
   * 総移動距離を取得する
   * @param {Object} distance {value} 
   */
  gotDistance(distance) { }

  /**
   * 立脚期継続時間[s]を取得する
   * @param {*} standing_phase_duration 
   */
  gotStandingPhaseDuration(standing_phase_duration) { }

  /**
   * 遊脚期継続時間[s]を取得する
   * @param {*} swing_phase_duration 
   */
  gotSwingPhaseDuration(swing_phase_duration) { }
  /**
   * ストライド[m]の取得
   * @param {Object} stride {x,y,z}
   */
  gotStride(stride) { }
  /**
   * 着地角度[degree]の取得
   * @param {Object} foot_angle {value}
   */
  gotFootAngle(foot_angle) { }

  /**
   * プロネーション[degree]の取得
   * @param {Object} pronation {x,y,z}
   */
  gotPronation(pronation) { }
  /**
   * 着地衝撃力[kgf/weight]の取得
   * @param {Object} landing_impact {value}
   */
  gotLandingImpact(landing_impact) { }
  /**
   * 現在までの歩数を取得する
   * @param {Object} steps_number {value}
   */
  gotStepsNumber(steps_number) { }

  /**
   * 以前来たデータとのシリアルナンバーの差が1でない場合に呼び出される。SENSOR_VALUESのcharacteristicを利用し、かつ、200Hzのデータ取得のモデル（CR-3）のみで利用可能。50Hzの加速度センサーのデータ取得モデル（CR-2）では利用できない。
   * @param {number} serial_number - 現在のシリアルナンバー
   * @param {number} serial_number_prev - 一つ前に受診したデータのシリアルナンバー
   */
  lostData(serial_number, serial_number_prev) { }

  onScan(deviceName) { console.log("onScan"); }
  onConnectGATT(uuid) { console.log("onConnectGATT"); }
  onConnect(uuid) { console.log("onConnect"); }
  onWrite(uuid) { console.log("onWrite"); }
  onStartNotify(uuid) { console.log("onStartNotify", uuid); }
  onStopNotify(uuid) { console.log("onStopNotify", uuid); }
  onDisconnect() { console.log("onDisconnect"); }
  onReconnectAttempt(info) { }
  onReconnectSuccess(info) { }
  onReconnectFailed(info) { }

  /**
   * notification frequencyの実測値を取得する
   * @param {float} frequency 
   */
  gotBLEFrequency(frequency) { }
  onClear() { console.log("onClear"); }
  onReset() { console.log("onReset"); }
  onError(error) { console.log("onError: ", error); }

  //一般開発ユーザからアクセス可能な関数の定義ここまで
  //--------------------------------------------------
}
