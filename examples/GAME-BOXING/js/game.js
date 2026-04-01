// ボクシング音ゲー メインクラス
class BoxingGame {
    constructor() {
        // ORPHE CORE インスタンス
        this.leftCore = null;
        this.rightCore = null;
        
        // ゲーム状態
        this.gameState = 'idle'; // idle, calibrating, playing, paused
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.timeLeft = 60;
        this.gameTimer = null;
        
        // 難易度設定（楽曲データ生成前に設定）
        this.difficulty = 'beginner'; // 難易度設定
        
        // ボクシングコンビネーションパターン（楽曲データ生成前に設定）
        this.boxingCombos = {
            beginner: [
                ['left'], ['right'], ['left'], ['right'] // 基本の単発
            ],
            intermediate: [
                ['left', 'right'], // ワンツー（ジャブ→ストレート）
                ['right', 'left'], // 逆ワンツー
                ['left', 'left'],  // ダブルジャブ
                ['right', 'right'] // ダブルストレート
            ],
            advanced: [
                ['left', 'right', 'left'],   // ジャブ→ストレート→フック
                ['right', 'right', 'left'],  // ストレート→ストレート→フック
                ['left', 'left', 'right'],   // ダブルジャブ→ストレート
                ['right', 'left', 'right'],  // ストレート→ジャブ→ストレート
                ['left', 'right', 'right']   // ジャブ→ダブルストレート
            ]
        };
        
        // 楽曲システム（設定後に生成）
        this.songData = this.generateSongData();
        this.currentNoteIndex = 0;
        this.totalNotes = this.songData.length;
        this.targetClearRate = 70; // クリア目標率（%）
        this.fallSpeed = 3000; // ノーツ落下時間（ms）
        this.comboInterval = 600; // コンビネーション間隔（ms）
        this.hitWindow = {
            perfect: 100, // ±100ms
            good: 200     // ±200ms
        };
        
        // キャリブレーション
        this.maxAcceleration = 10; // デフォルト値
        this.calibrationData = [];
        this.calibrationDuration = 5; // 秒
        
        // パンチ検出設定
        this.lowerThreshold = 2.0;
        this.upperThreshold = 15.0;
        this.punchWindow = 500; // ms
        this.lastPunchTime = { left: 0, right: 0 };
        
        // パンチ統計
        this.punchStats = {
            totalPunches: 0,
            successfulHits: 0,
            totalPower: 0,
            maxPower: 0,
            perfectHits: 0,
            goodHits: 0,
            missHits: 0,
            comboSuccess: 0, // 完璧なコンビネーション成功数
            comboTotal: 0    // 総コンビネーション数
        };
        
        // センサーデータ
        this.sensorBuffer = {
            left: {
                accel: [],
                gyro: [],
                resultant: []
            },
            right: {
                accel: [],
                gyro: [],
                resultant: []
            }
        };
        this.bufferSize = 100;
        
        // アクティブノーツ管理
        this.activeNotes = [];
        this.noteIdCounter = 0;
        
        // Chart.js インスタンス
        this.leftChart = null;
        this.rightChart = null;
        
        // 音声システム
        this.audioContext = null;
        this.punchSound = null;
        this.backgroundMusic = null;
        this.backgroundMusicSource = null;
        this.backgroundMusicGain = null;
        this.soundEnabled = true;
        this.musicEnabled = true;
        
        this.init();
    }
    
    // 楽曲データ生成（コンビネーション対応）
    generateSongData() {
        const notes = [];
        const totalDuration = 60000; // 60秒
        const intervals = [2000, 1500, 2500, 1800, 2200, 1600, 2400, 1700, 2100, 1900]; // 基本間隔
        
        // 初期化時にはデフォルト値を使用（DOM要素がまだ存在しない可能性がある）
        let baseNoteCount = 20; // デフォルト値
        const gameTimeElement = document.getElementById('gameTime');
        if (gameTimeElement && gameTimeElement.value) {
            baseNoteCount = parseInt(gameTimeElement.value);
        }
        
        // 難易度設定の確認
        const currentDifficulty = this.difficulty || 'beginner';
        const difficultyMultiplier = currentDifficulty === 'beginner' ? 1 : 
                                   currentDifficulty === 'intermediate' ? 2 : 3;
        
        // 難易度に応じたコンビネーション間隔（実際にパンチ可能な間隔）
        const comboIntervals = {
            beginner: 800,    // 0.8秒間隔（余裕あり）
            intermediate: 600, // 0.6秒間隔（標準）
            advanced: 400     // 0.4秒間隔（上級者向け）
        };
        
        // スライダーで設定された値を優先、なければ難易度デフォルト値
        let comboInterval = this.comboInterval || comboIntervals[currentDifficulty] || 600;
        
        // UIから現在の値を取得（リアルタイム更新）
        const comboIntervalSlider = document.getElementById('comboInterval');
        if (comboIntervalSlider && comboIntervalSlider.value) {
            comboInterval = parseInt(comboIntervalSlider.value);
        }
        
        const noteSequences = Math.ceil(baseNoteCount / difficultyMultiplier);
        
        let currentTime = 5000; // 5秒後から開始
        
        // combosの安全な取得
        const combos = (this.boxingCombos && this.boxingCombos[currentDifficulty]) ? 
                      this.boxingCombos[currentDifficulty] : 
                      [['left'], ['right']]; // フォールバック
        
        for (let i = 0; i < noteSequences; i++) {
            // ランダムなコンビネーションを選択
            const combo = combos[Math.floor(Math.random() * combos.length)];
            
            // コンビネーション内の各ノーツを生成
            combo.forEach((side, comboIndex) => {
                notes.push({
                    time: currentTime + (comboIndex * comboInterval), // 難易度に応じた間隔
                    side: side,
                    id: notes.length,
                    comboId: i, // コンビネーションID
                    comboIndex: comboIndex, // コンビネーション内のインデックス
                    comboLength: combo.length // コンビネーションの長さ
                });
            });
            
            // 次のコンビネーションまでの間隔も調整
            const nextComboDelay = intervals[i % intervals.length] + (combo.length - 1) * comboInterval;
            currentTime += nextComboDelay;
            
            // 60秒を超えないように調整
            if (currentTime > totalDuration - 5000) {
                break;
            }
        }
        
        return notes;
    }
    
    init() {
        this.initializeAudio();
        this.initializeCharts();
        this.setupEventListeners();
        this.updateUI();
        this.updatePunchStats();
        this.updateSongProgress();
    }
    
    // 音声システム初期化
    async initializeAudio() {
        try {
            // AudioContextの初期化
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 音声ファイルの読み込み
            await Promise.all([
                this.loadPunchSound(),
                this.loadBackgroundMusic()
            ]);
            
            console.log('音声システム初期化完了');
            
            // 背景音楽を自動開始（ユーザーの最初のクリック後に再生される）
            this.setupAutoPlayMusic();
            
        } catch (error) {
            console.error('音声システム初期化エラー:', error);
            this.soundEnabled = false;
        }
    }
    
    // パンチ効果音読み込み
    async loadPunchSound() {
        try {
            const response = await fetch('music/punch-2-37333.mp3');
            const arrayBuffer = await response.arrayBuffer();
            this.punchSound = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('パンチ効果音読み込み完了');
        } catch (error) {
            console.error('パンチ効果音読み込みエラー:', error);
            this.soundEnabled = false;
        }
    }
    
    // 背景音楽読み込み
    async loadBackgroundMusic() {
        try {
            const response = await fetch('music/loop-file-16-beat-technoelectronic-style-beat-153147.mp3');
            const arrayBuffer = await response.arrayBuffer();
            this.backgroundMusic = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('背景音楽読み込み完了');
        } catch (error) {
            console.error('背景音楽読み込みエラー:', error);
        }
    }
    
    // パンチ効果音再生
    playPunchSound() {
        if (!this.soundEnabled || !this.punchSound || !this.audioContext) {
            return;
        }
        
        try {
            // AudioContextが停止している場合は再開
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const source = this.audioContext.createBufferSource();
            source.buffer = this.punchSound;
            source.connect(this.audioContext.destination);
            source.start(0);
        } catch (error) {
            console.error('パンチ効果音再生エラー:', error);
        }
    }
    
    // 背景音楽再生開始
    startBackgroundMusic() {
        if (!this.musicEnabled || !this.backgroundMusic || !this.audioContext) {
            return;
        }
        
        try {
            // AudioContextが停止している場合は再開
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // 既に再生中の場合は停止
            this.stopBackgroundMusic();
            
            // 音量制御用のGainNodeを作成
            this.backgroundMusicGain = this.audioContext.createGain();
            this.backgroundMusicGain.gain.value = 0.3; // 背景音楽の音量を30%に設定
            this.backgroundMusicGain.connect(this.audioContext.destination);
            
            // 音声ソースを作成
            this.backgroundMusicSource = this.audioContext.createBufferSource();
            this.backgroundMusicSource.buffer = this.backgroundMusic;
            this.backgroundMusicSource.loop = true; // ループ再生
            this.backgroundMusicSource.connect(this.backgroundMusicGain);
            this.backgroundMusicSource.start(0);
            
            console.log('背景音楽再生開始');
        } catch (error) {
            console.error('背景音楽再生エラー:', error);
        }
    }
    
    // 背景音楽停止
    stopBackgroundMusic() {
        if (this.backgroundMusicSource) {
            try {
                this.backgroundMusicSource.stop();
            } catch (error) {
                // 既に停止している場合のエラーを無視
            }
            this.backgroundMusicSource = null;
        }
        
        if (this.backgroundMusicGain) {
            this.backgroundMusicGain.disconnect();
            this.backgroundMusicGain = null;
        }
    }
    
    // 背景音楽音量設定
    setBackgroundMusicVolume(volume) {
        if (this.backgroundMusicGain) {
            this.backgroundMusicGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    
    // 自動再生のセットアップ
    setupAutoPlayMusic() {
        // ユーザーの最初のクリックで背景音楽を開始
        const startMusicOnFirstClick = () => {
            if (this.backgroundMusic && !this.backgroundMusicSource) {
                this.startBackgroundMusic();
            }
            // イベントリスナーを削除（一度だけ実行）
            document.removeEventListener('click', startMusicOnFirstClick);
            document.removeEventListener('keydown', startMusicOnFirstClick);
        };
        
        document.addEventListener('click', startMusicOnFirstClick);
        document.addEventListener('keydown', startMusicOnFirstClick);
    }
    
    // Chart.js 初期化
    initializeCharts() {
        const chartConfig = {
            type: 'line',
            data: {
                labels: Array.from({length: this.bufferSize}, (_, i) => i),
                datasets: [
                    {
                        label: '合成加速度',
                        data: Array(this.bufferSize).fill(0),
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        tension: 0.1,
                        pointRadius: 0
                    },
                    {
                        label: '加速度X',
                        data: Array(this.bufferSize).fill(0),
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        tension: 0.1,
                        pointRadius: 0
                    },
                    {
                        label: '加速度Y',
                        data: Array(this.bufferSize).fill(0),
                        borderColor: '#45b7d1',
                        backgroundColor: 'rgba(69, 183, 209, 0.1)',
                        tension: 0.1,
                        pointRadius: 0
                    },
                    {
                        label: '加速度Z',
                        data: Array(this.bufferSize).fill(0),
                        borderColor: '#f9ca24',
                        backgroundColor: 'rgba(249, 202, 36, 0.1)',
                        tension: 0.1,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        min: -30,
                        max: 30,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'rgba(255, 255, 255, 0.9)'
                        }
                    }
                }
            }
        };
        
        // 左手チャート
        const leftCtx = document.getElementById('leftChart').getContext('2d');
        this.leftChart = new Chart(leftCtx, JSON.parse(JSON.stringify(chartConfig)));
        
        // 右手チャート
        const rightCtx = document.getElementById('rightChart').getContext('2d');
        this.rightChart = new Chart(rightCtx, JSON.parse(JSON.stringify(chartConfig)));
    }
    
    // イベントリスナー設定
    setupEventListeners() {
        // ORPHE CORE 接続ボタン
        document.getElementById('connectLeft').addEventListener('click', () => this.connectDevice('left'));
        document.getElementById('connectRight').addEventListener('click', () => this.connectDevice('right'));
        
        // ゲームコントロール
        document.getElementById('calibrateBtn').addEventListener('click', () => this.startCalibration());
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseGame());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        
        // 設定スライダー
        this.setupSliders();
    }
    
    setupSliders() {
        const sliders = [
            { id: 'lowerThreshold', property: 'lowerThreshold', valueId: 'lowerThresholdValue' },
            { id: 'upperThreshold', property: 'upperThreshold', valueId: 'upperThresholdValue' },
            { id: 'gameTime', property: 'totalNotes', valueId: 'gameTimeValue' },
            { id: 'targetDisplayTime', property: 'hitWindow.good', valueId: 'targetDisplayTimeValue', multiplier: 100 },
            { id: 'targetInterval', property: 'fallSpeed', valueId: 'targetIntervalValue', multiplier: 1000 },
            { id: 'comboInterval', property: 'comboInterval', valueId: 'comboIntervalValue' }
        ];
        
        sliders.forEach(slider => {
            const element = document.getElementById(slider.id);
            const valueElement = document.getElementById(slider.valueId);
            
            element.addEventListener('input', (e) => {
                let value = parseFloat(e.target.value);
                if (slider.multiplier) {
                    if (slider.property.includes('.')) {
                        const props = slider.property.split('.');
                        this[props[0]][props[1]] = value * slider.multiplier;
                    } else {
                        this[slider.property] = value * slider.multiplier;
                    }
                } else {
                    if (slider.property.includes('.')) {
                        const props = slider.property.split('.');
                        this[props[0]][props[1]] = value;
                    } else {
                        this[slider.property] = value;
                    }
                }
                valueElement.textContent = value;
                
                // 楽曲ノーツ数やコンビネーション間隔変更時は楽曲データを再生成
                if (slider.id === 'gameTime' || slider.id === 'comboInterval') {
                    this.songData = this.generateSongData();
                    this.updateSongProgress();
                }
            });
            
            // 初期値設定
            valueElement.textContent = element.value;
        });
        
        // 難易度選択の設定
        const difficultySelect = document.getElementById('difficulty');
        if (difficultySelect) {
            difficultySelect.addEventListener('change', (e) => {
                this.difficulty = e.target.value;
                
                // 難易度に応じてコンビネーション間隔のデフォルト値を更新
                const defaultComboIntervals = {
                    beginner: 800,
                    intermediate: 600,
                    advanced: 400
                };
                const comboIntervalSlider = document.getElementById('comboInterval');
                const comboIntervalValue = document.getElementById('comboIntervalValue');
                if (comboIntervalSlider && comboIntervalValue) {
                    const newInterval = defaultComboIntervals[this.difficulty];
                    comboIntervalSlider.value = newInterval;
                    comboIntervalValue.textContent = newInterval;
                    this.comboInterval = newInterval;
                }
                
                this.songData = this.generateSongData();
                this.totalNotes = this.songData.length;
                this.updateSongProgress();
                console.log(`難易度変更: ${this.difficulty}, コンビネーション間隔: ${this.comboInterval}ms`);
            });
        }
    }
    
    // ORPHE CORE デバイス接続（正しいAPI使用）
    async connectDevice(side) {
        try {
            console.log(`${side} 接続処理開始`);
            const core = new Orphe(); // 正しいクラス名
            
            const statusIndicator = document.getElementById(`${side}Indicator`);
            const connectBtn = document.getElementById(`connect${side.charAt(0).toUpperCase() + side.slice(1)}`);
            
            statusIndicator.textContent = '接続中...';
            statusIndicator.className = 'status-indicator';
            
            console.log(`${side} setup()実行`);
            // setup()でDEVICE_INFORMATIONも含めて設定（begin()でgetDeviceInformation()が呼ばれるため）
            core.setup(['DEVICE_INFORMATION', 'SENSOR_VALUES']);
            
            // 正しいコールバック設定
            const gameInstance = this;
            core.gotConvertedAcc = function(acc) {
                gameInstance.onAccelData(side, acc);
            };
            core.gotConvertedGyro = function(gyro) {
                gameInstance.onGyroData(side, gyro);
            };
            
            // 接続イベントハンドリング追加
            core.onScan = function(deviceName) {
                console.log(`${side} デバイス発見:`, deviceName);
            };
            core.onConnect = function(uuid) {
                console.log(`${side} 接続成功:`, uuid);
            };
            core.onError = function(error) {
                console.error(`${side} ORPHE CORE エラー:`, error);
                statusIndicator.textContent = '接続失敗';
                statusIndicator.className = 'status-indicator disconnected';
            };
            
            console.log(`${side} begin()実行 - Bluetoothダイアログが表示されるはず`);
            // 接続開始 - この時点でBluetoothダイアログが表示される
            const result = await core.begin('SENSOR_VALUES');
            console.log(`${side} begin結果:`, result);
            
            if (side === 'left') {
                this.leftCore = core;
            } else {
                this.rightCore = core;
            }
            
            statusIndicator.textContent = '接続済み';
            statusIndicator.className = 'status-indicator connected';
            connectBtn.textContent = '切断';
            connectBtn.onclick = () => this.disconnectDevice(side);
            
            this.updateGameButtons();
            
            console.log(`${side} ORPHE CORE接続成功`);
            
        } catch (error) {
            console.error(`${side} ORPHE CORE 接続エラー:`, error);
            const statusIndicator = document.getElementById(`${side}Indicator`);
            statusIndicator.textContent = '接続失敗';
            statusIndicator.className = 'status-indicator disconnected';
            
            // エラーの詳細をアラートで表示
            if (error.name === 'NotFoundError') {
                alert('Bluetoothデバイスが見つかりませんでした。ORPHE COREの電源が入っていることを確認してください。');
            } else if (error.name === 'SecurityError') {
                alert('HTTPSでアクセスしてください。Bluetoothアクセスにはセキュアな接続が必要です。');
            } else {
                alert(`接続エラー: ${error.message}`);
            }
        }
    }
    
    // デバイス切断
    async disconnectDevice(side) {
        try {
            const core = side === 'left' ? this.leftCore : this.rightCore;
            if (core) {
                await core.disconnect();
            }
            
            if (side === 'left') {
                this.leftCore = null;
            } else {
                this.rightCore = null;
            }
            
            const statusIndicator = document.getElementById(`${side}Indicator`);
            const connectBtn = document.getElementById(`connect${side.charAt(0).toUpperCase() + side.slice(1)}`);
            
            statusIndicator.textContent = '未接続';
            statusIndicator.className = 'status-indicator disconnected';
            connectBtn.textContent = '接続';
            connectBtn.onclick = () => this.connectDevice(side);
            
            this.updateGameButtons();
            
        } catch (error) {
            console.error(`${side} ORPHE CORE 切断エラー:`, error);
        }
    }
    
    // 加速度データ受信処理
    onAccelData(side, accelData) {
        // 現在のセンサーデータを保持
        if (!this.currentSensorData) {
            this.currentSensorData = {
                left: { accel: null, gyro: null },
                right: { accel: null, gyro: null }
            };
        }
        
        this.currentSensorData[side].accel = accelData;
        
        // 加速度とジャイロデータが両方揃ったら処理
        if (this.currentSensorData[side].accel && this.currentSensorData[side].gyro) {
            this.processSensorData(side, this.currentSensorData[side]);
        }
    }
    
    // ジャイロデータ受信処理
    onGyroData(side, gyroData) {
        if (!this.currentSensorData) {
            this.currentSensorData = {
                left: { accel: null, gyro: null },
                right: { accel: null, gyro: null }
            };
        }
        
        this.currentSensorData[side].gyro = gyroData;
        
        // 加速度とジャイロデータが両方揃ったら処理
        if (this.currentSensorData[side].accel && this.currentSensorData[side].gyro) {
            this.processSensorData(side, this.currentSensorData[side]);
        }
    }
    
    // センサーデータ統合処理
    processSensorData(side, data) {
        const accel = data.accel;
        const gyro = data.gyro;
        
        // 合成加速度計算
        const resultant = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
        
        // データバッファ更新
        const buffer = this.sensorBuffer[side];
        buffer.accel.push([accel.x, accel.y, accel.z]);
        buffer.gyro.push([gyro.x, gyro.y, gyro.z]);
        buffer.resultant.push(resultant);
        
        // バッファサイズ制限
        if (buffer.accel.length > this.bufferSize) {
            buffer.accel.shift();
            buffer.gyro.shift();
            buffer.resultant.shift();
        }
        
        // チャート更新
        this.updateChart(side, buffer);
        
        // UI更新
        this.updateSensorValues(side, accel, gyro, resultant);
        
        // パンチ検出
        this.detectPunch(side, resultant, Date.now());
        
        // キャリブレーション中の場合
        if (this.gameState === 'calibrating') {
            this.calibrationData.push(resultant);
        }
        
        // データをリセット
        this.currentSensorData[side] = { accel: null, gyro: null };
    }
    
    // チャート更新
    updateChart(side, buffer) {
        const chart = side === 'left' ? this.leftChart : this.rightChart;
        if (!chart || buffer.resultant.length === 0) return;
        
        chart.data.datasets[0].data = buffer.resultant;
        chart.data.datasets[1].data = buffer.accel.map(a => a[0]);
        chart.data.datasets[2].data = buffer.accel.map(a => a[1]);
        chart.data.datasets[3].data = buffer.accel.map(a => a[2]);
        
        chart.update('none');
    }
    
    // センサー値表示更新
    updateSensorValues(side, accel, gyro, resultant) {
        const accelElement = document.getElementById(`${side}Accel`);
        const gyroElement = document.getElementById(`${side}Gyro`);
        const resultantElement = document.getElementById(`${side}Resultant`);
        
        accelElement.textContent = `${accel.x.toFixed(2)}, ${accel.y.toFixed(2)}, ${accel.z.toFixed(2)}`;
        gyroElement.textContent = `${gyro.x.toFixed(2)}, ${gyro.y.toFixed(2)}, ${gyro.z.toFixed(2)}`;
        resultantElement.textContent = resultant.toFixed(2);
    }
    
    // パンチ検出（二重閾値法）
    detectPunch(side, resultant, timestamp) {
        if (this.gameState !== 'playing') return;
        
        const lastPunch = this.lastPunchTime[side];
        
        // パンチ検出間隔チェック
        if (timestamp - lastPunch < this.punchWindow) return;
        
        // 上限閾値チェック
        if (resultant > this.upperThreshold) {
            // 前後の最大値を取得してパンチ力を計算
            const buffer = this.sensorBuffer[side].resultant;
            const windowSize = 10;
            const startIndex = Math.max(0, buffer.length - windowSize);
            const recentData = buffer.slice(startIndex);
            const maxPunch = Math.max(...recentData);
            
            // パンチ統計更新
            this.punchStats.totalPunches++;
            this.punchStats.totalPower += maxPunch;
            this.punchStats.maxPower = Math.max(this.punchStats.maxPower, maxPunch);
            
            this.onPunchDetected(side, maxPunch, timestamp);
            this.lastPunchTime[side] = timestamp;
            
            this.updatePunchStats();
        }
    }
    
    // パンチ検出時の処理
    onPunchDetected(side, punchPower, timestamp) {
        // パンチパワーを表示
        this.showPunchPower(side, punchPower);
        
        // ノーツとの当たり判定
        const hitNote = this.checkNoteHit(side, timestamp);
        if (hitNote) {
            this.onNoteHit(hitNote, punchPower, timestamp);
        }
    }
    
    // ノーツ当たり判定
    checkNoteHit(side, timestamp) {
        for (let i = 0; i < this.activeNotes.length; i++) {
            const note = this.activeNotes[i];
            if (note.side === side && !note.isHit) {
                // ヒットライン通過時間との差を計算
                const timeDiff = Math.abs(note.hitLineTime - timestamp);
                
                if (timeDiff <= this.hitWindow.good) {
                    // ノーツヒット
                    note.isHit = true; // ヒット済みフラグを設定
                    const hitNote = this.activeNotes.splice(i, 1)[0];
                    this.removeNoteElement(hitNote.element);
                    return { ...hitNote, timeDiff };
                }
            }
        }
        return null;
    }
    
    // ノーツヒット処理
    onNoteHit(hitNote, punchPower, timestamp) {
        // 判定計算
        let judgment, scoreMultiplier;
        if (hitNote.timeDiff <= this.hitWindow.perfect) {
            judgment = 'perfect';
            scoreMultiplier = 1.0;
            this.punchStats.perfectHits++;
        } else if (hitNote.timeDiff <= this.hitWindow.good) {
            judgment = 'good';
            scoreMultiplier = 0.8;
            this.punchStats.goodHits++;
        }
        
        // パンチ効果音再生
        this.playPunchSound();
        
        // ノーツ爆発エフェクト表示
        this.showNoteExplosion(hitNote, judgment);
        
        // スコア計算（パンチ威力を使用）
        const powerRatio = Math.min(punchPower / this.maxAcceleration, 1.0);
        const baseScore = Math.floor(powerRatio * 100 * scoreMultiplier);
        const comboBonus = Math.floor(baseScore * (this.combo * 0.1));
        const totalScore = baseScore + comboBonus;
        
        this.score += totalScore;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.punchStats.successfulHits++;
        
        // 判定表示
        this.showJudgment(judgment, totalScore);
        
        // UI更新
        this.updateScore();
        this.updatePowerMeter(powerRatio);
        this.updatePunchStats();
        this.updateSongProgress();
        
        // 顔ダメージアニメーション
        this.showFaceDamage();
        
        console.log(`${judgment.toUpperCase()}! ${hitNote.side} - Power: ${punchPower.toFixed(2)}, Score: ${totalScore}`);
    }
    
    // ノーツ爆発エフェクト
    showNoteExplosion(hitNote, judgment) {
        // ノーツの位置を取得
        const noteRect = hitNote.element.getBoundingClientRect();
        const gameAreaRect = document.getElementById('gameArea').getBoundingClientRect();
        
        // 相対位置計算
        const relativeX = ((noteRect.left + noteRect.width / 2) - gameAreaRect.left) / gameAreaRect.width * 100;
        const relativeY = ((noteRect.top + noteRect.height / 2) - gameAreaRect.top) / gameAreaRect.height * 100;
        
        // 爆発エフェクト作成
        const explosion = document.createElement('div');
        explosion.className = `note-explosion ${judgment}`;
        explosion.style.left = `${relativeX}%`;
        explosion.style.top = `${relativeY}%`;
        
        document.getElementById('gameArea').appendChild(explosion);
        
        // パーティクル生成
        this.createNoteParticles(relativeX, relativeY, judgment);
        
        // エフェクト自動削除
        setTimeout(() => {
            if (explosion.parentNode) {
                explosion.parentNode.removeChild(explosion);
            }
        }, 600);
    }
    
    // ノーツパーティクル生成
    createNoteParticles(x, y, judgment) {
        const gameArea = document.getElementById('gameArea');
        const particleCount = judgment === 'perfect' ? 12 : 8;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = `note-particle ${judgment}`;
            
            // ランダムな方向に飛散
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = 30 + Math.random() * 20;
            const offsetX = Math.cos(angle) * distance;
            const offsetY = Math.sin(angle) * distance;
            
            particle.style.left = `${x}%`;
            particle.style.top = `${y}%`;
            particle.style.setProperty('--offset-x', `${offsetX}px`);
            particle.style.setProperty('--offset-y', `${offsetY}px`);
            
            // アニメーション用のカスタムプロパティを使用
            particle.style.animation = `particle-burst-${i} 0.8s ease-out forwards`;
            
            // 動的にキーフレーム作成
            const style = document.createElement('style');
            style.textContent = `
                @keyframes particle-burst-${i} {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(0) translate(${offsetX}px, ${offsetY - 60}px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
            
            gameArea.appendChild(particle);
            
            // パーティクル自動削除
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 800);
        }
    }
    
    // 判定表示
    showJudgment(judgment, score) {
        const gameArea = document.getElementById('gameArea');
        const judgmentElement = document.createElement('div');
        judgmentElement.className = `judgment ${judgment}`;
        judgmentElement.textContent = `${judgment.toUpperCase()}\n+${score}`;
        
        gameArea.appendChild(judgmentElement);
        
        // 自動削除
        setTimeout(() => {
            if (judgmentElement.parentNode) {
                judgmentElement.parentNode.removeChild(judgmentElement);
            }
        }, 1000);
    }
    
    // パンチパワー表示円
    showPunchPower(side, punchPower) {
        const gameArea = document.getElementById('gameArea');
        const powerIndicator = document.createElement('div');
        powerIndicator.className = 'punch-power-indicator';
        
        // パワー値を計算（0-100%）
        const powerRatio = Math.min(punchPower / this.maxAcceleration, 1.0);
        const percentage = Math.floor(powerRatio * 100);
        powerIndicator.textContent = `${percentage}%`;
        
        // 位置設定 - 顔の中央に近い位置に配置
        const isLeft = side === 'left';
        // 顔の左右頬の位置に配置（画面中央から左右にオフセット）
        powerIndicator.style.left = isLeft ? '35%' : '55%'; // 15%/75% → 35%/55% に変更
        powerIndicator.style.top = '40%'; // 顔の中央高さに配置
        
        // パワーに応じて色を変更
        if (percentage > 80) {
            powerIndicator.style.borderColor = '#ff4444';
            powerIndicator.style.background = 'rgba(255, 68, 68, 0.3)';
            powerIndicator.style.color = '#ff4444';
        } else if (percentage > 50) {
            powerIndicator.style.borderColor = '#ff9800';
            powerIndicator.style.background = 'rgba(255, 152, 0, 0.3)';
            powerIndicator.style.color = '#ff9800';
        } else {
            powerIndicator.style.borderColor = '#ffeb3b';
            powerIndicator.style.background = 'rgba(255, 235, 59, 0.3)';
            powerIndicator.style.color = '#ffeb3b';
        }
        
        gameArea.appendChild(powerIndicator);
        
        // 自動削除（アニメーション終了後）
        setTimeout(() => {
            if (powerIndicator.parentNode) {
                powerIndicator.parentNode.removeChild(powerIndicator);
            }
        }, 1500);
    }
    
    // ノーツ生成と管理
    spawnNote(noteData) {
        const note = document.createElement('div');
        note.className = `note ${noteData.side}-note`;
        note.textContent = this.activeNotes.length + 1;
        
        // ノーツをレーンに配置
        const lane = document.querySelector(`.${noteData.side}-lane`);
        lane.appendChild(note);
        
        // アニメーション設定
        note.style.animationDuration = `${this.fallSpeed}ms`;
        
        // アクティブノーツリストに追加
        const activeNote = {
            id: this.noteIdCounter++,
            side: noteData.side,
            element: note,
            spawnTime: Date.now(),
            hitLineTime: Date.now() + (this.fallSpeed * 0.5), // ヒットライン通過時間（落下時間の50%地点）
            isHit: false
        };
        
        this.activeNotes.push(activeNote);
        
        // アニメーション終了後に自動削除
        setTimeout(() => {
            const index = this.activeNotes.findIndex(n => n.id === activeNote.id);
            if (index !== -1) {
                // ヒットされていない場合はミス処理
                if (!this.activeNotes[index].isHit) {
                    this.onNoteMiss(this.activeNotes[index]);
                } else {
                    // ヒット済みの場合は単純に削除
                    this.activeNotes.splice(index, 1);
                    this.removeNoteElement(activeNote.element);
                }
            }
        }, this.fallSpeed + 100); // アニメーション時間+少し余裕
    }
    
    // ノーツミス処理
    onNoteMiss(note) {
        const index = this.activeNotes.findIndex(n => n.id === note.id);
        if (index !== -1) {
            this.activeNotes.splice(index, 1);
            this.removeNoteElement(note.element);
            
            this.punchStats.missHits++;
            this.combo = 0; // コンボリセット
            
            this.showJudgment('miss', 0);
            this.updateScore();
            this.updatePunchStats();
            this.updateSongProgress();
            
            console.log('MISS!');
        }
    }
    
    // ノーツ要素削除
    removeNoteElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }
    
    // 楽曲進行表示更新
    updateSongProgress() {
        const completedNotes = this.punchStats.successfulHits + this.punchStats.missHits;
        const totalPossibleScore = this.totalNotes * 100; // 最大スコア（各ノーツ100点）
        const achievementRate = totalPossibleScore > 0 ? (this.score / totalPossibleScore * 100) : 0;
        
        // コンビネーション進行計算
        const totalCombos = this.songData.length > 0 ? 
            Math.max(...this.songData.map(note => note.comboId)) + 1 : 0;
        
        // DOM要素の存在確認
        const currentNoteElement = document.getElementById('currentNote');
        const comboProgressElement = document.getElementById('comboProgress');
        const achievementElement = document.getElementById('achievementRate');
        
        if (currentNoteElement) {
            currentNoteElement.textContent = `${completedNotes} / ${this.totalNotes}`;
        }
        if (comboProgressElement) {
            comboProgressElement.textContent = `${this.punchStats.comboSuccess} / ${totalCombos}`;
        }
        if (achievementElement) {
            achievementElement.textContent = `${achievementRate.toFixed(1)}%`;
            
            // クリア判定の色変更
            if (achievementRate >= this.targetClearRate) {
                achievementElement.style.color = '#4CAF50';
            } else if (achievementRate >= this.targetClearRate * 0.8) {
                achievementElement.style.color = '#FF9800';
            } else {
                achievementElement.style.color = '#f44336';
            }
        }
    }
    
    // パンチ統計更新
    updatePunchStats() {
        const totalPunchesElement = document.getElementById('totalPunches');
        const successfulHitsElement = document.getElementById('successfulHits');
        const hitRateElement = document.getElementById('hitRate');
        const avgPowerElement = document.getElementById('avgPower');
        
        if (totalPunchesElement) {
            totalPunchesElement.textContent = this.punchStats.totalPunches;
        }
        if (successfulHitsElement) {
            successfulHitsElement.textContent = this.punchStats.successfulHits;
        }
        
        const hitRate = this.punchStats.totalPunches > 0 
            ? (this.punchStats.successfulHits / this.punchStats.totalPunches * 100).toFixed(1)
            : 0;
        if (hitRateElement) {
            hitRateElement.textContent = `${hitRate}%`;
        }
        
        const avgPower = this.punchStats.totalPunches > 0 
            ? (this.punchStats.totalPower / this.punchStats.totalPunches).toFixed(1)
            : 0;
        if (avgPowerElement) {
            avgPowerElement.textContent = avgPower;
        }
    }
    
    // 顔ダメージアニメーション
    showFaceDamage() {
        const faceImage = document.getElementById('faceImage');
        faceImage.src = 'images/guf.png';
        
        setTimeout(() => {
            faceImage.src = 'images/normal.png';
        }, 500);
    }
    
    // パワーメーター更新
    updatePowerMeter(ratio) {
        const powerFill = document.getElementById('powerFill');
        const powerValue = document.getElementById('powerValue');
        
        const percentage = Math.floor(ratio * 100);
        powerFill.style.width = `${percentage}%`;
        powerValue.textContent = percentage;
    }
    
    // キャリブレーション開始
    startCalibration() {
        if (!this.leftCore && !this.rightCore) {
            alert('少なくとも1つのORPHE COREを接続してください。');
            return;
        }
        
        this.gameState = 'calibrating';
        this.calibrationData = [];
        
        document.getElementById('calibrateBtn').disabled = true;
        document.getElementById('calibrationStatus').textContent = `測定中... (${this.calibrationDuration}秒)`;
        
        // カウントダウン
        let countdown = this.calibrationDuration;
        const interval = setInterval(() => {
            countdown--;
            document.getElementById('calibrationStatus').textContent = `測定中... (${countdown}秒)`;
            
            if (countdown <= 0) {
                clearInterval(interval);
                this.finishCalibration();
            }
        }, 1000);
    }
    
    // キャリブレーション完了
    finishCalibration() {
        if (this.calibrationData.length > 0) {
            this.maxAcceleration = Math.max(...this.calibrationData);
            document.getElementById('baselineValue').textContent = this.maxAcceleration.toFixed(2);
        }
        
        this.gameState = 'idle';
        document.getElementById('calibrateBtn').disabled = false;
        document.getElementById('calibrationStatus').textContent = 'キャリブレーション完了';
        
        this.updateGameButtons();
    }
    
    // ゲーム開始
    startGame() {
        if ((!this.leftCore && !this.rightCore) || this.maxAcceleration <= 0) {
            alert('デバイスの接続とキャリブレーションを完了してください。');
            return;
        }
        
        this.gameState = 'playing';
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.currentNoteIndex = 0;
        this.songData = this.generateSongData(); // 新しい楽曲データ生成
        this.totalNotes = this.songData.length;
        this.gameStartTime = Date.now();
        
        // パンチ統計リセット
        this.punchStats = {
            totalPunches: 0,
            successfulHits: 0,
            totalPower: 0,
            maxPower: 0,
            perfectHits: 0,
            goodHits: 0,
            missHits: 0,
            comboSuccess: 0, // 完璧なコンビネーション成功数
            comboTotal: 0    // 総コンビネーション数
        };
        
        // アクティブノーツクリア
        this.activeNotes.forEach(note => this.removeNoteElement(note.element));
        this.activeNotes = [];
        
        this.updateUI();
        this.updateGameButtons();
        this.updatePunchStats();
        this.updateSongProgress();
        
        // 楽曲スケジューラー開始
        this.scheduleNotes();
        
        console.log('ゲーム開始！');
    }
    
    // ノーツスケジューリング
    scheduleNotes() {
        this.songData.forEach(note => {
            setTimeout(() => {
                if (this.gameState === 'playing') {
                    this.spawnNote(note);
                    this.currentNoteIndex++;
                    
                    // 全ノーツ完了チェック
                    if (this.currentNoteIndex >= this.totalNotes) {
                        setTimeout(() => {
                            if (this.gameState === 'playing') {
                                this.endGame();
                            }
                        }, this.fallSpeed + 2000); // 最後のノーツ+余裕時間
                    }
                }
            }, note.time);
        });
    }
    
    // ゲーム一時停止
    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
        
        this.updateGameButtons();
    }
    
    // ゲーム終了
    endGame() {
        this.gameState = 'idle';
        
        // 残りノーツをクリア
        this.activeNotes.forEach(note => this.removeNoteElement(note.element));
        this.activeNotes = [];
        
        // 背景音楽は継続再生（停止したい場合は this.stopBackgroundMusic(); を有効にする）
        
        // 最終結果計算
        const totalPossibleScore = this.totalNotes * 100;
        const achievementRate = totalPossibleScore > 0 ? (this.score / totalPossibleScore * 100) : 0;
        const clearResult = achievementRate >= this.targetClearRate ? 'CLEAR!' : 'FAILED...';
        
        const hitRate = this.punchStats.totalPunches > 0 
            ? (this.punchStats.successfulHits / this.punchStats.totalPunches * 100).toFixed(1)
            : 0;
        const avgPower = this.punchStats.totalPunches > 0 
            ? (this.punchStats.totalPower / this.punchStats.totalPunches).toFixed(1)
            : 0;
        
        alert(`ゲーム終了!\n\n` +
              `${clearResult}\n` +
              `最終スコア: ${this.score} / ${totalPossibleScore}\n` +
              `達成率: ${achievementRate.toFixed(1)}% (目標: ${this.targetClearRate}%)\n` +
              `最大コンボ: ${this.maxCombo}\n\n` +
              `Perfect: ${this.punchStats.perfectHits}\n` +
              `Good: ${this.punchStats.goodHits}\n` +
              `Miss: ${this.punchStats.missHits}\n\n` +
              `パンチ回数: ${this.punchStats.totalPunches}\n` +
              `成功率: ${hitRate}%\n` +
              `平均パンチ力: ${avgPower}`);
        
        this.updateGameButtons();
    }
    
    // ゲームリセット
    resetGame() {
        this.gameState = 'idle';
        
        // アクティブノーツクリア
        this.activeNotes.forEach(note => this.removeNoteElement(note.element));
        this.activeNotes = [];
        
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.currentNoteIndex = 0;
        
        // パンチ統計リセット
        this.punchStats = {
            totalPunches: 0,
            successfulHits: 0,
            totalPower: 0,
            maxPower: 0,
            perfectHits: 0,
            goodHits: 0,
            missHits: 0,
            comboSuccess: 0, // 完璧なコンビネーション成功数
            comboTotal: 0    // 総コンビネーション数
        };
        
        this.updateUI();
        this.updateGameButtons();
        this.updatePunchStats();
        this.updateSongProgress();
    }
    
    // スコア更新
    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = this.combo;
    }
    
    // UI更新
    updateUI() {
        this.updateScore();
    }
    
    // ボタン状態更新
    updateGameButtons() {
        const hasDevice = this.leftCore || this.rightCore;
        const hasCalibration = this.maxAcceleration > 0;
        const canStart = hasDevice && hasCalibration;
        
        document.getElementById('startBtn').disabled = !canStart || this.gameState === 'playing';
        document.getElementById('pauseBtn').disabled = this.gameState !== 'playing' && this.gameState !== 'paused';
        
        // ボタンテキスト更新
        if (this.gameState === 'paused') {
            document.getElementById('pauseBtn').textContent = '再開';
        } else {
            document.getElementById('pauseBtn').textContent = '一時停止';
        }
    }
}

// ゲーム初期化
document.addEventListener('DOMContentLoaded', () => {
    window.boxingGame = new BoxingGame();
});

// デバッグ用の擬似センサーデータ生成（ORPHE COREが接続されていない場合のテスト用）
function generateDummyData() {
    if (window.boxingGame && !window.boxingGame.leftCore && !window.boxingGame.rightCore) {
        const now = Date.now();
        
        // 擬似加速度データ生成
        const baseAccel = 1.0; // 重力を正規化した値
        const noise = (Math.random() - 0.5) * 0.2;
        const spike = Math.random() < 0.05 ? Math.random() * 2.0 : 0; // 5%の確率でパンチスパイク
        
        const dummyAccel = {
            x: baseAccel + noise + spike,
            y: noise,
            z: noise
        };
        
        const dummyGyro = {
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
            z: (Math.random() - 0.5) * 10
        };
        
        // 左手と右手の両方にダミーデータ送信
        window.boxingGame.onAccelData('left', dummyAccel);
        window.boxingGame.onGyroData('left', dummyGyro);
        window.boxingGame.onAccelData('right', dummyAccel);
        window.boxingGame.onGyroData('right', dummyGyro);
    }
}

// デバッグモード（10秒後に開始）
setTimeout(() => {
    if (window.boxingGame && !window.boxingGame.leftCore && !window.boxingGame.rightCore) {
        console.log('ORPHE COREが検出されません。デバッグモードでダミーデータを生成します。');
        setInterval(generateDummyData, 50); // 20Hz
    }
}, 10000); 