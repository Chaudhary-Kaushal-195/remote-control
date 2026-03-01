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

document.addEventListener('DOMContentLoaded', () => {
    window.loadSettingsToModal();

    // Hide debug panel by default after a short delay for dat.gui to init
    setTimeout(() => {
        const gui = document.querySelector('.dg.ac');
        if (gui) gui.style.display = 'none';
    }, 500);
});
