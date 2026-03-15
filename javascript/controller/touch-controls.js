// ═══════════════════════════════════════════════════════════
// TOUCH CONTROLS — Per-Element Multitouch Architecture
// ═══════════════════════════════════════════════════════════
//
// DESIGN: Each game control (gas, brake, reverse, wheel, steer buttons,
// gear shifters) gets its OWN touch listeners attached directly to the element.
// Each listener calls e.preventDefault() + e.stopPropagation() to prevent
// browser gestures ONLY within that element.
//
// Hub buttons (AUTO, camera, settings) and modals use standard onclick/onchange
// with ZERO touch interference — they are never touched by this code.
//
// This means: gas + wheel can be pressed simultaneously, and tapping
// the settings button will always work.
// ═══════════════════════════════════════════════════════════

window.currentSteeringMode = 'gyro';
window.activeWheelTouchId = null;
window.lastWheelAngle = 0;
window.remoteWheelAngle = 0;

window.vibrate = (ms) => {
    if (navigator.vibrate) navigator.vibrate(ms);
};

// ─── PEDAL SETUP ───
// Each pedal tracks its own touch ID so multiple pedals work simultaneously.
window.setupPedals = () => {
    const pedalConfig = [
        { id: 'gas',     pedal: 'fwd',   vibrateMs: 20 },
        { id: 'brake',   pedal: 'brake', vibrateMs: 70 },
        { id: 'reverse', pedal: 'bwd',   vibrateMs: 40 },
    ];

    pedalConfig.forEach(({ id, pedal, vibrateMs }) => {
        const el = document.getElementById(id);
        if (!el) return;

        let ownTouchId = null;

        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Claim the first new touch on this pedal
            if (ownTouchId === null) {
                ownTouchId = e.changedTouches[0].identifier;
                el.classList.add('active');
                if (window.conn) window.conn.send({ type: 'pedal', pedal, active: true });
                window.vibrate(vibrateMs);
            }
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === ownTouchId) {
                    ownTouchId = null;
                    el.classList.remove('active');
                    if (window.conn) window.conn.send({ type: 'pedal', pedal, active: false });
                    break;
                }
            }
        }, { passive: true });

        el.addEventListener('touchcancel', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === ownTouchId) {
                    ownTouchId = null;
                    el.classList.remove('active');
                    if (window.conn) window.conn.send({ type: 'pedal', pedal, active: false });
                    break;
                }
            }
        }, { passive: true });
    });
};

// ─── BUTTON STEERING SETUP ───
window.setupSteeringListeners = () => {
    const btnConfig = [
        { id: 'steer-left',  pedal: 'left'  },
        { id: 'steer-right', pedal: 'right' },
    ];

    btnConfig.forEach(({ id, pedal }) => {
        const el = document.getElementById(id);
        if (!el) return;

        let ownTouchId = null;

        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (ownTouchId === null) {
                ownTouchId = e.changedTouches[0].identifier;
                if (window.conn) window.conn.send({ type: 'pedal', pedal, active: true });
                window.vibrate(30);
            }
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === ownTouchId) {
                    ownTouchId = null;
                    if (window.conn) window.conn.send({ type: 'pedal', pedal, active: false });
                    break;
                }
            }
        }, { passive: true });

        el.addEventListener('touchcancel', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === ownTouchId) {
                    ownTouchId = null;
                    if (window.conn) window.conn.send({ type: 'pedal', pedal, active: false });
                    break;
                }
            }
        }, { passive: true });
    });

    // Gear shifters (manual mode)
    const gearConfig = [
        { id: 'gear-up',   key: 'ArrowUp'   },
        { id: 'gear-down', key: 'ArrowDown' },
    ];

    gearConfig.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (!el) return;

        let ownTouchId = null;

        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (ownTouchId === null) {
                ownTouchId = e.changedTouches[0].identifier;
                if (window.conn) window.conn.send({ type: 'keydown', key });
                window.vibrate(50);
            }
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === ownTouchId) {
                    ownTouchId = null;
                    if (window.conn) window.conn.send({ type: 'keyup', key });
                    break;
                }
            }
        }, { passive: true });

        el.addEventListener('touchcancel', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === ownTouchId) {
                    ownTouchId = null;
                    if (window.conn) window.conn.send({ type: 'keyup', key });
                    break;
                }
            }
        }, { passive: true });
    });
};

// ─── STEERING WHEEL SETUP ───
// Touch listeners ONLY on #wheel-zone — nothing else is affected.
window.setupRemoteWheel = () => {
    const wheelZone = document.getElementById('wheel-zone');
    const wheelInner = document.getElementById('wheel-inner');
    if (!wheelZone) return;

    const getAngle = (tx, ty) => {
        const r = wheelZone.getBoundingClientRect();
        return Math.atan2(ty - (r.top + r.height / 2), tx - (r.left + r.width / 2));
    };

    // TOUCHSTART — only on the wheel zone element
    wheelZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (window.currentSteeringMode !== 'wheel') return;
        if (window.activeWheelTouchId !== null) return; // already have a wheel touch

        const t = e.changedTouches[0];
        window.activeWheelTouchId = t.identifier;
        window.lastWheelAngle = getAngle(t.clientX, t.clientY);
    }, { passive: false });

    // TOUCHMOVE — only on the wheel zone element
    wheelZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (window.currentSteeringMode !== 'wheel') return;

        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            if (t.identifier === window.activeWheelTouchId) {
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
                break;
            }
        }
    }, { passive: false });

    // TOUCHEND — listen globally so we catch the finger leaving the wheel area
    const onWheelTouchEnd = (e) => {
        if (window.activeWheelTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === window.activeWheelTouchId) {
                window.activeWheelTouchId = null;
                break;
            }
        }
    };

    window.addEventListener('touchend', onWheelTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onWheelTouchEnd, { passive: true });

    // Auto-center animation
    const animateAutoCenter = () => {
        if (window.activeWheelTouchId === null && window.currentSteeringMode === 'wheel') {
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

// ─── SETTINGS SYNC & UI CONFIG ───

window.toggleRemoteSettings = () => {
    const modal = document.getElementById('remote-settings-modal');
    if (modal) modal.style.display = (modal.style.display === 'none') ? 'flex' : 'none';
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

// ─── APPLY GAME CONFIG FROM HOST ───
window.applyGameConfig = (config) => {
    window.currentSteeringMode = config.steering;
    const wheel = document.getElementById('wheel-zone');
    const buttons = document.getElementById('button-steering');
    const pedals = document.getElementById('pedal-zone');
    const revBtn = document.getElementById('reverse');
    const gearShifters = document.getElementById('gear-shifters');

    // Sync remote settings dropdowns
    const steerSel = document.getElementById('remote-setting-steering');
    if (steerSel) steerSel.value = config.steering;
    const transSel = document.getElementById('remote-setting-transmission');
    if (transSel) transSel.value = config.transmission;
    const engVol = document.getElementById('remote-setting-engine-vol');
    if (engVol) engVol.value = config.engineVol;
    const musVol = document.getElementById('remote-setting-music-vol');
    if (musVol) musVol.value = config.musicVol;

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
        if (pedals) pedals.style.bottom = '20px';
        const inner = document.getElementById('wheel-inner');
        if (inner) inner.style.opacity = '1';
    } else if (config.steering === 'buttons') {
        if (buttons) buttons.style.display = 'flex';
        if (pedals) pedals.style.bottom = '20px';
    } else if (config.steering === 'gyro') {
        // Gyro: show wheel visual dimmed as passive indicator
        if (wheel) {
            wheel.style.display = 'flex';
            const inner = document.getElementById('wheel-inner');
            if (inner) inner.style.opacity = '0.3';
        }
        if (pedals) pedals.style.bottom = '20px';
    }

    // Release any active wheel touch on mode change
    if (config.steering !== 'wheel') {
        window.activeWheelTouchId = null;
    }
};
