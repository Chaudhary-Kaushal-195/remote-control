# Design System & UI/UX Guidelines — Dr. Vice

## 1. Aesthetic Vision
High-octane, futuristic motorsport and sim-racing HUD. Sleek dark backgrounds punctuated by high-visibility neon accents, glassmorphic overlays, and tactile feedback.

## 2. Color Palette & Tokens
- **Background Deep**: `#0a0b10` / `rgba(10, 11, 16, 0.85)` (Frosted glass container backgrounds)
- **Primary Cyber Cyan**: `#00f3ff` (Speedometer text, connection status, active toggles)
- **Amber Warning**: `#ffb700` (Mid-range RPM, warnings, gear shift indicators)
- **Redline Crimson**: `#ff2a4b` (Rev limiter, handbrake warning, critical alerts)
- **Success Emerald**: `#00ff88` (P2P connected, optimal transmission shift point)
- **Text Primary**: `#ffffff`
- **Text Muted**: `rgba(255, 255, 255, 0.65)`

## 3. Typography & Gauges
- **Display / Telemetry Font**: Monospace / Geometric sans-serif with high tabular numeric clarity.
- **Tachometer / Speedometer**: High-contrast digital readouts with radial gauge sweeps.
- **HUD Cluster**: Minimal visual clutter positioned at screen peripheries to keep track view unobstructed.

## 4. Mobile Controller Ergonomics (`pages/controller.html` & Android App)
- **Orientation**: Locked to Landscape mode.
- **Steering Wheel Zone**: Central touch-responsive wheel with degree indicators and center-snap physics.
- **Pedals Layout**:
  - **Right Thumb/Hand**: Throttle (GAS) pedal with progressive fill animation.
  - **Left Thumb/Hand**: Brake / Reverse pedal with distinct tactile visual styling.
  - **Quick Toggles**: Handbrake button and view switchers placed within easy thumb reach without accidental triggers.
- **Haptic States**:
  - Light pulse: Gear upshift/downshift.
  - Rapid double buzz: Tachometer redline reached.
  - Sustained buzz: Handbrake slide or collision.
