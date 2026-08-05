import sys
sys.path.insert(0, '.')
from backend.telemetry_server import ForceVehicleSimulator
import time

sim = ForceVehicleSimulator()
print(f"Simulator created: {len(sim.tires)} tires, engine idle={sim.engine.idle_rpm}rpm")

# Simulate 10 ticks of full throttle in 1st gear
for i in range(10):
    time.sleep(0.016)  # ~60fps
    result = sim.update({
        'throttle': 1.0, 'brake': 0.0, 'steering': 0.0,
        'handbrake': 0.0, 'gear': 1, 'drivetrain': 'rwd'
    })

print(f"After 10 ticks: speed={result['speed_kph']}kph, rpm={result['rpm']}, gear={result['gear']}")
print(f"Tire temps: FL={result['tire_temp_fl']} FR={result['tire_temp_fr']} RL={result['tire_temp_rl']} RR={result['tire_temp_rr']}")
print(f"G-forces: long={result['g_long']} lat={result['g_lat']}")
print(f"Wheelspin: {result['wheelspin']}")
print(f"Slip angle: {result['slip_angle']}")
print(f"Engine: {result['engine_hp']}hp, {result['engine_torque']}Nm")
print("ALL SYSTEMS GO!")
