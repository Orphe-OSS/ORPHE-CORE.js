/**
 * アイテム描画ロジック
 */
function drawItem(p, obs, frameCount) {
    p.push();
    if (obs.type === 'power-up') {
        // 黄金のオーブ
        p.fill(255, 215, 0);
        p.stroke(255);
        p.strokeWeight(1 + Math.sin(frameCount * 0.2));
        p.ellipse(0, -15, 12, 12);
        p.noStroke();
        p.fill(255);
        p.ellipse(2, -18, 3, 3);
    }
    p.pop();
}
