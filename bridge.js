const WebSocket = require('ws');
const os = require('os');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const localIp = getLocalIp();

console.log('====================================================');
console.log('🏎️  Dr. Vice Native LAN Controller Bridge Running');
console.log(`📡 WebSocket Port: ${PORT}`);
console.log(`📱 Connect your Android App to: ${localIp}:${PORT}`);
console.log('====================================================');

const clients = new Set();

wss.on('connection', (ws, req) => {
    clients.add(ws);
    const clientIp = req.socket.remoteAddress;
    console.log(`[CONNECTED] Client joined from ${clientIp}. Total active: ${clients.size}`);

    // Send bridge info greeting
    ws.send(JSON.stringify({
        type: 'bridgeInfo',
        localIp: getLocalIp(),
        port: PORT
    }));

    ws.on('message', (message) => {
        // Broadcast input events from phone to cargame.html (and feedback back to phone)
        const msgStr = message.toString();
        for (const client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msgStr);
            }
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[DISCONNECTED] Client left. Total active: ${clients.size}`);
    });

    ws.on('error', (err) => {
        console.error('[ERROR]', err.message);
    });
});
