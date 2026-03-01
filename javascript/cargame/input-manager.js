// Inputs Manager
window.inputs = { fwd: false, bwd: false, left: false, right: false, handbrake: false, brake: false };
window.gyroActive = false;
window.gyroTilt = 0;
window.manualGearIndex = 1;

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
            window.inputs.fwd = true;
            if (e.key === ' ') e.preventDefault();
        }
        if (['s', 'S'].includes(e.key)) window.inputs.bwd = true;
        if (['ArrowLeft', 'a', 'A'].includes(e.key)) window.inputs.left = true;
        if (['ArrowRight', 'd', 'D'].includes(e.key)) window.inputs.right = true;
        if (['b', 'B'].includes(e.key)) window.inputs.brake = true;

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
            window.inputs.fwd = false;
            if (e.key === ' ') e.preventDefault();
        }
        if (['s', 'S'].includes(e.key)) window.inputs.bwd = false;
        if (['ArrowLeft', 'a', 'A'].includes(e.key)) window.inputs.left = false;
        if (['ArrowRight', 'd', 'D'].includes(e.key)) window.inputs.right = false;
        if (['b', 'B'].includes(e.key)) window.inputs.brake = false;
    });

    const dispatchKey = (key, type) => {
        document.dispatchEvent(new KeyboardEvent(type, { key: key, code: key }));
    };

    const resetInputs = (target) => {
        if (target.closest('#gas')) { window.inputs.fwd = false; dispatchKey('w', 'keyup'); }
        if (target.closest('#rev-btn')) { window.inputs.bwd = false; dispatchKey('s', 'keyup'); }
        if (target.closest('#handbrake')) { window.inputs.handbrake = false; window.inputs.brake = false; dispatchKey('b', 'keyup'); }
        if (target.closest('#steer-left')) window.inputs.left = false;
        if (target.closest('#steer-right')) window.inputs.right = false;
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
        if (e.target.closest('#gas')) { window.inputs.fwd = true; dispatchKey('w', 'keydown'); }
        if (e.target.closest('#rev-btn')) { window.inputs.bwd = true; dispatchKey('s', 'keydown'); }
        if (e.target.closest('#handbrake')) { window.inputs.brake = true; window.inputs.handbrake = true; dispatchKey('b', 'keydown'); }
        if (e.target.closest('#steer-left')) window.inputs.left = true;
        if (e.target.closest('#steer-right')) window.inputs.right = true;
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

            if (t.target.closest('#gas')) { window.inputs.fwd = true; dispatchKey('w', 'keydown'); }
            if (t.target.closest('#rev-btn')) { window.inputs.bwd = true; dispatchKey('s', 'keydown'); }
            if (t.target.closest('#handbrake')) { window.inputs.brake = true; window.inputs.handbrake = true; dispatchKey('b', 'keydown'); }
            if (t.target.closest('#steer-left')) window.inputs.left = true;
            if (t.target.closest('#steer-right')) window.inputs.right = true;

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
