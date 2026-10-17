const WebSocket = require('ws');
const os = require('os');
const dgram = require('dgram');

const WS_PORT = 8080;
const UDP_PORT = 8888;

const wss = new WebSocket.Server({ port: WS_PORT });

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

function getBroadcastAddresses() {
    const addresses = ['255.255.255.255'];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const parts = iface.address.split('.');
                if (parts.length === 4) {
                    addresses.push(`${parts[0]}.${parts[1]}.${parts[2]}.255`);
                }
            }
        }
    }
    return addresses;
}

const localIp = getLocalIp();

console.log('====================================================');
console.log('🏎️  Dr. Vice Native LAN Controller Bridge Running');
console.log(`📡 WebSocket Port: ${WS_PORT}`);
console.log(`🔍 UDP Auto-Discovery Beacon: Port ${UDP_PORT}`);
console.log(`📱 Connect your Android App to: ${localIp}:${WS_PORT}`);
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
        port: WS_PORT
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
        console.error('[WS ERROR]', err.message);
    });
});

// UDP Zero-Configuration Auto-Discovery Server
const udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });

udpServer.on('error', (err) => {
    console.error('[UDP ERROR]', err.message);
});

udpServer.on('message', (msg, rinfo) => {
    const text = msg.toString().trim();
    if (text.includes('DR_VICE_DISCOVER')) {
        const payload = JSON.stringify({
            service: 'drvice_host',
            name: 'Dr. Vice Desktop Simulator',
            ip: getLocalIp(),
            port: WS_PORT
        });
        udpServer.send(payload, rinfo.port, rinfo.address, (err) => {
            if (!err) {
                console.log(`[DISCOVERY] Responded to discovery ping from ${rinfo.address}:${rinfo.port}`);
            }
        });
    }
});

udpServer.bind(UDP_PORT, () => {
    try {
        udpServer.setBroadcast(true);
        console.log(`📡 Auto-Discovery Beacon active on UDP port ${UDP_PORT}`);
    } catch (e) {
        console.warn('[UDP WARN] Could not enable broadcast flag:', e.message);
    }

    // Periodic Beacon every 2 seconds for instant phone detection
    setInterval(() => {
        const payload = JSON.stringify({
            service: 'drvice_host',
            name: 'Dr. Vice Desktop Simulator',
            ip: getLocalIp(),
            port: WS_PORT
        });
        const targets = getBroadcastAddresses();
        targets.forEach(addr => {
            udpServer.send(payload, UDP_PORT, addr, () => {});
        });
    }, 2000);
});
