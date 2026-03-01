

function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    const isVisible = modal.style.getComputedStyle ? getComputedStyle(modal).display === 'flex' : modal.style.display === 'flex';
    modal.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) loadSettings();
}

function saveSettings() {
    const settings = {
        steering: document.getElementById('setting-steering').value,
        units: document.getElementById('setting-units').value,
        engineVol: document.getElementById('setting-engine-vol').value,
        musicVol: document.getElementById('setting-music-vol').value
    };
    localStorage.setItem('drViceSettings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('drViceSettings');
    if (saved) {
        const s = JSON.parse(saved);
        document.getElementById('setting-steering').value = s.steering || 'wheel';
        document.getElementById('setting-units').value = s.units || 'kph';
        document.getElementById('setting-engine-vol').value = s.engineVol || 80;
        document.getElementById('setting-music-vol').value = s.musicVol || 50;
    }
}

// UNIVERSAL ORIENTATION ENGINE (Hill Climb Racing Style)
window.forceLandscape = () => {
    // 1. Hardware Lock (Android / Supported Browsers)
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
            // If hardware fails, CSS engine handles it (Step 2)
        });
    }
};

window.checkOrientation = () => {
    const isPortrait = window.innerHeight > window.innerWidth;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Only force CSS rotation if hardware lock isn't working/available
    // We add the class ONLY if the device is currently in portrait
    if (isPortrait) {
        document.body.classList.add('force-landscape-active');
    } else {
        document.body.classList.remove('force-landscape-active');
    }
};

// Auto-trigger on all major lifecycle events
window.addEventListener('resize', window.checkOrientation);
window.addEventListener('orientationchange', window.checkOrientation);
window.addEventListener('load', window.checkOrientation);
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    window.checkOrientation();
});

// Hardware lock requires user gesture - trigger on first touch
document.addEventListener('touchstart', window.forceLandscape, { once: true });
document.addEventListener('mousedown', window.forceLandscape, { once: true });
