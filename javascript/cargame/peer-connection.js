window.peer = null;
window.conn = null;
window.remoteInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };
window.localInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };

// Keep window.inputs in sync via STRICT combinations (Exclusive Mode)
window.syncMergedInputs = () => {
    if (!window.inputs) window.inputs = {};
    const keys = ['fwd', 'bwd', 'handbrake', 'brake', 'left', 'right'];

    const isPhoneConnected = !!(window.conn && window.conn.open);
    const isGamepadConnected = !!window.gamepadConnected;
    const steeringMode = window.gameSettings ? window.gameSettings.steering : 'wheel';

    keys.forEach(k => {
        if (steeringMode === 'gyro' && isPhoneConnected) {
            // STRICTLY Phone - ignore laptop and gamepad
            window.inputs[k] = window.remoteInputs[k] || false;
        } else if (steeringMode === 'gamepad' && isGamepadConnected) {
            // STRICTLY Gamepad - ignore laptop and phone
            window.inputs[k] = (window.gamepadInputs && window.gamepadInputs[k]) || false;
        } else {
            // DEFAULT to Laptop/Touch - ignore phone and gamepad
            window.inputs[k] = window.localInputs[k] || false;
        }
    });
};

window.setupRemote = (showQR = false) => {
    const remoteBox = document.getElementById('remote-box');
    if (window.peer) {
        if (showQR) document.getElementById('qr-overlay').style.display = 'flex';
        return;
    }
    if (window.location.protocol === 'file:') {
        alert("CRITICAL: You are running this as a local file. Your phone CANNOT connect to a 'file://' link. \n\n Please use a local webserver instead!");
        return;
    }
    window.peer = new Peer();
    window.peer.on('open', (id) => {
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

    window.peer.on('error', (err) => {
        if (remoteBox) {
            remoteBox.innerText = "REMOTE ERROR: " + err.type;
            remoteBox.style.background = "rgba(255, 0, 0, 0.2)";
        }
        alert("Connection Error. Check your internet.");
    });

    window.peer.on('connection', (c) => {
        window.conn = c;
        // Don't update UI to connected yet, wait for 'open' event

        window.conn.on('open', () => {
            window.conn.send({ type: 'config', config: window.gameSettings });
            const qrOverlay = document.getElementById('qr-overlay');
            if (qrOverlay) qrOverlay.style.display = 'none';

            // Now update UI to connected
            window.updateControllerUI(true);
            window.syncMergedInputs();

            // Show connection toast
            window.showGameNotification("REMOTE CONNECTED ✅");
        });
        window.conn.on('data', (data) => {
            if (data.type === 'gyro') {
                window.gyroActive = true;
                window.gyroTilt = (data.tilt || 0);
            }
            if (data.type === 'pedal') {
                window.remoteInputs[data.pedal] = data.active;
                window.syncMergedInputs();
            }
            if (data.type === 'gearShift') {
                // The audio engine listens on `document` for keyup with event.code
                const code = data.direction === 'up' ? 'ArrowUp' : 'ArrowDown';
                const ev = new KeyboardEvent('keyup', {
                    code: code,
                    key: code,
                    keyCode: code === 'ArrowUp' ? 38 : 40,
                    which: code === 'ArrowUp' ? 38 : 40,
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(ev);
                // Also update manualGearIndex for the HUD
                if (data.direction === 'up') {
                    if (window.manualGearIndex < 6) window.manualGearIndex++;
                } else {
                    if (window.manualGearIndex > -1) window.manualGearIndex--;
                }
            }
            if (data.type === 'pause') {
                if (window.togglePause) window.togglePause();
            }
            if (data.type === 'updateSettings') {
                // Sync settings from remote
                window.gameSettings = Object.assign(window.gameSettings, data.settings);
                localStorage.setItem('drViceSettings', JSON.stringify(window.gameSettings));
                if (window.loadSettingsToModal) window.loadSettingsToModal();
                if (window.applyHUDVisibility) window.applyHUDVisibility();
                if (window.setEngineVolume) window.setEngineVolume(window.gameSettings.engineVol);

                // Send back confirmation to sync other remote if connected
                window.conn.send({ type: 'config', config: window.gameSettings });
            }
            if (data.type === 'keydown') {
                const keyMap = { 'ArrowUp': 38, 'ArrowDown': 40, 'w': 87, 's': 83, 'a': 65, 'd': 68, 'b': 66, ' ': 32, 'c': 67 };
                const kc = keyMap[data.key] || 0;
                const ev = new KeyboardEvent('keydown', { key: data.key, code: data.key, keyCode: kc, which: kc, bubbles: true, cancelable: true });
                window.dispatchEvent(ev);
            }
            if (data.type === 'keyup') {
                const keyMap = { 'ArrowUp': 38, 'ArrowDown': 40, 'w': 87, 's': 83, 'a': 65, 'd': 68, 'b': 66, ' ': 32, 'c': 67 };
                const kc = keyMap[data.key] || 0;
                const ev = new KeyboardEvent('keyup', { key: data.key, code: data.key, keyCode: kc, which: kc, bubbles: true, cancelable: true });
                window.dispatchEvent(ev);
            }
        });
        window.conn.on('close', () => {
            window.showGameNotification("REMOTE DISCONNECTED ❌", "#ff0055");
            window.updateControllerUI(false);
            window.conn = null;
            // Clear remote inputs and restore laptop inputs
            window.remoteInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };
            window.syncMergedInputs();
        });
    });
};

window.showGameNotification = (text, color = "#0ffffa") => {
    let notify = document.getElementById('game-notify');
    if (!notify) {
        notify = document.createElement('div');
        notify.id = 'game-notify';
        notify.style.cssText = `
            position: fixed;
            top: 10%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 16px 32px;
            background: rgba(10, 0, 30, 0.95);
            border: 2px solid ${color};
            border-radius: 20px;
            color: #fff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 900;
            font-size: 20px;
            z-index: 10000;
            box-shadow: 0 0 30px ${color};
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s, transform 0.3s, top 0.3s;
            text-align: center;
            letter-spacing: 2px;
        `;
        document.body.appendChild(notify);
    }
    notify.innerText = text;
    notify.style.borderColor = color;
    notify.style.boxShadow = `0 0 30px ${color}`;
    notify.style.opacity = "1";
    notify.style.top = "10%";
    notify.style.transform = "translate(-50%, -50%) scale(1)";

    if (window.notifyTimeout) clearTimeout(window.notifyTimeout);
    window.notifyTimeout = setTimeout(() => {
        notify.style.opacity = "0";
        notify.style.top = "2%"; // Move it even higher as it fades
        notify.style.transform = "translate(-50%, -50%) scale(0.9)";
    }, 3000);
};

// Note: window.updateControllerUI has been consolidated into ui-manager.js 
// to ensure consistency between phone and gamepad connection UI logic.

window.toggleControllerConnection = () => {
    if (window.initAudio) window.initAudio();

    // Be very strict: Only connected if conn exists and is open
    const isConnected = !!(window.conn && window.conn.open);

    if (isConnected) {
        if (confirm("Disconnect the current phone controller?")) {
            window.conn.close();
            // The 'close' event will trigger updateControllerUI(false)
        }
    } else {
        // We are connecting, so we hide settings to see the QR
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) settingsModal.style.display = 'none';

        window.setupRemote(true);
    }
};
