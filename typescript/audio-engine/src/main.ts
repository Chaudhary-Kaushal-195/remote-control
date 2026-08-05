import * as dat from 'dat.gui';
import * as configurations from './configurations';
import { Vehicle } from './Vehicle';
import { clamp } from './util/clamp';

let loaded = false;

const settings = {
    activeConfig: 'bac_mono'
}

/* Vehicle */
const vehicle = new Vehicle();
const engine = vehicle.engine;
const drivetrain = vehicle.drivetrain;
(engine as any).brake = 0; // Debug state for GUI
(window as any).drivetrain = drivetrain;

/* GUI */
const gui = new dat.GUI();

const guiEngine = gui.addFolder('Engine');
const guiDrivetrain = gui.addFolder('Drivetrain');

guiEngine.open();
guiDrivetrain.open();

guiEngine.add(engine, 'throttle', 0, 1).step(0.01).name('Throttle').listen();
guiEngine.add(engine, 'brake', 0, 1).step(0.01).name('Brake').listen();
guiEngine.add(engine, 'rpm', 0, engine.limiter).name('RPM').listen();
guiEngine.add(engine, 'peakTorque').name('Peak Torque (Nm)').listen();
guiEngine.add(engine, 'theta', 0, 1000).name('Theta').listen();
guiEngine.add(engine, 'omega', -100, 100).name('Omega').listen();

guiDrivetrain.add(drivetrain, 'gear').name('Gear').listen();
guiDrivetrain.add(drivetrain, 'hp').name('Peak HP').listen();
guiDrivetrain.add(drivetrain, 'theta', 0, 1000).name('Theta').listen();
guiDrivetrain.add(drivetrain, 'omega', -100, 100).name('Omega').listen();

/* Events */
const keys: Record<string, boolean> = {}

document.addEventListener('keydown', e => {
    keys[e.code] = true;
});

document.addEventListener('keyup', e => {
    if (!loaded) {
        return;
    }

    keys[e.code] = false;

    const isManual = (window as any).gameSettings?.transmission === 'manual';

    if (e.code.startsWith('Digit') && isManual) {
        const nextGear = +e.key;
        drivetrain.changeGear(nextGear);
    }

    // Note: ArrowUp/ArrowDown gear shifting is handled by window.requestGearShift via input-manager.js
});

/* Initialization */
const startBtn = document.getElementById('start_btn');
const controls = document.getElementById('controls');

// @ts-ignore
window.startTypeScriptEngineAudio = async function (customConfig?: any) {
    let targetConfig = customConfig;
    if (!targetConfig) {
        // @ts-ignore
        if (configurations[settings.activeConfig]) {
            // @ts-ignore
            targetConfig = configurations[settings.activeConfig];
        } else if ((window as any).customEngineConfigs && (window as any).customEngineConfigs[settings.activeConfig]) {
            targetConfig = (window as any).customEngineConfigs[settings.activeConfig];
        } else {
            targetConfig = configurations.bac_mono;
        }
    }

    await vehicle.init(targetConfig);

    drivetrain.hp = 0; // Reset peak HP for new config
    engine.peakTorque = 0; // Reset peak torque for new config

    loaded = true;

    if (startBtn) startBtn.style.display = 'none';
    if (controls) controls.style.display = 'block';

    // Apply initial volume from gameSettings
    if ((window as any).gameSettings?.engineVol !== undefined) {
        (window as any).setEngineVolume((window as any).gameSettings.engineVol);
    }
}

// @ts-ignore
window.getActiveVehicleEngine = function() {
    return { vehicle, engine, drivetrain };
};

startBtn?.addEventListener('click', () => (window as any).startTypeScriptEngineAudio(), { once: true })

/* Update loop */
let
    lastTime = (new Date()).getTime(),
    currentTime = 0,
    dt = 0,
    brakePedal = 0;

function update(time: DOMHighResTimeStamp): void {

    requestAnimationFrame(time => {
        update(time);
    });

    currentTime = (new Date()).getTime();
    dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    if (dt === 0 || (window as any).isPaused) {
        return;
    }

    if (!loaded) {
        return;
    }

    const isAuto = (window as any).gameSettings?.transmission !== 'manual';
    const source = (window as any).activeInputSource;
    const isAnalog = source === 'gamepad';
    const fwdInput = (window as any).inputs?.fwd;
    const isFwd = keys['Space'] || keys['KeyW'] || !!fwdInput;
    const isRevOnly = keys['KeyR'] || (window as any).inputs?.bwd; 

    if (drivetrain.downShift) {
        engine.throttle = 0.8; // Rev matching
    } else {
        if (isFwd) {
            const target = typeof fwdInput === 'number' ? fwdInput : 1.0;
            
            if (isAnalog) {
                // Analog: Fast follow
                engine.throttle = clamp(target, 0, 1);
            } else {
                // Binary (Keyboard/Phone): Smooth pedal travel
                const step = (window as any).inputs?.fwd ? 0.08 : 0.15; // Slower from phone touch for control
                if (engine.throttle < target) {
                    engine.throttle = clamp(engine.throttle + step, 0, target);
                } else {
                    engine.throttle = clamp(engine.throttle - step, target, 1.0);
                }
            }
            if (isAuto && drivetrain.gear < 1 && !drivetrain.isShifting) drivetrain.changeGear(1);
        } else if (isAuto && isRevOnly) {
            const revInput = (window as any).inputs?.bwd;
            const target = typeof revInput === 'number' ? revInput : 1.0;
            if (isAnalog) {
                engine.throttle = clamp(target, 0, 1);
            } else {
                if (engine.throttle < target) {
                    engine.throttle = clamp(engine.throttle + 0.1, 0, target);
                } else {
                    engine.throttle = clamp(engine.throttle - 0.1, target, 1.0);
                }
            }
            if (drivetrain.gear > -1 && !drivetrain.isShifting) drivetrain.changeGear(-1);
        } else {
            // Natural throttle drop
            engine.throttle = clamp(engine.throttle - 0.1, 0, 1);
        }
    }

    if (isAuto && drivetrain.gear > 0 && !drivetrain.isShifting) {
        if (engine.rpm > engine.limiter - 150 && drivetrain.gear < drivetrain.gears.length) {
            drivetrain.nextGear();
        } else if (engine.rpm < 3500 && drivetrain.gear > 1) {
            drivetrain.prevGear();
        }
    }

    const brakeInput = (window as any).inputs?.brake;
    const isBrake = keys['KeyB'] || !!brakeInput;
    const targetBrake = isBrake ? (typeof brakeInput === 'number' ? brakeInput : 1.0) : 0.0;

    if (isAnalog) {
        brakePedal = clamp(targetBrake, 0, 1);
    } else {
        // Binary (Keyboard/Phone): Smooth pedal travel
        const step = (window as any).inputs?.brake ? 0.08 : 0.15; 
        if (brakePedal < targetBrake) {
            brakePedal = clamp(brakePedal + step, 0, targetBrake);
        } else {
            brakePedal = clamp(brakePedal - step, targetBrake, 1.0);
        }
    }

    // Sync debug property
    (engine as any).brake = brakePedal;

    if (brakePedal > 0) {
        let brakeForce = 0.3 * brakePedal; 
        
        // Analog vs Binary Braking feel override (already handled by brakePedal ramp-up, 
        // but we keep the force scaling for consistency with physics)
        if (!isAnalog) {
            brakeForce *= 0.8;
        }

        if (drivetrain.omega > 0) {
            drivetrain.omega = Math.max(0, drivetrain.omega - brakeForce); 
        } else if (drivetrain.omega < 0) {
            drivetrain.omega = Math.min(0, drivetrain.omega + brakeForce); 
        }
    }

    // Auto shift to neutral if braking at low speed in 1st or Reverse
    if (isAuto && isBrake && !drivetrain.isShifting) {
        if (drivetrain.gear === 1 && drivetrain.omega < 10) {
            drivetrain.changeGear(0);
        } else if (drivetrain.gear === -1 && drivetrain.omega > -10) {
            drivetrain.changeGear(0);
        }
    }

    vehicle.update(time, dt);

    /* Update extra debug data */
    const currentHP = (engine.lastTorque * engine.rpm) / 7127;
    if (currentHP > drivetrain.hp) {
        drivetrain.hp = Math.floor(currentHP);
    }
}

update(10);

// @ts-ignore
window.getEngineData = function () {
    return {
        rpm: engine.rpm,
        omega: vehicle.drivetrain.omega,
        gear: vehicle.drivetrain.gear,
        throttle: engine.throttle,
        brake: brakePedal
    };
};

// @ts-ignore
window.setEngineAudioMute = function (isMuted: boolean) {
    if (!vehicle || !vehicle.audio || !vehicle.audio.ctx) return;

    if (isMuted) {
        vehicle.audio.ctx.suspend();
    } else {
        vehicle.audio.ctx.resume();
    }
};

// @ts-ignore
window.setEngineVolume = function (vol: number) {
    if (!vehicle || !vehicle.audio) return;
    // Map 0-100 to 0.0-1.0
    vehicle.audio.setVolume(vol / 100);
};
