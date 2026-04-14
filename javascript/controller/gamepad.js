/**
 * GAMEPAD ENGINE for Dr. Control
 * Handles physical controller input and sends it to the laptop via PeerJS
 */

let gamepadInterval = null;
let lastGamepadState = {
    buttons: [],
    axes: []
};

window.addEventListener("gamepadconnected", (e) => {
    console.log("Gamepad connected:", e.gamepad.id);
    startGamepadLoop();
    showGamepadDashboard(e.gamepad.id);
    if (window.vibrate) window.vibrate(100);
});

window.addEventListener("gamepaddisconnected", (e) => {
    console.log("Gamepad disconnected");
    stopGamepadLoop();
    hideGamepadDashboard();
});

function startGamepadLoop() {
    if (!gamepadInterval) {
        gamepadInterval = setInterval(pollGamepad, 16); // ~60fps
    }
}

function stopGamepadLoop() {
    if (gamepadInterval) {
        clearInterval(gamepadInterval);
        gamepadInterval = null;
    }
}

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0]; // Primary controller
    if (!gp) return;

    // --- MAPPINGS ---
    // B7: RT (Gas), B6: LT (Brake)
    // B5: RB (Gear Up), B4: LB (Gear Down)
    // Axis 0: L-Stick X (Steer)
    
    const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
    const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
    const rb = gp.buttons[5] && gp.buttons[5].pressed;
    const lb = gp.buttons[4] && gp.buttons[4].pressed;
    const steerAxis = gp.axes[0] || 0;
    
    // Face buttons as fallbacks
    const aBtn = gp.buttons[0] && gp.buttons[0].pressed;
    const bBtn = gp.buttons[1] && gp.buttons[1].pressed;
    const startBtn = gp.buttons[9] && gp.buttons[9].pressed;

    // --- TRANSMISSION ---
    if (window.conn && window.conn.open) {
        // GAS
        const finalGas = Math.max(rt, aBtn ? 1.0 : 0);
        if (finalGas !== lastGamepadState.gas) {
            window.conn.send({ type: 'pedal', pedal: 'fwd', active: finalGas > 0.1, intensity: finalGas });
            lastGamepadState.gas = finalGas;
        }

        // BRAKE
        const finalBrake = Math.max(lt, bBtn ? 1.0 : 0);
        if (finalBrake !== lastGamepadState.brake) {
            window.conn.send({ type: 'pedal', pedal: 'brake', active: finalBrake > 0.1, intensity: finalBrake });
            lastGamepadState.brake = finalBrake;
        }

        // STEERING (Mapped to gyro tilt equivalents)
        // Physics expect -180 to 180 degrees
        const tilt = steerAxis * 90; 
        if (Math.abs(tilt - lastGamepadState.tilt) > 0.5) {
            window.conn.send({ type: 'gyro', tilt: tilt });
            lastGamepadState.tilt = tilt;
        }

        // GEARS (LB/RB)
        if (rb && !lastGamepadState.rb) window.shiftGear('up');
        if (lb && !lastGamepadState.lb) window.shiftGear('down');
        
        // PAUSE (Start)
        if (startBtn && !lastGamepadState.start) window.togglePauseFromRemote();
    }

    // --- UI UPDATES ---
    updateGamepadUI(gp, steerAxis, rt, lt);

    // Save state for edge detection
    lastGamepadState.rb = rb;
    lastGamepadState.lb = lb;
    lastGamepadState.start = startBtn;
}

function showGamepadDashboard(name) {
    const dashboard = document.getElementById('gamepad-dashboard');
    if (dashboard) {
        dashboard.style.display = 'flex';
        const nameEl = dashboard.querySelector('.controller-name');
        if (nameEl) nameEl.innerText = name;
    }
}

function hideGamepadDashboard() {
    const dashboard = document.getElementById('gamepad-dashboard');
    if (dashboard) dashboard.style.display = 'none';
}

function updateGamepadUI(gp, steer, gas, brake) {
    // Gas/Brake Meters
    const gasFill = document.querySelector('.gas-fill');
    const brakeFill = document.querySelector('.brake-fill');
    if (gasFill) gasFill.style.height = (gas * 100) + '%';
    if (brakeFill) brakeFill.style.height = (brake * 100) + '%';

    // Stick Visualizer
    const dot = document.querySelector('.stick-dot');
    if (dot) {
        // Move dot based on L-Stick X and Y
        const yAxis = gp.axes[1] || 0;
        dot.style.transform = `translate(calc(-50% + ${steer * 50}px), calc(-50% + ${yAxis * 50}px))`;
    }

    // Button Indicators
    const updateBtn = (cls, active, gasColor = false) => {
        const el = document.querySelector('.' + cls);
        if (el) {
            if (active) {
                el.classList.add('active');
                if (gasColor) el.classList.add('gas-active');
            } else {
                el.classList.remove('active');
                el.classList.remove('gas-active');
            }
        }
    };

    updateBtn('btn-lb', gp.buttons[4] && gp.buttons[4].pressed);
    updateBtn('btn-rb', gp.buttons[5] && gp.buttons[5].pressed);
    updateBtn('btn-a', gp.buttons[0] && gp.buttons[0].pressed, true);
    updateBtn('btn-b', gp.buttons[1] && gp.buttons[1].pressed);
}
