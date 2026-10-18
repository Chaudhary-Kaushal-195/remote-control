# Product Requirements Document (PRD) — Dr. Vice

## 1. Product Overview
**Dr. Vice** is a zero-install, ultra-low-latency 3D WebGL racing simulator and telemetry platform. It pairs desktop racing with a mobile phone acting as a wireless, motion-sensing steering wheel with analog pedal inputs and haptic feedback.

## 2. Target Users & Use Cases
- **Casual & Sim Racers**: Players wanting an immersive steering-wheel experience without purchasing expensive hardware.
- **Cross-Platform Gamers**: Users on PC, Mac, Linux running browsers with iOS or Android smartphones.
- **LAN / Local Gamers**: Players using the high-performance native Android companion app and Node.js LAN bridge for minimal latency.

## 3. Key Functional Requirements

### 3.1 Controller Input & Connectivity
- **Web P2P Controller (PWA)**: WebRTC DataChannels via PeerJS pairing with dynamic QR codes. Zero app installation required.
- **Native Android Controller**: Standalone Kotlin app connecting directly over WebSocket/UDP auto-discovery to `bridge.js`.
- **Gyroscope Steering**: DeviceOrientation API mapping real-world tilt angle to vehicle steering angle.
- **Pedal Controls**: Multi-touch analog throttle, progressive brake, reverse, and handbrake.
- **Gamepad API**: Support for physical Xbox / PS4 / USB controllers plugged into the desktop.
- **Tactile Haptic Feedback**: Vibration API triggers for redline, gear shifts, and collisions.

### 3.2 Vehicle Physics & Drivetrains
- **Three.js WebGL Rendering**: 60+ FPS vehicle rendering, dynamic shadows, multiple camera perspectives.
- **Drivetrain Dynamics**: Runtime switching between RWD, FWD, 50/50 AWD, and Sport 20/80 AWD.
- **Transmission Modes**: Manual (with clutch/shift delay) and Automatic transmission.
- **Tire Grip & Drift Physics**: Realistic counter-steering, slip angles, burnouts, and body roll.

### 3.3 Audio Engine & Sound Studio
- **Granular Synthesizer**: Custom TypeScript Web Audio API engine.
- **RPM Modulation**: Pitch warping and crossfading across engine sound banks (Ferrari 458 V8, BAC Mono, BMW M1).
- **Sound Studio**: In-browser tools to tune rev limits, inertia, and custom exhaust sample uploads.

## 4. Non-Functional Requirements
- **Latency**: Sub-16ms (sub-frame) input streaming over LAN or direct WebRTC.
- **Reliability**: Automatic reconnect handling when phone orientation or focus changes.
- **Offline / PWA**: Service Worker caching for instant loading.

## 5. Explicit Exclusions
- No heavy web frameworks (React/Vue/Angular) in the core game shell — maintain lightweight Vanilla ESM.
- Cloud-hosted matchmaking or multiplayer racing is out of scope for the current local 1v1 / solo sim architecture.
