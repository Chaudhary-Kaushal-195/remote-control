

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

document.addEventListener('DOMContentLoaded', loadSettings);
