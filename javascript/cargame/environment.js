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
        if (window.startTypeScriptEngineAudio) {
            try {
                await window.startTypeScriptEngineAudio();
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
window.scene.background = new THREE.Color(0x060913);
window.scene.fog = new THREE.FogExp2(0x060913, 0.0038);

// Crisp, focused initial camera with 56 degree FOV (standard racing perspective)
window.camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.2, 2500);
window.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
window.renderer.setSize(window.innerWidth, window.innerHeight);

// Responsive window resize handling
window.addEventListener('resize', () => {
    if (!window.camera || !window.renderer) return;
    window.camera.aspect = window.innerWidth / window.innerHeight;
    window.camera.updateProjectionMatrix();
    window.renderer.setSize(window.innerWidth, window.innerHeight);
    window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    if (container) container.appendChild(window.renderer.domElement);
});

// 4 Cinematic Camera Views
window.cameraMode = 0;
const cameraModes = ["DYNAMIC CHASE", "CLOSE ACTION", "HOOD COCKPIT", "BUMPER RUSH"];
const cameraIcons = ["🎥", "🏎️", "👀", "⚡"];

window.cycleCamera = () => {
    window.cameraMode = (window.cameraMode + 1) % 4;
    const modeName = cameraModes[window.cameraMode];
    const modeIcon = cameraIcons[window.cameraMode];

    const triggerBtn = document.getElementById('cam-trigger-btn');
    if (triggerBtn) {
        triggerBtn.title = `Camera: ${modeName}`;
        triggerBtn.innerText = modeIcon;
    }
    const btn = document.getElementById('cam-btn');
    if (btn) btn.innerText = `${modeIcon} VIEW: ${modeName}`;

    if (window.showGameNotification) {
        window.showGameNotification(`${modeIcon} ${modeName}`, "#00ffff");
    }
};

// Grass / Terrain Ground
const grassMat = new THREE.MeshStandardMaterial({ color: 0x0e2014, roughness: 1.0, metalness: 0.0 });
const grassGeo = new THREE.PlaneGeometry(100000, 100000);
const grass = new THREE.Mesh(grassGeo, grassMat);
grass.rotation.x = -Math.PI / 2;
window.scene.add(grass);

// Road (30m wide highway)
const roadMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.75, metalness: 0.15 });
const roadGeo = new THREE.PlaneGeometry(30, 100000);
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
window.scene.add(road);

// Road Neon Edge Curbs (Left & Right Glowing Strip Boundaries)
const curbGeo = new THREE.PlaneGeometry(0.4, 100000);
const curbMatL = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
const curbL = new THREE.Mesh(curbGeo, curbMatL);
curbL.rotation.x = -Math.PI / 2;
curbL.position.set(-14.8, 0.025, 0);
window.scene.add(curbL);

const curbMatR = new THREE.MeshBasicMaterial({ color: 0xff0077 });
const curbR = new THREE.Mesh(curbGeo, curbMatR);
curbR.rotation.x = -Math.PI / 2;
curbR.position.set(14.8, 0.025, 0);
window.scene.add(curbR);

// Lane Markings (3-Lane Highway with Center and Sub-Lane Dashes)
const lineCanvas = document.createElement('canvas');
lineCanvas.width = 128; lineCanvas.height = 256;
const ctx = lineCanvas.getContext('2d');
ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0,0,128,256);
// Center yellow/white dashed line
ctx.fillStyle = '#ffffff';
ctx.fillRect(60, 0, 8, 140);
// Side lane dashes
ctx.fillStyle = 'rgba(255,255,255,0.45)';
ctx.fillRect(16, 0, 4, 140);
ctx.fillRect(108, 0, 4, 140);

const lineTex = new THREE.CanvasTexture(lineCanvas);
lineTex.wrapS = lineTex.wrapT = THREE.RepeatWrapping;
lineTex.repeat.set(1, 100000 / 12);

const lineMat = new THREE.MeshBasicMaterial({ map: lineTex, transparent: true });
const lineGeo = new THREE.PlaneGeometry(28, 100000);
const laneLines = new THREE.Mesh(lineGeo, lineMat);
laneLines.rotation.x = -Math.PI / 2;
laneLines.position.y = 0.03;
window.scene.add(laneLines);

// Atmospheric Track Lighting
const ambientLight = new THREE.AmbientLight(0xddeeff, 0.65);
window.scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xaaccff, 0.85);
dirLight.position.set(50, 100, -30);
window.scene.add(dirLight);

// Scenery Group
const sceneries = new THREE.Group();
window.scene.add(sceneries);
window.sceneries = sceneries;

function createTree() {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0x2e1d15, roughness: 1 }));
    trunk.position.y = 1.5; tree.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 8), new THREE.MeshStandardMaterial({ color: 0x144020, roughness: 0.9 }));
    leaves.position.y = 4.2; tree.add(leaves);
    return tree;
}

function createRock() {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 2, 1), new THREE.MeshStandardMaterial({ color: 0x333b48, roughness: 0.9 }));
    rock.position.y = rock.geometry.parameters.radius * 0.5;
    return rock;
}

// Generate roadside scenery
for(let i = 0; i < 1200; i++) {
    let obj = (Math.random() > 0.3) ? createTree() : createRock();
    let side = Math.random() > 0.5 ? 1 : -1;
    let x = side * (18 + Math.random() * 120);
    let z = (Math.random() - 0.5) * 12000;
    obj.position.set(x, 0, z);
    let scale = 0.8 + Math.random() * 0.7;
    obj.scale.set(scale, scale, scale);
    obj.rotation.y = Math.random() * Math.PI * 2;
    sceneries.add(obj);
}

// Orbit Controls & Free Camera Look
window.orbitX = 0;
window.orbitY = 0;
window.isOrbiting = false;

window.startOrbit = (x, y, id) => {
    window.isOrbiting = true;
    window.orbitTouchId = id;
    window.lastOrbitTouch = { x, y };
};
window.moveOrbit = (x, y) => {
    if (window.isOrbiting && window.lastOrbitTouch) {
        let dx = x - window.lastOrbitTouch.x;
        let dy = y - window.lastOrbitTouch.y;
        window.orbitX -= dx * 0.005;
        window.orbitY = Math.max(-0.6, Math.min(0.6, window.orbitY + dy * 0.005));
        window.lastOrbitTouch = { x, y };
    }
};
window.endOrbit = () => {
    window.isOrbiting = false;
    window.orbitTouchId = null;
    window.lastOrbitTouch = null;
};

document.addEventListener('DOMContentLoaded', () => {
    const orbitZone = document.getElementById('orbit-zone');
    if (orbitZone) {
        orbitZone.addEventListener('mousedown', (e) => {
            window.isOrbiting = true;
            window.lastOrbitTouch = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('mouseup', () => {
            window.isOrbiting = false;
            window.lastOrbitTouch = null;
        });
        window.addEventListener('mousemove', (e) => {
            if (window.isOrbiting && window.lastOrbitTouch) {
                let dx = e.clientX - window.lastOrbitTouch.x;
                let dy = e.clientY - window.lastOrbitTouch.y;
                window.orbitX -= dx * 0.005;
                window.orbitY = Math.max(-0.6, Math.min(0.6, window.orbitY + dy * 0.005));
                window.lastOrbitTouch = { x: e.clientX, y: e.clientY };
            }
        });
    }
});
