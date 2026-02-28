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

/* GUI */
const gui = new dat.GUI();

const guiMain = gui.addFolder('Settings');
const guiEngine = gui.addFolder('Engine');
const guiDrivetrain = gui.addFolder('Drivetrain');

guiMain.open();
guiEngine.open();
guiDrivetrain.open();

guiMain.add(settings, 'activeConfig', Object.keys(configurations)).name('Select config');

guiEngine.add(engine, 'throttle', 0, 1).name('Throttle').listen();
guiEngine.add(engine, 'rpm', 0, engine.limiter).name('RPM').listen();
guiEngine.add(engine, 'theta', 0, 1000).name('Theta').listen();
guiEngine.add(engine, 'omega', -100, 100).name('Omega').listen();

guiDrivetrain.add(drivetrain, 'gear').name('Gear').listen();
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

    if (isManual) {
        if (e.code.startsWith('Digit')) {
            const nextGear = +e.key;
            drivetrain.changeGear(nextGear);
        }

        if (e.code == 'ArrowUp')
            drivetrain.nextGear();
        if (e.code == 'ArrowDown')
            drivetrain.prevGear();
    }
});

/* Initialization */
const startBtn = document.getElementById('start_btn');
const controls = document.getElementById('controls');

// @ts-ignore
window.startTypeScriptEngineAudio = async function () {
    // @ts-ignore
    await vehicle.init(configurations[settings.activeConfig]);

    loaded = true;

    if (startBtn) startBtn.style.display = 'none';
    if (controls) controls.style.display = 'block';
}

startBtn?.addEventListener('click', (window as any).startTypeScriptEngineAudio, { once: true })
document.querySelector('select')?.addEventListener('change', (window as any).startTypeScriptEngineAudio)

/* Update loop */
let
    lastTime = (new Date()).getTime(),
    currentTime = 0,
    dt = 0;

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
    const isFwd = keys['Space'] || keys['KeyW'] || (window as any).inputs?.fwd;
    const isRevOnly = keys['KeyR'] || (window as any).inputs?.bwd; // Specifically the REV button and R key

    if (drivetrain.downShift) {
        engine.throttle = 0.8; // Rev matching
    } else {
        if (isFwd) {
            engine.throttle = clamp(engine.throttle += 0.2, 0, 1);
            if (isAuto && drivetrain.gear < 1 && !drivetrain.isShifting) drivetrain.changeGear(1);
        } else if (isAuto && isRevOnly) {
            engine.throttle = clamp(engine.throttle += 0.2, 0, 1);
            if (drivetrain.gear > -1 && !drivetrain.isShifting) drivetrain.changeGear(-1);
        } else {
            engine.throttle = clamp(engine.throttle -= 0.2, 0, 1);
        }
    }

    if (isAuto && drivetrain.gear > 0 && !drivetrain.isShifting) {
        if (engine.rpm > engine.limiter - 150 && drivetrain.gear < drivetrain.gears.length) {
            drivetrain.nextGear();
        } else if (engine.rpm < 3500 && drivetrain.gear > 1) {
            drivetrain.prevGear();
        }
    }

    const isBrake = keys['KeyB'] || (window as any).inputs?.brake;
    if (isBrake) {
        if (drivetrain.omega > 0) {
            drivetrain.omega = Math.max(0, drivetrain.omega - 0.3); // Brake going forward
        } else if (drivetrain.omega < 0) {
            drivetrain.omega = Math.min(0, drivetrain.omega + 0.3); // Brake going backward
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
}

update(10);

// @ts-ignore
window.getEngineData = function () {
    return {
        rpm: engine.rpm,
        omega: vehicle.drivetrain.omega,
        gear: vehicle.drivetrain.gear
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
