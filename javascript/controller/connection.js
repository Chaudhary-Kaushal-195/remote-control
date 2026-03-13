// UNIVERSAL ORIENTATION ENGINE (Hill Climb Racing Style)
window.lockAppOrientation = () => {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => { });
    }
};

window.checkOrientation = () => {
    // Check if truly portrait physically
    const isPortrait = window.innerHeight > window.innerWidth;
    const hasClass = document.body.classList.contains('force-landscape-active');

    if (isPortrait && !hasClass) {
        document.body.classList.add('force-landscape-active');
    } else if (!isPortrait && hasClass) {
        document.body.classList.remove('force-landscape-active');
    }
};

// Initial system activation
window.addEventListener('resize', window.checkOrientation);
window.addEventListener('orientationchange', window.checkOrientation);
window.addEventListener('load', window.checkOrientation);
window.checkOrientation();

// First interaction triggers the hardware lock (Hill Climb style)
document.addEventListener('touchstart', window.lockAppOrientation, { once: true });
document.addEventListener('mousedown', window.lockAppOrientation, { once: true });



// Desktop Restriction Check
const isDesktop = !('ontouchstart' in window) || (window.innerWidth > 1024);
if (isDesktop && !window.location.href.includes('localhost')) {
    document.getElementById('desktop-blocker').style.display = 'flex';
}

if (!window.location.search.includes('hostId=') &&
    !window.location.search.includes('mode=manual') &&
    !window.location.href.includes('localhost')) {
    window.location.href = 'index.html';
}

window.peer = null;
window.conn = null;
window.gyroActive = false;

window.connectToHost = async () => {
    const status = document.getElementById('status');
    const hostIdInput = document.getElementById('hostIdInput');
    const hostId = hostIdInput.value.trim().toLowerCase();
    if (!hostId) return alert("Please enter the ID seen on your laptop!");

    // Enforce orientation lock on user interaction
    if (window.lockAppOrientation) window.lockAppOrientation();

    status.innerText = "STATUS: INITIALIZING PEER...";
    if (window.peer) window.peer.destroy();

    window.peer = new Peer();

    window.peer.on('open', (id) => {
        status.innerText = "STATUS: SEARCHING FOR LAPTOP (" + hostId + ")...";
        window.conn = window.peer.connect(hostId);

        window.conn.on('open', () => {
            document.getElementById('overlay').style.display = 'none';
            document.getElementById('ui-container').style.display = 'block';
            document.getElementById('fix-sensors').style.display = 'block';
            status.innerText = "STATUS: CONNECTED (ACTIVE)";
            // Push state for back button interception
            history.pushState({ connected: true }, "");
            window.addEventListener('popstate', window.handleBackPress);

            if (window.vibrate) window.vibrate([50, 50, 50]);
            if (window.setupPedals) window.setupPedals();
            if (window.setupSteeringListeners) window.setupSteeringListeners();
            if (window.setupRemoteWheel) window.setupRemoteWheel();
        });

        window.conn.on('close', () => {
            alert("Disconnected from laptop.");
            window.location.reload();
        });

        window.conn.on('data', (data) => {
            if (data.type === 'config' && window.applyGameConfig) {
                window.applyGameConfig(data.config);
            }
        });

        window.conn.on('error', (err) => {
            status.innerText = "STATUS: LINK ERROR (" + err.type + ")";
            alert("Connection failed: Check if ID is correct.");
        });
    });

    window.peer.on('error', (err) => {
        status.innerText = "STATUS: DEVICE ERROR (" + err.type + ")";
        if (err.type === 'peer-unavailable') {
            alert("Laptop not found. Is the 'REMOTE' button active on your laptop?");
        } else {
            alert("Error: " + err.type);
        }
    });
}

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('hostId');
    if (hostId) {
        document.getElementById('hostIdInput').value = hostId;
        setTimeout(window.connectToHost, 500);
    }
};

let html5QrCode = null;

window.startScanning = () => {
    // Enforce orientation lock on user interaction
    if (window.lockAppOrientation) window.lockAppOrientation();
    // Attempt to force landscape specifically for scanning again
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => { });
    }

    document.getElementById('ui-container').style.display = 'none';
    document.getElementById('reader-container').style.display = 'flex';
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 20, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0 };
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            document.getElementById('hostIdInput').value = decodedText.trim().toLowerCase();
            window.stopScanning();
            window.connectToHost();
        },
        (errorMessage) => { }
    ).catch((err) => {
        alert("Camera error: " + err);
        window.stopScanning();
    });
}

window.stopScanning = () => {
    document.getElementById('ui-container').style.display = 'block';
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

window.handleBackPress = (e) => {
    if (window.conn && window.conn.open) {
        document.getElementById('disconnect-modal').style.display = 'flex';
        // Re-push so we catch next try too
        history.pushState({ connected: true }, "");
    } else {
        window.location.href = 'index.html';
    }
};

window.confirmDisconnect = (yes) => {
    document.getElementById('disconnect-modal').style.display = 'none';
    if (yes) {
        if (window.conn) window.conn.close();
        if (window.peer) window.peer.destroy();
        window.location.href = 'index.html';
    }
};

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js');
}
