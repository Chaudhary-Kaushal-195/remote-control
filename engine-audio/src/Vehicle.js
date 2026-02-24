import { AudioManager } from "./AudioManager.js";
import { Engine } from "./Engine.js";
import { Drivetrain } from "./Drivetrain.js";

export class Vehicle {
    constructor(camera, carMesh) {
        this.camera = camera;
        this.carMesh = carMesh;
        this.audio = new AudioManager(camera, carMesh);

        this.engine = new Engine();
        this.drivetrain = new Drivetrain();

        this.mass = 500;

        this.velocity = 0;
        this.wheel_rpm = 0;
        this.wheel_omega = 0;
        this.wheel_radius = 0.250;
    }

    async init(configuration) {
        if (this.audio)
            this.audio.dispose();

        this.engine.init(configuration.engine);
        this.drivetrain.init(configuration.drivetrain);

        this.audio = new AudioManager(this.camera, this.carMesh);

        await this.audio.init(configuration.sounds);
    }

    update(time, dt) {

        /* Simulation loop */
        const subSteps = 20;
        const h = dt / subSteps;

        // Apply real vehicle load inertia so the car's weight affects engine rev speed accurately
        const I = this.getLoadInertia();

        for (let i = 0; i < subSteps; i++) {

            this.engine.integrate(I, time + dt * i, h);
            this.drivetrain.integrate(h);

            this.engine.solvePos(this.drivetrain, h);
            this.drivetrain.solvePos(this.engine, h);

            this.engine.update(h);
            this.drivetrain.update(h);

            this.engine.solveVel(this.drivetrain, h);
            this.drivetrain.solveVel(this.engine, h);
        }

        // if (this.drivetrain.gear > 0) {
        //     this.velocity += (this.drivetrain.omega / this.drivetrain.getTotalGearRatio()) * this.wheel_radius * dt;
        // }
        // We calculate instantaneous velocity from omega, fixing reverse gear calculation as well.
        if (Math.abs(this.drivetrain.getGearRatio()) > 0) {
            this.velocity = (this.drivetrain.omega / this.drivetrain.getTotalGearRatio()) * this.wheel_radius;
        } else {
            this.velocity *= 0.99; // Coasting
        }

        if (this.audio.ctx)
            this.engine.applySounds(this.audio.samples, this.drivetrain.getGearRatio());
    }

    getLoadInertia() {
        if (this.drivetrain.gear === 0)
            return 0;

        const gearRatio = this.drivetrain.getGearRatio();
        const totalGearRatio = this.drivetrain.getTotalGearRatio();

        /* Moment of inertia - I = mr^2 */
        const I_veh = this.mass * Math.pow(this.wheel_radius, 2);
        const I_wheels = 4 * 12.0 * Math.pow(this.wheel_radius, 2);

        /* Adjust inertia for gear ratio */
        const I1 = I_veh / Math.pow(totalGearRatio, 2);
        const I2 = I_wheels / Math.pow(totalGearRatio, 2);
        const I3 = this.drivetrain.inertia / Math.pow(gearRatio, 2);
        const I = I1 + I2 + I3;

        return I;
    }
}
