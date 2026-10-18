package com.drvice.controller.transport

import android.content.Context

enum class ControllerMode {
    DESKTOP_GAME,
    ESP32_WIFI_UDP,
    ESP32_BLUETOOTH_BLE
}

/**
 * Universal Transport Manager.
 * Routes hardware steering wheel, motion sensors, and pedals to:
 * 1. Desktop Racing Simulator (WebRTC PeerJS DataChannel or Native WebSocket LAN)
 * 2. ESP32 RC Car / Drone (Direct Wi-Fi UDP binary telemetry)
 * 3. ESP32 RC Car / Drone (Direct Bluetooth Low Energy GATT NUS)
 */
class TransportManager(
    context: Context,
    onConnected: () -> Unit,
    onDisconnected: () -> Unit,
    onError: (String) -> Unit,
    onVibrateRequested: (pattern: Long) -> Unit,
    onConfigReceived: (steering: String, transmission: String) -> Unit
) {
    val desktopTransport = DesktopNativeTransport(
        onConnected = onConnected,
        onDisconnected = onDisconnected,
        onError = onError,
        onVibrateRequested = onVibrateRequested,
        onConfigReceived = onConfigReceived
    )
    val webRtcTransport = WebRtcPeerTransport(
        context = context,
        onConnected = onConnected,
        onDisconnected = onDisconnected,
        onError = onError,
        onVibrateRequested = onVibrateRequested,
        onConfigReceived = onConfigReceived
    )
    val esp32UdpTransport = Esp32UdpTransport()
    val esp32BleTransport = Esp32BleTransport(context)

    var currentMode: ControllerMode = ControllerMode.DESKTOP_GAME
        private set

    // For DESKTOP_GAME, dynamically points to either webRtcTransport or desktopTransport
    var activeDesktopTransport: IControllerTransport = webRtcTransport
        private set

    val activeTransport: IControllerTransport
        get() = when (currentMode) {
            ControllerMode.DESKTOP_GAME -> activeDesktopTransport
            ControllerMode.ESP32_WIFI_UDP -> esp32UdpTransport
            ControllerMode.ESP32_BLUETOOTH_BLE -> esp32BleTransport
        }

    /**
     * Resolves whether the scanned target is a LAN WebSocket IP (e.g. 192.168.x.x:8080)
     * or a WebRTC PeerJS Room ID (e.g. cargame QR code).
     */
    fun selectDesktopTransportForTarget(target: String): IControllerTransport {
        val trimmed = target.trim()
        val isWebSocketLan = trimmed.startsWith("ws://") ||
                trimmed.startsWith("wss://") ||
                trimmed.contains(":8080") ||
                Regex("^(\\d{1,3}\\.){3}\\d{1,3}").containsMatchIn(trimmed)

        activeDesktopTransport = if (isWebSocketLan) {
            desktopTransport
        } else {
            webRtcTransport
        }
        return activeDesktopTransport
    }

    fun setMode(mode: ControllerMode) {
        if (currentMode != mode) {
            activeTransport.disconnect()
            currentMode = mode
        }
    }
}
