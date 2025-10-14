/**
 * DEBUG HELPER - デバッグ用のヘルパー関数
 * コンソールで window.debugHelper を使って各種デバッグ機能にアクセス
 */

window.debugHelper = {
    /**
     * 全システムの診断情報を表示
     */
    checkAll: function() {
        console.log('═══════════════════════════════════════');
        console.log('🔍 ORPHE DDR Game - System Diagnostics');
        console.log('═══════════════════════════════════════');
        
        // 1. ゲームの基本状態
        console.log('\n📊 Game Status:');
        console.log('  State:', window.game?.state() || 'undefined');
        console.log('  Audio Manager:', window.game?.audioManager ? '✅' : '❌');
        console.log('  Chart Manager:', window.game?.chartManager ? '✅' : '❌');
        console.log('  Player Manager:', window.game?.playerManager ? '✅' : '❌');
        console.log('  Game Renderer:', window.game?.gameRenderer ? '✅' : '❌');
        
        // 2. ORPHE CORE状態
        console.log('\n👟 ORPHE CORE Status:');
        console.log('  ORPHE class loaded:', typeof Orphe !== 'undefined' ? '✅' : '❌');
        console.log('  CoreToolkit loaded:', typeof buildCoreToolkit !== 'undefined' ? '✅' : '❌');
        console.log('  Devices created:', window.game?.orpheData ? '✅' : '❌');
        
        // 3. HTML要素チェック
        console.log('\n🎨 UI Elements:');
        const elements = {
            'Canvas': 'gameCanvas',
            'Start Button': 'startBtn',
            'Restart Button': 'restartBtn',
            'Chart Select': 'chartSelect',
            'Score Display': 'score',
            'Combo Display': 'combo',
            'Toolkit 1': 'toolkit_placeholder1',
            'Toolkit 2': 'toolkit_placeholder2'
        };
        
        for (const [name, id] of Object.entries(elements)) {
            const exists = document.getElementById(id) !== null;
            console.log(`  ${name}:`, exists ? '✅' : '❌');
        }
        
        // 4. モジュール読み込み状態
        console.log('\n📦 Module Loading:');
        console.log('  AudioManager:', typeof AudioManager !== 'undefined' ? '✅' : '❌');
        console.log('  ChartManager:', typeof ChartManager !== 'undefined' ? '✅' : '❌');
        console.log('  PlayerManager:', typeof PlayerManager !== 'undefined' ? '✅' : '❌');
        console.log('  GameRenderer:', typeof GameRenderer !== 'undefined' ? '✅' : '❌');
        
        // 5. エラー検出
        console.log('\n⚠️ Potential Issues:');
        const issues = [];
        
        if (typeof Orphe === 'undefined') {
            issues.push('ORPHE-CORE.js not loaded');
        }
        if (!document.getElementById('gameCanvas')) {
            issues.push('Canvas element missing');
        }
        if (!document.getElementById('startBtn')) {
            issues.push('Start button missing');
        }
        if (!window.game?.audioManager) {
            issues.push('AudioManager not initialized');
        }
        
        if (issues.length === 0) {
            console.log('  ✅ No issues detected!');
        } else {
            issues.forEach(issue => console.log('  ❌', issue));
        }
        
        console.log('\n═══════════════════════════════════════\n');
        
        return {
            allGood: issues.length === 0,
            issues: issues
        };
    },
    
    /**
     * ゲームを強制開始（デバッグ用）
     */
    forceStart: function() {
        console.log('🚀 Force starting game...');
        if (window.game?.start) {
            window.game.start();
        } else {
            console.error('❌ Game start function not available');
        }
    },
    
    /**
     * ゲーム状態をリセット
     */
    reset: function() {
        console.log('🔄 Resetting game...');
        if (window.game?.restart) {
            window.game.restart();
        } else {
            console.error('❌ Game restart function not available');
        }
    },
    
    /**
     * キャンバスの状態を確認
     */
    checkCanvas: function() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            console.error('❌ Canvas not found!');
            return;
        }
        
        console.log('🎨 Canvas Status:');
        console.log('  Element:', canvas);
        console.log('  Width:', canvas.width);
        console.log('  Height:', canvas.height);
        console.log('  Context:', canvas.getContext('2d') ? '✅' : '❌');
        
        const rect = canvas.getBoundingClientRect();
        console.log('  Position:', { x: rect.x, y: rect.y });
        console.log('  Visible:', rect.width > 0 && rect.height > 0 ? '✅' : '❌');
    },
    
    /**
     * 簡易テスト - キーボード入力
     */
    testKeyboard: function() {
        console.log('⌨️ Testing keyboard input...');
        console.log('Press arrow keys now. Check console for input detection.');
        
        const handler = (e) => {
            if (['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
                console.log('✅ Key detected:', e.key);
            }
        };
        
        window.addEventListener('keydown', handler);
        
        setTimeout(() => {
            window.removeEventListener('keydown', handler);
            console.log('⌨️ Keyboard test ended');
        }, 10000);
        
        console.log('ℹ️ Test will run for 10 seconds');
    },
    
    /**
     * スコアを手動設定（テスト用）
     */
    setScore: function(score) {
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = score;
            console.log('✅ Score set to:', score);
        } else {
            console.error('❌ Score element not found');
        }
    },
    
    /**
     * ヘルプを表示
     */
    help: function() {
        console.log('🔧 Debug Helper Commands:');
        console.log('  debugHelper.checkAll()      - 全システムチェック');
        console.log('  debugHelper.forceStart()    - ゲーム強制開始');
        console.log('  debugHelper.reset()         - ゲームリセット');
        console.log('  debugHelper.checkCanvas()   - キャンバス確認');
        console.log('  debugHelper.testKeyboard()  - キーボードテスト');
        console.log('  debugHelper.setScore(100)   - スコア設定');
        console.log('  debugHelper.help()          - このヘルプ');
        console.log('');
        console.log('🎮 Game Object:');
        console.log('  window.game.diagnostics()   - ゲーム診断');
        console.log('  window.game.state()         - 現在の状態');
        console.log('  window.game.start()         - ゲーム開始');
        console.log('  window.game.restart()       - ゲーム再開');
    }
};

// 初回読み込み時に自動チェック
console.log('🔧 Debug Helper loaded!');
console.log('💡 Type debugHelper.help() for available commands');
console.log('💡 Type debugHelper.checkAll() to check system status');
