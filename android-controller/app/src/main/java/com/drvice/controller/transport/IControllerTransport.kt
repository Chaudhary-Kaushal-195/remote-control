package com.drvice.controller.transport

/**
 * Unified Controller Transport Interface.
 * Implemented by WebRTC (Dr. Vice game), ESP32 Wi-Fi (UDP), and ESP32 Bluetooth (BLE).
 */
interface IControllerTransport {
    val transportName: String
    val isConnected: Boolean

    fun connect(target: String, onConnected: () -> Unit, onError: (String) -> Unit)
    fun disconnect()

    fun sendSteering(tiltAngle: Float)
    fun sendPedal(pedal: String, active: Boolean, intensity: Float)
    fun sendGearShift(direction: String)
    fun sendAuxCommand(channel: Int, value: Float)
    fun sendRawPacket(data: ByteArray)

    fun sendCameraCycle() {}
    fun sendPauseToggle() {}
    fun sendSettingsUpdate(steering: String, transmission: String) {}
}
