var bleSharedBridge_version_date = `
Last modified: 2026-04-19
`;

/**
 * BleSharedBridge
 *
 * 複数のブラウザタブ間でORPHE COREのBLE接続を共有するブリッジモジュール。
 *
 * 動作原理:
 *   - Primary tab : BLE接続を保持し、センサーデータをBroadcastChannelで全タブに配信する
 *   - Secondary tab: BLE接続不要。BroadcastChannelを購読してデータを受信し、
 *                    通常の got* コールバックをそのまま利用できる
 *
 * Primary検出:
 *   localStorage にハートビートを書き込み、3秒以内に更新されているタブを
 *   Primary とみなす。Primaryが閉じると heartbeat が途絶え、Secondary が
 *   navigator.bluetooth.getDevices() を使って自動再接続を試みる。
 *
 * 使い方:
 *   ORPHE-CORE.js と CoreToolkit.js が自動的に利用するため、
 *   ユーザが直接インスタンスを生成する必要はない。
 */
class BleSharedBridge {
  /**
   * @param {number} deviceId - Orphe インスタンスの id (0 または 1)
   */
  constructor(deviceId) {
    this.deviceId = deviceId;
    this._storageKey = `orphe_bridge_primary_${deviceId}`;
    this._channelName = `orphe-ble-bridge-${deviceId}`;
    this._tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.isPrimary = false;
    this._channel = null;
    this._heartbeatInterval = null;
    this._watchInterval = null;
    this._callbacks = {};
    this.onPrimaryLost = null; // Secondary が Primary 喪失を検知したときのコールバック
  }

  // ─── Primary 検出 ───────────────────────────────────────────

  /**
   * 別タブに有効な Primary が存在するか確認する
   * @returns {boolean}
   */
  isRemotePrimaryAvailable() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return false;
      const { timestamp, tabId } = JSON.parse(raw);
      // 自分自身は除外、3秒以内に更新されていれば有効
      return tabId !== this._tabId && (Date.now() - timestamp < 3000);
    } catch (_) {
      return false;
    }
  }

  // ─── Primary モード ──────────────────────────────────────────

  /**
   * このタブを Primary として登録し、BroadcastChannel を開く
   */
  claimPrimary() {
    this.isPrimary = true;
    this._openChannel();
    this._updateHeartbeat();
    this._heartbeatInterval = setInterval(() => this._updateHeartbeat(), 1000);

    // 他のタブに接続完了を通知
    this._send({ type: 'primary_connected', deviceId: this.deviceId });
  }

  /**
   * センサーデータを他タブへブロードキャストする（Primary のみ使用）
   * @param {string} callbackName - 'gotAcc' など got* のメソッド名
   * @param {Object} data - コールバックに渡すデータオブジェクト
   */
  broadcast(callbackName, data) {
    if (!this.isPrimary || !this._channel) return;
    this._send({
      type: 'sensor_data',
      deviceId: this.deviceId,
      callbackName,
      data,
    });
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
   * @param {Function} callbacks.onPrimaryConnected  - Primary が接続したとき
   * @param {Function} callbacks.onDisconnect        - Primary が切断されたとき
   * @param {Function} callbacks.onReconnectNeeded   - 自動再接続が必要なとき
   * @param {Function} [callbacks.gotAcc]            - 各センサーコールバック
   */
  subscribeAsSecondary(callbacks) {
    this.isPrimary = false;
    this._callbacks = callbacks;
    this._openChannel();
    this._channel.onmessage = (event) => this._handleMessage(event.data);

    // Primary の heartbeat を監視し、途絶えたら再接続を促す
    this._watchInterval = setInterval(() => {
      if (!this.isRemotePrimaryAvailable()) {
        this._onPrimaryLost();
      }
    }, 2000);
  }

  // ─── Fast Reconnect ──────────────────────────────────────────

  /**
   * ペアリング済みデバイスを取得し、再接続ダイアログなしで接続できるデバイスを返す
   * navigator.bluetooth.getDevices() が利用可能な Chrome でのみ動作する
   * @returns {Promise<BluetoothDevice|null>}
   */
  async getPairedDevice() {
    if (!navigator.bluetooth?.getDevices) return null;
    try {
      const devices = await navigator.bluetooth.getDevices();
      return devices.length > 0 ? devices[0] : null;
    } catch (_) {
      return null;
    }
  }

  // ─── 共通 ────────────────────────────────────────────────────

  /**
   * リソースをすべて解放する
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
    if (this.isPrimary) {
      try { localStorage.removeItem(this._storageKey); } catch (_) {}
    }
    if (this._channel) {
      this._channel.close();
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
      console.warn('[BleSharedBridge] BroadcastChannel が利用できません:', e);
    }
  }

  _send(msg) {
    try {
      if (this._channel) this._channel.postMessage(msg);
    } catch (_) {}
  }

  _updateHeartbeat() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify({
        timestamp: Date.now(),
        tabId: this._tabId,
      }));
    } catch (_) {}
  }

  _handleMessage(msg) {
    if (msg.deviceId !== this.deviceId) return;

    if (msg.type === 'sensor_data') {
      const cb = this._callbacks[msg.callbackName];
      if (typeof cb === 'function') cb(msg.data);

    } else if (msg.type === 'disconnected') {
      clearInterval(this._watchInterval);
      this._watchInterval = null;
      if (typeof this._callbacks.onDisconnect === 'function') {
        this._callbacks.onDisconnect();
      }
      // 自動再接続のトリガー
      if (typeof this._callbacks.onReconnectNeeded === 'function') {
        this._callbacks.onReconnectNeeded();
      }

    } else if (msg.type === 'primary_connected') {
      if (typeof this._callbacks.onPrimaryConnected === 'function') {
        this._callbacks.onPrimaryConnected();
      }
    }
  }

  _onPrimaryLost() {
    // watchInterval を止めてループしない
    clearInterval(this._watchInterval);
    this._watchInterval = null;

    if (typeof this._callbacks.onReconnectNeeded === 'function') {
      this._callbacks.onReconnectNeeded();
    }
  }
}
