// Screen Orientation Lock (For Mobile Devices)
if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(err => {
        console.log("Orientation lock failed/not supported:", err);
    });
}

// HUD Management
window.initHUD = function () {
    // Initial display logic
    setTimeout(() => {
        if (window.applyHUDVisibility) window.applyHUDVisibility();
    }, 100);
}

window.applyHUDVisibility = () => {
    const isHudOn = window.gameSettings && window.gameSettings.controlHud !== 'off';
    const steeringZone = document.getElementById('steering-zone');
    const steeringButtons = document.getElementById('steering-buttons');
    const uiContainer = document.querySelector('.ui-container');
    const settingsBtn = document.getElementById('settings-trigger-btn');
    const camBtn = document.getElementById('cam-trigger-btn');
    const transBtn = document.getElementById('trans-trigger-btn');
    const pauseBtn = document.getElementById('pause-btn');

    if (!isHudOn) {
        if (steeringZone) steeringZone.style.display = 'none';
        if (steeringButtons) steeringButtons.style.display = 'none';
        if (uiContainer) uiContainer.style.display = 'none';

        // Ensure the control hub buttons remain visible as requested
        if (settingsBtn && settingsBtn.parentElement) settingsBtn.parentElement.style.display = 'flex';
        if (camBtn) camBtn.style.display = 'flex';
        if (transBtn) transBtn.style.display = 'flex';
        if (pauseBtn) pauseBtn.style.display = 'flex';
        return;
    } else {
        if (uiContainer) uiContainer.style.display = 'flex';
        if (settingsBtn && settingsBtn.parentElement) settingsBtn.parentElement.style.display = 'flex';
        if (camBtn) camBtn.style.display = 'flex';
        if (transBtn) transBtn.style.display = 'flex';
        if (pauseBtn) pauseBtn.style.display = 'flex';

        if (window.gameSettings && window.gameSettings.steering === 'wheel') {
            if (steeringZone) steeringZone.style.display = 'block';
            if (steeringButtons) steeringButtons.style.display = 'none';
            if (window.setGyroState) window.setGyroState(false);
        } else if (window.gameSettings && window.gameSettings.steering === 'buttons') {
            if (steeringZone) steeringZone.style.display = 'none';
            if (steeringButtons) steeringButtons.style.display = 'flex';
            if (window.setGyroState) window.setGyroState(false);
        } else if (window.gameSettings && window.gameSettings.steering === 'gyro') {
            if (steeringZone) steeringZone.style.display = 'none';
            if (steeringButtons) steeringButtons.style.display = 'none';
            if (window.setGyroState) window.setGyroState(true);
        }

        const revBtn = document.getElementById('rev-btn');
        if (revBtn) {
            revBtn.style.display = window.gameSettings.transmission === 'manual' ? 'none' : 'flex';
        }
    }
};

window.updateHUD = function (rawSpeed, rpm, engineTemp, fuelLevel, engineData, manualGearIndex) {
    const speedBox = document.getElementById('speed-box');
    if (!speedBox || !window.gameSettings) return;

    // Speed display
    const units = window.gameSettings.units || 'kph';
    const displaySpeed = units === 'mph' ? Math.round(rawSpeed * 0.62) : Math.round(rawSpeed);
    speedBox.innerText = `${displaySpeed} ${units.toUpperCase()}`;
    const unitLabel = document.getElementById('unit-label');
    if (unitLabel) unitLabel.innerText = `unit: ${units.toUpperCase()}`;

    // Analog Needle & Arc Logic (270 Degree Sweep: 135deg to 405deg)
    const maxSpeed = 500;
    const speedNeedleAngle = -135 + ((rawSpeed / maxSpeed) * 270);
    const speedNeedleGrp = document.getElementById('speed-needle-grp');
    if (speedNeedleGrp) speedNeedleGrp.setAttribute('transform', `rotate(${speedNeedleAngle}, 50, 50)`);

    const arc = document.getElementById('speed-arc');
    if (arc) {
        // SVG Arc length for 270 deg at radius 40 is 188.5
        const offset = 188.5 - (Math.min(1, rawSpeed / maxSpeed) * 188.5);
        arc.style.strokeDashoffset = offset;
    }

    // RPM Logic (Standardized to 9000 RPM range for better visual sweep)
    const maxRpm = 10000;
    const rpmNeedleAngle = -135 + ((rpm / maxRpm) * 270);
    const rpmNeedleGrp = document.getElementById('rpm-needle-grp');
    if (rpmNeedleGrp) rpmNeedleGrp.setAttribute('transform', `rotate(${rpmNeedleAngle}, 50, 50)`);

    const rpmArc = document.getElementById('rpm-arc');
    if (rpmArc) {
        const offset = 188.5 - (Math.min(1, rpm / maxRpm) * 188.5);
        rpmArc.style.strokeDashoffset = offset;

        // Shift Light & Redline Pulse
        const shiftLight = document.getElementById('shift-light');
        if (rpm > 8000) {
            const pulse = (Math.sin(Date.now() * 0.02) + 1) / 2;
            rpmArc.style.filter = `drop-shadow(0 0 ${5 + pulse * 10}px #ff0000)`;
            if (shiftLight) {
                shiftLight.style.opacity = pulse > 0.5 ? "1" : "0.2";
                shiftLight.setAttribute('fill', '#ff0000');
            }
        } else {
            rpmArc.style.filter = 'none';
            if (shiftLight) {
                shiftLight.style.opacity = "0.1";
                shiftLight.setAttribute('fill', '#fff');
            }
        }
    }

    const rpmBox = document.getElementById('rpm-box');
    if (rpmBox) rpmBox.innerText = Math.round(rpm);

    // Fuel Logic
    const fuelAngle = 45 - (fuelLevel / 100 * 90);
    const fuelNeedleGrp = document.getElementById('fuel-needle-grp');
    if (fuelNeedleGrp) fuelNeedleGrp.setAttribute('transform', `rotate(${fuelAngle}, 50, 50)`);

    // Temp Logic
    const tempAngle = -90 + ((engineTemp / 120) * 180);
    const tempNeedleGrp = document.getElementById('temp-needle-grp');
    if (tempNeedleGrp) tempNeedleGrp.setAttribute('transform', `rotate(${tempAngle}, 50, 50)`);

    // Gear Logic
    let gearVal = "N";
    if (engineData) {
        if (engineData.gear === -1) gearVal = "R";
        else if (engineData.gear === 0) gearVal = "N";
        else gearVal = engineData.gear.toString();
    } else {
        const gear = manualGearIndex !== undefined ? manualGearIndex : 0;
        if (gear === -1) gearVal = "R";
        else if (gear === 0) gearVal = "N";
        else gearVal = gear.toString();
    }
    const gearBox = document.getElementById('gear-box');
    if (gearBox) gearBox.innerText = gearVal;
};
