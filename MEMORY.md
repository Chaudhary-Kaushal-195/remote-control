# Persistent Project Memory — Dr. Vice

## Current Project State (as of Oct 2026)
- **Active Workspace**: `d:\GitHub\remote-control`
- **Current Milestone**: Core 3D engine, WebRTC P2P mobile controller, LAN WebSocket bridge (`bridge.js`), and Android companion app are implemented and working.
- **Global Documentation**: Established the 6 mandatory root files (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `MEMORY.md`, `RULES.md`, `TRACKER.md`) compliant with the global autonomous engineering protocol.

## Key Architectural Decisions
- **Multi-Channel Controller Architecture**: Support both zero-install browser WebRTC (via PeerJS) and high-performance native LAN WebSocket/UDP discovery (`bridge.js`).
- **Android WebRTC Headless Bridge**: Implemented `WebRtcPeerTransport` in the native Android app using a headless WebView running PeerJS. Enables the native Kotlin app to scan the desktop game's WebRTC QR code directly without requiring `bridge.js` while maintaining native hardware UI (CameraX, Gyro, Pedals).
- **Audio Engine**: Kept isolated in `typescript/audio-engine/` with Vite compilation to prevent bundling bloat in the main game shell.
- **Zero-Heavy-Framework Game Shell**: Main game uses Vanilla HTML/CSS/JS (ESM) with Three.js to guarantee 60+ FPS without framework re-render overhead.

## Verification Status
- `package.json` verified: scripts include `start`, `dev-audio`, `build-audio`.
- `bridge.js` verified: Port 8080 (WS) and Port 8888 (UDP discovery beacon).
- `android-controller` verified: Gradle `compileDebugKotlin` and `assembleDebug` passed with 0 errors. Updated [dr-vice-controller.apk](file:///d:/GitHub/remote-control/dr-vice-controller.apk).

## Next Steps
- User verification: Install `dr-vice-controller.apk` and scan desktop QR code.
- Verify end-to-end telemetry between controller inputs and the Three.js vehicle physics loop.
