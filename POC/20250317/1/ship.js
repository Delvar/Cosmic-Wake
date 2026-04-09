// ship.js

import { Vector2D } from './vector2d.js';
import { Trail } from './trail.js';
import { Colour } from './colour.js';
import { GameObject } from './gameObject.js';
import { JumpGate } from './celestialBody.js';

/**
 * Represents a ship in the game, capable of movement, targeting, and hyperjumping between star systems.
 * Extends the base GameObject class.
 */
export class Ship extends GameObject {
    /**
     * Creates a new Ship instance.
     * @param {number} x - The initial x-coordinate of the ship.
     * @param {number} y - The initial y-coordinate of the ship.
     * @param {Object} starSystem - The star system the ship is initially in.
     * @param {Colour} [color=new Colour(1, 1, 1)] - The color of the ship (default is white).
     * @param {Colour} [trailColor=new Colour(1, 1, 1, 0.5)] - The color of the ship's trail (default is semi-transparent white).
     */
    constructor(x, y, starSystem, color = new Colour(1, 1, 1), trailColor = new Colour(1, 1, 1, 0.5)) {
        super(new Vector2D(x, y), starSystem);

        this.rotationSpeed = Math.PI * 0.25; // Rotation speed in radians per second, 2 * PI = turn 360 in 1 second
        this.thrust = 250; // Thrust force applied when moving forward in units per second per second
        this.maxVelocity = 500; // Maximum velocity in units per second
        //this.drag = 0.1; // Drag coefficient for slowing down
        //this.brakeDrag = 0.5; // Increased drag when braking

        this.velocity = new Vector2D(0, 0); // Initial velocity
        this.angle = 0; // Current angle of the ship in radians
        this.targetAngle = 0; // Target angle for rotation
        this.isThrusting = false; // Whether the ship is currently thrusting
        this.isBraking = false; // Whether the ship is currently braking
        this.hyperdriveReady = true; // Whether the hyperdrive is ready for use
        this.hyperdriveCooldown = 5000; // Cooldown time in milliseconds for hyperdrive
        this.lastJumpTime = 0; // Timestamp of the last hyperjump
        this.trail = new Trail(this, 250, 2, trailColor.toRGBA()); // Trail object for visual effect
        this.color = color; // Ship's color
        this.target = null; // Current target (e.g., a celestial body or another ship)
    }

    /**
     * Sets the ship's target.
     * @param {Object} target - The target to set (e.g., a celestial body or ship).
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * Clears the ship's current target.
     */
    clearTarget() {
        this.target = null;
    }

    /**
     * Sets the target angle for the ship to rotate towards.
     * @param {number} angle - The target angle in radians.
     */
    setTargetAngle(angle) {
        this.targetAngle = angle;
    }

    /**
     * Applies or stops thrust to the ship.
     * @param {boolean} thrusting - Whether to apply thrust (true) or stop (false).
     */
    applyThrust(thrusting) {
        this.isThrusting = thrusting;
    }

    /**
     * Applies or stops braking to the ship.
     * @param {boolean} braking - Whether to apply brakes (true) or stop (false).
     */
    applyBrakes(braking) {
        this.isBraking = braking;
    }

    /**
     * Updates the ship's position, velocity, and rotation based on the elapsed time.
     * @param {number} deltaTime - The time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        const angleDiff = (this.targetAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * deltaTime), this.rotationSpeed * deltaTime);
        this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;

        if (this.isThrusting) {
            const thrustVector = new Vector2D(Math.cos(this.angle), Math.sin(this.angle))
                .multiply(this.thrust * deltaTime);
            this.velocity = this.velocity.add(thrustVector);
        } else if (this.isBraking) {
            //const drag = this.brakeDrag;
            //this.velocity = this.velocity.subtract(this.velocity.multiply(drag * deltaTime));
            const velAngle = Math.atan2(-this.velocity.y, -this.velocity.x);
            const brakeAngleDiff = (velAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle += brakeAngleDiff * this.rotationSpeed * deltaTime;
            this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
        } //else {
          //  const drag = this.drag;
           // this.velocity = this.velocity.subtract(this.velocity.multiply(drag * deltaTime));
        //}

        const speedSquared = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
        if (speedSquared > this.maxVelocity * this.maxVelocity) {
            const scale = this.maxVelocity / Math.sqrt(speedSquared);
            this.velocity = this.velocity.multiply(scale);
        }

        this.position = this.position.add(this.velocity.multiply(deltaTime));

        this.trail.update(deltaTime);
    }

    /**
     * Initiates a hyperjump to another star system via a jump gate.
     * @param {Object} targetSystem - The target star system to jump to.
     * @param {number} currentTime - The current time in milliseconds.
     * @returns {boolean} True if the jump was successful, false otherwise.
     */
    initiateHyperjump(targetSystem, currentTime) {
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) {
            return false;
        }
        this.lastJumpTime = currentTime;
        this.hyperdriveReady = false;
        const oldSystem = this.starSystem;
        this.starSystem = targetSystem;
        const targetGate = targetSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.lane.target === oldSystem
        );
        this.position = targetGate ? new Vector2D(targetGate.position.x, targetGate.position.y) : new Vector2D(0, 0);
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.targetAngle = 0;
        this.trail.points = [];
        this.clearTarget();
        setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
        return true;
    }

    /**
     * Draws the ship and its trail on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     */
    draw(ctx, camera) {
        ctx.save();
        this.trail.draw(ctx, camera);
        const screenPos = camera.worldToScreen(this.position);
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color.toRGB();
        ctx.beginPath();
        const scale = camera.zoom;
        ctx.moveTo(15 * scale, 0);
        ctx.lineTo(-10 * scale, 10 * scale);
        ctx.lineTo(-10 * scale, -10 * scale);
        ctx.closePath();
        ctx.fill();

        if (this.isThrusting) {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            ctx.beginPath();
            ctx.moveTo(-15 * scale, 0);
            ctx.lineTo(-10 * scale, 5 * scale);
            ctx.lineTo(-10 * scale, -5 * scale);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}