package com.drvice.controller.camera

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.util.concurrent.Executors

/**
 * 100% 16KB-Page-Size Compatible Native QR Code Scanner.
 * Uses CameraX paired with pure-Java ZXing (zero native .so C++ libraries),
 * completely eliminating ELF alignment errors and warnings on Android 15 & 16.
 */
class QrScannerHelper(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val previewView: PreviewView,
    private val onScanned: (hostId: String) -> Unit
) {

    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var isScanning = false
    private val multiFormatReader = MultiFormatReader()

    fun startScanning() {
        if (isScanning) return
        isScanning = true

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder()
                .build()
                .also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                processImageProxy(imageProxy)
            }

            try {
                cameraProvider?.unbindAll()
                cameraProvider?.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalysis
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun processImageProxy(imageProxy: ImageProxy) {
        if (!isScanning) {
            imageProxy.close()
            return
        }

        try {
            val buffer = imageProxy.planes[0].buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)

            val width = imageProxy.width
            val height = imageProxy.height

            val source = PlanarYUVLuminanceSource(
                bytes,
                width,
                height,
                0,
                0,
                width,
                height,
                false
            )

            val binaryBitmap = BinaryBitmap(HybridBinarizer(source))
            val result = multiFormatReader.decodeWithState(binaryBitmap)

            val rawValue = result.text
            if (!rawValue.isNullOrBlank()) {
                isScanning = false
                val cleanId = extractHostId(rawValue)
                ContextCompat.getMainExecutor(context).execute {
                    stopScanning()
                    onScanned(cleanId)
                }
            }
        } catch (_: Exception) {
            // Frame does not contain a valid QR code yet; proceed to next frame
        } finally {
            multiFormatReader.reset()
            imageProxy.close()
        }
    }

    private fun extractHostId(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
            return try {
                val uri = java.net.URI(trimmed)
                val host = uri.host ?: ""
                if (host.isNotEmpty() && host != "localhost" && host != "127.0.0.1") {
                    val port = if (uri.port > 0 && uri.port != 3000 && uri.port != 80) uri.port else 8080
                    "$host:$port"
                } else {
                    trimmed
                }
            } catch (e: Exception) {
                trimmed
            }
        }
        if (trimmed.contains("ip=")) {
            return trimmed.substringAfter("ip=").substringBefore("&").trim()
        }
        return trimmed
    }

    fun stopScanning() {
        isScanning = false
        try {
            cameraProvider?.unbindAll()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun release() {
        stopScanning()
        cameraExecutor.shutdown()
    }
}
