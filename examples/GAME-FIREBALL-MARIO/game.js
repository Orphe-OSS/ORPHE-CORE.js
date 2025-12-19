/**
 * GAME-FIREBALL-MARIO: 2D Action Game Engine
 * Controls: Walking (steps), Kicking (fireball), Jumping
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  const CONFIG = {
    canvas: {
      width: 900,
      height: 500
    },
    player: {
      width: 40,
      height: 50,
      groundY: 380,
      walkSpeed: 3,
      jumpPower: 15,
      gravity: 0.6,
      maxJumpHeight: 150
    },
    fireball: {
      speed: 8,
      radius: 12,
      lifetime: 3000
    },
    enemy: {
      width: 35,
      height: 35,
      speed: 2,
      spawnInterval: 2500,
      minDistance: 400
    },
    world: {
      groundHeight: 120,
      scrollSpeed: 0
    }
  };

  // ============================================================================
  // SOUND SYSTEM
  // ============================================================================
  class SoundSystem {
    constructor() {
      this.ctx = null;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    }

    playJump() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    }

    playFireball() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    }

    playHit() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);

      // Second tone
      setTimeout(() => {
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 880;
        gain2.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start();
        osc2.stop(this.ctx.currentTime + 0.15);
      }, 100);
    }

    playStep() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 100 + Math.random() * 50;
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    }
  }

  // ============================================================================
  // PARTICLE SYSTEM
  // ============================================================================
  class Particle {
    constructor(x, y, vx, vy, color, life, size) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.life = life;
      this.maxLife = life;
      this.size = size;
    }

    update(dt) {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.2;
      this.life -= dt;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    isDead() {
      return this.life <= 0;
    }
  }

  class ParticleSystem {
    constructor() {
      this.particles = [];
    }

    emit(x, y, count, colors, speedRange) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.particles.push(new Particle(
          x, y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 2,
          color,
          0.5 + Math.random() * 0.5,
          3 + Math.random() * 4
        ));
      }
    }

    update(dt) {
      this.particles = this.particles.filter(p => {
        p.update(dt);
        return !p.isDead();
      });
    }

    draw(ctx) {
      this.particles.forEach(p => p.draw(ctx));
    }
  }

  // ============================================================================
  // PLAYER
  // ============================================================================
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = CONFIG.player.width;
      this.height = CONFIG.player.height;
      this.vx = 0;
      this.vy = 0;
      this.onGround = true;
      this.facingRight = true;
      this.walkFrame = 0;
      this.isWalking = false;
      this.walkAnimTimer = 0;
    }

    jump() {
      if (this.onGround) {
        this.vy = -CONFIG.player.jumpPower;
        this.onGround = false;
        return true;
      }
      return false;
    }

    walk(speed = CONFIG.player.walkSpeed) {
      this.vx = speed;
      this.isWalking = true;
      this.facingRight = speed > 0;
    }

    stopWalk() {
      this.isWalking = false;
    }

    update(dt) {
      // Apply gravity
      if (!this.onGround) {
        this.vy += CONFIG.player.gravity;
      }

      // Apply velocity
      this.x += this.vx;
      this.y += this.vy;

      // Friction
      this.vx *= 0.9;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;

      // Ground collision
      const groundY = CONFIG.player.groundY;
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
      }

      // Keep in bounds
      if (this.x < 50) this.x = 50;
      if (this.x > CONFIG.canvas.width - 100) this.x = CONFIG.canvas.width - 100;

      // Walk animation
      if (this.isWalking || Math.abs(this.vx) > 0.5) {
        this.walkAnimTimer += dt;
        if (this.walkAnimTimer > 0.1) {
          this.walkFrame = (this.walkFrame + 1) % 4;
          this.walkAnimTimer = 0;
        }
      } else {
        this.walkFrame = 0;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height);

      if (!this.facingRight) {
        ctx.scale(-1, 1);
      }

      const offsetX = -this.width / 2;
      const offsetY = -this.height;

      // Body (red)
      ctx.fillStyle = '#e52521';
      ctx.fillRect(offsetX + 5, offsetY + 20, 30, 25);

      // Head (skin color)
      ctx.fillStyle = '#ffd8b0';
      ctx.fillRect(offsetX + 8, offsetY + 5, 24, 18);

      // Hat (red)
      ctx.fillStyle = '#e52521';
      ctx.fillRect(offsetX + 5, offsetY, 30, 10);
      ctx.fillRect(offsetX + 25, offsetY + 5, 10, 8);

      // Hat brim
      ctx.fillStyle = '#e52521';
      ctx.fillRect(offsetX + 28, offsetY + 10, 8, 4);

      // Eye
      ctx.fillStyle = '#000';
      ctx.fillRect(offsetX + 22, offsetY + 10, 4, 4);

      // Mustache
      ctx.fillStyle = '#4a2c0a';
      ctx.fillRect(offsetX + 18, offsetY + 16, 12, 4);

      // Overalls (blue)
      ctx.fillStyle = '#0d47a1';
      ctx.fillRect(offsetX + 8, offsetY + 30, 24, 15);

      // Buttons
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(offsetX + 12, offsetY + 32, 4, 4);
      ctx.fillRect(offsetX + 24, offsetY + 32, 4, 4);

      // Legs with animation
      const legOffset = Math.sin(this.walkFrame * Math.PI / 2) * 3;
      ctx.fillStyle = '#0d47a1';
      ctx.fillRect(offsetX + 8, offsetY + 45 + legOffset, 10, 8);
      ctx.fillRect(offsetX + 22, offsetY + 45 - legOffset, 10, 8);

      // Shoes
      ctx.fillStyle = '#4a2c0a';
      ctx.fillRect(offsetX + 5, offsetY + 50 + legOffset, 14, 5);
      ctx.fillRect(offsetX + 21, offsetY + 50 - legOffset, 14, 5);

      ctx.restore();

      // Jump effect
      if (!this.onGround) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, CONFIG.player.groundY + this.height - 5,
          20 * (1 - Math.abs(this.vy) / 20), 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    getCenter() {
      return {
        x: this.x + this.width / 2,
        y: this.y + this.height / 2
      };
    }
  }

  // ============================================================================
  // FIREBALL
  // ============================================================================
  class Fireball {
    constructor(x, y, direction) {
      this.x = x;
      this.y = y;
      this.vx = CONFIG.fireball.speed * direction;
      this.vy = 0;
      this.radius = CONFIG.fireball.radius;
      this.rotation = 0;
      this.createdAt = Date.now();
      this.bounceCount = 0;
    }

    update() {
      this.x += this.vx;
      this.vy += 0.3;
      this.y += this.vy;

      // Bounce on ground
      if (this.y > CONFIG.player.groundY + 20) {
        this.y = CONFIG.player.groundY + 20;
        this.vy = -8;
        this.bounceCount++;
      }

      this.rotation += 0.3;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Outer glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 1.5);
      gradient.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Orange layer
      ctx.fillStyle = '#ff8c00';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-3, -2, 2, 0, Math.PI * 2);
      ctx.arc(3, -2, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    isExpired() {
      return Date.now() - this.createdAt > CONFIG.fireball.lifetime || this.bounceCount > 5;
    }

    isOffScreen() {
      return this.x < -50 || this.x > CONFIG.canvas.width + 50;
    }
  }

  // ============================================================================
  // ENEMY (Goomba-style)
  // ============================================================================
  class Enemy {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = CONFIG.enemy.width;
      this.height = CONFIG.enemy.height;
      this.vx = -CONFIG.enemy.speed;
      this.walkFrame = 0;
      this.walkTimer = 0;
      this.isDead = false;
      this.deathTimer = 0;
    }

    update(dt) {
      if (this.isDead) {
        this.deathTimer += dt;
        return;
      }

      this.x += this.vx;

      this.walkTimer += dt;
      if (this.walkTimer > 0.15) {
        this.walkFrame = (this.walkFrame + 1) % 2;
        this.walkTimer = 0;
      }
    }

    draw(ctx) {
      if (this.isDead) {
        // Squashed enemy
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(this.x, this.y + this.height - 10, this.width, 10);
        return;
      }

      // Body (brown mushroom shape)
      ctx.fillStyle = '#8b4513';
      ctx.beginPath();
      ctx.ellipse(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.width / 2,
        this.height / 2,
        0, 0, Math.PI * 2
      );
      ctx.fill();

      // Cap (darker brown top)
      ctx.fillStyle = '#5d3a1a';
      ctx.beginPath();
      ctx.ellipse(
        this.x + this.width / 2,
        this.y + 10,
        this.width / 2 + 3,
        12,
        0, Math.PI, Math.PI * 2
      );
      ctx.fill();

      // Eyes (angry)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(this.x + 10, this.y + 15, 6, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(this.x + 25, this.y + 15, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(this.x + 12, this.y + 16, 2, 0, Math.PI * 2);
      ctx.arc(this.x + 23, this.y + 16, 2, 0, Math.PI * 2);
      ctx.fill();

      // Eyebrows (angry)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x + 5, this.y + 10);
      ctx.lineTo(this.x + 15, this.y + 12);
      ctx.moveTo(this.x + 30, this.y + 10);
      ctx.lineTo(this.x + 20, this.y + 12);
      ctx.stroke();

      // Feet with animation
      const footOffset = this.walkFrame * 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(this.x + 3 + footOffset, this.y + this.height - 5, 10, 5);
      ctx.fillRect(this.x + 22 - footOffset, this.y + this.height - 5, 10, 5);
    }

    kill() {
      this.isDead = true;
    }

    shouldRemove() {
      return (this.isDead && this.deathTimer > 0.5) || this.x < -100;
    }

    collidesWith(obj) {
      if (this.isDead) return false;
      return this.x < obj.x + obj.width &&
             this.x + this.width > obj.x &&
             this.y < obj.y + obj.height &&
             this.y + this.height > obj.y;
    }

    collidesWithFireball(fireball) {
      if (this.isDead) return false;
      const dx = (this.x + this.width / 2) - fireball.x;
      const dy = (this.y + this.height / 2) - fireball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < (this.width / 2 + fireball.radius);
    }
  }

  // ============================================================================
  // CLOUD
  // ============================================================================
  class Cloud {
    constructor(x, y, size) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.speed = 0.3 + Math.random() * 0.3;
    }

    update() {
      this.x -= this.speed;
      if (this.x < -100) {
        this.x = CONFIG.canvas.width + 100;
        this.y = 30 + Math.random() * 100;
      }
    }

    draw(ctx) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
      ctx.arc(this.x + this.size * 0.5, this.y - this.size * 0.2, this.size * 0.5, 0, Math.PI * 2);
      ctx.arc(this.x + this.size, this.y, this.size * 0.6, 0, Math.PI * 2);
      ctx.arc(this.x + this.size * 0.5, this.y + this.size * 0.2, this.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ============================================================================
  // GAME CLASS
  // ============================================================================
  class Game {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');
      this.sound = new SoundSystem();
      this.particles = new ParticleSystem();

      this.player = new Player(100, CONFIG.player.groundY);
      this.fireballs = [];
      this.enemies = [];
      this.clouds = [];

      this.score = 0;
      this.distance = 0;
      this.enemiesDefeated = 0;
      this.lastEnemySpawn = 0;
      this.gameTime = 0;

      this.lastTime = performance.now();
      this.isRunning = true;

      this.initClouds();
      this.setupKeyboard();
      this.loop();

      console.log('[GAME] Fireball Mario initialized');
    }

    initClouds() {
      for (let i = 0; i < 5; i++) {
        this.clouds.push(new Cloud(
          Math.random() * CONFIG.canvas.width,
          30 + Math.random() * 100,
          30 + Math.random() * 30
        ));
      }
    }

    setupKeyboard() {
      document.addEventListener('keydown', (e) => {
        this.sound.init();

        if (e.code === 'Space' || e.code === 'ArrowUp') {
          e.preventDefault();
          this.triggerJump();
        }
        if (e.code === 'KeyX' || e.code === 'KeyZ') {
          this.triggerFireball();
        }
        if (e.code === 'ArrowRight') {
          this.triggerWalk();
        }
      });

      document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowRight') {
          this.player.stopWalk();
        }
      });
    }

    // === PUBLIC API FOR ORPHE CORE ===

    triggerWalk(speed = CONFIG.player.walkSpeed) {
      this.sound.init();
      this.player.walk(speed);
      this.sound.playStep();
      this.distance += 0.5;
      this.updateActionDisplay('WALK');
    }

    triggerJump() {
      this.sound.init();
      if (this.player.jump()) {
        this.sound.playJump();
        this.particles.emit(
          this.player.x + this.player.width / 2,
          this.player.y + this.player.height,
          8,
          ['#fff', '#ddd', '#bbb'],
          [1, 3]
        );
        this.updateActionDisplay('JUMP');
        return true;
      }
      return false;
    }

    triggerFireball() {
      this.sound.init();
      const center = this.player.getCenter();
      const direction = this.player.facingRight ? 1 : -1;

      this.fireballs.push(new Fireball(
        center.x + direction * 20,
        center.y,
        direction
      ));

      this.sound.playFireball();
      this.particles.emit(
        center.x + direction * 20,
        center.y,
        10,
        ['#ff0', '#f80', '#f00'],
        [2, 5]
      );
      this.updateActionDisplay('FIRE!');
    }

    updateActionDisplay(action) {
      const el = document.getElementById('action-display');
      if (el) {
        el.textContent = action;
        el.style.color = action === 'FIRE!' ? '#ff5722' :
                         action === 'JUMP' ? '#4caf50' : '#ffeb3b';
      }
    }

    // === GAME LOOP ===

    loop() {
      if (!this.isRunning) return;

      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.gameTime += dt;

      this.update(dt);
      this.render();

      requestAnimationFrame(() => this.loop());
    }

    update(dt) {
      // Update player
      this.player.update(dt);

      // Update fireballs
      this.fireballs = this.fireballs.filter(fb => {
        fb.update();
        return !fb.isExpired() && !fb.isOffScreen();
      });

      // Update enemies
      this.enemies.forEach(e => e.update(dt));
      this.enemies = this.enemies.filter(e => !e.shouldRemove());

      // Spawn enemies
      const currentTime = performance.now();
      if (currentTime - this.lastEnemySpawn > CONFIG.enemy.spawnInterval) {
        this.spawnEnemy();
        this.lastEnemySpawn = currentTime;
      }

      // Update clouds
      this.clouds.forEach(c => c.update());

      // Update particles
      this.particles.update(dt);

      // Check collisions
      this.checkCollisions();

      // Update UI
      this.updateUI();
    }

    spawnEnemy() {
      const x = CONFIG.canvas.width + 50;
      const y = CONFIG.player.groundY + CONFIG.player.height - CONFIG.enemy.height;
      this.enemies.push(new Enemy(x, y));
    }

    checkCollisions() {
      // Fireball vs Enemy
      this.fireballs.forEach(fb => {
        this.enemies.forEach(enemy => {
          if (enemy.collidesWithFireball(fb)) {
            enemy.kill();
            this.score += 100;
            this.enemiesDefeated++;
            this.sound.playHit();
            this.particles.emit(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2,
              15,
              ['#ff0', '#f80', '#fff'],
              [3, 8]
            );
          }
        });
      });
    }

    updateUI() {
      const scoreEl = document.getElementById('score-display');
      const distEl = document.getElementById('distance-display');
      const enemiesEl = document.getElementById('enemies-display');

      if (scoreEl) scoreEl.textContent = this.score;
      if (distEl) distEl.textContent = Math.floor(this.distance) + 'm';
      if (enemiesEl) enemiesEl.textContent = this.enemiesDefeated;
    }

    render() {
      const ctx = this.ctx;

      // Clear and draw sky
      ctx.fillStyle = '#5c94fc';
      ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

      // Draw clouds
      this.clouds.forEach(c => c.draw(ctx));

      // Draw hills in background
      this.drawHills(ctx);

      // Draw ground
      this.drawGround(ctx);

      // Draw enemies
      this.enemies.forEach(e => e.draw(ctx));

      // Draw player
      this.player.draw(ctx);

      // Draw fireballs
      this.fireballs.forEach(fb => fb.draw(ctx));

      // Draw particles
      this.particles.draw(ctx);
    }

    drawHills(ctx) {
      // Far hills
      ctx.fillStyle = '#3d8b40';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(
          150 + i * 350,
          CONFIG.canvas.height - CONFIG.world.groundHeight + 20,
          120,
          60,
          0, Math.PI, 0
        );
        ctx.fill();
      }

      // Near hills
      ctx.fillStyle = '#4caf50';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(
          50 + i * 280,
          CONFIG.canvas.height - CONFIG.world.groundHeight + 10,
          80,
          40,
          0, Math.PI, 0
        );
        ctx.fill();
      }
    }

    drawGround(ctx) {
      const groundY = CONFIG.canvas.height - CONFIG.world.groundHeight;

      // Grass layer
      ctx.fillStyle = '#228b22';
      ctx.fillRect(0, groundY, CONFIG.canvas.width, 20);

      // Dirt layer
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(0, groundY + 20, CONFIG.canvas.width, CONFIG.world.groundHeight - 20);

      // Brick pattern
      ctx.fillStyle = '#a0522d';
      for (let y = groundY + 25; y < CONFIG.canvas.height; y += 25) {
        const offset = ((y - groundY) / 25) % 2 === 0 ? 0 : 25;
        for (let x = offset; x < CONFIG.canvas.width; x += 50) {
          ctx.fillRect(x + 1, y + 1, 48, 23);
        }
      }
    }
  }

  // ============================================================================
  // GLOBAL INIT
  // ============================================================================
  let game;

  window.addEventListener('DOMContentLoaded', () => {
    game = new Game('gameCanvas');
    window.game = game;
    console.log('[GAME] Ready. Use window.game to access game instance.');
  });

})();
