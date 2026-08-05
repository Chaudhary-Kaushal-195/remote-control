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

const smokeParticles = [];
const smokeGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const smokeMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 });

// --- ANIMATION LOOP ---
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    if (!window.renderer || !window.scene || !window.camera) return;

    if (window.isPaused) {
        window.renderer.render(window.scene, window.camera);
        return;
    }

    const steeringMode = window.gameSettings ? window.gameSettings.steering : 'wheel';
    const isPhoneConnected = !!(window.conn && window.conn.open);

    // BUG FIX: Use a 300ms staleness check.
    // Once gyroActive is set it was never cleared, causing the wheel to stay locked
    // to the last tilt value even after the user released the phone wheel.
    const gyroFresh = window.lastGyroTime && (Date.now() - window.lastGyroTime < 300);
    const useRemoteGyro = isPhoneConnected && gyroFresh && window.activeInputSource === 'phone';
    const useLocalGyro = steeringMode === 'gyro' && window.gyroActive && !isPhoneConnected;
    const useGyro = useRemoteGyro || useLocalGyro;
    const useGamepad = steeringMode === 'gamepad' && window.gamepadConnected && window.activeInputSource === 'gamepad';
    const isTouchWheel = steeringMode === 'wheel' && window.activeTouchId != null;

    let hasInput = false;

    if (useGyro) {
        window.wheelAngle = window.wheelAngle * 0.9 + window.gyroTilt * 0.1;
        // BUG FIX: Widened deadzone from 1 to 5 degrees.
        // Phone gyro sensors drift, so even when level the reading can be 2-4°,
        // which was making hasInput=true permanently and blocking auto-center.
        hasInput = Math.abs(window.gyroTilt) > 5;
    } else if (useGamepad) {
        const axisValue = window.gamepadSteerAxis || 0;
        const deadzone = 0.2;
        if (Math.abs(axisValue) > deadzone) {
            // Re-map the value to start smoothly from 0 after exiting deadzone
            const sign = Math.sign(axisValue);
            const activeAxis = (Math.abs(axisValue) - deadzone) / (1.0 - deadzone);
            const target = sign * activeAxis * 120;
            window.wheelAngle = window.wheelAngle * 0.8 + target * 0.2;
            hasInput = true;
        } else {
            hasInput = false;
        }
    } else if (isTouchWheel) {
        // Touch wheel handles its own wheelAngle updates via touchmove
        hasInput = true;
    }

    // Keyboard / Binary Buttons Override (Digital fallback)
    // Only apply if we aren't already using the gamepad's analog stick 
    if (!useGamepad) {
        if (window.inputs && window.inputs.left) {
            window.wheelAngle = Math.max(-180, window.wheelAngle - 5);
            hasInput = true;
        } else if (window.inputs && window.inputs.right) {
            window.wheelAngle = Math.min(180, window.wheelAngle + 5);
            hasInput = true;
        }
    }

    // UNIVERSAL AUTO-CENTER
    // If no active input is detected from the current hardware, return to center
    if (!hasInput) {
        const centerSpeed = 0.88;
        if (Math.abs(window.wheelAngle) > 0.1) {
            window.wheelAngle *= centerSpeed;
        } else {
            window.wheelAngle = 0;
        }
    }

    // Sync visual wheel if not on phone (laptop HUD)
    if (!window.wheelVisualEl) window.wheelVisualEl = document.getElementById('wheel-visual');
    if (window.wheelVisualEl) window.wheelVisualEl.style.transform = `rotate(${window.wheelAngle}deg)`;

    // Handle Gamepad Vibration for Backfires
    if (backfireTick > 0 && window.gamepadConnected && window.gamepadIndex !== null) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[window.gamepadIndex];
        if (gp && gp.vibrationActuator) {
            // Only trigger at start of backfire
            if (backfireTick === (isBigBackfire ? 19 : 7)) {
                gp.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: isBigBackfire ? 150 : 80,
                    strongMagnitude: isBigBackfire ? 0.8 : 0.4,
                    weakMagnitude: isBigBackfire ? 1.0 : 0.6
                });
            }
        }
    }

    // Handle Controller Haptics for Redlining / Optimal Shift Point (approx. Omega 95)
    if (rpm > 8850) {
        // Physical Gamepad Haptics
        if (window.gamepadConnected && window.gamepadIndex !== null) {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = gamepads[window.gamepadIndex];
            if (gp && gp.vibrationActuator) {
                // Short, sharp pulse (high freq but brief)
                gp.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: 25,
                    strongMagnitude: 0.1,
                    weakMagnitude: 0.6
                });
            }
        }

        // Remote Phone Haptics (PeerJS Bridge)
        if (window.conn && window.conn.open) {
            // Increased delay between pulses (250ms) to make it feel less busy
            if (!window.lastRedlineVibrate || (Date.now() - window.lastRedlineVibrate) > 250) {
                window.conn.send({ type: 'vibrate', pattern: 25 });
                window.lastRedlineVibrate = Date.now();
            }
        }
    }

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    let engineData = null;
    if (window.getEngineData) engineData = window.getEngineData();

    // ============================================================
    // PHYSICS ENGINE DRIVEN MOVEMENT
    // Python is the single source of truth for speed, heading, yaw.
    // JS only renders what Python tells it.
    // ============================================================
    const tel = window.advancedTelemetry;

    if (tel && tel.speed_kph !== undefined) {
        // === Read authoritative state from Python ===
        speed = tel.speed_ms || 0;
        rpm = tel.rpm || 800;

        // Read yaw rate and apply rotation
        let yawRate = tel.yaw_rate || 0;
        car.rotation.y += yawRate * dt;

        // Read velocity components (car-local frame) and move the car
        let vx_local = tel.vx || 0;
        let vy_local = tel.vy || 0;

        // Convert to Three.js coordinate system and move car
        // In Three.js: translateZ = forward, translateX = sideways
        car.translateZ(vx_local * dt);
        car.translateX(vy_local * dt);

    } else if (engineData) {
        // === Fallback: old arcade physics (when Python server not connected) ===
        const maxGearSpeedsKPH = {
            '-1': 60, '0': 0, '1': 100, '2': 180,
            '3': 260, '4': 340, '5': 420, '6': 500
        };
        let currentGear = engineData.gear.toString();
        let maxGearKPH = maxGearSpeedsKPH[currentGear] || 0;
        let calculatedKPH = (engineData.rpm / 10000) * maxGearKPH;
        let targetSpeed = calculatedKPH / 3.6;
        if (engineData.gear === -1) targetSpeed = -targetSpeed;

        let brakeIntensity = engineData.brake || 0;
        if (brakeIntensity > 0) targetSpeed = 0;

        if (engineData.gear === 0) {
            if (brakeIntensity > 0) {
                let brakeForce = 0.5 * brakeIntensity * (dt * 60.0);
                if (speed > 0) speed = Math.max(0, speed - brakeForce);
                if (speed < 0) speed = Math.min(0, speed + brakeForce);
            } else {
                speed *= 0.99;
            }
        } else {
            let smoothedDiff = (targetSpeed - speed) * (dt * 4.0);
            let isBrakingOrReversing = (speed > 0 && targetSpeed <= 0) || (speed < 0 && targetSpeed >= 0);
            let baseLimit = isBrakingOrReversing ? (dt * 30.0) : (dt * 12.0);
            let fullBrakeLimit = dt * 50.0;
            let limit = baseLimit + (fullBrakeLimit - baseLimit) * brakeIntensity;
            if (smoothedDiff > limit) smoothedDiff = limit;
            if (smoothedDiff < -limit) smoothedDiff = -limit;
            speed += smoothedDiff;
        }

        rpm = engineData.rpm;

        // Old arcade movement (fallback)
        car.translateZ(speed * dt * 3.5);
        car.rotation.y -= (window.wheelAngle / 180) * 0.05 * (speed * 0.2);
    } else {
        // === Ultra-fallback: no engine, no server ===
        if (window.inputs && window.inputs.fwd) speed += 0.025;
        else if (window.inputs && window.inputs.bwd) speed -= 0.015;
        speed *= 0.99;
        rpm = Math.abs(speed) * 8000;
        car.translateZ(speed * dt * 3.5);
        car.rotation.y -= (window.wheelAngle / 180) * 0.05 * (speed * 0.2);
    }

    // === Read smoke/drift data from physics engine ===
    let slipAngle = 0;
    let wheelspin = 0;
    let brakeLock = 0;
    if (tel) {
        slipAngle = tel.slip_angle || 0;
        wheelspin = tel.wheelspin || 0;
        brakeLock = tel.brake_lock || 0;
    }

    wheels.forEach((w, i) => {
        w.roller.rotation.x += speed * dt * 5.0;
        
        // Spin rear wheels during a burnout
        if (i >= 2 && Math.abs(wheelspin) > 0.1) {
            w.roller.rotation.x += wheelspin * dt * 50.0;
        }

        if (i < 2) w.anchor.rotation.y = -(window.wheelAngle / 180) * 0.7;
    });

    car.updateMatrixWorld(true);

    // --- DRIFT SMOKE PARTICLES ---
    // Update existing particles
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.position.y += dt * 2.0;
        p.position.x += p.userData.vx * dt;
        p.position.z += p.userData.vz * dt;
        p.scale.x += dt * 2.0;
        p.scale.y += dt * 2.0;
        p.scale.z += dt * 2.0;
        p.material.opacity -= dt * 1.5;
        if (p.material.opacity <= 0) {
            window.scene.remove(p);
            smokeParticles.splice(i, 1);
        }
    }

    // Emit new particles if drifting, burnout, or locking brakes
    let isDrifting = Math.abs(slipAngle) > 0.1 && Math.abs(speed) > 0.5;
    let isBurnout = Math.abs(wheelspin) > 0.3;
    let isBraking = brakeLock > 0.3;

    if (isDrifting || isBurnout || isBraking) {
        // Emit from rear wheels
        const rw1 = new THREE.Vector3();
        rw1.setFromMatrixPosition(wheels[2].anchor.matrixWorld);
        const rw2 = new THREE.Vector3();
        rw2.setFromMatrixPosition(wheels[3].anchor.matrixWorld);

        [rw1, rw2].forEach(pos => {
            // Create a few particles per wheel for density
            for(let k = 0; k < 2; k++) {
                const smoke = new THREE.Mesh(smokeGeo, smokeMat.clone());
                smoke.position.copy(pos);
                // Start slightly above ground
                smoke.position.y = 0.2;
                // Add random velocity spread
                smoke.userData = {
                    vx: (Math.random() - 0.5) * 2.0,
                    vz: (Math.random() - 0.5) * 2.0
                };
                // Random scale
                const s = 0.5 + Math.random() * 0.5;
                smoke.scale.set(s, s, s);
                window.scene.add(smoke);
                smokeParticles.push(smoke);
            }
        });
    }

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

    if (!window.actualCamPos) {
        window.actualCamPos = worldPos.clone();
        window.actualCamTarget = worldTarget.clone();
    } else {
        // Fast snap for inside cam, smooth lag for chase cams to show drifting
        let lerpFactor = (window.cameraMode === 1) ? 1.0 : (dt * 10.0);
        window.actualCamPos.lerp(worldPos, lerpFactor);
        window.actualCamTarget.lerp(worldTarget, lerpFactor);
    }

    if (window.cameraMode === 1) {
        window.camera.position.copy(window.actualCamPos);
        window.camera.lookAt(window.actualCamTarget);
    } else {
        window.camera.position.copy(window.actualCamPos);
        window.camera.lookAt(window.actualCamTarget);
    }
    
    window.renderer.render(window.scene, window.camera);

    if (window.updateHUD) {
        const rawSpeed = Math.abs(speed * 3.6);
        if (rawSpeed > 1) fuelLevel -= 0.001;
        if (rawSpeed > 1 && engineTemp < 90) engineTemp += 0.002;
        else if (engineTemp > 20) engineTemp -= 0.001;
        window.updateHUD(rawSpeed, rpm, engineTemp, fuelLevel, engineData, window.manualGearIndex);
        if (window.sendTelemetryData) {
            let currentGear = engineData ? engineData.gear : (window.manualGearIndex || 1);
            window.sendTelemetryData(rawSpeed, rpm, currentGear);
        }
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
