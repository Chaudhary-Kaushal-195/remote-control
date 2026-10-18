# Persistent Project Memory — Dr. Vice

## Current Project State (as of Oct 2026)
- **Active Workspace**: `d:\GitHub\remote-control`
- **Current Milestone**: Core 3D engine, WebRTC P2P mobile controller, LAN WebSocket bridge (`bridge.js`), and Android companion app are implemented and working.
- **Global Documentation**: Established the 6 mandatory root files (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `MEMORY.md`, `RULES.md`, `TRACKER.md`) compliant with the global autonomous engineering protocol.

## Key Architectural Decisions
- **Multi-Channel Controller Architecture**: Support both zero-install browser WebRTC (via PeerJS) and high-performance native LAN WebSocket/UDP discovery (`bridge.js`).
- **Audio Engine**: Kept isolated in `typescript/audio-engine/` with Vite compilation to prevent bundling bloat in the main game shell.
- **Zero-Heavy-Framework Game Shell**: Main game uses Vanilla HTML/CSS/JS (ESM) with Three.js to guarantee 60+ FPS without framework re-render overhead.

## Verification Status
- `package.json` verified: scripts include `start`, `dev-audio`, `build-audio`.
- `bridge.js` verified: Port 8080 (WS) and Port 8888 (UDP discovery beacon).
- `android-controller` verified: Gradle project with CameraX QR scanner and native steering view.

## Next Steps
- Verify end-to-end telemetry between controller inputs and the Three.js vehicle physics loop.
- Perform audit of any outstanding bug fixes or requested features in `TRACKER.md`.
