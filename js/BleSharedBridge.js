var bleSharedBridge_version_date = `2026-04-19`;

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
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return false;
      const { timestamp, tabId } = JSON.parse(raw);
      return tabId !== this._tabId &&
        (Date.now() - timestamp < BleSharedBridge.HEARTBEAT_TIMEOUT_MS);
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
   * @param {Function} [callbacks.gotAcc]      - 各センサーコールバック
   */
  subscribeAsSecondary(callbacks) {
    this.isPrimary = false;
    this._callbacks = callbacks;
    this._openChannel();
    if (this._channel) {
      this._channel.onmessage = (event) => this._handleMessage(event.data);
    }

    // storage イベントは同一オリジンの他タブの localStorage 変更を即時検知する
    this._storageListener = (e) => {
      if (e.key !== this._storageKey) return;
      if (e.newValue === null) this._firePrimaryLost();
    };
    window.addEventListener('storage', this._storageListener);

    // フォールバックポーリング（heartbeat タイムアウト用）
    this._watchInterval = setInterval(() => {
      if (!this.isRemotePrimaryAvailable()) this._firePrimaryLost();
    }, BleSharedBridge.WATCH_INTERVAL_MS);
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
      localStorage.setItem(this._storageKey, JSON.stringify({
        timestamp: Date.now(),
        tabId: this._tabId,
      }));
    } catch (_) {}
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
