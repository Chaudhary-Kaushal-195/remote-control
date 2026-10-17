package com.drvice.controller.discovery

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Pure Kotlin Zero-Configuration UDP LAN Discovery Engine.
 * Automatically discovers the Dr. Vice desktop game host over local Wi-Fi or Phone Hotspot.
 * Zero cloud dependency, zero manual IP entry required.
 */
class LanDiscoveryManager(
    private val context: Context,
    private val onHostDiscovered: (ip: String, port: Int, hostName: String) -> Unit
) {

    companion object {
        private const val TAG = "LanDiscoveryManager"
        private const val DISCOVERY_PORT = 8888
        private const val PING_MESSAGE = "DR_VICE_DISCOVER"
        private const val SOCKET_TIMEOUT_MS = 2000
    }

    private val isRunning = AtomicBoolean(false)
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var multicastLock: WifiManager.MulticastLock? = null
    private var socket: DatagramSocket? = null

    fun startDiscovery() {
        if (isRunning.getAndSet(true)) return

        acquireMulticastLock()

        executor.execute {
            try {
                socket = DatagramSocket().apply {
                    broadcast = true
                    soTimeout = SOCKET_TIMEOUT_MS
                }

                val buffer = ByteArray(1024)
                val receivePacket = DatagramPacket(buffer, buffer.size)

                var lastPingTime = 0L

                while (isRunning.get()) {
                    val now = System.currentTimeMillis()

                    // Send discovery ping every 1.2 seconds
                    if (now - lastPingTime > 1200) {
                        sendDiscoveryPings(socket)
                        lastPingTime = now
                    }

                    try {
                        socket?.receive(receivePacket)
                        val response = String(receivePacket.data, 0, receivePacket.length).trim()
                        if (response.contains("drvice_host")) {
                            parseAndNotifyHost(response, receivePacket.address.hostAddress ?: "")
                        }
                    } catch (_: java.net.SocketTimeoutException) {
                        // Normal timeout, continue loop
                    } catch (e: Exception) {
                        if (isRunning.get()) {
                            Log.w(TAG, "Receive error: ${e.message}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Discovery loop error: ${e.message}", e)
            } finally {
                socket?.close()
                socket = null
            }
        }
    }

    private fun sendDiscoveryPings(sock: DatagramSocket?) {
        if (sock == null || sock.isClosed) return
        val pingBytes = PING_MESSAGE.toByteArray(Charsets.UTF_8)

        val broadcastTargets = mutableSetOf<InetAddress>()

        // 1. Universal Broadcast
        try {
            broadcastTargets.add(InetAddress.getByName("255.255.255.255"))
        } catch (_: Exception) {}

        // 2. Local Subnet Broadcasts from all active network interfaces
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue

                for (interfaceAddress in iface.interfaceAddresses) {
                    val broadcast = interfaceAddress.broadcast
                    if (broadcast != null) {
                        broadcastTargets.add(broadcast)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error enumerating interfaces: ${e.message}")
        }

        // 3. Dispatch to all detected targets
        for (target in broadcastTargets) {
            try {
                val packet = DatagramPacket(pingBytes, pingBytes.size, target, DISCOVERY_PORT)
                sock.send(packet)
            } catch (_: Exception) {}
        }
    }

    private fun parseAndNotifyHost(jsonStr: String, fallbackIp: String) {
        try {
            val json = JSONObject(jsonStr)
            if (json.optString("service") == "drvice_host") {
                val hostIp = json.optString("ip").ifEmpty { fallbackIp }
                val port = json.optInt("port", 8080)
                val name = json.optString("name", "Dr. Vice PC")

                mainHandler.post {
                    if (isRunning.get()) {
                        onHostDiscovered(hostIp, port, name)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse host packet: $jsonStr", e)
        }
    }

    fun stopDiscovery() {
        isRunning.set(false)
        try {
            socket?.close()
        } catch (_: Exception) {}
        releaseMulticastLock()
    }

    private fun acquireMulticastLock() {
        try {
            val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            multicastLock = wifi?.createMulticastLock("DrViceDiscoveryLock")?.apply {
                setReferenceCounted(true)
                acquire()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not acquire multicast lock: ${e.message}")
        }
    }

    private fun releaseMulticastLock() {
        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        } catch (_: Exception) {}
        multicastLock = null
    }

    fun release() {
        stopDiscovery()
        executor.shutdown()
    }
}
