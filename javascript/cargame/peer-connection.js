// Peer JS Connection Manager
window.peer = null;
window.conn = null;

window.setupRemote = () => {
    const remoteBox = document.getElementById('remote-box');
    if (window.peer) {
        document.getElementById('qr-overlay').style.display = 'flex';
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
        window.updateControllerUI(true);

        window.conn.on('open', () => {
            window.conn.send({ type: 'config', config: window.gameSettings });
            const qrOverlay = document.getElementById('qr-overlay');
            if (qrOverlay) qrOverlay.style.display = 'none';

            // Show connection toast
            window.showGameNotification("REMOTE CONNECTED ✅");
        });
        window.conn.on('data', (data) => {
            if (data.type === 'gyro') {
                window.gyroActive = true;
                window.gyroTilt = (data.tilt || 0);
            }
            if (data.type === 'pedal') {
                window.inputs[data.pedal] = data.active;
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
                document.dispatchEvent(ev);
            }
            if (data.type === 'keyup') {
                const keyMap = { 'ArrowUp': 38, 'ArrowDown': 40, 'w': 87, 's': 83, 'a': 65, 'd': 68, 'b': 66, ' ': 32, 'c': 67 };
                const kc = keyMap[data.key] || 0;
                const ev = new KeyboardEvent('keyup', { key: data.key, code: data.key, keyCode: kc, which: kc, bubbles: true, cancelable: true });
                document.dispatchEvent(ev);
            }
        });
        window.conn.on('close', () => {
            window.showGameNotification("REMOTE DISCONNECTED ❌", "#ff0055");
            window.updateControllerUI(false);
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
        notify.style.top = "5%";
        notify.style.transform = "translate(-50%, -50%) scale(0.9)";
    }, 3000);
};

window.updateControllerUI = (isConnected) => {
    const statusRow = document.getElementById('settings-remote-status');
    const remoteBox = document.getElementById('remote-box');

    if (statusRow) {
        if (isConnected) {
            statusRow.innerHTML = `
                <span style="color: #00ffff">CONTROLLER CONNECTED</span>
                <button class="hud-btn" onclick="window.toggleControllerConnection()" 
                    style="padding: 5px 15px; font-size: 10px; border-color: #ff0055; color: #ff0055; margin-left: 15px;">
                    DISCONNECT
                </button>
            `;
            statusRow.style.borderColor = "#00ffff";
            statusRow.style.background = "rgba(0,255,255,0.05)";
        } else {
            statusRow.innerHTML = `
                <span style="color: gray">CONTROLLER DISCONNECTED</span>
                <button class="hud-btn" onclick="window.toggleControllerConnection()" 
                    style="padding: 5px 15px; font-size: 10px; border-color: #0ffffa; color: #0ffffa; margin-left: 15px;">
                    CONNECT
                </button>
            `;
            statusRow.style.borderColor = "gray";
            statusRow.style.background = "rgba(255,255,255,0.05)";
        }
    }

    if (remoteBox) {
        if (isConnected) {
            remoteBox.innerText = "CONTROLLER CONNECTED";
            remoteBox.style.color = "#0ffffa";
            remoteBox.onclick = () => { window.toggleSettings && window.toggleSettings(); };
        } else {
            remoteBox.innerText = "🤳 SYNC PHONE";
            remoteBox.style.color = "white";
            remoteBox.onclick = () => { window.initAudio(); window.setupRemote(); };
        }
    }
};

window.toggleControllerConnection = () => {
    if (window.initAudio) window.initAudio();

    if (window.conn && window.conn.open) {
        if (confirm("Disconnect the current phone controller?")) {
            window.conn.close();
            // Closing trigger cleanup in the 'close' event automatically
        }
    } else {
        window.setupRemote();
        const qrOverlay = document.getElementById('qr-overlay');
        const settingsModal = document.getElementById('settings-modal');
        if (qrOverlay) qrOverlay.style.display = 'flex';
        if (settingsModal) settingsModal.style.display = 'none';
    }
};
