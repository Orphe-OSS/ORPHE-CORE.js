class Coin {
    constructor() {
        this.img = loadImage('coin.png');
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
    }
    draw() {
        if (this.life > 0) {
            this.x += this.vx;
            this.y += this.vy;
            imageMode(CENTER);
            tint(255, 255 * (this.life / 120)); // Display at half opacity
            image(this.img, this.x, this.y);
            this.life--;
        }
    }
}
class CoinEffect {
    constructor(number) {
        this.coins = [];
        for (let i = 0; i < number; i++) {
            this.coins[i] = new Coin();
        }
    }
    draw() {
        for (let coin of this.coins) {
            coin.draw();
        }
    }
    create(x, y) {
        for (let coin of this.coins) {
            if (coin.life == 0) {
                coin.x = x;
                coin.y = y;
                coin.vx = 0.0;
                coin.vy = -3;
                coin.life = 120;
                return;
            }
        }
    }
}