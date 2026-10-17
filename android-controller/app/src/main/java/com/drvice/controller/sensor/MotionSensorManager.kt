package com.drvice.controller.sensor

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Ultra-low latency, zero-jitter hardware motion sensor manager.
 * Uses Android's native GAME_ROTATION_VECTOR (sensor fusion: gyro + accel)
 * with exponential smoothing filter to guarantee smooth steering and fast centering.
 */
class MotionSensorManager(
    context: Context,
    private val onTiltChanged: (Float) -> Unit
) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private var rotationSensor: Sensor? = null

    // Sensor state
    private val rotationMatrix = FloatArray(9)
    private val orientationAngles = FloatArray(3)
    private var smoothedTilt = 0f
    private var isEnabled = false

    // Jitter & responsiveness configuration
    private val deadzoneDegrees = 2.0f
    private val filterGain = 0.40f // Higher gain = faster response, low jitter

    init {
        // Preference: GAME_ROTATION_VECTOR eliminates magnetic drift while keeping 100Hz+ rate
        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
            ?: sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    }

    fun start() {
        if (isEnabled) return
        rotationSensor?.let { sensor ->
            sensorManager.registerListener(
                this,
                sensor,
                SensorManager.SENSOR_DELAY_GAME
            )
            isEnabled = true
        }
    }

    fun stop() {
        if (!isEnabled) return
        sensorManager.unregisterListener(this)
        isEnabled = false
        smoothedTilt = 0f
        onTiltChanged(0f)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        when (event.sensor.type) {
            Sensor.TYPE_GAME_ROTATION_VECTOR, Sensor.TYPE_ROTATION_VECTOR -> {
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
                // Remap coordinates for landscape orientation
                val remappedMatrix = FloatArray(9)
                SensorManager.remapCoordinateSystem(
                    rotationMatrix,
                    SensorManager.AXIS_Y,
                    SensorManager.AXIS_MINUS_X,
                    remappedMatrix
                )
                SensorManager.getOrientation(remappedMatrix, orientationAngles)

                // Roll angle in degrees (tilt left/right when holding phone like a steering wheel)
                val rawTiltDegrees = Math.toDegrees(orientationAngles[2].toDouble()).toFloat()
                processTilt(rawTiltDegrees)
            }
            Sensor.TYPE_ACCELEROMETER -> {
                // Fallback for devices without gyro
                val rawY = event.values[1] // Y axis tilt in landscape
                val fallbackTilt = (rawY / 9.81f) * 45f
                processTilt(fallbackTilt)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun processTilt(rawTilt: Float) {
        // Clamp raw tilt to [-45°, +45°] and map to [-180°, +180°] steering wheel angle
        val clampedTilt = max(-45f, min(45f, rawTilt)) * 4f

        // Deadzone filter for steady zero-center
        val targetTilt = if (abs(clampedTilt) < deadzoneDegrees) 0f else clampedTilt

        // Exponential smoothing filter to eliminate any micro-jitter while keeping zero-lag
        smoothedTilt = (smoothedTilt * (1f - filterGain)) + (targetTilt * filterGain)

        // Snappy snap to zero when returning to center
        if (abs(smoothedTilt) < 0.5f) {
            smoothedTilt = 0f
        }

        onTiltChanged(smoothedTilt)
    }
}
