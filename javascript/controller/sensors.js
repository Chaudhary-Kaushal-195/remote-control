window.startGyro = () => {
    if (window.vibrate) window.vibrate(50);
    const fixBtn = document.getElementById('fix-sensors');
    const tiltDisplay = document.getElementById('debug-tilt');
    fixBtn.innerText = "CALIBRATING...";

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(res => {
                if (res === 'granted') window.enableGyro();
                else {
                    alert("Sensor access denied. Please reset Chrome permissions.");
                    tiltDisplay.innerText = "Steer: PERMISSION DENIED";
                }
            })
            .catch(e => {
                console.error(e);
                window.enableGyro();
            });
    } else {
        window.enableGyro();
    }
}

window.enableGyro = () => {
    const tiltDisplay = document.getElementById('debug-tilt');
    const wheelInner = document.getElementById('wheel-inner');
    document.getElementById('fix-sensors').style.display = 'none';
    if (window.vibrate) window.vibrate(50);

    tiltDisplay.innerText = "Steer: READY - WAITING FOR TILT...";
    tiltDisplay.style.color = "#0ffffa";

    let lastEvent = Date.now();
    let checkHeartbeat = setInterval(() => {
        if (Date.now() - lastEvent > 1000) {
            tiltDisplay.innerText = "Steer: NO DATA (Is tilt enabled?)";
            tiltDisplay.style.color = "orange";
        }
    }, 1000);

    window.addEventListener('deviceorientation', (e) => {
        lastEvent = Date.now();
        let tilt = -e.gamma;

        const orientation = (screen.orientation && screen.orientation.angle !== undefined)
            ? screen.orientation.angle
            : (window.orientation || 0);

        if (orientation === 90) tilt = e.beta;
        if (orientation === -90) tilt = -e.beta;

        if (tilt === null || tilt === undefined || isNaN(tilt)) {
            tiltDisplay.innerText = "Steer: SENSOR BLOCKED";
            tiltDisplay.style.color = "red";
            return;
        }

        const finalTilt = Math.max(-45, Math.min(45, tilt)) * 4;
        if (window.conn && window.conn.open && window.currentSteeringMode === 'gyro') {
            window.conn.send({ type: 'gyro', tilt: finalTilt });
            tiltDisplay.innerText = "Steer (Gyro): " + Math.round(finalTilt);
            tiltDisplay.style.color = "#0ffffa";
        } else {
            tiltDisplay.innerText = "Steer (Gyro): PAUSED";
            tiltDisplay.style.color = "rgba(255,255,255,0.2)";
        }

        if (wheelInner && window.currentSteeringMode === 'gyro') {
            wheelInner.style.transform = `rotate(${finalTilt}deg)`;
        }
    }, true);
}

document.addEventListener('DOMContentLoaded', () => {
    const tiltDisplay = document.getElementById('debug-tilt');
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
        alert("⚠️ WARNING: Sensors might be blocked! \n\nModern phones require HTTPS or 'localhost' (USB wire) for the steering to work. \n\nPlease use the USB WIRE method for best results.");
        if (tiltDisplay) {
            tiltDisplay.innerText = "Steer: INSECURE CONTEXT (BLOCKED)";
            tiltDisplay.style.color = "red";
        }
    }
});
