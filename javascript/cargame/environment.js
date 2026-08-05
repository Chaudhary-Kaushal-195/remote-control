import * as THREE from 'three';
window.THREE = THREE;

let isAudioInit = false;
let isLoadingInProgress = false;

const LOADING_TIPS = [
    "Polishing headlights...",
    "Checking tire pressure...",
    "Warming up twin-turbo V8 engine...",
    "Calibrating ABS & traction control...",
    "Adjusting rearview mirror...",
    "Pre-heating racing slicks...",
    "Checking brake fluid levels...",
    "Synthesizing exhaust notes...",
    "Fine-tuning suspension damping...",
    "Priming fuel injectors..."
];

window.initAudio = async () => {
    if (isLoadingInProgress) return;
    isLoadingInProgress = true;

    const overlay = document.getElementById('sound-overlay');
    const startPrompt = document.getElementById('loading-start-prompt');
    const barContainer = document.getElementById('loading-bar-container');
    const barFill = document.getElementById('loading-bar-fill');
    const tipText = document.getElementById('loading-tip-text');

    if (startPrompt) startPrompt.style.display = 'none';
    if (barContainer) barContainer.style.display = 'flex';

    // Cycle tips in a loop so user stays entertained
    let tipIdx = 0;
    if (tipText) tipText.innerText = LOADING_TIPS[0];
    const tipInterval = setInterval(() => {
        tipIdx = (tipIdx + 1) % LOADING_TIPS.length;
        if (tipText) {
            tipText.style.opacity = '0';
            setTimeout(() => {
                tipText.innerText = LOADING_TIPS[tipIdx];
                tipText.style.opacity = '1';
            }, 150);
        }
    }, 1200);

    // Dynamic progress bar
    let progress = 15;
    if (barFill) barFill.style.width = progress + '%';

    const progressInterval = setInterval(() => {
        if (progress < 85) {
            progress += Math.floor(Math.random() * 15) + 5;
            if (barFill) barFill.style.width = Math.min(progress, 85) + '%';
        }
    }, 150);

    const startTime = Date.now();

    // Perform REAL Audio & Sound Engine Initialization
    if (!isAudioInit) {
        isAudioInit = true;
        if (window.startBasicEngineAudio) {
            try {
                await window.startBasicEngineAudio();
            } catch (err) {
                console.error("Audio initialization error:", err);
            }
        }
    }

    // Ensure a minimum 1 second (1000ms) loading display time even if cached
    const elapsedTime = Date.now() - startTime;
    const minDisplayTime = 1000;
    const remainingDelay = Math.max(0, minDisplayTime - elapsedTime);

    setTimeout(() => {
        clearInterval(progressInterval);
        clearInterval(tipInterval);

        if (barFill) barFill.style.width = '100%';
        if (tipText) {
            tipText.style.opacity = '1';
            tipText.innerText = "READY TO RACE!";
        }

        setTimeout(() => {
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    const orbit = document.getElementById('orbit-zone');
                    if (orbit) orbit.style.pointerEvents = 'auto';
                }, 500);
            }

            // Start initial throttle kick
            if (typeof window.manualGearIndex !== 'undefined') {
                window.manualGearIndex = 1;
            }
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp' })), 50);
        }, 350);
    }, remainingDelay);
};

// Allow pressing any key to trigger start loading
document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('sound-overlay');
    if (overlay && overlay.style.display !== 'none' && !isLoadingInProgress) {
        window.initAudio();
    }
});

window.scene = new THREE.Scene();
window.scene.background = new THREE.Color(0x05000a);
window.scene.fog = new THREE.FogExp2(0x05000a, 0.03);

window.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1.0, 1000);
window.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
window.renderer.setPixelRatio(window.devicePixelRatio);
window.renderer.setSize(window.innerWidth, window.innerHeight);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('canvas-container').appendChild(window.renderer.domElement);
});

window.cameraMode = 0;
const cameraModes = ["NORMAL", "INSIDE", "ACTION"];
window.cycleCamera = () => {
    window.cameraMode = (window.cameraMode + 1) % 3;
    const btn = document.getElementById('cam-btn');
    if (btn) btn.innerText = `🎥 VIEW: ${cameraModes[window.cameraMode]}`;
};

const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 512;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#cccccc'; ctx.fillRect(0, 0, 512, 512);
ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, 256, 256); ctx.fillRect(256, 256, 256, 256);

const floorTex = new THREE.CanvasTexture(canvas);
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(2500, 2500);

const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 });
const floorGeo = new THREE.PlaneGeometry(100000, 100000);
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
window.scene.add(floor);
window.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

window.orbitX = 0;
window.orbitY = 0.5;
window.startOrbit = (x, y, id) => {
    window.isOrbiting = true;
    window.orbitTouchId = id;
    window.lastOrbitTouch = { x, y };
};
window.moveOrbit = (x, y) => {
    if (window.isOrbiting) {
        let dx = x - window.lastOrbitTouch.x;
        let dy = y - window.lastOrbitTouch.y;
        window.orbitX -= dx * 0.005;
        window.orbitY = Math.max(0.1, Math.min(1.5, window.orbitY + dy * 0.005));
        window.lastOrbitTouch = { x, y };
    }
};
window.endOrbit = () => {
    window.isOrbiting = false;
    window.orbitTouchId = null;
};

document.addEventListener('DOMContentLoaded', () => {
    const orbitZone = document.getElementById('orbit-zone');
    if (orbitZone) {
        orbitZone.addEventListener('mousedown', () => window.isOrbiting = true);
        window.addEventListener('mouseup', () => window.isOrbiting = false);
        window.addEventListener('mousemove', (e) => {
            if (window.isOrbiting) {
                window.orbitX -= e.movementX * 0.005;
                window.orbitY = Math.max(0.1, Math.min(1.5, window.orbitY + e.movementY * 0.005));
            }
        });
    }
});
