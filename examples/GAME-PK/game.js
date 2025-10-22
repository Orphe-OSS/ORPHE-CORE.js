/**
 * GAME-PK: Professional Penalty Kick Game
 * Enhanced graphics, animations, and sound effects
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION - 3D PERSPECTIVE VIEW
  // ============================================================================
  const CFG = {
    width: 1200,
    height: 800,
    
    // 3D Perspective settings
    perspective: {
      vanishingPointY: 150,  // Horizon line (where field converges)
      fieldDepth: 0.4,       // How much field narrows (0-1)
      scale: 0.3             // Size scale for objects in distance
    },
    
    // Field (3D trapezoid)
    field: {
      grassColor1: '#2d8f4a',
      grassColor2: '#228841',
      lineColor: '#ffffff',
      lineWidth: 3,
      // Near edge (bottom of screen)
      nearLeft: 100,
      nearRight: 1100,
      nearY: 750,
      // Far edge (top, at goal)
      farLeft: 400,
      farRight: 800,
      farY: 200
    },
    
    // Goal (3D with depth)
    goal: {
      leftX: 380,
      rightX: 820,
      topY: 120,
      bottomY: 200,
      postWidth: 8,
      depth: 60,  // Goal depth (3D effect)
      netColor: '#e0e0e0'
    },
    
    // Ball (3D with shadow)
    ball: {
      radius: 18,
      startX: 600,
      startY: 650,
      startZ: 0,  // Height above ground
      speed: 1000,
      gravity: 1400,
      spinSpeed: 12,
      maxFlightTime: 3.0
    },
    
    // Goalkeeper (3D sprite)
    keeper: {
      x: 600,
      y: 160,
      z: 0,
      scale: 0.45,  // Smaller because in distance
      width: 60,
      height: 100,
      armReach: 180,
      diveSpeed: 700,
      reactionTime: 180,
      predictionNoise: 100
    },
    
    // Player (kicking)
    player: {
      x: 600,
      y: 680,
      scale: 1.2,  // Larger because closer
      width: 70,
      height: 110
    },
    
    // Stadium
    stadium: {
      crowdColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd'],
      standHeight: 120
    },
    
    // Game
    game: {
      totalShots: 5,
      aimPowerScale: 350
    }
  };

  // ============================================================================
  // SOUND SYSTEM
  // ============================================================================
  class SoundSystem {
    constructor() {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playKick() {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    }

    playGoal() {
      // Celebration sound
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.value = 440 * (1 + i * 0.5);
          
          gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
          
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.start();
          osc.stop(this.ctx.currentTime + 0.3);
        }, i * 100);
      }
    }

    playSave() {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    }

    playMiss() {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = 150;
      
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    }

    playWhistle() {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = 800;
      
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    }
  }

  // ============================================================================
  // PARTICLE SYSTEM
  // ============================================================================
  class Particle {
    constructor(x, y, vx, vy, color, life) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.life = life;
      this.maxLife = life;
      this.size = Math.random() * 4 + 2;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 500 * dt; // gravity
      this.life -= dt;
    }

    draw(ctx) {
      const alpha = this.life / this.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
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

    emit(x, y, count, color) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 100 + Math.random() * 200;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.particles.push(new Particle(x, y, vx, vy, color, 0.8 + Math.random() * 0.4));
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
  // GAME STATE
  // ============================================================================
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.sound = new SoundSystem();
      this.particles = new ParticleSystem();
      
      this.resize();
      window.addEventListener('resize', () => this.resize());
      
      this.reset();
      this.setupInput();
      this.loop();
      
      console.log('[GAME-PK] Initialized successfully');
    }

    resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const maxWidth = window.innerWidth - 40;
      const maxHeight = window.innerHeight - 140;
      const scale = Math.min(maxWidth / CFG.width, maxHeight / CFG.height, 1);
      
      this.canvas.width = CFG.width * dpr * scale;
      this.canvas.height = CFG.height * dpr * scale;
      this.canvas.style.width = CFG.width * scale + 'px';
      this.canvas.style.height = CFG.height * scale + 'px';
      
      this.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    }

    reset() {
      this.state = {
        phase: 'aim', // aim, flight, result, gameover
        shotsRemaining: CFG.game.totalShots,
        shotsTaken: 0,
        goalsScored: 0,
        
        ball: {
          x: CFG.ball.startX,
          y: CFG.ball.startY,
          z: CFG.ball.startZ,
          vx: 0,
          vy: 0,
          vz: 0,
          rotation: 0,
          flying: false,
          flightTime: 0
        },
        
        keeper: {
          x: CFG.keeper.x,
          y: CFG.keeper.y,
          targetX: CFG.keeper.x,
          moving: false,
          armAngle: 0,
          celebrating: false
        },
        
        aim: {
          active: false,
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0
        },
        
        result: null // 'goal', 'save', 'miss'
      };
      
      this.updateHUD();
      console.log('[GAME-PK] Game reset');
    }

    setupInput() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CFG.width / rect.width;
        const scaleY = CFG.height / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        const pos = getPos(e);
        if (this.state.phase === 'aim') {
          this.state.aim.active = true;
          this.state.aim.startX = CFG.ball.startX;
          this.state.aim.startY = CFG.ball.startY;
          this.state.aim.endX = pos.x;
          this.state.aim.endY = pos.y;
        } else if (this.state.phase === 'result') {
          this.nextShot();
        } else if (this.state.phase === 'gameover') {
          this.reset();
        }
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (this.state.aim.active) {
          const pos = getPos(e);
          this.state.aim.endX = pos.x;
          this.state.aim.endY = pos.y;
        }
      });

      this.canvas.addEventListener('pointerup', () => {
        if (this.state.aim.active && this.state.phase === 'aim') {
          this.shoot();
        }
        this.state.aim.active = false;
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === ' ' && this.state.phase === 'result') {
          this.nextShot();
        }
        if (e.key === 'r' || e.key === 'R') {
          this.reset();
        }
      });
    }

    shoot() {
      const dx = this.state.aim.endX - this.state.aim.startX;
      const dy = this.state.aim.endY - this.state.aim.startY;
      const distance = Math.hypot(dx, dy);
      const power = Math.min(1, distance / CFG.game.aimPowerScale);
      
      const angle = Math.atan2(dy, dx);
      const speed = CFG.ball.speed * (0.4 + 0.6 * power);
      
      this.state.ball.vx = Math.cos(angle) * speed;
      this.state.ball.vy = Math.sin(angle) * speed;
      this.state.ball.flying = true;
      this.state.phase = 'flight';
      this.state.shotsTaken++;
      
      // Goalkeeper prediction
      const predictedX = CFG.ball.startX + dx * 0.6 + (Math.random() - 0.5) * CFG.keeper.predictionNoise;
      this.state.keeper.targetX = Math.max(CFG.goal.leftX + 50, Math.min(CFG.goal.rightX - 50, predictedX));
      
      setTimeout(() => {
        this.state.keeper.moving = true;
      }, CFG.keeper.reactionTime);
      
      this.sound.playKick();
      this.particles.emit(CFG.ball.startX, CFG.ball.startY, 15, '#ffffff');
      
      console.log(`[GAME-PK] Shot fired: power=${(power*100).toFixed(0)}%, angle=${(angle*180/Math.PI).toFixed(0)}°`);
    }

    update(dt) {
      // Update particles
      this.particles.update(dt);
      
      // Update goalkeeper
      if (this.state.keeper.moving) {
        const dir = Math.sign(this.state.keeper.targetX - this.state.keeper.x);
        this.state.keeper.x += dir * CFG.keeper.diveSpeed * dt;
        this.state.keeper.armAngle = dir * Math.PI / 4;
        
        if ((dir > 0 && this.state.keeper.x >= this.state.keeper.targetX) ||
            (dir < 0 && this.state.keeper.x <= this.state.keeper.targetX)) {
          this.state.keeper.x = this.state.keeper.targetX;
          this.state.keeper.moving = false;
        }
      }
      
      // Update ball (3D physics)
      if (this.state.ball.flying) {
        this.state.ball.vz -= CFG.ball.gravity * dt;  // Gravity on Z
        this.state.ball.x += this.state.ball.vx * dt;
        this.state.ball.y += this.state.ball.vy * dt;
        this.state.ball.z += this.state.ball.vz * dt;
        this.state.ball.rotation += CFG.ball.spinSpeed * dt;
        this.state.ball.flightTime += dt;
        
        // Ball hit ground before reaching goal
        if (this.state.ball.z < 0 && this.state.ball.y > CFG.goal.bottomY) {
          this.state.ball.z = 0;
          this.state.ball.vz = 0;
          this.state.result = 'miss';
          this.state.ball.flying = false;
          this.sound.playMiss();
          this.state.shotsRemaining--;
          this.state.phase = 'result';
          this.updateHUD();
          console.log('[GAME-PK] Ball hit ground - miss');
          
          setTimeout(() => {
            if (this.state.shotsRemaining <= 0) {
              this.gameOver();
            }
          }, 2000);
          return;
        }
        
        // Check if ball reached goal line
        if (this.state.ball.y <= CFG.goal.bottomY) {
          this.checkResult();
        }
        
        // Check if ball went out of bounds
        const outOfBoundsX = this.state.ball.x < CFG.field.farLeft - 100 || this.state.ball.x > CFG.field.farRight + 100;
        const outOfBoundsY = this.state.ball.y > CFG.height;
        const timeout = this.state.ball.flightTime >= CFG.ball.maxFlightTime;
        
        if (outOfBoundsX || outOfBoundsY || timeout) {
          if (timeout) {
            console.log('[GAME-PK] Ball timeout - auto miss');
          } else if (outOfBoundsX) {
            console.log('[GAME-PK] Ball went out of bounds (sideways) - auto miss');
          } else {
            console.log('[GAME-PK] Ball went out of bounds (backwards) - auto miss');
          }
          
          this.state.result = 'miss';
          this.state.ball.flying = false;
          this.sound.playMiss();
          this.state.shotsRemaining--;
          this.state.phase = 'result';
          this.updateHUD();
          
          setTimeout(() => {
            if (this.state.shotsRemaining <= 0) {
              this.gameOver();
            }
          }, 2000);
        }
      }
    }

    checkResult() {
      this.state.ball.flying = false;
      const ballX = this.state.ball.x;
      const ballZ = this.state.ball.z;
      
      // Check if in goal (3D: X position and Z height)
      const goalHeight = CFG.goal.bottomY - CFG.goal.topY;
      const inGoalX = ballX >= CFG.goal.leftX && ballX <= CFG.goal.rightX;
      const inGoalZ = ballZ >= 0 && ballZ <= goalHeight;
      
      if (inGoalX && inGoalZ) {
        // Check if keeper saved
        const keeperDist = Math.abs(ballX - this.state.keeper.x);
        const keeperHeight = ballZ / goalHeight;
        
        if (keeperDist < CFG.keeper.armReach && keeperHeight < 0.7) {
          this.state.result = 'save';
          this.sound.playSave();
          this.state.keeper.celebrating = true;
          console.log('[GAME-PK] SAVE! Keeper distance:', keeperDist.toFixed(0), 'Height:', (keeperHeight*100).toFixed(0) + '%');
        } else {
          this.state.result = 'goal';
          this.state.goalsScored++;
          this.sound.playGoal();
          this.particles.emit(ballX, CFG.goal.bottomY - ballZ, 40, '#ffd700');
          console.log('[GAME-PK] GOAL! Keeper distance:', keeperDist.toFixed(0));
        }
      } else {
        this.state.result = 'miss';
        this.sound.playMiss();
        console.log('[GAME-PK] MISS! Ball position: X:', ballX.toFixed(0), 'Z:', ballZ.toFixed(0));
      }
      
      this.state.shotsRemaining--;
      this.state.phase = 'result';
      this.updateHUD();
      
      setTimeout(() => {
        if (this.state.shotsRemaining <= 0) {
          this.gameOver();
        }
      }, 2000);
    }

    nextShot() {
      if (this.state.shotsRemaining <= 0) return;
      
      this.state.phase = 'aim';
      this.state.ball.x = CFG.ball.startX;
      this.state.ball.y = CFG.ball.startY;
      this.state.ball.z = 0;
      this.state.ball.vx = 0;
      this.state.ball.vy = 0;
      this.state.ball.vz = 0;
      this.state.ball.rotation = 0;
      this.state.ball.flightTime = 0;
      this.state.keeper.x = CFG.keeper.x;
      this.state.keeper.targetX = CFG.keeper.x;
      this.state.keeper.moving = false;
      this.state.keeper.armAngle = 0;
      this.state.keeper.celebrating = false;
      this.state.result = null;
      
      document.getElementById('msg').textContent = 'ドラッグして狙い、離してキック！';
    }

    gameOver() {
      this.state.phase = 'gameover';
      this.sound.playWhistle();
      const accuracy = (this.state.goalsScored / CFG.game.totalShots * 100).toFixed(0);
      document.getElementById('msg').textContent = `試合終了！${this.state.goalsScored}/${CFG.game.totalShots} ゴール (${accuracy}%) - Rキーで再開`;
      console.log(`[GAME-PK] Game over: ${this.state.goalsScored}/${CFG.game.totalShots} goals`);
    }

    updateHUD() {
      document.getElementById('shots').textContent = this.state.shotsRemaining;
      document.getElementById('score').textContent = this.state.goalsScored;
      const accuracy = this.state.shotsTaken > 0 
        ? (this.state.goalsScored / this.state.shotsTaken * 100).toFixed(0)
        : 0;
      document.getElementById('accuracy').textContent = accuracy + '%';
      
      if (this.state.result) {
        const messages = {
          'goal': '🎉 ゴール！素晴らしい！',
          'save': '😮 セーブされた！',
          'miss': '😢 枠外！次は狙いを定めよう'
        };
        document.getElementById('msg').textContent = messages[this.state.result];
      }
    }

    draw() {
      const ctx = this.ctx;
      
      // Clear
      ctx.fillStyle = '#0a4428';
      ctx.fillRect(0, 0, CFG.width, CFG.height);
      
      // Draw field
      this.drawField();
      
      // Draw goal
      this.drawGoal();
      
      // Draw goalkeeper
      this.drawKeeper();
      
      // Draw ball
      this.drawBall();
      
      // Draw aim indicator
      if (this.state.phase === 'aim' && this.state.aim.active) {
        this.drawAimIndicator();
      }
      
      // Draw particles
      this.particles.draw(ctx);
      
      // Draw result overlay
      if (this.state.phase === 'result' || this.state.phase === 'gameover') {
        this.drawResultOverlay();
      }
    }

    drawField() {
      const ctx = this.ctx;
      
      // Grass stripes
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 === 0 ? CFG.field.grassColor1 : CFG.field.grassColor2;
        ctx.fillRect(0, i * (CFG.height / 10), CFG.width, CFG.height / 10);
      }
      
      // Penalty box
      ctx.strokeStyle = CFG.field.lineColor;
      ctx.lineWidth = CFG.field.lineWidth;
      ctx.strokeRect(300, 400, 600, 250);
      
      // Penalty spot
      ctx.fillStyle = CFG.field.lineColor;
      ctx.beginPath();
      ctx.arc(CFG.ball.startX, CFG.ball.startY, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    drawGoal() {
      const ctx = this.ctx;
      const g = CFG.goal;
      
      // Goal net pattern
      ctx.strokeStyle = g.netColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      
      const gridSize = 20;
      for (let x = g.leftX; x <= g.rightX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, g.topY);
        ctx.lineTo(x, g.topY + g.height);
        ctx.stroke();
      }
      for (let y = g.topY; y <= g.topY + g.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(g.leftX, y);
        ctx.lineTo(g.rightX, y);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
      
      // Goal posts
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(g.leftX - g.postWidth, g.topY, g.postWidth, g.height);
      ctx.fillRect(g.rightX, g.topY, g.postWidth, g.height);
      ctx.fillRect(g.leftX, g.topY - g.postWidth, g.rightX - g.leftX, g.postWidth);
    }

    drawKeeper() {
      const ctx = this.ctx;
      const k = this.state.keeper;
      
      ctx.save();
      ctx.translate(k.x, k.y);
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, CFG.keeper.height + 5, 35, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs
      ctx.fillStyle = '#2a5da8';
      ctx.fillRect(-18, 70, 15, 30); // Left leg
      ctx.fillRect(3, 70, 15, 30);   // Right leg
      
      // Shoes
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-20, 95, 18, 8);
      ctx.fillRect(3, 95, 18, 8);
      
      // Body (jersey) - with shading
      const jerseyGradient = ctx.createLinearGradient(-30, 0, 30, 0);
      jerseyGradient.addColorStop(0, '#d45500');
      jerseyGradient.addColorStop(0.5, '#ff6b00');
      jerseyGradient.addColorStop(1, '#d45500');
      ctx.fillStyle = jerseyGradient;
      ctx.fillRect(-CFG.keeper.width / 2, 20, CFG.keeper.width, 50);
      
      // Jersey details (stripes)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10, 20, 3, 50);
      ctx.fillRect(7, 20, 3, 50);
      
      // Jersey number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1', 0, 45);
      
      // Neck
      ctx.fillStyle = '#ffdbac';
      ctx.fillRect(-8, 15, 16, 10);
      
      // Head - with more detail
      const headGradient = ctx.createRadialGradient(-5, -15, 0, 0, -10, 25);
      headGradient.addColorStop(0, '#ffecd2');
      headGradient.addColorStop(1, '#ffdbac');
      ctx.fillStyle = headGradient;
      ctx.beginPath();
      ctx.arc(0, -10, 22, 0, Math.PI * 2);
      ctx.fill();
      
      // Hair
      ctx.fillStyle = '#3a2618';
      ctx.beginPath();
      ctx.arc(-8, -20, 12, 0, Math.PI);
      ctx.arc(8, -20, 12, 0, Math.PI);
      ctx.arc(0, -25, 15, 0, Math.PI);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, -12, 8, 6);
      ctx.fillRect(4, -12, 8, 6);
      ctx.fillStyle = '#000000';
      ctx.fillRect(-10, -11, 4, 4);
      ctx.fillRect(6, -11, 4, 4);
      
      // Mouth
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (k.celebrating) {
        ctx.arc(0, 0, 8, 0, Math.PI); // Smile
      } else {
        ctx.arc(0, 0, 6, Math.PI, Math.PI * 2); // Focused
      }
      ctx.stroke();
      
      // Arms with proper joints
      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Left arm
      ctx.save();
      ctx.rotate(-k.armAngle);
      ctx.beginPath();
      ctx.moveTo(-CFG.keeper.width / 2, 30);
      const leftArmMidX = -CFG.keeper.width / 2 - 25;
      const leftArmMidY = 35;
      ctx.lineTo(leftArmMidX, leftArmMidY);
      ctx.lineTo(-CFG.keeper.width / 2 - 45, 45);
      ctx.stroke();
      
      // Left glove - detailed
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(-CFG.keeper.width / 2 - 45, 45, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd600';
      ctx.beginPath();
      ctx.arc(-CFG.keeper.width / 2 - 45, 45, 10, 0, Math.PI * 2);
      ctx.fill();
      // Glove fingers
      ctx.fillStyle = '#ffeb3b';
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(-CFG.keeper.width / 2 - 45 + i * 6, 32, 4, 8);
      }
      ctx.restore();
      
      // Right arm
      ctx.save();
      ctx.rotate(k.armAngle);
      ctx.beginPath();
      ctx.moveTo(CFG.keeper.width / 2, 30);
      const rightArmMidX = CFG.keeper.width / 2 + 25;
      const rightArmMidY = 35;
      ctx.lineTo(rightArmMidX, rightArmMidY);
      ctx.lineTo(CFG.keeper.width / 2 + 45, 45);
      ctx.stroke();
      
      // Right glove - detailed
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(CFG.keeper.width / 2 + 45, 45, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd600';
      ctx.beginPath();
      ctx.arc(CFG.keeper.width / 2 + 45, 45, 10, 0, Math.PI * 2);
      ctx.fill();
      // Glove fingers
      ctx.fillStyle = '#ffeb3b';
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(CFG.keeper.width / 2 + 45 + i * 6, 32, 4, 8);
      }
      ctx.restore();
      
      ctx.restore();
      
      // Celebration effects
      if (k.celebrating) {
        ctx.save();
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        // Sparkle effect
        const sparkles = ['✨', '⭐', '💪'];
        ctx.fillStyle = '#ffd700';
        ctx.fillText(sparkles[Math.floor(Date.now() / 200) % sparkles.length], k.x - 50, k.y - 50);
        ctx.fillText(sparkles[(Math.floor(Date.now() / 200) + 1) % sparkles.length], k.x + 50, k.y - 50);
        ctx.restore();
      }
    }

    drawBall() {
      const ctx = this.ctx;
      const b = this.state.ball;
      
      // Shadow when flying
      if (b.flying && b.y < CFG.ball.startY) {
        const shadowY = CFG.ball.startY;
        const shadowSize = Math.max(5, 20 * (1 - (b.y / shadowY)));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(b.x, shadowY + 10, shadowSize, shadowSize * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotation);
      
      // Ball base with gradient
      const gradient = ctx.createRadialGradient(-6, -6, 0, 0, 0, CFG.ball.radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.6, '#f5f5f5');
      gradient.addColorStop(0.85, '#e0e0e0');
      gradient.addColorStop(1, '#c0c0c0');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, CFG.ball.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Classic soccer ball pattern - pentagons and hexagons
      ctx.fillStyle = '#000000';
      
      // Center pentagon
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const x = Math.cos(angle) * 6;
        const y = Math.sin(angle) * 6;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      
      // Surrounding pentagons
      for (let i = 0; i < 5; i++) {
        const mainAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.save();
        ctx.rotate(mainAngle);
        ctx.translate(0, -11);
        
        // Small pentagon
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const angle = (Math.PI * 2 * j) / 5;
          const x = Math.cos(angle) * 4;
          const y = Math.sin(angle) * 4;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      
      // Hexagon connectors (white lines between pentagons)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(0, -11);
        ctx.stroke();
        ctx.restore();
      }
      
      // Shine highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(-5, -5, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(-3, -7, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Motion blur trail when flying fast
      if (b.flying) {
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 500) {
          const angle = Math.atan2(b.vy, b.vx);
          ctx.rotate(-b.rotation); // Un-rotate for trail
          ctx.rotate(angle);
          
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = '#ffffff';
          for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.ellipse(-i * 8, 0, 10, 6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
      
      ctx.restore();
    }

    drawAimIndicator() {
      const ctx = this.ctx;
      const a = this.state.aim;
      
      const dx = a.endX - a.startX;
      const dy = a.endY - a.startY;
      const distance = Math.hypot(dx, dy);
      const power = Math.min(1, distance / CFG.game.aimPowerScale);
      
      // Arrow
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + power * 0.5})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      
      ctx.beginPath();
      ctx.moveTo(a.startX, a.startY);
      ctx.lineTo(a.endX, a.endY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Power indicator
      ctx.fillStyle = power > 0.8 ? '#ff4444' : power > 0.5 ? '#ffaa00' : '#44ff44';
      ctx.fillRect(a.endX - 30, a.endY - 50, 60 * power, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(a.endX - 30, a.endY - 50, 60, 10);
      
      // Power text
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${(power * 100).toFixed(0)}%`, a.endX, a.endY - 60);
    }

    drawResultOverlay() {
      const ctx = this.ctx;
      
      if (this.state.phase === 'result') {
        const messages = {
          'goal': { text: 'GOAL!', color: '#4ade80' },
          'save': { text: 'SAVED!', color: '#fb923c' },
          'miss': { text: 'MISS!', color: '#ef4444' }
        };
        
        const msg = messages[this.state.result];
        if (msg) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, CFG.height / 2 - 80, CFG.width, 160);
          
          ctx.font = 'bold 80px Arial Black';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 8;
          ctx.strokeText(msg.text, CFG.width / 2, CFG.height / 2);
          ctx.fillStyle = msg.color;
          ctx.fillText(msg.text, CFG.width / 2, CFG.height / 2);
        }
      } else if (this.state.phase === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CFG.width, CFG.height);
        
        ctx.font = 'bold 60px Arial Black';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('GAME OVER', CFG.width / 2, CFG.height / 2 - 80);
        
        ctx.font = 'bold 40px Arial';
        ctx.fillText(`${this.state.goalsScored} / ${CFG.game.totalShots} ゴール`, CFG.width / 2, CFG.height / 2);
        
        const accuracy = (this.state.goalsScored / CFG.game.totalShots * 100).toFixed(0);
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`成功率: ${accuracy}%`, CFG.width / 2, CFG.height / 2 + 60);
        
        ctx.font = '20px Arial';
        ctx.fillStyle = '#cccccc';
        ctx.fillText('Rキーで再開', CFG.width / 2, CFG.height / 2 + 120);
      }
    }

    loop(timestamp = 0) {
      if (!this.lastTime) this.lastTime = timestamp;
      const dt = Math.min(0.033, (timestamp - this.lastTime) / 1000);
      this.lastTime = timestamp;
      
      this.update(dt);
      this.draw();
      
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game');
    if (!canvas) {
      console.error('[GAME-PK] Canvas element not found!');
      return;
    }
    
    window.game = new Game(canvas);
    console.log('[GAME-PK] Game started');
  });

})();
