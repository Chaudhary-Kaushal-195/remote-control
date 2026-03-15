window.currentSteeringMode = 'gyro';
window.activeWheelTouchId = null;
window.lastWheelAngle = 0;
window.remoteWheelAngle = 0;

// ─── MULTITOUCH TRACKING SYSTEM ───
// Maps each touch identifier to the control it "owns".
// Once a touch is claimed by a zone, it stays with that zone until released.
// This prevents cross-contamination between the wheel and pedals.
const activeTouches = new Map(); // touchId → { zone: 'wheel'|'gas'|'brake'|'reverse'|'steer-left'|'steer-right'|'gear-up'|'gear-down'|'hub-btn', element: HTMLElement }

window.vibrate = (ms) => {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// ─── HELPER: find which control element a point is inside ───
function identifyTouchTarget(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;

    // Check wheel zone first (highest priority for steering area)
    const wheelZone = document.getElementById('wheel-zone');
    if (wheelZone && wheelZone.style.display !== 'none') {
        if (el === wheelZone || wheelZone.contains(el)) {
            return { zone: 'wheel', element: wheelZone };
        }
        // Also check by bounding rect — the wheel is circular, so any touch inside its rect counts
        const wr = wheelZone.getBoundingClientRect();
        const cx = wr.left + wr.width / 2;
        const cy = wr.top + wr.height / 2;
        const radius = wr.width / 2;
        const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
        if (dist <= radius * 1.15) { // 15% tolerance outside the visual circle
            return { zone: 'wheel', element: wheelZone };
        }
    }

    // Pedals
    const gas = document.getElementById('gas');
    if (gas && (el === gas || gas.contains(el))) return { zone: 'gas', element: gas };

    const brake = document.getElementById('brake');
    if (brake && (el === brake || brake.contains(el))) return { zone: 'brake', element: brake };

    const reverse = document.getElementById('reverse');
    if (reverse && (el === reverse || reverse.contains(el))) return { zone: 'reverse', element: reverse };

    // Button steering
    const steerLeft = document.getElementById('steer-left');
    if (steerLeft && (el === steerLeft || steerLeft.contains(el))) return { zone: 'steer-left', element: steerLeft };

    const steerRight = document.getElementById('steer-right');
    if (steerRight && (el === steerRight || steerRight.contains(el))) return { zone: 'steer-right', element: steerRight };

    // Gear shifters
    const gearUp = document.getElementById('gear-up');
    if (gearUp && (el === gearUp || gearUp.contains(el))) return { zone: 'gear-up', element: gearUp };

    const gearDown = document.getElementById('gear-down');
    if (gearDown && (el === gearDown || gearDown.contains(el))) return { zone: 'gear-down', element: gearDown };

    // Top hub buttons (camera, settings, transmission)
    if (el.closest('.ctrl-hub-btn')) return { zone: 'hub-btn', element: el.closest('.ctrl-hub-btn') };

    return null;
}

// ─── ACTIONS: press/release for each zone ───
function pressControl(zone) {
    if (!window.conn) return;
    switch (zone) {
        case 'gas':
            window.conn.send({ type: 'pedal', pedal: 'fwd', active: true });
            window.vibrate(20);
            break;
        case 'brake':
            window.conn.send({ type: 'pedal', pedal: 'brake', active: true });
            window.vibrate(70);
            break;
        case 'reverse':
            window.conn.send({ type: 'pedal', pedal: 'bwd', active: true });
            window.vibrate(40);
            break;
        case 'steer-left':
            window.conn.send({ type: 'pedal', pedal: 'left', active: true });
            window.vibrate(30);
            break;
        case 'steer-right':
            window.conn.send({ type: 'pedal', pedal: 'right', active: true });
            window.vibrate(30);
            break;
        case 'gear-up':
            window.conn.send({ type: 'keydown', key: 'ArrowUp' });
            window.vibrate(50);
            break;
        case 'gear-down':
            window.conn.send({ type: 'keydown', key: 'ArrowDown' });
            window.vibrate(50);
            break;
    }
}

function releaseControl(zone) {
    if (!window.conn) return;
    switch (zone) {
        case 'gas':
            window.conn.send({ type: 'pedal', pedal: 'fwd', active: false });
            break;
        case 'brake':
            window.conn.send({ type: 'pedal', pedal: 'brake', active: false });
            break;
        case 'reverse':
            window.conn.send({ type: 'pedal', pedal: 'bwd', active: false });
            break;
        case 'steer-left':
            window.conn.send({ type: 'pedal', pedal: 'left', active: false });
            break;
        case 'steer-right':
            window.conn.send({ type: 'pedal', pedal: 'right', active: false });
            break;
        case 'gear-up':
            window.conn.send({ type: 'keyup', key: 'ArrowUp' });
            break;
        case 'gear-down':
            window.conn.send({ type: 'keyup', key: 'ArrowDown' });
            break;
    }
}

// ─── UNIVERSAL MULTITOUCH HANDLER ───
// We use a SINGLE set of global touch listeners to manage all touches.
// Each touch is claimed by exactly one zone on touchstart and stays owned until touchend/cancel.

window.setupPedals = () => {
    // No-op: pedals are now handled by the universal multitouch system below
    // This function is kept for backward compatibility (called from connection.js)
};

window.setupSteeringListeners = () => {
    // No-op: button steering is now handled by the universal multitouch system below
    // This function is kept for backward compatibility (called from connection.js)
};

window.setupRemoteWheel = () => {
    const wheelZone = document.getElementById('wheel-zone');
    const wheelInner = document.getElementById('wheel-inner');
    if (!wheelZone) return;

    const getAngle = (tx, ty) => {
        const r = wheelZone.getBoundingClientRect();
        return Math.atan2(ty - (r.top + r.height / 2), tx - (r.left + r.width / 2));
    };

    // ─── GLOBAL TOUCHSTART ───
    document.addEventListener('touchstart', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];

            // Skip if this touch is already tracked (shouldn't happen but safety)
            if (activeTouches.has(t.identifier)) continue;

            const target = identifyTouchTarget(t.clientX, t.clientY);
            if (!target) continue;

            // Claim this touch
            activeTouches.set(t.identifier, { zone: target.zone, element: target.element });

            if (target.zone === 'wheel') {
                // Only handle wheel if in wheel steering mode
                if (window.currentSteeringMode === 'wheel') {
                    window.activeWheelTouchId = t.identifier;
                    window.lastWheelAngle = getAngle(t.clientX, t.clientY);
                }
            } else if (target.zone === 'hub-btn') {
                // Hub buttons handle themselves via onclick, just mark as claimed
            } else {
                pressControl(target.zone);
            }
        }

        // Prevent default to stop browser gestures (scroll, zoom) but only for game controls
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // ─── GLOBAL TOUCHMOVE ───
    document.addEventListener('touchmove', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const owned = activeTouches.get(t.identifier);
            if (!owned) continue;

            // Only the wheel zone cares about touchmove
            if (owned.zone === 'wheel' && t.identifier === window.activeWheelTouchId && window.currentSteeringMode === 'wheel') {
                const cur = getAngle(t.clientX, t.clientY);
                let d = cur - window.lastWheelAngle;
                if (d > Math.PI) d -= Math.PI * 2;
                if (d < -Math.PI) d += Math.PI * 2;

                window.remoteWheelAngle = Math.max(-180, Math.min(180, window.remoteWheelAngle + (d * 180 / Math.PI) * 2.2));
                if (wheelInner) wheelInner.style.transform = `rotate(${window.remoteWheelAngle}deg)`;

                if (window.conn && window.conn.open) {
                    window.conn.send({ type: 'gyro', tilt: window.remoteWheelAngle });
                }
                window.lastWheelAngle = cur;
            }
            // Other zones don't need touchmove — they are press/release only
        }

        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // ─── GLOBAL TOUCHEND ───
    document.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const owned = activeTouches.get(t.identifier);
            if (!owned) continue;

            if (owned.zone === 'wheel') {
                if (t.identifier === window.activeWheelTouchId) {
                    window.activeWheelTouchId = null;
                }
            } else if (owned.zone !== 'hub-btn') {
                releaseControl(owned.zone);
            }

            activeTouches.delete(t.identifier);
        }
    }, { passive: true });

    // ─── GLOBAL TOUCHCANCEL ───
    document.addEventListener('touchcancel', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const owned = activeTouches.get(t.identifier);
            if (!owned) continue;

            if (owned.zone === 'wheel') {
                if (t.identifier === window.activeWheelTouchId) {
                    window.activeWheelTouchId = null;
                }
            } else if (owned.zone !== 'hub-btn') {
                releaseControl(owned.zone);
            }

            activeTouches.delete(t.identifier);
        }
    }, { passive: true });

    // ─── WHEEL AUTO-CENTER ANIMATION ───
    const animateAutoCenter = () => {
        if (!window.activeWheelTouchId && window.currentSteeringMode === 'wheel') {
            if (Math.abs(window.remoteWheelAngle) > 0.5) {
                window.remoteWheelAngle *= 0.94;
                if (wheelInner) wheelInner.style.transform = `rotate(${window.remoteWheelAngle}deg)`;

                if (window.conn && window.conn.open) {
                    window.conn.send({ type: 'gyro', tilt: window.remoteWheelAngle });
                }
            } else if (window.remoteWheelAngle !== 0) {
                window.remoteWheelAngle = 0;
                if (wheelInner) wheelInner.style.transform = `rotate(0deg)`;
                if (window.conn && window.conn.open) {
                    window.conn.send({ type: 'gyro', tilt: 0 });
                }
            }
        }
        requestAnimationFrame(animateAutoCenter);
    };
    requestAnimationFrame(animateAutoCenter);
};

window.toggleRemoteSettings = () => {
    const modal = document.getElementById('remote-settings-modal');
    modal.style.display = (modal.style.display === 'none') ? 'flex' : 'none';
};

window.syncSettingsToHost = () => {
    if (!window.conn) return;
    const steering = document.getElementById('remote-setting-steering').value;
    const transmission = document.getElementById('remote-setting-transmission').value;
    const engineVol = parseInt(document.getElementById('remote-setting-engine-vol').value);
    const musicVol = parseInt(document.getElementById('remote-setting-music-vol').value);

    window.conn.send({
        type: 'updateSettings',
        settings: { steering, transmission, engineVol, musicVol }
    });
};

window.toggleTransmissionFromRemote = () => {
    if (!window.conn) return;
    const current = document.getElementById('remote-setting-transmission').value;
    const next = current === 'automatic' ? 'manual' : 'automatic';
    document.getElementById('remote-setting-transmission').value = next;
    window.syncSettingsToHost();
};

window.cycleCameraFromRemote = () => {
    if (!window.conn) return;
    window.conn.send({ type: 'keydown', key: 'c' });
    setTimeout(() => window.conn.send({ type: 'keyup', key: 'c' }), 50);
    window.vibrate(30);
};

window.applyGameConfig = (config) => {
    window.currentSteeringMode = config.steering;
    const wheel = document.getElementById('wheel-zone');
    const buttons = document.getElementById('button-steering');
    const pedals = document.getElementById('pedal-zone');
    const revBtn = document.getElementById('reverse');
    const gearShifters = document.getElementById('gear-shifters');

    // Sync remote settings dropdowns
    if (document.getElementById('remote-setting-steering'))
        document.getElementById('remote-setting-steering').value = config.steering;
    if (document.getElementById('remote-setting-transmission'))
        document.getElementById('remote-setting-transmission').value = config.transmission;
    if (document.getElementById('remote-setting-engine-vol'))
        document.getElementById('remote-setting-engine-vol').value = config.engineVol;
    if (document.getElementById('remote-setting-music-vol'))
        document.getElementById('remote-setting-music-vol').value = config.musicVol;

    // Update Transmission Button Visual
    const transBtn = document.getElementById('remote-trans-btn');
    if (transBtn) {
        const isAuto = config.transmission === 'automatic';
        transBtn.innerText = isAuto ? "AUTO" : "MANUAL";
        transBtn.style.borderColor = isAuto ? "var(--neon-blue)" : "var(--neon-pink)";
        transBtn.style.color = isAuto ? "var(--neon-blue)" : "var(--neon-pink)";
    }

    // Reset visibility
    if (wheel) wheel.style.display = 'none';
    if (buttons) buttons.style.display = 'none';
    if (revBtn) revBtn.style.display = (config.transmission === 'manual') ? 'none' : 'flex';
    if (gearShifters) gearShifters.style.display = (config.transmission === 'manual') ? 'flex' : 'none';

    if (config.steering === 'wheel') {
        if (wheel) wheel.style.display = 'flex';
        if (pedals) pedals.style.bottom = '40px';
    } else if (config.steering === 'buttons') {
        if (buttons) buttons.style.display = 'flex';
        if (pedals) pedals.style.bottom = '40px';
    } else if (config.steering === 'gyro') {
        if (wheel) {
            wheel.style.display = 'flex';
            const inner = document.getElementById('wheel-inner');
            if (inner) inner.style.opacity = '0.3';
        }
        if (pedals) pedals.style.bottom = '40px';
    }

    // When switching away from wheel mode, release any active wheel touch
    if (config.steering !== 'wheel' && window.activeWheelTouchId !== null) {
        window.activeWheelTouchId = null;
    }

    // Clear all tracked touches on config change to prevent ghost inputs
    activeTouches.forEach((owned, id) => {
        if (owned.zone !== 'hub-btn') releaseControl(owned.zone);
    });
    activeTouches.clear();
}
