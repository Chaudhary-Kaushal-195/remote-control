import * as THREE from 'three';

let fuelLevel = 100;
let engineTemp = 20;
let rpm = 0;
let speed = 0;

window.wheelAngle = 0;
let backfireTick = 0;
let isBigBackfire = false;
window.triggerBackfireVisual = function (isBig) {
    isBigBackfire = !!isBig;
    backfireTick = isBigBackfire ? 20 : 8;
};

const car = new THREE.Group();
const paintMat = new THREE.MeshStandardMaterial({ color: 0xc1006e, roughness: 0.2, metalness: 0.8 });
const cyanNeon = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const windowMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0, metalness: 1, transparent: true, opacity: 0.8 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

const bodyGeo = new THREE.BoxGeometry(2.0, 0.7, 4.2);
const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
bodyMesh.position.y = 0.6;
car.add(bodyMesh);

const cabinGeo = new THREE.BoxGeometry(1.7, 0.6, 2.0);
const cabinMesh = new THREE.Mesh(cabinGeo, paintMat);
cabinMesh.position.set(0, 1.25, -0.1);
car.add(cabinMesh);

const winGeo = new THREE.BoxGeometry(1.72, 0.5, 1.8);
const winMesh = new THREE.Mesh(winGeo, windowMat);
winMesh.position.set(0, 1.25, -0.1);
car.add(winMesh);

const winTrim = new THREE.Mesh(new THREE.BoxGeometry(1.73, 0.05, 1.82), cyanNeon);
winTrim.position.set(0, 1.0, -0.1); car.add(winTrim);
const winTrim2 = winTrim.clone(); winTrim2.position.y = 1.5; car.add(winTrim2);

const underglowGroup = new THREE.Group();
const colors = [0x0ffffa, 0xf092ff, 0xffaa00, 0x00ff00, 0xff00ff, 0x00ffff];
const underglowStrips = [];
for (let i = 0; i < 15; i++) {
    const stripGeo = new THREE.BoxGeometry(2.2, 0.02, 0.15);
    const stripMat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.9 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 0.22, (i * 0.3) - 2.2);
    underglowGroup.add(strip);
    underglowStrips.push(strip);
}
car.add(underglowGroup);

const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.25, 0.15), paintMat);
bumper.position.set(0, 0.45, 2.1); car.add(bumper);
const bumperR = bumper.clone(); bumperR.position.z = -2.11; car.add(bumperR);

const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.1), paintMat);
mirror.position.set(1.1, 1.1, 0.7); car.add(mirror);
const mirrorL = mirror.clone(); mirrorL.position.x = -1.1; car.add(mirrorL);

const tlGroup = new THREE.Group();
const tlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), tailMat);
const tlOrange = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.11), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
tlOrange.position.x = 0.15; tlMesh.add(tlOrange);
tlGroup.add(tlMesh);

const tlL = tlGroup.clone(); tlL.position.set(0.65, 0.65, -2.12); car.add(tlL);
const tlR = tlGroup.clone(); tlR.position.set(-0.65, 0.65, -2.12); car.add(tlR);

const wheels = [];
const wGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 32);
wGeo.rotateZ(Math.PI / 2);
[{ x: 1.0, z: 1.3 }, { x: -1.0, z: 1.3 }, { x: 1.0, z: -1.3 }, { x: -1.0, z: -1.3 }].forEach((p) => {
    const anchor = new THREE.Group(); anchor.position.set(p.x, 0.55, p.z);
    const roller = new THREE.Group();
    roller.add(new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({ color: 0x111111 })));

    const stripCount = 8;
    for (let j = 0; j < stripCount; j++) {
        const angle = (j / stripCount) * Math.PI * 2;
        const stripGeo = new THREE.BoxGeometry(0.52, 0.03, 0.15);
        const stripMat = new THREE.MeshBasicMaterial({ color: (j % 2 === 0) ? 0x0ffffa : 0xf092ff });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(0, Math.cos(angle) * 0.56, Math.sin(angle) * 0.56);
        strip.rotation.x = angle;
        roller.add(strip);
    }

    const logo = new THREE.Group();
    const qGeo = new THREE.CircleGeometry(0.48, 32, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) {
        const q = new THREE.Mesh(qGeo, (i % 2 === 0) ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshBasicMaterial({ color: 0x0044aa }));
        q.rotation.y = Math.PI / 2; q.rotation.x = -i * (Math.PI / 2);
        logo.add(q);
    }
    logo.position.x = (p.x > 0) ? 0.28 : -0.28;
    if (p.x < 0) logo.rotation.y = Math.PI;
    roller.add(logo); anchor.add(roller); car.add(anchor);
    wheels.push({ anchor, roller });
});

const exhaust = new THREE.Group();
exhaust.position.set(0.65, 0.45, -2.12);
car.add(exhaust);

const backfireLight = new THREE.PointLight(0xff5500, 0, 5);
exhaust.add(backfireLight);

const flameGeo = new THREE.SphereGeometry(0.15, 8, 8);
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
const flame = new THREE.Mesh(flameGeo, flameMat);
exhaust.add(flame);

window.scene.add(car);
window.car = car; // Store globally if needed

// --- ANIMATION LOOP ---
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    if (!window.renderer || !window.scene || !window.camera) return;

    if (window.isPaused) {
        window.renderer.render(window.scene, window.camera);
        return;
    }

    if (!window.activeTouchId) {
        const useGyroOrRemoteWheel = window.gameSettings && (window.gameSettings.steering === 'gyro' || window.gameSettings.steering === 'wheel');

        if (useGyroOrRemoteWheel && window.gyroActive) {
            window.wheelAngle = window.wheelAngle * 0.9 + window.gyroTilt * 0.1;
        } else if (window.inputs && window.inputs.left) {
            window.wheelAngle = Math.max(-180, window.wheelAngle - 5);
        } else if (window.inputs && window.inputs.right) {
            window.wheelAngle = Math.min(180, window.wheelAngle + 5);
        } else {
            window.wheelAngle *= 0.88;
        }
        const visual = document.getElementById('wheel-visual');
        if (visual) visual.style.transform = `rotate(${window.wheelAngle}deg)`;
    }

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    let engineData = null;
    if (window.getEngineData) engineData = window.getEngineData();

    const maxGearSpeedsKPH = {
        '-1': 60,
        '0': 0,
        '1': 100,
        '2': 180,
        '3': 260,
        '4': 340,
        '5': 420,
        '6': 500
    };

    if (engineData) {
        let currentGear = engineData.gear.toString();
        let maxGearKPH = maxGearSpeedsKPH[currentGear] || 0;
        let calculatedKPH = (engineData.rpm / 10000) * maxGearKPH;

        let targetSpeed = calculatedKPH / 3.6;
        if (engineData.gear === -1) {
            targetSpeed = -targetSpeed;
        }

        let isBraking = window.inputs && window.inputs.brake;
        if (isBraking) {
            targetSpeed = 0;
        }

        if (engineData.gear === 0) {
            if (isBraking) {
                let brakeForce = 0.5 * (dt * 60.0);
                if (speed > 0) speed = Math.max(0, speed - brakeForce);
                if (speed < 0) speed = Math.min(0, speed + brakeForce);
            } else {
                // Smooth coasting in neutral (drag)
                speed *= 0.99;
            }
        } else {
            // Calculate natural smooth jump
            let smoothedDiff = (targetSpeed - speed) * (dt * 4.0);

            // Limit maximum jump so putting reverse at 90kph acts like brakes 
            // instead of teleporting the car backwards instantly
            let isBrakingOrReversing = (speed > 0 && targetSpeed <= 0) || (speed < 0 && targetSpeed >= 0);
            let limit = isBrakingOrReversing ? (dt * 30.0) : (dt * 12.0); // Braking force is stronger than acceleration
            if (isBraking) limit = dt * 50.0;

            if (smoothedDiff > limit) smoothedDiff = limit;
            if (smoothedDiff < -limit) smoothedDiff = -limit;

            speed += smoothedDiff;
        }

        rpm = engineData.rpm;
    } else {
        if (window.inputs && window.inputs.fwd) speed += 0.025;
        else if (window.inputs && window.inputs.bwd) speed -= 0.015;

        if (window.inputs && (window.inputs.handbrake || window.inputs.brake)) {
            let brakeForce = 0.08;
            if (speed > 0) speed = Math.max(0, speed - brakeForce);
            if (speed < 0) speed = Math.min(0, speed + brakeForce);
        }
        speed *= (window.inputs && window.inputs.handbrake) ? 0.95 : 0.99;
        rpm = Math.abs(speed) * 8000;
    }

    car.translateZ(speed * dt * 3.5);
    car.rotation.y -= (window.wheelAngle / 180) * 0.05 * (speed * 0.2);

    wheels.forEach((w, i) => {
        w.roller.rotation.x += speed * dt * 5.0;
        if (i < 2) w.anchor.rotation.y = -(window.wheelAngle / 180) * 0.7;
    });

    car.updateMatrixWorld(true);

    let camTarget = new THREE.Vector3();
    let camPos = new THREE.Vector3();

    let kph = Math.abs(speed * 3.6);
    let speedOffset = Math.min(kph / 150, 1.0) * 2.5;
    let fovTightness = 0.12 + Math.min(kph / 500, 1.0) * 0.8;

    if (window.cameraMode === 0) {
        camPos.set(0, 4 + (speedOffset * 0.2), -9 - speedOffset);
        camTarget.set(0, 0.5, 0);
    } else if (window.cameraMode === 1) {
        camPos.set(0, 1.3, 0.5);
        camTarget.set(0, 1.2, 5);
    } else {
        camPos.set(0, 2 + (speedOffset * 0.1), -6 - (speedOffset * 0.5));
        camTarget.set(0, 0.5, 0);
    }

    if (window.orbitX === undefined) window.orbitX = 0;
    const orbitMatrix = new THREE.Matrix4().makeRotationY(window.orbitX);
    camPos.applyMatrix4(orbitMatrix);

    const worldPos = camPos.applyMatrix4(car.matrixWorld);
    const worldTarget = camTarget.applyMatrix4(car.matrixWorld);

    if (window.cameraMode === 1) {
        window.camera.position.copy(worldPos);
    } else {
        window.camera.position.lerp(worldPos, fovTightness);
    }

    window.camera.lookAt(worldTarget);

    window.renderer.render(window.scene, window.camera);

    if (window.updateHUD) {
        const rawSpeed = Math.abs(speed * 3.6);
        if (rawSpeed > 1) fuelLevel -= 0.001;
        if (rawSpeed > 1 && engineTemp < 90) engineTemp += 0.002;
        else if (engineTemp > 20) engineTemp -= 0.001;
        window.updateHUD(rawSpeed, rpm, engineTemp, fuelLevel, engineData, window.manualGearIndex);
    }

    if (backfireTick > 0) {
        backfireTick--;
        let maxIntensity = isBigBackfire ? 15 : 5;
        let scaleBase = isBigBackfire ? 2.5 : 1;
        let scaleRand = isBigBackfire ? 4.0 : 1.5;
        let maxTicks = isBigBackfire ? 20 : 8;

        backfireLight.intensity = maxIntensity * (backfireTick / maxTicks);
        flame.scale.setScalar(scaleBase + Math.random() * scaleRand);
        flame.material.opacity = Math.min(1, (backfireTick / maxTicks) * (isBigBackfire ? 1.5 : 1.0));
    } else {
        backfireLight.intensity = 0;
        flame.material.opacity = 0;
    }

    const shimmer = Math.sin(Date.now() * 0.005) * 0.1;
    underglowStrips.forEach((strip, idx) => {
        strip.position.z -= (speed * 2) + (shimmer * 0.1);
        strip.material.opacity = 0.6 + (Math.sin(Date.now() * 0.003 + idx) * 0.2);
        if (strip.position.z < -2) strip.position.z = 1.8;
        if (strip.position.z > 1.8) strip.position.z = -2;
    });
}

// Guarantee execution after DOM and other globals parse
setTimeout(animate, 200);
