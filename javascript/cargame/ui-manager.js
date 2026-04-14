// UI Manager Component
window.isPaused = false;
window.gameSettings = {
    steering: 'wheel',
    units: 'kph',
    transmission: 'automatic',
    controlHud: 'on',
    engineVol: 80,
    musicVol: 50
};

window.toggleTransmission = () => {
    // Correctly toggle between 'automatic' and 'manual'
    if (window.gameSettings.transmission === 'automatic') {
        window.gameSettings.transmission = 'manual';
    } else {
        window.gameSettings.transmission = 'automatic';
    }

    // Update the button visuals immediately
    const transBtn = document.getElementById('trans-trigger-btn');
    if (transBtn) {
        const isAuto = window.gameSettings.transmission === 'automatic';
        transBtn.innerText = isAuto ? "AUTO" : "MANUAL";
        transBtn.style.borderColor = isAuto ? "var(--neon-blue)" : "var(--neon-pink)";
        transBtn.style.color = isAuto ? "var(--neon-blue)" : "var(--neon-pink)";
    }

    // Save to localStorage directly to avoid reading from (possibly closed) modal
    localStorage.setItem('drViceSettings', JSON.stringify(window.gameSettings));

    // Update visibility of elements that depend on transmission state (like REV pedal)
    if (window.applyHUDVisibility) window.applyHUDVisibility();

    // Sync to remote if connected
    if (window.conn && window.conn.open) {
        window.conn.send({ type: 'config', config: window.gameSettings });
    }
};

window.togglePause = () => {
    window.isPaused = !window.isPaused;
    document.getElementById('pause-btn').innerText = window.isPaused ? "▶ RESUME" : "⏸ PAUSE";
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = window.isPaused ? 'flex' : 'none';

    if (window.setEngineAudioMute) {
        window.setEngineAudioMute(window.isPaused);
    }
};

window.checkSteeringChange = () => {
    const sel = document.getElementById('setting-steering');
    if (sel.value === 'gyro' && !window.peer) {
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
    window.gameSettings.steering = document.getElementById('setting-steering')?.value || window.gameSettings.steering;
    window.gameSettings.units = document.getElementById('setting-units')?.value || window.gameSettings.units;
    // Transmission is handled by toggleTransmission
    window.gameSettings.engineVol = document.getElementById('setting-engine-vol')?.value || window.gameSettings.engineVol;
    window.gameSettings.musicVol = document.getElementById('setting-music-vol')?.value || window.gameSettings.musicVol;
    const hudToggle = document.getElementById('setting-hud-toggle');
    if (hudToggle) window.gameSettings.controlHud = hudToggle.value;

    localStorage.setItem('drViceSettings', JSON.stringify(window.gameSettings));

    if (window.applyHUDVisibility) window.applyHUDVisibility();
    if (window.setEngineVolume) window.setEngineVolume(window.gameSettings.engineVol);

    // Sync to remote if connected
    if (window.conn && window.conn.open) {
        window.conn.send({ type: 'config', config: window.gameSettings });
    }
};

window.loadSettingsToModal = function () {
    const saved = localStorage.getItem('drViceSettings');
    if (saved) {
        const s = JSON.parse(saved);
        document.getElementById('setting-steering').value = s.steering || 'wheel';
        document.getElementById('setting-units').value = s.units || 'kph';
        if (document.getElementById('setting-transmission')) {
            document.getElementById('setting-transmission').value = s.transmission || 'automatic';
        }
        document.getElementById('setting-engine-vol').value = s.engineVol || 80;
        document.getElementById('setting-music-vol').value = s.musicVol || 50;

        // Sync HUD button on load
        const transBtn = document.getElementById('trans-trigger-btn');
        const currentTrans = s.transmission || 'automatic';
        if (transBtn) {
            transBtn.innerText = currentTrans === 'automatic' ? "AUTO" : "MANUAL";
            transBtn.style.borderColor = currentTrans === 'automatic' ? "var(--neon-blue)" : "var(--neon-pink)";
            transBtn.style.color = currentTrans === 'automatic' ? "var(--neon-blue)" : "var(--neon-pink)";
        }

        if (document.getElementById('setting-hud-toggle')) {
            document.getElementById('setting-hud-toggle').value = s.controlHud || 'on';
        }
        window.gameSettings = Object.assign(window.gameSettings, s);
    }

    // Sync connection UI every time modal is loaded
    if (window.updateControllerUI) {
        const isConnected = !!(window.conn && window.conn.open);
        window.updateControllerUI(isConnected);
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
        if (window.refreshGyroOptionState) window.refreshGyroOptionState();
    }
};

window.toggleDebugPanel = () => {
    const gui = document.querySelector('.dg.ac');
    if (!gui) return;
    const isHidden = gui.style.display === 'none';
    gui.style.display = isHidden ? 'block' : 'none';

    const btn = document.getElementById('details-trigger-btn');
    if (btn) {
        btn.innerText = isHidden ? "CLOSE CONTROLS" : "MORE DETAILS";
        btn.style.borderColor = isHidden ? "var(--neon-pink)" : "var(--neon-blue)";
        btn.style.color = isHidden ? "var(--neon-pink)" : "var(--neon-blue)";
    }
};

window.updateControllerUI = (isConnected) => {
    const statusRow = document.getElementById('settings-phone-status');
    const remoteBox = document.getElementById('remote-box');

    if (statusRow) {
        const isUsingPhone = isConnected && window.activeInputSource === 'phone';
        if (isConnected) {
            statusRow.innerHTML = `
                <span style="color: #00ffff; text-transform: uppercase;">PHONE CONNECTED</span>
                ${isUsingPhone ? 
                    `<button class="hud-btn" onclick="window.activateInputSource('keyboard')" 
                        style="padding: 6px 14px; font-size: 10px; border-color: #ff0055; color: #ff0055; cursor: pointer; border-radius: 8px;">
                        EXIT
                    </button>` :
                    `<button class="hud-btn" onclick="window.activateInputSource('phone')" 
                        style="padding: 6px 14px; font-size: 10px; border-color: #00ffff; color: #00ffff; cursor: pointer; border-radius: 8px;">
                        USE
                    </button>`
                }
                <button class="hud-btn" onclick="window.toggleControllerConnection()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: #fff; color: #fff; opacity: 0.5; cursor: pointer; border-radius: 8px; margin-left: 5px;">
                    DISCONNECT
                </button>
            `;
            statusRow.style.borderColor = "#00ffff";
            statusRow.style.background = "rgba(0,255,255,0.05)";
        } else {
            statusRow.innerHTML = `
                <span style="color: gray; text-transform: uppercase;">PHONE DISCONNECTED</span>
                <button class="hud-btn" onclick="window.toggleControllerConnection()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: #0ffffa; color: #0ffffa; cursor: pointer; border-radius: 8px;">
                    CONNECT
                </button>
            `;
            statusRow.style.borderColor = "gray";
            statusRow.style.background = "rgba(255,255,255,0.05)";
        }
    }

    if (remoteBox) {
        let phoneRow = "";
        let gamepadRow = "";
        
        const isPhoneInUse = isPhoneConnected && window.activeInputSource === 'phone';
        const isGamepadInUse = window.gamepadConnected && window.activeInputSource === 'gamepad';

        if (isPhoneConnected) {
            phoneRow = `<div style="color: #0ffffa;">PHONE CONNECTED${isPhoneInUse ? ' <span style="font-size:8px; opacity:0.8;">(IN USE)</span>' : ''}</div>`;
        } else if (window.lastPeerId) {
            phoneRow = `<div style="color: #0ffffa; opacity: 0.8;">ID: ${window.lastPeerId} (CLICK FOR QR)</div>`;
        } else {
            phoneRow = `<div style="color: white; opacity: 0.6;">🤳 SYNC PHONE</div>`;
        }

        if (window.gamepadConnected) {
            gamepadRow = `<div style="color: var(--neon-pink);">GAMEPAD CONNECTED${isGamepadInUse ? ' <span style="font-size:8px; opacity:0.8;">(IN USE)</span>' : ''}</div>`;
        }

        remoteBox.innerHTML = (phoneRow + gamepadRow).trim();
        remoteBox.style.background = "rgba(0,0,0,0.6)";

        // Logic for clicking: 
        // 1. If phone is NOT connected but we have an ID -> Show QR
        // 2. If phone IS connected -> Open Settings
        // 3. Default -> Init Audio and Setup Remote
        if (!isPhoneConnected && window.lastPeerId) {
            remoteBox.onclick = () => { document.getElementById('qr-overlay').style.display = 'flex'; };
        } else if (isPhoneConnected || window.gamepadConnected) {
            remoteBox.onclick = () => { window.toggleSettings && window.toggleSettings(); };
        } else {
            remoteBox.onclick = () => { window.initAudio(); window.setupRemote(true); };
        }
    }

    if (window.updateGamepadUI) window.updateGamepadUI(!!window.gamepadConnected);
};

window.gamepadConnected = false;
window.gamepadIndex = null;

window.updateGamepadUI = (isConnected) => {
    const statusRow = document.getElementById('settings-gamepad-status');
    if (statusRow) {
        const isUsingGamepad = isConnected && window.activeInputSource === 'gamepad';
        if (isConnected) {
            statusRow.innerHTML = `
                <span style="color: var(--neon-pink); text-transform: uppercase;">GAMEPAD CONNECTED</span>
                ${isUsingGamepad ? 
                    `<button class="hud-btn" onclick="window.activateInputSource('keyboard')" 
                        style="padding: 6px 14px; font-size: 10px; border-color: #ff0055; color: #ff0055; cursor: pointer; border-radius: 8px;">
                        EXIT
                    </button>` :
                    `<button class="hud-btn" onclick="window.activateInputSource('gamepad')" 
                        style="padding: 6px 14px; font-size: 10px; border-color: var(--neon-pink); color: var(--neon-pink); cursor: pointer; border-radius: 8px;">
                        USE
                    </button>`
                }
                <button class="hud-btn" onclick="window.manualGamepadDisconnect()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: #fff; color: #fff; opacity: 0.5; cursor: pointer; border-radius: 8px; margin-left: 5px;">
                    DISCONNECT
                </button>
            `;
            statusRow.style.borderColor = "var(--neon-pink)";
            statusRow.style.background = "rgba(240, 146, 255, 0.05)";
        } else {
            statusRow.innerHTML = `
                <span style="color: gray; text-transform: uppercase;">GAMEPAD DISCONNECTED</span>
                <button class="hud-btn" onclick="window.toggleGamepadConnection()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: gray; color: gray; cursor: pointer; border-radius: 8px;">
                    CONNECT
                </button>
            `;
            statusRow.style.borderColor = "gray";
            statusRow.style.background = "rgba(255,255,255,0.05)";
        }
    }
};

window.activateInputSource = (source) => {
    window.activeInputSource = source;
    
    // Auto-set the steering mode for better defaults
    if (source === 'phone') {
        // If phone connects, try to use gyro but allow other modes
        if (window.gameSettings.steering !== 'gyro' && window.gameSettings.steering !== 'buttons' && window.gameSettings.steering !== 'wheel') {
            window.gameSettings.steering = 'gyro';
        }
    } else if (source === 'gamepad') {
        window.gameSettings.steering = 'gamepad';
    } else {
        // Keyboard/Laptop
        if (window.gameSettings.steering === 'gamepad' || window.gameSettings.steering === 'gyro') {
            window.gameSettings.steering = 'wheel';
        }
    }

    if (window.saveSettings) window.saveSettings();
    
    if (window.showGameNotification) {
        const label = source === 'keyboard' ? 'LAPTOP 💻' : source.toUpperCase();
        const color = source === 'gamepad' ? 'var(--neon-pink)' : (source === 'phone' ? '#00ffff' : 'white');
        window.showGameNotification(`INPUT SOURCE: ${label} 🏎️`, color);
    }

    // Force UI refresh
    window.updateControllerUI(!!(window.conn && window.conn.open));
    if (window.updateGamepadUI) window.updateGamepadUI(!!window.gamepadConnected);
};

window.manualGamepadDisconnect = () => {
    if (confirm("Disconnect and forget the current gamepad?")) {
        window.gamepadConnected = false;
        window.gamepadIndex = null;
        if (window.gameSettings.steering === 'gamepad') {
            window.activateSteering('wheel');
        }
        window.updateGamepadUI(false);
        if (window.showGameNotification) window.showGameNotification("GAMEPAD RESET ❌", "#ff0055");
    }
};

window.toggleGamepadConnection = () => {
    alert('Press any button on your gamepad to connect it.');
};

// --- GYRO HARDWARE DETECTION ---
window.laptopHasGyro = false;
if (window.DeviceOrientationEvent) {
    const checkGyro = (event) => {
        if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
            window.laptopHasGyro = true;
            if (window.refreshGyroOptionState) window.refreshGyroOptionState();
            window.removeEventListener('deviceorientation', checkGyro);
        }
    };
    window.addEventListener('deviceorientation', checkGyro);
    // Timeout after 2 seconds if no data received
    setTimeout(() => window.removeEventListener('deviceorientation', checkGyro), 2000);
}

window.refreshGyroOptionState = () => {
    const opt = document.getElementById('opt-gyro');
    if (!opt) return;

    const isPhoneConnected = !!(window.conn && window.conn.open);
    const hasGamepad = !!window.gamepadConnected;
    // For gamepad, we assume it has gyro if it's a modern one (simplification for UI)
    // but the user said "gyro senser" specifically.
    // For now, let's stick to explicitly detected laptop gyro or connected phone.
    
    const anyGyroActive = window.laptopHasGyro || isPhoneConnected;

    if (anyGyroActive) {
        opt.disabled = false;
        opt.style.opacity = "1";
        opt.style.display = "block"; // Ensure it shows if it was hidden
    } else {
        opt.disabled = true;
        opt.style.opacity = "0.3";
        // If current steering is gyro but no gyro exists anymore, revert to wheel
        if (window.gameSettings.steering === 'gyro') {
            window.activateSteering('wheel');
        }
    }
};

window.addEventListener("gamepadconnected", (e) => {
    window.gamepadConnected = true;
    window.gamepadIndex = e.gamepad.index;
    if (window.updateGamepadUI) window.updateGamepadUI(true);
    if (window.startGamepadLoop) window.startGamepadLoop();
    if (window.showGameNotification) window.showGameNotification("GAMEPAD CONNECTED ✅", "#f092ff");
});

window.addEventListener("gamepaddisconnected", (e) => {
    if (e.gamepad.index === window.gamepadIndex) {
        window.gamepadConnected = false;
        window.gamepadIndex = null;
        if (window.updateGamepadUI) window.updateGamepadUI(false);
        if (window.showGameNotification) window.showGameNotification("GAMEPAD DISCONNECTED ❌", "#ff0055");
    }
});

window.toggleControllerConnection = () => {
    if (window.initAudio) window.initAudio();

    // Be very strict: Only connected if conn exists and is open
    const isConnected = !!(window.conn && window.conn.open);

    if (isConnected) {
        if (confirm("Disconnect the current phone remote?")) {
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

document.addEventListener('DOMContentLoaded', () => {
    window.loadSettingsToModal();

    // Hide debug panel by default after a short delay for dat.gui to init
    setTimeout(() => {
        const gui = document.querySelector('.dg.ac');
        if (gui) gui.style.display = 'none';
    }, 500);

    const checkGamepads = () => {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for(let i=0; i<gamepads.length; i++) {
            if(gamepads[i]) {
                window.gamepadConnected = true;
                window.gamepadIndex = i;
                if (window.updateGamepadUI) window.updateGamepadUI(true);
                if (window.startGamepadLoop) window.startGamepadLoop();
                break;
            }
        }
    };
    // small delay to allow gamepad api init
    setTimeout(checkGamepads, 500);
});
