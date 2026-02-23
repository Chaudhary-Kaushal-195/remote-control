import * as THREE from 'three';

export class EngineSoundSystem {
    constructor(camera, carMesh) {
        this.camera = camera;
        this.carMesh = carMesh;
        this.throttle = 0;
        this.currentGear = 1;
        this.gearRatios = [3.8, 2.2, 1.5, 1.2, 1.0, 0.8];
        this.idleRPM = 900;
        this.redlineRPM = 7000;
        this.currentRPM = this.idleRPM;

        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);

        this.audioContext = this.audioListener.context;
        // Doppler effect settings
        if (this.audioContext.listener && 'dopplerFactor' in this.audioContext.listener) {
            this.audioContext.listener.dopplerFactor = 1.5;
        } else if (this.audioListener.setDopplerFactor) {
            // Depending on Three.js version
            this.audioListener.setDopplerFactor(1.5);
        }

        this.baseEngine = new THREE.PositionalAudio(this.audioListener);
        this.boostLayer = new THREE.PositionalAudio(this.audioListener);
        this.turboFlutter = new THREE.PositionalAudio(this.audioListener);
        this.backfire = new THREE.PositionalAudio(this.audioListener);

        this.carMesh.add(this.baseEngine);
        this.carMesh.add(this.boostLayer);
        this.carMesh.add(this.turboFlutter);
        this.carMesh.add(this.backfire);

        this.setupAudioSettings(this.baseEngine);
        this.setupAudioSettings(this.boostLayer);
        this.setupAudioSettings(this.turboFlutter);
        this.setupAudioSettings(this.backfire);

        this.lowpassFilter = this.audioContext.createBiquadFilter();
        this.lowpassFilter.type = 'lowpass';
        this.lowpassFilter.frequency.value = 22050;

        this.baseEngine.setFilter(this.lowpassFilter);
        this.boostLayer.setFilter(this.lowpassFilter);
        this.turboFlutter.setFilter(this.lowpassFilter);
        this.backfire.setFilter(this.lowpassFilter);

        this.loadAudioFiles();

        this.isLoaded = false;
        this.lastThrottle = 0;
    }

    setupAudioSettings(audio) {
        audio.setRefDistance(5);
        audio.setMaxDistance(100);
        audio.setRolloffFactor(2);
        audio.setDistanceModel('exponential');
    }

    loadAudioFiles() {
        const loader = new THREE.AudioLoader();

        loader.load('toyota-supra-buornut.mp3', (buffer) => {
            this.baseEngine.setBuffer(buffer);
            this.baseEngine.setLoop(true);
            this.baseEngine.setVolume(0);
            this.baseEngine.play();
            this.checkLoaded();
        });

        loader.load('boost-supra-launch.mp3', (buffer) => {
            this.boostLayer.setBuffer(buffer);
            this.boostLayer.setLoop(true);
            this.boostLayer.setVolume(0);
            this.boostLayer.play();
            this.checkLoaded();
        });

        loader.load('toyota_supra_sutututu.mp3', (buffer) => {
            this.turboFlutter.setBuffer(buffer);
            this.turboFlutter.setLoop(false);
            this.turboFlutter.setVolume(0.8);
            this.checkLoaded();
        });

        loader.load('modern car vs  old supra backfire \uD83D\uDD25 - IMGHOST.mp3', (buffer) => {
            this.backfire.setBuffer(buffer);
            this.backfire.setLoop(false);
            this.backfire.setVolume(1.0);
            this.checkLoaded();
        });
    }

    checkLoaded() {
        if (this.baseEngine.buffer && this.boostLayer.buffer && this.turboFlutter.buffer && this.backfire.buffer) {
            this.isLoaded = true;
        }
    }

    setThrottle(value) {
        this.lastThrottle = this.throttle;
        this.throttle = value;

        if (this.lastThrottle > 0 && this.throttle === 0 && this.currentRPM > 3500) {
            if (this.isLoaded) {
                if (this.turboFlutter.isPlaying) this.turboFlutter.stop();
                this.turboFlutter.play();
            }
            this.triggerBackfireRoll(true); // From throttle release
        }
    }

    shiftGear(direction, gearIndex) {
        let oldGear = this.currentGear;
        if (gearIndex !== undefined) {
            this.currentGear = gearIndex;
        } else {
            if (direction === 'up' && this.currentGear < 6) {
                this.currentGear++;
            } else if (direction === 'down' && this.currentGear > 1) {
                this.currentGear--;
            }
        }

        if (oldGear !== this.currentGear) {
            this.triggerBackfireRoll(false);
        }
    }

    triggerBackfireRoll(isThrottleRelease) {
        if (this.isLoaded && this.currentRPM > 5000 && Math.random() < 0.20) {
            if (this.backfire.isPlaying) this.backfire.stop();
            this.backfire.play();

            // Optionally trigger visuals via window if available
            if (window.triggerBackfireVisual) {
                window.triggerBackfireVisual();
            }
        }
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

        if (targetRPM > this.redlineRPM) targetRPM = this.redlineRPM;

        this.currentRPM += (targetRPM - this.currentRPM) * deltaTime * 10;
        if (this.currentRPM > 9999) this.currentRPM = 9999;

        // 1. Base Engine
        let pitch = (this.currentRPM / this.redlineRPM) * 2;
        pitch = Math.max(0.2, pitch);
        this.baseEngine.setPlaybackRate(pitch);

        let engineVol = 0.3 + (this.throttle * 0.7);
        // Master volume control integration
        const masterVol = window.gameSettings ? (window.gameSettings.engineVol / 100) : 1.0;
        this.baseEngine.setVolume(engineVol * masterVol);

        // 2. Boost Layer
        if (this.currentRPM > 3000) {
            let boostVol = Math.min(1.0, (this.currentRPM - 3000) / (this.redlineRPM - 3000));
            this.boostLayer.setVolume(boostVol * 0.8 * this.throttle * masterVol);
        } else if (this.currentRPM < 2500) {
            this.boostLayer.setVolume(0);
        } else {
            let boostVol = (this.currentRPM - 2500) / 500;
            this.boostLayer.setVolume(boostVol * 0.2 * this.throttle * masterVol);
        }

        // Camera distance (reduce vol / lowpass filter)
        let dist = this.camera.position.distanceTo(this.carMesh.position);
        if (dist > 30) {
            let val = 22050 - (dist - 30) * 150;
            this.lowpassFilter.frequency.value = Math.max(300, val);
        } else {
            this.lowpassFilter.frequency.value = 22050; // open
        }
    }
}
