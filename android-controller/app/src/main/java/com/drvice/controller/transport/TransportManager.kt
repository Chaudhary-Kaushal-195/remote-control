package com.drvice.controller.transport

import android.content.Context

enum class ControllerMode {
    DESKTOP_GAME,
    ESP32_WIFI_UDP,
    ESP32_BLUETOOTH_BLE
}

/**
 * 100% Pure Native Kotlin Transport Manager.
 * Routes hardware steering wheel, motion sensors, and pedals to:
 * 1. Desktop Racing Simulator (Direct Native WebSocket LAN)
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
    val esp32UdpTransport = Esp32UdpTransport()
    val esp32BleTransport = Esp32BleTransport(context)

    var currentMode: ControllerMode = ControllerMode.DESKTOP_GAME
        private set

    val activeTransport: IControllerTransport
        get() = when (currentMode) {
            ControllerMode.DESKTOP_GAME -> desktopTransport
            ControllerMode.ESP32_WIFI_UDP -> esp32UdpTransport
            ControllerMode.ESP32_BLUETOOTH_BLE -> esp32BleTransport
        }

    fun setMode(mode: ControllerMode) {
        if (currentMode != mode) {
            activeTransport.disconnect()
            currentMode = mode
        }
    }
}
