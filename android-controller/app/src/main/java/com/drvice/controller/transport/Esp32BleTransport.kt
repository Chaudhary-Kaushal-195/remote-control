package com.drvice.controller.transport

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.content.Context
import java.util.UUID

/**
 * Bluetooth Low Energy (BLE) GATT Transport for ESP32 Microcontrollers.
 * Uses standard Nordic UART Service (NUS) for direct serial streaming:
 * Service UUID: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
 * TX Characteristic: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E
 */
class Esp32BleTransport(
    private val context: Context
) : IControllerTransport {

    override val transportName = "ESP32 Bluetooth LE"
    override var isConnected = false
        private set

    private var bluetoothGatt: BluetoothGatt? = null
    private var txCharacteristic: BluetoothGattCharacteristic? = null

    companion object {
        val UART_SERVICE_UUID: UUID = UUID.fromString("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
        val UART_TX_CHAR_UUID: UUID = UUID.fromString("6E400002-B5A3-F393-E0A9-E50E24DCCA9E")
    }

    override fun connect(target: String, onConnected: () -> Unit, onError: (String) -> Unit) {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null || !adapter.isEnabled) {
            onError("Bluetooth is not enabled on this device")
            return
        }

        try {
            val device = adapter.getRemoteDevice(target)
            bluetoothGatt = device.connectGatt(context, false, object : BluetoothGattCallback() {
                override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        gatt?.discoverServices()
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        isConnected = false
                    }
                }

                override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        val service = gatt?.getService(UART_SERVICE_UUID)
                        txCharacteristic = service?.getCharacteristic(UART_TX_CHAR_UUID)
                        isConnected = txCharacteristic != null
                        if (isConnected) onConnected() else onError("ESP32 UART Service not found")
                    }
                }
            })
        } catch (e: Exception) {
            onError(e.message ?: "Failed to connect to BLE device")
        }
    }

    override fun disconnect() {
        isConnected = false
        bluetoothGatt?.disconnect()
        bluetoothGatt?.close()
        bluetoothGatt = null
        txCharacteristic = null
    }

    override fun sendSteering(tiltAngle: Float) {
        val packet = "STR:${tiltAngle.toInt()}\n".toByteArray()
        sendRawPacket(packet)
    }

    override fun sendPedal(pedal: String, active: Boolean, intensity: Float) {
        val packet = "PED:$pedal:${if (active) 1 else 0}:${(intensity * 100).toInt()}\n".toByteArray()
        sendRawPacket(packet)
    }

    override fun sendGearShift(direction: String) {
        val packet = "GEAR:$direction\n".toByteArray()
        sendRawPacket(packet)
    }

    override fun sendAuxCommand(channel: Int, value: Float) {
        val packet = "AUX:$channel:$value\n".toByteArray()
        sendRawPacket(packet)
    }

    override fun sendRawPacket(data: ByteArray) {
        txCharacteristic?.let { char ->
            char.value = data
            char.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            bluetoothGatt?.writeCharacteristic(char)
        }
    }
}
