import asyncio
import json
# pyrefly: ignore [missing-import]
import websockets
import math
import time

# ============================================================================
# FORZA-GRADE VEHICLE DYNAMICS SIMULATOR
# ============================================================================
# A complete vehicle physics engine with:
#   1. Engine Model (torque curve, rev limiter, idle, engine braking)
#   2. Transmission (gear ratios, final drive, clutch engagement)
#   3. Pacejka Tire Model (per-wheel, slip ratio, slip angle, grip circle)
#   4. Drivetrain / Differential (RWD/FWD/AWD, open/LSD)
#   5. Aerodynamics (drag, downforce, rolling resistance)
#   6. Braking (per-wheel, bias, ABS, handbrake, fade, engine braking)
#   7. Weight Transfer (longitudinal, lateral, per-wheel normal force)
#   8. Vehicle Dynamics Integration (position, heading, velocity, yaw rate)
#   9. Suspension (spring/damper per corner)
#  10. Thermal Model (tire temp, brake temp, coolant, oil)
#  11. State Output (JSON telemetry to JS frontend)
# ============================================================================


# ============================================================================
# 1. ENGINE MODEL
# ============================================================================

class Engine:
    """
    Simulates a naturally aspirated engine with a realistic torque curve,
    rev limiter, idle control, and engine braking.
    """

    def __init__(self):
        # --- Engine Specs ---
        self.max_rpm = 10000.0
        self.idle_rpm = 800.0
        self.rev_limiter = 9500.0
        self.rev_limiter_active = False

        # Torque curve sample points (RPM -> Nm)
        # This creates a realistic NA engine that builds torque from low RPM,
        # peaks around 5500-6500 RPM, then falls off near redline.
        self.torque_curve = [
            (0,      0.0),
            (800,    120.0),   # Idle
            (1500,   180.0),
            (2000,   220.0),
            (2500,   280.0),
            (3000,   330.0),
            (3500,   370.0),
            (4000,   400.0),
            (4500,   420.0),
            (5000,   435.0),
            (5500,   450.0),   # Peak torque
            (6000,   445.0),
            (6500,   430.0),
            (7000,   410.0),
            (7500,   380.0),
            (8000,   350.0),
            (8500,   310.0),
            (9000,   260.0),
            (9500,   200.0),   # Rev limiter zone
            (10000,  150.0),
        ]

        # Engine braking coefficient (Nm of resistance when off-throttle)
        self.engine_braking_torque = 80.0

        # Engine inertia (kg*m^2) - resistance to RPM changes
        self.inertia = 0.15

        # Current state
        self.rpm = self.idle_rpm
        self.torque_output = 0.0
        self.horsepower = 0.0
        self.load = 0.0

    def get_max_torque_at_rpm(self, rpm):
        """
        Interpolate the torque curve to get max available torque at a given RPM.
        Uses linear interpolation between sample points.
        """
        rpm = max(0.0, min(rpm, self.max_rpm))

        # Find the two surrounding sample points
        for i in range(len(self.torque_curve) - 1):
            rpm_low, torque_low = self.torque_curve[i]
            rpm_high, torque_high = self.torque_curve[i + 1]

            if rpm_low <= rpm <= rpm_high:
                # Linear interpolation
                t = (rpm - rpm_low) / (rpm_high - rpm_low) if rpm_high != rpm_low else 0
                return torque_low + t * (torque_high - torque_low)

        # Fallback (shouldn't reach here)
        return self.torque_curve[-1][1]

    def update(self, throttle, target_rpm, clutch_engagement, dt):
        """
        Calculate engine output for this frame.

        Args:
            throttle: 0.0 to 1.0
            target_rpm: Wheel speed converted to engine RPM
            clutch_engagement: 0.0 to 1.0 (0 = neutral/clutch in, 1 = in gear)
            dt: Time step in seconds
        """
        # --- Rev Limiter ---
        # Hard cut fuel above rev limit (like real rev limiters)
        if self.rpm >= self.rev_limiter:
            self.rev_limiter_active = True
            throttle = 0.0
        elif self.rpm < self.rev_limiter - 200:
            # Hysteresis: don't re-enable until RPM drops 200 below limiter
            self.rev_limiter_active = False

        if self.rev_limiter_active:
            throttle = 0.0

        # --- Torque Calculation ---
        max_torque = self.get_max_torque_at_rpm(self.rpm)
        drive_torque = max_torque * throttle

        # --- Engine Braking ---
        # When throttle is released, engine resists rotation, but NOT at idle!
        # Engine braking should smoothly drop to 0 as we approach idle_rpm.
        if self.rpm > self.idle_rpm:
            rpm_factor = (self.rpm - self.idle_rpm) / (self.max_rpm - self.idle_rpm)
            engine_brake = self.engine_braking_torque * (1.0 - throttle) * rpm_factor
        else:
            engine_brake = 0.0

        # Net torque output
        self.torque_output = drive_torque - engine_brake

        # --- Idle Control (Creep) ---
        # If RPM drops near or below idle, apply a positive torque to maintain idle
        if self.rpm < self.idle_rpm * 1.5 and throttle < 0.1:
            idle_correction = (self.idle_rpm - self.rpm) * 1.0  # Proportional creep
            self.torque_output = max(self.torque_output, idle_correction)

        # --- Simulate Engine RPM (Inertia & Clutch Slip) ---
        # 1. Engine accelerates based on its own torque
        engine_angular_accel = self.torque_output / self.inertia
        self.rpm += engine_angular_accel * dt * (30.0 / math.pi)

        # 2. Soft-couple to the wheels (Torque converter / slipping clutch)
        # This is the torque transmitted TO the transmission.
        transmitted_torque = 0.0
        
        if clutch_engagement > 0.0:
            slip_factor = 5.0 * clutch_engagement # How stiff the coupling is
            
            # The engine pulls the wheels forward if it's spinning faster, 
            # and drags them down if it's spinning slower.
            # We calculate how much the engine's RPM changed due to the clutch,
            # and convert that back to a torque applied to the transmission.
            
            if self.rpm < target_rpm:
                rpm_change = (target_rpm - self.rpm) * slip_factor * dt
                self.rpm += rpm_change
                # Engine is dragged up by wheels -> Wheels are dragged down by engine -> Negative transmitted torque
                transmitted_torque = -(rpm_change * self.inertia / dt) * (math.pi / 30.0)
            elif self.rpm > target_rpm:
                drag_factor = slip_factor * (1.0 - throttle * 0.8) 
                rpm_change = (target_rpm - self.rpm) * drag_factor * dt
                self.rpm += rpm_change
                # Engine is dragged down by wheels -> Wheels are pushed forward by engine -> Positive transmitted torque
                transmitted_torque = -(rpm_change * self.inertia / dt) * (math.pi / 30.0)
            
        # Hard limits
        self.rpm = max(self.idle_rpm, min(self.rpm, self.max_rpm + 500))

        # --- Horsepower ---
        self.horsepower = (self.torque_output * self.rpm) / 5252.0

        # --- Load ---
        self.load = throttle * 100.0

        return transmitted_torque


# ============================================================================
# 2. TRANSMISSION MODEL
# ============================================================================

class Transmission:
    """
    6-speed manual/automatic transmission with reverse.
    Converts engine torque through gear ratios and final drive.
    """

    def __init__(self):
        # Gear ratios (typical sports car)
        # Higher ratio = more torque multiplication, lower top speed
        self.gear_ratios = {
            -1: -3.17,   # Reverse
             0:  0.0,     # Neutral
             1:  3.587,   # 1st
             2:  2.022,   # 2nd
             3:  1.384,   # 3rd
             4:  1.000,   # 4th (direct drive)
             5:  0.861,   # 5th
             6:  0.726,   # 6th (overdrive)
        }

        # Final drive ratio (differential)
        self.final_drive = 3.42

        # Clutch state (0 = fully disengaged, 1 = fully engaged)
        self.clutch = 1.0
        self.clutch_speed = 5.0  # How fast clutch engages (per second)

        # Shift timing
        self.is_shifting = False
        self.shift_timer = 0.0
        self.shift_duration = 0.15  # seconds to complete a shift
        self.pending_gear = None

        # Current gear
        self.gear = 0  # Start in neutral

        # Efficiency losses
        self.efficiency = 0.88  # 12% drivetrain loss

    def get_total_ratio(self):
        """Get the combined gear ratio x final drive ratio."""
        gear_ratio = self.gear_ratios.get(self.gear, 0.0)
        return gear_ratio * self.final_drive

    def get_gear_ratio(self):
        """Get just the current gear ratio."""
        return self.gear_ratios.get(self.gear, 0.0)

    def engine_rpm_from_wheel_speed(self, wheel_angular_vel):
        """
        Calculate what engine RPM should be based on wheel angular velocity.
        wheel_angular_vel is in rad/s.
        """
        total_ratio = self.get_total_ratio()
        if abs(total_ratio) < 0.001:
            return 800.0  # Neutral -> idle

        engine_angular_vel = wheel_angular_vel * abs(total_ratio)
        engine_rpm = engine_angular_vel * 60.0 / (2.0 * math.pi)
        return max(800.0, engine_rpm)

    def wheel_torque_from_engine(self, engine_torque):
        """
        Convert engine torque to wheel torque through the drivetrain.
        """
        total_ratio = self.get_total_ratio()
        return engine_torque * total_ratio * self.efficiency * self.clutch

    def update(self, dt):
        """Update clutch engagement and shift timing."""
        # Shift timing
        if self.is_shifting:
            self.shift_timer -= dt
            self.clutch = max(0.0, self.clutch - self.clutch_speed * dt * 3.0)

            if self.shift_timer <= 0:
                self.gear = self.pending_gear
                self.is_shifting = False
                self.pending_gear = None

        # Re-engage clutch after shift
        if not self.is_shifting and self.clutch < 1.0:
            self.clutch = min(1.0, self.clutch + self.clutch_speed * dt)

    def shift_to(self, target_gear):
        """Initiate a gear change."""
        if target_gear == self.gear or self.is_shifting:
            return
        if target_gear not in self.gear_ratios:
            return

        self.is_shifting = True
        self.shift_timer = self.shift_duration
        self.pending_gear = target_gear


# ============================================================================
# 3. PACEJKA TIRE MODEL
# ============================================================================

class Tire:
    """
    Per-wheel tire simulation using the Pacejka 'Magic Formula'.
    This is THE thing that makes racing games feel real.

    The Magic Formula:
        F = D * sin(C * arctan(B * x - E * (B * x - arctan(B * x))))

    Where:
        B = Stiffness factor
        C = Shape factor
        D = Peak force (depends on normal load)
        E = Curvature factor
        x = slip ratio (longitudinal) or slip angle (lateral)
    """

    def __init__(self, position_name="fl"):
        self.position = position_name  # fl, fr, rl, rr

        # --- Pacejka Coefficients ---
        # Longitudinal (acceleration/braking)
        self.B_long = 10.0     # Stiffness
        self.C_long = 1.9      # Shape
        self.D_long = 1.0      # Peak (multiplied by normal force)
        self.E_long = 0.97     # Curvature

        # Lateral (cornering)
        self.B_lat = 8.0       # Stiffness
        self.C_lat = 1.3       # Shape (lower = more gradual breakaway)
        self.D_lat = 1.0       # Peak
        self.E_lat = 0.97      # Curvature

        # --- Tire Physical Properties ---
        self.radius = 0.33     # meters (typical sports car tire)
        self.width = 0.245     # meters
        self.inertia = 1.2     # kg*m^2 (moment of inertia of wheel+tire)

        # --- Tire State ---
        self.angular_velocity = 0.0  # rad/s (how fast the wheel is spinning)
        self.slip_ratio = 0.0        # longitudinal slip (-1 to +inf)
        self.slip_angle = 0.0        # lateral slip (radians)

        # Forces output
        self.force_long = 0.0   # Newtons (forward/backward)
        self.force_lat = 0.0    # Newtons (left/right)
        self.force_total = 0.0  # Combined grip usage

        # Normal force (weight on this tire)
        self.normal_force = 0.0  # Newtons

        # RPM for telemetry
        self.wheel_rpm = 0.0
        self.grip_usage = 0.0  # Percentage of available grip used (0.0 to 1.0)

        # --- Thermal Model ---
        self.temperature = 25.0  # Celsius
        self.grip_multiplier = 1.0
        
        self.drift_mode = False
        self.grip_level = 1.0     
        self.grip_multiplier = 1.0   # Temperature-based grip scaling

        # Is this wheel locked (ABS or brake lock)?
        self.locked = False

    def pacejka(self, slip, B, C, D, E):
        """
        The Magic Formula:
        F = D * sin(C * arctan(B * slip - E * (B * slip - arctan(B * slip))))
        """
        Bx = B * slip
        return D * math.sin(C * math.atan(Bx - E * (Bx - math.atan(Bx))))

    def calculate_grip_from_temperature(self):
        """
        Tire grip depends on temperature:
        - Too cold (< 40 deg C): Low grip (tires not in operating window)
        - Optimal (~85 deg C): Peak grip (1.0)
        - Too hot (> 120 deg C): Grip falls off (thermal degradation)
        """
        temp = self.temperature

        if temp < 40.0:
            # Cold tires - linear ramp from 0.7 at 0 deg C to 1.0 at 40 deg C
            self.grip_multiplier = 0.7 + 0.3 * (temp / 40.0)
        elif temp <= 100.0:
            # Optimal range
            self.grip_multiplier = 1.0
        elif temp <= 150.0:
            # Overheating - linear drop from 1.0 at 100 deg C to 0.6 at 150 deg C
            self.grip_multiplier = 1.0 - 0.4 * ((temp - 100.0) / 50.0)
        else:
            self.grip_multiplier = 0.6

    def calculate_slip_ratio(self, car_speed_at_wheel):
        """
        Longitudinal slip ratio:
            sigma = (wheel_speed - car_speed) / max(|wheel_speed|, |car_speed|, 0.5)

        Positive = wheelspin (wheel faster than car)
        Negative = wheel lockup (car sliding, tires stopped)
        """
        wheel_speed = self.angular_velocity * self.radius
        denominator = max(abs(wheel_speed), abs(car_speed_at_wheel), 0.5)

        self.slip_ratio = (wheel_speed - car_speed_at_wheel) / denominator
        # Clamp to reasonable range
        self.slip_ratio = max(-1.0, min(self.slip_ratio, 2.0))

    def calculate_slip_angle(self, vx, vy):
        """
        Lateral slip angle:
        The angle between where the tire is pointing and where it's actually moving.

        vx = longitudinal velocity (in tire's reference frame)
        vy = lateral velocity (in tire's reference frame)
        """
        if abs(vx) > 0.5:
            self.slip_angle = math.atan2(vy, abs(vx))
        elif abs(vy) > 0.1:
            self.slip_angle = math.copysign(math.pi / 2, vy) * 0.5
        else:
            self.slip_angle = 0.0

    def calculate_forces(self, normal_force, car_speed_at_wheel, vx_tire, vy_tire):
        """
        Calculate the longitudinal and lateral forces this tire produces.

        Uses the friction ellipse (grip circle) to combine longitudinal and
        lateral forces - you can't have 100% braking AND 100% cornering.
        """
        self.normal_force = max(0, normal_force)

        if self.normal_force < 10.0:
            # Tire in the air or nearly so
            self.force_long = 0.0
            self.force_lat = 0.0
            return

        # Update temperature-based grip
        self.calculate_grip_from_temperature()

        # Calculate slips
        self.calculate_slip_ratio(car_speed_at_wheel)
        self.calculate_slip_angle(vx_tire, vy_tire)

        # Peak force = mu x Fz (friction coefficient x normal force)
        # Load sensitivity: grip doesn't increase linearly with load
        # (diminishing returns at higher loads - this is critical for weight transfer feel)
        base_mu = 1.4 * self.grip_level  # Apply user grip level
        
        # Drift mode reduces rear grip specifically
        if self.drift_mode and self.position in ["rl", "rr"]:
            base_mu *= 0.55  # 45% reduction in rear grip for easy sliding
            
        # Load sensitivity: reduce effective mu as load increases
        load_sensitivity = 1.0 - 0.0001 * (self.normal_force / 9.81)  # per kg
        load_sensitivity = max(0.5, load_sensitivity)

        effective_mu = base_mu * load_sensitivity * self.grip_multiplier
        peak_force = effective_mu * self.normal_force

        # --- Longitudinal Force (Pacejka) ---
        raw_long = self.pacejka(
            self.slip_ratio,
            self.B_long, self.C_long, self.D_long, self.E_long
        )

        # --- Lateral Force (Pacejka) ---
        # Must be negated because lateral friction OPPOSES the lateral sliding velocity
        raw_lat = -self.pacejka(
            self.slip_angle,
            self.B_lat, self.C_lat, self.D_lat, self.E_lat
        )

        # --- Friction Ellipse (Grip Circle) ---
        # The total force vector can't exceed the grip circle.
        # This means heavy braking reduces available cornering force and vice versa.
        combined = math.sqrt(raw_long ** 2 + raw_lat ** 2)
        if combined > 1.0:
            scale = 1.0 / combined
            raw_long *= scale
            raw_lat *= scale

        self.force_long = raw_long * peak_force
        self.force_lat = raw_lat * peak_force
        self.force_total = math.sqrt(self.force_long ** 2 + self.force_lat ** 2)
        
        # Calculate grip usage percentage (bounded to 1.0 max logically, but we keep it actual for accuracy)
        self.grip_usage = (self.force_total / peak_force) if peak_force > 0 else 0.0

    def update_angular_velocity(self, drive_torque, brake_torque, car_speed_at_wheel, dt):
        """
        Update wheel spin based on applied torques.
        """
        # The tire's longitudinal force acts as a reaction torque on the wheel
        reaction_torque = self.force_long * self.radius

        # Brake torque always opposes rotation
        if self.angular_velocity > 0.01:
            effective_brake = -brake_torque
        elif self.angular_velocity < -0.01:
            effective_brake = brake_torque
        else:
            effective_brake = 0.0
            if brake_torque > abs(drive_torque):
                self.angular_velocity = 0.0
                self.locked = True
                return

        self.locked = False
        net_torque = drive_torque - reaction_torque + effective_brake

        # --- PREVENT PACEJKA INTEGRATION OVERSHOOT ---
        # Torque needed to exactly match ground speed in one timestep
        target_w = car_speed_at_wheel / self.radius
        torque_to_match = (target_w - self.angular_velocity) * self.inertia / dt

        # If net_torque is pushing the wheel towards ground speed, cap it so it doesn't overshoot
        if net_torque * torque_to_match > 0:
            if abs(net_torque) > abs(torque_to_match):
                net_torque = torque_to_match

        # Angular acceleration = torque / inertia
        angular_accel = net_torque / self.inertia
        self.angular_velocity += angular_accel * dt

        # Prevent negative spin in forward gear
        if brake_torque < 1.0 and drive_torque > 0 and self.angular_velocity < 0:
            self.angular_velocity = 0.0

        # Update RPM
        self.wheel_rpm = abs(self.angular_velocity) * 60.0 / (2.0 * math.pi)

    def update_temperature(self, dt, airspeed):
        """
        Tire temperature model:
        - Heats up from slip (friction = heat)
        - Cools down from airflow and radiation
        """
        # Heat generation from slip
        slip_energy = (abs(self.slip_ratio) + abs(self.slip_angle)) * abs(self.force_total)
        heat_gain = slip_energy * dt * 0.0005  # 100x increase so it actually heats up

        # Cooling from airflow
        air_cooling = (airspeed * 0.3 + 5.0) * dt * 0.15

        # Ambient radiation cooling
        ambient = 25.0
        radiation_cooling = (self.temperature - ambient) * dt * 0.02

        self.temperature += heat_gain - air_cooling - radiation_cooling
        self.temperature = max(ambient, min(self.temperature, 200.0))


# ============================================================================
# 4. DRIVETRAIN / DIFFERENTIAL
# ============================================================================

class Differential:
    """
    Distributes torque between left and right wheels.
    Supports open diff and limited-slip (LSD).
    """

    def __init__(self, diff_type="open"):
        self.diff_type = diff_type  # "open" or "lsd"
        self.lsd_preload = 50.0     # Nm of preload for LSD
        self.lsd_ramp = 0.5         # Power ramp (0-1)

    def distribute_torque(self, total_torque, left_speed, right_speed):
        """
        Distribute torque between left and right wheels.

        Returns (left_torque, right_torque)
        """
        if self.diff_type == "open":
            # Open diff: equal torque split, but the slower wheel limits both
            return total_torque * 0.5, total_torque * 0.5

        elif self.diff_type == "lsd":
            # Limited Slip: transfer torque from spinning wheel to gripping wheel
            speed_diff = abs(left_speed - right_speed)
            lock_factor = min(1.0, speed_diff * self.lsd_ramp * 0.1 + self.lsd_preload / max(abs(total_torque), 1))
            lock_factor = min(lock_factor, 0.8)  # Max 80% lock

            # Base 50/50 split, then bias towards slower wheel
            base_split = 0.5
            if left_speed > right_speed:
                left_ratio = base_split - lock_factor * 0.3
                right_ratio = base_split + lock_factor * 0.3
            else:
                left_ratio = base_split + lock_factor * 0.3
                right_ratio = base_split - lock_factor * 0.3

            return total_torque * left_ratio, total_torque * right_ratio

        return total_torque * 0.5, total_torque * 0.5


class DrivetrainManager:
    """
    Manages power distribution between front and rear axles.
    """

    def __init__(self, layout="rwd"):
        self.layout = layout  # "rwd", "fwd", "awd", "awd-sport"
        self.front_diff = Differential("open")
        self.rear_diff = Differential("lsd")  # Rear gets LSD for fun

        # Power split ratios
        self.splits = {
            "rwd":       (0.0, 1.0),
            "fwd":       (1.0, 0.0),
            "awd":       (0.5, 0.5),
            "awd-sport": (0.2, 0.8),
        }

    def set_layout(self, layout):
        if layout in self.splits:
            self.layout = layout

    def get_split(self):
        return self.splits.get(self.layout, (0.0, 1.0))

    def distribute(self, total_wheel_torque, tire_speeds):
        """
        Distribute torque to all 4 wheels.

        tire_speeds = [fl_speed, fr_speed, rl_speed, rr_speed] (angular velocities)

        Returns [fl_torque, fr_torque, rl_torque, rr_torque]
        """
        front_ratio, rear_ratio = self.get_split()

        front_torque = total_wheel_torque * front_ratio
        rear_torque = total_wheel_torque * rear_ratio

        fl_torque, fr_torque = self.front_diff.distribute_torque(
            front_torque, tire_speeds[0], tire_speeds[1]
        )
        rl_torque, rr_torque = self.rear_diff.distribute_torque(
            rear_torque, tire_speeds[2], tire_speeds[3]
        )

        return [fl_torque, fr_torque, rl_torque, rr_torque]


# ============================================================================
# 5. AERODYNAMICS
# ============================================================================

class Aerodynamics:
    """
    Models aerodynamic forces acting on the vehicle.
    """

    def __init__(self):
        self.air_density = 1.225      # kg/m^3 (sea level)
        self.frontal_area = 2.2       # m^2 (typical sports car)
        self.drag_coefficient = 0.32  # Cd (sports car)
        self.lift_coefficient = -0.35 # Cl (negative = downforce)

        # Rolling resistance
        self.rolling_resistance_coeff = 0.015  # Typical tire on asphalt

    def calculate(self, speed, car_mass):
        """
        Calculate aero forces.

        Returns:
            drag_force: N (opposing motion)
            downforce: N (pushing car into ground)
            rolling_resistance: N (opposing motion)
        """
        speed_sq = speed * speed

        # Drag = 0.5 x rho x Cd x A x v^2
        drag_force = 0.5 * self.air_density * self.drag_coefficient * self.frontal_area * speed_sq

        # Downforce = 0.5 x rho x |Cl| x A x v^2 (always pushes down)
        downforce = 0.5 * self.air_density * abs(self.lift_coefficient) * self.frontal_area * speed_sq

        # Rolling resistance = Crr x m x g
        rolling_resistance = self.rolling_resistance_coeff * car_mass * 9.81

        return drag_force, downforce, rolling_resistance


# ============================================================================
# 6. BRAKING SYSTEM
# ============================================================================

class BrakeSystem:
    """
    Per-wheel braking with bias, ABS, handbrake, and brake fade.
    """

    def __init__(self):
        # Max brake torque per wheel (Nm)
        self.max_brake_torque = 3000.0

        # Brake bias (front/rear split)
        self.front_bias = 0.65  # 65% front, 35% rear (typical)

        # ABS
        self.abs_enabled = True
        self.abs_cycle_hz = 15.0  # ABS pulse frequency
        self.abs_timer = 0.0
        self.abs_active = False

        # Brake temperatures (per axle, deg C)
        self.temp_front = 30.0
        self.temp_rear = 30.0

        # Brake fade
        self.fade_temp = 600.0      # Temperature where fade starts (deg C)
        self.max_temp = 900.0       # Maximum brake temp
        self.fade_factor = 1.0      # Current effectiveness (1.0 = full, 0.3 = faded)

    def calculate_brake_torques(self, brake_input, handbrake_input, wheel_speeds, dt):
        """
        Calculate brake torque for each wheel.

        Returns [fl, fr, rl, rr] brake torques in Nm.
        """
        self.abs_active = False

        # --- Brake Fade ---
        # Hot brakes lose effectiveness
        max_temp = max(self.temp_front, self.temp_rear)
        if max_temp > self.fade_temp:
            fade = (max_temp - self.fade_temp) / (self.max_temp - self.fade_temp)
            self.fade_factor = max(0.3, 1.0 - fade * 0.7)
        else:
            self.fade_factor = 1.0

        effective_brake = brake_input * self.fade_factor

        # Base brake torque
        total_brake = self.max_brake_torque * effective_brake

        # Split front/rear
        front_brake_per_wheel = total_brake * self.front_bias * 0.5
        rear_brake_per_wheel = total_brake * (1.0 - self.front_bias) * 0.5

        torques = [
            front_brake_per_wheel,
            front_brake_per_wheel,
            rear_brake_per_wheel,
            rear_brake_per_wheel
        ]

        # --- Handbrake ---
        # Only affects rear wheels, bypasses ABS
        if handbrake_input > 0.1:
            handbrake_torque = self.max_brake_torque * handbrake_input * 0.8
            torques[2] += handbrake_torque
            torques[3] += handbrake_torque

        # --- ABS ---
        # Rapidly pulse brakes if a wheel is about to lock
        if self.abs_enabled and brake_input > 0.3:
            self.abs_timer += dt
            abs_phase = math.sin(self.abs_timer * self.abs_cycle_hz * 2.0 * math.pi)

            for i in range(4):
                # Skip ABS on rear wheels if handbrake is active
                if i >= 2 and handbrake_input > 0.1:
                    continue

                # If wheel is nearly locked (very low speed compared to others)
                if abs(wheel_speeds[i]) < 1.0 and brake_input > 0.5:
                    # ABS modulation
                    if abs_phase < 0:
                        torques[i] *= 0.2  # Release brake pressure
                    self.abs_active = True

        # --- Brake Temperature ---
        avg_wheel_speed = sum(abs(s) for s in wheel_speeds) / 4.0
        heat_energy = effective_brake * avg_wheel_speed * dt * 2.0
        cooling = dt * 3.0 + avg_wheel_speed * dt * 0.5

        self.temp_front = max(30.0, min(self.max_temp,
            self.temp_front + heat_energy * self.front_bias - cooling))
        self.temp_rear = max(30.0, min(self.max_temp,
            self.temp_rear + heat_energy * (1.0 - self.front_bias) - cooling))

        return torques


# ============================================================================
# 7. WEIGHT TRANSFER
# ============================================================================

class WeightTransfer:
    """
    Calculates per-wheel normal forces based on acceleration.
    """

    def __init__(self, mass, wheelbase, track_width, cog_height):
        self.mass = mass                 # kg
        self.wheelbase = wheelbase       # meters (front axle to rear axle)
        self.track_width = track_width   # meters (left wheel to right wheel)
        self.cog_height = cog_height     # meters (center of gravity height)

        # Weight distribution (fraction on front axle)
        self.front_weight_ratio = 0.45   # 45% front, 55% rear (rear-mid engine)

        # G-forces
        self.g_long = 0.0
        self.g_lat = 0.0

    def calculate(self, accel_long, accel_lat, downforce):
        """
        Calculate normal force on each tire.

        accel_long: m/s^2 (positive = accelerating forward)
        accel_lat: m/s^2 (positive = turning right)
        downforce: N (total aerodynamic downforce)

        Returns [fl, fr, rl, rr] normal forces in Newtons.
        """
        W = self.mass * 9.81  # Total weight force
        W_total = W + downforce

        # G-forces for telemetry
        self.g_long = accel_long / 9.81
        self.g_lat = accel_lat / 9.81

        # --- Static weight distribution ---
        front_static = W_total * self.front_weight_ratio * 0.5
        rear_static = W_total * (1.0 - self.front_weight_ratio) * 0.5

        # --- Longitudinal transfer ---
        # Braking -> weight shifts forward; Acceleration -> weight shifts rearward
        long_transfer = (self.mass * accel_long * self.cog_height) / (self.wheelbase * 2.0)

        # --- Lateral transfer ---
        # Turning right -> weight shifts to left wheels
        lat_transfer_front = (self.mass * accel_lat * self.cog_height *
                              self.front_weight_ratio) / (self.track_width * 2.0)
        lat_transfer_rear = (self.mass * accel_lat * self.cog_height *
                             (1.0 - self.front_weight_ratio)) / (self.track_width * 2.0)

        # --- Per-wheel normal forces ---
        fl = front_static - long_transfer + lat_transfer_front
        fr = front_static - long_transfer - lat_transfer_front
        rl = rear_static + long_transfer + lat_transfer_rear
        rr = rear_static + long_transfer - lat_transfer_rear

        # Can't have negative normal force (tire lifts off ground)
        return [max(0, fl), max(0, fr), max(0, rl), max(0, rr)]


# ============================================================================
# 8. SUSPENSION MODEL
# ============================================================================

class Suspension:
    """
    Simple spring/damper model for each corner.
    Maps normal force to suspension travel for visual feedback.
    """

    def __init__(self, mass):
        self.mass = mass

        # Spring rate (N/m) per corner
        self.spring_rate = 35000.0

        # Damping coefficient
        self.damping = 3000.0

        # Travel range (meters)
        self.max_travel = 0.12  # 120mm total travel

        # Current compression (0.0 = fully extended, 1.0 = fully compressed)
        self.travel = [0.5, 0.5, 0.5, 0.5]  # fl, fr, rl, rr

        # Velocity of suspension movement
        self.velocity = [0.0, 0.0, 0.0, 0.0]

    def update(self, normal_forces, dt):
        """
        Update suspension travel based on normal forces.
        """
        static_force_per_corner = self.mass * 9.81 / 4.0

        for i in range(4):
            # Target compression based on force
            force_delta = normal_forces[i] - static_force_per_corner
            target_displacement = force_delta / self.spring_rate

            # Normalize to 0-1 range
            target_travel = 0.5 + (target_displacement / self.max_travel)
            target_travel = max(0.0, min(1.0, target_travel))

            # Spring-damper response
            error = target_travel - self.travel[i]
            spring_force = error * 20.0  # Spring stiffness
            damper_force = -self.velocity[i] * 8.0  # Damping

            accel = spring_force + damper_force
            self.velocity[i] += accel * dt
            self.travel[i] += self.velocity[i] * dt
            self.travel[i] = max(0.0, min(1.0, self.travel[i]))


# ============================================================================
# 9. THERMAL MODEL
# ============================================================================

class ThermalModel:
    """
    Engine coolant and oil temperature simulation.
    """

    def __init__(self):
        self.coolant_temp = 60.0    # Start cold
        self.oil_temp = 50.0        # Start cold
        self.thermostat_open = False

    def update(self, rpm, throttle, speed_kph, dt):
        """Update engine thermal state."""
        # Heat generation from engine load
        engine_heat = (rpm / 10000.0) * throttle * dt * 8.0
        # Additional heat from high RPM even without throttle (friction)
        friction_heat = (rpm / 10000.0) * dt * 1.5

        total_heat = engine_heat + friction_heat

        # Cooling
        # Thermostat opens above 85 deg C
        self.thermostat_open = self.coolant_temp > 85.0

        if self.thermostat_open:
            # Radiator cooling - proportional to airspeed
            radiator_cooling = (speed_kph / 200.0 + 0.3) * dt * 5.0
        else:
            # Minimal cooling (engine warming up)
            radiator_cooling = dt * 0.5

        # Ambient radiation
        ambient_cooling = (self.coolant_temp - 25.0) * dt * 0.01

        # Update temperatures
        self.coolant_temp += total_heat - radiator_cooling - ambient_cooling
        self.coolant_temp = max(25.0, min(125.0, self.coolant_temp))

        # Oil temp follows coolant with thermal lag
        oil_heat = total_heat * 1.2  # Oil absorbs more heat
        oil_cooling = (self.oil_temp - self.coolant_temp) * dt * 0.3
        self.oil_temp += oil_heat - oil_cooling
        self.oil_temp = max(25.0, min(150.0, self.oil_temp))


# ============================================================================
# 10. VEHICLE DYNAMICS INTEGRATION
# ============================================================================

class VehicleDynamics:
    """
    The master integrator that ties everything together.
    Tracks the car's position, heading, velocity, and yaw rate.
    """

    def __init__(self):
        # --- Vehicle Parameters ---
        self.mass = 1450.0         # kg (with driver)
        self.wheelbase = 2.65      # meters
        self.track_width = 1.58    # meters
        self.cog_height = 0.45     # meters
        self.front_axle_to_cog = 1.20   # meters
        self.rear_axle_to_cog = 1.45    # meters

        # Yaw moment of inertia (kg*m^2)
        # Approximation: I = mass x (wheelbase/2)^2 x 0.5
        self.yaw_inertia = self.mass * (self.wheelbase * 0.5) ** 2 * 0.5

        # --- Vehicle State ---
        self.pos_x = 0.0           # World position X (meters)
        self.pos_z = 0.0           # World position Z (meters)
        self.heading = 0.0         # Yaw angle (radians, 0 = facing +Z)
        self.yaw_rate = 0.0        # Angular velocity (rad/s)

        self.vx = 0.0              # Velocity in car's local X (longitudinal, m/s)
        self.vy = 0.0              # Velocity in car's local Y (lateral, m/s)

        self.speed = 0.0           # Scalar speed (m/s)
        self.speed_kph = 0.0       # Speed in KPH

        # Acceleration for weight transfer
        self.accel_long = 0.0      # m/s^2
        self.accel_lat = 0.0       # m/s^2

        self.prev_vx = 0.0
        self.prev_vy = 0.0

    def get_tire_velocities(self, steer_angle_rad):
        """
        Calculate the velocity of each tire contact patch in the tire's local frame.
        This is essential for calculating slip angles.

        Returns list of (vx_tire, vy_tire) for [fl, fr, rl, rr]
        where vx_tire is along the tire's heading, vy_tire is perpendicular.
        """
        velocities = []

        # Front-left
        fx = self.vx + self.yaw_rate * self.front_axle_to_cog
        fy = self.vy - self.yaw_rate * self.track_width * 0.5
        # Rotate into tire frame (steered)
        cos_s = math.cos(steer_angle_rad)
        sin_s = math.sin(steer_angle_rad)
        vx_fl = fx * cos_s + fy * sin_s
        vy_fl = -fx * sin_s + fy * cos_s
        velocities.append((vx_fl, vy_fl))

        # Front-right
        fx = self.vx + self.yaw_rate * self.front_axle_to_cog
        fy = self.vy + self.yaw_rate * self.track_width * 0.5
        vx_fr = fx * cos_s + fy * sin_s
        vy_fr = -fx * sin_s + fy * cos_s
        velocities.append((vx_fr, vy_fr))

        # Rear-left (no steering)
        rx = self.vx - self.yaw_rate * self.rear_axle_to_cog
        ry = self.vy - self.yaw_rate * self.track_width * 0.5
        velocities.append((rx, ry))

        # Rear-right
        rx = self.vx - self.yaw_rate * self.rear_axle_to_cog
        ry = self.vy + self.yaw_rate * self.track_width * 0.5
        velocities.append((rx, ry))

        return velocities

    def integrate(self, total_force_x, total_force_y, total_yaw_moment, dt):
        """
        Integrate forces and moments to update vehicle state.

        total_force_x: Longitudinal force in car frame (N)
        total_force_y: Lateral force in car frame (N)
        total_yaw_moment: Yaw moment (Nm)
        """
        # Store previous velocities for acceleration calculation
        self.prev_vx = self.vx
        self.prev_vy = self.vy

        # --- Linear Acceleration ---
        ax = total_force_x / self.mass
        ay = total_force_y / self.mass

        # --- Yaw Acceleration ---
        yaw_accel = total_yaw_moment / self.yaw_inertia

        # Natural yaw damping (tire scrub, etc.)
        yaw_damping = -self.yaw_rate * 50.0 / self.yaw_inertia
        yaw_accel += yaw_damping * (1.0 if abs(self.speed) < 2.0 else 0.1)

        # --- Integrate ---
        # Update velocities (in car's local frame)
        self.vx += ax * dt
        self.vy += ay * dt

        # Update yaw rate
        self.yaw_rate += yaw_accel * dt

        # Limit yaw rate to prevent physics explosion
        self.yaw_rate = max(-8.0, min(8.0, self.yaw_rate))

        # Account for rotating reference frame
        # (centripetal correction for velocity in rotating body frame)
        new_vx = self.vx + self.vy * self.yaw_rate * dt
        new_vy = self.vy - self.vx * self.yaw_rate * dt
        self.vx = new_vx
        self.vy = new_vy

        # Update heading
        self.heading += self.yaw_rate * dt

        # Convert local velocity to world velocity and update position
        cos_h = math.cos(self.heading)
        sin_h = math.sin(self.heading)

        world_vx = self.vx * cos_h - self.vy * sin_h
        world_vz = self.vx * sin_h + self.vy * cos_h

        self.pos_x += world_vx * dt
        self.pos_z += world_vz * dt

        # Update speed
        self.speed = math.sqrt(self.vx ** 2 + self.vy ** 2)
        self.speed_kph = self.speed * 3.6

        # Acceleration (for weight transfer, computed from velocity change)
        if dt > 0.0001:
            self.accel_long = (self.vx - self.prev_vx) / dt
            self.accel_lat = (self.vy - self.prev_vy) / dt


# ============================================================================
# 11. MASTER SIMULATOR
# ============================================================================

class ForceVehicleSimulator:
    """
    The master class that orchestrates all sub-systems every physics tick.
    """

    def __init__(self):
        # --- Sub-systems ---
        self.engine = Engine()
        self.transmission = Transmission()
        self.drivetrain = DrivetrainManager("rwd")
        self.aero = Aerodynamics()
        self.brakes = BrakeSystem()
        self.dynamics = VehicleDynamics()
        self.weight_transfer = WeightTransfer(
            mass=self.dynamics.mass,
            wheelbase=self.dynamics.wheelbase,
            track_width=self.dynamics.track_width,
            cog_height=self.dynamics.cog_height
        )
        self.suspension = Suspension(self.dynamics.mass)
        self.thermals = ThermalModel()

        # 4 tires: FL, FR, RL, RR
        self.tires = [
            Tire("fl"), Tire("fr"), Tire("rl"), Tire("rr")
        ]

        # --- Logistics ---
        self.fuel_level = 100.0  # Percentage

        # --- Timing ---
        self.last_time = time.time()
        self.physics_hz = 400  # Increased from 120 to 400 to prevent Pacejka oscillation
        self.max_substeps = 16 # Increased from 8 to 16

        # --- State for telemetry output ---
        self.telemetry = {}

        # --- Previous frame inputs for smoothing ---
        self.smooth_steer = 0.0

    def update(self, inputs):
        """
        Main simulation tick. Called every frame from websocket handler.
        """
        now = time.time()
        frame_dt = min(now - self.last_time, 0.1)  # Cap at 100ms
        self.last_time = now

        if frame_dt < 0.001:
            return self.telemetry

        # --- Read Inputs ---
        throttle = max(0.0, min(1.0, inputs.get("throttle", 0.0)))
        brake = max(0.0, min(1.0, inputs.get("brake", 0.0)))
        steer_input = max(-1.0, min(1.0, inputs.get("steering", 0.0)))
        handbrake = max(0.0, min(1.0, inputs.get("handbrake", 0.0)))
        gear_request = inputs.get("gear", None)
        drivetrain_type = inputs.get("drivetrain", "rwd")
        drift_mode = inputs.get("drift_mode", False)
        grip_level = inputs.get("grip_level", 1.0)
        
        for tire in self.tires:
            tire.drift_mode = drift_mode
            tire.grip_level = grip_level

        # Update drivetrain layout if changed
        self.drivetrain.set_layout(drivetrain_type)

        # Handle gear changes from frontend
        if gear_request is not None and not self.transmission.is_shifting:
            if gear_request != self.transmission.gear:
                self.transmission.shift_to(gear_request)

        # --- Steering ---
        # Convert input (-1 to 1) to actual wheel angle
        # Reduce max steer angle at speed (like real power steering)
        max_steer_deg = 35.0  # Max steering lock
        speed_factor = 1.0 / (1.0 + self.dynamics.speed * 0.015)
        steer_angle_deg = steer_input * max_steer_deg * speed_factor

        # Smooth steering
        self.smooth_steer += (steer_angle_deg - self.smooth_steer) * min(1.0, frame_dt * 15.0)
        steer_angle_rad = math.radians(self.smooth_steer)

        # --- Physics Sub-stepping ---
        # More sub-steps = more stable simulation
        substeps = max(1, min(self.max_substeps, int(frame_dt * self.physics_hz)))
        sub_dt = frame_dt / substeps

        for _ in range(substeps):
            self._physics_step(throttle, brake, steer_angle_rad, handbrake, sub_dt)

        # --- Update non-physics systems ---
        self.thermals.update(
            self.engine.rpm, throttle,
            self.dynamics.speed_kph, frame_dt
        )
        
        # Simple fuel consumption model based on engine speed and load
        fuel_consumption_rate = (self.engine.rpm / 10000.0) * (0.2 + 0.8 * throttle) * 0.05
        self.fuel_level = max(0.0, self.fuel_level - fuel_consumption_rate * frame_dt)

        # --- Build Telemetry Output ---
        self._build_telemetry(throttle, steer_angle_deg)

        return self.telemetry

    def _physics_step(self, throttle, brake, steer_angle_rad, handbrake, dt):
        """
        A single physics sub-step.
        This is where the real magic happens.
        """
        # === 1. AERODYNAMICS ===
        drag_force, downforce, rolling_resistance = self.aero.calculate(
            self.dynamics.speed, self.dynamics.mass
        )

        # === 2. WEIGHT TRANSFER ===
        normal_forces = self.weight_transfer.calculate(
            self.dynamics.accel_long,
            self.dynamics.accel_lat,
            downforce
        )

        # === 3. SUSPENSION ===
        self.suspension.update(normal_forces, dt)

        # === 4. ENGINE ===
        # Calculate engine RPM from average driven wheel speed
        tire_speeds = [t.angular_velocity for t in self.tires]
        driven_speeds = []

        front_ratio, rear_ratio = self.drivetrain.get_split()
        if front_ratio > 0:
            driven_speeds.extend([tire_speeds[0], tire_speeds[1]])
        if rear_ratio > 0:
            driven_speeds.extend([tire_speeds[2], tire_speeds[3]])

        if driven_speeds:
            avg_wheel_speed = sum(driven_speeds) / len(driven_speeds)  # Maintain sign
        else:
            avg_wheel_speed = 0.0

        # Calculate forced engine speed (can be negative if rolling backwards in forward gear)
        forced_engine_rads = avg_wheel_speed * self.transmission.get_total_ratio()
        
        # Engine only spins forward in our model, so we pass abs()
        target_rpm = abs(forced_engine_rads * 60.0 / (2.0 * math.pi))

        # Pass clutch engagement (0.0 if in neutral, so engine can free-rev)
        effective_clutch = self.transmission.clutch if self.transmission.gear != 0 else 0.0
        engine_torque = self.engine.update(throttle, target_rpm, effective_clutch, dt)

        # If the engine is providing braking torque (negative), it must oppose the forced rotation.
        # If forced_engine_rads is negative, the wheels are spinning the engine backwards,
        # so the engine's resistance should be a POSITIVE torque.
        if engine_torque < 0 and forced_engine_rads < 0:
            engine_torque = -engine_torque

        # === 5. TRANSMISSION ===
        self.transmission.update(dt)
        wheel_torque = self.transmission.wheel_torque_from_engine(engine_torque)

        # === 6. DISTRIBUTE TORQUE TO WHEELS ===
        drive_torques = self.drivetrain.distribute(wheel_torque, tire_speeds)

        # === 7. BRAKING ===
        brake_torques = self.brakes.calculate_brake_torques(
            brake, handbrake, tire_speeds, dt
        )

        # === 8. TIRE VELOCITIES (for slip angle calculation) ===
        tire_vels = self.dynamics.get_tire_velocities(steer_angle_rad)

        # === 9. TIRE FORCES ===
        total_fx = 0.0  # Total longitudinal force (car frame)
        total_fy = 0.0  # Total lateral force (car frame)
        total_mz = 0.0  # Total yaw moment

        for i, tire in enumerate(self.tires):
            # Speed of this tire's contact patch along the ground
            vx_tire, vy_tire = tire_vels[i]

            # Calculate tire forces
            tire.calculate_forces(normal_forces[i], vx_tire, vx_tire, vy_tire)

            # Update wheel spin
            tire.update_angular_velocity(drive_torques[i], brake_torques[i], vx_tire, dt)

            # Update tire temperature
            tire.update_temperature(dt, self.dynamics.speed)

            # --- Accumulate Forces ---
            # Longitudinal force (along the tire's heading direction)
            # Lateral force (perpendicular to tire heading)

            if i < 2:
                # Front wheels - steered
                cos_s = math.cos(steer_angle_rad)
                sin_s = math.sin(steer_angle_rad)

                # Transform tire forces back to car frame
                fx_car = tire.force_long * cos_s - tire.force_lat * sin_s
                fy_car = tire.force_long * sin_s + tire.force_lat * cos_s

                total_fx += fx_car
                total_fy += fy_car

                # Yaw moment from front tire forces
                arm_x = self.dynamics.front_axle_to_cog
                arm_y = self.dynamics.track_width * 0.5 * (1 if i == 0 else -1)
                total_mz += fy_car * arm_x + fx_car * arm_y
            else:
                # Rear wheels - not steered
                total_fx += tire.force_long
                total_fy += tire.force_lat

                # Yaw moment from rear tire forces
                arm_x = -self.dynamics.rear_axle_to_cog
                arm_y = self.dynamics.track_width * 0.5 * (1 if i == 2 else -1)
                total_mz += tire.force_lat * arm_x + tire.force_long * arm_y

        # === 10. AERODYNAMIC DRAG & ROLLING RESISTANCE (opposes motion) ===
        speed = math.sqrt(self.dynamics.vx**2 + self.dynamics.vy**2)
        if speed > 0.1:
            # Vector-based drag to prevent infinite sideways speed
            total_drag = drag_force + rolling_resistance
            
            drag_x = total_drag * (self.dynamics.vx / speed)
            drag_y = total_drag * (self.dynamics.vy / speed)
            
            total_fx -= drag_x
            total_fy -= drag_y

        # === 11. INTEGRATE ===
        self.dynamics.integrate(total_fx, total_fy, total_mz, dt)

    def _build_telemetry(self, throttle, steer_angle_deg):
        """
        Package all simulation state into a JSON-ready dictionary.
        """
        # Overall body slip angle (angle between heading and velocity vector)
        if abs(self.dynamics.vx) > 1.0:
            body_slip = math.atan2(self.dynamics.vy, abs(self.dynamics.vx))
        else:
            body_slip = 0.0

        # Per-wheel wheelspin (0 = no spin, 1 = max spin)
        wheelspin_values = []
        for tire in self.tires:
            wheelspin_values.append(max(-1.0, min(1.0, tire.slip_ratio)))

        # Overall wheelspin for smoke effect (average of rear)
        rear_avg_spin = (abs(self.tires[2].slip_ratio) + abs(self.tires[3].slip_ratio)) / 2.0
        # Sign from rear-left
        wheelspin_sign = 1.0 if self.tires[2].angular_velocity >= 0 else -1.0

        # Brake lock detection
        brake_lock = 0.0
        for tire in self.tires:
            if tire.locked:
                brake_lock = max(brake_lock, 1.0)
            elif abs(tire.slip_ratio) > 0.3 and tire.slip_ratio < 0:
                brake_lock = max(brake_lock, abs(tire.slip_ratio))

        self.telemetry = {
            # === Vehicle State (AUTHORITATIVE - JS reads these) ===
            "speed_kph": round(self.dynamics.speed_kph, 1),
            "speed_ms": round(self.dynamics.speed, 2),
            "heading": round(self.dynamics.heading, 4),
            "yaw_rate": round(self.dynamics.yaw_rate, 4),
            "pos_x": round(self.dynamics.pos_x, 2),
            "pos_z": round(self.dynamics.pos_z, 2),
            "vx": round(self.dynamics.vx, 3),
            "vy": round(self.dynamics.vy, 3),

            # === Engine ===
            "rpm": round(self.engine.rpm, 0),
            "engine_hp": round(self.engine.horsepower, 0),
            "engine_torque": round(self.engine.torque_output, 0),
            "engine_load": round(self.engine.load, 0),
            "rev_limiter_active": self.engine.rev_limiter_active,

            # === Transmission ===
            "gear": self.transmission.gear,
            "clutch": round(self.transmission.clutch, 2),
            "is_shifting": self.transmission.is_shifting,

            # === Tires ===
            "tire_temp_fl": round(self.tires[0].temperature, 1),
            "tire_temp_fr": round(self.tires[1].temperature, 1),
            "tire_temp_rl": round(self.tires[2].temperature, 1),
            "tire_temp_rr": round(self.tires[3].temperature, 1),

            "grip_usage_fl": round(self.tires[0].grip_usage * 100, 1),
            "grip_usage_fr": round(self.tires[1].grip_usage * 100, 1),
            "grip_usage_rl": round(self.tires[2].grip_usage * 100, 1),
            "grip_usage_rr": round(self.tires[3].grip_usage * 100, 1),

            "slip_ratio_fl": round(self.tires[0].slip_ratio, 3),
            "slip_ratio_fr": round(self.tires[1].slip_ratio, 3),
            "slip_ratio_rl": round(self.tires[2].slip_ratio, 3),
            "slip_ratio_rr": round(self.tires[3].slip_ratio, 3),

            "slip_angle_fl": round(self.tires[0].slip_angle, 3),
            "slip_angle_fr": round(self.tires[1].slip_angle, 3),
            "slip_angle_rl": round(self.tires[2].slip_angle, 3),
            "slip_angle_rr": round(self.tires[3].slip_angle, 3),

            "wheel_rpm_fl": round(self.tires[0].wheel_rpm, 0),
            "wheel_rpm_fr": round(self.tires[1].wheel_rpm, 0),
            "wheel_rpm_rl": round(self.tires[2].wheel_rpm, 0),
            "wheel_rpm_rr": round(self.tires[3].wheel_rpm, 0),

            "grip_coeff": round(self.tires[0].grip_multiplier, 2),

            # === Brakes ===
            "brake_temp_f": round(self.brakes.temp_front, 0),
            "brake_temp_r": round(self.brakes.temp_rear, 0),
            "abs_active": self.brakes.abs_active,
            "brake_fade": round(self.brakes.fade_factor, 2),
            "brake_lock": round(brake_lock, 2),

            # === Aerodynamics ===
            "aero_downforce": round(self.aero.calculate(self.dynamics.speed, self.dynamics.mass)[1] / 9.81, 0),
            "aero_drag": round(self.aero.calculate(self.dynamics.speed, self.dynamics.mass)[0], 0),

            # === Suspension ===
            "susp_fl": round(self.suspension.travel[0], 3),
            "susp_fr": round(self.suspension.travel[1], 3),
            "susp_rl": round(self.suspension.travel[2], 3),
            "susp_rr": round(self.suspension.travel[3], 3),

            # === G-Forces ===
            "g_long": round(self.weight_transfer.g_long, 3),
            "g_lat": round(self.weight_transfer.g_lat, 3),

            # === Drift / Smoke ===
            "slip_angle": round(body_slip, 4),
            "wheelspin": round(rear_avg_spin * wheelspin_sign, 3),
            "wheelspin_fl": round(wheelspin_values[0], 3),
            "wheelspin_fr": round(wheelspin_values[1], 3),
            "wheelspin_rl": round(wheelspin_values[2], 3),
            "wheelspin_rr": round(wheelspin_values[3], 3),

            # === Thermals & Logistics ===
            "coolant_temp": round(self.thermals.coolant_temp, 0),
            "oil_temp": round(self.thermals.oil_temp, 0),
            "fuel_level": round(self.fuel_level, 2),

            # === Electronics ===
            "tcs_active": False,  # TODO: implement traction control
            "esc_active": False,  # TODO: implement stability control
        }


# ============================================================================
# WEBSOCKET SERVER
# ============================================================================

simulator = ForceVehicleSimulator()

async def telemetry_handler(websocket):
    print("Game connected to Advanced Physics Engine!")
    async for message in websocket:
        try:
            data = json.loads(message)

            # data from JS: { throttle, brake, steering, handbrake, gear, drivetrain }
            state = simulator.update(data)

            await websocket.send(json.dumps(state))
        except Exception as e:
            print(f"Error processing telemetry: {e}")
            import traceback
            traceback.print_exc()

async def main():
    print("=" * 60)
    print("  FORZA-GRADE VEHICLE DYNAMICS ENGINE v1.0")
    print("  Pacejka Tires | Real Weight Transfer | Full Drivetrain")
    print("=" * 60)
    print(f"Starting on ws://localhost:8765")
    async with websockets.serve(telemetry_handler, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
