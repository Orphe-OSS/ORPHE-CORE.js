(function () {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const USED_SAMPLE_NUMBERS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12,
    49, 51, 53, 54, 56, 57, 58, 59, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
    72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 84, 85, 87, 89, 92, 93, 94
  ];

  const SCENE_THRESHOLDS = [
    { step: 0, scene: 1 },
    { step: 8, scene: 2 },
    { step: 16, scene: 3 },
    { step: 24, scene: 4 },
    { step: 32, scene: 5 },
    { step: 40, scene: 6 },
    { step: 48, scene: 7 },
    { step: 56, scene: 8 },
    { step: 64, scene: 9 },
    { step: 72, scene: 10 }
  ];
  const MAX_STEP_PROGRESS = 80;
  const STEP_DECAY_DELAY_MS = 2600;
  const STEP_DECAY_PER_SECOND = 2.0;
  const AIR_KICK_WINDOW_MS = 480;
  const AIR_KICK_GAIT_QUIET_MS = 650;
  const AIR_KICK_COOLDOWN_MS = 520;
  const AIR_KICK_MIN_SAMPLES = 4;

  const SCENE_META = {
    1: { label: 'Scene 1', type: 'scale', noteCount: 3 },
    2: { label: 'Scene 2', type: 'scale', noteCount: 6 },
    3: { label: 'Scene 3', type: 'scale', noteCount: 6 },
    4: { label: 'Scene 4', type: 'scale', noteCount: 6 },
    5: { label: 'Scene 5', type: 'scale', noteCount: 4 },
    6: { label: 'Scene 6', type: 'scale', noteCount: 6 },
    7: { label: 'Scene 7', type: 'scale', noteCount: 8 },
    8: { label: 'Scene 8', type: 'scale', noteCount: 10 },
    9: { label: 'Scene 9', type: 'arpeggio' },
    10: { label: 'Scene 10', type: 'hybrid' }
  };

  const ARPEGGIO_PROFILES = ['rise', 'fall', 'wave', 'wide'];
  const SCENE_ARPEGGIOS = {
    1: {
      left: arpeggios(
        [69, 71, 74, 76, 69, 71, 74, 76],
        [76, 74, 71, 69, 76, 74, 71, 69],
        [69, 74, 71, 76, 69, 74, 71, 76],
        [69, 76, 71, 74, 69, 76, 71, 74]
      ),
      right: arpeggios(
        [74, 76, 79, 81, 74, 76, 79, 81],
        [81, 79, 76, 74, 81, 79, 76, 74],
        [74, 79, 76, 81, 74, 79, 76, 81],
        [74, 81, 76, 79, 74, 81, 76, 79]
      )
    },
    2: {
      left: arpeggios(
        [69, 71, 74, 76, 79, 81, 76, 74],
        [81, 79, 76, 74, 71, 69, 74, 76],
        [69, 74, 79, 76, 71, 76, 81, 79],
        [69, 76, 81, 74, 71, 79, 76, 74]
      ),
      right: arpeggios(
        [71, 74, 76, 79, 81, 79, 76, 74],
        [81, 79, 76, 74, 71, 74, 76, 79],
        [71, 76, 81, 79, 74, 79, 76, 74],
        [71, 79, 74, 81, 76, 79, 74, 76]
      )
    },
    3: {
      left: arpeggios(
        [65, 69, 72, 74, 76, 79, 76, 72],
        [79, 76, 74, 72, 69, 65, 72, 76],
        [65, 72, 76, 74, 69, 74, 79, 76],
        [65, 74, 79, 72, 69, 76, 74, 72]
      ),
      right: arpeggios(
        [69, 71, 74, 76, 79, 81, 79, 76],
        [81, 79, 76, 74, 71, 69, 74, 79],
        [69, 74, 79, 81, 76, 71, 76, 79],
        [69, 76, 81, 74, 71, 79, 76, 74]
      )
    },
    4: {
      left: arpeggios(
        [63, 68, 70, 72, 75, 79, 75, 70],
        [79, 75, 72, 70, 68, 63, 70, 75],
        [63, 70, 75, 72, 68, 72, 79, 75],
        [63, 72, 79, 70, 68, 75, 72, 70]
      ),
      right: arpeggios(
        [65, 69, 72, 74, 76, 79, 76, 72],
        [79, 76, 74, 72, 69, 65, 72, 76],
        [65, 72, 76, 79, 74, 69, 74, 76],
        [65, 74, 79, 72, 69, 76, 74, 72]
      )
    },
    5: {
      left: arpeggios(
        [69, 74, 76, 81, 76, 74, 69, 76],
        [81, 76, 74, 69, 74, 76, 81, 76],
        [69, 76, 81, 74, 76, 69, 74, 81],
        [69, 81, 74, 76, 69, 81, 76, 74]
      ),
      right: arpeggios(
        [63, 68, 70, 72, 75, 79, 75, 70],
        [79, 75, 72, 70, 68, 63, 70, 75],
        [63, 70, 75, 79, 72, 68, 72, 75],
        [63, 72, 79, 70, 68, 75, 72, 70]
      )
    },
    6: {
      left: arpeggios(
        [58, 61, 65, 68, 73, 75, 80, 75],
        [80, 75, 73, 68, 65, 61, 58, 68],
        [58, 68, 73, 80, 75, 65, 61, 73],
        [58, 73, 80, 61, 68, 75, 65, 80]
      ),
      right: arpeggios(
        [59, 63, 68, 73, 75, 77, 80, 77],
        [80, 77, 75, 73, 68, 63, 59, 73],
        [59, 68, 75, 80, 77, 73, 63, 75],
        [59, 75, 80, 63, 68, 77, 73, 80]
      )
    },
    7: {
      left: arpeggios(
        [56, 66, 70, 77, 80, 85, 87, 89],
        [89, 87, 85, 80, 77, 70, 66, 56],
        [56, 70, 80, 87, 85, 77, 66, 89],
        [56, 77, 89, 66, 80, 87, 70, 85]
      ),
      right: arpeggios(
        [56, 66, 70, 77, 80, 85, 87, 89],
        [89, 87, 85, 80, 77, 70, 66, 56],
        [56, 70, 80, 89, 87, 77, 66, 85],
        [56, 80, 89, 66, 77, 87, 70, 85]
      )
    },
    8: {
      left: arpeggios(
        [66, 73, 75, 77, 80, 85, 87, 94],
        [94, 87, 85, 80, 77, 75, 73, 66],
        [66, 75, 80, 87, 94, 85, 77, 73],
        [66, 80, 94, 73, 85, 75, 87, 77]
      ),
      right: arpeggios(
        [68, 70, 75, 80, 82, 87, 92, 94],
        [94, 92, 87, 82, 80, 75, 70, 68],
        [68, 75, 82, 92, 94, 87, 80, 70],
        [68, 82, 94, 70, 87, 75, 92, 80]
      )
    },
    9: {
      left: arpeggios(
        [49, 56, 61, 68, 73, 80, 87, 92],
        [92, 87, 80, 73, 68, 61, 56, 49],
        [49, 61, 73, 87, 92, 80, 68, 56],
        [49, 73, 92, 56, 80, 61, 87, 68]
      ),
      right: arpeggios(
        [51, 58, 63, 70, 75, 82, 89, 94],
        [94, 89, 82, 75, 70, 63, 58, 51],
        [51, 63, 75, 89, 94, 82, 70, 58],
        [51, 75, 94, 58, 82, 63, 89, 70]
      )
    }
  };

  const SCENE8_SEQUENCE = {
    1: 1,
    5: 2,
    9: 3,
    13: 2
  };
  const MONET_HUES = [118, 143, 176, 205, 232, 264, 292, 322, 38, 58];
  const STEP_POSITION_HUE_SHIFT = {
    TOE: -18,
    FLAT: 0,
    HEEL: 20
  };

  const canvas = document.getElementById('pianoCanvas');
  const ctx = canvas.getContext('2d');
  const sceneSelect = document.getElementById('sceneSelect');
  const soundToggle = document.getElementById('soundToggle');
  const soundToggleLabel = soundToggle.querySelector('span');
  const volumeRange = document.getElementById('volumeRange');
  const sustainRange = document.getElementById('sustainRange');
  const sensitivityRange = document.getElementById('sensitivityRange');
  const keyboardNotes = document.getElementById('keyboardNotes');
  const sceneReadout = document.getElementById('sceneReadout');
  const sampleStatus = document.getElementById('sampleStatus');
  const stepReadout = document.getElementById('stepReadout');
  const sceneMeterFill = document.getElementById('sceneMeterFill');
  const sceneMeterLabel = document.getElementById('sceneMeterLabel');
  const sceneDecayStatus = document.getElementById('sceneDecayStatus');
  const readouts = [0, 1].map((id) => ({
    note: document.getElementById(`note${id}`),
    motion: document.getElementById(`motion${id}`)
  }));

  const footState = [0, 1].map((id) => ({
    id,
    side: id === 0 ? 'L' : 'R',
    x: id === 0 ? 0.43 : 0.57,
    y: 0.55,
    targetX: id === 0 ? 0.43 : 0.57,
    targetY: 0.55,
    hue: id === 0 ? 135 : 284,
    euler: { roll: 0, pitch: 0, yaw: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    convertedGyro: { x: 0, y: 0, z: 0 },
    acc: { x: 0, y: 0, z: 0 },
    hasConvertedAcc: false,
    previousAccMagnitude: 1,
    landingImpact: 0,
    power: 0,
    mag: 0,
    lastTriggerAt: 0,
    lastMotionAt: 0,
    lastKickAt: 0,
    lastAnalysisAt: 0,
    airKickWindowStart: 0,
    airKickEnergy: 0,
    airKickSamples: 0,
    lastStepValue: 0,
    lastGaitStep: 0,
    lastNoteNumber: null,
    lastArpeggioStep: -1,
    lastArpeggioProfile: -1,
    stepPosition: 'FLAT',
    footAngle: 0,
    note: null,
    noteIndex: 0,
    sample: null,
    active: false,
    connected: false,
    movement: 0,
    rings: []
  }));

  const visualEvents = [];
  let animationFrame = 0;
  let stepProgress = 0;
  let lastStepAt = performance.now();
  let progressDirection = 'idle';
  let scene8Counter = 0;
  let lastScene = 1;
  let lastKeyboardSignature = '';
  let sceneHasBeenRendered = false;
  const jumpState = { lastAt: 0, lastChoice: 0, score: 0 };

  class SamplePianoEngine {
    constructor() {
      this.audioContext = null;
      this.master = null;
      this.delayInput = null;
      this.buffers = new Map();
      this.loadingPromise = null;
      this.enabled = false;
      this.volume = 0.78;
      this.fade = 1;
      this.lastSampleAt = new Map();
      this.granularLastAt = 0;
    }

    ensure() {
      if (this.audioContext) return this.audioContext;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;

      const audioContext = new AudioContextClass();
      this.audioContext = audioContext;
      this.master = audioContext.createGain();
      this.delayInput = audioContext.createGain();
      this.delayInput.gain.value = 1;

      [
        { time: 0.150, gain: 0.32 },
        { time: 0.300, gain: 0.24 },
        { time: 0.375, gain: 0.18 }
      ].forEach((tap) => {
        const delay = audioContext.createDelay(0.8);
        const gain = audioContext.createGain();
        delay.delayTime.value = tap.time;
        gain.gain.value = tap.gain * 1.2;
        this.delayInput.connect(delay);
        delay.connect(gain);
        gain.connect(this.master);
      });

      this.master.connect(audioContext.destination);
      this.applyMasterGain(0);
      return audioContext;
    }

    async enable() {
      const audioContext = this.ensure();
      if (!audioContext) {
        this.enabled = false;
        sampleStatus.textContent = 'Web Audio unavailable';
        soundToggle.title = 'Web Audio is not available in this browser';
        return false;
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      this.enabled = true;
      soundToggle.classList.add('is-active');
      soundToggle.title = 'Disable sound';
      soundToggleLabel.textContent = 'Sound Off';
      await this.loadSamples();
      this.fadeTo(1, 3);
      return true;
    }

    disable() {
      this.enabled = false;
      this.fadeTo(0, 0.35);
      soundToggle.classList.remove('is-active');
      soundToggle.title = 'Enable sound';
      soundToggleLabel.textContent = 'Sound On';
    }

    async toggle() {
      if (this.enabled) {
        this.disable();
        return false;
      }
      return this.enable();
    }

    async loadSamples() {
      if (this.loadingPromise) return this.loadingPromise;
      const audioContext = this.ensure();
      if (!audioContext) return Promise.resolve();

      sampleStatus.textContent = `loading ${USED_SAMPLE_NUMBERS.length} samples`;
      this.loadingPromise = Promise.all(USED_SAMPLE_NUMBERS.map(async (number) => {
        const response = await fetch(`./allpiano/piano${number}.wav`);
        if (!response.ok) {
          throw new Error(`piano${number}.wav ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        this.buffers.set(number, audioBuffer);
      })).then(() => {
        sampleStatus.textContent = `${this.buffers.size} allpiano samples loaded`;
      }).catch((error) => {
        sampleStatus.textContent = `sample load failed: ${error.message}`;
        throw error;
      });
      return this.loadingPromise;
    }

    setVolume(value) {
      this.volume = value;
      this.applyMasterGain(0.02);
    }

    fadeTo(value, seconds) {
      this.fade = clamp(value, 0, 1);
      this.applyMasterGain(seconds);
    }

    applyMasterGain(seconds) {
      if (!this.master || !this.audioContext) return;
      const now = this.audioContext.currentTime;
      const gain = this.volume * this.fade * 0.82;
      this.master.gain.cancelScheduledValues(now);
      if (seconds <= 0) {
        this.master.gain.setValueAtTime(gain, now);
      } else {
        this.master.gain.setTargetAtTime(gain, now, Math.max(0.01, seconds / 3));
      }
    }

    playSample(number, options = {}) {
      if (!this.enabled) return false;
      const audioContext = this.ensure();
      const buffer = this.buffers.get(number);
      if (!audioContext || !buffer) return false;

      const now = audioContext.currentTime;
      const lastAt = this.lastSampleAt.get(number) || -Infinity;
      if (now - lastAt < 0.05 && !options.force) return false;
      this.lastSampleAt.set(number, now);

      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      const panner = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;
      const send = audioContext.createGain();
      const sustain = Number(sustainRange.value) / 100;
      const duration = buffer.duration * (0.72 + sustain * 0.35);
      const peak = clamp(options.gain == null ? 0.72 : options.gain, 0, 1.4);

      source.buffer = buffer;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.006);
      gain.gain.setTargetAtTime(0.0001, now + Math.max(0.08, duration * 0.46), Math.max(0.08, duration * 0.35));

      send.gain.value = clamp(options.delaySend || 0, 0, 1);
      source.connect(gain);
      gain.connect(send);
      send.connect(this.delayInput);

      if (panner) {
        panner.pan.value = clamp(options.pan || 0, -1, 1);
        gain.connect(panner);
        panner.connect(this.master);
      } else {
        gain.connect(this.master);
      }

      source.start(now);
      source.stop(now + duration + 0.08);
      return true;
    }

    triggerGranular(power, offsetControl, lengthControl, panControl) {
      if (!this.enabled) return false;
      const audioContext = this.ensure();
      const buffer = this.buffers.get(7);
      if (!audioContext || !buffer) return false;

      const now = audioContext.currentTime;
      if (now - this.granularLastAt < 3) return false;
      this.granularLastAt = now;

      const clampedPower = clamp(power, 0.3, 1.6);
      const offsetBase = clamp((offsetControl + 1) / 2, 0, 1) * Math.max(0, buffer.duration - 0.18);
      const grainLength = 0.035 + clamp((lengthControl + 1) / 2, 0, 1) * 0.14;
      const burstDuration = 2.85;
      const interval = 0.045;
      const count = Math.floor(burstDuration / interval);

      for (let i = 0; i < count; i += 1) {
        const t = now + i * interval;
        const progress = i / Math.max(1, count - 1);
        const source = audioContext.createBufferSource();
        const gain = audioContext.createGain();
        const panner = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;
        const jitter = (Math.random() - 0.5) * 0.08;
        const offset = clamp(offsetBase + Math.sin(progress * Math.PI * 4) * 0.1 + jitter, 0, Math.max(0, buffer.duration - grainLength));
        const envelope = Math.sin(progress * Math.PI);

        source.buffer = buffer;
        source.playbackRate.value = 0.85 + progress * 0.25;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.08 * clampedPower * Math.max(0.15, envelope), t + grainLength * 0.35);
        gain.gain.linearRampToValueAtTime(0.0001, t + grainLength);

        source.connect(gain);
        if (panner) {
          panner.pan.value = clamp(panControl, -0.85, 0.85);
          gain.connect(panner);
          panner.connect(this.master);
        } else {
          gain.connect(this.master);
        }
        source.start(t, offset, grainLength);
      }

      return true;
    }
  }

  const piano = new SamplePianoEngine();

  function arpeggios(rise, fall, wave, wide) {
    return [rise, fall, wave, wide].map((variant) => variant.slice(0, 8));
  }

  function midiName(midi) {
    if (!midi) return '--';
    return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function wrapHue(hue) {
    return ((hue % 360) + 360) % 360;
  }

  function mixHue(from, to, amount) {
    const delta = ((((to - from) % 360) + 540) % 360) - 180;
    return wrapHue(from + delta * clamp(amount, 0, 1));
  }

  function vectorFrom(input) {
    const source = input || {};
    return {
      x: Number(source.x || source.roll || source[0] || 0),
      y: Number(source.y || source.pitch || source[1] || 0),
      z: Number(source.z || source.yaw || source[2] || 0)
    };
  }

  function eulerFrom(input) {
    const source = input || {};
    return {
      roll: Number(source.roll || source.x || source[0] || 0),
      pitch: Number(source.pitch || source.y || source[1] || 0),
      yaw: Number(source.yaw || source.z || source[2] || 0)
    };
  }

  function magnitude(vector) {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  }

  function sceneRichness(scene = getActiveScene()) {
    return clamp((scene - 1) / 9, 0, 1);
  }

  function classifyStepPosition(state) {
    const pitch = state.euler.pitch || 0;
    const footAngle = Number(state.footAngle || 0);
    const classifierValue = Math.abs(footAngle) > 1 ? footAngle * 0.01745 : pitch;
    if (classifierValue > 0.18) return 'HEEL';
    if (classifierValue < -0.18) return 'TOE';
    return 'FLAT';
  }

  function colorForSound(state, sampleNumber, noteIndex, options = {}) {
    const scene = getActiveScene();
    const richness = sceneRichness(scene);
    const pitchClass = Number.isFinite(sampleNumber) && sampleNumber > 0 ? sampleNumber % 12 : noteIndex || 0;
    const baseHue = state.id === 0 ? 134 : 284;
    const noteHue = MONET_HUES[(pitchClass + scene + state.id * 3) % MONET_HUES.length];
    const position = options.position || state.stepPosition || 'FLAT';
    const positionShift = STEP_POSITION_HUE_SHIFT[position] || 0;
    const lowSceneHue = wrapHue(baseHue + (pitchClass - 6) * 3.8 + positionShift * 0.55);
    const hue = mixHue(lowSceneHue, noteHue + positionShift, 0.22 + richness * 0.72);
    const secondaryHue = mixHue(hue, MONET_HUES[(pitchClass + scene + 4) % MONET_HUES.length], 0.42 + richness * 0.36);
    const tertiaryHue = mixHue(secondaryHue, MONET_HUES[(pitchClass + scene + 7) % MONET_HUES.length], 0.55);
    return {
      hue,
      secondaryHue,
      tertiaryHue,
      richness,
      position
    };
  }

  function getActiveScene() {
    if (sceneSelect.value !== 'auto') return Number(sceneSelect.value);
    let scene = 1;
    SCENE_THRESHOLDS.forEach((threshold) => {
      if (stepProgress >= threshold.step) scene = threshold.scene;
    });
    return scene;
  }

  function getSceneBounds(scene) {
    const current = SCENE_THRESHOLDS.find((threshold) => threshold.scene === scene) || SCENE_THRESHOLDS[0];
    const next = SCENE_THRESHOLDS.find((threshold) => threshold.scene === scene + 1);
    return {
      start: current.step,
      end: next ? next.step : MAX_STEP_PROGRESS
    };
  }

  function getProgressInfo(scene) {
    const bounds = getSceneBounds(scene);
    const span = Math.max(1, bounds.end - bounds.start);
    const local = clamp(stepProgress - bounds.start, 0, span);
    return {
      bounds,
      local,
      span,
      ratio: clamp(local / span, 0, 1)
    };
  }

  function getArpeggioStep(scene) {
    if (sceneSelect.value !== 'auto') {
      return Math.floor(stepProgress) % 8;
    }
    const bounds = getSceneBounds(scene);
    const local = clamp(stepProgress - bounds.start, 0, 7.999);
    return clamp(Math.max(0, Math.ceil(local) - 1), 0, 7);
  }

  function getArpeggioProfileIndex(state) {
    const angle = clamp(state.euler.roll + state.euler.pitch * 0.35 + state.gyro.z * 0.08, -1, 1);
    if (angle < -0.35) return 0;
    if (angle < 0.05) return 1;
    if (angle < 0.45) return 2;
    return 3;
  }

  function getArpeggioPatterns(scene, sideId) {
    const sceneKey = scene === 10 ? 9 : scene;
    const sceneSet = SCENE_ARPEGGIOS[sceneKey] || SCENE_ARPEGGIOS[1];
    return (sideId === 0 ? sceneSet.left : sceneSet.right) || sceneSet.left;
  }

  function getSceneArpeggioSample(scene, state) {
    const patterns = getArpeggioPatterns(scene, state.id);
    const profileIndex = getArpeggioProfileIndex(state);
    const stepIndex = getArpeggioStep(scene);
    const pattern = patterns[profileIndex] || patterns[0];
    return {
      sampleNumber: pattern[stepIndex] || 0,
      profileIndex,
      profileName: ARPEGGIO_PROFILES[profileIndex] || 'rise',
      stepIndex
    };
  }

  function collectSceneSamples(scene) {
    const samples = [];
    [0, 1].forEach((sideId) => {
      getArpeggioPatterns(scene, sideId).forEach((pattern) => {
        pattern.forEach((sample) => {
          if (sample) samples.push(sample);
        });
      });
    });
    if (scene === 10) samples.push(7);
    return Array.from(new Set(samples)).sort((a, b) => a - b);
  }

  function panFromPdApproximation(state) {
    let leftGain;
    if (state.id === 0) {
      leftGain = clamp(state.acc.x * 0.5 + 0.8, 0, 1);
    } else {
      leftGain = clamp(0.4 - state.acc.x * 0.5, 0, 1);
    }
    return clamp(1 - leftGain * 2, -1, 1);
  }

  function getSensitivity() {
    return Number(sensitivityRange.value) / 100;
  }

  function isMotionGateOpen(state, reason) {
    if (reason === 'test' || reason === 'step' || reason === 'kick' || reason === 'air' || reason === 'landing') return true;
    const gyroEnergy = state.gyro.x * state.gyro.x + state.gyro.y * state.gyro.y;
    return gyroEnergy > 0.02;
  }

  function handleSceneProgressChange(previousScene, currentScene) {
    if (previousScene === currentScene) return;
    scene8Counter = 0;
    addVisualEvent(0, 0.7, 135, 'scene');
    addVisualEvent(1, 0.7, 284, 'scene');
  }

  function advanceGestureProgress() {
    const previousScene = getActiveScene();
    const wasAtStart = stepProgress <= 0;
    stepProgress = clamp(stepProgress + 1, 0, MAX_STEP_PROGRESS);
    lastStepAt = performance.now();
    progressDirection = 'charging';

    if (wasAtStart) {
      piano.fadeTo(1, 3);
    }

    handleSceneProgressChange(previousScene, getActiveScene());
    updateSceneUi();
  }

  function decayStepProgress(delta) {
    if (stepProgress <= 0) {
      if (progressDirection !== 'idle') {
        progressDirection = 'idle';
        piano.fadeTo(0, 2);
        updateSceneUi(true);
      }
      return;
    }

    const idleMs = performance.now() - lastStepAt;
    if (idleMs < STEP_DECAY_DELAY_MS) return;

    const previousScene = getActiveScene();
    stepProgress = clamp(stepProgress - STEP_DECAY_PER_SECOND * delta, 0, MAX_STEP_PROGRESS);
    progressDirection = stepProgress > 0 ? 'falling' : 'idle';
    handleSceneProgressChange(previousScene, getActiveScene());
    updateSceneUi(previousScene !== getActiveScene());
  }

  function updateReadout(id, motionLabel) {
    const state = footState[id];
    readouts[id].note.textContent = state.note == null ? (state.sample ? `piano${state.sample}` : '--') : midiName(state.note);
    readouts[id].motion.textContent = motionLabel;
  }

  function triggerLED(id, noteIndex) {
    const ble = window.bles && window.bles[id];
    if (!ble || typeof ble.setLED !== 'function') return;
    try {
      ble.setLED(1, 1 + (noteIndex % 4));
    } catch (error) {
      console.debug('LED update skipped:', error);
    }
  }

  function flashKeyboardBySample(sampleNumber) {
    const keys = keyboardNotes.querySelectorAll('.key');
    keys.forEach((key) => {
      key.classList.toggle('is-hot', Number(key.dataset.sample) === sampleNumber);
    });
    window.setTimeout(() => {
      keys.forEach((key) => key.classList.remove('is-hot'));
    }, 180);
  }

  function addRing(state, velocity, ringOptions = {}) {
    const options = typeof ringOptions === 'number' ? { hueOffset: ringOptions } : ringOptions;
    const color = colorForSound(
      state,
      options.sampleNumber ?? state.sample ?? state.note ?? 0,
      options.noteIndex ?? state.noteIndex ?? 0,
      options
    );
    state.active = true;
    state.hue = wrapHue(color.hue + velocity * 4 + (options.hueOffset || 0) * 0.18);
    state.stepPosition = color.position;
    state.rings.push({
      age: 0,
      life: 1.45 + Number(sustainRange.value) / 100 * (1.15 + color.richness * 1.2),
      velocity,
      hue: state.hue,
      secondaryHue: color.secondaryHue,
      tertiaryHue: color.tertiaryHue,
      richness: color.richness,
      position: color.position,
      phase: ((options.sampleNumber || 0) * 0.37 + state.id * 1.8) % (Math.PI * 2)
    });
  }

  function addVisualEvent(side, velocity, hue, type) {
    const state = footState[side];
    visualEvents.push({
      age: 0,
      life: type === 'granular' ? 3.2 : type === 'scene' ? 2.2 : 1.8,
      side,
      velocity,
      hue: hue || (side === 0 ? 135 : 284),
      x: state ? state.x : side === 0 ? 0.42 : 0.58,
      y: state ? state.y : 0.55,
      type: type || 'note'
    });
  }

  function triggerScaleNote(id, reason, power, kind) {
    const scene = getActiveScene();
    const state = footState[id];
    const now = performance.now();
    if (!SCENE_META[scene] || !['scale', 'arpeggio', 'hybrid'].includes(SCENE_META[scene].type)) return false;
    if (!isMotionGateOpen(state, reason)) return false;
    if (now - state.lastTriggerAt < 133 && reason !== 'test') return false;

    const arpeggio = getSceneArpeggioSample(scene, state);
    const sampleNumber = arpeggio.sampleNumber;
    if (!sampleNumber) {
      updateReadout(id, `${reason} rest`);
      return false;
    }

    if (
      sampleNumber === state.lastNoteNumber &&
      arpeggio.stepIndex === state.lastArpeggioStep &&
      arpeggio.profileIndex === state.lastArpeggioProfile &&
      reason !== 'test'
    ) {
      updateReadout(id, `${reason} same ${midiName(sampleNumber)}`);
      return false;
    }

    const velocity = clamp(0.36 + power * 0.62, 0.28, 1.15);
    const isKick = kind === 'KICK';
    const delaySend = isKick && sampleNumber >= 72 ? 0.75 : 0;
    const played = piano.playSample(sampleNumber, {
      side: id,
      gain: velocity,
      pan: panFromPdApproximation(state),
      delaySend,
      force: reason === 'test'
    });

    state.lastTriggerAt = now;
    state.lastNoteNumber = sampleNumber;
    state.lastArpeggioStep = arpeggio.stepIndex;
    state.lastArpeggioProfile = arpeggio.profileIndex;
    state.note = sampleNumber;
    state.noteIndex = arpeggio.stepIndex;
    state.sample = sampleNumber;
    addRing(state, velocity, {
      sampleNumber,
      noteIndex: arpeggio.stepIndex,
      position: state.stepPosition,
      hueOffset: isKick ? 30 : 0
    });
    triggerLED(id, arpeggio.stepIndex);
    flashKeyboardBySample(sampleNumber);
    const positionLabel = kind === 'STEP' ? ` ${state.stepPosition.toLowerCase()}` : '';
    updateReadout(id, `${kind.toLowerCase()}${positionLabel} ${arpeggio.profileName} ${arpeggio.stepIndex + 1}/8`);
    addVisualEvent(id, velocity, state.hue, isKick ? 'kick' : 'note');
    return played;
  }

  function triggerSampleEvent(sampleNumber, sideId, reason, gain, options = {}) {
    const state = footState[sideId];
    const velocity = clamp(gain == null ? 0.72 : gain, 0.2, 1.2);
    const played = piano.playSample(sampleNumber, {
      gain: velocity,
      pan: options.pan == null ? panFromPdApproximation(state) : options.pan,
      delaySend: options.delaySend || 0,
      force: options.force || reason === 'test'
    });

    state.note = sampleNumber >= 21 ? sampleNumber : null;
    state.sample = sampleNumber;
    addRing(state, velocity, {
      sampleNumber,
      noteIndex: sampleNumber % 10,
      position: options.position || state.stepPosition,
      hueOffset: options.hueOffset || 0
    });
    triggerLED(sideId, sampleNumber % 4);
    flashKeyboardBySample(sampleNumber);
    updateReadout(sideId, `${reason} piano${sampleNumber}`);
    addVisualEvent(sideId, velocity, state.hue, reason);
    return played;
  }

  function handleScene8Sequence(reason) {
    const scene = getActiveScene();
    if (scene !== 8) return;
    scene8Counter = (scene8Counter % 16) + 1;
    const sampleNumber = SCENE8_SEQUENCE[scene8Counter];
    if (sampleNumber) {
      triggerSampleEvent(sampleNumber, 0, 'accompany', 0.8, { force: reason === 'test', hueOffset: 24 });
      addVisualEvent(0, 0.95, footState[0].hue + 40, 'accompany');
    }
    if (scene8Counter === 16) {
      maybeTriggerJump(true);
    }
  }

  function convertGyroTo4Range(value) {
    const converted = Math.trunc(value * -80);
    if (converted > 38) return 5;
    if (converted > 20) return 4;
    if (converted > 8) return 3;
    if (converted > -8) return 2;
    return 1;
  }

  function maybeTriggerJump(force) {
    const now = performance.now();
    if (!force && now - jumpState.lastAt < 450) return false;

    const left = footState[0];
    const right = footState[1];
    const accScore = Math.max(0, (left.acc.z + right.acc.z) * 30);
    const gyroXScore = (Math.abs(left.gyro.x * -2) + Math.abs(right.gyro.x * -2)) * 50;
    const gyroZScore = (convertGyroTo4Range(left.gyro.z) + convertGyroTo4Range(right.gyro.z)) * 18;
    const landingScore = (left.landingImpact + right.landingImpact) * 25;
    const score = accScore + gyroXScore + gyroZScore + landingScore - 100;
    jumpState.score = score;

    if (!force && score <= 180) return false;

    const choice = force ? jumpState.lastChoice : Math.floor(Math.random() * 2);
    const sampleNumber = choice === 0 ? 11 : 12;
    jumpState.lastChoice = choice === 0 ? 1 : 0;
    jumpState.lastAt = now;

    const pan = clamp((left.mag - right.mag) / 2.5, -0.8, 0.8);
    triggerSampleEvent(sampleNumber, choice, 'jump', 0.96, { pan, delaySend: 0.25, force, hueOffset: 46 });
    return true;
  }

  function maybeTriggerGranular(reason) {
    if (getActiveScene() !== 10) return false;
    const left = footState[0];
    const right = footState[1];
    const power = left.power + right.power;
    if (reason !== 'test' && power <= 0.3) return false;

    const played = piano.triggerGranular(
      Math.max(power, reason === 'test' ? 0.8 : 0.3),
      left.acc.y,
      right.acc.y,
      clamp((right.power - left.power) * 0.7, -0.8, 0.8)
    );

    if (played || reason === 'test') {
      left.note = null;
      right.note = null;
      left.sample = 7;
      right.sample = 7;
      addRing(left, 0.8, { sampleNumber: 7, noteIndex: 7, hueOffset: 70 });
      addRing(right, 0.8, { sampleNumber: 7, noteIndex: 7, hueOffset: 70 });
      flashKeyboardBySample(7);
      updateReadout(0, 'granular piano7');
      updateReadout(1, 'granular piano7');
      addVisualEvent(0, 1.1, left.hue, 'granular');
      addVisualEvent(1, 1.1, right.hue, 'granular');
    }
    return played;
  }

  function handleInstrumentEvent(id, kind, reason, power, position) {
    const normalizedReason = reason || (kind === 'KICK' ? 'kick' : 'step');
    const state = footState[id];
    state.power = clamp(power, 0, 1.8);
    if (position) state.stepPosition = position;

    if (kind === 'STEP' || kind === 'KICK' || normalizedReason === 'test') {
      advanceGestureProgress();
      handleScene8Sequence(normalizedReason);
    }

    maybeTriggerJump(false);

    const scene = getActiveScene();
    if (scene === 10) {
      triggerScaleNote(id, normalizedReason, state.power, kind);
      maybeTriggerGranular(normalizedReason);
      return;
    }

    triggerScaleNote(id, normalizedReason, state.power, kind);
  }

  function updateTargets(state) {
    const gyroX = clamp(state.gyro.x, -1, 1);
    const gyroZ = clamp(state.gyro.z, -1, 1);
    const roll = clamp(state.euler.roll / 1.2, -1, 1);
    state.targetX = clamp(0.5 + gyroZ * -0.22 + roll * 0.12 + (state.id === 0 ? -0.08 : 0.08), 0.12, 0.88);
    state.targetY = clamp(0.54 + gyroX * -0.26, 0.16, 0.84);
  }

  function updateAirKickEnergy(state, accDelta, accMag, gyroMag, now) {
    if (!state.airKickWindowStart || now - state.airKickWindowStart > AIR_KICK_WINDOW_MS) {
      state.airKickWindowStart = now;
      state.airKickEnergy = 0;
      state.airKickSamples = 0;
    }

    const dynamicAcc = Math.max(0, accDelta - 0.025);
    const airborneAcc = Math.max(0, accMag - 1.04);
    state.airKickEnergy += dynamicAcc * 1.45 + airborneAcc * 0.42 + gyroMag * 0.08;
    state.airKickSamples += 1;
  }

  function resetAirKickEnergy(state, now) {
    state.airKickWindowStart = now;
    state.airKickEnergy = 0;
    state.airKickSamples = 0;
  }

  function detectImpact(id, source = 'raw') {
    const state = footState[id];
    const accMag = magnitude(state.acc);
    const accDelta = Math.abs(accMag - state.previousAccMagnitude);
    const gyroMag = magnitude(state.gyro);
    const now = performance.now();
    const sensitivity = getSensitivity();
    const motionThreshold = 0.84 - sensitivity * 0.48;

    state.previousAccMagnitude = accMag * 0.32 + state.previousAccMagnitude * 0.68;
    state.mag = accMag;
    state.movement = state.movement * 0.75 + (accDelta + gyroMag * 0.52) * 0.25;
    state.power = clamp(state.movement * 1.2, 0, 1.6);

    if (source === 'converted') {
      updateAirKickEnergy(state, accDelta, accMag, gyroMag, now);
    }

    const gaitQuiet = now - state.lastAnalysisAt > AIR_KICK_GAIT_QUIET_MS;
    const airKickThreshold = 2.25 - getSensitivity() * 0.95;
    if (
      source === 'converted' &&
      gaitQuiet &&
      state.airKickSamples >= AIR_KICK_MIN_SAMPLES &&
      state.airKickEnergy > airKickThreshold &&
      now - state.lastKickAt > AIR_KICK_COOLDOWN_MS
    ) {
      state.lastKickAt = now;
      const kickPower = clamp(0.48 + state.airKickEnergy * 0.22 + gyroMag * 0.18, 0.55, 1.45);
      resetAirKickEnergy(state, now);
      state.movement = 0;
      handleInstrumentEvent(id, 'KICK', 'air', kickPower, classifyStepPosition(state));
      return;
    }

    if (state.movement > motionThreshold && now - state.lastMotionAt > 180) {
      state.lastMotionAt = now;
      state.movement = 0;
      handleInstrumentEvent(id, 'STEP', 'motion', clamp(state.power, 0.25, 1), classifyStepPosition(state));
    }
  }

  function attachBleCallbacks() {
    if (!window.bles) return;
    window.bles.forEach((ble, id) => {
      ble.setup();

      ble.onConnect = function () {
        footState[id].connected = true;
        updateReadout(id, 'connected');
      };

      ble.onDisconnect = function () {
        footState[id].connected = false;
        updateReadout(id, 'disconnected');
      };

      ble.onStartNotify = function () {
        footState[id].connected = true;
        updateReadout(id, 'streaming');
      };

      ble.gotEuler = function (euler) {
        footState[id].euler = eulerFrom(euler);
        updateTargets(footState[id]);
      };

      ble.gotGyro = function (gyro) {
        footState[id].gyro = vectorFrom(gyro);
        updateTargets(footState[id]);
      };

      ble.gotConvertedGyro = function (gyro) {
        footState[id].convertedGyro = vectorFrom(gyro);
      };

      ble.gotConvertedAcc = function (acc) {
        footState[id].hasConvertedAcc = true;
        footState[id].acc = vectorFrom(acc);
        detectImpact(id, 'converted');
      };

      ble.gotAcc = function (acc) {
        if (footState[id].hasConvertedAcc) return;
        footState[id].acc = vectorFrom(acc);
        detectImpact(id, 'raw');
      };

      ble.gotLandingImpact = function (impact) {
        const value = Number((impact && impact.value) || 0);
        footState[id].landingImpact = value;
      };

      ble.gotFootAngle = function (footAngle) {
        footState[id].footAngle = Number((footAngle && footAngle.value) || 0);
      };

      ble.gotStepsNumber = function (steps) {
        if (!steps) return;
        footState[id].lastAnalysisAt = performance.now();
        resetAirKickEnergy(footState[id], footState[id].lastAnalysisAt);
        if (steps.value === footState[id].lastStepValue) return;
        footState[id].lastStepValue = steps.value;
        handleInstrumentEvent(id, 'STEP', 'step', 0.72, classifyStepPosition(footState[id]));
      };

      ble.gotGait = function (gait) {
        if (!gait) return;
        footState[id].lastAnalysisAt = performance.now();
        resetAirKickEnergy(footState[id], footState[id].lastAnalysisAt);
        if (gait.steps === footState[id].lastGaitStep) return;
        footState[id].lastGaitStep = gait.steps;
        handleInstrumentEvent(id, 'STEP', 'step', 0.7, classifyStepPosition(footState[id]));
      };
    });
  }

  function renderKeyboard() {
    const scene = getActiveScene();
    const entries = collectSceneSamples(scene).map((sample) => ({
      sample,
      label: sample >= 21 ? midiName(sample) : `piano${sample}`,
      detail: sample === 7 ? 'granular' : `piano${sample}`
    }));

    keyboardNotes.innerHTML = entries
      .map((entry) => `<span class="key${entry.sample ? '' : ' is-empty'}" data-sample="${entry.sample}"><strong>${entry.label}</strong><small>${entry.detail}</small></span>`)
      .join('');
  }

  function updateSceneUi(forceRender) {
    const scene = getActiveScene();
    const meta = SCENE_META[scene] || SCENE_META[1];
    const arpeggioStep = getArpeggioStep(scene) + 1;
    const mode = sceneSelect.value === 'auto' ? 'auto' : 'manual';
    const progressInfo = getProgressInfo(scene);
    const progressText = stepProgress % 1 === 0 ? String(stepProgress) : stepProgress.toFixed(1);
    stepReadout.textContent = progressText;
    sceneReadout.textContent = `${meta.label} ${mode}`;
    sceneReadout.title = '';
    if (['scale', 'arpeggio', 'hybrid'].includes(meta.type)) {
      sampleStatus.dataset.scene = `${meta.label} arp ${arpeggioStep}/8`;
    } else {
      sampleStatus.dataset.scene = meta.type;
    }

    if (sceneMeterFill) {
      sceneMeterFill.style.width = `${progressInfo.ratio * 100}%`;
    }
    if (sceneMeterLabel) {
      sceneMeterLabel.textContent = scene >= 10
        ? `${progressInfo.local.toFixed(1)}/${progressInfo.span} max`
        : `${progressInfo.local.toFixed(1)}/${progressInfo.span} to Scene ${scene + 1}`;
    }
    if (sceneDecayStatus) {
      sceneDecayStatus.textContent = progressDirection === 'falling'
        ? 'returning'
        : progressDirection === 'charging'
          ? 'charging'
          : 'idle';
    }

    const keyboardSignature = `${scene}:${sceneSelect.value}`;
    if (forceRender || scene !== lastScene || keyboardSignature !== lastKeyboardSignature || !sceneHasBeenRendered) {
      lastScene = scene;
      lastKeyboardSignature = keyboardSignature;
      sceneHasBeenRendered = true;
      renderKeyboard();
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
  }

  function drawBackground(width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.56, '#f6fbff');
    gradient.addColorStop(1, '#fffdf7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    drawMonetWash(width, height, sceneRichness());

    ctx.fillStyle = 'rgba(24, 31, 38, 0.035)';
    const dotGap = Math.max(12, Math.floor(width / 92));
    for (let y = dotGap; y < height; y += dotGap) {
      for (let x = dotGap; x < width; x += dotGap) {
        if ((x + y + animationFrame) % (dotGap * 4) < dotGap * 2) {
          ctx.beginPath();
          ctx.arc(x, y, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const scene = getActiveScene();
    const meta = SCENE_META[scene] || SCENE_META[1];
    ctx.fillStyle = 'rgba(24, 31, 38, 0.55)';
    ctx.font = `700 ${Math.max(22, width * 0.026)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(meta.label, width * 0.055, height * 0.055);
    drawSceneProgress(width, height, scene);
  }

  function drawMonetWash(width, height, richness) {
    if (richness <= 0.08) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const count = 2 + Math.floor(richness * 7);
    for (let i = 0; i < count; i += 1) {
      const hue = MONET_HUES[(i * 2 + getActiveScene()) % MONET_HUES.length];
      const x = width * (0.18 + ((i * 0.19 + richness * 0.11) % 0.68));
      const y = height * (0.2 + ((i * 0.23 + richness * 0.09) % 0.58));
      const radius = Math.min(width, height) * (0.18 + richness * 0.26 + i * 0.012);
      const alpha = (0.018 + richness * 0.032) * (1 - i / (count * 1.8));
      const wash = ctx.createRadialGradient(x, y, radius * 0.12, x, y, radius);
      wash.addColorStop(0, `hsla(${hue}, 58%, 74%, ${alpha})`);
      wash.addColorStop(1, `hsla(${hue}, 58%, 74%, 0)`);
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSceneProgress(width, height, scene) {
    const progressInfo = getProgressInfo(scene);
    const x = width * 0.055;
    const y = height * 0.9;
    const totalWidth = width * 0.89;
    const segmentGap = Math.max(4, width * 0.004);
    const segmentWidth = (totalWidth - segmentGap * 9) / 10;
    const barHeight = Math.max(8, height * 0.018);

    for (let i = 0; i < 10; i += 1) {
      const segmentX = x + i * (segmentWidth + segmentGap);
      const segmentScene = i + 1;
      const isPast = segmentScene < scene;
      const isCurrent = segmentScene === scene;
      const fillRatio = isPast ? 1 : isCurrent ? progressInfo.ratio : 0;
      ctx.fillStyle = 'rgba(24,31,38,0.08)';
      ctx.fillRect(segmentX, y, segmentWidth, barHeight);
      if (fillRatio > 0) {
        const hue = MONET_HUES[(segmentScene + getActiveScene()) % MONET_HUES.length];
        ctx.fillStyle = `hsla(${hue}, 62%, 62%, 0.55)`;
        ctx.fillRect(segmentX, y, segmentWidth * fillRatio, barHeight);
      }
    }

    ctx.fillStyle = 'rgba(24,31,38,0.48)';
    ctx.font = `600 ${Math.max(11, width * 0.012)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const directionText = progressDirection === 'falling' ? 'returning' : progressDirection === 'charging' ? 'charging' : 'idle';
    ctx.fillText(`${stepProgress.toFixed(1)} / ${MAX_STEP_PROGRESS} ${directionText}`, x + totalWidth, y - height * 0.012);
  }

  function drawFoot(state, width, height, delta) {
    state.x += (state.targetX - state.x) * 0.08;
    state.y += (state.targetY - state.y) * 0.08;
    state.rings.forEach((ring) => {
      ring.age += delta;
    });
    state.rings = state.rings.filter((ring) => ring.age < ring.life);

    const x = state.x * width;
    const y = state.y * height;
    const baseRadius = Math.min(width, height) * (0.18 + state.movement * 0.08);

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    state.rings.forEach((ring) => {
      const progress = ring.age / ring.life;
      const richness = ring.richness || 0;
      ctx.lineWidth = Math.max(5, baseRadius * 0.17 * (1 - progress * 0.38));
      ctx.strokeStyle = `hsla(${ring.hue}, 62%, 64%, ${0.42 * (1 - progress)})`;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, baseRadius * (0.62 + progress * 2.55), 0, Math.PI * 2);
      ctx.stroke();

      if (richness > 0.18) {
        ctx.lineWidth = Math.max(4, baseRadius * (0.09 + richness * 0.06) * (1 - progress * 0.32));
        ctx.strokeStyle = `hsla(${ring.secondaryHue}, 58%, 68%, ${(0.18 + richness * 0.18) * (1 - progress)})`;
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(ring.phase) * baseRadius * 0.08 * richness,
          y + Math.sin(ring.phase) * baseRadius * 0.08 * richness,
          baseRadius * (0.78 + progress * (2.0 + richness * 0.7)),
          ring.phase,
          ring.phase + Math.PI * (1.18 + richness * 0.66)
        );
        ctx.stroke();
      }

      if (richness > 0.58) {
        ctx.lineWidth = Math.max(3, baseRadius * 0.055 * (1 - progress * 0.22));
        ctx.strokeStyle = `hsla(${ring.tertiaryHue}, 54%, 72%, ${(0.12 + richness * 0.12) * (1 - progress)})`;
        ctx.beginPath();
        ctx.arc(
          x - Math.cos(ring.phase) * baseRadius * 0.12,
          y + Math.sin(ring.phase * 0.7) * baseRadius * 0.12,
          baseRadius * (1.02 + progress * 3.05),
          ring.phase + Math.PI * 0.34,
          ring.phase + Math.PI * (1.72 + richness * 0.45)
        );
        ctx.stroke();
      }
    });

    const fill = ctx.createRadialGradient(x, y, baseRadius * 0.1, x, y, baseRadius);
    fill.addColorStop(0, `hsla(${state.hue}, 62%, 72%, 0.24)`);
    fill.addColorStop(1, `hsla(${state.hue}, 62%, 72%, 0.02)`);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, baseRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = Math.max(10, baseRadius * 0.22);
    ctx.strokeStyle = `hsla(${state.hue}, 62%, 62%, ${state.connected ? 0.62 : 0.28})`;
    ctx.beginPath();
    ctx.arc(x, y, baseRadius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(24,31,38,0.62)';
    ctx.font = `700 ${Math.max(20, baseRadius * 0.18)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerLabel = state.note == null ? (state.sample && state.sample < 21 ? `p${state.sample}` : state.side) : midiName(state.note);
    ctx.fillText(centerLabel, x, y);

    ctx.fillStyle = 'rgba(24,31,38,0.36)';
    ctx.font = `600 ${Math.max(10, baseRadius * 0.075)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const detailLabel = state.sample ? `${state.stepPosition.toLowerCase()} piano${state.sample}` : 'waiting';
    ctx.fillText(detailLabel, x, y + baseRadius * 0.28);
  }

  function drawEvents(width, height, delta) {
    visualEvents.forEach((event) => {
      event.age += delta;
      const progress = event.age / event.life;
      const x = event.x * width;
      const y = event.y * height;
      const richness = sceneRichness();
      const alpha = event.type === 'granular' ? 0.22 : event.type === 'scene' ? 0.16 : 0.28;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = `hsla(${event.hue}, 64%, 65%, ${alpha * (1 - progress)})`;
      ctx.lineWidth = Math.max(3, height * 0.034 * (1 - progress * 0.35));
      ctx.beginPath();
      ctx.arc(x, y, Math.min(width, height) * (0.22 + progress * 0.74), 0, Math.PI * 2);
      ctx.stroke();
      if (richness > 0.5) {
        const hue = MONET_HUES[(event.side + getActiveScene() + Math.floor(progress * 8)) % MONET_HUES.length];
        ctx.strokeStyle = `hsla(${hue}, 58%, 72%, ${0.14 * richness * (1 - progress)})`;
        ctx.lineWidth = Math.max(2, height * 0.018 * (1 - progress * 0.25));
        ctx.beginPath();
        ctx.arc(x, y, Math.min(width, height) * (0.34 + progress * 0.92), event.age + event.side, event.age + event.side + Math.PI * 1.45);
        ctx.stroke();
      }
      ctx.restore();
    });
    for (let i = visualEvents.length - 1; i >= 0; i -= 1) {
      if (visualEvents[i].age >= visualEvents[i].life) visualEvents.splice(i, 1);
    }
  }

  let lastTime = performance.now();
  function drawFrame(time) {
    const delta = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    animationFrame += 1;

    decayStepProgress(delta);
    updateSceneUi();
    const width = canvas.width;
    const height = canvas.height;
    drawBackground(width, height);
    drawEvents(width, height, delta);
    footState.forEach((state) => drawFoot(state, width, height, delta));
    window.requestAnimationFrame(drawFrame);
  }

  function initControls() {
    const twoCoreOptions = {
      range: { acc: 16, gyro: 2000 },
      autoReconnect: false,
      forceDeviceSelection: true,
      useSharedBridge: false,
      rejectDuplicateDevices: true
    };
    buildCoreToolkit(document.querySelector('#toolkit_placeholder'), '01', 0, 'STEP_ANALYSIS_AND_SENSOR_VALUES', {
      ...twoCoreOptions
    });
    buildCoreToolkit(document.querySelector('#toolkit_placeholder'), '02', 1, 'STEP_ANALYSIS_AND_SENSOR_VALUES', {
      ...twoCoreOptions
    });
    guardCoreToolkitBluetooth({ coreIds: [0, 1], messageElement: '#ble-support-message' });

    sceneSelect.addEventListener('change', function () {
      updateSceneUi(true);
    });

    soundToggle.addEventListener('click', async function () {
      try {
        await piano.toggle();
      } catch (error) {
        console.error(error);
      }
    });

    volumeRange.addEventListener('input', function () {
      piano.setVolume(Number(this.value) / 100);
    });

    document.getElementById('leftTest').addEventListener('click', async function () {
      await piano.enable();
      handleInstrumentEvent(0, 'STEP', 'test', 0.82, classifyStepPosition(footState[0]));
    });

    document.getElementById('rightTest').addEventListener('click', async function () {
      await piano.enable();
      handleInstrumentEvent(1, 'STEP', 'test', 0.82, classifyStepPosition(footState[1]));
    });
  }

  function init() {
    initControls();
    attachBleCallbacks();
    piano.setVolume(Number(volumeRange.value) / 100);
    updateSceneUi(true);
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.requestAnimationFrame(drawFrame);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
