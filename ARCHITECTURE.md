# System Architecture — Dr. Vice

## 1. High-Level Architecture

The project consists of three interconnected systems:

```
┌────────────────────────────────────────────────────────┐
│               📱 Mobile Controllers                    │
│                                                        │
│  [Web PWA: pages/controller.html]                      │
│     │ (WebRTC DataChannel via PeerJS)                  │
│     ▼                                                  │
│  [Android App: android-controller/]                    │
│     │ (WebSocket / UDP Broadcast)                      │
└─────┼──────────────────────────────────────────────────┘
      │
      ▼
┌───────────────────────────────┐        ┌──────────────────────────────────────┐
│  📡 LAN Bridge (bridge.js)    │◄──────►│  💻 Desktop Game Hub (pages/cargame) │
│  - WebSocket Server (WS:8080) │        │  - Three.js 3D WebGL Engine          │
│  - UDP Discovery (UDP:8888)   │        │  - Drivetrain & Physics Simulation   │
└───────────────────────────────┘        │  - TypeScript Web Audio Engine       │
                                         │  - Telemetry HUD & Gamepad Listener  │
                                         └──────────────────────────────────────┘
```

## 2. Technology Stack & Versions
- **Desktop 3D Graphics**: Three.js (WebGL renderer, dynamic camera rigs, shadow maps)
- **Web P2P Networking**: PeerJS (WebRTC Data Channels for direct browser-to-browser streaming)
- **LAN Networking**: Node.js `ws` (WebSocket server) and `dgram` (UDP beacon auto-discovery) in `bridge.js`
- **Audio Engine**: TypeScript, Vite (`typescript/audio-engine/`), Web Audio API
- **Native Android App**: Kotlin, Android SDK, CameraX (QR scanner), OkHttp WebSocket client
- **Web App Architecture**: Vanilla HTML5, CSS3, JavaScript (ES Modules), Progressive Web App (`sw.js`)

## 3. Directory Layout
```
remote-control/
├── PRD.md                       # Product Requirements Document
├── ARCHITECTURE.md              # System Architecture
├── DESIGN.md                    # UI/UX & Design System
├── MEMORY.md                    # Persistent Project Memory
├── RULES.md                     # Development Guardrails
├── TRACKER.md                   # Task Backlog & Execution Progress
├── bridge.js                    # Node.js WebSocket & UDP discovery server
├── package.json                 # Project scripts and dependencies
├── index.html                   # Game Hub landing & launcher
├── sw.js                        # Progressive Web App service worker
├── manifest.json                # PWA manifest
├── pages/                       # HTML entry points
│   ├── cargame.html             # Main 3D WebGL game screen
│   └── controller.html          # Web mobile steering wheel interface
├── javascript/                  # Game engine, input handlers, WebRTC logic
├── css/                         # Game & HUD styling
│   └── cargame/                 # Racing HUD & telemetry styles
├── typescript/
│   └── audio-engine/            # Granular Web Audio synthesis module
└── android-controller/          # Native Android Kotlin companion application
```

## 4. Communication Protocols & Packet Formats

### 4.1 WebRTC / WebSocket Telemetry Contract
Controllers stream serialized telemetry packets to the desktop game engine:
```json
{
  "type": "telemetry",
  "steering": -0.42,       // Normalized float [-1.0, 1.0]
  "throttle": 0.85,        // Normalized float [0.0, 1.0]
  "brake": 0.0,            // Normalized float [0.0, 1.0]
  "handbrake": false,      // Boolean
  "gear": 1,               // Current gear integer
  "drivetrain": "AWD"      // "RWD" | "FWD" | "AWD"
}
```

### 4.2 LAN UDP Discovery
`bridge.js` periodically emits a UDP broadcast on port `8888` containing:
```json
{
  "service": "dr-vice-controller-bridge",
  "ip": "192.168.x.x",
  "port": 8080
}
```
The Android companion app listens on UDP port `8888` to instantly auto-connect without manual IP entry.
