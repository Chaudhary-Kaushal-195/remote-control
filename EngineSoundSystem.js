import * as THREE from 'three';

export class EngineSoundSystem {
    constructor(camera, carMesh) {
        this.camera = camera;
        this.carMesh = carMesh;

        // Physics / Audio State
        this.throttle = 0;
        this.currentGear = 1;
        this.gearRatios = [3.8, 2.2, 1.5, 1.2, 1.0, 0.8];

        this.idleRPM = 1000;
        this.redlineRPM = 9000;
        this.softLimiterRPM = 8950;
        this.currentRPM = this.idleRPM;

        // Setup listener
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        this.audioContext = this.audioListener.context;

        // Nodes
        this.onHigh = new THREE.PositionalAudio(this.audioListener);
        this.onLow = new THREE.PositionalAudio(this.audioListener);
        this.offHigh = new THREE.PositionalAudio(this.audioListener);
        this.offLow = new THREE.PositionalAudio(this.audioListener);
        this.limiter = new THREE.PositionalAudio(this.audioListener);

        // Add nodes to mesh
        this.carMesh.add(this.onHigh);
        this.carMesh.add(this.onLow);
        this.carMesh.add(this.offHigh);
        this.carMesh.add(this.offLow);
        this.carMesh.add(this.limiter);

        // Settings
        [this.onHigh, this.onLow, this.offHigh, this.offLow, this.limiter].forEach(audio => {
            audio.setRefDistance(5);
            audio.setMaxDistance(100);
            audio.setRolloffFactor(2);
            audio.setDistanceModel('exponential');
        });

        this.isLoaded = false;
        this.loadAudioFiles();
    }

    checkLoaded() {
        this.loadedCount++;
        if (this.loadedCount >= this.totalFiles) {
            this.isLoaded = true;
            if (this.shouldStartPlay) this.startEngine();
        }
    }

    loadAudioFiles() {
        const loader = new THREE.AudioLoader();
        this.loadedCount = 0;
        this.totalFiles = 5;
        this.shouldStartPlay = false;

        loader.load('audio/bac_mono/BAC_Mono_onhigh.wav', (buffer) => {
            this.onHigh.setBuffer(buffer);
            this.onHigh.setLoop(true);
            this.onHigh.setVolume(0);
            this.checkLoaded();
        });

        loader.load('audio/bac_mono/BAC_Mono_onlow.wav', (buffer) => {
            this.onLow.setBuffer(buffer);
            this.onLow.setLoop(true);
            this.onLow.setVolume(0);
            this.checkLoaded();
        });

        loader.load('audio/bac_mono/BAC_Mono_offveryhigh.wav', (buffer) => {
            this.offHigh.setBuffer(buffer);
            this.offHigh.setLoop(true);
            this.offHigh.setVolume(0);
            this.checkLoaded();
        });

        loader.load('audio/bac_mono/BAC_Mono_offlow.wav', (buffer) => {
            this.offLow.setBuffer(buffer);
            this.offLow.setLoop(true);
            this.offLow.setVolume(0);
            this.checkLoaded();
        });

        loader.load('audio/bac_mono/limiter.wav', (buffer) => {
            this.limiter.setBuffer(buffer);
            this.limiter.setLoop(true);
            this.limiter.setVolume(0);
            this.checkLoaded();
        });
    }

    startEngine() {
        this.shouldStartPlay = true;
        if (!this.isLoaded) return;

        // Only play if not already playing to avoid overlapping restarts
        if (!this.onHigh.isPlaying) {
            this.onHigh.play();
            this.onLow.play();
            this.offHigh.play();
            this.offLow.play();
            this.limiter.play();
        }
    }

    setThrottle(value) {
        this.throttle = value;
    }

    shiftGear(direction, gearIndex) {
        if (gearIndex !== undefined) {
            this.currentGear = gearIndex;
        } else {
            if (direction === 'up' && this.currentGear < 6) {
                this.currentGear++;
            } else if (direction === 'down' && this.currentGear > 1) {
                this.currentGear--;
            }
        }
    }

    // Crossfade helper: Returns 0-1 mapped to cos curve
    crossFade(value, start, end) {
        const x = Math.max(0, Math.min(1, (value - start) / (end - start)));
        const gain1 = Math.cos((1.0 - x) * 0.5 * Math.PI); // Secondary (High / On)
        const gain2 = Math.cos(x * 0.5 * Math.PI);         // Primary (Low / Off)
        return { high: gain1, low: gain2 };
    }

    ratio(val, min, max) {
        if (min === max) return val >= max ? 1 : 0;
        return Math.max(0, Math.min(1, (val - min) / (max - min)));
    }

    getPlaybackRate(currentRPM, sampleRPM, pitchFactor = 0.2) {
        // detune value = (currentRPM - sampleRPM) * pitchFactor (in cents)
        // 1200 cents = 1 octave = 2x speed
        const cents = (currentRPM - sampleRPM) * pitchFactor;
        return Math.pow(2, cents / 1200);
    }

    update(deltaTime, wheelSpeed) {
        if (!this.isLoaded) return;

        let gearIdx = Math.max(0, Math.min(5, this.currentGear - 1));
        let gearRatio = this.gearRatios[gearIdx];

        let targetRPM = Math.abs(wheelSpeed) * gearRatio * 100;

        if (targetRPM < this.idleRPM) targetRPM = this.idleRPM;
        if (this.throttle > 0) {
            targetRPM += this.throttle * (this.redlineRPM * 0.3); // Reving in neutral or clutch
        }

        if (targetRPM > this.redlineRPM) {
            targetRPM = this.redlineRPM;
        }

        // Simulating some inertia for RPM changes
        this.currentRPM += (targetRPM - this.currentRPM) * deltaTime * 10;

        // Implement crossfading logic
        const { high, low } = this.crossFade(this.currentRPM, 3000, 6500);
        const { high: on, low: off } = this.crossFade(this.throttle, 0, 1);
        const limiterGain = this.ratio(this.currentRPM, this.softLimiterRPM * 0.93, this.redlineRPM);

        const masterVol = window.gameSettings ? (Number(window.gameSettings.engineVol) / 100) : 1.0;

        // Pitch shift (sample RPM for all bac mono base sounds is 1000)
        const basePitch = this.getPlaybackRate(this.currentRPM, 1000);

        // Apply volumes and pitches
        // "on_high" : on * high
        // "off_high": off * high
        // "on_low"  : on * low
        // "off_low" : off * low

        this.onHigh.setPlaybackRate(basePitch);
        this.onHigh.setVolume(on * high * 0.5 * masterVol);

        this.onLow.setPlaybackRate(basePitch);
        this.onLow.setVolume(on * low * 0.5 * masterVol);

        this.offHigh.setPlaybackRate(basePitch);
        this.offHigh.setVolume(off * high * 0.5 * masterVol);

        this.offLow.setPlaybackRate(basePitch);
        this.offLow.setVolume(off * low * 0.5 * masterVol);

        this.limiter.setPlaybackRate(1.0);
        this.limiter.setVolume(limiterGain * 0.4 * masterVol);
    }
}
