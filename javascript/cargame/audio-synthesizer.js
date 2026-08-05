// Basic Web Audio API Engine Synthesizer

window.audioCtx = null;
window.engineOscillator = null;
window.engineGain = null;
window.engineFilter = null;

window.startBasicEngineAudio = async () => {
    if (window.audioCtx) return;
    
    window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create an oscillator to act as the engine sound
    window.engineOscillator = window.audioCtx.createOscillator();
    window.engineOscillator.type = 'sawtooth'; // Rough sound like an engine
    
    // Create a lowpass filter to muffle it so it's not too harsh
    window.engineFilter = window.audioCtx.createBiquadFilter();
    window.engineFilter.type = 'lowpass';
    window.engineFilter.frequency.value = 800; // Muffle high frequencies
    
    // Gain node for volume control
    window.engineGain = window.audioCtx.createGain();
    window.engineGain.gain.value = 0.0; // Start silent
    
    // Connect everything: Oscillator -> Filter -> Gain -> Destination (Speakers)
    window.engineOscillator.connect(window.engineFilter);
    window.engineFilter.connect(window.engineGain);
    window.engineGain.connect(window.audioCtx.destination);
    
    // Start playing
    window.engineOscillator.start();
};

window.setEngineAudioMute = (mute) => {
    if (!window.engineGain) return;
    if (mute) {
        window.engineGain.gain.setTargetAtTime(0, window.audioCtx.currentTime, 0.1);
    }
};

window.setEngineVolume = (vol) => {
    window.masterVolume = vol / 100; // Store for the animate loop to scale
};

// Start volume
window.masterVolume = window.gameSettings ? window.gameSettings.engineVol / 100 : 0.8;
