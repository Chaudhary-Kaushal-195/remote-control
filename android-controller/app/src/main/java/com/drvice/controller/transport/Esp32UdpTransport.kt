package com.drvice.controller.transport

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import kotlin.math.roundToInt

/**
 * High-Speed UDP Socket Transport for ESP32 RC Cars and Drones over Wi-Fi.
 * Transmits compact binary telemetry frames:
 * [HEADER_0xAA, HEADER_0x55, STEER_HI, STEER_LO, THROTTLE, BRAKE, GEAR, AUX1, AUX2, CHECKSUM]
 */
class Esp32UdpTransport(
    private var targetIp: String = "192.168.4.1", // Default ESP32 AP IP
    private var targetPort: Int = 4210
) : IControllerTransport {

    override val transportName = "ESP32 Wi-Fi (UDP Telemetry)"
    override var isConnected = false
        private set

    private var socket: DatagramSocket? = null
    private var destinationAddress: InetAddress? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    // Current telemetry cache
    private var currentSteer = 0f
    private var currentThrottle = 0f
    private var currentBrake = 0f
    private var currentGear = 1

    override fun connect(target: String, onConnected: () -> Unit, onError: (String) -> Unit) {
        scope.launch {
            try {
                if (target.contains(":")) {
                    val parts = target.split(":")
                    targetIp = parts[0]
                    targetPort = parts[1].toIntOrNull() ?: 4210
                } else if (target.isNotBlank()) {
                    targetIp = target
                }

                destinationAddress = InetAddress.getByName(targetIp)
                socket = DatagramSocket()
                isConnected = true
                onConnected()
            } catch (e: Exception) {
                isConnected = false
                onError(e.message ?: "Failed to open UDP socket")
            }
        }
    }

    override fun disconnect() {
        isConnected = false
        socket?.close()
        socket = null
    }

    override fun sendSteering(tiltAngle: Float) {
        currentSteer = tiltAngle
        flushTelemetryPacket()
    }

    override fun sendPedal(pedal: String, active: Boolean, intensity: Float) {
        val value = if (active) (if (intensity > 0f) intensity else 1.0f) else 0.0f
        when (pedal) {
            "fwd" -> currentThrottle = value
            "brake" -> currentBrake = value
            "bwd" -> {
                // Reverse maps to negative throttle in RC car mode
                currentThrottle = if (active) -value else 0f
            }
        }
        flushTelemetryPacket()
    }

    override fun sendGearShift(direction: String) {
        if (direction == "up" && currentGear < 6) currentGear++
        if (direction == "down" && currentGear > 1) currentGear--
        flushTelemetryPacket()
    }

    override fun sendAuxCommand(channel: Int, value: Float) {
        flushTelemetryPacket()
    }

    override fun sendRawPacket(data: ByteArray) {
        scope.launch {
            try {
                destinationAddress?.let { address ->
                    val packet = DatagramPacket(data, data.size, address, targetPort)
                    socket?.send(packet)
                }
            } catch (_: Exception) {}
        }
    }

    /**
     * Compact 10-byte binary telemetry frame (sub-millisecond parsing on ESP32)
     */
    private fun flushTelemetryPacket() {
        if (!isConnected || socket == null || destinationAddress == null) return

        // Map steering [-180, +180] to unsigned 16-bit [0, 65535]
        val normalizedSteer = ((currentSteer + 180f) / 360f * 65535f).roundToInt().coerceIn(0, 65535)
        val steerHi = ((normalizedSteer shr 8) and 0xFF).toByte()
        val steerLo = (normalizedSteer and 0xFF).toByte()

        val throttleByte = ((currentThrottle.coerceIn(0f, 1f)) * 255f).roundToInt().toByte()
        val brakeByte = ((currentBrake.coerceIn(0f, 1f)) * 255f).roundToInt().toByte()
        val gearByte = currentGear.toByte()

        val packetData = byteArrayOf(
            0xAA.toByte(), // Magic Byte 1
            0x55.toByte(), // Magic Byte 2
            steerHi,
            steerLo,
            throttleByte,
            brakeByte,
            gearByte,
            0x00, // Aux 1 (flight roll / trim)
            0x00, // Aux 2 (flight pitch / trim)
            0x00  // Checksum
        )

        // Simple checksum XOR
        var checksum = 0
        for (i in 0 until 9) {
            checksum = checksum xor packetData[i].toInt()
        }
        packetData[9] = (checksum and 0xFF).toByte()

        sendRawPacket(packetData)
    }
}
