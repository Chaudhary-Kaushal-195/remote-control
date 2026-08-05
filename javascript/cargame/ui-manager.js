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
        transBtn.style.borderColor = "rgba(255, 255, 255, 0.4)";
        transBtn.style.color = "#ffffff";
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
    window.gameSettings.drivetrain = document.getElementById('setting-drivetrain')?.value || window.gameSettings.drivetrain;
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
        window.gameSettings = { ...window.gameSettings, ...s };
        document.getElementById('setting-steering').value = s.steering || 'wheel';
        document.getElementById('setting-units').value = s.units || 'kph';
        if (document.getElementById('setting-drivetrain')) {
            document.getElementById('setting-drivetrain').value = s.drivetrain || 'rwd';
        }
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
    if (window.applyHUDVisibility) window.applyHUDVisibility();

    // Sync connection UI every time modal is loaded
    if (window.updateControllerUI) {
        const isConnected = !!(window.conn && window.conn.open);
        window.updateControllerUI(isConnected);
    }
    if (window.updateInputSourceToggle) {
        window.updateInputSourceToggle();
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
        btn.style.borderColor = "rgba(255, 255, 255, 0.4)";
        btn.style.color = "#ffffff";
    }
};

window.updateControllerUI = (isConnected) => {
    const statusRow = document.getElementById('settings-phone-status');
    const remoteBox = document.getElementById('remote-box');

    if (statusRow) {
        const isUsingPhone = isConnected && window.activeInputSource === 'phone';
        if (isConnected) {
            statusRow.innerHTML = `
                <span style="color: #ffffff; text-transform: uppercase;">PHONE CONNECTED</span>
                <button class="hud-btn" onclick="window.toggleControllerConnection()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: #fff; color: #fff; opacity: 0.7; cursor: pointer; border-radius: 8px; margin-left: auto;">
                    DISCONNECT
                </button>
            `;
            statusRow.style.borderColor = "rgba(255, 255, 255, 0.3)";
            statusRow.style.background = "rgba(255,255,255,0.08)";
        } else {
            statusRow.innerHTML = `
                <span style="color: gray; text-transform: uppercase;">PHONE DISCONNECTED</span>
                <button class="hud-btn" onclick="window.toggleControllerConnection()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: rgba(255,255,255,0.4); color: #fff; cursor: pointer; border-radius: 8px;">
                    CONNECT
                </button>
            `;
            statusRow.style.borderColor = "rgba(255,255,255,0.15)";
            statusRow.style.background = "rgba(255,255,255,0.03)";
        }
    }

    if (remoteBox) {
        let phoneRow = "";
        let gamepadRow = "";
        
        // Use the argument OR check window.conn state directly for truth
        const phoneConnectedActual = (isConnected === true) || !!(window.conn && window.conn.open);
        const isPhoneInUse = phoneConnectedActual && window.activeInputSource === 'phone';
        const isGamepadInUse = window.gamepadConnected && window.activeInputSource === 'gamepad';

        if (phoneConnectedActual) {
            phoneRow = `<div style="color: #ffffff;">PHONE CONNECTED${isPhoneInUse ? ' <span style="font-size:8px; opacity:0.8;">(IN USE)</span>' : ''}</div>`;
        } else if (window.lastPeerId) {
            phoneRow = `<div style="color: #ffffff; opacity: 0.8;">ID: ${window.lastPeerId} (CLICK FOR QR)</div>`;
        }

        if (window.gamepadConnected) {
            gamepadRow = `<div style="color: #ffffff;">GAMEPAD CONNECTED${isGamepadInUse ? ' <span style="font-size:8px; opacity:0.8;">(IN USE)</span>' : ''}</div>`;
        }

        const combinedHtml = (phoneRow + gamepadRow).trim();
        if (combinedHtml) {
            remoteBox.innerHTML = combinedHtml;
            remoteBox.style.display = "block";
            remoteBox.style.background = "rgba(0,0,0,0.6)";

            if (!phoneConnectedActual && window.lastPeerId) {
                remoteBox.onclick = () => { document.getElementById('qr-overlay').style.display = 'flex'; };
            } else {
                remoteBox.onclick = () => { window.toggleSettings && window.toggleSettings(); };
            }
        } else {
            remoteBox.style.display = "none";
        }
    }

    if (window.updateGamepadUI) window.updateGamepadUI(!!window.gamepadConnected);
    if (window.updateInputSourceToggle) window.updateInputSourceToggle();
};

window.gamepadConnected = false;
window.gamepadIndex = null;

window.updateGamepadUI = (isConnected) => {
    const statusRow = document.getElementById('settings-gamepad-status');
    if (statusRow) {
        const isUsingGamepad = isConnected && window.activeInputSource === 'gamepad';
        if (isConnected) {
            statusRow.innerHTML = `
                <span style="color: #ffffff; text-transform: uppercase;">GAMEPAD CONNECTED</span>
                <button class="hud-btn" onclick="window.manualGamepadDisconnect()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: #fff; color: #fff; opacity: 0.7; cursor: pointer; border-radius: 8px; margin-left: auto;">
                    DISCONNECT
                </button>
            `;
            statusRow.style.borderColor = "rgba(255, 255, 255, 0.3)";
            statusRow.style.background = "rgba(255,255,255,0.08)";
        } else {
            statusRow.innerHTML = `
                <span style="color: gray; text-transform: uppercase;">GAMEPAD DISCONNECTED</span>
                <button class="hud-btn" onclick="window.toggleGamepadConnection()" 
                    style="padding: 6px 14px; font-size: 10px; border-color: gray; color: gray; cursor: pointer; border-radius: 8px;">
                    CONNECT
                </button>
            `;
            statusRow.style.borderColor = "rgba(255,255,255,0.15)";
            statusRow.style.background = "rgba(255,255,255,0.03)";
        }
    }
    if (window.updateInputSourceToggle) window.updateInputSourceToggle();
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
        window.showGameNotification(`INPUT SOURCE: ${label} 🏎️`, 'white');
    }

    // Force UI refresh
    window.updateControllerUI(!!(window.conn && window.conn.open));
    if (window.updateGamepadUI) window.updateGamepadUI(!!window.gamepadConnected);
    if (window.updateInputSourceToggle) window.updateInputSourceToggle();
};

window.updateInputSourceToggle = () => {
    const container = document.getElementById('input-source-toggle');
    if (!container) return;

    const isPhoneConnected = !!(window.conn && window.conn.open);
    const isGamepadConnected = !!window.gamepadConnected;
    const active = window.activeInputSource || 'keyboard';

    const sources = [
        { id: 'keyboard', label: 'LAPTOP', connected: true },
        { id: 'gamepad', label: 'CONTROLLER', connected: isGamepadConnected },
        { id: 'phone', label: 'PHONE', connected: isPhoneConnected }
    ];

    container.innerHTML = sources.map(s => `
        <div class="source-item ${s.id === active ? 'active' : ''} ${!s.connected ? 'disabled' : ''}" 
             data-source="${s.id}"
             onclick="${s.connected ? `window.activateInputSource('${s.id}')` : ''}">
            ${s.label}
        </div>
    `).join('');
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
    if (window.showGameNotification) window.showGameNotification("GAMEPAD CONNECTED ✅", "white");
});

window.addEventListener("gamepaddisconnected", (e) => {
    if (e.gamepad.index === window.gamepadIndex) {
        window.gamepadConnected = false;
        window.gamepadIndex = null;
        if (window.updateGamepadUI) window.updateGamepadUI(false);
        if (window.showGameNotification) window.showGameNotification("GAMEPAD DISCONNECTED ❌", "#ff3b30");
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

// --- CAR ENGINE SOUND STUDIO & TRAINER LOGIC ---
window.activeSoundPreset = localStorage.getItem('drViceActiveSoundPreset') || 'bac_mono';
window.customEngineConfigs = JSON.parse(localStorage.getItem('drViceCustomAudioConfigs') || '{}');
window.studioUploadedFiles = {};

window.defaultSoundPresets = {
    bac_mono: {
        name: 'BAC Mono',
        desc: '2.5L High-Revving Inline-4 Race Engine',
        badge: 'FORMULA STYLE',
        engine: { limiter: 9000, soft_limiter: 8950, limiter_ms: 0, inertia: 1.0 },
        drivetrain: { shiftTime: 50, damping: 16 },
        sounds: {
            on_high: { source: 'audio/BAC_Mono_onhigh.wav', rpm: 1000, volume: 0.5 },
            on_low: { source: 'audio/BAC_Mono_onlow.wav', rpm: 1000, volume: 0.5 },
            off_high: { source: 'audio/BAC_Mono_offveryhigh.wav', rpm: 1000, volume: 0.5 },
            off_low: { source: 'audio/BAC_Mono_offlow.wav', rpm: 1000, volume: 0.5 },
            limiter: { source: 'audio/limiter.wav', volume: 0.4, rpm: 8000 }
        }
    },
    ferr_458: {
        name: 'Ferrari 458 Italia',
        desc: '4.5L Flat-Plane V8 Screamer Engine',
        badge: 'ITALIAN V8',
        engine: { limiter: 8900, soft_limiter: 8800, limiter_ms: 0, inertia: 0.8 },
        drivetrain: { shiftTime: 10, damping: 6 },
        sounds: {
            on_high: { source: 'audio/458/power_2 {1d0b3340-525d-418d-b809-a61f94a1d76a}.wav', rpm: 7700, volume: 2.5 },
            on_low: { source: 'audio/458/mid_res_2 {a777a51b-a829-4637-ac37-ccdaca0a3e9b}.wav', rpm: 5300, volume: 1.5 },
            off_high: { source: 'audio/458/off_higher {b1e2e686-3bd7-43df-9cf9-3b8c1afcffc1}.wav', rpm: 7900, volume: 1.6 },
            off_low: { source: 'audio/458/off_midhigh {94a99615-de6b-4b18-a977-a3b5e9b10641}.wav', rpm: 6900, volume: 1.4 },
            limiter: { source: 'audio/458/limiter.wav', volume: 1.8, rpm: 0 }
        }
    },
    procar: {
        name: 'BMW M1 Procar',
        desc: '3.5L Classic Straight-6 Motorsports Engine',
        badge: 'CLASSIC M RACER',
        engine: { limiter: 9000, soft_limiter: 9000, limiter_ms: 150, inertia: 1.2 },
        drivetrain: { shiftTime: 100, damping: 12 },
        sounds: {
            on_high: { source: 'audio/procar/on_midhigh {eed64b99-c102-43cf-834e-4e4cafa68fdc}.wav', rpm: 8000, volume: 1.0 },
            on_low: { source: 'audio/procar/on_low {0477930f-2954-45ee-8ac4-db4867fe1749}.wav', rpm: 3200, volume: 1.0 },
            off_high: { source: 'audio/procar/off_midhigh {092a60f7-c729-4d2c-979e-2e766ba42c6c}.wav', rpm: 8430, volume: 1.3 },
            off_low: { source: 'audio/procar/off_lower {05f28dcf-8251-4e6a-bc40-8099139ef81e}.wav', rpm: 3400, volume: 1.3 },
            limiter: { source: 'audio/limiter.wav', volume: 0.5, rpm: 8000 }
        }
    }
};

window.toggleSoundStudio = () => {
    const modal = document.getElementById('sound-studio-modal');
    if (!modal) return;
    const isVisible = modal.style.display === 'flex';
    if (isVisible) {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        window.renderStudioPresets();
        window.startStudioRevLoop();
    }
};

window.switchStudioTab = (tab) => {
    const presetsTab = document.getElementById('studio-tab-presets-content');
    const trainerTab = document.getElementById('studio-tab-trainer-content');
    const btnPresets = document.getElementById('tab-btn-presets');
    const btnTrainer = document.getElementById('tab-btn-trainer');

    if (tab === 'presets') {
        presetsTab.style.display = 'block';
        trainerTab.style.display = 'none';
        btnPresets.classList.add('active');
        btnTrainer.classList.remove('active');
    } else {
        presetsTab.style.display = 'none';
        trainerTab.style.display = 'block';
        btnPresets.classList.remove('active');
        btnTrainer.classList.add('active');
    }
};

window.renderStudioPresets = () => {
    const container = document.getElementById('preset-cards-container');
    if (!container) return;

    const allPresets = { ...window.defaultSoundPresets, ...window.customEngineConfigs };
    const currentActive = window.activeSoundPreset || 'bac_mono';

    let html = '';
    for (const key in allPresets) {
        const p = allPresets[key];
        const isActive = key === currentActive;
        const isCustom = !!window.customEngineConfigs[key];

        html += `
            <div class="preset-card ${isActive ? 'active' : ''}">
                <div class="preset-card-title">
                    <span>${p.name || key}</span>
                    <span class="preset-badge">${isCustom ? 'CUSTOM TRAINED' : (p.badge || 'BUILT-IN')}</span>
                </div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.6); font-family: 'Inter', sans-serif;">
                    ${p.desc || 'Custom engineered sound profile'}
                </div>
                <div class="preset-stat">
                    <span>LIMITER:</span>
                    <span style="color:#ffffff;">${p.engine?.limiter || 9000} RPM</span>
                </div>
                <div class="preset-stat">
                    <span>INERTIA:</span>
                    <span style="color:rgba(255,255,255,0.8);">${p.engine?.inertia || 1.0}</span>
                </div>

                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="hud-btn" style="flex:1; padding:8px; font-size:10px; ${isActive ? 'background:rgba(255,255,255,0.2); border-color:#ffffff;' : ''}" 
                        onclick="window.applySoundPreset('${key}')">
                        ${isActive ? 'CURRENTLY ACTIVE ✅' : 'APPLY TO CAR 🏎️'}
                    </button>
                    ${isCustom ? `
                        <button class="hud-btn" style="padding:8px; font-size:10px; opacity:0.7;" 
                            onclick="window.deleteCustomSoundProfile('${key}')">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
};

window.applySoundPreset = async (key) => {
    if (window.initAudio) window.initAudio();

    const allPresets = { ...window.defaultSoundPresets, ...window.customEngineConfigs };
    const config = allPresets[key];
    if (!config) return;

    window.activeSoundPreset = key;
    localStorage.setItem('drViceActiveSoundPreset', key);

    if (window.startTypeScriptEngineAudio) {
        await window.startTypeScriptEngineAudio(config);
    }

    window.renderStudioPresets();

    if (window.showGameNotification) {
        window.showGameNotification(`CAR ENGINE AUDIO: ${config.name || key} 🔊`, 'white');
    }
};

window.loadBasePresetToTrainer = (baseKey) => {
    const base = window.defaultSoundPresets[baseKey] || window.defaultSoundPresets.bac_mono;
    document.getElementById('trainer-limiter').value = base.engine.limiter || 9000;
    document.getElementById('val-trainer-limiter').innerText = (base.engine.limiter || 9000) + ' RPM';

    document.getElementById('trainer-soft-limiter').value = base.engine.soft_limiter || 8800;
    document.getElementById('val-trainer-soft-limiter').innerText = (base.engine.soft_limiter || 8800) + ' RPM';

    document.getElementById('trainer-inertia').value = base.engine.inertia || 1.0;
    document.getElementById('val-trainer-inertia').innerText = parseFloat(base.engine.inertia || 1.0).toFixed(1);

    document.getElementById('trainer-shifttime').value = base.drivetrain.shiftTime || 50;
    document.getElementById('val-trainer-shifttime').innerText = (base.drivetrain.shiftTime || 50) + ' ms';
};

window.handleStudioFileUpload = (sampleKey, inputElem) => {
    const file = inputElem.files && inputElem.files[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    window.studioUploadedFiles[sampleKey] = fileUrl;

    const statusElem = document.getElementById(`upload-status-${sampleKey.replace('_', '-')}`);
    if (statusElem) {
        statusElem.innerText = `Uploaded: ${file.name.substring(0, 15)}...`;
        statusElem.style.color = '#ffffff';
    }

    if (window.showGameNotification) {
        window.showGameNotification(`AUDIO FILE LOADED: ${file.name} 🎵`, 'white');
    }
};

window.saveTrainedSoundProfile = (applyNow = true) => {
    const name = document.getElementById('trainer-profile-name').value.trim() || 'Custom Trained Engine';
    const key = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const baseKey = document.getElementById('trainer-base-style').value;
    const base = window.defaultSoundPresets[baseKey] || window.defaultSoundPresets.bac_mono;

    const limiter = parseInt(document.getElementById('trainer-limiter').value) || 9000;
    const softLimiter = parseInt(document.getElementById('trainer-soft-limiter').value) || 8800;
    const inertia = parseFloat(document.getElementById('trainer-inertia').value) || 1.0;
    const shiftTime = parseInt(document.getElementById('trainer-shifttime').value) || 50;

    const getSampleSrc = (sampleKey) => {
        if (window.studioUploadedFiles[sampleKey]) {
            return window.studioUploadedFiles[sampleKey];
        }
        const sel = document.getElementById(`sample-${sampleKey.replace('_', '-')}-src`);
        return sel ? sel.value : base.sounds[sampleKey].source;
    };

    const newConfig = {
        name: name,
        desc: `Custom trained ${limiter} RPM engine sound profile`,
        badge: 'CUSTOM TRAINED',
        engine: {
            limiter: limiter,
            soft_limiter: softLimiter,
            limiter_ms: base.engine.limiter_ms || 0,
            inertia: inertia
        },
        drivetrain: {
            shiftTime: shiftTime,
            damping: base.drivetrain.damping || 12
        },
        sounds: {
            on_high: { source: getSampleSrc('on_high'), rpm: base.sounds.on_high.rpm, volume: base.sounds.on_high.volume || 1.0 },
            on_low: { source: getSampleSrc('on_low'), rpm: base.sounds.on_low.rpm, volume: base.sounds.on_low.volume || 1.0 },
            off_high: { source: getSampleSrc('off_high'), rpm: base.sounds.off_high.rpm, volume: base.sounds.off_high.volume || 1.0 },
            off_low: { source: getSampleSrc('off_low'), rpm: base.sounds.off_low.rpm, volume: base.sounds.off_low.volume || 1.0 },
            limiter: { source: 'audio/limiter.wav', volume: 0.5, rpm: limiter * 0.9 }
        }
    };

    window.customEngineConfigs[key] = newConfig;

    // Persist only non-blob configs or serialize safely
    try {
        localStorage.setItem('drViceCustomAudioConfigs', JSON.stringify(window.customEngineConfigs));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }

    if (applyNow) {
        window.applySoundPreset(key);
    } else {
        window.renderStudioPresets();
        window.switchStudioTab('presets');
        if (window.showGameNotification) {
            window.showGameNotification(`TRAINED SOUND PROFILE SAVED: ${name} 💾`, 'white');
        }
    }
};

window.deleteCustomSoundProfile = (key) => {
    if (confirm("Delete this custom engine sound profile?")) {
        delete window.customEngineConfigs[key];
        try {
            localStorage.setItem('drViceCustomAudioConfigs', JSON.stringify(window.customEngineConfigs));
        } catch (e) {}

        if (window.activeSoundPreset === key) {
            window.applySoundPreset('bac_mono');
        } else {
            window.renderStudioPresets();
        }
    }
};

// Studio Live Rev Simulator
window.isStudioRevving = false;
window.setStudioRev = (isRevving) => {
    window.isStudioRevving = isRevving;
};

window.startStudioRevLoop = () => {
    if (window.studioRevLoopActive) return;
    window.studioRevLoopActive = true;

    const loop = () => {
        const modal = document.getElementById('sound-studio-modal');
        if (modal && modal.style.display === 'flex') {
            const activeRef = window.getActiveVehicleEngine ? window.getActiveVehicleEngine() : null;
            if (activeRef && activeRef.engine) {
                if (window.isStudioRevving) {
                    activeRef.engine.throttle = Math.min(1.0, activeRef.engine.throttle + 0.15);
                } else if (!window.inputs?.fwd && !(window.keys && window.keys['KeyW']) && !(window.keys && window.keys['Space'])) {
                    activeRef.engine.throttle = Math.max(0.0, activeRef.engine.throttle - 0.1);
                }

                const currentRpm = Math.floor(activeRef.engine.rpm || 1000);
                const limiterRpm = activeRef.engine.limiter || 9000;
                const percent = Math.min(100, Math.max(0, (currentRpm / limiterRpm) * 100));

                const rpmDisp = document.getElementById('studio-rpm-display');
                const rpmFill = document.getElementById('studio-rpm-bar-fill');
                if (rpmDisp) rpmDisp.innerText = currentRpm;
                if (rpmFill) rpmFill.style.width = percent + '%';
            }
            requestAnimationFrame(loop);
        } else {
            window.studioRevLoopActive = false;
        }
    };

    requestAnimationFrame(loop);
};

