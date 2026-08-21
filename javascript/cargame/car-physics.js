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

// --- PHYSICAL SPRING-DAMPER CAMERA SIMULATION STATE ---
const physCamPos = new THREE.Vector3();
const physCamVel = new THREE.Vector3();
const physLookPos = new THREE.Vector3();
const physLookVel = new THREE.Vector3();
let physRoll = 0;
let physRollVel = 0;
let isPhysCamInit = false;

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

// FRONT HEADLIGHTS & NIGHT RACING BEAMS
const hlMat = new THREE.MeshBasicMaterial({ color: 0xe0ffff });
const hlGeo = new THREE.BoxGeometry(0.45, 0.18, 0.08);
const hlL = new THREE.Mesh(hlGeo, hlMat);
hlL.position.set(0.72, 0.65, 2.11);
car.add(hlL);
const hlR = hlL.clone();
hlR.position.set(-0.72, 0.65, 2.11);
car.add(hlR);

// Headlight forward spotlights for road illumination
const spotL = new THREE.SpotLight(0xd0f4ff, 3.5, 90, Math.PI / 5.5, 0.35, 1.2);
spotL.position.set(0.72, 0.65, 2.1);
const targetL = new THREE.Object3D();
targetL.position.set(0.72, 0, 40);
car.add(spotL); car.add(targetL);
spotL.target = targetL;

const spotR = new THREE.SpotLight(0xd0f4ff, 3.5, 90, Math.PI / 5.5, 0.35, 1.2);
spotR.position.set(-0.72, 0.65, 2.1);
const targetR = new THREE.Object3D();
targetR.position.set(-0.72, 0, 40);
car.add(spotR); car.add(targetR);
spotR.target = targetR;

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
    // FRONTEND ARCADE PHYSICS
    // ============================================================

    if (engineData) {
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

        car.translateZ(speed * dt * 3.5);
        
        let turnMultiplier = speed * 0.1;
        // Apply high-speed understeer (soft clamp) to prevent violent shaking at high speeds
        if (turnMultiplier > 2.5) turnMultiplier = 2.5 + (turnMultiplier - 2.5) * 0.1;
        else if (turnMultiplier < -2.5) turnMultiplier = -2.5 + (turnMultiplier + 2.5) * 0.1;

        // Multiply by (dt * 60.0) to make the turn rate time-independent
        car.rotation.y -= (window.wheelAngle / 180) * 0.05 * turnMultiplier * (dt * 60.0);
    } else {
        // === Ultra-fallback: no engine ===
        if (window.inputs && window.inputs.fwd) speed += 0.025;
        else if (window.inputs && window.inputs.bwd) speed -= 0.015;
        speed *= 0.99;
        rpm = Math.abs(speed) * 8000;
        car.translateZ(speed * dt * 3.5);

        let turnMultiplier = speed * 0.1;
        if (turnMultiplier > 2.5) turnMultiplier = 2.5 + (turnMultiplier - 2.5) * 0.1;
        else if (turnMultiplier < -2.5) turnMultiplier = -2.5 + (turnMultiplier + 2.5) * 0.1;

        car.rotation.y -= (window.wheelAngle / 180) * 0.05 * turnMultiplier * (dt * 60.0);
    }

    // --- INFINITE WORLD & FLOATING ORIGIN: PREVENT HIGH-SPEED WEBGL JITTER ---
    if (window.sceneries && window.sceneries.children) {
        window.sceneries.children.forEach(obj => {
            // Wrap trees infinitely around the car
            const dz = (obj.position.z + window.sceneries.position.z) - car.position.z;
            if (dz > 6000) obj.position.z -= 12000;
            if (dz < -6000) obj.position.z += 12000;
        });
    }

    // When the car travels far from 0,0,0, float precision breaks down causing the "terrain shake" bug.
    // We seamlessly teleport the entire world back towards the origin to fix this!
    if (Math.abs(car.position.x) > 3000 || Math.abs(car.position.z) > 3000) {
        const shiftX = car.position.x;
        // Snap to nearest multiple of 12 to prevent lane lines from visually jumping
        const shiftZ = Math.round(car.position.z / 12) * 12;

        car.position.x -= shiftX;
        car.position.z -= shiftZ;

        // Shift camera tracking positions instantly
        physCamPos.x -= shiftX;
        physCamPos.z -= shiftZ;
        physLookPos.x -= shiftX;
        physLookPos.z -= shiftZ;

        // Shift all scenery and environment meshes (road, grass, etc)
        if (window.scene && window.scene.children) {
            window.scene.children.forEach(child => {
                if (child !== car && child.position && !child.isLight) {
                    child.position.x -= shiftX;
                    child.position.z -= shiftZ;
                }
            });
        }
        
        // Shift any existing smoke particles
        smokeParticles.forEach(p => {
            p.position.x -= shiftX;
            p.position.z -= shiftZ;
        });
    }

    // === Smoke/drift data (frontend only - no backend) ===
    let slipAngle = 0;
    let wheelspin = 0;
    let brakeLock = 0;

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
            for (let k = 0; k < 2; k++) {
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

    // ============================================================
    // CLEAN RACING CHASE CAMERA LOGIC
    // ============================================================
    let kph = Math.abs(speed * 3.6);
    let speedFactor = Math.min(kph / 360, 1.0);
    
    // Explicit pullback: closer at rest, smoothly increases distance at speed
    let speedPullback = speedFactor * 1.5;
    let speedElevation = speedFactor * 0.4;

    // Dynamic FOV with smooth speed expansion
    const baseFov = 56;
    const maxFov = 61;
    const targetFov = baseFov + speedFactor * (maxFov - baseFov);
    if (!window.currentFov) window.currentFov = baseFov;
    window.currentFov += (targetFov - window.currentFov) * Math.min(1.0, dt * 5.0);
    if (window.camera && Math.abs(window.camera.fov - window.currentFov) > 0.05) {
        window.camera.fov = window.currentFov;
        window.camera.updateProjectionMatrix();
    }



    const mode = window.cameraMode || 0;

    // Local target camera offsets (+Z forward, -Z backward, +Y up)
    const localIdealPos = new THREE.Vector3();
    const localIdealLook = new THREE.Vector3();

    if (mode === 0) {
        // --- MODE 0: DYNAMIC CHASE ---
        localIdealPos.set(0, 3.5 + speedElevation, -7.5 - speedPullback);
        localIdealLook.set(0, 0.0, 15.0);
    } else if (mode === 1) {
        // --- MODE 1: CLOSE ACTION ---
        localIdealPos.set(0, 2.5 + (speedElevation * 0.7), -5.5 - (speedPullback * 0.7));
        localIdealLook.set(0, 0.2, 12.0);
    } else if (mode === 2) {
        // --- MODE 2: HOOD / COCKPIT ---
        localIdealPos.set(0, 1.35, 0.65);
        localIdealLook.set(0, 0.90, 35.0);
    } else if (mode === 3) {
        // --- MODE 3: BUMPER RUSH ---
        localIdealPos.set(0, 0.50, 2.2);
        localIdealLook.set(0, 0.40, 40.0);
    }

    // Apply Orbit Drag (Free look) & Smooth Auto-Recenter
    if (window.orbitX === undefined) window.orbitX = 0;
    if (window.orbitY === undefined) window.orbitY = 0;

    if (!window.isOrbiting) {
        window.orbitX *= 0.92;
        window.orbitY *= 0.92;
    }

    if (Math.abs(window.orbitX) > 0.0001 || Math.abs(window.orbitY) > 0.0001) {
        const orbitEuler = new THREE.Euler((window.orbitY || 0) * 0.4, window.orbitX || 0, 0, 'YXZ');
        localIdealPos.applyEuler(orbitEuler);
        localIdealLook.applyEuler(orbitEuler);
    }

    // Initialize tracking state
    if (!window.physCamRot || window.lastCameraMode !== mode) {
        window.physCamRot = car.quaternion.clone();
        physCamPos.copy(car.position);
        physLookPos.copy(car.position);
        physRoll = 0;
        physRollVel = 0;
        window.lastCameraMode = mode;
    }

    let idealWorldPos = new THREE.Vector3();
    let idealWorldLook = new THREE.Vector3();

    if (mode === 2 || mode === 3) {
        // Rigid attachment for First Person / Bumper views
        window.physCamRot.copy(car.quaternion);
        window.camera.up.set(0, 1, 0);
        
        idealWorldPos.copy(localIdealPos).applyQuaternion(car.quaternion).add(car.position);
        idealWorldLook.copy(localIdealLook).applyQuaternion(car.quaternion).add(car.position);
        
        physCamPos.copy(idealWorldPos);
        physLookPos.copy(idealWorldLook);
    } else {
        // --- CHASE CAMERA INERTIA LOGIC ---
        // We use a softer stiffness for the underlying physics so it never jitters on frame drops.
        const turnStiffness = (mode === 1) ? 28.0 : 22.0; 
        window.physCamRot.slerp(car.quaternion, 1.0 - Math.exp(-dt * turnStiffness));

        // To reduce the extreme side-angle without causing high-stiffness jitter,
        // we blend the smooth lagging rotation back towards the car's exact rotation.
        // 0.25 means we only show 25% of the total lag (massively reducing the side-view angle).
        const renderCamRot = new THREE.Quaternion();
        renderCamRot.copy(car.quaternion).slerp(window.physCamRot, 0.25);

        // Transform position by this reduced lag rotation
        idealWorldPos.copy(localIdealPos).applyQuaternion(renderCamRot).add(car.position);
        
        // Transform look target ALSO by the reduced lag rotation so the car stays centered
        idealWorldLook.copy(localIdealLook).applyQuaternion(renderCamRot).add(car.position);

        // Rigidly lock position to the calculated ideal targets to completely eliminate high-speed jitter
        // (Inertia is already handled rotationally by physCamRot lagging)
        physCamPos.copy(idealWorldPos);
        physLookPos.copy(idealWorldLook);

        // Dynamic Centrifugal Camera Roll on turns
        const turnG = (window.wheelAngle / 180) * (kph / 240);
        const targetRoll = THREE.MathUtils.clamp(-turnG * 0.04, -0.06, 0.06); 
        // Use unconditionally stable exponential lerp to fix violent shaking on frame drops
        physRoll += (targetRoll - physRoll) * (1.0 - Math.exp(-dt * 15.0));

        window.camera.up.set(0, 1, 0);
    }

    window.camera.position.copy(physCamPos);
    window.camera.lookAt(physLookPos);

    // Apply camera roll around local Z axis after lookAt ensures proper tilting regardless of world heading
    if (mode === 0 || mode === 1) {
        window.camera.rotateZ(physRoll);
    }

    window.renderer.render(window.scene, window.camera);

    if (window.updateHUD) {
        const rawSpeed = Math.abs(speed * 3.6);
        // Local calculations for fuel and temp
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
