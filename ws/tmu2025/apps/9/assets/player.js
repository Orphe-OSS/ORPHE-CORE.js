/**
 * キャラクター描画ロジック（自分自身）
 * ピクセルアートスタイルの影のワイヤーウォーカー（忍者シルエットVer. + 無敵演出 + もや）
 */
function drawPlayerCharacter(p, player, isPlaying, frameCount) {
    p.push();

    // 基本位置へ移動
    p.translate(player.x, player.baseY + player.balanceY + player.y);

    // --- 姿勢の制御 ---
    // 疾走感のある深い前傾姿勢 (約25度)
    let forwardLean = 0;
    if (player.isFalling) {
        forwardLean = frameCount * 0.25; // 落ちる時は回転を速く
    } else if (isPlaying) {
        forwardLean = p.radians(25); // より深く前傾して走る
    }
    p.rotate(forwardLean);

    // 左右のバランスの微妙な揺れ
    if (!player.isFalling) {
         p.rotate(p.radians(player.balanceY * 0.4));
    }

    // --- デザイン設定（影のシルエット + 無敵発光） ---
    p.noStroke();
    // 基本の影色
    let shadowColor = p.color(20, 20, 25); 
    
    // 無敵中の発光表現：影色と金色との間で明滅させる
    if (player.invincibleTimer > 0) {
        // 0.0〜1.0の間で滑らかに変化する値
        let glow = (Math.sin(frameCount * 1.5) + 1) / 2;
        // 影色から金色へ補間
        shadowColor = p.lerpColor(p.color(20, 20, 25), p.color(255, 215, 0), glow);
    }
    
    // 足元（影） - ワイヤー上の位置に合わせる
    if (!player.isJumping && !player.isFalling && isPlaying) {
        p.fill(0, 0, 0, 80);
        p.ellipse(0, -player.y - player.balanceY + 1, 16, 4);
    }
    
    // 疾走エフェクト（残像風の風）
    if (isPlaying && !player.isJumping && !player.isFalling) {
        drawSpeedEffect(p, frameCount, player.invincibleTimer > 0);
    }

    // --- アニメーション変数の計算 ---
    // 無敵中はアニメーション速度を上げる
    let animSpeed = player.invincibleTimer > 0 ? 0.8 : 0.3;
    let animCycle = frameCount * animSpeed; 
    let legSwingAngle = Math.sin(animCycle) * 12;
    let armSwingAngle = Math.cos(animCycle) * 12;

    if (!isPlaying || player.isJumping || player.isFalling) {
        legSwingAngle = 0;
        armSwingAngle = 0;
    }

    // --- 描画順序（計算した色で統一） ---
    // Use fill color for consistency
    p.fill(shadowColor);

    // Get design from GAME_CONFIG safely
    let designType = 0;
    try {
        if (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.PLAYER_DESIGN !== undefined) {
            designType = GAME_CONFIG.PLAYER_DESIGN;
        }
    } catch (e) {
        // Fallback to default
    }

    if (designType === 1) {
        drawStickDesign(p, isPlaying, frameCount, legSwingAngle, armSwingAngle, shadowColor);
    } else if (designType === 2) {
        drawCloakDesign(p, isPlaying, frameCount, legSwingAngle, armSwingAngle, shadowColor);
    } else {
        drawNinjaDesign(p, isPlaying, frameCount, legSwingAngle, armSwingAngle, shadowColor);
    }

    // --- もやエフェクトの追加 ---
    drawHazeEffect(p, frameCount, player.invincibleTimer > 0);

    p.pop();
}

function drawNinjaDesign(p, isPlaying, frameCount, legSwingAngle, armSwingAngle, shadowColor) {
    // 奥の腕（左腕）
    p.push();
    p.translate(-3, -19);
    p.rotate(p.radians(armSwingAngle));
    p.rect(-2, 0, 4, 9, 1);
    p.pop();

    // 奥の脚（左脚）
    p.push();
    p.translate(-2, -4);
    p.rotate(p.radians(-legSwingAngle));
    p.rect(-2.5, 0, 5, 8, 1);
    p.push();
    p.translate(0, 8);
    let kneeBendLeft = legSwingAngle > 0 ? -legSwingAngle * 1.2 : 0;
    p.rotate(p.radians(kneeBendLeft)); 
    p.rect(-2, 0, 4, 6);
    p.pop();
    p.pop();

    // 体 (胴体)
    p.rect(-5, -22, 10, 18, 2);

    // 帯
    p.rect(-5.5, -13, 11, 3);

    // 背中の刀
    p.push();
    p.translate(1, -16);
    p.rotate(p.radians(-25));
    p.rect(-1.5, -10, 3, 20);
    p.rect(-2, -12, 4, 2);
    p.pop();

    // 頭 (Small head)値は、(-4は頭の中心X、-28は頭の中心Y)size 8x8
    p.rect(-2.5, -28, 6, 6, 2);
    // 顔
    p.ellipse(-3.5, -25, 7, 3);
    // 鉢巻
    p.rect(-4.5, -29, 9, 2);
    
    // 鉢巻の結び目のなびき
    if (isPlaying) {
        let wind = Math.sin(frameCount * 0.4) * 5;
        p.push();
        p.translate(-4, -28);
        p.rotate(p.radians(-40 + wind));
        p.rect(-10, -1, 10, 2);
        p.pop();
    }

    // 手前の脚（右脚）
    p.push();
    p.translate(2, -4);
    p.rotate(p.radians(legSwingAngle));
    p.rect(-2.5, 0, 5, 8, 1);
    p.push();
    p.translate(0, 8);
    let kneeBendRight = legSwingAngle < 0 ? legSwingAngle * 1.2 : 0;
    p.rotate(p.radians(kneeBendRight)); 
    p.rect(-2, 0, 4, 6);
    p.pop();
    p.pop();
    
    // 手前の腕（右腕）
    p.push();
    p.translate(3, -19);
    p.rotate(p.radians(-armSwingAngle));
    p.rect(-2, 0, 4, 9, 1);
    p.pop();
}

function drawStickDesign(p, isPlaying, frameCount, legSwingAngle, armSwingAngle, shadowColor) {
    // Stick figure: High contrast, very thin
    p.strokeWeight(3);
    p.stroke(shadowColor); 
    
    // Head (Tiny circle)
    p.noStroke();
    p.fill(shadowColor);
    p.ellipse(0, -28, 6, 6);
    
    p.stroke(shadowColor);
    // Body
    p.line(0, -25, 0, -8);
    
    // Legs
    // Left Leg
    p.push();
    p.translate(0, -8);
    p.rotate(p.radians(-legSwingAngle * 1.5));
    p.line(0, 0, 0, 8);
    p.translate(0, 8);
    p.rotate(p.radians(legSwingAngle > 0 ? -legSwingAngle : 0));
    p.line(0, 0, 0, 8);
    p.pop();
    
    // Right Leg
    p.push();
    p.translate(0, -8);
    p.rotate(p.radians(legSwingAngle * 1.5));
    p.line(0, 0, 0, 8);
    p.translate(0, 8);
    p.rotate(p.radians(legSwingAngle < 0 ? legSwingAngle : 0));
    p.line(0, 0, 0, 8);
    p.pop();
    
    // Arms
    // Left Arm
    p.push();
    p.translate(0, -22);
    p.rotate(p.radians(armSwingAngle * 2));
    p.line(0, 0, 0, 10);
    p.pop();
    
    // Right Arm
    p.push();
    p.translate(0, -22);
    p.rotate(p.radians(-armSwingAngle * 2));
    p.line(0, 0, 0, 10);
    p.pop();
    
    p.noStroke();
}

function drawCloakDesign(p, isPlaying, frameCount, legSwingAngle, armSwingAngle, shadowColor) {
    // Cloaked Shadow: Triangular shape, mysterious
    
    // Head (Very small peeking out)
    p.ellipse(1, -28, 5, 5);
    
    // Cloak/Body
    p.beginShape();
    p.vertex(4, -26); // Top front
    p.vertex(8, -5);  // Bottom front
    
    // Flowing back of the cloak
    let wave = Math.sin(frameCount * 0.2) * 5;
    p.vertex(-12 + wave, 0); // Tail
    p.vertex(-10, -15);      // Mid back
    p.vertex(-2, -26);       // Top back
    p.endShape(p.CLOSE);
    
    // Thin legs peeking out
    p.rect(-3, -5, 2, 8);
    p.rect(1, -5, 2, 8);
    
    // Minimal scarf
    p.push();
    p.translate(-1, -25);
    let scarfWave = Math.sin(frameCount * 0.3) * 8;
    p.rotate(p.radians(-20 + scarfWave));
    p.rect(-8, -1, 8, 2);
    p.pop();
}

/**
 * 疾走感のエフェクト（残像のような風）を描画するヘルパー関数
 * 無敵状態によって色と数を変化させる
 */
function drawSpeedEffect(p, frameCount, isInvincible) {
    p.push();
    p.noStroke();
    
    // 色の設定：無敵時は黄色、通常は白/グレー
    if (isInvincible) {
        p.fill(255, 255, 0, 100);
    } else {
        p.fill(240, 240, 240, 40); 
    }
    
    // 速度と数の設定
    let effectSpeed = isInvincible ? 1.0 : 0.4;
    let lineCount = isInvincible ? 8 : 4;

    for (let i = 0; i < lineCount; i++) {
        let cycle = (frameCount * effectSpeed + i * 20) % 60; 
        let yWobble = Math.sin(frameCount * 0.2 + i) * 2;
        
        let xStart = -15 - cycle;
        let width = 15 + cycle * 0.5;
        let height = 2 - i * 0.4;
        // 無敵時は間隔を詰めて密度を上げる
        let yOffset = isInvincible ? i * 4 : i * 8;
        
        p.rect(xStart, -25 + yOffset + yWobble, width, height, 1);
    }
    p.pop();
}

/**
 * キャラクター全体にかかる「もや」エフェクトを描画するヘルパー関数
 * 無敵状態によって色、範囲、粒子の数を変化させる
 */
function drawHazeEffect(p, frameCount, isInvincible) {
    p.push();
    p.noStroke();

    // アルファ値の計算（ゆらぎ）
    let baseAlpha = isInvincible ? 60 : 30;
    let hazeAlpha = baseAlpha + Math.sin(frameCount * 0.05) * 15;
    
    // 色の設定：無敵時は金色、通常は白
    if (isInvincible) {
        p.fill(255, 215, 0, hazeAlpha);
    } else {
        p.fill(255, 255, 255, hazeAlpha);
    }

    // メインの楕円（範囲）
    let ellipseW = isInvincible ? 90 : 70;
    let ellipseH = isInvincible ? 100 : 80;
    p.ellipse(0, -15, ellipseW, ellipseH);
    
    // 粒子の設定
    if (isInvincible) p.fill(255, 255, 255, 60);
    else p.fill(255, 255, 255, 20);
    
    let particleCount = isInvincible ? 20 : 8;
    let rangeX = isInvincible ? 40 : 25;
    let rangeYMin = isInvincible ? -55 : -45;
    let rangeYMax = isInvincible ? 20 : 15;
    let maxParticleSize = isInvincible ? 10 : 8;

    p.randomSeed(frameCount); // フレームごとに同じパターンにする
    for(let i=0; i < particleCount; i++) {
        let noiseX = p.random(-rangeX, rangeX);
        let noiseY = p.random(rangeYMin, rangeYMax);
        p.ellipse(noiseX, noiseY, p.random(3, maxParticleSize));
    }

    p.pop();
}
