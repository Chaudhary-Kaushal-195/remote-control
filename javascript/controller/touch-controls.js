window.vibrate = (ms) => {
    if (navigator.vibrate) navigator.vibrate(ms);
}

window.setupPedals = () => {
    const gas = document.getElementById('gas');
    const brake = document.getElementById('brake');
    const reverse = document.getElementById('reverse');

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

window.applyGameConfig = (config) => {
    const wheel = document.getElementById('wheel-zone');
    const buttons = document.getElementById('button-steering');
    const pedals = document.getElementById('pedal-zone');

    if (wheel) wheel.style.display = 'none';
    if (buttons) buttons.style.display = 'none';

    if (config.steering === 'wheel') {
        if (wheel) wheel.style.display = 'flex';
        if (pedals) pedals.style.bottom = '40px';
    } else if (config.steering === 'buttons') {
        if (buttons) buttons.style.display = 'flex';
        if (pedals) pedals.style.bottom = '220px';
    }
}
