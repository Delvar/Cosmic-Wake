// ship.js

import { Vector2D } from './vector2d.js';
import { Trail } from './trail.js';
import { Colour } from './colour.js';
import { GameObject } from './gameObject.js';
import { JumpGate } from './celestialBody.js';
import { AIPilot } from './pilot.js';

/**
 * Represents a ship in the game, capable of movement, targeting, and hyperjumping between star systems.
 * Extends the base GameObject class.
 */
export class Ship extends GameObject {
    /**
     * Creates a new Ship instance.
     * @param {number} x - The initial x-coordinate of the ship.
     * @param {number} y - The initial y-coordinate of the ship.
     * @param {StarSystem} starSystem - The star system the ship is initially in.
     * @param {Colour} [color=new Colour(1, 1, 1)] - The color of the ship (default is white).
     * @param {Colour} [trailColor=new Colour(1, 1, 1, 0.5)] - The color of the ship's trail (default is semi-transparent white).
     */
    constructor(x, y, starSystem, color = new Colour(1, 1, 1), trailColor = new Colour(1, 1, 1, 0.5)) {
        super(new Vector2D(x, y), starSystem);
        this.rotationSpeed = Math.PI * 1;
        this.thrust = 250;
        this.maxVelocity = 500;
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.targetAngle = 0;
        this.isThrusting = false;
        this.isBraking = false;
        this.hyperdriveReady = true;
        this.hyperdriveCooldown = 5000;
        this.lastJumpTime = 0;
        this.trail = new Trail(this, 250, 2, trailColor.toRGBA());
        this.color = color;
        this.target = null;
        // New animation properties
        this.state = 'Flying'; // 'Flying', 'Landing', 'Landed', 'TakingOff'
        this.shipScale = 1; // Custom scale for animation
        this.stretchFactor = 1; // New: For stretching during jump
        this.animationTime = 0;
        this.animationDuration = 2; // 2 seconds
        this.targetPlanet = null; // Planet being landed on
        this.landingStartPosition = null;
        this.jumpGate = null; // Track gate during jump
        this.jumpStartPosition = null; // For JumpingOut
        this.jumpEndPosition = null; // For JumpingIn
        this.jumpStartAngle = null; // Store initial angle for jump
    }

    /**
     * Sets the ship's target.
     * @param {GameObject} target - The target to set (e.g., a celestial body or ship).
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

    // Check if the ship can land
    canLand(targetPlanet) {
        const LANDING_SPEED = 5;
        if (!targetPlanet || !targetPlanet.position || this.state !== 'Flying') {
            return false;
        }
        const distanceToPlanetCenter = this.position.subtract(targetPlanet.position).magnitude();
        const currentSpeed = this.velocity.magnitude();
        return distanceToPlanetCenter <= targetPlanet.radius && currentSpeed <= LANDING_SPEED;
    }

    // Initiate landing if conditions are met
    initiateLanding(targetPlanet) {
        if (this.canLand(targetPlanet)) {
            this.state = 'Landing';
            this.animationTime = 0;
            this.targetPlanet = targetPlanet;
            this.landingStartPosition = this.position.clone();
            this.velocity = new Vector2D(0, 0);
            this.isThrusting = false;
            this.isBraking = false;
            return true;
        }
        return false;
    }

    initiateTakeoff() {
        if (this.state === 'Landed' && this.targetPlanet) {
            this.state = 'TakingOff';
            this.animationTime = 0;
            this.angle = this.targetAngle; // Align ship to targetAngle
            this.targetPlanet.removeLandedShip(this);
            return true;
        }
        return false;
    }


    /**
     * Updates the ship's position, velocity, and rotation based on the elapsed time.
     * @param {number} deltaTime - The time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (this.state === 'JumpingOut') {
            this.animationTime += deltaTime;
            const t = Math.min(this.animationTime / this.animationDuration, 1);

            if (t < 0.5) {
                // Phase 1: Shrink to 25% at gate center, interpolate angle to radial outward
                this.shipScale = 1 - (t * 1.5); // 1 to 0.25
                this.position = this.jumpStartPosition.lerp(this.jumpGate.position, t * 2);
                const radialOut = this.jumpGate.position.normalize();
                const desiredAngle = Math.atan2(radialOut.y, radialOut.x);
                const startAngle = this.jumpStartAngle || this.angle; // Store initial angle at jump start
                if (!this.jumpStartAngle) this.jumpStartAngle = this.angle; // Set once
                const angleDiff = (desiredAngle - startAngle + Math.PI) % (2 * Math.PI) - Math.PI;
                this.angle = startAngle + angleDiff * (t * 2); // Linearly interpolate over 0.5s
                this.targetAngle = this.angle; // Keep in sync
                this.stretchFactor = 1;
            } else {
                // Phase 2: Stretch and speed off radially outward
                const speedT = (t - 0.5) * 2; // 0 to 1 over second half
                this.shipScale = 0.25;
                this.stretchFactor = 1 + speedT * 9; // Up to 10x
                const radialOut = this.jumpGate.position.normalize();
                this.position = this.jumpGate.position.add(radialOut.multiply(5000 * speedT));
                this.velocity = radialOut.multiply(2000);
            }

            if (t >= 1) {
                const oldSystem = this.starSystem;
                this.starSystem = this.jumpGate.lane.target;
                const radialIn = this.jumpGate.lane.targetGate.position.normalize().multiply(-1);
                this.position = this.jumpGate.lane.targetGate.position.subtract(radialIn.multiply(5000));
                this.state = 'JumpingIn';
                this.animationTime = 0;
                this.jumpEndPosition = this.jumpGate.lane.targetGate.position.clone();
                this.velocity = radialIn.multiply(2000);
                this.trail.points = [];
                this.jumpStartAngle = null; // Reset for next jump
                oldSystem.ships = oldSystem.ships.filter(ship => ship !== this);
                this.starSystem.ships.push(this);
            }
            this.trail.update(deltaTime);
            return;
        } else if (this.state === 'JumpingIn') {
            this.animationTime += deltaTime;
            const t = Math.min(this.animationTime / this.animationDuration, 1);

            if (t < 0.5) {
                this.shipScale = 0.25;
                this.stretchFactor = 10 - t * 18;
                const radialIn = this.jumpEndPosition.normalize().multiply(-1);
                const outsidePos = this.jumpEndPosition.subtract(radialIn.multiply(5000));
                this.position = outsidePos.lerp(this.jumpEndPosition, t * 2);
                const desiredAngle = Math.atan2(radialIn.y, radialIn.x);
                const startAngle = this.jumpStartAngle || this.angle; // Use angle from jump start
                if (!this.jumpStartAngle) this.jumpStartAngle = this.angle;
                const angleDiff = (desiredAngle - startAngle + Math.PI) % (2 * Math.PI) - Math.PI;
                this.angle = startAngle + angleDiff * (t * 2);
                this.targetAngle = this.angle;
                this.velocity = radialIn.multiply(2000);
            } else {
                this.shipScale = 0.25 + (t - 0.5) * 1.5;
                this.stretchFactor = 1;
                this.position = this.jumpEndPosition;
                this.velocity = new Vector2D(0, 0);
            }

            if (t >= 1) {
                this.state = 'Flying';
                this.animationTime = 0;
                this.shipScale = 1;
                this.stretchFactor = 1;
                this.jumpGate = null;
                this.jumpStartPosition = null;
                this.jumpEndPosition = null;
                this.jumpStartAngle = null; // Reset for next jump
                this.hyperdriveReady = false;
                setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
            }
            this.trail.update(deltaTime);
            return;
        }

        if (this.state === 'Landing') {
            this.animationTime += deltaTime;
            const t = Math.min(this.animationTime / this.animationDuration, 1);
            this.shipScale = 1 - t;
            this.position = this.landingStartPosition.lerp(this.targetPlanet.position, t);

            if (t >= 1) {
                this.state = 'Landed';
                this.animationTime = 0;
                this.shipScale = 0;
                this.targetPlanet.addLandedShip(this);
            }
            this.trail.update(deltaTime);
            return;
        } else if (this.state === 'Landed') {
            this.trail.update(deltaTime);
            return;
        } else if (this.state === 'TakingOff') {
            this.animationTime += deltaTime;
            const t = Math.min(this.animationTime / this.animationDuration, 1);
            this.shipScale = t;
            const takeoffOffset = new Vector2D(Math.cos(this.angle), Math.sin(this.angle)).multiply(this.targetPlanet.radius * 1.5);
            this.position = this.targetPlanet.position.add(takeoffOffset.multiply(t));

            if (t >= 1) {
                this.state = 'Flying';
                this.animationTime = 0;
                this.shipScale = 1;
                this.targetPlanet = null;
                this.velocity = takeoffOffset.divide(this.animationDuration);
            }
            this.trail.update(deltaTime);
            return;
        }
        const angleDiff = (this.targetAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * deltaTime), this.rotationSpeed * deltaTime);
        this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;

        if (this.isThrusting) {
            const thrustVector = new Vector2D(Math.cos(this.angle), Math.sin(this.angle))
                .multiply(this.thrust * deltaTime);
            this.velocity = this.velocity.add(thrustVector);
        } else if (this.isBraking) {
            const velAngle = Math.atan2(-this.velocity.y, -this.velocity.x);
            const brakeAngleDiff = (velAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle += brakeAngleDiff * this.rotationSpeed * deltaTime;
            this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
        }

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
     * @returns {boolean} True if the jump was successful, false otherwise.
     */
    initiateHyperjump() {
        const currentTime = performance.now();
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) {
            return false;
        }
        const gate = this.starSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.overlapsShip(this.position)
        );
        if (!gate) return false;

        this.state = 'JumpingOut';
        this.animationTime = 0;
        this.jumpGate = gate;
        this.jumpStartPosition = this.position.clone();
        this.lastJumpTime = currentTime; // Set early to prevent re-trigger
        this.isThrusting = false;
        this.isBraking = false;
        return true;
    }

    /**
    * Draws the ship, its trail, and debug indicators on the canvas.
    * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
    * @param {Camera} camera - The camera object handling coordinate transformations.
    */
    draw(ctx, camera) {
        if (this.state === 'Landed') {
            return;
        }

        ctx.save();
        this.trail.draw(ctx, camera);
        const screenPos = camera.worldToScreen(this.position);
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.angle);

        // Apply custom scale
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale * this.stretchFactor, scale);

        ctx.fillStyle = this.color.toRGB();
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.fill();

        if ((this.isThrusting && this.state === 'Flying') || this.state === 'Landing' || this.state === 'TakingOff') {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(-10, 5);
            ctx.lineTo(-10, -5);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // Debug indicators (only if this.debug is true)
        if (this.debug && camera.debug) {
            // 1. Velocity Vector (blue line from ship position in world coordinates)
            const velocityScale = 1; // Adjust scale for visibility
            const velocityEnd = this.position.add(this.velocity.multiply(velocityScale));
            const velocityStartScreen = camera.worldToScreen(this.position);
            const velocityEndScreen = camera.worldToScreen(velocityEnd);
            ctx.strokeStyle = 'red';
            ctx.beginPath();
            ctx.moveTo(velocityStartScreen.x, velocityStartScreen.y);
            ctx.lineTo(velocityEndScreen.x, velocityEndScreen.y);
            ctx.stroke();

            // 2. Target Angle Arc (arc from current angle to target angle, starting from ship front)
            ctx.save();
            ctx.translate(screenPos.x, screenPos.y);
            ctx.rotate(this.angle); // Apply rotation only for the arc
            const angleDiff = (this.targetAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            const startAngle = 0; // Start at the front of the ship
            const endAngle = angleDiff;
            ctx.fillStyle = 'rgba(255,0,255,0.25)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 30 * scale, startAngle, endAngle, angleDiff < 0); // Radius = ship length
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // 3. AIPilot State (static text below the ship in screen coordinates)
            if (this.pilot && this.pilot instanceof AIPilot) {
                const state = this.pilot.currentState;
                ctx.fillStyle = 'white';
                ctx.font = `${10 * scale}px Arial`;
                const textMetrics = ctx.measureText(state);
                const textX = screenPos.x - textMetrics.width / 2; // Center horizontally
                const textY = screenPos.y + 20 * scale; // Below the ship
                ctx.fillText(state, textX, textY);
            }

            // 4. Stopping Distance (vector along velocity ending in a green circle)
            if (this.pilot && this.pilot instanceof AIPilot) {
                const decelerationDistance = this.pilot.decelerationDistance;
                const farApproachDistance = this.pilot.farApproachDistance;
                const closeApproachDistance = this.pilot.closeApproachDistance;
                const currentSpeed = this.velocity.magnitude(); // Calculate currentSpeed here
                const stoppingPoint = this.position.add(
                    currentSpeed > 0 ? this.velocity.normalize().multiply(decelerationDistance) : new Vector2D(0, 0)
                );
                const stoppingScreen = camera.worldToScreen(stoppingPoint);
                const originScreen = camera.worldToScreen(this.position);

                // Draw line along velocity
                ctx.strokeStyle = 'gray';
                ctx.beginPath();
                ctx.moveTo(originScreen.x, originScreen.y);
                ctx.lineTo(stoppingScreen.x, stoppingScreen.y);
                ctx.stroke();

                // Draw green circle at stopping point
                ctx.fillStyle = 'green';
                ctx.beginPath();
                ctx.arc(stoppingScreen.x, stoppingScreen.y, 5 * scale, 0, 2 * Math.PI);
                ctx.fill();

                if (this.target) {
                    const targetScreen = camera.worldToScreen(this.target.position);
                    if (farApproachDistance > 0) {
                        // Draw giant green circle around the target
                        ctx.beginPath();
                        ctx.fillStyle = 'rgba(0,255,0,0.1)';
                        ctx.arc(targetScreen.x, targetScreen.y, farApproachDistance * scale, 0, 2 * Math.PI, false);
                        if (closeApproachDistance > 0) {
                            // cut out the inner circle to fill in later
                            ctx.arc(targetScreen.x, targetScreen.y, closeApproachDistance * scale, 0, 2 * Math.PI, true);
                        }
                        ctx.fill();
                        if (closeApproachDistance > 0) {
                            // Draw giant orange circle around the target
                            ctx.beginPath();
                            ctx.fillStyle = 'rgba(255,255,0,0.2)';
                            ctx.arc(targetScreen.x, targetScreen.y, closeApproachDistance * scale, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }

                }
            }
            // 5. Velocity error
            if (this.pilot && this.pilot instanceof AIPilot) {
                const stoppingPoint = this.position.add(this.pilot.velocityError);
                const stoppingScreen = camera.worldToScreen(stoppingPoint);
                const originScreen = camera.worldToScreen(this.position);

                // Draw line along velocity
                ctx.strokeStyle = 'purple';
                ctx.beginPath();
                ctx.moveTo(originScreen.x, originScreen.y);
                ctx.lineTo(stoppingScreen.x, stoppingScreen.y);
                ctx.stroke();
            }
        }
    }
}