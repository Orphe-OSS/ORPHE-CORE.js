var orphe_js_version_date = `
Last modified: 2026/06/10 00:00:00
`;
/**
ORPHE-INSOLE.js is javascript library for ORPHE INSOLE Module, inspired by BlueJelly.js
Class形式で記述を変更したバージョン
v1.1.0 接続安定化（デバイス記憶・高速再接続・自動再接続）、クラス名を OrpheInsole に変更（Orphe はエイリアスとして維持）
v0.9.0 ベータ版
@module OrpheInsole
@author Tetsuaki BABA
@version 1.1.0

@see https://github.com/Orphe-OSS/ORPHE-INSOLE.js
*/

// 外部スクリプトを読み込む関数
function loadScript(src) {
  if (typeof document === 'undefined') return;
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

// 外部スクリプトの読み込み
function _orpheInsoleAutoLoadOptionalLibs() {
  loadScript('https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js@main/js/float16.min.js');
  loadScript('https://cdn.jsdelivr.net/gh/Orphe-OSS/ORPHE-CORE.js@main/js/quaternion.js');
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _orpheInsoleAutoLoadOptionalLibs, { once: true });
  } else {
    _orpheInsoleAutoLoadOptionalLibs();
  }
}

// ── ライブラリ本体 ────────────────────────────────────────────────
// ORPHE-CORE.js と同一ページで共存できるよう、クラス宣言
// (FixedSizeArray, OrpheTimestamp など) をトップレベルに置かず IIFE で包む。
// トップレベルの class 宣言はグローバルなレキシカル束縛を作るため、
// CORE と INSOLE の両方を読み込むと SyntaxError で後勝ちスクリプト全体が死ぬ。
(function (global) {

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

function _orpheInsoleTimestampToday(hours, minutes, seconds, milliseconds) {
  const now = new Date();
  now.setHours(hours);
  now.setMinutes(minutes);
  now.setSeconds(seconds);
  now.setMilliseconds(milliseconds);
  return now.getTime();
}

/**
 * ORPHE INSOLE SENSOR_VALUES packet parser.
 * @param {DataView} data
 * @param {object} options
 * @param {number} [options.gyroRange=2000]
 * @param {number} [options.accRange=16]
 * @returns {object|null}
 */
function parseInsoleSensorValues(data, options = {}) {
  if (!data || typeof data.getUint8 !== 'function') {
    throw new TypeError('parseInsoleSensorValues expects a DataView');
  }
  if (data.byteLength !== 104) return null;

  const header = data.getUint8(0);
  const serial_number = data.getUint16(1);
  const gyroRange = Number.isFinite(Number(options.gyroRange)) ? Number(options.gyroRange) : 2000;
  const accRange = Number.isFinite(Number(options.accRange)) ? Number(options.accRange) : 16;
  const t_start = _orpheInsoleTimestampToday(
    data.getUint8(3),
    data.getUint8(4),
    data.getUint8(5),
    data.getUint16(6)
  );
  const samples = [];

  function vector3(x, y, z, timestamp, packet_number) {
    return {
      x: data.getInt16(x) / 32768,
      y: data.getInt16(y) / 32768,
      z: data.getInt16(z) / 32768,
      timestamp,
      serial_number,
      packet_number
    };
  }

  function quat(w, x, y, z, timestamp, packet_number) {
    return {
      w: data.getInt16(w) / 32768,
      x: data.getInt16(x) / 32768,
      y: data.getInt16(y) / 32768,
      z: data.getInt16(z) / 32768,
      timestamp,
      serial_number,
      packet_number
    };
  }

  function withConverted(sample) {
    if (sample.gyro) {
      sample.converted_gyro = {
        x: sample.gyro.x * gyroRange,
        y: sample.gyro.y * gyroRange,
        z: sample.gyro.z * gyroRange,
        timestamp: sample.timestamp,
        serial_number,
        packet_number: sample.packet_number
      };
    }
    if (sample.acc) {
      sample.converted_acc = {
        x: sample.acc.x * accRange,
        y: sample.acc.y * accRange,
        z: sample.acc.z * accRange,
        timestamp: sample.timestamp,
        serial_number,
        packet_number: sample.packet_number
      };
    }
    return sample;
  }

  if (header === 50) {
    let timestamp = t_start;
    for (let i = 3; i >= 0; i--) {
      if (i !== 3) timestamp += data.getUint8(28 + 21 * i);
      samples.push(withConverted({
        timestamp,
        serial_number,
        packet_number: 3 - i,
        quat: quat(8 + 21 * i, 10 + 21 * i, 12 + 21 * i, 14 + 21 * i, timestamp, 3 - i),
        gyro: vector3(16 + 21 * i, 18 + 21 * i, 20 + 21 * i, timestamp, 3 - i),
        acc: vector3(22 + 21 * i, 24 + 21 * i, 26 + 21 * i, timestamp, 3 - i)
      }));
    }
  } else if (header === 55) {
    const offset = 24;
    for (let i = 3; i >= 0; i--) {
      const timestamp = t_start;
      const packet_number = 3 - i;
      samples.push(withConverted({
        timestamp,
        serial_number,
        packet_number,
        gyro: vector3(8 + offset * i, 10 + offset * i, 12 + offset * i, timestamp, packet_number),
        acc: vector3(14 + offset * i, 16 + offset * i, 18 + offset * i, timestamp, packet_number),
        press: {
          values: [
            data.getUint16(20 + offset * i),
            data.getUint16(22 + offset * i),
            data.getUint16(24 + offset * i),
            data.getUint16(26 + offset * i),
            data.getUint16(28 + offset * i),
            data.getUint16(30 + offset * i)
          ],
          timestamp,
          serial_number,
          packet_number
        }
      }));
    }
  } else if (header === 56) {
    const offset = 32;
    for (let i = 1; i >= 0; i--) {
      const timestamp = t_start;
      const packet_number = 1 - i;
      samples.push(withConverted({
        timestamp,
        serial_number,
        packet_number,
        quat: quat(8 + offset * i, 10 + offset * i, 12 + offset * i, 14 + offset * i, timestamp, packet_number),
        gyro: vector3(16 + offset * i, 18 + offset * i, 20 + offset * i, timestamp, packet_number),
        acc: vector3(22 + offset * i, 24 + offset * i, 26 + offset * i, timestamp, packet_number),
        press: {
          values: [
            data.getUint16(28 + offset * i),
            data.getUint16(30 + offset * i),
            data.getUint16(32 + offset * i),
            data.getUint16(34 + offset * i),
            data.getUint16(36 + offset * i),
            data.getUint16(38 + offset * i)
          ],
          timestamp,
          serial_number,
          packet_number
        }
      }));
    }
  } else {
    return { header, serial_number, timestamp: t_start, samples: [] };
  }

  return { header, serial_number, timestamp: t_start, samples };
}

/**
 * ORPHE INSOLE Module Javascript class
* @class
* @type {Object}
* @property {string} ORPHE_INFORMATION "01a9d6b5-ff6e-444a-b266-0be75e85c064" SERVICE_UUID
* @property {string} ORPHE_DEVICE_INFORMATION "24354f22-1c46-430e-a4ab-a1eeabbcdfc0" CHARACTERISTIC_UUID
*
* @property {string} ORPHE_OTHER_SERVICE "db1b7aca-cda5-4453-a49b-33a53d3f0833" SERVICE_UUID
* @property {string} ORPHE_SENSOR_VALUES "f3f9c7ce-46ee-4205-89ac-abe64e626c0f" CHARACTERISTIC_UUID
* @property {string} ORPHE_STEP_ANALYSIS "4eb776dc-cf99-4af7-b2d3-ad0f791a79dd" CHARACTERISTIC_UUID
*/
class OrpheInsole {
  /**
   * SENSOR_VALUES の DataView を ORPHE INSOLE のサンプル列に変換する。
   * @param {DataView} data
   * @param {object} options
   * @returns {object|null}
   */
  static parseSensorValues(data, options = {}) {
    return parseInsoleSensorValues(data, options);
  }

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


    // Initialize member variables
    this.bluetoothDevice = null;
    this.dataCharacteristic = null;// 通知を行うcharacteristicを保持する
    this.dataChangedEventHandlerMap = {}; // イベントハンドラを保持するマップ
    this.hashUUID = {}; // UUIDを保持するハッシュ
    this.hashUUID_lastConnected; // 最後に接続したUUIDを保持する
    this.id = id;
    this.array_device_information = new DataView(new ArrayBuffer(20));// device information用の配列

    /**
     * デバッグログ（console.info）の出力を有効にするフラグです。
     * 接続トラブル調査時に true にしてください。
     */
    this.debug = false;

    // ── 接続安定化まわりの内部状態 ───────────────────────────────
    // デバイス記憶: 一度接続したデバイスを localStorage に記憶し、
    // navigator.bluetooth.getDevices() (Chrome flag: Web Bluetooth New Permissions Backend)
    // が使える環境では選択ダイアログなしで再接続できる。
    this._lastBluetoothDeviceStorageKey = `orphe_insole_last_bluetooth_device_${id}`;
    this._usingRememberedBluetoothDevice = false;
    this._rememberedBluetoothDeviceUnavailable = false;
    // 自動再接続
    this._autoReconnectEnabled = false;
    this._autoReconnectInProgress = false;
    this._autoReconnectOptions = {};
    this._autoReconnectDevice = null;
    this._autoReconnectDisconnectHandler = (event) => this._handleAutoReconnectDisconnect(event);
    this._suppressAutoReconnectErrors = false;
    this._lastAutoReconnectError = null;
    // gattserverdisconnected 用 遅延バインドハンドラ。
    // this.onDisconnect を直接 addEventListener すると、リスナー登録後に
    // ユーザが onDisconnect を上書きしても古い関数が呼ばれ続けるため、
    // 必ずこのラッパーを登録する。
    this._onDisconnectHandler = (event) => this.onDisconnect(event);

    /**
   * デバイスインフォメーションを取得して保存しておく連想配列です。begin()を呼び出すとデバイスから値を取得して初期化されます。
   * @property {Object} device_information - デバイス情報
   * @property {number} device_information.battery - バッテリー残量（少ない:0、普通:1、多い:2）
   * @property {number} device_information.mount_position - コアモジュール取り付け位置（左右情報）
  bit0 : 左右
  bit1 : 0(足底) / 1(足背)
  足底 : 左、右：0=(0000 0000b), 1=(0000 0001b)、
  足背 : 左、右：2(=0000 0010b), 3(=0000 0011b)
   * @property {Object} device_information.range - 加速度とジャイロセンサの感度設定
   * @property {number} device_information.range.acc - 加速度レンジ（ 2, 4, 8, 16(g)：0, 1, 2, 3）
   * @property {number} device_information.range.gyro - ジャイロレンジ（250, 500, 1000, 2000(°/s)：0, 1, 2, 3）
  */
    this.device_information = '';

    /**
     * 歩容解析のデータを保存しておく連想配列です。
     * 注意: ORPHE INSOLE のファームウェアは現状 STEP_ANALYSIS 通知に未対応のため、
     * この値が更新されることはありません（FW対応待ち）。
     * @property {Object} gait - 歩容解析のデータ
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
     * ストライドのデータを保存しておく連想配列です。（STEP_ANALYSIS FW対応待ち）
     */
    this.stride = {
      foot_angle: 0,
      x: 0,
      y: 0,
      z: 0,
      steps: 0,
    }
    /**
   * プロネーションのデータを保存しておく連想配列です。（STEP_ANALYSIS FW対応待ち）
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
     */
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
     */
    this.gyro = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * 加速度センサの値を保存する連想配列です。
     * @property {Object} acc - 加速度センサの値
     */
    this.acc = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * 圧力センサ（6ch）の最新値を保存する連想配列です。
     * @property {Object} press - 圧力センサの値
     * @property {number[]} press.values - 6チャネル分のADC生値
     */
    this.press = {
      values: [0, 0, 0, 0, 0, 0]
    }

    /**
     * ジャイロレンジに合わせて変換したジャイロセンサの値を保存する連想配列です。
     */
    this.converted_gyro = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * 加速度レンジに合わせて変換した加速度センサの値を保存する連想配列です。
     */
    this.converted_acc = {
      x: 0.0, y: 0.0, z: 0.0
    }

    /**
     * データ欠損時に線形補完をするかどうかのオプション設定（beginのオプションで設定可能）。この設定は200Hz sensor_valuesのacc, gyro, quatのみに適用されます。
     */
    this.interpolation = {
      enabled: false,
      max_consecutive_missing: 1
    }

    this.history_sensor_values = {
      acc: new FixedSizeArray(4),
      gyro: new FixedSizeArray(4),
      quat: new FixedSizeArray(4),
      press: new FixedSizeArray(4), // 圧力センサの値を保持する配列
      converted_acc: new FixedSizeArray(4),
      converted_gyro: new FixedSizeArray(4)
    }

    this.half_round_trip_time = 0;

    // Advertisement handling flags
    this.isFirstAdvertisementReceived = false;

    // メンバ変数の初期化ここまで
    //////////////////////////

  }

  _log(...args) {
    if (this.debug) console.info('[ORPHE-INSOLE]', ...args);
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
   * 最初に必要な初期化処理メソッドです。利用するキャラクタリスティック（DEVICE_INFORMATION, SENSOR_VALUES）の指定の他、オプションを指定することができます。通常利用では引数を省略して 今後の機能拡張を見据えたメソッドなので、基本的にはsetup()で呼び出せば良いです。
   * @param {string[]} [string[]=["DEVICE_INFORMATION","DATE_TIME", "SENSOR_VALUES"]] DEVICE_INFORMATION, DATE_TIME, SENSOR_VALUES,
   * @param {object} [options = {interpolation}] - interpolationは未実装
   *
   */
  setup(names = ['DEVICE_INFORMATION', 'DATE_TIME', 'SENSOR_VALUES'],
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
    }
  }

  /**
   *  begin BLE connection
   * SENSOR_VALUESのセンサー値の取得を開始します。
   * @param {string} [notification_type="SENSOR_VALUES"] SENSOR_VALUES
   * @param {object} [options]
   * @param {number} [options.streamingMode=4] データストリーミングモード（1, 3, 4）
   * @param {boolean} [options.autoReconnect=false] 切断時の自動再接続を有効化
   * @param {number} [options.reconnectIntervalMs=3000] 再接続試行の間隔
   * @param {number} [options.reconnectMaxAttempts=120] 再接続の最大試行回数
   * @async
   * @return {Promise<string>}
   *
   */
  async begin(str_type = 'SENSOR_VALUES', options = {}) {
    if (typeof str_type === 'object' && str_type !== null) {
      options = str_type;
      str_type = 'SENSOR_VALUES';
    }
    if (str_type == 'RAW') {
      str_type = 'SENSOR_VALUES';
      console.warn("RAW is deprecated. Please use SENSOR_VALUES instead.");
    }
    if (str_type != 'SENSOR_VALUES') {
      console.warn(`${str_type} is not supported on ORPHE INSOLE. SENSOR_VALUES will be used instead.`);
      str_type = 'SENSOR_VALUES';
    }
    const streamingMode = options.streamingMode ?? options.dataStreamingMode ?? 4;
    const autoReconnect = options.autoReconnect ?? false;

    this.notification_type = str_type;
    if (autoReconnect) {
      this._enableAutoReconnect(str_type, options);
    } else if (!this._autoReconnectInProgress) {
      this._disableAutoReconnect();
    }

    try {
      await this.getDeviceInformation();

      // データストリーミングモードは 100Hzのジャイロ、加速度、圧力、クオータニオンに設定
      /*
      0x01 : リアルタイム(クォータニオン、ジャイロ、加速度)
      0x03 : リアルタイム(ジャイロ、加速度、圧力 200Hz相当)※インソールのみ対応
      0x04 : リアルタイム(ジャイロ、加速度、圧力、クォータニオン 100Hz相当)※インソールのみ対応
      */
      await this.setDataStreamingMode(streamingMode);

      // DateTimeキャラクタリスティックを利用して時刻を同期する．現在のPC時間とデータ取得にかかる統計値からその分コアの時計を進めておく．
      await this.syncCoreTime();

      await this.startNotify('SENSOR_VALUES');

      // 接続成功: デバイスを記憶し、自動再接続用の切断検知を仕込む
      if (this.bluetoothDevice) {
        this._rememberBluetoothDevice(this.bluetoothDevice);
        this._attachAutoReconnectDisconnectHandler(this.bluetoothDevice);
      }
      return "done begin(); SENSOR VALUES";
    } catch (error) {
      this._reportError(error);
      throw error;
    }
  }

  /**
   * stop and disconnect GATT connection
   */
  stop() {
    this.reset();
  }


  // ── エラーレポート ───────────────────────────────────────────
  // 自動再接続の試行中は onError を逐一発火させず、最後のエラーとして保持する
  _reportError(error) {
    if (this._suppressAutoReconnectErrors) {
      this._lastAutoReconnectError = error;
      return;
    }
    this.onError(error);
  }

  // ── 自動再接続 ──────────────────────────────────────────────
  _enableAutoReconnect(str_type, options = {}) {
    this._autoReconnectEnabled = true;
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
      } catch (_) { }
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
    this.bluetoothDevice.addEventListener('gattserverdisconnected', this._onDisconnectHandler);
    this._attachAutoReconnectDisconnectHandler(this.bluetoothDevice);
    this.onScan(this.bluetoothDevice.name);
    return true;
  }

  _handleAutoReconnectDisconnect() {
    if (!this._autoReconnectEnabled || this._autoReconnectInProgress) return;
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
        const result = await this.begin(this.notification_type, this._autoReconnectOptions);
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

  // ── デバイス記憶（選択ダイアログなしの再接続） ─────────────────
  /**
   * 前回デバイスの記憶を使わず、必ずブラウザのBLE選択ダイアログを表示する。
   * 接続済みINSOLEから別INSOLEへ手動で切り替える場合に利用する。
   * @param {string} uuid
   */
  selectBluetoothDevice(uuid = 'DEVICE_INFORMATION') {
    this._disableAutoReconnect();
    this.forgetLastBluetoothDevice();
    if (this.bluetoothDevice?.gatt?.connected) {
      try { this.bluetoothDevice.gatt.disconnect(); } catch (_) { }
    }
    this.bluetoothDevice = null;
    this.dataCharacteristic = null;
    this._usingRememberedBluetoothDevice = false;
    this._rememberedBluetoothDeviceUnavailable = false;
    return this.requestDevice(uuid);
  }

  /**
   * 最後に接続成功した Bluetooth デバイス情報を忘れる。
   * 次回 begin() 時に手動選択ダイアログから別デバイスへ切り替えたい場合に利用する。
   */
  forgetLastBluetoothDevice() {
    this._rememberedBluetoothDeviceUnavailable = false;
    try { localStorage.removeItem(this._lastBluetoothDeviceStorageKey); } catch (_) { }
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
    } catch (_) { }
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
   * Reset Analysis logs in the core module.
   */
  resetAnalysisLogs() {
    const data = new Uint8Array([0x04]);
    this.write('DEVICE_INFORMATION', data);
  }
  scan(uuid, options = {}) {
    this._log('scan()', {
      uuid,
      hasBluetoothDevice: !!this.bluetoothDevice,
      hasNavigatorBluetooth: typeof navigator !== 'undefined' && !!navigator.bluetooth,
      options
    });
    if (this.bluetoothDevice) return Promise.resolve();

    const useRememberedDevice = !options.forceDeviceSelection &&
      !this._rememberedBluetoothDeviceUnavailable &&
      this._getLastBluetoothDeviceInfo();
    return (useRememberedDevice ? this._requestRememberedBluetoothDevice() : Promise.resolve(null))
      .then(device => {
        if (!device) return this.requestDevice(uuid);
        this.bluetoothDevice = device;
        this._usingRememberedBluetoothDevice = true;
        this.bluetoothDevice.addEventListener('gattserverdisconnected', this._onDisconnectHandler);
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
  requestDevice(uuid) {
    let options = {
      /*
      ORPHE insole module name: INS
      一部のINSOLE firmwareはadvertisementにservice UUIDを載せないため、
      chooserではINSのnamePrefixで候補を絞り、optionalServicesで接続後に必要なserviceへアクセスします。
      */
      filters: [
        { namePrefix: 'INS' }
      ],
      acceptAllDevices: false,
      optionalServices: [
        this.ORPHE_INFORMATION,
        this.ORPHE_OTHER_SERVICE
      ],
      optionalManufacturerData: [
        0x0000
      ]
    };

    this._log('requestDevice() before navigator.bluetooth.requestDevice', {
      uuid,
      options,
      hasNavigatorBluetooth: typeof navigator !== 'undefined' && !!navigator.bluetooth,
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : undefined,
      href: typeof window !== 'undefined' ? window.location.href : undefined
    });
    return navigator.bluetooth.requestDevice(options)
      .then(device => {
        this.bluetoothDevice = device;
        this._usingRememberedBluetoothDevice = false;
        this._rememberedBluetoothDeviceUnavailable = false;
        this.bluetoothDevice.addEventListener('gattserverdisconnected', this._onDisconnectHandler);
        this._log('requestDevice() selected device', {
          uuid,
          deviceName: this.bluetoothDevice.name,
          deviceId: this.bluetoothDevice.id
        });
        this.onScan(this.bluetoothDevice.name);

        // await this.autoStartWatchingAdvertisements();
      });
  }

  /**
   * アドバタイズメント監視を自動開始（機能が利用可能な場合のみ）
   */
  async autoStartWatchingAdvertisements() {
    // 機能が利用可能かチェック
    if (!this.bluetoothDevice) {
      return;
    }

    // watchAdvertisementsがサポートされているかチェック
    if (!navigator.bluetooth || !BluetoothDevice.prototype.watchAdvertisements) {
      console.log('Advertisement monitoring not available - Chrome experimental features may be disabled');
      return;
    }

    if (!this.bluetoothDevice.watchAdvertisements) {
      console.warn('watchAdvertisements is not supported on this device/browser');
      return;
    }

    // アドバタイズメント監視を自動開始
    await this.startWatchingAdvertisements();
  }

  /**
   * アドバタイズメントデータの監視を開始
   */
  startWatchingAdvertisements() {
    if (!this.bluetoothDevice) {
      console.error('Bluetooth device not available');
      return;
    }

    // watchAdvertisementsがサポートされているかチェック
    if (!this.bluetoothDevice.watchAdvertisements) {
      console.warn('watchAdvertisements is not supported on this device/browser');
      return;
    }

    // アドバタイズメントイベントリスナーを追加
    this.bluetoothDevice.addEventListener('advertisementreceived', (event) => {
      this.onAdvertisementReceived(event);
    });

    // アドバタイズメント監視を開始
    this.bluetoothDevice.watchAdvertisements()
      .then(() => {
        console.log('Started watching advertisements for', this.bluetoothDevice.name);
      })
      .catch(error => {
        console.error('Error starting advertisement watch:', error);
      });
  }

  /**
   * アドバタイズメントデータ受信時のコールバック
   * @param {BluetoothAdvertisingEvent} event
   */
  onAdvertisementReceived(event) {
    this._log('Advertisement Received', {
      name: event.device.name,
      rssi: event.rssi,
      txPower: event.txPower
    });

    const dv = event.manufacturerData.get(0x0000);

    // カスタムコールバックがあれば呼び出し
    if (this.gotStatus) {
      const status = {
        name: event.device.name,
        rssi: event.rssi,
        txPower: event.txPower,
        id: event.device.id,
        battery: dv.getUint8(14),
        model_type: dv.getUint8(5),
        mounting_position: dv.getUint8(6),
        human_activity_recognition: dv.getUint8(7),
        version: `${dv.getUint8(15)}.${dv.getUint8(16)}.${dv.getUint8(17)}`
      }
      this.gotStatus(status);
    }
  }

  /**
   * アドバタイズメント監視を停止
   */
  stopWatchingAdvertisements() {
    if (this.bluetoothDevice) {
      this.bluetoothDevice.removeEventListener('advertisementreceived', this.onAdvertisementReceived);
      console.log('Stopped watching advertisements');
    }
  }

  /**
   * GATT通信を始めるための関数。read, write, startNotify, stopNotifyが呼び出されるとscanと一緒に呼び出されます。
   * @param {string} uuid
   *
   */
  connectGATT(uuid) {
    this._log('connectGATT() start', {
      uuid,
      hasBluetoothDevice: !!this.bluetoothDevice,
      gattConnected: !!(this.bluetoothDevice && this.bluetoothDevice.gatt && this.bluetoothDevice.gatt.connected),
      hasDataCharacteristic: !!this.dataCharacteristic,
      lastConnected: this.hashUUID_lastConnected
    });
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

        // アドバタイズメント監視を自動開始（機能が利用可能な場合のみ）
        // this.autoStartWatchingAdvertisements();
      })
      .catch(error => {
        this._reportError(error);
        // 記憶していたデバイスが見つからない/権限切れの場合は記憶経由の接続を
        // 一旦諦め、次回 scan() でユーザに選択ダイアログを出す
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
  /**
   * サーバからデータを読み込む。notificationからはonReadで呼び出されるので、この関数を利用するのは DEVICE_INFORMATION characteristicのみです。
   * @param {string} uuid DEVICE_INFORMATION
   *
   */
  read(uuid) {
    return (this.scan(uuid))
      .then(() => {
        return this.connectGATT(uuid);
      })
      .then(() => {
        return this.dataCharacteristic.readValue();
      })
      .catch(error => {
        this._reportError(error);
        throw error; // エラーを再スローして、呼び出し側でキャッチできるようにする
      });
  }
  /**
   * write data to the BLE device。実際にwriteを利用するのは DEVICE_INFORMATION characteristicのみです。
   * @param {string} uuid DEVICE_INFORMATION, SENSOR_VALUES, STEP_ANALYSIS
   * @param {dataView} array_value write bytes
   *
   */
  write(uuid, array_value) {
    return (this.scan(uuid))
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
      });
  }
  /**
   * Start Notification
   * @param {string} uuid
   *
   */
  startNotify(uuid) {
    return this.scan(uuid)
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
      });
  }
  /**
   * Stop Notification
   * @param {string} uuid
   *
   */
  stopNotify(uuid) {
    return this.scan(uuid) // BLEデバイスのスキャンを開始します。
      .then(() => {
        return this.connectGATT(uuid); // GATTサーバーに接続します。
      })
      .then(() => {
        // stopNotificationsメソッドを呼び出してNotificationを停止します。
        // このメソッドはPromiseを返すため、その完了を待つ必要があります。
        return this.dataCharacteristic.stopNotifications();
      })
      .then(() => {
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
      });

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

    // アドバタイズメント監視を停止
    this.stopWatchingAdvertisements();

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
   * 注意: ORPHE INSOLE の現行ファームウェアでは未対応です。
   * @param {object} obj
   */
  setDeviceInformation(obj) {
    // この機能は insole では未対応とします。
    // const senddata = new Uint8Array([0x01, obj.lr, obj.led_brightness, 0, obj.rec_auto_run, obj.time01, obj.time02, obj.range.acc, obj.range.gyro]);
    // this.write('DEVICE_INFORMATION', senddata);
    const error = new Error('setDeviceInformation is not supported on ORPHE INSOLE.');
    console.warn(error.message);
    this._reportError(error);
  }

  /**
   * Sets the data streaming mode for the device.
   *
   * @param {number} mode - The streaming mode to set. Should be a valid mode value recognized by the device.
   * @returns {Promise<void>}
   */
  async setDataStreamingMode(mode = 4) {
    const normalizedMode = Number(mode);
    const supportedModes = [1, 3, 4];
    if (!Number.isInteger(normalizedMode) || !supportedModes.includes(normalizedMode)) {
      throw new Error(`Invalid ORPHE INSOLE data streaming mode: ${mode}. Use 1, 3, or 4.`);
    }
    const data = new Uint8Array([0x0D, normalizedMode]);
    await this.write('DEVICE_INFORMATION', data);
    this.streaming_mode = normalizedMode;
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
    this.isFirstAdvertisementReceived = false; // フラグをリセット
    this.onClear();
  }
  /**
   * reset(disconnect & clear)
   * マニュアル切断の意思表示とみなし、自動再接続も無効化します。
   */
  reset() {
    this._disableAutoReconnect();
    this.disconnect(); //disconnect() is not Promise Object
    this.clear();
    this.onReset();
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
        // 50,55,56がリアルタームデータ取得時の先頭ヘッダ
        if (data.getUint8(0) == 50 || data.getUint8(0) == 55 || data.getUint8(0) == 56) {
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
    }
    else if (uuid == 'SENSOR_VALUES') {
      const parsed = parseInsoleSensorValues(data);
      if (!parsed) {
        console.warn("SENSOR VALUES: Data length is not 104");
        return;
      }

      // データ欠損チェック
      if (this.serial_number) {
        const serial_number_prev = this.serial_number;
        this.serial_number = parsed.serial_number;
        if (this.serial_number - serial_number_prev != 1) {
          this.lostData(this.serial_number, serial_number_prev);
        }
      }
      else {
        this.serial_number = parsed.serial_number;
      }

      for (const sample of parsed.samples) {
        if (sample.quat) {
          this.quat = sample.quat;
          this.history_sensor_values.quat.push(this.quat);
        }
        if (sample.gyro) {
          this.gyro = sample.gyro;
          this.history_sensor_values.gyro.push(this.gyro);
        }
        if (sample.acc) {
          this.acc = sample.acc;
          this.history_sensor_values.acc.push(this.acc);
        }
        if (sample.press) {
          this.press = sample.press;
          this.history_sensor_values.press.push(this.press);
        }
        if (sample.converted_gyro) {
          this.converted_gyro = sample.converted_gyro;
          this.history_sensor_values.converted_gyro.push(this.converted_gyro);
        }
        if (sample.converted_acc) {
          this.converted_acc = sample.converted_acc;
          this.history_sensor_values.converted_acc.push(this.converted_acc);
        }

        if (sample.quat && typeof Quaternion !== 'undefined') {
          let q = new Quaternion(this.quat.w, this.quat.x, this.quat.y, this.quat.z);
          this.euler = q.toEuler();
        }

        if (parsed.header == 50) {
          this.gotAcc(this.acc);
          this.gotQuat(this.quat);
          this.gotGyro(this.gyro);
          this.gotConvertedAcc(this.converted_acc);
          this.gotConvertedGyro(this.converted_gyro);
          if (sample.quat && typeof Quaternion !== 'undefined') this.gotEuler(this.euler);
        }
        else if (parsed.header == 55) {
          this.gotAcc(this.acc);
          this.gotGyro(this.gyro);
          this.gotConvertedAcc(this.converted_acc);
          this.gotConvertedGyro(this.converted_gyro);
          this.gotPress(this.press);
        }
        else if (parsed.header == 56) {
          this.gotQuat(this.quat);
          if (sample.quat && typeof Quaternion !== 'undefined') this.gotEuler(this.euler);
          this.gotAcc(this.acc);
          this.gotGyro(this.gyro);
          this.gotConvertedAcc(this.converted_acc);
          this.gotConvertedGyro(this.converted_gyro);
          this.gotPress(this.press);
        }
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
          raw: data,
          round_trip_time: Math.floor(elapsedTime)
        };
        resolve(this.date_time);
      }).catch(error => {  // ダイアログのキャンセルはそのまま閉じる
        const message = error && error.message ? error.message : String(error);
        if (error && error.name === 'NotFoundError') {
          this._log('requestDevice chooser cancelled', { message });
        } else {
          console.log('Error: ' + error);
        }
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
        if (!data) {
          const error = new Error('No data received from DEVICE_INFORMATION');
          console.error('Error: ' + error.message);
          this._reportError(error);
          reject(error);
          return;
        }

        this.device_information = {
          battery: data.getUint8(0),
          mount_position: data.getUint8(1),
          range: {
            acc: data.getUint8(8),
            gyro: data.getUint8(9)
          },
          raw: data
        }
        resolve(this.device_information);
      }).catch(error => {  // ダイアログのキャンセルはそのまま閉じる
        const message = error && error.message ? error.message : String(error);
        if (error && error.name === 'NotFoundError') {
          this._log('requestDevice chooser cancelled', { message });
        } else {
          console.log('Error: ' + error);
        }
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
   * Handles the received status.
   * @param {Object} status - The status object containing device advertisement information.
   * @param {string} status.name - デバイス名
   * @param {number} status.rssi - 受信信号強度 (dBm)
   * @param {number} status.txPower - 送信出力 (dBm)
   * @param {string} status.id - デバイスID
   * @param {number} status.battery - バッテリー残量
   * @param {number} status.model_type - モデルタイプ
   * @param {number} status.mounting_position - 取り付け位置
   * @param {number} status.human_activity_recognition - 人間活動認識
   * @param {string} status.version - ファームウェアバージョン (例: "1.2.3")
   */
  gotStatus(status) {
  }
  /**
   * コアモジュールの圧力情報を取得する
   * @param {Object} press {values[],timestamp,packet_number} 圧力の取得
   */
  gotPress(press) { }

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
   * 歩容解析の取得（STEP_ANALYSIS FW対応待ちのため現状呼び出されません）
   * @param {Object} gait {type, direction, calorie, distance} 歩行解析の取得
   */
  gotGait(gait) { }
  /**
   * 現在の歩容タイプを取得する（STEP_ANALYSIS FW対応待ち）
   * @param {Object} type {value} 0:none, 1:walk, 2:run, 3:stand
   */
  gotType(type) { }
  /**
   * ランニングの方向を取得する（STEP_ANALYSIS FW対応待ち）
   * @param {Object} direction {value} 0:none, 1:foward, 2:backward, 3:inside, 4:outside
   */
  gotDirection(direction) { }
  /**
   * 総消費カロリーを取得する（STEP_ANALYSIS FW対応待ち）
   * @param {Object} calorie {value}
   */
  gotCalorie(calorie) { }

  /**
   * 総移動距離を取得する（STEP_ANALYSIS FW対応待ち）
   * @param {Object} distance {value}
   */
  gotDistance(distance) { }

  /**
   * 立脚期継続時間[s]を取得する（STEP_ANALYSIS FW対応待ち）
   * @param {*} standing_phase_duration
   */
  gotStandingPhaseDuration(standing_phase_duration) { }

  /**
   * 遊脚期継続時間[s]を取得する（STEP_ANALYSIS FW対応待ち）
   * @param {*} swing_phase_duration
   */
  gotSwingPhaseDuration(swing_phase_duration) { }
  /**
   * ストライド[m]の取得（STEP_ANALYSIS FW対応待ち）
   * @param {Object} stride {x,y,z}
   */
  gotStride(stride) { }
  /**
   * 着地角度[degree]の取得（STEP_ANALYSIS FW対応待ち）
   * @param {Object} foot_angle {value}
   */
  gotFootAngle(foot_angle) { }

  /**
   * プロネーション[degree]の取得（STEP_ANALYSIS FW対応待ち）
   * @param {Object} pronation {x,y,z}
   */
  gotPronation(pronation) { }
  /**
   * 着地衝撃力[kgf/weight]の取得（STEP_ANALYSIS FW対応待ち）
   * @param {Object} landing_impact {value}
   */
  gotLandingImpact(landing_impact) { }
  /**
   * 現在までの歩数を取得する（STEP_ANALYSIS FW対応待ち）
   * @param {Object} steps_number {value}
   */
  gotStepsNumber(steps_number) { }

  /**
   * 以前来たデータとのシリアルナンバーの差が1でない場合に呼び出される。SENSOR_VALUESのcharacteristicを利用したリアルタイムデータ取得時に利用可能。
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

  /**
   * 自動再接続の試行開始時に呼び出される
   * @param {Object} info {attempt, maxAttempts, intervalMs}
   */
  onReconnectAttempt(info) { }
  /**
   * 自動再接続成功時に呼び出される
   * @param {Object} info {attempt, maxAttempts, elapsedMs, result}
   */
  onReconnectSuccess(info) { }
  /**
   * 自動再接続が最大試行回数に達して失敗したときに呼び出される
   * @param {Object} info {maxAttempts, elapsedMs, error}
   */
  onReconnectFailed(info) { }

  /**
   * アドバタイズメントデータを受信した時に呼び出される
   * @param {BluetoothAdvertisingEvent} event - アドバタイズメントイベント
   */
  onAdvertisement(event) { console.log("onAdvertisement", event); }

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

// ── グローバル公開とエイリアス ─────────────────────────────────
// 推奨クラス名は OrpheInsole。
// 後方互換のため、同一ページに ORPHE-CORE.js が読み込まれていない場合に限り
// `Orphe` というエイリアスも公開する（CORE と同時読み込み時は CORE 側の
// `Orphe` が優先され、INSOLE は OrpheInsole で利用する）。
if (typeof global.OrpheInsole === 'undefined') {
  global.OrpheInsole = OrpheInsole;
}
let hasLexicalOrphe = false;
try {
  // CORE.js が先に読み込まれている場合、class Orphe のレキシカル束縛が見える
  hasLexicalOrphe = (typeof Orphe !== 'undefined');
} catch (_) {
  hasLexicalOrphe = true;
}
if (!hasLexicalOrphe && typeof global.Orphe === 'undefined') {
  global.Orphe = OrpheInsole;
}
// 補助クラス/関数も衝突しない形で公開（既存コードの直接利用との互換のため）
if (typeof global.FixedSizeArray === 'undefined') global.FixedSizeArray = FixedSizeArray;
if (typeof global.OrpheTimestamp === 'undefined') global.OrpheTimestamp = OrpheTimestamp;
if (typeof global.parseInsoleSensorValues === 'undefined') global.parseInsoleSensorValues = parseInsoleSensorValues;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Orphe: OrpheInsole,
    OrpheInsole,
    FixedSizeArray,
    OrpheTimestamp,
    parseInsoleSensorValues
  };
}

})(typeof globalThis !== 'undefined' ? globalThis : this);
