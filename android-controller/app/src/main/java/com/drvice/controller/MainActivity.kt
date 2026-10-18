package com.drvice.controller

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.drvice.controller.camera.QrScannerHelper
import com.drvice.controller.databinding.ActivityMainBinding
import com.drvice.controller.databinding.DialogSettingsBinding
import com.drvice.controller.discovery.LanDiscoveryManager
import com.drvice.controller.haptics.HapticFeedbackManager
import com.drvice.controller.sensor.MotionSensorManager
import com.drvice.controller.transport.ControllerMode
import com.drvice.controller.transport.Esp32BleTransport
import com.drvice.controller.transport.Esp32UdpTransport
import com.drvice.controller.transport.DesktopNativeTransport
import com.drvice.controller.transport.IControllerTransport
import com.drvice.controller.transport.TransportManager
import kotlin.math.roundToInt

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var haptics: HapticFeedbackManager
    private lateinit var motionSensors: MotionSensorManager
    private lateinit var transportManager: TransportManager
    private lateinit var qrScanner: QrScannerHelper
    private lateinit var discoveryManager: LanDiscoveryManager

    private var activeTransport: IControllerTransport? = null
    private var steeringMode: String = "gyro" // "gyro", "wheel", "buttons"
    private var transmissionMode: String = "automatic" // "automatic", "manual"

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startNativeQrScanner()
        } else {
            Toast.makeText(this, "Camera permission is required to scan QR code", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Enforce Screen Wake Lock for Racing Gameplay
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 2. Enable Sticky Immersive Fullscreen Mode
        enableStickyImmersiveMode()

        // 3. Inflate 100% Native ViewBinding Layout
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 4. Initialize Hardware Systems
        haptics = HapticFeedbackManager(this)

        motionSensors = MotionSensorManager(this) { tiltAngle ->
            runOnUiThread {
                binding.tvTilt.text = "Steer: ${tiltAngle.roundToInt()}°"

                // If Gyro mode is active, stream filtered tilt to active transport & animate wheel
                if (steeringMode == "gyro") {
                    binding.steeringWheel.setWheelAngle(tiltAngle)
                    activeTransport?.sendSteering(tiltAngle)
                }
            }
        }

        // 5. Initialize 100% Pure Native Transports (Zero HTML, Zero CSS, Zero JS)
        transportManager = TransportManager(
            context = this,
            onConnected = {
                runOnUiThread {
                    discoveryManager.stopDiscovery()
                    binding.btnConnectManual.isEnabled = true
                    binding.btnConnectManual.text = "CONNECT"
                    binding.overlayPairing.visibility = View.GONE
                    binding.tvStatus.text = "STATUS: CONNECTED"
                    haptics.tapMedium()
                    Toast.makeText(this, "Connected to Laptop! Ready to Drive 🏎️", Toast.LENGTH_SHORT).show()
                }
            },
            onDisconnected = {
                runOnUiThread {
                    binding.btnConnectManual.isEnabled = true
                    binding.btnConnectManual.text = "CONNECT"
                    binding.tvStatus.text = "STATUS: STANDBY"
                    binding.overlayPairing.visibility = View.VISIBLE
                    binding.tvDiscoveryStatus.text = "🔍 Searching for Dr. Vice game on Wi-Fi / Hotspot..."
                    discoveryManager.startDiscovery()
                    Toast.makeText(this, "Disconnected from desktop host", Toast.LENGTH_SHORT).show()
                }
            },
            onError = { err ->
                runOnUiThread {
                    binding.btnConnectManual.isEnabled = true
                    binding.btnConnectManual.text = "CONNECT"
                    binding.tvStatus.text = "LINK ERROR"
                    binding.tvDiscoveryStatus.text = "🔍 Searching for Dr. Vice game on Wi-Fi / Hotspot..."
                    discoveryManager.startDiscovery()
                    Toast.makeText(this, "Connection Error: $err", Toast.LENGTH_LONG).show()
                }
            },
            onVibrateRequested = { ms ->
                haptics.rumble(ms)
            },
            onConfigReceived = { steer, trans ->
                runOnUiThread {
                    applyGameConfig(steer, trans)
                }
            }
        )

        activeTransport = transportManager.activeTransport

        // 6. Setup QR CameraX Scanner
        qrScanner = QrScannerHelper(
            context = this,
            lifecycleOwner = this,
            previewView = binding.cameraPreview,
            onScanned = { rawResult ->
                binding.scannerOverlay.visibility = View.GONE
                val hostId = extractHostId(rawResult)
                binding.etHostId.setText(hostId)
                discoveryManager.stopDiscovery()
                connectToHost(hostId)
            }
        )

        val prefs = getSharedPreferences("drvice_prefs", Context.MODE_PRIVATE)
        val savedHost = prefs.getString("last_host", "") ?: ""
        if (savedHost.isNotEmpty()) {
            binding.etHostId.setText(savedHost)
        }

        // 7. Setup Zero-Config UDP LAN Auto-Discovery
        discoveryManager = LanDiscoveryManager(this) { ip, port, hostName ->
            if (activeTransport?.isConnected != true && binding.overlayPairing.visibility == View.VISIBLE) {
                discoveryManager.stopDiscovery()
                binding.tvDiscoveryStatus.text = "🟢 FOUND: $hostName ($ip)! Connecting..."
                binding.tvDiscoveryStatus.setTextColor(ContextCompat.getColor(this, R.color.accent_primary))
                val target = "$ip:$port"
                binding.etHostId.setText(target)
                connectToHost(target)
            }
        }
        discoveryManager.startDiscovery()

        setupInputListeners()
        applySteeringUiMode()
        applyTransmissionUiMode()
    }

    private fun setupInputListeners() {
        // Pedals
        binding.pedalGas.pedalType = "fwd"
        binding.pedalGas.onTriggerHaptic = { haptics.tapLight() }
        binding.pedalGas.onStateChanged = { pedal, active, intensity ->
            activeTransport?.sendPedal(pedal, active, intensity)
        }

        binding.pedalBrake.pedalType = "brake"
        binding.pedalBrake.onTriggerHaptic = { haptics.tapMedium() }
        binding.pedalBrake.onStateChanged = { pedal, active, intensity ->
            activeTransport?.sendPedal(pedal, active, intensity)
        }

        binding.pedalReverse.pedalType = "bwd"
        binding.pedalReverse.onTriggerHaptic = { haptics.tapLight() }
        binding.pedalReverse.onStateChanged = { pedal, active, intensity ->
            activeTransport?.sendPedal(pedal, active, intensity)
        }

        // Steering Wheel
        binding.steeringWheel.onAngleChanged = { angle ->
            if (steeringMode == "wheel") {
                binding.tvTilt.text = "Steer: ${angle.roundToInt()}°"
                activeTransport?.sendSteering(angle)
            }
        }

        // On-screen Buttons Steering
        binding.btnSteerLeft.pedalType = "left"
        binding.btnSteerLeft.onTriggerHaptic = { haptics.tapLight() }
        binding.btnSteerLeft.onStateChanged = { pedal, active, intensity ->
            activeTransport?.sendPedal(pedal, active, intensity)
        }

        binding.btnSteerRight.pedalType = "right"
        binding.btnSteerRight.onTriggerHaptic = { haptics.tapLight() }
        binding.btnSteerRight.onStateChanged = { pedal, active, intensity ->
            activeTransport?.sendPedal(pedal, active, intensity)
        }

        // Paddle Shifters
        binding.btnGearUp.setOnClickListener {
            haptics.shiftPulse()
            activeTransport?.sendGearShift("up")
        }
        binding.btnGearDown.setOnClickListener {
            haptics.shiftPulse()
            activeTransport?.sendGearShift("down")
        }

        // Top Hub Actions
        binding.btnTransmission.setOnClickListener {
            toggleTransmission()
        }
        binding.btnCamera.setOnClickListener {
            haptics.tapLight()
            transportManager.desktopTransport.sendCameraCycle()
        }
        binding.btnPause.setOnClickListener {
            haptics.tapMedium()
            transportManager.desktopTransport.sendPauseToggle()
            val isPaused = binding.btnPause.text.contains("▶")
            binding.btnPause.text = if (isPaused) "⏸" else "▶"
        }
        binding.btnSettings.setOnClickListener {
            haptics.tapLight()
            showSettingsDialog()
        }

        // Pairing Actions
        binding.overlayPairing.setOnClickListener {
            hideKeyboard()
        }
        binding.etHostId.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_DONE || actionId == EditorInfo.IME_ACTION_GO ||
                (event != null && event.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN)) {
                hideKeyboard()
                val raw = binding.etHostId.text.toString()
                val hostId = extractHostId(raw)
                if (hostId.isNotEmpty()) {
                    binding.etHostId.setText(hostId)
                    connectToHost(hostId)
                }
                true
            } else {
                false
            }
        }
        binding.btnScanQrNative.setOnClickListener {
            hideKeyboard()
            checkCameraPermissionAndScan()
        }
        binding.btnConnectManual.setOnClickListener {
            hideKeyboard()
            val raw = binding.etHostId.text.toString()
            val hostId = extractHostId(raw)
            if (hostId.isNotEmpty()) {
                binding.etHostId.setText(hostId)
                connectToHost(hostId)
            } else {
                Toast.makeText(this, "Enter host ID shown on laptop screen", Toast.LENGTH_SHORT).show()
            }
        }
        binding.btnCancelScanNative.setOnClickListener {
            qrScanner.stopScanning()
            binding.scannerOverlay.visibility = View.GONE
        }
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(binding.root.windowToken, 0)
        binding.etHostId.clearFocus()
    }

    private fun extractHostId(input: String): String {
        val text = input.trim()
        if (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("ws://") || text.startsWith("wss://")) {
            return try {
                val uri = java.net.URI(text)
                val host = uri.host ?: ""
                if (host.isNotEmpty() && host != "localhost" && host != "127.0.0.1") {
                    val port = if (uri.port > 0 && uri.port != 3000 && uri.port != 80) uri.port else 8080
                    "$host:$port"
                } else {
                    text
                }
            } catch (e: Exception) {
                text
            }
        }
        if (text.contains("ip=")) {
            return text.substringAfter("ip=").substringBefore("&").trim()
        }
        return text
    }

    private fun checkCameraPermissionAndScan() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startNativeQrScanner()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startNativeQrScanner() {
        binding.scannerOverlay.visibility = View.VISIBLE
        qrScanner.startScanning()
    }

    private fun connectToHost(hostId: String) {
        binding.tvStatus.text = "STATUS: CONNECTING [$hostId]..."
        binding.btnConnectManual.isEnabled = false
        binding.btnConnectManual.text = "CONNECTING..."

        activeTransport?.connect(hostId, {
            runOnUiThread {
                val prefs = getSharedPreferences("drvice_prefs", Context.MODE_PRIVATE)
                prefs.edit().putString("last_host", hostId).apply()

                binding.btnConnectManual.isEnabled = true
                binding.btnConnectManual.text = "CONNECT"
                binding.overlayPairing.visibility = View.GONE
                binding.tvStatus.text = "STATUS: CONNECTED ($hostId)"
                haptics.tapMedium()
                Toast.makeText(this, "Connected to Laptop! Ready to Drive 🏎️", Toast.LENGTH_SHORT).show()
            }
        }, { error ->
            runOnUiThread {
                binding.btnConnectManual.isEnabled = true
                binding.btnConnectManual.text = "CONNECT"
                binding.tvStatus.text = "STATUS: ERROR ($error)"
                val msg = if (error.contains("peer-unavailable")) {
                    "Laptop ID '$hostId' not found.\nClick 'REMOTE' on your laptop to generate a fresh connection code!"
                } else {
                    "Connection error: $error"
                }
                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun toggleTransmission() {
        haptics.shiftPulse()
        transmissionMode = if (transmissionMode == "automatic") "manual" else "automatic"
        applyTransmissionUiMode()
        transportManager.desktopTransport.sendSettingsUpdate(steeringMode, transmissionMode)
    }

    private fun applyTransmissionUiMode() {
        binding.btnTransmission.text = if (transmissionMode == "automatic") "AUTO" else "MANUAL"
        binding.pedalReverse.visibility = if (transmissionMode == "manual") View.GONE else View.VISIBLE
        binding.gearShiftersGroup.visibility = if (transmissionMode == "manual") View.VISIBLE else View.GONE
    }

    private fun applySteeringUiMode() {
        when (steeringMode) {
            "wheel" -> {
                binding.steeringWheel.visibility = View.VISIBLE
                binding.steeringWheel.isInteractive = true
                binding.buttonSteeringGroup.visibility = View.GONE
                motionSensors.stop()
            }
            "buttons" -> {
                binding.steeringWheel.visibility = View.GONE
                binding.buttonSteeringGroup.visibility = View.VISIBLE
                motionSensors.stop()
            }
            "gyro" -> {
                binding.steeringWheel.visibility = View.VISIBLE
                binding.steeringWheel.isInteractive = false // Passive tilt indicator
                binding.buttonSteeringGroup.visibility = View.GONE
                motionSensors.start()
            }
        }
    }

    private fun applyGameConfig(steer: String, trans: String) {
        steeringMode = steer
        transmissionMode = trans
        applySteeringUiMode()
        applyTransmissionUiMode()
    }

    private fun showSettingsDialog() {
        val dialogBinding = DialogSettingsBinding.inflate(layoutInflater)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogBinding.root)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        // Target Hardware Modes
        val targetModes = arrayOf("Dr. Vice Game (Desktop LAN)", "ESP32 RC Car (Wi-Fi UDP)", "ESP32 Drone (Bluetooth LE)")
        val targetAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, targetModes)
        dialogBinding.spnTargetMode.adapter = targetAdapter
        dialogBinding.spnTargetMode.setSelection(transportManager.currentMode.ordinal)

        dialogBinding.spnTargetMode.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p0: AdapterView<*>?, p1: View?, position: Int, p3: Long) {
                val newMode = ControllerMode.entries[position]
                transportManager.setMode(newMode)
                activeTransport = transportManager.activeTransport
                dialogBinding.layoutEsp32Config.visibility = if (newMode == ControllerMode.ESP32_WIFI_UDP) View.VISIBLE else View.GONE
                binding.tvStatus.text = "TARGET: ${newMode.name}"
            }
            override fun onNothingSelected(p0: AdapterView<*>?) {}
        }

        // Steering Modes
        val steeringModes = arrayOf("HARDWARE GYRO (TILT)", "STEERING WHEEL", "ON-SCREEN BUTTONS")
        val steerAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, steeringModes)
        dialogBinding.spnSteeringMode.adapter = steerAdapter
        val steerIndex = when (steeringMode) {
            "wheel" -> 1
            "buttons" -> 2
            else -> 0
        }
        dialogBinding.spnSteeringMode.setSelection(steerIndex)

        // Transmission
        val transModes = arrayOf("AUTOMATIC", "MANUAL")
        val transAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, transModes)
        dialogBinding.spnTransmission.adapter = transAdapter
        dialogBinding.spnTransmission.setSelection(if (transmissionMode == "manual") 1 else 0)

        dialogBinding.btnCloseSettings.setOnClickListener {
            val selectedSteer = when (dialogBinding.spnSteeringMode.selectedItemPosition) {
                1 -> "wheel"
                2 -> "buttons"
                else -> "gyro"
            }
            val selectedTrans = if (dialogBinding.spnTransmission.selectedItemPosition == 1) "manual" else "automatic"

            steeringMode = selectedSteer
            transmissionMode = selectedTrans
            applySteeringUiMode()
            applyTransmissionUiMode()
            transportManager.desktopTransport.sendSettingsUpdate(steeringMode, transmissionMode)
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun enableStickyImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onResume() {
        super.onResume()
        enableStickyImmersiveMode()
        if (steeringMode == "gyro") {
            motionSensors.start()
        }
        if (activeTransport?.isConnected != true && binding.overlayPairing.visibility == View.VISIBLE) {
            discoveryManager.startDiscovery()
        }
    }

    override fun onPause() {
        super.onPause()
        motionSensors.stop()
        qrScanner.stopScanning()
        discoveryManager.stopDiscovery()
    }

    override fun onDestroy() {
        super.onDestroy()
        motionSensors.stop()
        qrScanner.release()
        discoveryManager.release()
        transportManager.activeTransport.disconnect()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.scannerOverlay.visibility == View.VISIBLE) {
            qrScanner.stopScanning()
            binding.scannerOverlay.visibility = View.GONE
            return
        }

        if (activeTransport?.isConnected == true) {
            AlertDialog.Builder(this)
                .setTitle("Disconnect Session?")
                .setMessage("Exit game controller mode?")
                .setPositiveButton("YES") { _, _ ->
                    activeTransport?.disconnect()
                    binding.overlayPairing.visibility = View.VISIBLE
                    binding.tvStatus.text = "STATUS: STANDBY"
                }
                .setNegativeButton("NO", null)
                .show()
        } else {
            super.onBackPressed()
        }
    }
}
