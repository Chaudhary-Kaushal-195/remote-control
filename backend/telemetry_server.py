import asyncio
import json
import websockets
import math
import time

class AdvancedCarSimulator:
    def __init__(self):
        # 14/15 Sub-systems state (Sound is on frontend)
        self.state = {
            # 1. Engine
            "engine_hp": 0,
            "engine_torque": 0,
            "engine_load": 0,
            # 2. Transmission
            "clutch_slip": 0.0,
            "diff_lock": "Open",
            # 3. Tires
            "tire_temp_fl": 25.0,
            "tire_temp_fr": 25.0,
            "tire_temp_rl": 25.0,
            "tire_temp_rr": 25.0,
            "grip_coeff": 1.0,
            # 4. Suspension (Travel 0.0 - 1.0)
            "susp_fl": 0.5,
            "susp_fr": 0.5,
            "susp_rl": 0.5,
            "susp_rr": 0.5,
            # 5. Weight Transfer (G-Forces)
            "g_long": 0.0,
            "g_lat": 0.0,
            # 7. Brakes
            "brake_temp_f": 30.0,
            "brake_temp_r": 30.0,
            "abs_active": False,
            # 8. Aerodynamics
            "aero_downforce": 0, # kg
            "aero_drag": 0, # N
            # 11. Electronics
            "tcs_active": False,
            "esc_active": False,
            # 15. Advanced Simulation
            "oil_temp": 80.0,
            "coolant_temp": 90.0,
        }
        
        self.last_speed = 0.0
        self.last_time = time.time()
        self.smooth_steering = 0.0

    def update(self, inputs, speed_kph, rpm, gear):
        now = time.time()
        dt = min(now - self.last_time, 0.1)
        self.last_time = now

        speed_ms = speed_kph / 3.6
        throttle = inputs.get("throttle", 0.0)
        brake = inputs.get("brake", 0.0)
        steering = inputs.get("steering", 0.0)

        # 1. Engine Calculations
        max_torque = 450 # Nm
        self.state["engine_torque"] = math.sin(min(rpm / 8000.0, 1.0) * math.pi) * max_torque * throttle
        self.state["engine_hp"] = (self.state["engine_torque"] * rpm) / 5252
        self.state["engine_load"] = throttle * 100.0

        # 5. Weight Transfer (G-Force)
        accel = (speed_ms - self.last_speed) / dt if dt > 0 else 0
        self.last_speed = speed_ms
        self.state["g_long"] = accel / 9.81
        
        self.smooth_steering = self.smooth_steering * 0.8 + steering * 0.2
        self.state["g_lat"] = (speed_ms * speed_ms / max(1.0, 100.0 - abs(self.smooth_steering) * 80)) / 9.81 * (1 if self.smooth_steering > 0 else -1)

        # 4. Suspension (based on G-force)
        # Pitch (Braking dives front, accel squats rear)
        pitch = self.state["g_long"] * 0.3
        # Roll (Turning transfers weight outside)
        roll = self.state["g_lat"] * 0.3

        self.state["susp_fl"] = max(0, min(1, 0.5 - pitch + roll))
        self.state["susp_fr"] = max(0, min(1, 0.5 - pitch - roll))
        self.state["susp_rl"] = max(0, min(1, 0.5 + pitch + roll))
        self.state["susp_rr"] = max(0, min(1, 0.5 + pitch - roll))

        # 3. Tires (Heating up under lateral/longitudinal load)
        load_factor = (abs(self.state["g_long"]) + abs(self.state["g_lat"])) * dt * 2.0
        cooling = dt * 0.5
        self.state["tire_temp_fl"] = max(25.0, self.state["tire_temp_fl"] + load_factor * (1 if roll > 0 else 0.5) - cooling)
        self.state["tire_temp_fr"] = max(25.0, self.state["tire_temp_fr"] + load_factor * (1 if roll < 0 else 0.5) - cooling)
        self.state["tire_temp_rl"] = max(25.0, self.state["tire_temp_rl"] + (load_factor + throttle*0.5) * (1 if roll > 0 else 0.5) - cooling)
        self.state["tire_temp_rr"] = max(25.0, self.state["tire_temp_rr"] + (load_factor + throttle*0.5) * (1 if roll < 0 else 0.5) - cooling)

        # 8. Aerodynamics
        self.state["aero_drag"] = 0.5 * 1.225 * 2.2 * 0.3 * (speed_ms ** 2) # Fd = 1/2 p A Cd v^2
        self.state["aero_downforce"] = 0.5 * 1.225 * 2.2 * 1.5 * (speed_ms ** 2) / 9.81 # kg equivalent

        # 7. Brakes
        brake_heating = brake * speed_ms * dt * 5.0
        self.state["brake_temp_f"] = max(30.0, self.state["brake_temp_f"] + brake_heating * 0.7 - dt * 2.0)
        self.state["brake_temp_r"] = max(30.0, self.state["brake_temp_r"] + brake_heating * 0.3 - dt * 2.0)
        self.state["abs_active"] = brake > 0.8 and speed_kph > 20.0

        # 11. Electronics
        self.state["tcs_active"] = throttle > 0.8 and speed_kph < 60.0 and gear == 1

        # 15. Advanced Sim (Thermals)
        engine_heat = (rpm / 8000.0) * throttle * dt
        self.state["coolant_temp"] = max(90.0, min(120.0, self.state["coolant_temp"] + engine_heat * 0.5 - dt * (speed_kph/200.0)))
        self.state["oil_temp"] = max(80.0, min(140.0, self.state["oil_temp"] + engine_heat * 0.7 - dt * (speed_kph/250.0)))

        return self.state

simulator = AdvancedCarSimulator()

async def telemetry_handler(websocket):
    print("Game connected to Advanced Telemetry Server!")
    async for message in websocket:
        try:
            data = json.loads(message)
            # data looks like: { "throttle": 1.0, "brake": 0.0, "steering": 0.5, "speed": 120, "rpm": 6500, "gear": 3 }
            
            state = simulator.update(
                inputs={"throttle": data.get("throttle", 0), "brake": data.get("brake", 0), "steering": data.get("steering", 0)},
                speed_kph=data.get("speed", 0),
                rpm=data.get("rpm", 800),
                gear=data.get("gear", 1)
            )
            
            await websocket.send(json.dumps(state))
        except Exception as e:
            print(f"Error processing telemetry: {e}")

async def main():
    print("Starting Advanced Telemetry Server on ws://localhost:8765")
    async with websockets.serve(telemetry_handler, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
