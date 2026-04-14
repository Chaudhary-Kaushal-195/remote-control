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
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[window.gamepadIndex];
    if (gp) {
        let fwd = false, bwd = false, brake = false, handbrake = false, left = false, right = false;

        // --- CONTINUOUS INPUTS ---
        
        // Left stick X (Steering)
        const steerAxis = gp.axes && (gp.axes[0] !== undefined) ? gp.axes[0] : 0;
        if (steerAxis < -0.2) left = true;
        if (steerAxis > 0.2) right = true;

        // Face buttons (Mapping as requested)
        // A (button 0): Accelerator
        if (gp.buttons[0] && gp.buttons[0].pressed) fwd = true;
        // B (button 1): Brake
        if (gp.buttons[1] && gp.buttons[1].pressed) brake = true;
        // Y (button 3): Reverse (Mapped as bwd)
        if (gp.buttons[3] && gp.buttons[3].pressed) bwd = true;

        // D-pad (Fallback for steering)
        if (gp.buttons[14] && gp.buttons[14].pressed) left = true;
        if (gp.buttons[15] && gp.buttons[15].pressed) right = true;

        // --- ONE-SHOT ACTION BUTTONS (State Checking) ---
        const btnPressed = (i) => gp.buttons[i] && gp.buttons[i].pressed;
        const btnJustPressed = (i) => btnPressed(i) && (!window.prevGamepadButtons[i]);

        // X (button 2): Change Camera
        if (btnJustPressed(2)) {
            if (window.cycleCamera) window.cycleCamera();
        }

        // Home / Guide (button 16): Open Settings
        if (btnJustPressed(16) || btnJustPressed(10)) {
            if (window.toggleSettings) window.toggleSettings();
        }

        // L1 / R1 (buttons 4 and 5): Paddle Shifters
        if (btnJustPressed(5)) { // R1: Gear Up
            const ev = new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true });
            document.dispatchEvent(ev);
            if (window.manualGearIndex < 6) window.manualGearIndex++;
        }
        if (btnJustPressed(4)) { // L1: Gear Down
            const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true });
            document.dispatchEvent(ev);
            if (window.manualGearIndex > -1) window.manualGearIndex--;
        }

        // Note: Home / Guide (button 16) is handled above. R2 is currently unmapped for actions.

        // Store button states for next frame
        window.prevGamepadButtons = gp.buttons.map(b => b.pressed);

        // --- SYNC INPUTS ---
        window.gamepadInputs.fwd = fwd;
        window.gamepadInputs.bwd = bwd;
        window.gamepadInputs.brake = brake;
        window.gamepadInputs.handbrake = handbrake;
        window.gamepadInputs.left = left;
        window.gamepadInputs.right = right;

        window.gamepadSteerAxis = steerAxis;

        if (window.syncMergedInputs) window.syncMergedInputs();
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
            if (window.manualGearIndex < 6) window.manualGearIndex++;
        }
        if (e.key === 'ArrowDown') {
            if (window.manualGearIndex > -1) window.manualGearIndex--;
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
