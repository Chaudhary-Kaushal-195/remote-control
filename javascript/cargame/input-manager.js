// Inputs Manager init
if (!window.localInputs) window.localInputs = { fwd: false, bwd: false, left: false, right: false, handbrake: false, brake: false };
if (!window.inputs) window.inputs = { ...window.localInputs };
if (!window.gamepadInputs) window.gamepadInputs = { fwd: false, bwd: false, left: false, right: false, handbrake: false, brake: false };

window.gyroActive = false;
window.gyroTilt = 0;
window.manualGearIndex = 1;
window.gamepadLoopActive = false;
window.prevGamepadButtons = [];
window.prevGamepadAxes = [];

window.requestGearShift = (direction) => {
    // Check if drivetrain exists. If not, try to find it (Race condition fix)
    if (!window.drivetrain) {
        // Silent check - if still missing, we just return.
        // This prevents the console from being flooded with errors if the user 
        // presses shift buttons before the engine is ready.
        return false;
    }

    const drivetrain = window.drivetrain;
    
    // BUG FIX: If user shifts manually while in AUTO, we must force MANUAL mode.
    const currentTrans = window.gameSettings ? window.gameSettings.transmission : 'automatic';
    if (currentTrans === 'automatic') {
        if (window.toggleTransmission) {
            window.toggleTransmission();
            if (window.showGameNotification) {
                window.showGameNotification("MANUAL TRANSMISSION ACTIVATED ⚙️", "white");
            }
        }
    }

    if (drivetrain) {
        if (direction === 'up') drivetrain.nextGear();
        else drivetrain.prevGear();

        // Sync manualGearIndex for HUD
        if (window.getEngineData) {
            window.manualGearIndex = window.getEngineData().gear;
        }
        
        // Haptic feedback for gear change
        if (navigator.vibrate) navigator.vibrate(50);
        
        return true;
    }
    return false;
};

window.startGamepadLoop = () => {
    if (!window.gamepadLoopActive) {
        window.gamepadLoopActive = true;
        _gamepadLoop();
    }
};

function _gamepadLoop() {
    if (!window.gamepadConnected) {
        window.gamepadLoopActive = false;
        return;
    }

    try {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[window.gamepadIndex];
        if (!gp) {
            requestAnimationFrame(_gamepadLoop);
            return;
        }

        let fwd = false, bwd = false, brake = false, handbrake = false, left = false, right = false;

        // --- CONTINUOUS INPUTS ---
        
        // Analog steering
        const steerAxis = gp.axes && (gp.axes[0] !== undefined) ? gp.axes[0] : 0;
        window.gamepadSteerAxis = steerAxis;
        
        // Digital steering fallback
        if (steerAxis < -0.2) left = true;
        if (steerAxis > 0.2) right = true;

        // Pressure Sensitive Triggers (Only for Gamepad Mode)
        const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
        const lt = gp.buttons[6] ? gp.buttons[6].value : 0;

        // Face Buttons
        const aBtn = (gp.buttons[0] && gp.buttons[0].pressed);
        const bBtn = (gp.buttons[1] && gp.buttons[1].pressed);

        // --- SYNC INPUTS ---
        // Accelerator (A or RT)
        const finalGas = Math.max(rt, aBtn ? 1.0 : 0);
        window.gamepadInputs.fwd = finalGas; // Store as number for analog engine

        // Brake (B or LT)
        const finalBrake = Math.max(lt, bBtn ? 1.0 : 0);
        window.gamepadInputs.brake = finalBrake; // Store as number for analog engine

        window.gamepadInputs.bwd = gp.buttons[3] && gp.buttons[3].pressed; // Y for Reverse
        window.gamepadInputs.left = left;
        window.gamepadInputs.right = right;

        // --- ONE-SHOT ACTIONS ---
        const btnPressed = (i) => gp.buttons[i] && gp.buttons[i].pressed;
        const btnJustPressed = (i) => btnPressed(i) && (!window.prevGamepadButtons[i]);

        if (btnJustPressed(2)) { if (window.cycleCamera) window.cycleCamera(); }
        if (btnJustPressed(16) || btnJustPressed(10)) { if (window.toggleSettings) window.toggleSettings(); }

        // Gear Shifts (Direct Hook)
        if (btnJustPressed(5)) window.requestGearShift('up');
        if (btnJustPressed(4)) window.requestGearShift('down');

        // BUG FIX & OPTIMIZATION: Update array in-place to prevent 60fps Garbage Collection stutters
        // GamepadButtonList is an object, not a real array in some browsers, but we can iterate its length.
        for (let i = 0; i < gp.buttons.length; i++) {
            window.prevGamepadButtons[i] = gp.buttons[i].pressed;
        }
        
        if (window.syncMergedInputs) window.syncMergedInputs();

    } catch (e) {
        console.error("Critical error in Gamepad Loop:", e);
    }
    
    requestAnimationFrame(_gamepadLoop);
}

window.setGyroState = async (forceState) => {
    if (forceState === window.gyroActive) return;
    if (forceState) {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') _setGyro(true);
            } catch (e) { _setGyro(true); }
        } else {
            _setGyro(true);
        }
    } else {
        _setGyro(false);
    }
};

function _setGyro(state) {
    window.gyroActive = state;
    const speedBox = document.getElementById('speed-box');
    if (window.gyroActive) {
        window.addEventListener('deviceorientation', handleGyro, true);
        if (speedBox) speedBox.style.borderColor = "#0ffffa";
    } else {
        window.removeEventListener('deviceorientation', handleGyro, true);
        if (speedBox) speedBox.style.borderColor = "rgba(255,255,255,0.4)";
        window.gyroTilt = 0;
    }
}

function handleGyro(e) {
    let tilt = -e.gamma;
    if (window.orientation === 90) tilt = e.beta;
    if (window.orientation === -90) tilt = -e.beta;
    window.gyroTilt = Math.max(-45, Math.min(45, tilt)) * 4;
}

document.addEventListener('DOMContentLoaded', () => {
    const orbitZone = document.getElementById('orbit-zone');
    const wheelZone = document.getElementById('steering-zone');

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (window.initAudio) window.initAudio();
            e.preventDefault();
        }
        if (['w', 'W', ' '].includes(e.key)) {
            window.localInputs.fwd = true;
            if (e.key === ' ') e.preventDefault();
        }
        if (['s', 'S'].includes(e.key)) window.localInputs.bwd = true;
        if (['ArrowLeft', 'a', 'A'].includes(e.key)) window.localInputs.left = true;
        if (['ArrowRight', 'd', 'D'].includes(e.key)) window.localInputs.right = true;
        if (['b', 'B'].includes(e.key)) window.localInputs.brake = true;

        if (window.syncMergedInputs) window.syncMergedInputs();

        if (e.key === 'ArrowUp') {
            window.requestGearShift('up');
        }
        if (e.key === 'ArrowDown') {
            window.requestGearShift('down');
        }
        if (e.key.toLowerCase() === 'c' && window.cycleCamera) window.cycleCamera();
    });

    window.addEventListener('keyup', (e) => {
        if (['w', 'W', ' '].includes(e.key)) {
            window.localInputs.fwd = false;
            if (e.key === ' ') e.preventDefault();
        }
        if (['s', 'S'].includes(e.key)) window.localInputs.bwd = false;
        if (['ArrowLeft', 'a', 'A'].includes(e.key)) window.localInputs.left = false;
        if (['ArrowRight', 'd', 'D'].includes(e.key)) window.localInputs.right = false;
        if (['b', 'B'].includes(e.key)) window.localInputs.brake = false;

        if (window.syncMergedInputs) window.syncMergedInputs();
    });

    const dispatchKey = (key, type) => {
        document.dispatchEvent(new KeyboardEvent(type, { key: key, code: key }));
    };

    const resetInputs = (target) => {
        if (target.closest('#gas')) { window.localInputs.fwd = false; dispatchKey('w', 'keyup'); }
        if (target.closest('#rev-btn')) { window.localInputs.bwd = false; dispatchKey('s', 'keyup'); }
        if (target.closest('#handbrake')) { window.localInputs.handbrake = false; window.localInputs.brake = false; dispatchKey('b', 'keyup'); }
        if (target.closest('#steer-left')) window.localInputs.left = false;
        if (target.closest('#steer-right')) window.localInputs.right = false;

        if (window.syncMergedInputs) window.syncMergedInputs();
    };

    let activeId = null, lastAngle = 0;
    const getAngle = (tx, ty) => {
        if (!wheelZone) return 0;
        const r = wheelZone.getBoundingClientRect();
        return Math.atan2(ty - (r.top + r.height / 2), tx - (r.left + r.width / 2));
    };

    window.addEventListener('mousedown', (e) => {
        if (e.target === orbitZone && window.startOrbit) {
            window.startOrbit(e.clientX, e.clientY, 999);
        }
        if (e.target.closest('#gas')) { window.localInputs.fwd = true; dispatchKey('w', 'keydown'); }
        if (e.target.closest('#rev-btn')) { window.localInputs.bwd = true; dispatchKey('s', 'keydown'); }
        if (e.target.closest('#handbrake')) { window.localInputs.brake = true; window.localInputs.handbrake = true; dispatchKey('b', 'keydown'); }
        if (e.target.closest('#steer-left')) window.localInputs.left = true;
        if (e.target.closest('#steer-right')) window.localInputs.right = true;

        if (window.syncMergedInputs) window.syncMergedInputs();
    });

    window.addEventListener('mousemove', (e) => {
        if (window.orbitActive && window.moveOrbit) {
            window.moveOrbit(e.clientX, e.clientY);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (window.endOrbit) window.endOrbit();
        resetInputs(e.target);
    });

    window.addEventListener('touchstart', (e) => {
        for (let t of e.changedTouches) {
            if (t.target === orbitZone && window.startOrbit) {
                window.startOrbit(t.clientX, t.clientY, t.identifier);
                continue;
            }

            if (t.target.closest('#gas')) { window.localInputs.fwd = true; dispatchKey('w', 'keydown'); }
            if (t.target.closest('#rev-btn')) { window.localInputs.bwd = true; dispatchKey('s', 'keydown'); }
            if (t.target.closest('#handbrake')) { window.localInputs.brake = true; window.localInputs.handbrake = true; dispatchKey('b', 'keydown'); }
            if (t.target.closest('#steer-left')) window.localInputs.left = true;
            if (t.target.closest('#steer-right')) window.localInputs.right = true;

            if (window.syncMergedInputs) window.syncMergedInputs();

            if (wheelZone) {
                const r = wheelZone.getBoundingClientRect();
                if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
                    activeId = t.identifier; lastAngle = getAngle(t.clientX, t.clientY);
                    window.activeTouchId = activeId;
                    window.activeLastAngle = lastAngle;
                }
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === window.orbitTouchId && window.moveOrbit) {
                window.moveOrbit(t.clientX, t.clientY);
            } else if (t.identifier === window.activeTouchId) {
                const cur = getAngle(t.clientX, t.clientY);
                let d = cur - window.activeLastAngle;
                if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
                window.wheelAngle = Math.max(-180, Math.min(180, (window.wheelAngle || 0) + (d * 180 / Math.PI) * 1.3));
                const visual = document.getElementById('wheel-visual');
                if (visual) visual.style.transform = `rotate(${window.wheelAngle}deg)`;
                window.activeLastAngle = cur;
            }
        }
        if (e.cancelable && !e.target.closest('button')) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === window.orbitTouchId && window.endOrbit) window.endOrbit();
            resetInputs(t.target);
            if (t.identifier === window.activeTouchId) window.activeTouchId = null;
        }
    });
});
