/**
 * GAME-PK: 3D Professional Penalty Kick Game
 * 3D perspective view like mobile penalty games
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION - 3D PERSPECTIVE
  // ============================================================================
  const CFG = {
    width: 1200,
    height: 800,
    
    // 3D Perspective field (trapezoid)
    field: {
      grassColor1: '#2d8f4a',
      grassColor2: '#228841',
      grassDark: '#1a6632',
      lineColor: '#ffffff',
      // Near edge (bottom, close to camera)
      nearLeft: 50,
      nearRight: 1150,
      nearY: 780,
      // Far edge (top, at goal)
      farLeft: 350,
      farRight: 850,
      farY: 180
    },
    
    // Goal (3D) - Standard soccer goal is 7.32m x 2.44m
    goal: {
      width: 500,        // Horizontal width (left-right)
      height: 160,       // Vertical height (ground-up)
      depth: 120,        // Depth into screen (3D)
      postSize: 12,      // Post diameter
      x: 600,            // center
      y: 140,            // top of goal frame
      groundY: 300,      // bottom of goal (on ground)
      goalLineY: 160,    // Y position of goal line in 3D space
      netColor: '#ffffff',
      postColor: '#ffffff',
      shadowColor: 'rgba(0, 0, 0, 0.4)'
    },
    
    // Ball (3D with height)
    ball: {
      radius: 16,
      startX: 600,
      startY: 680,
      speed: 1100,       // Faster for more excitement
      gravity: 1500,     // Slightly more gravity for speed
      maxFlightTime: 4.0,
      minPower: 0.3,     // Minimum power threshold
      speedMultiplier: 1.25  // Overall speed boost
    },
    
    // Goalkeeper (small, in distance)
    keeper: {
      x: 600,
      y: 240,
      scale: 0.5,
      width: 70,
      height: 110,
      armReach: 85,      // Further reduced (was 110)
      jumpReach: 75,     // Lower jump (was 95)
      diveSpeed: 350,    // Even slower (was 450)
      reactionTime: 450, // Much slower reaction (was 350)
      predictionError: 180,  // More error (was 120)
      commitThreshold: 0.2,  // Commits earlier (was 0.3)
      wrongDirectionChance: 0.18  // 18% chance to dive wrong way (was 10%)
    },
    
    // Player (large, in foreground)
    player: {
      x: 600,
      y: 700,
      scale: 1.3,
      width: 80,
      height: 120
    },
    
    // Stadium
    stadium: {
      skyColor: '#87CEEB',
      standColor: '#8B4513',
      crowdColors: ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCF7F', '#B983FF'],
      flagColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00']
    },
    
    game: {
      totalShots: 5,
      aimPowerScale: 400
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
      const now = this.ctx.currentTime;
      
      // Impact bass (kick sound)
      const bass = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(120, now);
      bass.frequency.exponentialRampToValueAtTime(50, now + 0.08);
      bassGain.gain.setValueAtTime(0.5, now);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      bass.connect(bassGain);
      bassGain.connect(this.ctx.destination);
      bass.start(now);
      bass.stop(now + 0.12);
      
      // Noise (whoosh/impact)
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 800;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      
      // High frequency snap
      const snap = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snap.type = 'square';
      snap.frequency.value = 300;
      snapGain.gain.setValueAtTime(0.2, now);
      snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      snap.connect(snapGain);
      snapGain.connect(this.ctx.destination);
      snap.start(now);
      snap.stop(now + 0.05);
    }

    playGoal() {
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
      this.size = Math.random() * 5 + 2;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 600 * dt;
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
        const speed = 100 + Math.random() * 250;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 100;
        this.particles.push(new Particle(x, y, vx, vy, color, 0.8 + Math.random() * 0.5));
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
      
      console.log('[GAME-PK 3D] Initialized successfully');
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
        phase: 'aim',
        shotsRemaining: CFG.game.totalShots,
        shotsTaken: 0,
        goalsScored: 0,
        
        ball: {
          x: CFG.ball.startX,
          y: CFG.ball.startY,
          z: 0,  // Height above ground
          vx: 0,
          vy: 0,
          vz: 0,
          rotation: 0,
          flying: false,
          flightTime: 0,
          visible: true  // Show ball on ground initially
        },
        
        keeper: {
          x: CFG.keeper.x,
          startX: CFG.keeper.x,
          targetX: CFG.keeper.x,
          moving: false,
          committed: false,  // Has keeper committed to dive direction?
          armAngle: 0,
          celebrating: false
        },
        
        player: {
          kickFrame: 0,
          kicking: false,
          kickPhase: 'idle' // idle, windup, strike, follow
        },
        
        aim: {
          active: false,
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0
        },
        
        result: null
      };
      
      this.updateHUD();
      console.log('[GAME-PK 3D] Game reset');
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
          this.state.aim.startX = pos.x;
          this.state.aim.startY = pos.y;
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
      const power = Math.min(1, Math.max(CFG.ball.minPower, distance / CFG.game.aimPowerScale));
      
      this.executeShoot(dx, dy, power);
    }

    // Sensor-based shooting (called from index_orphe.html)
    shootFromSensor(dx, dy, power) {
      console.log('[GAME-PK 3D] Sensor shoot:', { dx, dy, power });
      this.executeShoot(dx, dy, power);
    }

    executeShoot(dx, dy, power) {
      // Start kick animation
      this.state.player.kicking = true;
      this.state.player.kickFrame = 0;
      this.state.player.kickPhase = 'windup';
      
      // Ball stays visible until contact
      this.state.ball.visible = true;
      
      // === Improved physics calculation with speed boost ===
      const targetX = CFG.ball.startX + dx * 1.2;  // Amplify horizontal input
      const targetY = CFG.goal.goalLineY;  // Aim for goal line
      
      // Distance to goal
      const distY = CFG.ball.startY - targetY;
      const distX = targetX - CFG.ball.startX;
      
      // Flight time based on power (stronger = faster)
      const baseTime = Math.sqrt(2 * distY / CFG.ball.gravity);
      const speedFactor = CFG.ball.speedMultiplier * (0.65 + power * 0.5);  // Faster overall
      const timeToGoal = baseTime / speedFactor;
      
      // Calculate velocities
      const vx = distX / timeToGoal;
      const vy = -distY / timeToGoal;
      
      // Initial upward velocity (arc height based on power)
      // More power = higher arc
      const vz = CFG.ball.gravity * timeToGoal * (0.45 + power * 0.15);
      
      // Store velocity for when ball is kicked
      this.pendingKick = { vx, vy, vz };
      
      // === Goalkeeper prediction with realistic errors ===
      // Keeper makes mistakes:
      // 1. Random prediction error
      // 2. Worse at predicting powerful shots
      // 3. Worse at predicting corner shots
      const baseError = CFG.keeper.predictionError;
      const powerError = power * 80;  // More powerful = harder to predict (was 60)
      const distanceFromCenter = Math.abs(targetX - CFG.goal.x);
      const cornerError = (distanceFromCenter / (CFG.goal.width / 2)) * 70;  // Corner shots harder (was 50)
      
      const totalError = baseError + powerError + cornerError;
      const predictionOffset = (Math.random() - 0.5) * totalError;
      
      // Sometimes keeper goes completely wrong direction (18% chance, was 10%)
      const wrongDirection = Math.random() < CFG.keeper.wrongDirectionChance;
      const predictedX = wrongDirection 
        ? CFG.goal.x - (targetX - CFG.goal.x)  // Opposite side!
        : targetX + predictionOffset;
      
      const goalLeft = CFG.goal.x - CFG.goal.width / 2 + 60;
      const goalRight = CFG.goal.x + CFG.goal.width / 2 - 60;
      this.state.keeper.targetX = Math.max(goalLeft, Math.min(goalRight, predictedX));
      this.state.keeper.startX = this.state.keeper.x;  // Remember starting position
      this.state.keeper.committed = false;  // Not yet committed to direction
      
      setTimeout(() => {
        this.state.keeper.moving = true;
      }, CFG.keeper.reactionTime);
      
      console.log(`[GAME-PK 3D] Kick: power=${(power*100).toFixed(0)}%, target=${targetX.toFixed(0)}, keeper→${predictedX.toFixed(0)}, time=${timeToGoal.toFixed(2)}s${wrongDirection ? ' (WRONG WAY!)' : ''}`);
    }

    update(dt) {
      this.particles.update(dt);
      
      // Update player kick animation (multi-phase)
      if (this.state.player.kicking) {
        this.state.player.kickFrame += dt;
        
        if (this.state.player.kickFrame < 0.2) {
          // Wind-up phase
          this.state.player.kickPhase = 'windup';
        } else if (this.state.player.kickFrame < 0.35) {
          // Strike phase (fast)
          this.state.player.kickPhase = 'strike';
          
          // MOMENT OF CONTACT! Launch ball at start of strike
          if (this.state.player.kickFrame >= 0.2 && this.state.player.kickFrame < 0.2 + dt && this.pendingKick) {
            this.state.ball.vx = this.pendingKick.vx;
            this.state.ball.vy = this.pendingKick.vy;
            this.state.ball.vz = this.pendingKick.vz;
            this.state.ball.flying = true;
            this.state.ball.flightTime = 0;
            this.state.phase = 'flight';
            this.state.shotsTaken++;
            this.pendingKick = null;
            
            // Sound and particles at moment of contact
            this.sound.playKick();
            this.particles.emit(this.state.ball.x, this.state.ball.y, 25, '#ffffff');
            
            console.log('[GAME-PK 3D] CONTACT! Ball launched!');
          }
        } else if (this.state.player.kickFrame < 0.7) {
          // Follow-through phase
          this.state.player.kickPhase = 'follow';
        } else {
          // End animation
          this.state.player.kicking = false;
          this.state.player.kickFrame = 0;
          this.state.player.kickPhase = 'idle';
        }
      }
      
      // Update goalkeeper with commitment system
      if (this.state.keeper.moving) {
        const dir = Math.sign(this.state.keeper.targetX - this.state.keeper.x);
        this.state.keeper.x += dir * CFG.keeper.diveSpeed * dt;
        this.state.keeper.armAngle = dir * Math.PI / 3;
        
        // Check if keeper has committed (moved 30% of distance)
        const totalDistance = Math.abs(this.state.keeper.targetX - this.state.keeper.startX);
        const movedDistance = Math.abs(this.state.keeper.x - this.state.keeper.startX);
        
        if (!this.state.keeper.committed && movedDistance > totalDistance * CFG.keeper.commitThreshold) {
          this.state.keeper.committed = true;
          console.log('[KEEPER] Committed to dive! Can\'t change direction now.');
        }
        
        // Once committed, keeper can't stop or change direction
        if (this.state.keeper.committed) {
          // Keep moving in committed direction even if ball trajectory changes
          // This makes keeper vulnerable to feints and misdirection
        }
        
        if ((dir > 0 && this.state.keeper.x >= this.state.keeper.targetX) ||
            (dir < 0 && this.state.keeper.x <= this.state.keeper.targetX)) {
          this.state.keeper.x = this.state.keeper.targetX;
          this.state.keeper.moving = false;
        }
      }
      
      // Update ball (3D physics)
      if (this.state.ball.flying && this.state.phase !== 'result') {
        this.state.ball.vz -= CFG.ball.gravity * dt;
        this.state.ball.x += this.state.ball.vx * dt;
        this.state.ball.y += this.state.ball.vy * dt;
        this.state.ball.z += this.state.ball.vz * dt;
        this.state.ball.rotation += 10 * dt;
        this.state.ball.flightTime += dt;
        
        // Check if reached goal line
        if (this.state.ball.y <= CFG.goal.goalLineY + 30) {
          this.checkResult();
          return;  // Stop processing after result
        }
        
        // Check if hit ground early (only if far from goal)
        if (this.state.ball.z <= 0 && this.state.ball.y > CFG.goal.goalLineY + 100) {
          console.log('[GAME-PK 3D] Ball hit ground early - miss');
          this.finishShot('miss');
          return;
        }
        
        // Check out of bounds
        const outX = this.state.ball.x < 0 || this.state.ball.x > CFG.width;
        const outY = this.state.ball.y > CFG.height;
        const timeout = this.state.ball.flightTime >= CFG.ball.maxFlightTime;
        
        if (outX || outY || timeout) {
          console.log('[GAME-PK 3D] Out of bounds');
          this.finishShot('miss');
          return;
        }
      }
    }

    checkResult() {
      this.state.ball.flying = false;
      const ballX = this.state.ball.x;
      const ballY = this.state.ball.y;
      const ballZ = Math.max(0, this.state.ball.z);  // Height from ground
      const ballRadius = CFG.ball.radius;
      
      const g = CFG.goal;
      const goalLeft = g.x - g.width / 2;
      const goalRight = g.x + g.width / 2;
      const goalHeight = g.height;  // Height of goal (from ground up)
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[GOAL CHECK] Ball Position:');
      console.log('  X:', ballX.toFixed(1), '(Goal:', goalLeft.toFixed(0), '-', goalRight.toFixed(0) + ')');
      console.log('  Y:', ballY.toFixed(1), '(GoalLine:', g.goalLineY + ')');
      console.log('  Z (height):', ballZ.toFixed(1), '(Max:', goalHeight + ')');
      
      // === 1. Check if ball is within goal frame (3D bounding box) ===
      const inGoalX = ballX >= (goalLeft - ballRadius) && ballX <= (goalRight + ballRadius);
      const inGoalHeight = ballZ >= 0 && ballZ <= goalHeight + ballRadius;
      const atGoalLine = ballY <= (g.goalLineY + 30);  // Reached goal line depth
      
      console.log('[GOAL CHECK] Checks:');
      console.log('  InX:', inGoalX, '| InHeight:', inGoalHeight, '| AtLine:', atGoalLine);
      
      // === 2. Check post collision (ball hits the post) ===
      const leftPostDist = Math.abs(ballX - goalLeft);
      const rightPostDist = Math.abs(ballX - goalRight);
      const hitPost = (leftPostDist < g.postSize + ballRadius || rightPostDist < g.postSize + ballRadius) && 
                      inGoalHeight && atGoalLine;
      
      if (hitPost) {
        console.log('[RESULT] ⚽ HIT POST! 🥅');
        this.finishShot('post');
        return;
      }
      
      // === 3. Check crossbar collision ===
      const crossbarDist = Math.abs(ballZ - goalHeight);
      const hitCrossbar = crossbarDist < g.postSize + ballRadius && inGoalX && atGoalLine;
      
      if (hitCrossbar) {
        console.log('[RESULT] ⚽ HIT CROSSBAR! 🎯');
        this.finishShot('post');
        return;
      }
      
      // === 4. Ball is within goal frame - check keeper ===
      if (inGoalX && inGoalHeight && atGoalLine) {
        // Keeper position and reach
        const keeperX = this.state.keeper.x;
        const keeperStandingHeight = 80 * CFG.keeper.scale;  // Keeper's reach when standing
        
        // Horizontal distance
        const distX = Math.abs(ballX - keeperX);
        
        // Check if keeper can reach horizontally
        const canReachX = distX <= CFG.keeper.armReach;
        
        // Check if keeper can reach vertically (jump height)
        const maxReachHeight = keeperStandingHeight + CFG.keeper.jumpReach;
        const canReachZ = ballZ <= maxReachHeight;
        
        console.log('[KEEPER CHECK]');
        console.log('  Keeper X:', keeperX.toFixed(0), '| Ball X:', ballX.toFixed(0));
        console.log('  Distance X:', distX.toFixed(1), '| Arm Reach:', CFG.keeper.armReach);
        console.log('  Ball Height:', ballZ.toFixed(1), '| Max Reach:', maxReachHeight.toFixed(1));
        console.log('  Can Reach X:', canReachX, '| Can Reach Z:', canReachZ);
        
        // Keeper saves if BOTH conditions met
        if (canReachX && canReachZ) {
          console.log('[RESULT] 🧤 SAVE! Keeper reached it!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          this.finishShot('save');
          this.state.keeper.celebrating = true;
          // Keeper jump animation
          this.state.keeper.armAngle = Math.sign(ballX - keeperX) * 0.8;
          return;  // Exit after result
        } else {
          // GOAL! Keeper couldn't reach
          const reason = !canReachX ? 'too wide' : 'too high';
          console.log('[RESULT] ⚽ GOAL! 🎉🎉🎉');
          console.log('  Reason: Ball was', reason, 'for keeper!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          this.state.goalsScored++;
          this.particles.emit(ballX, g.goalLineY, 50, '#ffd700');
          this.finishShot('goal');
          return;  // Exit after result
        }
      } else {
        // Ball missed goal frame entirely
        let missReason = '';
        if (!inGoalX) {
          missReason = ballX < goalLeft ? 'wide left' : 'wide right';
        } else if (!inGoalHeight) {
          missReason = ballZ > goalHeight ? 'over crossbar' : 'under goal';
        } else {
          missReason = 'unknown';
        }
        console.log('[RESULT] ❌ MISS!');
        console.log('  Reason:', missReason);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.finishShot('miss');
        return;  // Exit after result
      }
    }

    finishShot(result) {
      if (this.state.phase === 'result') return;
      
      this.state.result = result;
      this.state.ball.flying = false;
      this.state.phase = 'result';
      this.state.shotsRemaining--;
      this.updateHUD();
      
      if (result === 'goal') this.sound.playGoal();
      else if (result === 'save') this.sound.playSave();
      else if (result === 'post') this.sound.playMiss();  // Post hit sound
      else this.sound.playMiss();
      
      setTimeout(() => {
        if (this.state.shotsRemaining <= 0) {
          this.gameOver();
        }
      }, 2500);
    }

    nextShot() {
      if (this.state.shotsRemaining <= 0) return;
      
      // Check if sensor is connected
      const sensorConnected = typeof window.isSensorConnected === 'function' && window.isSensorConnected();
      
      if (sensorConnected) {
        // Sensor mode: Start countdown
        this.startCountdown();
      } else {
        // Mouse mode: Go directly to aim
        this.state.phase = 'aim';
        document.getElementById('msg').textContent = 'ドラッグして狙い、離してキック！';
      }
      
      // Reset ball and keeper
      this.state.ball.x = CFG.ball.startX;
      this.state.ball.y = CFG.ball.startY;
      this.state.ball.z = 0;
      this.state.ball.vx = 0;
      this.state.ball.vy = 0;
      this.state.ball.vz = 0;
      this.state.ball.rotation = 0;
      this.state.ball.flightTime = 0;
      this.state.ball.visible = true;
      this.state.keeper.x = CFG.keeper.x;
      this.state.keeper.startX = CFG.keeper.x;
      this.state.keeper.targetX = CFG.keeper.x;
      this.state.keeper.moving = false;
      this.state.keeper.committed = false;
      this.state.keeper.armAngle = 0;
      this.state.keeper.celebrating = false;
      this.state.result = null;
      this.pendingKick = null;
    }

    startCountdown() {
      this.state.phase = 'countdown';
      this.countdownValue = 3;
      
      const countdownOverlay = document.getElementById('countdown-overlay');
      const countdownNumber = document.getElementById('countdown-number');
      
      if (countdownOverlay && countdownNumber) {
        countdownOverlay.style.display = 'grid';
        countdownNumber.textContent = '3';
        
        const countdownInterval = setInterval(() => {
          this.countdownValue--;
          
          if (this.countdownValue > 0) {
            countdownNumber.textContent = this.countdownValue.toString();
          } else if (this.countdownValue === 0) {
            countdownNumber.textContent = 'GO!';
          } else {
            // Countdown finished
            clearInterval(countdownInterval);
            countdownOverlay.style.display = 'none';
            
            // Start sensor recording
            this.state.phase = 'waiting_kick';
            if (typeof window.startSensorRecording === 'function') {
              window.startSensorRecording();
            }
            document.getElementById('msg').textContent = '足を振ってキック！';
          }
        }, 1000);
      }
    }

    gameOver() {
      this.state.phase = 'gameover';
      this.sound.playWhistle();
      const accuracy = (this.state.goalsScored / CFG.game.totalShots * 100).toFixed(0);
      document.getElementById('msg').textContent = `試合終了！${this.state.goalsScored}/${CFG.game.totalShots} ゴール (${accuracy}%) - もう一度プレイ`;
      
      // Show result overlay if available (ORPHE mode)
      if (typeof window.showResultScreen === 'function') {
        window.showResultScreen(this.state.goalsScored, CFG.game.totalShots);
      }
      
      // Stop sensor recording if active
      if (typeof window.stopSensorRecording === 'function') {
        window.stopSensorRecording();
      }
      
      console.log(`[GAME-PK 3D] Game over: ${this.state.goalsScored}/${CFG.game.totalShots} goals`);
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
          'miss': '😢 外れた！次は狙いを定めよう'
        };
        document.getElementById('msg').textContent = messages[this.state.result];
      }
    }

    draw() {
      const ctx = this.ctx;
      
      // Sky
      const skyGradient = ctx.createLinearGradient(0, 0, 0, CFG.height / 2);
      skyGradient.addColorStop(0, '#87CEEB');
      skyGradient.addColorStop(1, '#B0D8F0');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, CFG.width, CFG.height / 2);
      
      // Stadium stands
      this.drawStadium();
      
      // Field (3D trapezoid)
      this.drawField();
      
      // Goal (3D)
      this.drawGoal();
      
      // Goalkeeper
      this.drawKeeper();
      
      // Player (draw first, before ball)
      this.drawPlayer();
      
      // Ball (draw after player so it appears in front at foot)
      this.drawBall();
      
      // Aim indicator
      if (this.state.phase === 'aim' && this.state.aim.active) {
        this.drawAimIndicator();
      }
      
      // Particles
      this.particles.draw(ctx);
      
      // Result overlay
      if (this.state.phase === 'result' || this.state.phase === 'gameover') {
        this.drawResultOverlay();
      }
    }

    drawStadium() {
      const ctx = this.ctx;
      
      // Stands background
      ctx.fillStyle = '#654321';
      ctx.fillRect(0, 0, CFG.width, 160);
      
      // Crowd (colorful dots)
      for (let y = 10; y < 150; y += 15) {
        for (let x = 0; x < CFG.width; x += 20) {
          ctx.fillStyle = CFG.stadium.crowdColors[Math.floor((x + y) / 20) % CFG.stadium.crowdColors.length];
          ctx.fillRect(x + Math.random() * 5, y + Math.random() * 5, 12, 12);
        }
      }
      
      // Flags
      for (let i = 0; i < 8; i++) {
        const x = 150 + i * 130;
        const y = 20;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 60);
        ctx.stroke();
        
        ctx.fillStyle = CFG.stadium.flagColors[i % CFG.stadium.flagColors.length];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 30, y + 10);
        ctx.lineTo(x, y + 20);
        ctx.fill();
      }
    }

    drawField() {
      const ctx = this.ctx;
      const f = CFG.field;
      
      // Grass trapezoid with stripes
      for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const y1 = f.nearY - (f.nearY - f.farY) * t;
        const y2 = f.nearY - (f.nearY - f.farY) * (t + 0.05);
        
        const x1_left = f.nearLeft + (f.farLeft - f.nearLeft) * t;
        const x1_right = f.nearRight + (f.farRight - f.nearRight) * t;
        const x2_left = f.nearLeft + (f.farLeft - f.nearLeft) * (t + 0.05);
        const x2_right = f.nearRight + (f.farRight - f.nearRight) * (t + 0.05);
        
        ctx.fillStyle = i % 2 === 0 ? f.grassColor1 : f.grassColor2;
        ctx.beginPath();
        ctx.moveTo(x1_left, y1);
        ctx.lineTo(x1_right, y1);
        ctx.lineTo(x2_right, y2);
        ctx.lineTo(x2_left, y2);
        ctx.closePath();
        ctx.fill();
      }
      
      // Field lines
      ctx.strokeStyle = f.lineColor;
      ctx.lineWidth = 3;
      
      // Outline
      ctx.beginPath();
      ctx.moveTo(f.nearLeft, f.nearY);
      ctx.lineTo(f.farLeft, f.farY);
      ctx.lineTo(f.farRight, f.farY);
      ctx.lineTo(f.nearRight, f.nearY);
      ctx.closePath();
      ctx.stroke();
      
      // Penalty box
      const boxNearLeft = 300;
      const boxNearRight = 900;
      const boxFarLeft = 420;
      const boxFarRight = 780;
      const boxNearY = 600;
      const boxFarY = 220;
      
      ctx.beginPath();
      ctx.moveTo(boxNearLeft, boxNearY);
      ctx.lineTo(boxFarLeft, boxFarY);
      ctx.lineTo(boxFarRight, boxFarY);
      ctx.lineTo(boxNearRight, boxNearY);
      ctx.closePath();
      ctx.stroke();
      
      // Penalty spot
      ctx.fillStyle = f.lineColor;
      ctx.beginPath();
      ctx.arc(CFG.ball.startX, CFG.ball.startY, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    drawGoal() {
      const ctx = this.ctx;
      const g = CFG.goal;
      
      const leftX = g.x - g.width / 2;
      const rightX = g.x + g.width / 2;
      const topY = g.y;
      const bottomY = g.groundY;
      
      // === 3D GOAL with perspective ===
      
      // Goal depth/back shadow (3D effect)
      const depthOffset = 25;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.moveTo(leftX, topY);
      ctx.lineTo(leftX - depthOffset, topY - depthOffset);
      ctx.lineTo(rightX + depthOffset, topY - depthOffset);
      ctx.lineTo(rightX, topY);
      ctx.closePath();
      ctx.fill();
      
      // Net background (inside goal)
      const netGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
      netGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      netGrad.addColorStop(0.5, 'rgba(200, 200, 200, 0.2)');
      netGrad.addColorStop(1, 'rgba(150, 150, 150, 0.25)');
      ctx.fillStyle = netGrad;
      ctx.fillRect(leftX, topY, g.width, bottomY - topY);
      
      // Net pattern (realistic diamond mesh)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      const meshSize = 20;
      
      // Vertical lines
      for (let x = leftX; x <= rightX; x += meshSize) {
        ctx.globalAlpha = 0.3 + (Math.abs(x - g.x) / g.width) * 0.2;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = topY; y <= bottomY; y += meshSize) {
        ctx.globalAlpha = 0.3 + ((y - topY) / (bottomY - topY)) * 0.2;
        ctx.beginPath();
        ctx.moveTo(leftX, y);
        ctx.lineTo(rightX, y);
        ctx.stroke();
      }
      ctx.restore();
      
      // Ground shadow under goal
      ctx.fillStyle = g.shadowColor;
      ctx.beginPath();
      ctx.ellipse(g.x, bottomY + 8, g.width / 2 + 20, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // === GOAL POSTS (cylindrical with 3D shading) ===
      
      // Left post
      const postGrad1 = ctx.createLinearGradient(leftX - g.postSize, 0, leftX + 5, 0);
      postGrad1.addColorStop(0, '#cccccc');
      postGrad1.addColorStop(0.4, '#ffffff');
      postGrad1.addColorStop(0.6, '#ffffff');
      postGrad1.addColorStop(1, '#d0d0d0');
      ctx.fillStyle = postGrad1;
      ctx.fillRect(leftX - g.postSize, topY, g.postSize, bottomY - topY);
      
      // Left post highlight (cylindrical)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(leftX - g.postSize + 3, topY, 3, bottomY - topY);
      
      // Right post
      const postGrad2 = ctx.createLinearGradient(rightX - 5, 0, rightX + g.postSize, 0);
      postGrad2.addColorStop(0, '#d0d0d0');
      postGrad2.addColorStop(0.4, '#ffffff');
      postGrad2.addColorStop(0.6, '#ffffff');
      postGrad2.addColorStop(1, '#cccccc');
      ctx.fillStyle = postGrad2;
      ctx.fillRect(rightX, topY, g.postSize, bottomY - topY);
      
      // Right post highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(rightX + 2, topY, 3, bottomY - topY);
      
      // Top crossbar
      const crossbarGrad = ctx.createLinearGradient(0, topY - g.postSize, 0, topY + 5);
      crossbarGrad.addColorStop(0, '#cccccc');
      crossbarGrad.addColorStop(0.5, '#ffffff');
      crossbarGrad.addColorStop(1, '#e0e0e0');
      ctx.fillStyle = crossbarGrad;
      ctx.fillRect(leftX - g.postSize, topY - g.postSize, g.width + g.postSize * 2, g.postSize);
      
      // Crossbar highlight (cylindrical)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(leftX - g.postSize, topY - g.postSize + 2, g.width + g.postSize * 2, 3);
      
      // Post corners (rounded caps)
      ctx.fillStyle = '#ffffff';
      // Top-left corner
      ctx.beginPath();
      ctx.arc(leftX - g.postSize / 2, topY - g.postSize / 2, g.postSize / 2, 0, Math.PI * 2);
      ctx.fill();
      // Top-right corner
      ctx.beginPath();
      ctx.arc(rightX + g.postSize / 2, topY - g.postSize / 2, g.postSize / 2, 0, Math.PI * 2);
      ctx.fill();
      // Bottom-left corner
      ctx.beginPath();
      ctx.arc(leftX - g.postSize / 2, bottomY, g.postSize / 2, 0, Math.PI * 2);
      ctx.fill();
      // Bottom-right corner
      ctx.beginPath();
      ctx.arc(rightX + g.postSize / 2, bottomY, g.postSize / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Goal line on ground (white line)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(leftX - 30, bottomY + 2);
      ctx.lineTo(rightX + 30, bottomY + 2);
      ctx.stroke();
    }

    drawKeeper() {
      const ctx = this.ctx;
      const k = this.state.keeper;
      const scale = CFG.keeper.scale;
      
      ctx.save();
      ctx.translate(k.x, CFG.keeper.y);
      ctx.scale(scale, scale);
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 110, 40, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs
      ctx.fillStyle = '#2a5da8';
      ctx.fillRect(-20, 70, 16, 40);
      ctx.fillRect(4, 70, 16, 40);
      
      // Shoes
      ctx.fillStyle = '#000000';
      ctx.fillRect(-22, 105, 20, 10);
      ctx.fillRect(4, 105, 20, 10);
      
      // Body (jersey)
      const jerseyGrad = ctx.createLinearGradient(-30, 20, 30, 20);
      jerseyGrad.addColorStop(0, '#d45500');
      jerseyGrad.addColorStop(0.5, '#ff8800');
      jerseyGrad.addColorStop(1, '#d45500');
      ctx.fillStyle = jerseyGrad;
      ctx.fillRect(-30, 20, 60, 50);
      
      // Number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('1', 0, 50);
      
      // Neck
      ctx.fillStyle = '#ffdbac';
      ctx.fillRect(-10, 15, 20, 12);
      
      // Head
      const headGrad = ctx.createRadialGradient(-6, -15, 0, 0, -10, 28);
      headGrad.addColorStop(0, '#ffecd2');
      headGrad.addColorStop(1, '#ffdbac');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(0, -10, 25, 0, Math.PI * 2);
      ctx.fill();
      
      // Hair
      ctx.fillStyle = '#3a2618';
      ctx.beginPath();
      ctx.arc(-10, -25, 14, 0, Math.PI);
      ctx.arc(10, -25, 14, 0, Math.PI);
      ctx.arc(0, -30, 18, 0, Math.PI);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-15, -14, 10, 8);
      ctx.fillRect(5, -14, 10, 8);
      ctx.fillStyle = '#000000';
      ctx.fillRect(-12, -12, 5, 5);
      ctx.fillRect(8, -12, 5, 5);
      
      // Mouth
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (k.celebrating) {
        ctx.arc(0, 0, 10, 0, Math.PI);
      } else {
        ctx.moveTo(-8, 2);
        ctx.lineTo(8, 2);
      }
      ctx.stroke();
      
      // Arms
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      
      ctx.save();
      ctx.rotate(-k.armAngle);
      ctx.beginPath();
      ctx.moveTo(-30, 30);
      ctx.lineTo(-30 - 50, 50);
      ctx.stroke();
      
      // Glove
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(-30 - 50, 50, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      ctx.save();
      ctx.rotate(k.armAngle);
      ctx.beginPath();
      ctx.moveTo(30, 30);
      ctx.lineTo(30 + 50, 50);
      ctx.stroke();
      
      // Glove
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(30 + 50, 50, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      ctx.restore();
      
      // Celebration
      if (k.celebrating) {
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('✨', k.x - 60, CFG.keeper.y - 40);
        ctx.fillText('✨', k.x + 60, CFG.keeper.y - 40);
      }
    }

    drawPlayer() {
      const ctx = this.ctx;
      const p = CFG.player;
      const scale = p.scale;
      const phase = this.state.player.kickPhase;
      const frame = this.state.player.kickFrame;
      
      // Calculate animation values based on phase
      let bodyLean = 0, kickLegAngle = 0, kickLegBend = 0;
      let backLegBend = 0, armSwing = 0, headTilt = 0;
      let kickLegY = 70;
      let kickLegLift = 0;  // How high the kick leg goes
      
      if (phase === 'windup') {
        // Pull back for power
        const t = frame / 0.2;
        bodyLean = -0.2 * t;
        kickLegAngle = -0.8 * t;  // Leg pulls back more
        kickLegBend = 0.4 * t;
        backLegBend = 0.15 * t;
        armSwing = 0.4 * t;
        kickLegY = 70 - 8 * t;  // Leg lifts slightly
        kickLegLift = -12 * t;  // Pull back
      } else if (phase === 'strike') {
        // Explosive forward strike
        const t = (frame - 0.2) / 0.15;
        bodyLean = -0.2 + 0.5 * t;
        kickLegAngle = -0.8 + 1.6 * t;  // Powerful forward swing
        kickLegBend = 0.4 - 0.5 * t;  // Straighten leg
        backLegBend = 0.15 + 0.25 * t;
        armSwing = 0.4 - 0.8 * t;  // Arms swing opposite
        kickLegY = 62 - 10 * t;  // Leg goes forward and down
        kickLegLift = -12 + 28 * t;  // Swing through
      } else if (phase === 'follow') {
        // Follow through
        const t = (frame - 0.35) / 0.35;
        bodyLean = 0.3 * (1 - t * 0.4);
        kickLegAngle = 0.8 * (1 - t * 0.5);
        kickLegBend = -0.1;
        backLegBend = 0.4 * (1 - t * 0.3);
        armSwing = -0.4 * (1 - t * 0.5);
        kickLegY = 52 + 8 * t;
        kickLegLift = 16 - 10 * t;
      }
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(scale, scale);
      
      // CRITICAL: Player faces AWAY (toward goal) - we draw the BACK VIEW
      
      // Dynamic shadow based on kick
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 110, 55, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Apply body lean
      ctx.save();
      ctx.translate(0, 50);
      ctx.rotate(bodyLean);
      ctx.translate(0, -50);
      
      // === BACK VIEW - SUPPORTING LEG (left leg from behind) ===
      ctx.save();
      ctx.translate(-20, 70);
      ctx.rotate(-backLegBend * 0.8);
      
      // Thigh (back view)
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(-11, 0, 22, 38);
      
      // Shin
      ctx.save();
      ctx.translate(0, 38);
      ctx.rotate(backLegBend * 0.4);
      
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(-10, 0, 20, 40);
      
      // Sock stripe (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10, 28, 20, 4);
      
      // Shoe (from behind - heel visible)
      ctx.fillStyle = '#000000';
      ctx.fillRect(-13, 38, 26, 14);
      
      // Shoe sole visible from behind
      ctx.fillStyle = '#333333';
      ctx.fillRect(-13, 50, 26, 3);
      
      // Heel detail
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11, 40, 8, 3);
      
      ctx.restore();
      ctx.restore();
      
      // === BACK VIEW - KICKING LEG (right leg from behind) ===
      ctx.save();
      ctx.translate(18 + kickLegLift, kickLegY);
      ctx.rotate(kickLegAngle);
      
      // Thigh (powerful, from behind)
      const thighGrad = ctx.createLinearGradient(-13, 0, 13, 0);
      thighGrad.addColorStop(0, '#990000');
      thighGrad.addColorStop(0.5, '#cc0000');
      thighGrad.addColorStop(1, '#990000');
      ctx.fillStyle = thighGrad;
      ctx.fillRect(-13, 0, 26, 38);
      
      // Thigh contour (back of leg muscle)
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(-5, 18, 8, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, 18, 8, 0, Math.PI);
      ctx.fill();
      
      // Shin
      ctx.save();
      ctx.translate(0, 38);
      ctx.rotate(kickLegBend);
      
      const shinGrad = ctx.createLinearGradient(-12, 0, 12, 0);
      shinGrad.addColorStop(0, '#990000');
      shinGrad.addColorStop(0.5, '#cc0000');
      shinGrad.addColorStop(1, '#990000');
      ctx.fillStyle = shinGrad;
      ctx.fillRect(-12, 0, 24, 44);
      
      // Calf muscle (visible from behind)
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(0, 15, 10, 0, Math.PI);
      ctx.fill();
      
      // Sock stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, 30, 24, 4);
      ctx.fillRect(-12, 36, 24, 3);
      
      // Soccer shoe (from behind - DETAILED SOLE)
      ctx.save();
      ctx.translate(0, 44);
      
      // Shoe body
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-16, 8);
      ctx.quadraticCurveTo(-16, 12, -12, 13);
      ctx.lineTo(12, 13);
      ctx.quadraticCurveTo(16, 12, 16, 8);
      ctx.lineTo(15, 0);
      ctx.fill();
      
      // Shoe sole (bottom - visible when kicking)
      if (phase === 'strike' || phase === 'windup') {
        ctx.fillStyle = '#444444';
        ctx.fillRect(-14, 12, 28, 4);
        
        // Studs (visible from behind)
        ctx.fillStyle = '#888888';
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(i * 6 - 2, 14, 4, 3);
        }
        
        // Heel stud
        ctx.fillRect(-3, 13, 6, 2);
      }
      
      // Shoe laces/stripes
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-10 + i * 10, 2);
        ctx.lineTo(-8 + i * 10, 9);
        ctx.stroke();
      }
      
      // Nike/Adidas style swoosh
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 4);
      ctx.quadraticCurveTo(12, 6, 14, 4);
      ctx.stroke();
      
      ctx.restore(); // End shoe
      ctx.restore(); // End shin
      ctx.restore(); // End kicking leg
      
      // === BACK VIEW - BODY (jersey from behind) ===
      const bodyGrad = ctx.createLinearGradient(-40, 20, 40, 20);
      bodyGrad.addColorStop(0, '#990000');
      bodyGrad.addColorStop(0.3, '#cc0000');
      bodyGrad.addColorStop(0.5, '#ff0000');
      bodyGrad.addColorStop(0.7, '#cc0000');
      bodyGrad.addColorStop(1, '#990000');
      ctx.fillStyle = bodyGrad;
      
      // Jersey back (broader shoulders)
      ctx.beginPath();
      ctx.moveTo(-42, 18);
      ctx.lineTo(-42, 65);
      ctx.quadraticCurveTo(-22, 70, 0, 70);
      ctx.quadraticCurveTo(22, 70, 42, 65);
      ctx.lineTo(42, 18);
      ctx.quadraticCurveTo(35, 12, 0, 12);
      ctx.quadraticCurveTo(-35, 12, -42, 18);
      ctx.fill();
      
      // Back stripes (vertical)
      ctx.fillStyle = '#660000';
      ctx.fillRect(-28, 20, 4, 48);
      ctx.fillRect(24, 20, 4, 48);
      
      // NUMBER 10 on back (large and clear)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px Arial Black';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeText('10', 0, 52);
      ctx.fillText('10', 0, 52);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Collar (back view)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-18, 14, 36, 6);
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(-15, 16, 30, 3);
      
      // === BACK VIEW - HEAD (back of head) ===
      ctx.save();
      ctx.translate(0, -8);
      ctx.rotate(headTilt);
      
      // Head (from behind)
      const headGrad = ctx.createRadialGradient(0, -12, 0, 0, -12, 32);
      headGrad.addColorStop(0, '#ffecd2');
      headGrad.addColorStop(0.8, '#ffdbac');
      headGrad.addColorStop(1, '#d4a574');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(0, -12, 30, 0, Math.PI * 2);
      ctx.fill();
      
      // Hair (back of head - full coverage)
      ctx.fillStyle = '#2a1810';
      ctx.beginPath();
      ctx.arc(-15, -20, 18, Math.PI * 0.7, Math.PI * 1.8);
      ctx.arc(15, -20, 18, Math.PI * 1.2, Math.PI * 2.3);
      ctx.arc(0, -30, 22, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      
      // Hair highlights
      ctx.fillStyle = '#3a2820';
      ctx.beginPath();
      ctx.arc(-10, -28, 8, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(8, -32, 7, 0, Math.PI);
      ctx.fill();
      
      // Neck (back)
      ctx.fillStyle = '#ffdbac';
      ctx.fillRect(-14, 8, 28, 18);
      
      // Ear (visible from behind - left side)
      ctx.fillStyle = '#ffdbac';
      ctx.beginPath();
      ctx.ellipse(-28, -8, 8, 12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0b891';
      ctx.beginPath();
      ctx.ellipse(-27, -8, 4, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Ear (right side)
      ctx.fillStyle = '#ffdbac';
      ctx.beginPath();
      ctx.ellipse(28, -8, 8, 12, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0b891';
      ctx.beginPath();
      ctx.ellipse(27, -8, 4, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore(); // End head
      
      // === BACK VIEW - ARMS (from behind) ===
      
      // Left arm (from behind - right side of screen)
      ctx.save();
      ctx.translate(42, 28);
      ctx.rotate(armSwing * 0.9);
      
      // Upper arm (back view)
      const armGrad = ctx.createLinearGradient(-11, 0, 11, 0);
      armGrad.addColorStop(0, '#aa0000');
      armGrad.addColorStop(0.5, '#cc0000');
      armGrad.addColorStop(1, '#aa0000');
      ctx.fillStyle = armGrad;
      ctx.fillRect(-11, 0, 22, 34);
      
      // Forearm
      ctx.save();
      ctx.translate(0, 34);
      ctx.rotate(-armSwing * 0.4);
      ctx.fillRect(-10, 0, 20, 30);
      
      // Hand (back of hand)
      ctx.fillStyle = '#ffdbac';
      ctx.beginPath();
      ctx.ellipse(0, 30, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
      ctx.restore();
      
      // Right arm (from behind - left side of screen)
      ctx.save();
      ctx.translate(-42, 28);
      ctx.rotate(-armSwing * 0.9);
      
      ctx.fillStyle = armGrad;
      ctx.fillRect(-11, 0, 22, 34);
      
      ctx.save();
      ctx.translate(0, 34);
      ctx.rotate(armSwing * 0.4);
      ctx.fillRect(-10, 0, 20, 30);
      
      ctx.fillStyle = '#ffdbac';
      ctx.beginPath();
      ctx.ellipse(0, 30, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
      ctx.restore();
      
      ctx.restore(); // End body lean
      
      // Motion blur during strike (speed lines)
      if (phase === 'strike') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          ctx.globalAlpha = 0.4 - i * 0.06;
          const offset = 18 + kickLegLift;
          ctx.beginPath();
          ctx.moveTo(offset - 40 - i * 12, kickLegY + 50);
          ctx.lineTo(offset - 60 - i * 12, kickLegY + 45);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      
      ctx.restore();
    }

    drawBall() {
      const ctx = this.ctx;
      const b = this.state.ball;
      
      if (!b.visible) return;  // Don't draw if hidden
      
      // Calculate ball position
      let ballX, ballY, ballZ;
      
      if (b.flying) {
        // Flying - use physics position
        ballX = b.x;
        ballY = b.y - b.z;  // Screen Y position
        ballZ = b.z;
      } else {
        // On ground at player's foot
        const phase = this.state.player.kickPhase;
        const frame = this.state.player.kickFrame;
        
        if (phase === 'idle' || phase === 'windup') {
          // Ball is on ground in front of player, slightly to the right
          ballX = CFG.player.x + 25;
          ballY = CFG.player.y + 95;  // At foot level
          ballZ = 0;
        } else if (phase === 'strike') {
          // Ball starts moving with foot
          const t = (frame - 0.2) / 0.15;
          ballX = CFG.player.x + 25 + t * 30;
          ballY = CFG.player.y + 95 - t * 10;
          ballZ = t * 20;  // Ball lifts slightly
        } else {
          // Follow-through - ball has left
          ballX = b.x;
          ballY = b.y - b.z;
          ballZ = b.z;
        }
      }
      
      // Shadow on ground
      if (ballZ > 0 || b.flying) {
        const shadowY = b.flying ? b.y : CFG.player.y + 95;
        const shadowSize = Math.max(12, 30 - ballZ * 0.15);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(ballX, shadowY, shadowSize, shadowSize * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.save();
      ctx.translate(ballX, ballY);
      ctx.rotate(b.rotation);
      
      // Ball gradient
      const gradient = ctx.createRadialGradient(-7, -7, 0, 0, 0, CFG.ball.radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.6, '#f5f5f5');
      gradient.addColorStop(0.9, '#d0d0d0');
      gradient.addColorStop(1, '#a0a0a0');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, CFG.ball.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Soccer ball pattern
      ctx.fillStyle = '#000000';
      
      // Center pentagon
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const x = Math.cos(angle) * 7;
        const y = Math.sin(angle) * 7;
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
        ctx.translate(0, -13);
        
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const angle = (Math.PI * 2 * j) / 5;
          const x = Math.cos(angle) * 5;
          const y = Math.sin(angle) * 5;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      
      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(-6, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      
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
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + power * 0.4})`;
      ctx.lineWidth = 5;
      ctx.setLineDash([15, 8]);
      
      ctx.beginPath();
      ctx.moveTo(a.startX, a.startY);
      ctx.lineTo(a.endX, a.endY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Arrow head
      const angle = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(a.endX, a.endY);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-20, -10);
      ctx.lineTo(-20, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      
      // Power bar
      const barWidth = 80;
      const barHeight = 12;
      const barX = a.endX - barWidth / 2;
      const barY = a.endY - 40;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
      
      const powerColor = power > 0.8 ? '#ff4444' : power > 0.5 ? '#ffaa00' : '#44ff44';
      ctx.fillStyle = powerColor;
      ctx.fillRect(barX, barY, barWidth * power, barHeight);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      
      // Power percentage
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(`${(power * 100).toFixed(0)}%`, a.endX, barY - 10);
      ctx.fillText(`${(power * 100).toFixed(0)}%`, a.endX, barY - 10);
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
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(0, CFG.height / 2 - 100, CFG.width, 200);
          
          ctx.font = 'bold 100px Arial Black';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 10;
          ctx.strokeText(msg.text, CFG.width / 2, CFG.height / 2);
          ctx.fillStyle = msg.color;
          ctx.fillText(msg.text, CFG.width / 2, CFG.height / 2);
        }
      } else if (this.state.phase === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, CFG.width, CFG.height);
        
        ctx.font = 'bold 70px Arial Black';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('GAME OVER', CFG.width / 2, CFG.height / 2 - 100);
        
        ctx.font = 'bold 50px Arial';
        ctx.fillText(`${this.state.goalsScored} / ${CFG.game.totalShots} ゴール`, CFG.width / 2, CFG.height / 2);
        
        const accuracy = (this.state.goalsScored / CFG.game.totalShots * 100).toFixed(0);
        ctx.font = 'bold 35px Arial';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`成功率: ${accuracy}%`, CFG.width / 2, CFG.height / 2 + 70);
        
        ctx.font = '24px Arial';
        ctx.fillStyle = '#cccccc';
        ctx.fillText('Rキーで再開', CFG.width / 2, CFG.height / 2 + 140);
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
      console.error('[GAME-PK 3D] Canvas element not found!');
      return;
    }
    
    window.game = new Game(canvas);
    console.log('[GAME-PK 3D] Game started');
  });

})();
