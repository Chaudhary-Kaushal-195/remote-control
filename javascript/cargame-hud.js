console.log(
    "%c🏎️ Dr. Vice Racing %cby Kaushal Chaudhary\n🔗 https://github.com/Chaudhary-Kaushal-195/remote-control",
    "background: #111; color: #0ffffa; font-size: 13px; font-weight: bold; padding: 4px 8px; border-radius: 4px; border: 1px solid #0ffffa;",
    "color: #888; font-size: 11px;"
);

// Screen Orientation Lock (For Mobile Devices)
if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(err => {
        console.log("Orientation lock failed/not supported:", err);
    });
}

// Render gauge tick marks (Major thick lines + 9 minor subdivisions between each major mark)
window.renderGaugeTicks = function () {
    const rpmTicksGroup = document.getElementById('rpm-ticks-lines');
    const speedTicksGroup = document.getElementById('speed-ticks-lines');

    const generateTicksHTML = (isRPM = false) => {
        let html = '';
        const totalSubdivisions = 60; // 6 major intervals * 10 subdivisions = 60 steps
        const startAngle = -135;
        const totalSweep = 270;
        const stepAngle = totalSweep / totalSubdivisions; // 4.5 deg per subdivision

        for (let i = 0; i <= totalSubdivisions; i++) {
            const angle = startAngle + (i * stepAngle);
            const isMajor = i % 10 === 0;
            const isMedium = i % 5 === 0 && !isMajor;

            let length = isMajor ? 5.5 : (isMedium ? 3.8 : 2.5);
            let strokeWidth = isMajor ? 1.6 : (isMedium ? 1.0 : 0.55);
            let opacity = isMajor ? 0.95 : (isMedium ? 0.65 : 0.4);

            // Redline tick coloring for high RPM (>= 8000 RPM, index >= 40)
            let strokeColor = (isRPM && i >= 40) ? '#ff2244' : '#ffffff';

            html += `<line x1="50" y1="10" x2="50" y2="${(10 + length).toFixed(2)}" 
                          stroke="${strokeColor}" 
                          stroke-width="${strokeWidth}" 
                          stroke-linecap="round"
                          opacity="${opacity}" 
                          transform="rotate(${angle.toFixed(2)}, 50, 50)" />`;
        }
        return html;
    };

    if (rpmTicksGroup) rpmTicksGroup.innerHTML = generateTicksHTML(true);
    if (speedTicksGroup) speedTicksGroup.innerHTML = generateTicksHTML(false);
};

// HUD Management
window.initHUD = function () {
    if (window.renderGaugeTicks) window.renderGaugeTicks();
    if (window.applyHUDVisibility) window.applyHUDVisibility();
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

const hudCache = {};
function getHudEl(id) {
    if (!hudCache[id]) hudCache[id] = document.getElementById(id);
    return hudCache[id];
}

window.updateHUD = function (rawSpeed, rpm, engineTemp, fuelLevel, engineData, manualGearIndex) {
    const speedBox = getHudEl('speed-box');
    if (!speedBox || !window.gameSettings) return;

    // Speed display
    const units = window.gameSettings.units || 'kph';
    const displaySpeed = units === 'mph' ? Math.round(rawSpeed * 0.62) : Math.round(rawSpeed);
    speedBox.innerText = `${displaySpeed}`;
    const speedUnitLabel = getHudEl('speed-unit-label');
    if (speedUnitLabel) speedUnitLabel.innerText = units.toUpperCase();
    const unitLabel = getHudEl('unit-label');
    if (unitLabel) unitLabel.innerText = `unit: ${units.toUpperCase()}`;

    // Analog Needle & Arc Logic (270 Degree Sweep: 135deg to 405deg)
    const maxSpeed = 600;
    const speedNeedleAngle = -135 + ((rawSpeed / maxSpeed) * 270);
    const speedNeedleGrp = getHudEl('speed-needle-grp');
    if (speedNeedleGrp) speedNeedleGrp.setAttribute('transform', `rotate(${speedNeedleAngle}, 50, 50)`);

    const arc = getHudEl('speed-arc');
    if (arc) {
        const offset = 188.5 - (Math.min(1, rawSpeed / maxSpeed) * 188.5);
        arc.style.strokeDashoffset = offset;
    }

    // RPM Logic (Standardized to 12000 RPM range to align 6000 RPM at Top-Center)
    const maxRpm = 12000;
    const rpmNeedleAngle = -135 + ((rpm / maxRpm) * 270);
    const rpmNeedleGrp = getHudEl('rpm-needle-grp');
    if (rpmNeedleGrp) rpmNeedleGrp.setAttribute('transform', `rotate(${rpmNeedleAngle}, 50, 50)`);

    const rpmArc = getHudEl('rpm-arc');
    if (rpmArc) {
        const offset = 188.5 - (Math.min(1, rpm / maxRpm) * 188.5);
        rpmArc.style.strokeDashoffset = offset;

        // Shift Light & Redline Pulse
        const shiftLight = getHudEl('shift-light');
        if (rpm > 8000) {
            const pulse = (Math.sin(Date.now() * 0.02) + 1) / 2;
            rpmArc.style.filter = `drop-shadow(0 0 ${2 + pulse * 4}px rgba(255, 34, 68, 0.8))`;
            if (shiftLight) {
                shiftLight.style.opacity = pulse > 0.5 ? "1" : "0.2";
                shiftLight.setAttribute('fill', '#ff2244');
            }
        } else {
            rpmArc.style.filter = 'none';
            if (shiftLight) {
                shiftLight.style.opacity = "0.1";
                shiftLight.setAttribute('fill', '#fff');
            }
        }
    }

    const rpmBox = getHudEl('rpm-box');
    if (rpmBox) rpmBox.innerText = Math.round(rpm);

    // Fuel Logic
    const fuelAngle = 45 - (fuelLevel / 100 * 90);
    const fuelNeedleGrp = getHudEl('fuel-needle-grp');
    if (fuelNeedleGrp) fuelNeedleGrp.setAttribute('transform', `rotate(${fuelAngle}, 50, 50)`);

    // Temp Logic
    const tempAngle = -90 + ((engineTemp / 120) * 180);
    const tempNeedleGrp = getHudEl('temp-needle-grp');
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
    const gearBox = getHudEl('gear-box');
    if (gearBox) gearBox.textContent = gearVal;

    // Synchronize button glowing states across Keyboard, Phone, Controller, Mouse
    if (window.updateButtonGlow) {
        window.updateButtonGlow();
    }
};

window.updateButtonGlow = function () {
    const inputs = window.inputs || {};

    // Gas pedal glow
    const isGas = !!inputs.fwd || (typeof inputs.fwd === 'number' && inputs.fwd > 0.05);
    const gasEl = document.getElementById('gas');
    if (gasEl) {
        gasEl.classList.toggle('active', isGas);
    }

    // Brake / Handbrake pedal glow
    const isBrake = !!inputs.brake || !!inputs.handbrake ||
                    (typeof inputs.brake === 'number' && inputs.brake > 0.05) ||
                    (typeof inputs.handbrake === 'number' && inputs.handbrake > 0.05);
    const brakeEl = document.getElementById('handbrake');
    if (brakeEl) {
        brakeEl.classList.toggle('active', isBrake);
    }

    // Reverse pedal glow
    const isRev = !!inputs.bwd || (typeof inputs.bwd === 'number' && inputs.bwd > 0.05);
    const revEl = document.getElementById('rev-btn');
    if (revEl) {
        revEl.classList.toggle('active', isRev);
    }

    // Steering left / right buttons and visual wheel glow
    const angle = window.wheelAngle || 0;
    const isLeft = !!inputs.left || angle < -8;
    const isRight = !!inputs.right || angle > 8;

    const leftEl = document.getElementById('steer-left');
    if (leftEl) {
        leftEl.classList.toggle('active', isLeft);
    }

    const rightEl = document.getElementById('steer-right');
    if (rightEl) {
        rightEl.classList.toggle('active', isRight);
    }

    const wheelVisual = document.getElementById('wheel-visual');
    if (wheelVisual) {
        const isTurning = Math.abs(angle) > 5 || isLeft || isRight;
        wheelVisual.classList.toggle('active', isTurning);
    }
};



document.addEventListener('DOMContentLoaded', () => {
    window.initHUD();
});

