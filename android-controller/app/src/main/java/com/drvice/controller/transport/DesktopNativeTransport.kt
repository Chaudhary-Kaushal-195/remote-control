package com.drvice.controller.transport

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * 100% Pure Native Kotlin Network Transport for Dr. Vice Desktop Racing Game.
 * Zero WebView, zero HTML/CSS/JS, zero cloud relay latency.
 * Connects directly over local Wi-Fi or Phone Hotspot via high-speed native WebSocket.
 */
class DesktopNativeTransport(
    private val onConnected: () -> Unit,
    private val onDisconnected: () -> Unit,
    private val onError: (String) -> Unit,
    private val onVibrateRequested: (pattern: Long) -> Unit,
    private val onConfigReceived: (steering: String, transmission: String) -> Unit
) : IControllerTransport {

    companion object {
        private const val TAG = "DesktopNativeTransport"
        private const val DEFAULT_PORT = 8080
    }

    override val transportName: String = "Desktop Game (Native LAN)"
    override var isConnected: Boolean = false
        private set

    private val mainHandler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .pingInterval(3, TimeUnit.SECONDS) // Ping every 3s to keep connection alive
        .readTimeout(0, TimeUnit.MILLISECONDS) // Keep-alive for streaming
        .build()

    private var webSocket: WebSocket? = null
    private var isConnecting: Boolean = false

    override fun connect(target: String, onConnected: () -> Unit, onError: (String) -> Unit) {
        if (isConnected || isConnecting) {
            Log.d(TAG, "Already connected or connecting, skipping duplicate request.")
            return
        }

        val cleanTarget = target.trim()
        val wsUrl = resolveWebSocketUrl(cleanTarget)

        Log.i(TAG, "Connecting native WebSocket to: $wsUrl")
        isConnecting = true

        val request = try {
            Request.Builder().url(wsUrl).build()
        } catch (e: Exception) {
            isConnecting = false
            onError("Invalid host address: $cleanTarget")
            return
        }

        webSocket?.close(1000, "Reconnecting")
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.i(TAG, "Native WebSocket connected to desktop game: $wsUrl")
                isConnected = true
                isConnecting = false
                mainHandler.post {
                    this@DesktopNativeTransport.onConnected()
                    onConnected()
                }

                // Announce controller ready
                val readyMsg = JSONObject().apply {
                    put("type", "controllerReady")
                    put("device", "NativeAndroidController")
                    put("timestamp", System.currentTimeMillis())
                }
                ws.send(readyMsg.toString())
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    when (json.optString("type")) {
                        "vibrate" -> {
                            val duration = json.optLong("pattern", 50L)
                            mainHandler.post { onVibrateRequested(duration) }
                        }
                        "config" -> {
                            val cfg = json.optJSONObject("config")
                            if (cfg != null) {
                                val steer = cfg.optString("steering", "gyro")
                                val trans = cfg.optString("transmission", "automatic")
                                mainHandler.post { onConfigReceived(steer, trans) }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing server message: $text", e)
                }
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                ws.close(1000, null)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.w(TAG, "Native WebSocket closed: $reason ($code)")
                isConnected = false
                isConnecting = false
                mainHandler.post {
                    this@DesktopNativeTransport.onDisconnected()
                }
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "Native WebSocket connection failed: ${t.message}", t)
                isConnected = false
                isConnecting = false
                mainHandler.post {
                    val err = t.message ?: "Connection failed"
                    this@DesktopNativeTransport.onError(err)
                    onError(err)
                }
            }
        })
    }

    override fun disconnect() {
        isConnected = false
        isConnecting = false
        webSocket?.close(1000, "User disconnected")
        webSocket = null
    }

    override fun sendSteering(tiltAngle: Float) {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("type", "gyro")
            put("tilt", tiltAngle.toDouble())
        }
        sendJson(json)
    }

    override fun sendPedal(pedal: String, active: Boolean, intensity: Float) {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("type", "pedal")
            put("pedal", pedal)
            put("active", active)
            put("intensity", intensity.toDouble())
        }
        sendJson(json)
    }

    override fun sendGearShift(direction: String) {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("type", "gearShift")
            put("direction", direction)
        }
        sendJson(json)
    }

    override fun sendAuxCommand(channel: Int, value: Float) {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("type", "aux")
            put("channel", channel)
            put("value", value.toDouble())
        }
        sendJson(json)
    }

    override fun sendRawPacket(data: ByteArray) {
        // Not used for desktop JSON protocol
    }

    fun sendCameraCycle() {
        if (!isConnected) return
        val keydown = JSONObject().apply {
            put("type", "keydown")
            put("key", "c")
        }
        val keyup = JSONObject().apply {
            put("type", "keyup")
            put("key", "c")
        }
        sendJson(keydown)
        mainHandler.postDelayed({ sendJson(keyup) }, 50)
    }

    fun sendPauseToggle() {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("type", "pause")
        }
        sendJson(json)
    }

    fun sendSettingsUpdate(steering: String, transmission: String) {
        if (!isConnected) return
        val json = JSONObject().apply {
            put("type", "updateSettings")
            put("settings", JSONObject().apply {
                put("steering", steering)
                put("transmission", transmission)
            })
        }
        sendJson(json)
    }

    private fun sendJson(json: JSONObject) {
        webSocket?.send(json.toString())
    }

    private fun resolveWebSocketUrl(target: String): String {
        var host = target

        // If target contains query string or full URL from QR scanner
        if (host.startsWith("http://") || host.startsWith("https://") || host.startsWith("ws://") || host.startsWith("wss://")) {
            val uri = java.net.URI(host)
            val hostPart = uri.host ?: "127.0.0.1"
            val portPart = if (uri.port > 0) uri.port else DEFAULT_PORT
            return "ws://$hostPart:$portPart/ws"
        }

        // Strip path or query params if any
        if (host.contains("?")) {
            host = host.split("?")[0]
        }
        if (host.contains("/")) {
            host = host.split("/")[0]
        }

        // If host has custom port
        if (host.contains(":")) {
            return "ws://$host/ws"
        }

        // Default to port 8080
        return "ws://$host:$DEFAULT_PORT/ws"
    }
}
