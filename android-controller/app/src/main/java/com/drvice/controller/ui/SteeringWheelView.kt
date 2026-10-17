package com.drvice.controller.ui

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.SweepGradient
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import android.view.animation.DecelerateInterpolator
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min

/**
 * High-performance native Android Steering Wheel View.
 * Supports multi-touch rotational steering with 0.72 spring auto-centering,
 * and passive visual tracking for hardware gyro mode.
 */
class SteeringWheelView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    var isInteractive: Boolean = true
        set(value) {
            field = value
            alpha = if (value) 1.0f else 0.35f
            invalidate()
        }

    var onAngleChanged: ((angle: Float) -> Unit)? = null

    private var currentAngle: Float = 0f
    private var lastTouchAngle: Double = 0.0
    private var activePointerId: Int = MotionEvent.INVALID_POINTER_ID
    private var autoCenterAnimator: ValueAnimator? = null

    // Pre-allocated graphic objects for zero GC stutter
    private val rimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 32f
        color = Color.parseColor("#151B28")
    }

    private val neonAccentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 6f
        color = Color.parseColor("#0FFFFA")
    }

    private val spokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#1E2536")
    }

    private val hubPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#121620")
    }

    private val hubBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 4f
        color = Color.parseColor("#0FFFFA")
    }

    private val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#FF0055")
    }

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#FFFFFF")
        textSize = 28f
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
        letterSpacing = 0.15f
    }

    private val rimRect = RectF()

    fun setWheelAngle(angle: Float) {
        currentAngle = max(-180f, min(180f, angle))
        invalidate()
    }

    fun getWheelAngle(): Float = currentAngle

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        val pad = rimPaint.strokeWidth / 2f + 8f
        rimRect.set(pad, pad, w.toFloat() - pad, h.toFloat() - pad)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f
        val cy = height / 2f
        val radius = min(cx, cy) - rimPaint.strokeWidth / 2f - 8f
        if (radius <= 0) return

        canvas.save()
        canvas.rotate(currentAngle, cx, cy)

        // 1. Spokes (3 heavy racing spokes)
        canvas.save()
        // Bottom spoke
        canvas.drawRect(cx - 16f, cy, cx + 16f, cy + radius, spokePaint)
        // Left spoke
        canvas.save()
        canvas.rotate(-115f, cx, cy)
        canvas.drawRect(cx - 18f, cy, cx + 18f, cy + radius, spokePaint)
        canvas.restore()
        // Right spoke
        canvas.save()
        canvas.rotate(115f, cx, cy)
        canvas.drawRect(cx - 18f, cy, cx + 18f, cy + radius, spokePaint)
        canvas.restore()
        canvas.restore()

        // 2. Heavy Outer Rim
        canvas.drawCircle(cx, cy, radius, rimPaint)
        canvas.drawCircle(cx, cy, radius - 16f, neonAccentPaint)

        // 3. Top Marker (12 o'clock centering notch)
        canvas.drawRect(cx - 14f, cy - radius - 18f, cx + 14f, cy - radius + 18f, markerPaint)

        // 4. Center Hub
        val hubRadius = radius * 0.38f
        canvas.drawCircle(cx, cy, hubRadius, hubPaint)
        canvas.drawCircle(cx, cy, hubRadius, hubBorderPaint)

        // 5. Hub Emblem Text
        val textY = cy - (textPaint.descent() + textPaint.ascent()) / 2f
        canvas.drawText("DR. VICE", cx, textY, textPaint)

        canvas.restore()
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!isInteractive) return false

        val cx = width / 2f
        val cy = height / 2f

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val index = event.actionIndex
                if (activePointerId == MotionEvent.INVALID_POINTER_ID) {
                    activePointerId = event.getPointerId(index)
                    val tx = event.getX(index)
                    val ty = event.getY(index)
                    lastTouchAngle = atan2((ty - cy).toDouble(), (tx - cx).toDouble())
                    autoCenterAnimator?.cancel()
                    parent?.requestDisallowInterceptTouchEvent(true)
                }
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                val pointerIndex = event.findPointerIndex(activePointerId)
                if (pointerIndex != -1) {
                    val tx = event.getX(pointerIndex)
                    val ty = event.getY(pointerIndex)
                    val curAngle = atan2((ty - cy).toDouble(), (tx - cx).toDouble())
                    var delta = Math.toDegrees(curAngle - lastTouchAngle).toFloat()

                    if (delta > 180f) delta -= 360f
                    if (delta < -180f) delta += 360f

                    currentAngle = max(-180f, min(180f, currentAngle + delta * 1.8f))
                    lastTouchAngle = curAngle
                    invalidate()
                    onAngleChanged?.invoke(currentAngle)
                }
                return true
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_CANCEL -> {
                val pointerIndex = event.actionIndex
                val pointerId = event.getPointerId(pointerIndex)
                if (pointerId == activePointerId) {
                    activePointerId = MotionEvent.INVALID_POINTER_ID
                    parent?.requestDisallowInterceptTouchEvent(false)
                    startAutoCenter()
                }
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun startAutoCenter() {
        autoCenterAnimator?.cancel()
        if (currentAngle == 0f) return

        // 0.72 decay spring return matching desktop keyboard responsiveness
        autoCenterAnimator = ValueAnimator.ofFloat(currentAngle, 0f).apply {
            duration = 180L
            interpolator = DecelerateInterpolator()
            addUpdateListener { anim ->
                currentAngle = anim.animatedValue as Float
                invalidate()
                onAngleChanged?.invoke(currentAngle)
            }
            start()
        }
    }
}
