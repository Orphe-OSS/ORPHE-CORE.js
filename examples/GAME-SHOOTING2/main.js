
// GAME-SHOOTING2 - Star Fox Style 3D Shooter
// Using Three.js and ORPHE CORE

let scene, camera, renderer;
let player;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let ground;
let scenery = [];
let score = 0;
let isGameOver = false;
let lastShotTime = 0;
let gameSpeed = 1.0;
let playerSensitivity = 1.0;
let spawnRateMultiplier = 0.8; // Tuned for better balance

// Bot Mode State
// Bot Mode State
var botMode = false; // Toggle with 'B' key
let botTargetX = 0;
let botTargetY = 0;

// Audio
const bgm = new Audio('BGMA.mp3');
bgm.loop = true;
const shootSound = new Audio('pipi.wav');
const explosionSound = new Audio('p1.mp3');
const damageSound = new Audio('p2.mp3');

// Input State
// Input State
var keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

// ORPHE CORE State
let coreEuler = { pitch: 0, roll: 0, yaw: 0 };
let coreNeutralEuler = null;
const orpheTiltLimit = 0.8;
const orpheTiltGain = 0.85;
const orpheShotThreshold = 1.5;

// Shared Resources
const resources = {};

init();
animate();

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    // Epic Space Background
    scene.background = new THREE.Color(0x000011); // Deep space blue
    scene.fog = new THREE.FogExp2(0x000011, 0.002); // Exponential fog for deep space feel

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
        starPos[i] = (Math.random() - 0.5) * 400;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.5, transparent: true });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Initialize Shared Resources
    resources.laserGeo = new THREE.BoxGeometry(0.1, 0.1, 3);
    resources.laserMat = new THREE.MeshBasicMaterial({ color: 0x00FF00 });

    // Larger Enemies
    resources.enemyPyramidGeo = new THREE.ConeGeometry(3, 6, 4); // Doubled size
    resources.enemyPyramidMat = new THREE.MeshPhongMaterial({ color: 0xFF4444, flatShading: true });

    resources.enemyBoxGeo = new THREE.BoxGeometry(4, 4, 4); // Doubled size
    resources.enemyBoxMat = new THREE.MeshPhongMaterial({ color: 0x44FF44, flatShading: true });

    resources.enemySpinnerGeo = new THREE.OctahedronGeometry(3); // Doubled size
    resources.enemySpinnerMat = new THREE.MeshPhongMaterial({ color: 0xFFFF44, flatShading: true });

    // NEW Enemy Types
    resources.enemyHunterGeo = new THREE.ConeGeometry(1, 4, 3); // Sleek fighter
    resources.enemyHunterMat = new THREE.MeshPhongMaterial({ color: 0xFF00FF, flatShading: true });

    resources.enemyCarrierGeo = new THREE.BoxGeometry(6, 3, 10); // Big ship
    resources.enemyCarrierMat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });

    resources.enemyBulletGeo = new THREE.SphereGeometry(0.6, 8, 8); // Larger bullets
    resources.enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });

    // Scenery Resources
    resources.archColGeo = new THREE.BoxGeometry(3, 20, 3);
    resources.archColMat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });
    resources.archTopGeo = new THREE.BoxGeometry(25, 3, 3);

    resources.pillarGeo = new THREE.CylinderGeometry(2, 2, 30, 8);
    resources.pillarMat = new THREE.MeshPhongMaterial({ color: 0x666666, flatShading: true });

    resources.barGeo = new THREE.BoxGeometry(30, 2, 2);
    resources.barMat = new THREE.MeshPhongMaterial({ color: 0xAAAAAA, flatShading: true });

    // NEW SF Obstacles
    resources.hexGateGeo = new THREE.TorusGeometry(25, 2.5, 6, 20); // Even Larger Gate (was 15)
    resources.hexGateMat = new THREE.MeshPhongMaterial({ color: 0x00FFFF, flatShading: true, wireframe: false });

    resources.floatBlockGeo = new THREE.BoxGeometry(5, 5, 5);
    resources.floatBlockMat = new THREE.MeshPhongMaterial({ color: 0x8800FF, wireframe: true }); // Wireframe for "tech" look

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 8); // Closer and lower for more impact

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Make canvas focusable and auto-focus
    renderer.domElement.setAttribute('tabindex', '0');
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0'; // Ensure it's behind UI
    renderer.domElement.focus();
    renderer.domElement.addEventListener('click', () => {
        renderer.domElement.focus();
    });

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 5. Infinite Grid Ground
    createGround();

    // 6. Player Ship (Redesigned Viper Class)
    createPlayer();

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', (e) => {
        console.log("Key pressed:", e.code); // Debug
        // Update key states
        if (e.code === 'ArrowUp') keys.ArrowUp = true;
        if (e.code === 'ArrowDown') keys.ArrowDown = true;
        if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
        if (e.code === 'ArrowRight') keys.ArrowRight = true;

        if (e.code === 'Space') {
            keys.Space = true;
            if (isGameOver) resetGame();
            else shoot();
        }
        if (e.key === 's' || e.key === 'S') {
            document.getElementById('settings-panel').classList.toggle('visible');
        }
        if (e.key === 'b' || e.key === 'B') {
            botMode = !botMode;
            console.log("Bot Mode:", botMode);
        }
        if (e.key === 'c' || e.key === 'C') {
            coreNeutralEuler = null;
            console.log("ORPHE CORE neutral angle will be recalibrated on the next sensor frame.");
        }
        if (bgm.paused) bgm.play().catch(e => console.log("Audio play failed", e));
    });

    window.addEventListener('keyup', (e) => {
        // Update key states
        if (e.code === 'ArrowUp') keys.ArrowUp = false;
        if (e.code === 'ArrowDown') keys.ArrowDown = false;
        if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
        if (e.code === 'ArrowRight') keys.ArrowRight = false;
        if (e.code === 'Space') keys.Space = false;
    });

    // 8. ORPHE CORE Integration
    if (window.ble) {
        window.ble.gotEuler = function (_euler) {
            if (!coreNeutralEuler) {
                coreNeutralEuler = {
                    pitch: _euler.pitch,
                    roll: _euler.roll,
                    yaw: _euler.yaw
                };
            }
            coreEuler = {
                pitch: _euler.pitch - coreNeutralEuler.pitch,
                roll: _euler.roll - coreNeutralEuler.roll,
                yaw: _euler.yaw - coreNeutralEuler.yaw
            };
        };
        window.ble.gotAcc = function (_acc) {
            let sum = Math.sqrt(_acc.x * _acc.x + _acc.y * _acc.y + _acc.z * _acc.z);
            if (sum > orpheShotThreshold) {
                shoot();
            }
        };
    }

    // Restart Button Logic
    document.getElementById('restart-btn').addEventListener('click', () => {
        resetGame();
    });

    // Settings UI Logic
    const panel = document.getElementById('settings-panel');
    const toggle = document.getElementById('settings-toggle');

    toggle.addEventListener('click', () => {
        panel.classList.toggle('visible');
    });

    document.getElementById('speed-slider').addEventListener('input', (e) => {
        gameSpeed = parseFloat(e.target.value);
        document.getElementById('speed-val').innerText = gameSpeed.toFixed(1) + 'x';
    });

    document.getElementById('sens-slider').addEventListener('input', (e) => {
        playerSensitivity = parseFloat(e.target.value);
        document.getElementById('sens-val').innerText = playerSensitivity.toFixed(1) + 'x';
    });

    document.getElementById('spawn-slider').addEventListener('input', (e) => {
        spawnRateMultiplier = parseFloat(e.target.value);
        document.getElementById('spawn-val').innerText = spawnRateMultiplier.toFixed(1) + 'x';
    });
}

function createGround() {
    // Let's use a large plane with a grid texture for the retro look
    const gridSize = 200;
    const gridDivisions = 40;

    // Two grids to loop
    ground = new THREE.Group();

    const gridHelper1 = new THREE.GridHelper(gridSize, gridDivisions, 0x555555, 0x555555);
    gridHelper1.position.y = -2;
    gridHelper1.position.z = -50;
    ground.add(gridHelper1);

    const gridHelper2 = new THREE.GridHelper(gridSize, gridDivisions, 0x555555, 0x555555);
    gridHelper2.position.y = -2;
    gridHelper2.position.z = -50 - gridSize;
    ground.add(gridHelper2);

    // Add a solid plane below to block background color
    const planeGeo = new THREE.PlaneGeometry(gridSize, gridSize * 2);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2.1;
    plane.position.z = -50 - gridSize / 2;
    ground.add(plane);

    scene.add(ground);
}

// Audio Context for Procedural Sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function createPlayer() {
    player = new THREE.Group();

    // 1. Main Fuselage (Central Body)
    // Use a simple elongated box or cone, but cleaner
    const bodyGeo = new THREE.BoxGeometry(1, 0.5, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.3, metalness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    player.add(body);

    // 2. Cockpit
    const cockpitGeo = new THREE.BoxGeometry(0.8, 0.4, 1.5);
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x00AAFF, roughness: 0.1, metalness: 0.9, emissive: 0x001133 });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.3, -0.5);
    player.add(cockpit);

    // 3. Wings (Swept forward)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.5, -0.5); // Wing tip out
    wingShape.lineTo(2.5, 0.5);  // Wing tip forward
    wingShape.lineTo(0.5, 0.5);  // Back to body

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: false });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.rotation.x = -Math.PI / 2;
    leftWing.position.set(0.5, 0, 1);
    player.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.rotation.x = -Math.PI / 2;
    rightWing.rotation.y = Math.PI; // Mirror
    rightWing.position.set(-0.5, 0, 1); // Adjust position for mirror
    player.add(rightWing);

    // 4. Engines (Cylinders)
    const engineGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 16);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const engineGlowMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF });

    // Left Engine
    const lEng = new THREE.Mesh(engineGeo, engineMat);
    lEng.rotation.x = Math.PI / 2;
    lEng.position.set(1.0, 0, 1.5);
    player.add(lEng);

    const lGlow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), engineGlowMat);
    lGlow.rotation.x = Math.PI; // Face back
    lGlow.position.set(0, -1.01, 0); // End of cylinder
    lEng.add(lGlow);

    // Right Engine
    const rEng = new THREE.Mesh(engineGeo, engineMat);
    rEng.rotation.x = Math.PI / 2;
    rEng.position.set(-1.0, 0, 1.5);
    player.add(rEng);

    const rGlow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), engineGlowMat);
    rGlow.rotation.x = Math.PI;
    rGlow.position.set(0, -1.01, 0);
    rEng.add(rGlow);

    scene.add(player);
}


function shoot() {
    if (isGameOver) return;
    const now = Date.now();
    if (now - lastShotTime < 150) return;
    lastShotTime = now;

    // Procedural Sound
    playShootSound();

    // Dual Lasers
    createLaser(player.position.x - 1.0, player.position.y, player.position.z - 1);
    createLaser(player.position.x + 1.5, player.position.y, player.position.z - 1);
}

function createLaser(x, y, z) {
    const bullet = new THREE.Mesh(resources.laserGeo, resources.laserMat);
    bullet.position.set(x, y, z);
    scene.add(bullet);
    bullets.push(bullet);
}



function spawnEnemy() {
    // Increased spawn rate
    if (Math.random() > 0.025 * spawnRateMultiplier) return;

    let geometry, material;
    const type = Math.floor(Math.random() * 5); // More types

    if (type === 0) {
        geometry = resources.enemyPyramidGeo;
        material = resources.enemyPyramidMat;
    } else if (type === 1) {
        geometry = resources.enemyBoxGeo;
        material = resources.enemyBoxMat;
    } else if (type === 2) {
        geometry = resources.enemySpinnerGeo;
        material = resources.enemySpinnerMat;
    } else if (type === 3) {
        // Hunter (Fast)
        geometry = resources.enemyHunterGeo;
        material = resources.enemyHunterMat;
    } else {
        // Carrier (Big)
        geometry = resources.enemyCarrierGeo;
        material = resources.enemyCarrierMat;
    }

    const enemy = new THREE.Mesh(geometry, material);
    enemy.castShadow = true;
    enemy.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 30,
        -200
    );

    // Movement Stats
    enemy.userData = {
        type: type,
        lastShot: 0,
        swaySpeed: Math.random() * 0.05 + 0.01,
        swayAmp: Math.random() * 10 + 5,
        swayOffset: Math.random() * Math.PI * 2,
        speedMult: type === 3 ? 1.5 : (type === 4 ? 0.6 : 1.0) // Hunter fast, Carrier slow
    };

    if (type === 3) enemy.rotation.x = -Math.PI / 2; // Point hunter forward

    scene.add(enemy);
    enemies.push(enemy);
}

function enemyShoot(enemy) {
    const now = Date.now();
    if (now - enemy.userData.lastShot < 2000) return; // Fire rate
    enemy.userData.lastShot = now;

    const bullet = new THREE.Mesh(resources.enemyBulletGeo, resources.enemyBulletMat);
    bullet.position.copy(enemy.position);

    // Calculate direction to player
    const direction = new THREE.Vector3();
    direction.subVectors(player.position, enemy.position).normalize();
    bullet.userData = { velocity: direction.multiplyScalar(0.8) }; // Bullet speed

    scene.add(bullet);
    enemyBullets.push(bullet);
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.position.add(b.userData.velocity);

        // Collision with Player
        if (b.position.distanceTo(player.position) < 1.5) {
            gameOver();
        }

        if (b.position.z > 10 || b.position.y < -20 || b.position.y > 20 || b.position.x < -40 || b.position.x > 40) {
            scene.remove(b);
            enemyBullets.splice(i, 1);
        }
    }
}

// Add Environmental Objects (Arches/Pillars)
function spawnScenery() {
    if (Math.random() > 0.015 * spawnRateMultiplier) return;

    const type = Math.floor(Math.random() * 5); // Increased types
    const group = new THREE.Group();

    if (type === 0) {
        // Arch (Existing)
        const leftCol = new THREE.Mesh(resources.archColGeo, resources.archColMat);
        leftCol.position.set(-10, 10, 0);
        leftCol.castShadow = true;
        group.add(leftCol);
        const rightCol = new THREE.Mesh(resources.archColGeo, resources.archColMat);
        rightCol.position.set(10, 10, 0);
        rightCol.castShadow = true;
        group.add(rightCol);
        const top = new THREE.Mesh(resources.archTopGeo, resources.archColMat);
        top.position.set(0, 18, 0);
        top.castShadow = true;
        group.add(top);
        group.position.set((Math.random() - 0.5) * 40, -5, -200);
    } else if (type === 1) {
        // Pillar (Existing)
        const pillar = new THREE.Mesh(resources.pillarGeo, resources.pillarMat);
        pillar.position.set(0, 10, 0);
        pillar.castShadow = true;
        group.add(pillar);
        group.position.set((Math.random() - 0.5) * 80, -5, -200);
    } else if (type === 2) {
        // Bar (Existing)
        const bar = new THREE.Mesh(resources.barGeo, resources.barMat);
        bar.position.set(0, 0, 0);
        bar.castShadow = true;
        group.add(bar);
        const height = Math.random() > 0.5 ? 0 : 10;
        group.position.set(0, height, -200);
    } else if (type === 3) {
        // NEW: Hex Gate (Fly through)
        const gate = new THREE.Mesh(resources.hexGateGeo, resources.hexGateMat);
        gate.rotation.z = Math.PI / 6; // Point up
        gate.castShadow = true;
        group.add(gate);
        group.position.set(0, 5, -200); // Center path
    } else {
        // NEW: Floating Tech Blocks
        const block = new THREE.Mesh(resources.floatBlockGeo, resources.floatBlockMat);
        block.rotation.x = Math.random();
        block.rotation.y = Math.random();
        group.add(block);
        group.userData = { rotate: true }; // Flag to rotate in update
        group.position.set((Math.random() - 0.5) * 60, Math.random() * 15, -200);
    }

    scene.add(group);
    scenery.push(group);
}

function updateScenery() {
    spawnScenery();
    for (let i = scenery.length - 1; i >= 0; i--) {
        const s = scenery[i];
        s.position.z += 1.0 * gameSpeed;

        if (s.userData.rotate) {
            s.children[0].rotation.x += 0.01;
            s.children[0].rotation.y += 0.01;
        }

        // Collision
        s.children.forEach(child => {
            const childPos = new THREE.Vector3();
            child.getWorldPosition(childPos);

            let hitDist = 3;
            if (s.children.length === 1 && s.children[0].geometry === resources.barGeo) hitDist = 2;
            if (s.children.length === 1 && s.children[0].geometry === resources.hexGateGeo) {
                // Gate logic: collision only if hitting the ring, not center
                // Simple check: if close to Z but far from center XY -> hit
                // For now, let's just make it a visual pass-through or strict collision
                // Let's make it strict: don't hit the ring
                const dist = player.position.distanceTo(childPos);
                if (dist < 9 && dist > 6) { // Hit the ring
                    gameOver();
                }
                return; // Skip standard check
            }

            if (player.position.distanceTo(childPos) < hitDist + 1) {
                gameOver();
            }
        });

        if (s.position.z > 20) {
            scene.remove(s);
            scenery.splice(i, 1);
        }
    }
}



function updatePlayer() {
    // Bot Logic
    if (botMode) {
        // Simple AI: Find nearest threat and move away
        let nearestDist = 100;
        let threat = null;

        // Check Enemies
        enemies.forEach(e => {
            if (e.position.z > -60 && e.position.z < player.position.z) { // Incoming
                const dist = e.position.distanceTo(player.position);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    threat = e;
                }
            }
        });

        // Check Scenery
        scenery.forEach(s => {
            s.children.forEach(child => {
                const childPos = new THREE.Vector3();
                child.getWorldPosition(childPos);
                if (childPos.z > -60 && childPos.z < player.position.z) {
                    const dist = childPos.distanceTo(player.position);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        threat = { position: childPos }; // Mock threat object
                    }
                }
            });
        });

        // Avoidance
        if (threat) {
            // Move in opposite direction of threat in XY plane
            const dx = player.position.x - threat.position.x;
            const dy = player.position.y - threat.position.y;

            // Normalize and apply speed
            if (Math.abs(dx) < 10) botTargetX += Math.sign(dx) * 0.5;
            if (Math.abs(dy) < 10) botTargetY += Math.sign(dy) * 0.5;
        } else {
            // Return to center if safe
            botTargetX *= 0.95;
            botTargetY *= 0.95;
        }

        // Clamp Targets
        botTargetX = Math.max(-14, Math.min(14, botTargetX));
        botTargetY = Math.max(-6, Math.min(10, botTargetY));

        // Apply Movement
        player.position.x += (botTargetX - player.position.x) * 0.1;
        player.position.y += (botTargetY - player.position.y) * 0.1;

        // Auto Shoot
        shoot();

    } else {
        // Manual Control
        let moveX = 0;
        let moveY = 0;

        if (keys.ArrowLeft) moveX = -1;
        if (keys.ArrowRight) moveX = 1;
        if (keys.ArrowUp) moveY = 1;
        if (keys.ArrowDown) moveY = -1;

        // ORPHE CORE Control (Additive)
        if (coreEuler) {
            const rollInput = Math.max(-orpheTiltLimit, Math.min(orpheTiltLimit, coreEuler.roll));
            const pitchInput = Math.max(-orpheTiltLimit, Math.min(orpheTiltLimit, coreEuler.pitch));
            moveX += rollInput * -orpheTiltGain;
            moveY += pitchInput * orpheTiltGain;
        }

        // Apply Movement (Reduced speed to 0.375)
        player.position.x += moveX * 0.375 * playerSensitivity;
        player.position.y += moveY * 0.375 * playerSensitivity;
    }

    // Boundaries
    if (player.position.x < -15) player.position.x = -15;
    if (player.position.x > 15) player.position.x = 15;
    if (player.position.y < -7) player.position.y = -7;
    if (player.position.y > 11) player.position.y = 11;

    // Bank angle based on movement
    player.rotation.z = -player.position.x * 0.05;
    player.rotation.x = player.position.y * 0.05;
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.position.z -= 4; // Fast lasers

        if (b.position.z < -200) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }
}

function updateEnemies() {
    spawnEnemy();

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.position.z += 0.8 * gameSpeed * (e.userData.speedMult || 1.0);

        // Complex Movement
        if (e.position.z > -150 && e.position.z < -10) {
            // Standard Sway
            e.position.x += Math.sin(Date.now() * e.userData.swaySpeed + e.userData.swayOffset) * e.userData.swayAmp * 0.01;

            // Type 5 (Orbital) Special Movement: Spiral
            if (e.userData.type === 5) {
                e.position.y += Math.cos(Date.now() * 0.003) * 0.2;
                e.userData.ring.rotation.x += 0.05;
                e.userData.ring.rotation.y += 0.02;
            } else {
                // Tracking for others
                if (e.position.y < player.position.y) e.position.y += 0.03;
                if (e.position.y > player.position.y) e.position.y -= 0.03;
            }

            // Disable Shooting (Remove "Red Ball" bullets)
            // if (Math.random() < shootChance) enemyShoot(e);
        }

        if (e.userData.type !== 3 && e.userData.type !== 5) {
            e.rotation.x += 0.02;
            e.rotation.y += 0.02;
        } else if (e.userData.type === 3) {
            // Hunter banks
            e.rotation.z = Math.sin(Date.now() * 0.005) * 0.5;
        } else if (e.userData.type === 5) {
            e.rotation.z += 0.01;
        }

        // Collision
        const hitRadius = e.userData.type === 4 ? 6 : (e.userData.type === 5 ? 5 : 4); // Bigger hit box for Carrier, Orbital
        if (player.position.distanceTo(e.position) < hitRadius) {
            gameOver();
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (b.position.distanceTo(e.position) < hitRadius) {
                createExplosion(e.position);

                // Play Explosion Sound (Existing)
                if (window.explosionSound) explosionSound.cloneNode().play().catch(() => { });

                scene.remove(e);
                enemies.splice(i, 1);
                scene.remove(b);
                bullets.splice(j, 1);

                // Score based on type
                const points = e.userData.type === 4 ? 1000 : (e.userData.type === 5 ? 800 : (e.userData.type === 3 ? 300 : 100));
                score += points;
                document.getElementById('score').innerText = `SCORE: ${score}`;
                break;
            }
        }

        if (e.position.z > 20) {
            scene.remove(e);
            enemies.splice(i, 1);
        }
    }
}

function createExplosion(pos) {
    const particleCount = 15;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        positions.push(pos.x, pos.y, pos.z);
        velocities.push(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xFF8800, size: 0.8 });
    const p = new THREE.Points(geometry, material);
    p.userData = { velocities: velocities, age: 0 };
    scene.add(p);
    particles.push(p);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const positions = p.geometry.attributes.position.array;
        const v = p.userData.velocities;

        for (let j = 0; j < v.length / 3; j++) {
            positions[j * 3] += v[j * 3];
            positions[j * 3 + 1] += v[j * 3 + 1];
            positions[j * 3 + 2] += v[j * 3 + 2];
        }
        p.geometry.attributes.position.needsUpdate = true;
        p.userData.age++;

        if (p.userData.age > 40) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}

function updateEnvironment() {
    // Scroll ground
    const speed = 1.0 * gameSpeed;
    ground.children.forEach(child => {
        child.position.z += speed;
    });

    // Loop ground
    // We have two grid helpers at -50 and -250 (size 200)
    // If one passes camera (z > 50?), move it back
    ground.children.forEach(child => {
        if (child.position.z > 150) {
            child.position.z -= 400; // Move back 2 * size
        }
    });
}

function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    bgm.pause();

    // Show Game Over Screen
    const screen = document.getElementById('game-over-screen');
    const finalScore = document.getElementById('final-score');
    finalScore.innerText = `SCORE: ${score}`;
    screen.style.display = 'flex';
}

function resetGame() {
    clearSceneObjects(bullets);
    clearSceneObjects(enemyBullets);
    clearSceneObjects(enemies);
    clearSceneObjects(particles);
    clearSceneObjects(scenery);

    if (player) {
        scene.remove(player);
    }
    if (ground) {
        scene.remove(ground);
    }

    score = 0;
    isGameOver = false;
    lastShotTime = 0;
    botTargetX = 0;
    botTargetY = 0;
    coreEuler = { pitch: 0, roll: 0, yaw: 0 };
    coreNeutralEuler = null;

    document.getElementById('score').innerText = 'SCORE: 0';
    document.getElementById('final-score').innerText = 'SCORE: 0';
    document.getElementById('game-over-screen').style.display = 'none';

    camera.position.set(0, 3, 8);
    createGround();
    createPlayer();

    bgm.currentTime = 0;
    bgm.play().catch(() => { });
}

function clearSceneObjects(objects) {
    for (const object of objects) {
        scene.remove(object);
    }
    objects.length = 0;
}

function animate() {
    requestAnimationFrame(animate);

    if (!isGameOver) {
        updatePlayer();
        updateBullets();
        updateEnemies();
        updateEnemyBullets();
        updateScenery();
        updateEnvironment();
        updateParticles();

        // Survival Score
        score++;
        if (score % 10 === 0) {
            document.getElementById('score').innerText = `SCORE: ${score}`;
        }

        // Camera follow slightly
        camera.position.x += (player.position.x * 0.3 - camera.position.x) * 0.1;
        camera.position.y += (player.position.y * 0.3 + 3 - camera.position.y) * 0.1;
        camera.lookAt(player.position.x * 0.1, player.position.y * 0.1, -20);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
