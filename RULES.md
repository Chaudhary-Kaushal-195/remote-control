# Development Guardrails & Rules — Dr. Vice

## 1. Project Conventions & Standards
- **Core Game**: Use Vanilla HTML5, Vanilla CSS, and modern JavaScript (ES Modules). Do not introduce React, Vue, or heavy front-end frameworks to the main game shell.
- **Audio Engine**: Written in TypeScript located in `typescript/audio-engine/`. Run `npm run build-audio` after changes to regenerate distribution artifacts.
- **Android App**: Written in idiomatic Kotlin with Android Jetpack conventions.

## 2. Dependency Policies
- Do not install new third-party npm or Gradle dependencies without explicit user authorization.
- Keep dependencies minimal to preserve fast load times and lightweight PWA footprint.

## 3. Communication & Telemetry Safety
- Do not modify telemetry JSON schema keys (`steering`, `throttle`, `brake`, `handbrake`, `gear`, `drivetrain`) without updating both the sender (Web/Android controller) and receiver (`cargame.html` / `bridge.js`).
- Preserve WebRTC PeerJS dynamic room code generation logic and LAN bridge port bindings (WS: 8080, UDP: 8888).

## 4. Verification & Testing Expectations
- Test bridge server syntax and WebSocket message handling whenever network code is modified.
- Verify 3D physics changes for 60 FPS performance without frame stutter or memory leaks.
- Always report skipped, failed, or simulated checks honestly.
