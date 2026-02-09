/**
 * 敵キャラクター描画ロジック
 */
function drawEnemy(p, obs, frameCount) {
    p.push();
    if (obs.type === 'bird') {
        p.fill(0);
        p.rect(-8, -15, 16, 8);
        // 羽ばたきアニメーション
        if (frameCount % 20 < 10) {
            p.triangle(-4, -15, 4, -15, 0, -22);
        } else {
            p.triangle(-4, -10, 4, -10, 0, -3);
        }
    } else if (obs.type === 'sign') {
        // 看板
        p.fill(139, 69, 19);
        p.rect(-1, -4, 2, 4); 
        p.fill(200, 180, 100);
        p.rect(-10, -18, 20, 14);
        p.fill(0);
        p.textSize(8);
        p.textAlign(p.CENTER);
        p.text("!", 0, -8);
    }
    p.pop();
}
