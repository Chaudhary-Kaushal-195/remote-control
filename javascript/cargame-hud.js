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
    const pauseBtn = document.getElementById('pause-btn');

    if (!isHudOn) {
        if (steeringZone) steeringZone.style.display = 'none';
        if (steeringButtons) steeringButtons.style.display = 'none';
        if (uiContainer) uiContainer.style.display = 'none';
        if (settingsBtn) settingsBtn.parentElement.style.display = 'none';
    } else {
        if (uiContainer) uiContainer.style.display = 'flex';
        if (settingsBtn) settingsBtn.parentElement.style.display = 'flex';

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
    const displaySpeed = window.gameSettings.units === 'mph' ? Math.round(rawSpeed * 0.62) : Math.round(rawSpeed);
    speedBox.innerText = `${displaySpeed} ${window.gameSettings.units.toUpperCase()}`;
    const unitLabel = document.getElementById('unit-label');
    if (unitLabel) unitLabel.innerText = `unit: ${window.gameSettings.units.toUpperCase()}`;

    // Analog Needle & Arc Logic (Multi-Gauge Clusters)
    const maxSpeed = 500; // New limit for the dial for real car physics 500 KPH
    const needleAngle = -120 + ((rawSpeed / maxSpeed) * 240);
    const speedNeedleGrp = document.getElementById('speed-needle-grp');
    if (speedNeedleGrp) speedNeedleGrp.setAttribute('transform', `rotate(${needleAngle}, 50, 50)`);

    const arc = document.getElementById('speed-arc');
    if (arc) {
        const offset = 188 - (Math.min(1, rawSpeed / maxSpeed) * 188);
        arc.style.strokeDashoffset = offset;
    }

    // RPM Logic (Simulated matching)
    const rpmAngle = -120 + ((rpm / 10000) * 240);
    const rpmNeedleGrp = document.getElementById('rpm-needle-grp');
    if (rpmNeedleGrp) rpmNeedleGrp.setAttribute('transform', `rotate(${rpmAngle}, 50, 50)`);

    const rpmArc = document.getElementById('rpm-arc');
    if (rpmArc) {
        const offset = 188 - (Math.min(1, rpm / 10000) * 188);
        rpmArc.style.strokeDashoffset = offset;

        // Elegance: Redline pulse
        if (rpm > 8000) {
            const pulse = (Math.sin(Date.now() * 0.02) + 1) / 2;
            rpmArc.style.filter = `drop-shadow(0 0 ${5 + pulse * 10}px #ff0000)`;
        } else {
            rpmArc.style.filter = 'none';
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
        if (manualGearIndex === -1) gearVal = "R";
        else if (manualGearIndex === 0) gearVal = "N";
        else gearVal = manualGearIndex.toString();
    }
    const gearBox = document.getElementById('gear-box');
    if (gearBox) gearBox.innerText = gearVal;
};
