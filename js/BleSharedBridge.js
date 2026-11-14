var bleSharedBridge_version_date = `2026-11-10`;

/**
 * BleSharedBridge
 *
 * 複数のブラウザタブ間で ORPHE CORE の BLE 接続を共有するブリッジモジュール。
 *
 * 仕組み:
 *   - Primary tab   : BLE接続を保持し、センサーデータを BroadcastChannel で配信
 *   - Secondary tab : BLE接続不要。チャネルを購読してデータを受信し、通常の
 *                     got* コールバックをそのまま利用できる
 *
 * Primary検出:
 *   - localStorage にハートビート（1秒毎）を書き込む
 *   - `storage` イベントで他タブの変更を即時検知（ポーリング不要）
 *   - `pagehide` でタブ閉じ時にクリーン通知
 *   - 上記が抜けたケースに備えて 2秒ポーリングでフォールバック
 *
 * デバイス情報の共有:
 *   - Primary はハートビートに device_information（lr・range など）のスナップショットを載せる
 *   - Secondary は購読開始時と更新時に onDeviceInformation で受け取る
 *     （Secondary は BLE を持たないため、これが無いと device_information.lr が取れない）
 *
 * Primary喪失時:
 *   - 各 Secondary がランダム遅延（0〜1500ms）後に再接続を試みる
 *   - 遅延後に再度 localStorage を確認し、他タブが先に Primary になっていれば
 *     Secondary に戻る（暗黙的なリーダー選出）
 *   - Fast Reconnect: navigator.bluetooth.getDevices() でダイアログ不要の再接続
 */
class BleSharedBridge {
  /**
   * @param {number} deviceId - Orphe インスタンスの id (0 または 1)
   */
  constructor(deviceId) {
    this.deviceId = deviceId;
    this._storageKey = `orphe_bridge_primary_${deviceId}`;
    this._channelName = `orphe-ble-bridge-${deviceId}`;
    this._tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.isPrimary = false;
    this._channel = null;
    this._heartbeatInterval = null;
    this._watchInterval = null;
    this._storageListener = null;
    this._pagehideListener = null;
    this._callbacks = {};
    this._getDeviceInformation = null;
    this._lastDeviceInformationJson = null;
  }

  /**
   * device_information から共有する値だけを取り出す（DataView などの非 JSON 値は除く）
   * @param {*} info - Orphe#device_information
   * @returns {Object|null}
   */
  static snapshotDeviceInformation(info) {
    if (!info || typeof info !== 'object') return null;
    const snapshot = {};
    for (const key of ['battery', 'lr', 'rec_mode', 'rec_auto_run', 'led_brightness']) {
      if (typeof info[key] === 'number') snapshot[key] = info[key];
    }
    if (info.range && typeof info.range === 'object') {
      snapshot.range = { acc: info.range.acc, gyro: info.range.gyro };
    }
    return Object.keys(snapshot).length > 0 ? snapshot : null;
  }

  // ─── タイミング定数 ──────────────────────────────────────────
  // バックグラウンドタブで setInterval が throttle されても誤検知しないよう
  // タイムアウトには十分な余裕を持たせる。
  static get HEARTBEAT_INTERVAL_MS() { return 1000; }
  static get HEARTBEAT_TIMEOUT_MS()  { return 5000; }
  static get WATCH_INTERVAL_MS()     { return 2000; }
  static get ELECTION_MAX_DELAY_MS() { return 1500; }

  // ─── Primary 検出 ───────────────────────────────────────────
  /**
   * 別タブに有効な Primary が存在するか確認する
   * @returns {boolean}
   */
  isRemotePrimaryAvailable() {
    return this._readRemotePrimaryEntry() !== null;
  }

  /**
   * 別タブの Primary が共有しているデバイス情報を返す
   * @returns {Object|null} device_information のスナップショット。無ければ null
   */
  getRemoteDeviceInformation() {
    const entry = this._readRemotePrimaryEntry();
    return entry ? BleSharedBridge.snapshotDeviceInformation(entry.deviceInformation) : null;
  }

  // ─── Primary モード ──────────────────────────────────────────
  /**
   * このタブを Primary として登録し、BroadcastChannel を開く
   * @param {Object} [options]
   * @param {Function} [options.getDeviceInformation] - 共有する device_information を返す関数。
   *   ハートビートのたびに呼ばれるので、setMountPosition() などによる変更も Secondary に届く
   */
  claimPrimary(options = {}) {
    this._getDeviceInformation =
      typeof options.getDeviceInformation === 'function' ? options.getDeviceInformation : null;
    this.isPrimary = true;
    this._openChannel();
    this._updateHeartbeat();
    this._heartbeatInterval = setInterval(
      () => this._updateHeartbeat(),
      BleSharedBridge.HEARTBEAT_INTERVAL_MS
    );

    // タブが閉じられたときに自分のエントリを即時除去する
    this._pagehideListener = () => {
      this._cleanupOwnPrimaryEntry();
      this._send({ type: 'disconnected', deviceId: this.deviceId });
    };
    window.addEventListener('pagehide', this._pagehideListener);
  }

  /**
   * 複数のコールバック呼び出しを1メッセージにまとめてブロードキャストする
   * @param {Object<string, any>} batch - 例: { gotAcc: {...}, gotQuat: {...} }
   */
  broadcastBatch(batch) {
    if (!this.isPrimary || !this._channel) return;
    this._send({ type: 'batch', deviceId: this.deviceId, batch });
  }

  /**
   * 単一コールバックをブロードキャストする（互換API）
   */
  broadcast(callbackName, data) {
    this.broadcastBatch({ [callbackName]: data });
  }

  /**
   * 切断を全タブへ通知し、Primary リソースを解放する
   */
  broadcastDisconnect() {
    this._send({ type: 'disconnected', deviceId: this.deviceId });
    this.release();
  }

  // ─── Secondary モード ────────────────────────────────────────
  /**
   * このタブを Secondary として BroadcastChannel を購読する
   * @param {Object} callbacks
   * @param {Function} callbacks.onPrimaryLost - Primary が喪失/切断されたとき
   * @param {Function} [callbacks.onDeviceInformation] - Primary のデバイス情報を受け取ったとき
   *   （購読開始時と、内容が変わったときだけ呼ばれる）
   * @param {Function} [callbacks.gotAcc]      - 各センサーコールバック
   */
  subscribeAsSecondary(callbacks) {
    this.isPrimary = false;
    this._callbacks = callbacks;
    this._lastDeviceInformationJson = null;
    this._openChannel();
    if (this._channel) {
      this._channel.onmessage = (event) => this._handleMessage(event.data);
    }

    // storage イベントは同一オリジンの他タブの localStorage 変更を即時検知する
    this._storageListener = (e) => {
      if (e.key !== this._storageKey) return;
      if (e.newValue === null) {
        this._firePrimaryLost();
        return;
      }
      this._emitDeviceInformation(this.getRemoteDeviceInformation());
    };
    window.addEventListener('storage', this._storageListener);

    // フォールバックポーリング（heartbeat タイムアウト用）
    this._watchInterval = setInterval(() => {
      if (!this.isRemotePrimaryAvailable()) {
        this._firePrimaryLost();
        return;
      }
      this._emitDeviceInformation(this.getRemoteDeviceInformation());
    }, BleSharedBridge.WATCH_INTERVAL_MS);

    this._emitDeviceInformation(this.getRemoteDeviceInformation());
  }

  // ─── 共通 ────────────────────────────────────────────────────
  /**
   * すべてのリソースを解放する
   */
  release() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this._watchInterval) {
      clearInterval(this._watchInterval);
      this._watchInterval = null;
    }
    if (this._storageListener) {
      window.removeEventListener('storage', this._storageListener);
      this._storageListener = null;
    }
    if (this._pagehideListener) {
      window.removeEventListener('pagehide', this._pagehideListener);
      this._pagehideListener = null;
    }
    if (this.isPrimary) this._cleanupOwnPrimaryEntry();
    if (this._channel) {
      try { this._channel.close(); } catch (_) {}
      this._channel = null;
    }
    this.isPrimary = false;
  }

  // ─── 内部メソッド ─────────────────────────────────────────────
  _openChannel() {
    if (this._channel) return;
    try {
      this._channel = new BroadcastChannel(this._channelName);
    } catch (e) {
      console.warn('[BleSharedBridge] BroadcastChannel unavailable:', e);
    }
  }

  _send(msg) {
    try { this._channel?.postMessage(msg); } catch (_) {}
  }

  _updateHeartbeat() {
    try {
      const entry = {
        timestamp: Date.now(),
        tabId: this._tabId,
      };
      if (this._getDeviceInformation) {
        const deviceInformation = BleSharedBridge.snapshotDeviceInformation(this._getDeviceInformation());
        if (deviceInformation) entry.deviceInformation = deviceInformation;
      }
      localStorage.setItem(this._storageKey, JSON.stringify(entry));
    } catch (_) {}
  }

  /**
   * 有効な（自タブ以外・タイムアウト前の）Primary エントリを返す
   * @returns {Object|null}
   */
  _readRemotePrimaryEntry() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || entry.tabId === this._tabId) return null;
      if (!(Date.now() - entry.timestamp < BleSharedBridge.HEARTBEAT_TIMEOUT_MS)) return null;
      return entry;
    } catch (_) {
      return null;
    }
  }

  /**
   * デバイス情報が前回から変わったときだけ onDeviceInformation を呼ぶ
   * @param {Object|null} info
   */
  _emitDeviceInformation(info) {
    if (!info) return;
    const json = JSON.stringify(info);
    if (json === this._lastDeviceInformationJson) return;
    this._lastDeviceInformationJson = json;
    const cb = this._callbacks.onDeviceInformation;
    if (typeof cb === 'function') cb(info);
  }

  /**
   * localStorage から自分の Primary エントリのみを削除する
   * （他タブが既に Primary を奪取している場合は何もしない）
   */
  _cleanupOwnPrimaryEntry() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return;
      const { tabId } = JSON.parse(raw);
      if (tabId === this._tabId) localStorage.removeItem(this._storageKey);
    } catch (_) {}
  }

  _handleMessage(msg) {
    if (!msg || msg.deviceId !== this.deviceId) return;

    if (msg.type === 'batch' && msg.batch) {
      for (const name in msg.batch) {
        const cb = this._callbacks[name];
        if (typeof cb === 'function') cb(msg.batch[name]);
      }
    } else if (msg.type === 'disconnected') {
      this._firePrimaryLost();
    }
  }

  /**
   * onPrimaryLost を1回だけ発火する（重複検知してもループしない）
   */
  _firePrimaryLost() {
    if (this._primaryLostFired) return;
    this._primaryLostFired = true;

    // Secondary の監視はもう不要
    if (this._watchInterval) {
      clearInterval(this._watchInterval);
      this._watchInterval = null;
    }

    const cb = this._callbacks.onPrimaryLost;
    if (typeof cb === 'function') cb();
  }
}
