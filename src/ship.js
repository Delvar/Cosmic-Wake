// ship.js

import { Vector2D } from './vector2d.js';
import { Trail } from './trail.js';
import { Colour } from './colour.js';
import { GameObject } from './gameObject.js';
import { JumpGate } from './celestialBody.js';
import { AIPilot } from './pilot.js';

/**
 * Represents a ship in the game with a state machine for movement and interactions.
 * Extends GameObject to inherit position and star system properties.
 * @extends GameObject
 */
export class Ship extends GameObject {
    /**
        * Creates a new Ship instance.
        * @param {number} x - Initial x-coordinate in world space.
        * @param {number} y - Initial y-coordinate in world space.
        * @param {StarSystem} starSystem - The star system this ship belongs to.
        * @param {Colour} [color=new Colour(1, 1, 1)] - Ship color (default: white).
        * @param {Colour} [trailColor=new Colour(1, 1, 1, 0.5)] - Trail color (default: semi-transparent white).
        */
    constructor(x, y, starSystem, color = new Colour(1, 1, 1), trailColor = new Colour(1, 1, 1, 0.5)) {
        super(new Vector2D(x, y), starSystem);

        // Physics properties
        /** @type {number} Rotation speed in radians per second */
        this.rotationSpeed = Math.PI * 1;
        /** @type {number} Thrust acceleration in world units per second squared */
        this.thrust = 250;
        /** @type {number} Maximum velocity in world units per second */
        this.maxVelocity = 500;
        /** @type {Vector2D} Current velocity vector */
        this.velocity = new Vector2D(0, 0);
        /** @type {number} Current angle in radians */
        this.angle = 0;
        /** @type {number} Target angle for rotation in radians */
        this.targetAngle = 0;

        // Control flags
        /** @type {boolean} Whether the ship is currently thrusting */
        this.isThrusting = false;
        /** @type {boolean} Whether the ship is currently braking */
        this.isBraking = false;

        // Hyperdrive properties
        /** @type {boolean} Whether the hyperdrive is ready to use */
        this.hyperdriveReady = true;
        /** @type {number} Cooldown time in milliseconds between hyperjumps */
        this.hyperdriveCooldown = 5000;
        /** @type {number} Timestamp of the last hyperjump in milliseconds */
        this.lastJumpTime = 0;

        // Visual properties
        /** @type {Trail} Trail effect following the ship */
        this.trail = new Trail(this, 250, 2, trailColor.toRGBA());
        /** @type {Colour} Color of the ship */
        this.color = color;

        // Targeting
        /** @type {GameObject|null} General navigation target (planet, gate, ship, etc.) */
        this.target = null;
        /** @type {CelestialBody|null} Planet the ship is currently landed on or landing on/taking off from */
        this.landedPlanet = null;

        // State machine properties
        /** @type {string} Current state: 'Flying', 'Landing', 'Landed', 'TakingOff', 'JumpingOut', 'JumpingIn' */
        this.state = 'Flying';
        /** @type {Object<string, Function>} Map of state names to update handlers */
        this.stateHandlers = {
            'Flying': this.updateFlying.bind(this),
            'Landing': this.updateLanding.bind(this),
            'Landed': this.updateLanded.bind(this),
            'TakingOff': this.updateTakingOff.bind(this),
            'JumpingOut': this.updateJumpingOut.bind(this),
            'JumpingIn': this.updateJumpingIn.bind(this)
        };

        // Animation properties
        /** @type {number} Current scale factor for rendering (0 to 1) */
        this.shipScale = 1;
        /** @type {number} Stretch factor for hyperjump animation (1 to 10) */
        this.stretchFactor = 1;
        /** @type {number} Time elapsed in current animation in seconds */
        this.animationTime = 0;
        /** @type {number} Duration of animations in seconds */
        this.animationDuration = 2;
        /** @type {Vector2D|null} Starting position for landing animation */
        this.landingStartPosition = null;
        /** @type {JumpGate|null} Jump gate used for hyperjump */
        this.jumpGate = null;
        /** @type {Vector2D|null} Starting position for jumping out */
        this.jumpStartPosition = null;
        /** @type {Vector2D|null} Ending position for jumping in */
        this.jumpEndPosition = null;
        /** @type {number|null} Initial angle for hyperjump animation */
        this.jumpStartAngle = null;
    }

    /**
     * Transitions the ship to a new state, resetting animation time.
     * @param {string} newState - The new state to transition to.
     */
    setState(newState) {
        if (!this.stateHandlers[newState]) {
            console.warn(`Invalid state transition attempted: ${newState}`);
            return;
        }
        this.state = newState;
        this.animationTime = 0; // Reset animation timer for new state
    }

    /**
     * Sets the general navigation target for the ship.
     * @param {GameObject} target - The target object (e.g., planet, gate, ship).
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * Clears the current navigation target.
     */
    clearTarget() {
        this.target = null;
    }

    /**
     * Sets the target angle for the ship to rotate towards.
     * @param {number} angle - Target angle in radians.
     */
    setTargetAngle(angle) {
        this.targetAngle = angle;
    }

    /**
     * Toggles thrust application.
     * @param {boolean} thrusting - True to apply thrust, false to stop.
     */
    applyThrust(thrusting) {
        this.isThrusting = thrusting;
    }

    /**
     * Toggles brake application.
     * @param {boolean} braking - True to apply brakes, false to stop.
     */
    applyBrakes(braking) {
        this.isBraking = braking;
    }

    /**
     * Checks if the ship can land on a given planet.
     * @param {CelestialBody} planet - The planet to check landing feasibility for.
     * @returns {boolean} True if landing is possible, false otherwise.
     */
    canLand(planet) {
        const LANDING_SPEED = 5; // Max speed for safe landing
        if (!planet || !planet.position || this.state !== 'Flying') return false;
        const distanceToPlanetCenter = this.position.subtract(planet.position).magnitude();
        const currentSpeed = this.velocity.magnitude();
        return distanceToPlanetCenter <= planet.radius && currentSpeed <= LANDING_SPEED;
    }

    /**
     * Initiates landing on a planet if conditions are met.
     * @param {CelestialBody} planet - The planet to land on.
     * @returns {boolean} True if landing initiated, false otherwise.
     */
    initiateLanding(planet) {
        if (this.canLand(planet)) {
            this.setState('Landing');
            this.landedPlanet = planet; // Set the planet we're landing on
            this.landingStartPosition = this.position.clone();
            this.velocity = new Vector2D(0, 0); // Stop movement
            this.isThrusting = false;
            this.isBraking = false;
            return true;
        }
        return false;
    }

    /**
     * Initiates takeoff from a landed state.
     * @returns {boolean} True if takeoff initiated, false otherwise.
     */
    initiateTakeoff() {
        if (this.state === 'Landed' && this.landedPlanet) {
            this.setState('TakingOff');
            this.angle = this.targetAngle; // Align to target angle
            this.landedPlanet.removeLandedShip(this);
            return true;
        }
        return false;
    }

    /**
     * Initiates a hyperjump through a nearby jump gate.
     * @returns {boolean} True if hyperjump initiated, false otherwise.
     */
    initiateHyperjump() {
        const currentTime = performance.now();
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) return false;
        const gate = this.starSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.overlapsShip(this.position)
        );
        if (!gate) return false;

        this.setState('JumpingOut');
        this.jumpGate = gate;
        this.jumpStartPosition = this.position.clone();
        this.lastJumpTime = currentTime;
        this.isThrusting = false;
        this.isBraking = false;
        return true;
    }

    /**
     * Updates the ship's state and position based on elapsed time.
     * Delegates to the appropriate state handler.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     */
    update(deltaTime) {
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime); // Update position, velocity, and state first
        } else {
            console.warn(`No handler for state: ${this.state}`); // Warn on invalid state
        }
        this.trail.update(deltaTime); // Update trail after position is finalized to keep it attached
    }

    /**
     * Updates the ship in the 'Flying' state, handling rotation and movement.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     */
    updateFlying(deltaTime) {
        // Smoothly rotate towards target angle
        const angleDiff = (this.targetAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * deltaTime), this.rotationSpeed * deltaTime);
        this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;

        if (this.isThrusting) {
            const thrustVector = new Vector2D(Math.cos(this.angle), Math.sin(this.angle)).multiply(this.thrust * deltaTime);
            this.velocity = this.velocity.add(thrustVector);
        } else if (this.isBraking) {
            // Rotate to oppose velocity and slow down
            const velAngle = Math.atan2(-this.velocity.y, -this.velocity.x);
            const brakeAngleDiff = (velAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle += brakeAngleDiff * this.rotationSpeed * deltaTime;
            this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
        }

        // Cap velocity at maxVelocity
        const speedSquared = this.velocity.squareMagnitude();
        if (speedSquared > this.maxVelocity * this.maxVelocity) {
            const scale = this.maxVelocity / Math.sqrt(speedSquared);
            this.velocity = this.velocity.multiply(scale);
        }

        this.position = this.position.add(this.velocity.multiply(deltaTime));
    }

    /**
     * Updates the ship in the 'Landing' state, animating it to the planet's center.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     */
    updateLanding(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);
        this.shipScale = 1 - t; // Shrink to 0
        this.position = this.landingStartPosition.lerp(this.landedPlanet.position, t);

        if (t >= 1) {
            this.setState('Landed');
            this.shipScale = 0; // Fully invisible
            this.landedPlanet.addLandedShip(this); // Register with planet
        }
    }

    /**
     * Updates the ship in the 'Landed' state (no movement).
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     */
    updateLanded(deltaTime) {
        // No movement or animation; ship is stationary on the planet
    }

    /**
     * Updates the ship in the 'TakingOff' state, animating it away from the planet.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     */
    updateTakingOff(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);
        this.shipScale = t; // Grow from 0 to 1
        const takeoffOffset = new Vector2D(Math.cos(this.angle), Math.sin(this.angle)).multiply(this.landedPlanet.radius * 1.5);
        this.position = this.landedPlanet.position.add(takeoffOffset.multiply(t));

        if (t >= 1) {
            this.setState('Flying');
            this.shipScale = 1;
            this.velocity = takeoffOffset.divide(this.animationDuration); // Initial velocity
            this.landedPlanet = null; // Clear landing planet reference
        }
    }

    /**
     * Updates the ship in the 'JumpingOut' state, animating the exit through a jump gate.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     */
    updateJumpingOut(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);

        if (t < 0.5) {
            // Phase 1: Shrink and move to gate center
            this.shipScale = 1 - (t * 1.5); // 1 to 0.25
            this.position = this.jumpStartPosition.lerp(this.jumpGate.position, t * 2);
            const radialOut = this.jumpGate.position.normalize();
            const desiredAngle = Math.atan2(radialOut.y, radialOut.x);
            const startAngle = this.jumpStartAngle || this.angle;
            if (!this.jumpStartAngle) this.jumpStartAngle = this.angle; // Capture initial angle
            const angleDiff = (desiredAngle - startAngle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle = startAngle + angleDiff * (t * 2);
            this.targetAngle = this.angle;
            this.stretchFactor = 1;
        } else {
            // Phase 2: Stretch and accelerate outward with quadratic easing
            this.shipScale = 0.25;
            const easedT = (t - 0.5) * 2; // Normalize to 0-1 for this phase
            const progress = easedT * easedT; // Quadratic ease-in: slow start, fast end
            this.stretchFactor = 1 + progress * 9; // 1 to 10
            const radialOut = this.jumpGate.position.normalize();
            const maxDistance = 5000; // Max distance outward
            this.position = this.jumpGate.position.add(radialOut.multiply(maxDistance * progress));
            this.velocity = radialOut.multiply(2000 * easedT); // Velocity ramps up
        }

        if (t >= 1) {
            // Transition to new system and JumpingIn state
            const oldSystem = this.starSystem;
            this.starSystem = this.jumpGate.lane.target;
            const radialIn = this.jumpGate.lane.targetGate.position.normalize().multiply(-1);
            this.jumpEndPosition = this.jumpGate.lane.targetGate.position.clone(); // Set the end position
            this.position = this.jumpEndPosition.subtract(radialIn.multiply(5000)); // Start outside the target gate
            this.setState('JumpingIn');
            this.velocity = radialIn.multiply(2000); // Initial velocity for JumpingIn
            this.trail.points = []; // Clear trail for new system
            this.jumpStartAngle = null;
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this);
            this.starSystem.ships.push(this);
        }
    }

    /**
     * Updates the ship in the 'JumpingIn' state, animating arrival in a new system with a speed ramp.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     */
    updateJumpingIn(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);

        if (!this.jumpEndPosition) {
            console.error('jumpEndPosition is null in JumpingIn state; resetting to current position');
            this.jumpEndPosition = this.position.clone(); // Fallback to current position
        }

        if (t < 0.5) {
            // Phase 1: Stretched arrival from outside with quadratic easing (fast start, slowing down)
            this.shipScale = 0.25;
            const easedT = t * 2; // Normalize to 0-1 for this phase
            const progress = 1 - (1 - easedT) * (1 - easedT); // Quadratic ease-out: fast start, slow end
            this.stretchFactor = 10 - progress * 9; // 10 to 1
            const radialIn = this.jumpEndPosition.normalize().multiply(-1);
            const maxDistance = 5000;
            const outsidePos = this.jumpEndPosition.subtract(radialIn.multiply(maxDistance));
            this.position = outsidePos.lerp(this.jumpEndPosition, progress);
            const desiredAngle = Math.atan2(radialIn.y, radialIn.x);
            const startAngle = this.jumpStartAngle || this.angle;
            if (!this.jumpStartAngle) this.jumpStartAngle = this.angle;
            const angleDiff = (desiredAngle - startAngle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle = startAngle + angleDiff * easedT;
            this.targetAngle = this.angle;
            this.velocity = radialIn.multiply(2000 * (1 - easedT)); // Velocity ramps down
        } else {
            // Phase 2: Normalize and stop (unchanged)
            this.shipScale = 0.25 + (t - 0.5) * 1.5; // 0.25 to 1
            this.stretchFactor = 1;
            this.position = this.jumpEndPosition;
            this.velocity = new Vector2D(0, 0);
        }

        if (t >= 1) {
            this.setState('Flying');
            this.shipScale = 1;
            this.stretchFactor = 1;
            this.jumpGate = null;
            this.jumpStartPosition = null;
            this.jumpEndPosition = null;
            this.jumpStartAngle = null;
            this.hyperdriveReady = false;
            setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown); // Reset hyperdrive
        }
    }

    /**
     * Draws the ship and its trail on the canvas.
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context.
     * @param {Camera} camera - Camera for world-to-screen transformations.
     */
    draw(ctx, camera) {
        if (this.state === 'Landed') return; // Invisible when landed

        ctx.save();
        this.trail.draw(ctx, camera);
        const screenPos = camera.worldToScreen(this.position);
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.angle);

        // Apply scale and stretch for animations
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale * this.stretchFactor, scale);

        // Draw ship body
        ctx.fillStyle = this.color.toRGB();
        ctx.beginPath();
        ctx.moveTo(15, 0); // Nose
        ctx.lineTo(-10, 10); // Bottom left
        ctx.lineTo(-10, -10); // Top left
        ctx.closePath();
        ctx.fill();

        // Draw thrust effect if applicable
        if ((this.isThrusting && this.state === 'Flying') || this.state === 'Landing' || this.state === 'TakingOff') {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB(); // Yellow thrust
            ctx.beginPath();
            ctx.moveTo(-15, 0); // Thrust base
            ctx.lineTo(-10, 5); // Bottom
            ctx.lineTo(-10, -5); // Top
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