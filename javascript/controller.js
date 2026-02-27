// Proactive Redirect: If no session ID AND not manual mode, go back to Hub
if (!window.location.search.includes('hostId=') &&
    !window.location.search.includes('mode=manual') &&
    !window.location.href.includes('localhost')) {
    window.location.href = 'index.html';
}

// Desktop Restriction Check
const isDesktop = !('ontouchstart' in window) || (window.innerWidth > 1024);
if (isDesktop && !window.location.href.includes('localhost')) {
    document.getElementById('desktop-blocker').style.display = 'flex';
}

let peer = null, conn = null;
let gyroActive = false;
const status = document.getElementById('status');
const wheelInner = document.getElementById('wheel-inner');
const tiltDisplay = document.getElementById('debug-tilt');

// Check for Secure Context (Required for Sensors)
if (!window.isSecureContext && window.location.hostname !== "localhost") {
    alert("⚠️ WARNING: Sensors might be blocked! \n\nModern phones require HTTPS or 'localhost' (USB wire) for the steering to work. \n\nPlease use the USB WIRE method for best results.");
    tiltDisplay.innerText = "Steer: INSECURE CONTEXT (BLOCKED)";
    tiltDisplay.style.color = "red";
}

window.connectToHost = async () => {
    const hostIdInput = document.getElementById('hostIdInput');
    const hostId = hostIdInput.value.trim().toLowerCase();
    if (!hostId) return alert("Please enter the ID seen on your laptop!");

    status.innerText = "STATUS: INITIALIZING PEER...";
    if (peer) peer.destroy();

    peer = new Peer();

    peer.on('open', (id) => {
        status.innerText = "STATUS: SEARCHING FOR LAPTOP (" + hostId + ")...";
        conn = peer.connect(hostId);

        conn.on('open', () => {
            document.getElementById('overlay').style.display = 'none';
            document.getElementById('fix-sensors').style.display = 'block';
            status.innerText = "STATUS: CONNECTED (ACTIVE)";
            vibrate([50, 50, 50]);
            setupPedals();
            setupSteeringListeners();
        });

        conn.on('data', (data) => {
            if (data.type === 'config') {
                applyGameConfig(data.config);
            }
        });

        conn.on('error', (err) => {
            status.innerText = "STATUS: LINK ERROR (" + err.type + ")";
            alert("Connection failed: Check if ID is correct.");
        });
    });

    peer.on('error', (err) => {
        status.innerText = "STATUS: DEVICE ERROR (" + err.type + ")";
        if (err.type === 'peer-unavailable') {
            alert("Laptop not found. Is the 'REMOTE' button active on your laptop?");
        } else {
            alert("Error: " + err.type);
        }
    });
}

// Auto-connect if ID is in URL
window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('hostId');
    if (hostId) {
        document.getElementById('hostIdInput').value = hostId;
        // Small delay to ensure PeerJS load if needed
        setTimeout(window.connectToHost, 500);
    }
};

// QR SCANNER LOGIC
let html5QrCode = null;

window.startScanning = () => {
    document.getElementById('reader-container').style.display = 'flex';
    html5QrCode = new Html5Qrcode("reader");
    const config = {
        fps: 20,
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0
    };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            // Success!
            document.getElementById('hostIdInput').value = decodedText.trim().toLowerCase();
            window.stopScanning();
            window.connectToHost();
        },
        (errorMessage) => {
            // parse error, ignore it.
        }
    ).catch((err) => {
        alert("Camera error: " + err);
        window.stopScanning();
    });
}

window.stopScanning = () => {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader-container').style.display = 'none';
            html5QrCode = null;
        }).catch(() => {
            document.getElementById('reader-container').style.display = 'none';
            html5QrCode = null;
        });
    } else {
        document.getElementById('reader-container').style.display = 'none';
    }
}

window.startGyro = () => {
    vibrate(50);
    const fixBtn = document.getElementById('fix-sensors');
    fixBtn.innerText = "CALIBRATING...";

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(res => {
                if (res === 'granted') enableGyro();
                else {
                    alert("Sensor access denied. Please reset Chrome permissions.");
                    tiltDisplay.innerText = "Steer: PERMISSION DENIED";
                }
            })
            .catch(e => {
                console.error(id, e);
                enableGyro();
            });
    } else {
        enableGyro();
    }
}

function enableGyro() {
    const tiltDisplay = document.getElementById('debug-tilt');
    document.getElementById('fix-sensors').style.display = 'none';
    vibrate(50);

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
        if (conn && conn.open) {
            conn.send({ type: 'gyro', tilt: finalTilt });
            tiltDisplay.innerText = "Steer: " + Math.round(finalTilt);
            tiltDisplay.style.color = "#0ffffa";
        }

        wheelInner.style.transform = `translateX(${tilt * 1.5}px)`;
    }, true);
}

function setupPedals() {
    const gas = document.getElementById('gas');
    const brake = document.getElementById('brake');
    const reverse = document.getElementById('reverse');

    gas.addEventListener('touchstart', (e) => { e.preventDefault(); conn.send({ type: 'pedal', pedal: 'fwd', active: true }); vibrate(20); });
    gas.addEventListener('touchend', () => conn.send({ type: 'pedal', pedal: 'fwd', active: false }));

    brake.addEventListener('touchstart', (e) => { e.preventDefault(); conn.send({ type: 'pedal', pedal: 'brake', active: true }); vibrate(70); });
    brake.addEventListener('touchend', () => conn.send({ type: 'pedal', pedal: 'brake', active: false }));

    reverse.addEventListener('touchstart', (e) => { e.preventDefault(); conn.send({ type: 'pedal', pedal: 'bwd', active: true }); vibrate(40); });
    reverse.addEventListener('touchend', () => conn.send({ type: 'pedal', pedal: 'bwd', active: false }));
}

function setupSteeringListeners() {
    const left = document.getElementById('steer-left');
    const right = document.getElementById('steer-right');

    left.addEventListener('touchstart', (e) => { e.preventDefault(); conn.send({ type: 'pedal', pedal: 'left', active: true }); vibrate(30); });
    left.addEventListener('touchend', () => conn.send({ type: 'pedal', pedal: 'left', active: false }));

    right.addEventListener('touchstart', (e) => { e.preventDefault(); conn.send({ type: 'pedal', pedal: 'right', active: true }); vibrate(30); });
    right.addEventListener('touchend', () => conn.send({ type: 'pedal', pedal: 'right', active: false }));
}

function applyGameConfig(config) {
    const wheel = document.getElementById('wheel-zone');
    const buttons = document.getElementById('button-steering');
    const pedals = document.getElementById('pedal-zone');

    // Reset vis
    wheel.style.display = 'none';
    buttons.style.display = 'none';

    if (config.steering === 'wheel') {
        wheel.style.display = 'flex';
        pedals.style.bottom = '40px'; // Reset for wheel center
    } else if (config.steering === 'buttons') {
        buttons.style.display = 'flex';
        pedals.style.bottom = '220px'; // Lift for buttons
    }
    // 'gyro' mode hides both steering UIs
}

function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js');
}
