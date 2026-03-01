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
        if (remoteBox) {
            remoteBox.innerText = "CONTROLLER CONNECTED";
            remoteBox.onclick = () => { window.toggleSettings && window.toggleSettings(); };
        }

        const statusBtn = document.getElementById('settings-remote-status');
        if (statusBtn) {
            statusBtn.innerText = "CONTROLLER CONNECTED";
            statusBtn.style.color = "#00ffff";
            statusBtn.style.borderColor = "#00ffff";
            statusBtn.style.background = "rgba(0,255,255,0.05)";
        }
        window.conn.on('open', () => window.conn.send({ type: 'config', config: window.gameSettings }));
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
                // Send back confirmation to sync other remote if connected
                window.conn.send({ type: 'config', config: window.gameSettings });
            }
            if (data.type === 'keydown') {
                const keyMap = { 'ArrowUp': 38, 'ArrowDown': 40, 'w': 87, 's': 83, 'a': 65, 'd': 68, 'b': 66, ' ': 32 };
                const kc = keyMap[data.key] || 0;
                const ev = new KeyboardEvent('keydown', { key: data.key, code: data.key, keyCode: kc, which: kc, bubbles: true, cancelable: true });
                document.dispatchEvent(ev);
            }
            if (data.type === 'keyup') {
                const keyMap = { 'ArrowUp': 38, 'ArrowDown': 40, 'w': 87, 's': 83, 'a': 65, 'd': 68, 'b': 66, ' ': 32 };
                const kc = keyMap[data.key] || 0;
                const ev = new KeyboardEvent('keyup', { key: data.key, code: data.key, keyCode: kc, which: kc, bubbles: true, cancelable: true });
                document.dispatchEvent(ev);
            }
        });
    });
};

window.toggleControllerConnection = () => {
    if (window.initAudio) window.initAudio();
    const statusBtn = document.getElementById('settings-remote-status');
    const remoteBox = document.getElementById('remote-box');

    if (window.peer && !window.peer.disconnected) {
        if (confirm("Disconnect the current phone controller?")) {
            window.peer.destroy();
            window.peer = null;
            window.conn = null;

            if (statusBtn) {
                statusBtn.innerText = "CONTROLLER DISCONNECTED";
                statusBtn.style.color = "gray";
                statusBtn.style.borderColor = "gray";
                statusBtn.style.background = "rgba(255,255,255,0.05)";
            }

            if (remoteBox) {
                remoteBox.innerText = "🤳 SYNC PHONE";
                remoteBox.style.background = "rgba(0, 0, 0, 0.4)";
                remoteBox.style.color = "white";
                remoteBox.onclick = () => { window.initAudio(); window.setupRemote(); };
            }
        }
    } else {
        window.setupRemote();
        if (window.peer) {
            const qrOverlay = document.getElementById('qr-overlay');
            const settingsModal = document.getElementById('settings-modal');
            if (qrOverlay) qrOverlay.style.display = 'flex';
            if (settingsModal) settingsModal.style.display = 'none';
        }
    }
};
