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

// Grass Terrain
const grassMat = new THREE.MeshStandardMaterial({ color: 0x1f5c22, roughness: 1.0 });
const grassGeo = new THREE.PlaneGeometry(100000, 100000);
const grass = new THREE.Mesh(grassGeo, grassMat);
grass.rotation.x = -Math.PI / 2;
window.scene.add(grass);

// Road
const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
const roadGeo = new THREE.PlaneGeometry(30, 100000); // 30 wide highway
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01; // Slightly above grass
window.scene.add(road);

// Road markings (white dashed line)
const lineCanvas = document.createElement('canvas');
lineCanvas.width = 64; lineCanvas.height = 256;
const ctx = lineCanvas.getContext('2d');
ctx.fillStyle = '#222222'; ctx.fillRect(0,0,64,256);
ctx.fillStyle = '#ffffff'; ctx.fillRect(28, 0, 8, 128); // Dashed line
const lineTex = new THREE.CanvasTexture(lineCanvas);
lineTex.wrapS = lineTex.wrapT = THREE.RepeatWrapping;
lineTex.repeat.set(1, 100000 / 5);

const lineMat = new THREE.MeshBasicMaterial({ map: lineTex });
const lineGeo = new THREE.PlaneGeometry(1, 100000);
const line = new THREE.Mesh(lineGeo, lineMat);
line.rotation.x = -Math.PI / 2;
line.position.y = 0.02;
window.scene.add(line);

// Scenery Group
const sceneries = new THREE.Group();
window.scene.add(sceneries);

function createTree() {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2), new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 1 }));
    trunk.position.y = 1; tree.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 }));
    leaves.position.y = 3; tree.add(leaves);
    return tree;
}

function createRock() {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 2, 1), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }));
    rock.position.y = rock.geometry.parameters.radius * 0.5;
    return rock;
}

// Generate scenery
for(let i=0; i<1500; i++) {
    let obj = (Math.random() > 0.3) ? createTree() : createRock();
    let side = Math.random() > 0.5 ? 1 : -1;
    let x = side * (20 + Math.random() * 100);
    let z = (Math.random() - 0.5) * 10000;
    obj.position.set(x, 0, z);
    let scale = 0.8 + Math.random() * 0.6;
    obj.scale.set(scale, scale, scale);
    obj.rotation.y = Math.random() * Math.PI * 2;
    sceneries.add(obj);
}
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
