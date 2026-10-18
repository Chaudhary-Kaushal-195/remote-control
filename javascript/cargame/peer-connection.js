window.peer = null;
window.conn = null;
window.remoteInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };
window.localInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };
window.activeInputSource = 'keyboard'; // 'keyboard', 'phone', or 'gamepad'

// Keep window.inputs in sync via STRICT combinations (Exclusive Mode)
window.syncMergedInputs = () => {
    if (!window.inputs) window.inputs = {};
    const keys = ['fwd', 'bwd', 'handbrake', 'brake', 'left', 'right'];

    const isPhoneConnected = !!(window.conn && window.conn.open);
    const isGamepadConnected = !!window.gamepadConnected;
    const source = window.activeInputSource || 'keyboard';

    keys.forEach(k => {
        if (source === 'phone' && isPhoneConnected) {
            // STRICTLY Phone - captures all remote inputs (buttons + gyro-processed-left/right)
            window.inputs[k] = window.remoteInputs[k] || false;
        } else if (source === 'gamepad' && isGamepadConnected) {
            // STRICTLY Gamepad - captures all gamepad buttons
            window.inputs[k] = (window.gamepadInputs && window.gamepadInputs[k]) || false;
        } else {
            // DEFAULT to Laptop/Keyboard
            window.inputs[k] = window.localInputs[k] || false;
        }
    });

    if (window.updateButtonGlow) {
        window.updateButtonGlow();
    }

};

window.setupRemote = (showQR = false) => {
    const remoteBox = document.getElementById('remote-box');
    
    // If peer exists, check if it's still alive and connected to signaling server
    if (window.peer && !window.peer.destroyed) {
        if (window.peer.disconnected) {
            // Reconnect if just disconnected from signaling server
            window.peer.reconnect();
        }
        if (showQR) document.getElementById('qr-overlay').style.display = 'flex';
        return;
    }

    if (window.location.protocol === 'file:') {
        alert("CRITICAL: You are running this as a local file. Your phone CANNOT connect to a 'file://' link. \n\n Please use a local webserver instead!");
        return;
    }

    window.peer = new Peer();
    
    window.peer.on('open', (id) => {
        window.lastPeerId = id;
        console.log('Laptop Peer ID:', id);

        const baseUrl = window.location.href.split('pages/cargame.html')[0] + 'pages/controller.html';
        const url = `${baseUrl}?hostId=${id}`;
        
        // Let updateControllerUI handle the HUD display consistently
        if (window.updateControllerUI) window.updateControllerUI(!!(window.conn && window.conn.open));

        const qrContainer = document.getElementById('qr-code');
        if (qrContainer) {
            qrContainer.innerHTML = "";
            new QRCode(qrContainer, {
                text: url,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    });

    window.peer.on('error', (err) => {
        console.error('Peer Error:', err.type, err);
        if (remoteBox) {
            remoteBox.innerText = "REMOTE ERROR: " + err.type;
            remoteBox.style.background = "rgba(255, 0, 0, 0.2)";
        }
        // If critical error, destroy and allow setupRemote to remake it next time
        if (err.type === 'peer-unavailable' || err.type === 'network' || err.type === 'server-error') {
            window.lastPeerId = null;
            if (window.peer) window.peer.destroy();
            window.peer = null;
        }
    });

    window.peer.on('disconnected', () => {
        console.warn('Peer disconnected from signaling server. Attempting reconnect...');
        if (window.peer && !window.peer.destroyed) {
            window.peer.reconnect();
        }
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
            if (window.refreshGyroOptionState) window.refreshGyroOptionState();
            
            // AUTO-SWITCH TO PHONE INPUT:
            if (window.activateInputSource) window.activateInputSource('phone');
            
            window.syncMergedInputs();

            // Show connection toast
            window.showGameNotification("REMOTE CONNECTED ✅");
        });
        window.conn.on('data', (data) => {
            window.handleIncomingControllerData(data);
        });
        window.conn.on('close', () => {
            window.showGameNotification("REMOTE DISCONNECTED ❌", "#ff0055");
            window.updateControllerUI(false);
            if (window.refreshGyroOptionState) window.refreshGyroOptionState();
            window.conn = null;
            
            // AUTO-RESTORE TO KEYBOARD INPUT:
            if (window.activateInputSource) window.activateInputSource('keyboard');
            
            // Clear remote inputs and restore laptop inputs
            window.remoteInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };
            window.syncMergedInputs();
        });
    });
};

// Unified Data Processing for Both WebRTC and Pure Native WebSocket LAN Controller
window.handleIncomingControllerData = (data) => {
    // Ensure window.conn proxy is active so car-physics and syncMergedInputs know phone is driving
    if (!window.conn || !window.conn.open) {
        window.conn = {
            open: true,
            isNativeBridge: true,
            send: (payload) => {
                if (window.bridgeWs && window.bridgeWs.readyState === WebSocket.OPEN) {
                    window.bridgeWs.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
                }
            },
            close: () => {
                if (window.conn && window.conn.isNativeBridge) {
                    window.conn = null;
                }
            }
        };
        if (window.activateInputSource) window.activateInputSource('phone');
        if (window.updateControllerUI) window.updateControllerUI(true);
    }

    if (data.type === 'gyro') {
        window.gyroTilt = (data.tilt || 0);
        window.gyroActive = true;
        window.lastGyroTime = Date.now();
    }
    if (data.type === 'pedal') {
        const val = data.intensity !== undefined ? data.intensity : (data.active ? 1.0 : 0.0);
        window.remoteInputs[data.pedal] = val;
        window.syncMergedInputs();
    }
    if (data.type === 'gearShift') {
        window.requestGearShift(data.direction);
    }
    if (data.type === 'pause') {
        if (window.togglePause) window.togglePause();
    }
    if (data.type === 'updateSettings') {
        window.gameSettings = Object.assign(window.gameSettings, data.settings);
        localStorage.setItem('drViceSettings', JSON.stringify(window.gameSettings));
        if (window.loadSettingsToModal) window.loadSettingsToModal();
        if (window.applyHUDVisibility) window.applyHUDVisibility();
        if (window.setEngineVolume) window.setEngineVolume(window.gameSettings.engineVol);

        if (window.conn && window.conn.open) {
            window.conn.send({ type: 'config', config: window.gameSettings });
        }
        if (window.bridgeWs && window.bridgeWs.readyState === WebSocket.OPEN) {
            window.bridgeWs.send(JSON.stringify({ type: 'config', config: window.gameSettings }));
        }
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
};

// Automatic Local Native LAN WebSocket Bridge for Dr. Vice Controller
window.updateQrWithLanIp = (ip, port) => {
    const qrContainer = document.getElementById('qr-code');
    const qrOverlay = document.getElementById('qr-overlay');
    if (!qrOverlay) return;

    let ipBanner = document.getElementById('bridge-ip-banner');
    if (!ipBanner) {
        ipBanner = document.createElement('div');
        ipBanner.id = 'bridge-ip-banner';
        ipBanner.style.cssText = 'margin:12px auto; padding:10px 18px; background:rgba(0, 255, 250, 0.12); border:1px solid #0ffffa; border-radius:12px; font-family:"Orbitron", sans-serif; font-size:14px; color:#ffffff; text-align:center; letter-spacing:1px; max-width:320px;';
        const pTag = qrOverlay.querySelector('p');
        if (pTag) {
            qrOverlay.insertBefore(ipBanner, pTag);
        } else {
            qrOverlay.appendChild(ipBanner);
        }
    }
    ipBanner.innerHTML = `<span style="font-size:11px; opacity:0.8;">NATIVE CONTROLLER IP:</span><br><b style="color:#0ffffa; font-size:18px;">${ip}</b><div style="font-size:10px; opacity:0.7; margin-top:4px;">Port: ${port} | Direct Hotspot &amp; Wi-Fi Ready</div>`;

    if (qrContainer && typeof QRCode !== 'undefined') {
        const qrContent = `ws://${ip}:${port}`;
        qrContainer.innerHTML = "";
        new QRCode(qrContainer, {
            text: qrContent,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
};

window.initLocalBridge = () => {
    try {
        const host = window.location.hostname || 'localhost';
        const ws = new WebSocket('ws://' + host + ':8080');
        ws.onopen = () => {
            console.log('🎮 Connected to Native Controller LAN Bridge on port 8080');
            window.bridgeWs = ws;
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'bridgeInfo') {
                    window.bridgeLanIp = data.localIp;
                    window.bridgePort = data.port;
                    window.updateQrWithLanIp(data.localIp, data.port);
                } else if (data.type === 'controllerReady') {
                    window.conn = {
                        open: true,
                        isNativeBridge: true,
                        send: (payload) => {
                            if (window.bridgeWs && window.bridgeWs.readyState === WebSocket.OPEN) {
                                window.bridgeWs.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
                            }
                        },
                        close: () => {
                            if (window.conn && window.conn.isNativeBridge) {
                                window.conn = null;
                            }
                        }
                    };
                    window.updateControllerUI(true);
                    if (window.activateInputSource) window.activateInputSource('phone');
                    window.syncMergedInputs();
                    window.showGameNotification("NATIVE CONTROLLER CONNECTED ✅");
                    // Send game config to phone
                    ws.send(JSON.stringify({ type: 'config', config: window.gameSettings }));
                } else if (data.type === 'controllerDisconnected') {
                    if (window.conn && window.conn.isNativeBridge) {
                        window.conn = null;
                        if (window.updateControllerUI) window.updateControllerUI(false);
                        if (window.activateInputSource) window.activateInputSource('keyboard');
                        window.remoteInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };
                        window.syncMergedInputs();
                        window.showGameNotification("NATIVE CONTROLLER DISCONNECTED ❌", "#ff0055");
                    }
                } else {
                    window.handleIncomingControllerData(data);
                }
            } catch(e) {}
        };
        ws.onclose = () => {
            window.bridgeWs = null;
            if (window.conn && window.conn.isNativeBridge) {
                window.conn = null;
                if (window.updateControllerUI) window.updateControllerUI(false);
                if (window.activateInputSource) window.activateInputSource('keyboard');
                window.remoteInputs = { fwd: false, bwd: false, handbrake: false, brake: false, left: false, right: false };
                window.syncMergedInputs();
            }
            setTimeout(window.initLocalBridge, 3000);
        };
    } catch(e) {}
};
window.initLocalBridge();

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

// Note: window.toggleControllerConnection is defined in ui-manager.js
