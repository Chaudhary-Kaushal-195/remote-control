window.currentSteeringMode = 'gyro';
window.activeWheelTouchId = null;
window.lastWheelAngle = 0;
window.remoteWheelAngle = 0;

window.vibrate = (ms) => {
    if (navigator.vibrate) navigator.vibrate(ms);
}

window.setupPedals = () => {
    const gas = document.getElementById('gas');
    const brake = document.getElementById('brake');
    const reverse = document.getElementById('reverse');
    const gearUp = document.getElementById('gear-up');
    const gearDown = document.getElementById('gear-down');

    if (gas) {
        gas.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'pedal', pedal: 'fwd', active: true }); window.vibrate(20); });
        gas.addEventListener('touchend', () => { if (window.conn) window.conn.send({ type: 'pedal', pedal: 'fwd', active: false }); });
    }

    if (brake) {
        brake.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'pedal', pedal: 'brake', active: true }); window.vibrate(70); });
        brake.addEventListener('touchend', () => { if (window.conn) window.conn.send({ type: 'pedal', pedal: 'brake', active: false }); });
    }

    if (reverse) {
        reverse.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'pedal', pedal: 'bwd', active: true }); window.vibrate(40); });
        reverse.addEventListener('touchend', () => { if (window.conn) window.conn.send({ type: 'pedal', pedal: 'bwd', active: false }); });
    }

    if (gearUp) {
        gearUp.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'keydown', key: 'ArrowUp' }); window.vibrate(50); });
        gearUp.addEventListener('touchend', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'keyup', key: 'ArrowUp' }); });
    }

    if (gearDown) {
        gearDown.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'keydown', key: 'ArrowDown' }); window.vibrate(50); });
        gearDown.addEventListener('touchend', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'keyup', key: 'ArrowDown' }); });
    }
}

window.setupSteeringListeners = () => {
    const left = document.getElementById('steer-left');
    const right = document.getElementById('steer-right');

    if (left) {
        left.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'pedal', pedal: 'left', active: true }); window.vibrate(30); });
        left.addEventListener('touchend', () => { if (window.conn) window.conn.send({ type: 'pedal', pedal: 'left', active: false }); });
    }

    if (right) {
        right.addEventListener('touchstart', (e) => { e.preventDefault(); if (window.conn) window.conn.send({ type: 'pedal', pedal: 'right', active: true }); window.vibrate(30); });
        right.addEventListener('touchend', () => { if (window.conn) window.conn.send({ type: 'pedal', pedal: 'right', active: false }); });
    }
}

window.toggleRemoteSettings = () => {
    const modal = document.getElementById('remote-settings-modal');
    modal.style.display = (modal.style.display === 'none') ? 'flex' : 'none';
};

window.syncSettingsToHost = () => {
    if (!window.conn) return;
    const steering = document.getElementById('remote-setting-steering').value;
    const transmission = document.getElementById('remote-setting-transmission').value;

    window.conn.send({
        type: 'updateSettings',
        settings: { steering, transmission }
    });
};

window.setupRemoteWheel = () => {
    const wheelZone = document.getElementById('wheel-zone');
    const wheelInner = document.getElementById('wheel-inner');
    if (!wheelZone) return;

    const getAngle = (tx, ty) => {
        const r = wheelZone.getBoundingClientRect();
        return Math.atan2(ty - (r.top + r.height / 2), tx - (r.left + r.width / 2));
    };

    wheelZone.addEventListener('touchstart', (e) => {
        if (window.currentSteeringMode !== 'wheel') return;
        const t = e.changedTouches[0];
        window.activeWheelTouchId = t.identifier;
        window.lastWheelAngle = getAngle(t.clientX, t.clientY);
        e.preventDefault();
    }, { passive: false });

    wheelZone.addEventListener('touchmove', (e) => {
        if (window.currentSteeringMode !== 'wheel') return;
        for (let t of e.changedTouches) {
            if (t.identifier === window.activeWheelTouchId) {
                const cur = getAngle(t.clientX, t.clientY);
                let d = cur - window.lastWheelAngle;
                if (d > Math.PI) d -= Math.PI * 2;
                if (d < -Math.PI) d += Math.PI * 2;

                window.remoteWheelAngle = Math.max(-180, Math.min(180, window.remoteWheelAngle + (d * 180 / Math.PI) * 1.5));
                if (wheelInner) wheelInner.style.transform = `rotate(${window.remoteWheelAngle}deg)`;

                if (window.conn && window.conn.open) {
                    window.conn.send({ type: 'gyro', tilt: window.remoteWheelAngle });
                }
                window.lastWheelAngle = cur;
                break;
            }
        }
        e.preventDefault();
    }, { passive: false });

    wheelZone.addEventListener('touchend', (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === window.activeWheelTouchId) {
                window.activeWheelTouchId = null;
                // Auto-center or leave? Let's auto-center slowly via physics later, 
                // but for now we stop sending updates.
                break;
            }
        }
    });
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
        // Gyro uses wheel-inner for visual feedback but no steering buttons
        if (wheel) {
            wheel.style.display = 'flex';
            const inner = document.getElementById('wheel-inner');
            if (inner) inner.style.opacity = '0.3'; // Dim it so user knows it's passive
        }
        if (pedals) pedals.style.bottom = '40px';
    }
}
