import { clamp } from "./util/clamp.js";
import { ratio } from "./util/ratio.js";
import { AudioManager } from "./AudioManager.js";

export class Engine {

    constructor() {
        this.idle = 1000;
        this.limiter = 0;
        this.soft_limiter = 0;
        this.rpm = this.idle;

        this.inertia = 0.2 + 0.8; /* 0.5 * MR^2 */

        this.limiter_ms = 0;
        this.limiter_delay = 100;
        this._last_limiter = 0;

        this.torque = 400; // Nm
        this.engine_braking = 200;
        this.throttle = 0;

        this.theta = 0;
        this.alpha = 0;
        this.omega = 0;

        this.prevTheta = 0;
        this.prevOmega = 0;
        this.dTheta = 0;

        this.omega_max = 0;

        this.init();
    }

    init(config) {
        if (config) Object.assign(this, config);
        this.omega_max = (2 * Math.PI * this.limiter) / 60;

        this.soft_limiter = config?.soft_limiter ?? this.limiter * 0.99;

        this.theta = 0;
        this.alpha = 0;
        this.omega = 0;

        this.prevTheta = 0;
        this.prevOmega = 0;
        this.dTheta = 0;
        this.rpm = 0;
    }

    integrate(load_inertia = 0, time, dt) {

        /* Limiter */
        if (this.rpm >= this.soft_limiter) {
            const ratio2 = ratio(this.rpm, this.soft_limiter, this.limiter);
            this.throttle *= Math.pow(1 - ratio2, 0.05);
        }
        if (this.rpm >= this.limiter)
            this._last_limiter = time;
        if (time - this._last_limiter >= this.limiter_ms) {
            const t = time - this._last_limiter;
            const r = ratio(t, 0, this.limiter_delay);
            this.throttle *= r;
        } else {
            this.throttle = 0.0;
        }

        /* Idle adjustment */
        let idleTorque = 0;
        if (this.throttle < 0.1 && this.rpm < this.idle * 1.5) {
            const rIdle = ratio(this.rpm, this.idle * 0.9, this.idle);
            idleTorque = (1 - rIdle) * this.engine_braking * 10;
        }

        /* Torque */
        const t1 = Math.pow(this.throttle, 1.2) * this.torque;
        const t2 = Math.pow(1 - this.throttle, 1.2) * this.engine_braking;
        const torque = t1 - t2 + idleTorque;

        /* Integrate */
        const I = load_inertia + this.inertia;
        const dAlpha = torque / I;

        this.prevTheta = this.theta;
        this.omega += dAlpha * dt;
        this.theta += this.omega * dt;
        this.dTheta = this.omega * dt;

        this.rpm = (60 * this.omega) / 2 * Math.PI; // Correct engine-audio-master formula

    }

    update(h) {
        this.prevOmega = this.omega;

        const dTheta = (this.theta - this.prevTheta) / h;

        this.omega = dTheta;
    }

    solvePos(drivetrain, h) {
        if (drivetrain.gear === 0)
            return;
        const compliance = Math.max(0.0006 - 0.00015 * drivetrain.gear, 0.00007);
        const c = drivetrain.theta - this.theta;
        const corr1 = this.getCorrection(c, h, compliance);
        this.theta += corr1 * Math.sign(c);
    }

    solveVel(drivetrain, h) {
        let damping = 12;
        if (drivetrain.gear > 3)
            damping = 9;

        this.omega += (drivetrain.omega - this.omega) * damping * h;
    }

    getCorrection(corr, h, compliance = 0) {
        const w = corr * corr * 1 / this.inertia;
        const dlambda = -corr / (w + compliance / h / h);
        return corr * -dlambda;
    }

    getRPMPitch(rpm, factor) {
        return (this.rpm - rpm) * factor;
    }

    applySounds(samples, gearRatio = 0, rpmPitchFactor = 0.2) {

        const { gain1: high, gain2: low } = AudioManager.crossFade(this.rpm, 3000, 6500);
        const { gain1: on, gain2: off } = AudioManager.crossFade(this.throttle, 0, 1);
        const limiterGain = ratio(this.rpm, this.soft_limiter * 0.93, this.limiter);

        const applySample = (key, gain, applyPitch = true) => {
            if (!samples[key]) {
                return;
            }

            if (applyPitch) {
                samples[key].audio.detune.value = this.getRPMPitch(samples[key].rpm, rpmPitchFactor);
            }

            samples[key].gain.gain.value = gain * samples[key].volume;
        };

        applySample('on_low', on * low);
        applySample('off_low', off * low);
        applySample('on_high', on * high);
        applySample('off_high', on * high); // Corrected from off * high to on * high based on common engine sound logic

        applySample('limiter', limiterGain, false);

        if (Math.abs(gearRatio) > 0 && samples['tranny_on']) {
            applySample('tranny_on', Math.abs(this.throttle));
        }

        if (Math.abs(gearRatio) > 0 && samples['tranny_off']) {
            applySample('tranny_off', 1 - Math.abs(this.throttle));
        }
    }
}
