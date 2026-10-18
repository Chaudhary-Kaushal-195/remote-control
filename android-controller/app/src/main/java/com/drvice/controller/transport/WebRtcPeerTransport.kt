package com.drvice.controller.transport

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * Headless WebRTC DataChannel Transport using PeerJS.
 * Bridges native Android sensors, steering wheel, and pedals directly to
 * Dr. Vice WebGL desktop game without requiring node bridge.js.
 */
class WebRtcPeerTransport(
    private val context: Context,
    private val onConnected: () -> Unit,
    private val onDisconnected: () -> Unit,
    private val onError: (String) -> Unit,
    private val onVibrateRequested: (pattern: Long) -> Unit,
    private val onConfigReceived: (steering: String, transmission: String) -> Unit
) : IControllerTransport {

    companion object {
        private const val TAG = "WebRtcPeerTransport"
        private const val BRIDGE_ASSET_URL = "file:///android_asset/webrtc_bridge.html"
    }

    override val transportName: String = "Desktop Game (WebRTC PeerJS)"
    override var isConnected: Boolean = false
        private set

    private val mainHandler = Handler(Looper.getMainLooper())
    private var webView: WebView? = null
    private var isWebViewReady = false
    private var pendingConnectTarget: String? = null
    private var activeConnectCallback: (() -> Unit)? = null
    private var activeErrorCallback: ((String) -> Unit)? = null

    init {
        mainHandler.post {
            initWebView()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun initWebView() {
        try {
            val wv = WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = true
                settings.allowContentAccess = true
                settings.cacheMode = WebSettings.LOAD_DEFAULT

                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                        Log.d(TAG, "[Console] ${consoleMessage?.message()}")
                        return true
                    }
                }

                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        Log.i(TAG, "Headless WebRTC bridge page loaded.")
                        isWebViewReady = true
                        pendingConnectTarget?.let { target ->
                            pendingConnectTarget = null
                            executeConnect(target)
                        }
                    }
                }

                addJavascriptInterface(AndroidBridgeJsInterface(), "AndroidBridge")
            }

            wv.loadUrl(BRIDGE_ASSET_URL)
            this.webView = wv
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize headless WebView for WebRTC", e)
            onError("WebView initialization failed: ${e.message}")
        }
    }

    override fun connect(target: String, onConnected: () -> Unit, onError: (String) -> Unit) {
        val cleanHostId = extractHostId(target)
        this.activeConnectCallback = onConnected
        this.activeErrorCallback = onError

        mainHandler.post {
            if (isWebViewReady) {
                executeConnect(cleanHostId)
            } else {
                pendingConnectTarget = cleanHostId
            }
        }
    }

    private fun executeConnect(hostId: String) {
        Log.i(TAG, "Initiating WebRTC Peer connection to hostId: $hostId")
        val js = "window.connectToPeer('$hostId');"
        webView?.evaluateJavascript(js, null)
    }

    override fun disconnect() {
        mainHandler.post {
            isConnected = false
            webView?.evaluateJavascript("window.disconnectPeer();", null)
        }
    }

    override fun sendSteering(tiltAngle: Float) {
        if (!isConnected) return
        evalJs("window.sendPacket({ type: 'gyro', tilt: $tiltAngle });")
    }

    override fun sendPedal(pedal: String, active: Boolean, intensity: Float) {
        if (!isConnected) return
        evalJs("window.sendPacket({ type: 'pedal', pedal: '$pedal', active: $active, intensity: $intensity });")
    }

    override fun sendGearShift(direction: String) {
        if (!isConnected) return
        evalJs("window.sendPacket({ type: 'gearShift', direction: '$direction' });")
    }

    override fun sendAuxCommand(channel: Int, value: Float) {
        if (!isConnected) return
        evalJs("window.sendPacket({ type: 'aux', channel: $channel, value: $value });")
    }

    override fun sendRawPacket(data: ByteArray) {
        // Not used for WebRTC text JSON channels
    }

    override fun sendPauseToggle() {
        if (!isConnected) return
        evalJs("window.sendPacket({ type: 'pause' });")
    }

    override fun sendCameraCycle() {
        if (!isConnected) return
        evalJs("window.sendPacket({ type: 'keydown', key: 'c' }); setTimeout(() => window.sendPacket({ type: 'keyup', key: 'c' }), 50);")
    }

    override fun sendSettingsUpdate(steering: String, transmission: String) {
        if (!isConnected) return
        val escapedSteer = JSONObject.quote(steering)
        val escapedTrans = JSONObject.quote(transmission)
        evalJs("window.sendPacket({ type: 'updateSettings', settings: { steering: $escapedSteer, transmission: $escapedTrans } });")
    }

    private fun evalJs(script: String) {
        mainHandler.post {
            webView?.evaluateJavascript(script, null)
        }
    }

    private fun extractHostId(input: String): String {
        var text = input.trim()
        if (text.contains("hostId=")) {
            text = text.substringAfter("hostId=").substringBefore("&").trim()
        } else if (text.contains("?")) {
            text = text.substringAfter("?").substringBefore("&").trim()
        }
        return text
    }

    private inner class AndroidBridgeJsInterface {
        @JavascriptInterface
        fun onConnected(peerId: String) {
            Log.i(TAG, "DataChannel connected to peer: $peerId")
            isConnected = true
            mainHandler.post {
                this@WebRtcPeerTransport.onConnected()
                activeConnectCallback?.invoke()
            }
        }

        @JavascriptInterface
        fun onDisconnected() {
            Log.w(TAG, "DataChannel disconnected")
            isConnected = false
            mainHandler.post {
                this@WebRtcPeerTransport.onDisconnected()
            }
        }

        @JavascriptInterface
        fun onError(err: String) {
            Log.e(TAG, "WebRTC Bridge Error: $err")
            isConnected = false
            mainHandler.post {
                this@WebRtcPeerTransport.onError(err)
                activeErrorCallback?.invoke(err)
            }
        }

        @JavascriptInterface
        fun onData(jsonStr: String) {
            try {
                val json = JSONObject(jsonStr)
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
                Log.e(TAG, "Error parsing incoming WebRTC data: $jsonStr", e)
            }
        }
    }
}
