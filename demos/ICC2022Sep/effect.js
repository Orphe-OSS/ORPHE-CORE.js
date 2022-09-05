class Coin {
    constructor() {
        this.img = loadImage('coin.png');
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.info = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            text: ''
        }
        this.life = 0;
        this.sign = '+';
    }
    draw() {
        if (this.life > 0) {
            this.x += this.vx;
            this.y += this.vy;
            imageMode(CENTER);
            tint(255, 255 * (this.life / 60)); // Display at half opacity            
            image(this.img, this.x, this.y);
            textAlign(CENTER, CENTER);


            this.info.x += this.info.vx;
            this.info.y += this.info.vy;
            textSize(width / 10);
            if (this.sign == '+') {
                //fill(69, 230, 230, 255 * (this.life / 120)); // Display at half opacity            )
                fill(210, 210, 64, 255 * sin(HALF_PI * this.life / 60)); // Display at half opacity            )
                text(`Good Walk!!\n${this.sign}0.072 yen`, this.info.x, this.info.y);
            }
            else {
                fill(69, 230, 230, 255 * (this.life / 60)); // Display at half opacity            )
                text(`Bad Walk!!\n${this.sign}0.072 yen`, this.info.x, this.info.y);
            }

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
    create(x, y, sign = '+') {
        for (let coin of this.coins) {
            if (coin.life == 0) {
                coin.x = x;
                coin.y = y;
                coin.vx = 0.0;
                if (sign == '-') {
                    coin.vy = 3;
                }
                else if (sign == '+') {
                    coin.vy = -3;
                }
                coin.life = 60;
                coin.sign = sign;
                coin.info.x = width / 2;
                coin.info.y = height / 2;
                coin.info.vx = 0.0;
                coin.info.vy = 0;
                return;
            }
        }
    }
}


class Particle {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = random(-1.0, 1.0);
        this.vy = random(-300, -150);
        this.ay = -0.05;
        this.life = 0;
    }
    draw() {
        if (this.life > 0) {
            this.x += this.vx;
            this.y += this.vy;
            this.vy -= this.ay;
            fill(255);
            stroke(255, 255, 255, 255 * sin(HALF_PI * this.life / 60));

            strokeWeight(5);
            beginShape(POINTS);
            vertex(this.x, this.y);
            endShape();
            this.life--;
        }
    }
}
class ParticleEffect {
    constructor(number) {
        this.particles = [];
        for (let i = 0; i < number; i++) {
            this.particles[i] = new Particle();
        }
    }
    draw() {
        for (let particle of this.particles) {
            particle.draw();
        }
    }
    create(x, y, number) {
        let count = 0;
        for (let particle of this.particles) {
            if (particle.life == 0) {
                particle.x = x + 10 * cos(random(PI));
                particle.y = y + 10 * sin(random(PI));
                particle.vx = random(-1.0, 1.0);
                particle.vy = random(-3, -1.5);

                particle.life = 60;
                count++;
                if (count > number) {
                    return;
                }
            }
        }
    }
}

class ArrowEffect {
    constructor() {
        this.arrow = [];
        for (let i = 0; i < 5; i++) {
            this.arrow[i] = {
                vec0: createVector(0, 0),
                vec1: createVector(0, 0),
                vec1_original: createVector(0, 0),
                life: 0,
                color: 'black'
            }
        }
    }
    create(base, vec, text) {

        for (let a of this.arrow) {
            if (a.life == 0) {
                a.life = 30;
                a.vec0 = base;
                a.vec1 = vec;
                a.vec1_original.x = vec.x;
                a.vec1_original.y = vec.y;
                a.color = 'black';
                a.text = text;
                return;
            }
        }
    }
    draw() {
        for (let a of this.arrow) {
            if (a.life > 0) {
                a.vec1.y = a.vec1_original.y * sin(PI * (a.life / 30));
                push();
                stroke(0, 0, 0);//, 255 * sin(HALF_PI * a.life / 60));
                strokeWeight(width / 60);
                fill(0, 0, 0);//, 255 * sin(HALF_PI * a.life / 60));
                translate(a.vec0.x, a.vec0.y);
                line(0, 0, a.vec1.x, a.vec1.y);
                rotate(a.vec1.heading());
                let arrowSize = width / 1000;
                translate(a.vec1.mag() - arrowSize, 0);
                triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
                pop();
                textSize(width / 30);
                text(a.text, a.vec0.x, a.vec0.y);
                a.life--;
            }
        }
    }
}