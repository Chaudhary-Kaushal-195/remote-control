// Controls and Remote Peer System
window.isPaused = false;
window.gameSettings = {
    steering: 'wheel',
    units: 'kph',
    controlHud: 'on',
    engineVol: 80,
    musicVol: 50
};
window.inputs = { fwd: false, bwd: false, left: false, right: false, handbrake: false, brake: false };
window.gyroActive = false;
window.gyroTilt = 0;
window.manualGearIndex = 1;

let peer = null, conn = null;

window.togglePause = () => {
    window.isPaused = !window.isPaused;
    document.getElementById('pause-btn').innerText = window.isPaused ? "▶ RESUME" : "⏸ PAUSE";
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = window.isPaused ? 'flex' : 'none';
};

window.checkSteeringChange = () => {
    const sel = document.getElementById('setting-steering');
    if (sel.value === 'gyro' && !peer) {
        document.getElementById('gyro-prompt-overlay').style.display = 'flex';
    } else {
        window.saveSettings();
    }
};

window.handleGyroPrompt = (action) => {
    document.getElementById('gyro-prompt-overlay').style.display = 'none';
    if (action === 'connect') {
        window.saveSettings();
        document.getElementById('settings-modal').style.display = 'none';
        window.setupRemote();
    } else {
        const sel = document.getElementById('setting-steering');
        sel.value = window.gameSettings.steering;
    }
};

window.saveSettings = () => {
    window.gameSettings.steering = document.getElementById('setting-steering').value;
    window.gameSettings.units = document.getElementById('setting-units').value;
    window.gameSettings.engineVol = document.getElementById('setting-engine-vol').value;
    window.gameSettings.musicVol = document.getElementById('setting-music-vol').value;
    const hudToggle = document.getElementById('setting-hud-toggle');
    if (hudToggle) window.gameSettings.controlHud = hudToggle.value;

    localStorage.setItem('drViceSettings', JSON.stringify(window.gameSettings));

    if (window.applyHUDVisibility) window.applyHUDVisibility();
};

window.loadSettingsToModal = function () {
    const saved = localStorage.getItem('drViceSettings');
    if (saved) {
        const s = JSON.parse(saved);
        document.getElementById('setting-steering').value = s.steering || 'wheel';
        document.getElementById('setting-units').value = s.units || 'kph';
        document.getElementById('setting-engine-vol').value = s.engineVol || 80;
        document.getElementById('setting-music-vol').value = s.musicVol || 50;
        if (document.getElementById('setting-hud-toggle')) {
            document.getElementById('setting-hud-toggle').value = s.controlHud || 'on';
        }
        window.gameSettings = Object.assign(window.gameSettings, s);
    }
};

window.toggleSettings = () => {
    const modal = document.getElementById('settings-modal');
    const isVisible = modal.style.display === 'flex';
    if (isVisible) {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        window.loadSettingsToModal();
    }
};

// --- REMOTE SYNC (PEERJS) ---
window.setupRemote = () => {
    const remoteBox = document.getElementById('remote-box');
    if (peer) {
        document.getElementById('qr-overlay').style.display = 'flex';
        return;
    }
    if (window.location.protocol === 'file:') {
        alert("CRITICAL: You are running this as a local file. Your phone CANNOT connect to a 'file://' link. \n\n Please use a local webserver instead!");
        return;
    }
    peer = new Peer();
    peer.on('open', (id) => {
        console.log('Laptop Peer ID:', id);

        const baseUrl = window.location.href.split('pages/cargame.html')[0] + 'pages/controller.html';
        const url = `${baseUrl}?hostId=${id}`;
        if (remoteBox) {
            remoteBox.innerText = `ID: ${id} (CLICK FOR QR)`;
            remoteBox.style.background = "rgba(0, 255, 255, 0.1)";
            remoteBox.style.color = "#0ffffa";
            remoteBox.onclick = () => {
                document.getElementById('qr-overlay').style.display = 'flex';
            };
        }

        const qrContainer = document.getElementById('qr-code');
        if (qrContainer) {
            qrContainer.innerHTML = "";
            new QRCode(qrContainer, {
                text: id,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    });
    peer.on('error', (err) => {
        if (remoteBox) {
            remoteBox.innerText = "REMOTE ERROR: " + err.type;
            remoteBox.style.background = "rgba(255, 0, 0, 0.2)";
        }
        alert("Connection Error. Check your internet.");
    });
    peer.on('connection', (c) => {
        conn = c;
        if (remoteBox) remoteBox.innerText = "CONTROLLER CONNECTED";
        conn.on('open', () => conn.send({ type: 'config', config: window.gameSettings }));
        conn.on('data', (data) => {
            if (data.type === 'gyro') {
                window.gyroActive = true;
                window.gyroTilt = (data.tilt || 0);
            }
            if (data.type === 'pedal') {
                window.inputs[data.pedal] = data.active;
            }
        });
    });
};

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

// SETUP EVENT LISTENERS ON DOM LOAD
document.addEventListener('DOMContentLoaded', () => {
    window.loadSettingsToModal();
    window.initHUD();

    const orbitZone = document.getElementById('orbit-zone');
    const wheelZone = document.getElementById('steering-zone');

    // Keybinds
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

    // Touch Support for On-Screen Pads
    window.addEventListener('mousedown', (e) => {
        if (e.target.closest('#gas')) window.inputs.fwd = true;
        if (e.target.closest('#rev-btn')) window.inputs.bwd = true;
        if (e.target.closest('#handbrake')) window.inputs.handbrake = true;
        if (e.target.closest('#steer-left')) window.inputs.left = true;
        if (e.target.closest('#steer-right')) window.inputs.right = true;
    });

    const resetInputs = (e) => {
        if (e.target.closest('#gas')) window.inputs.fwd = false;
        if (e.target.closest('#rev-btn')) window.inputs.bwd = false;
        if (e.target.closest('#handbrake')) window.inputs.handbrake = false;
        if (e.target.closest('#steer-left')) window.inputs.left = false;
        if (e.target.closest('#steer-right')) window.inputs.right = false;
    };
    window.addEventListener('mouseup', resetInputs);
    window.addEventListener('mouseout', resetInputs);

    // Advanced Touch Routing
    let activeId = null, lastAngle = 0;
    const getAngle = (tx, ty) => {
        if (!wheelZone) return 0;
        const r = wheelZone.getBoundingClientRect();
        return Math.atan2(ty - (r.top + r.height / 2), tx - (r.left + r.width / 2));
    };

    window.addEventListener('touchstart', (e) => {
        for (let t of e.changedTouches) {
            if (t.target === orbitZone && window.startOrbit) {
                window.startOrbit(t.clientX, t.clientY, t.identifier);
                continue;
            }

            if (t.target.closest('#gas')) window.inputs.fwd = true;
            if (t.target.closest('#rev-btn')) window.inputs.bwd = true;
            if (t.target.closest('#handbrake')) window.inputs.handbrake = true;
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
            if (t.target.closest('#gas')) window.inputs.fwd = false;
            if (t.target.closest('#rev-btn')) window.inputs.bwd = false;
            if (t.target.closest('#handbrake')) window.inputs.handbrake = false;
            if (t.target.closest('#steer-left')) window.inputs.left = false;
            if (t.target.closest('#steer-right')) window.inputs.right = false;
            if (t.identifier === window.activeTouchId) window.activeTouchId = null;
        }
    });

});
