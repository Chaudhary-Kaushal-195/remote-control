package com.drvice.controller.ui

import android.annotation.SuppressLint
import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import androidx.appcompat.widget.AppCompatTextView
import androidx.core.content.ContextCompat
import com.drvice.controller.R

/**
 * Dedicated multi-touch native pedal view (Gas, Brake, Reverse).
 * Tracks independent pointer IDs to allow simultaneous multi-finger pedal inputs.
 */
class PedalView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : AppCompatTextView(context, attrs, defStyleAttr) {

    var pedalType: String = "fwd" // "fwd", "brake", "bwd", "left", "right"
    var onStateChanged: ((pedal: String, active: Boolean, intensity: Float) -> Unit)? = null
    var onTriggerHaptic: (() -> Unit)? = null

    private var activePointerId: Int = MotionEvent.INVALID_POINTER_ID

    init {
        isClickable = true
        isFocusable = false
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val index = event.actionIndex
                if (activePointerId == MotionEvent.INVALID_POINTER_ID) {
                    activePointerId = event.getPointerId(index)
                    isPressed = true
                    animate().scaleX(0.96f).scaleY(0.96f).setDuration(80L).start()
                    onTriggerHaptic?.invoke()
                    onStateChanged?.invoke(pedalType, true, 1.0f)
                    parent?.requestDisallowInterceptTouchEvent(true)
                }
                return true
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_CANCEL -> {
                val index = event.actionIndex
                val pointerId = event.getPointerId(index)
                if (pointerId == activePointerId) {
                    activePointerId = MotionEvent.INVALID_POINTER_ID
                    isPressed = false
                    animate().scaleX(1.0f).scaleY(1.0f).setDuration(80L).start()
                    onStateChanged?.invoke(pedalType, false, 0.0f)
                    parent?.requestDisallowInterceptTouchEvent(false)
                }
                return true
            }
        }
        return super.onTouchEvent(event)
    }
}
