// telemetry-client.js
// Bridges the JS game to the Python Physics Engine via WebSocket.
// JS sends ONLY inputs. Python computes everything and sends back authoritative state.

window.advancedTelemetry = null;
let ws = null;

window.initTelemetryClient = () => {
    ws = new WebSocket('ws://localhost:8765');
    
    ws.onopen = () => {
        console.log("Connected to Forza-Grade Physics Engine!");
        if (window.showGameNotification) {
            window.showGameNotification("PHYSICS ENGINE ONLINE", "#ff00ff");
        }
    };
    
    ws.onmessage = (event) => {
        try {
            window.advancedTelemetry = JSON.parse(event.data);
            if (window.updateTelemetryUI) {
                window.updateTelemetryUI();
            }
        } catch(e) {
            console.error("Telemetry parse error", e);
        }
    };
    
    ws.onclose = () => {
        console.warn("Disconnected from Physics Engine.");
        setTimeout(window.initTelemetryClient, 5000); // Reconnect every 5 seconds
    };
};

window.sendTelemetryData = (speed, rpm, gear) => {
    if (ws && ws.readyState === WebSocket.OPEN && window.inputs) {
        // Send ONLY inputs — Python computes everything
        const fwd = window.inputs.fwd || 0;
        const bwd = window.inputs.bwd || 0;
        const throttle = typeof fwd === 'number' ? fwd : (fwd ? 1.0 : 0);
        const brake = typeof bwd === 'number' ? bwd : (bwd ? 1.0 : 0);
        
        let steering = 0;
        if (window.wheelAngle) {
            steering = window.wheelAngle / 180.0;
        }

        // Get gear from the audio engine (it manages gear state for both manual and auto)
        let currentGear = gear;
        if (window.getEngineData) {
            let engData = window.getEngineData();
            if (engData && engData.rpm > 0) {
                currentGear = engData.gear;
            }
        }

        // Failsafe: if the audio engine isn't running, auto-shift so the car can move
        if (currentGear === 0) {
            if (throttle > 0.1) currentGear = 1;
            else if (brake > 0.1) currentGear = -1;
        }

        ws.send(JSON.stringify({
            throttle: throttle,
            brake: brake,
            handbrake: window.inputs.handbrake ? 1.0 : 0.0,
            steering: -steering, // Invert steering to match backend physics coordinate system
            gear: currentGear,
            drivetrain: window.gameSettings ? (window.gameSettings.drivetrain || 'rwd') : 'rwd',
            drift_mode: window.gameSettings ? !!window.gameSettings.driftMode : false,
            grip_level: window.gameSettings && window.gameSettings.gripLevel !== undefined ? parseFloat(window.gameSettings.gripLevel) : 1.0,
            transmission_mode: window.gameSettings ? window.gameSettings.transmission : 'automatic'
        }));
    }
};

// Auto connect
window.initTelemetryClient();
