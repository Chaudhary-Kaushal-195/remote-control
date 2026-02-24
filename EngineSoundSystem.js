import * as THREE from 'three';

class Engine {
    constructor() {
        this.idle = 1000;
        this.limiter = 9000;
        this.soft_limiter = this.limiter * 0.99;
        this.rpm = this.idle;

        this.inertia = 0.2 + 0.8;
        this.limiter_ms = 0;
        this.limiter_delay = 100;
        this._last_limiter = 0;

        this.torque = 400;
        this.engine_braking = 200;
        this.throttle = 0;

        this.theta = 0;
        this.alpha = 0;
        this.omega = 0;
        this.prevTheta = 0;
        this.prevOmega = 0;
    }

    ratio(val, min, max) {
        if (min === max) return val >= max ? 1 : 0;
        return Math.max(0, Math.min(1, (val - min) / (max - min)));
    }

    integrate(load_inertia, time, dt) {
        if (this.rpm >= this.soft_limiter) {
            const ratio2 = this.ratio(this.rpm, this.soft_limiter, this.limiter);
            this.throttle *= Math.pow(1 - ratio2, 0.05);
        }
        if (this.rpm >= this.limiter) this._last_limiter = time * 1000;
        if (time * 1000 - this._last_limiter >= this.limiter_ms) {
            const t = time * 1000 - this._last_limiter;
            const r = this.ratio(t, 0, this.limiter_delay);
            this.throttle *= r;
        } else {
            this.throttle = 0.0;
        }

        let idleTorque = 0;
        if (this.throttle < 0.1 && this.rpm < this.idle * 1.5) {
            const rIdle = this.ratio(this.rpm, this.idle * 0.9, this.idle);
            idleTorque = (1 - rIdle) * this.engine_braking * 10;
        }

        const t1 = Math.pow(this.throttle, 1.2) * this.torque;
        const t2 = Math.pow(1 - this.throttle, 1.2) * this.engine_braking;
        const torque = t1 - t2 + idleTorque;

        const I = load_inertia + this.inertia;
        const dAlpha = torque / I;

        this.prevTheta = this.theta;
        this.omega += dAlpha * dt;
        this.theta += this.omega * dt;

        this.rpm = (60 * this.omega) / (2 * Math.PI);
    }

    update(h) {
        this.prevOmega = this.omega;
        this.omega = (this.theta - this.prevTheta) / h;
    }

    solvePos(drivetrain, h) {
        if (drivetrain.gear === 0) return;
        const compliance = Math.max(0.0006 - 0.00015 * drivetrain.gear, 0.00007);
        const c = drivetrain.theta - this.theta;
        const corr1 = this.getCorrection(c, h, compliance);
        this.theta += corr1 * Math.sign(c);
    }

    solveVel(drivetrain, h) {
        let damping = drivetrain.gear > 3 ? 9 : 12;
        this.omega += (drivetrain.omega - this.omega) * damping * h;
    }

    getCorrection(corr, h, compliance = 0) {
        const w = corr * corr * (1 / this.inertia);
        const dlambda = -corr / (w + compliance / h / h);
        return corr * -dlambda;
    }
}

class Drivetrain {
    constructor() {
        this.gear = 0; // 0 = Neutral
        this.clutch = 1.0;
        this.downShift = false;

        // Reverse is index -1 mathematically here, mapped to -3.4
        // 1st to 6th:
        this.gears = [3.4, 2.36, 1.85, 1.47, 1.24, 1.07];
        this.final_drive = 3.44;

        this.theta = 0;
        this.omega = 0;
        this.prevTheta = 0;
        this.prevOmega = 0;

        this.inertia = 0.1 + 0.05;
        this.damping = 12;
        this.compliance = 0.01;
        this.shiftTime = 50;
    }

    integrate(dt) {
        this.clutch = Math.max(0, Math.min(1, this.clutch));
        this.prevTheta = this.theta;
        this.theta += this.omega * dt;
    }

    update(h) {
        this.prevOmega = this.omega;
        this.omega = (this.theta - this.prevTheta) / h;
    }

    solvePos(engine, h) {
        const c = engine.theta - this.theta;
        const w = c * c * (1 / this.inertia);
        const dlambda = -c / (w + this.compliance / h / h);
        const corr1 = c * -dlambda;
        this.theta += corr1 * Math.sign(c);
    }

    solveVel(engine, h) {
        let damping = this.gear > 3 ? this.damping * 0.75 : this.damping;
        this.omega += (engine.omega - this.omega) * damping * h;
    }

    getGearRatio(gear = this.gear) {
        if (gear === -1) return -3.4; // Reverse
        if (gear === 0 || gear > this.gears.length) return 0;
        return this.gears[gear - 1];
    }

    getTotalGearRatio() {
        return this.getGearRatio() * this.final_drive;
    }

    changeGear(newGear) {
        if (newGear < -1 || newGear > 6) return; // Allow -1 to 6

        const prevRatio = this.getGearRatio(this.gear);
        const nextRatio = this.getGearRatio(newGear);
        const ratioRatio = prevRatio !== 0 ? Math.abs(nextRatio / prevRatio) : 0;

        if (this.gear === newGear && ratioRatio === 1) return;

        this.gear = 0; // Neutral briefly
        if (ratioRatio > 1) this.downShift = true;

        setTimeout(() => {
            this.omega = this.omega * ratioRatio;
            this.gear = newGear;
            this.downShift = false;
        }, this.shiftTime);
    }
}

export class EngineSoundSystem {
    constructor(camera, carMesh) {
        this.camera = camera;
        this.carMesh = carMesh;

        this.engine = new Engine();
        this.drivetrain = new Drivetrain();
        this.mass = 500;
        this.wheel_radius = 0.250;
        this.velocity = 0; // physical calculated speed

        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        this.audioContext = this.audioListener.context;

        this.onHigh = new THREE.PositionalAudio(this.audioListener);
        this.onLow = new THREE.PositionalAudio(this.audioListener);
        this.offHigh = new THREE.PositionalAudio(this.audioListener);
        this.offLow = new THREE.PositionalAudio(this.audioListener);
        this.limiter = new THREE.PositionalAudio(this.audioListener);

        this.carMesh.add(this.onHigh);
        this.carMesh.add(this.onLow);
        this.carMesh.add(this.offHigh);
        this.carMesh.add(this.offLow);
        this.carMesh.add(this.limiter);

        [this.onHigh, this.onLow, this.offHigh, this.offLow, this.limiter].forEach(audio => {
            audio.setRefDistance(5);
            audio.setMaxDistance(100);
            audio.setRolloffFactor(2);
            audio.setDistanceModel('exponential');
        });

        this.isLoaded = false;
        this.shouldStartPlay = false;
        this.loadAudioFiles();
    }

    // Keep Audio Loading Logic 
    checkLoaded() {
        this.loadedCount++;
        if (this.loadedCount >= 5) {
            this.isLoaded = true;
            if (this.shouldStartPlay) this.startEngine();
        }
    }

    loadAudioFiles() {
        const loader = new THREE.AudioLoader();
        this.loadedCount = 0;

        loader.load('audio/bac_mono/BAC_Mono_onhigh.wav', b => { this.onHigh.setBuffer(b); this.onHigh.setLoop(true); this.onHigh.setVolume(0); this.checkLoaded(); });
        loader.load('audio/bac_mono/BAC_Mono_onlow.wav', b => { this.onLow.setBuffer(b); this.onLow.setLoop(true); this.onLow.setVolume(0); this.checkLoaded(); });
        loader.load('audio/bac_mono/BAC_Mono_offveryhigh.wav', b => { this.offHigh.setBuffer(b); this.offHigh.setLoop(true); this.offHigh.setVolume(0); this.checkLoaded(); });
        loader.load('audio/bac_mono/BAC_Mono_offlow.wav', b => { this.offLow.setBuffer(b); this.offLow.setLoop(true); this.offLow.setVolume(0); this.checkLoaded(); });
        loader.load('audio/bac_mono/limiter.wav', b => { this.limiter.setBuffer(b); this.limiter.setLoop(true); this.limiter.setVolume(0); this.checkLoaded(); });
    }

    startEngine() {
        this.shouldStartPlay = true;
        if (!this.isLoaded) return;
        if (!this.onHigh.isPlaying) {
            this.onHigh.play(); this.onLow.play(); this.offHigh.play(); this.offLow.play(); this.limiter.play();
        }
    }

    setThrottle(value) {
        if (this.drivetrain.downShift) {
            this.engine.throttle = 0.8; // rev match
        } else {
            this.engine.throttle = value;
        }
    }

    applyBrakes(amount) {
        this.drivetrain.omega -= amount; // physical braking applied to drivetrain
    }

    shiftGear(direction, gearIndex) {
        if (gearIndex !== undefined) {
            this.drivetrain.changeGear(gearIndex);
        }
    }

    getLoadInertia() {
        if (this.drivetrain.gear === 0) return 0;

        const gearRatio = this.drivetrain.getGearRatio();
        const totalGearRatio = this.drivetrain.getTotalGearRatio();

        const I_veh = this.mass * Math.pow(this.wheel_radius, 2);
        const I_wheels = 4 * 12.0 * Math.pow(this.wheel_radius, 2);

        const I1 = I_veh / Math.pow(totalGearRatio, 2);
        const I2 = I_wheels / Math.pow(totalGearRatio, 2);
        const I3 = this.drivetrain.inertia / Math.pow(gearRatio, 2);
        return I1 + I2 + I3;
    }

    crossFade(value, start, end) {
        const x = Math.max(0, Math.min(1, (value - start) / (end - start)));
        return {
            high: Math.cos((1.0 - x) * 0.5 * Math.PI),
            low: Math.cos(x * 0.5 * Math.PI)
        };
    }

    update(dt) {
        if (!this.isLoaded) return;

        // XPBD Physics Loop
        const subSteps = 20;
        const h = dt / subSteps;
        const I = this.getLoadInertia();
        const time = this.audioContext.currentTime || performance.now() / 1000;

        for (let i = 0; i < subSteps; i++) {
            this.engine.integrate(I, time + dt * i, h);
            this.drivetrain.integrate(h);

            this.engine.solvePos(this.drivetrain, h);
            this.drivetrain.solvePos(this.engine, h);

            this.engine.update(h);
            this.drivetrain.update(h);

            this.engine.solveVel(this.drivetrain, h);
            this.drivetrain.solveVel(this.engine, h);
        }

        // Calculate velocity (m/s translated to general speed)
        if (this.drivetrain.gear !== 0) {
            this.velocity = (this.drivetrain.omega / this.drivetrain.getTotalGearRatio()) * this.wheel_radius;
        } else {
            // Decelerate if in neutral
            this.velocity *= 0.99;
        }

        // Apply Sounds
        const { high, low } = this.crossFade(this.engine.rpm, 3000, 6500);
        const { high: on, low: off } = this.crossFade(this.engine.throttle, 0, 1);
        const limiterGain = this.engine.ratio(this.engine.rpm, this.engine.soft_limiter * 0.93, this.engine.limiter);

        const masterVol = window.gameSettings ? (Number(window.gameSettings.engineVol) / 100) : 1.0;
        const rpmPitchFactor = 0.2;

        const setNode = (node, rpmSample, gainAmt) => {
            const cents = (this.engine.rpm - rpmSample) * rpmPitchFactor;
            node.setPlaybackRate(Math.pow(2, cents / 1200));
            node.setVolume(gainAmt * masterVol);
        };

        setNode(this.onHigh, 1000, on * high * 0.5);
        setNode(this.onLow, 1000, on * low * 0.5);
        setNode(this.offHigh, 1000, off * high * 0.5);
        setNode(this.offLow, 1000, off * low * 0.5);
        setNode(this.limiter, 1000, limiterGain * 0.4);
    }
}
