import * as THREE from 'three';
window.THREE = THREE;

let isAudioInit = false;
window.initAudio = async () => {
    const overlay = document.getElementById('sound-overlay');
    if (overlay) overlay.style.display = 'none';
    const orbit = document.getElementById('orbit-zone');
    if (orbit) orbit.style.pointerEvents = 'auto';

    if (!isAudioInit) {
        isAudioInit = true;
        if (window.startTypeScriptEngineAudio) {
            window.startTypeScriptEngineAudio();
        } else {
            console.error("Vite TypeScript app not loaded yet or start function not exposed on window.");
        }
        setTimeout(() => {
            if (typeof window.manualGearIndex !== 'undefined') {
                window.manualGearIndex = 1;
            }
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp' })), 50);
        }, 100);
    }
};

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
