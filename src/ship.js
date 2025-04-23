// ship.js

import { Vector2D } from './vector2d.js';
import { Trail } from './trail.js';
import { Colour } from './colour.js';
import { GameObject } from './gameObject.js';
import { CelestialBody, JumpGate } from './celestialBody.js';
import { TWO_PI, normalizeAngle, randomBetween } from './utils.js';
import { AIPilot } from './pilot.js';
import { FlyToTargetAutoPilot } from './autopilot.js';
import { Asteroid } from './asteroidBelt.js';

function generateShipName() {
    const prefixes = [
        "Star", "Void", "Nova", "Astro", "Hyper", "Galacto", "Nebula",
        "Cosmo", "Solar", "Lunar", "Stellar", "Eclipse", "Quantum", "Ion",
        "Pulse", "Graviton", "Meteor", "Celestial",
        "Mega", "Disco", "Funky", "Wobbly", "Gizmo", "Bloop", "Snaccident"
    ];
    const roots = [
        "lance", "reaver", "scout", "wing", "drifter", "navigator", "breaker",
        "strike", "voyager", "frigate", "cruiser", "probe", "dread", "spire",
        "runner", "falcon", "comet", "raider",
        "tickler", "wobbler", "floof", "noodle", "blasterpants", "zoomzoom", "chugger"
    ];
    const suffixes = [
        "-X", "-on", "-ia", "-or", "-tron", "-ix", "-us", "-ex", "-is", "-oid",
        "-ara", "-tek", "-nova", "-pulse",
        "-inator", "-zoid", "-omatic", "-erino", "-splosion", "-licious", "-pants"
    ];
    const upperFirst = (word) => word.charAt(0).toUpperCase() + word.slice(1);
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const root = (Math.random() > 0.5) ? roots[Math.floor(Math.random() * roots.length)] : ' ' + upperFirst(roots[Math.floor(Math.random() * roots.length)]);
    let name = `${prefix}${root}`;
    const addSuffix = Math.random() < 0.2;
    if (addSuffix) name += suffixes[Math.floor(Math.random() * suffixes.length)];
    const addNumber = Math.random() < (addSuffix ? 0.05 : 0.2);
    if (addNumber) name += ` ${Math.floor(Math.random() * 99) + 1}`;
    return name;
}

/**
 * Represents a spaceship that can navigate, land, and jump between star systems.
 * Extends GameObject to inherit position, velocity, and star system properties.
 * @extends GameObject
 */
export class Ship extends GameObject {
    /** @static {number} Maximum speed for initiating landing (units/second). */
    static LANDING_SPEED = 10;

    /**
     * Creates a new Ship instance.
     * @param {number} x - Initial x-coordinate of the ship.
     * @param {number} y - Initial y-coordinate of the ship.
     * @param {Object} starSystem - The star system the ship is in.
     */
    constructor(x, y, starSystem) {
        super(new Vector2D(x, y), starSystem);

        /** @type {string} Unique name for the ship, generated randomly. */
        this.name = generateShipName();
        /** @type {number} Rotation speed in radians per second. */
        this.rotationSpeed = Math.PI;
        /** @type {number} Thrust acceleration in units per second squared. */
        this.thrust = 250;
        /** @type {number} Maximum velocity in units per second. */
        this.maxVelocity = 500;
        /** @type {number} Current rotation angle in radians. */
        this.angle = 0;
        /** @type {number} Desired rotation angle in radians. */
        this.targetAngle = 0;
        /** @type {boolean} Whether the ship is applying thrust. */
        this.isThrusting = false;
        /** @type {boolean} Whether the ship is braking. */
        this.isBraking = false;
        /** @type {boolean} Whether the hyperdrive is ready for a jump. */
        this.hyperdriveReady = true;
        /** @type {number} Cooldown time for hyperdrive in milliseconds. */
        this.hyperdriveCooldown = 5000;
        /** @type {number} Timestamp of the last hyperjump in milliseconds. */
        this.lastJumpTime = 0;
        /** @type {Pilot|null} The pilot controlling the ship, if any. */
        this.pilot = null;

        // Generate random colors for ship components
        /** @type {Object} Colors for cockpit, wings, and hull. */
        this.colors = {
            cockpit: this.generateRandomBlue(),
            wings: this.generateRandomColor(),
            hull: this.generateRandomGrey()
        };

        /** @type {GameObject|null} Current target (e.g., planet, asteroid, ship). */
        this.target = null;
        /** @type {CelestialBody|Asteroid|null} Object the ship is landed on. */
        this.landedObject = null;
        /** @type {Asteroid|null} Asteroid being mined (not used after landing merge). */
        this.miningAsteroid = null;
        /** @type {string} Current state (e.g., 'Flying', 'Landing', 'Landed'). */
        this.state = 'Flying';
        /** @type {Object} Map of state names to update handler functions. */
        this.stateHandlers = {
            'Flying': this.updateFlying.bind(this),
            'Landing': this.updateLanding.bind(this),
            'Landed': this.updateLanded.bind(this),
            'TakingOff': this.updateTakingOff.bind(this),
            'JumpingOut': this.updateJumpingOut.bind(this),
            'JumpingIn': this.updateJumpingIn.bind(this)
        };
        /** @type {number} Scale factor for rendering (1 = normal size). */
        this.shipScale = 1;
        /** @type {number} Stretch factor for visual effects during jumps. */
        this.stretchFactor = 1;
        /** @type {number} Time elapsed in current animation in seconds. */
        this.animationTime = 0;
        /** @type {number} Duration of animations (landing, takeoff) in seconds. */
        this.animationDuration = 2;
        /** @type {Vector2D} Starting position for landing animation. */
        this.landingStartPosition = new Vector2D(0, 0);
        /** @type {Vector2D} Ending position for takeoff animation. */
        this.takeoffEndPosition = new Vector2D(0, 0);
        /** @type {number|null} Starting angle for takeoff animation. */
        this.startAngle = null;
        /** @type {JumpGate|null} Jump gate used for hyperjumping. */
        this.jumpGate = null;
        /** @type {Vector2D} Starting position for jump out animation. */
        this.jumpStartPosition = new Vector2D(0, 0);
        /** @type {Vector2D} Ending position for jump in animation. */
        this.jumpEndPosition = new Vector2D(0, 0);
        /** @type {number|null} Starting angle for jump animations. */
        this.jumpStartAngle = null;
        /** @type {number} Age of the ship in seconds, used for animations. */
        this.age = 0;
        /** @type {number} Thrust animation timer (0 to 1). */
        this.thrustTime = 0;
        /** @type {number} Y-position for trail rendering relative to ship. */
        this.trailPosition = 0;
        /** @type {Trail|null} Particle trail for visual effects. */
        this.trail = null;
        /** @type {Vector2D} Dimensions of the ship's bounding box. */
        this.boundingBox = new Vector2D(0, 0);
        /** @type {Object|null} Positions of engines, turrets, and lights. */
        this.featurePoints = null;

        // Initialize feature points and bounding box
        this.setupFeaturePoints();
        this.setupBoundingBox();

        // Scratch vectors to avoid memory allocations in main loop
        /** @type {Vector2D} Temporary vector for thrust calculations. */
        this._scratchThrustVector = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for takeoff offset. */
        this._scratchTakeoffOffset = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for outward radial calculations. */
        this._scratchRadialOut = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for inward radial calculations. */
        this._scratchRadialIn = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for screen position. */
        this._scratchScreenPos = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for velocity end point. */
        this._scratchVelocityEnd = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for stopping point. */
        this._scratchStoppingPoint = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for velocity delta. */
        this._scratchVelocityDelta = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for distance to target. */
        this._scratchDistanceToTarget = new Vector2D(0, 0);
        /** @type {Vector2D} General-purpose temporary vector. */
        this._scratchTemp = new Vector2D(0, 0);
    }

    /**
     * Sets up the ship's bounding box for collision detection.
     */
    setupBoundingBox() {
        // Set a fixed bounding box size (20x20 units) and collision radius
        this.boundingBox.set(20, 20);
        this.radius = 20; // Used for broad-phase collision checks
    }

    /**
     * Initializes positions for engines, turrets, and lights.
     */
    setupFeaturePoints() {
        // Initialize empty arrays for dynamic visual elements
        this.featurePoints = {
            engines: [], // Engine positions for thrust effects
            turrets: [], // Turret positions for weapons
            lights: []   // Light positions for visual indicators
        };
    }

    /**
     * Configures the particle trail for visual effects, based on engine positions.
     */
    setupTrail() {
        if (!this.featurePoints || !this.featurePoints.engines) return;

        // Find the furthest engine y-position for trail placement
        for (let i = 0; i < this.featurePoints.engines.length; i++) {
            const engine = this.featurePoints.engines[i];
            if (engine.y > this.trailPosition || this.trailPosition === 0) {
                this.trailPosition = engine.y;
            }
        }

        // Create a trail with specified parameters and wing color
        this.trail = new Trail(2, 1, 3, this.colors.wings.toRGBA(0.5));
    }

    /**
     * Marks the ship as despawned and removes it from the landed object.
     * @override
     */
    despawn() {
        super.despawn();
        if (this.landedObject) {
            // Remove the ship from the landed object (e.g., planet) if applicable
            if (this.landedObject instanceof CelestialBody) {
                this.landedObject.removeLandedShip(this);
            }
            this.landedObject = null;
        }
    }

    /**
     * Generates a random blue shade for the cockpit.
     * @returns {Colour} A blue-tinted color object.
     */
    generateRandomBlue() {
        const r = randomBetween(0, 0.2); // Low red for blue hue
        const g = randomBetween(0, 0.5); // Medium green for tint
        const b = randomBetween(0.7, 1); // High blue for vibrancy
        return new Colour(r, g, b);
    }

    /**
     * Generates a fully random color for the wings.
     * @returns {Colour} A random color object.
     */
    generateRandomColor() {
        const r = Math.random();
        const g = Math.random();
        const b = Math.random();
        return new Colour(r, g, b);
    }

    /**
     * Generates a random grey shade for the hull.
     * @returns {Colour} A grey color object.
     */
    generateRandomGrey() {
        const shade = randomBetween(0.3, 0.8); // Light to dark grey
        return new Colour(shade, shade, shade);
    }

    /**
     * Transitions the ship to a new state, resetting animation time.
     * @param {string} newState - The state to transition to (e.g., 'Flying', 'Landing').
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
     * Sets the ship's current target.
     * @param {GameObject|null} target - The target object (e.g., planet, asteroid).
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
     * Sets the desired rotation angle for the ship.
     * @param {number} angle - The target angle in radians.
     */
    setTargetAngle(angle) {
        this.targetAngle = normalizeAngle(angle);
    }

    /**
     * Toggles the ship's thrust state.
     * @param {boolean} thrusting - Whether to apply thrust.
     */
    applyThrust(thrusting) {
        this.isThrusting = thrusting;
    }

    /**
     * Toggles the ship's braking state.
     * @param {boolean} braking - Whether to apply brakes.
     */
    applyBrakes(braking) {
        this.isBraking = braking;
    }

    /**
     * Checks if the ship can land on a target (planet or asteroid).
     * @param {CelestialBody|Asteroid} target - The target to land on.
     * @returns {boolean} True if landing is possible, false otherwise.
     */
    canLand(target) {
        if (!target || !target.position || this.state !== 'Flying') return false;

        // Calculate distance to target center
        this._scratchDistanceToTarget.set(this.position).subtractInPlace(target.position);
        const distanceToTargetCenter = this._scratchDistanceToTarget.magnitude();

        // Calculate relative speed to target
        this._scratchVelocityDelta.set(this.velocity).subtractInPlace(target.velocity || new Vector2D(0, 0));
        const relativeSpeed = this._scratchVelocityDelta.magnitude();

        // Check landing conditions based on target type
        if (target instanceof CelestialBody || target instanceof Asteroid) {
            return distanceToTargetCenter <= target.radius + 25 && relativeSpeed <= Ship.LANDING_SPEED * 1.1;
        }
        return false;
    }

    /**
     * Initiates landing on a target, setting up animation and state.
     * @param {CelestialBody|Asteroid} target - The target to land on.
     * @returns {boolean} True if landing is initiated, false otherwise.
     */
    initiateLanding(target) {
        if (this.canLand(target)) {
            this.setState('Landing');
            this.landedObject = target;
            this.landingStartPosition.set(this.position);
            // Set velocity based on target type
            if (target instanceof CelestialBody) {
                this.velocity.set(0, 0); // Stop for planets
            } else if (target instanceof Asteroid) {
                this.velocity.set(target.velocity || new Vector2D(0, 0)); // Match asteroid velocity
            }
            this.isThrusting = false;
            this.isBraking = false;
            this.trail.decayMultiplier = 2; // Increase trail decay during landing
            return true;
        }
        return false;
    }

    /**
     * Initiates takeoff from the landed object.
     * @returns {boolean} True if takeoff is initiated, false otherwise.
     */
    initiateTakeoff() {
        if (this.state !== 'Landed' || !this.landedObject) return false;

        this.setState('TakingOff');

        // Set takeoff direction based on target or current angle
        if (this.target && this.target !== this.landedObject) {
            this._scratchTemp.set(this.target.position).subtractInPlace(this.position).normalizeInPlace();
            this.targetAngle = Math.atan2(this._scratchTemp.x, -this._scratchTemp.y);
        } else {
            this._scratchTemp.set(Math.sin(this.angle), -Math.cos(this.angle));
            this.targetAngle = this.angle;
        }
        this.targetAngle = normalizeAngle(this.targetAngle);

        // Calculate takeoff end position
        this._scratchTakeoffOffset.set(this._scratchTemp).multiplyInPlace(this.landedObject.radius * 1.5);
        this.takeoffEndPosition.set(this.landedObject.position).addInPlace(this._scratchTakeoffOffset);
        this.startAngle = this.angle;

        // Remove ship from planet's landed list if applicable
        if (this.landedObject instanceof CelestialBody) {
            this.landedObject.removeLandedShip(this);
        }
        this.trail.decayMultiplier = 1; // Reset trail decay
        return true;
    }

    /**
     * Initiates a hyperjump through a jump gate.
     * @param {JumpGate|null} [gate] - The jump gate to use; finds closest if null.
     * @returns {boolean} True if hyperjump is initiated, false otherwise.
     */
    initiateHyperjump(gate = null) {
        const currentTime = performance.now();
        // Find closest jump gate if none provided
        if (!gate) {
            gate = this.starSystem.getClosestJumpGate(this, null);
        }

        // Check if ship is within gate's overlap area
        if (!gate.overlapsPoint(this.position)) {
            return false;
        }

        this.setState('JumpingOut');
        this.jumpGate = gate;
        this.jumpStartPosition.set(this.position);
        this.lastJumpTime = currentTime;
        this.isThrusting = false;
        this.isBraking = false;
        return true;
    }

    /**
     * Updates the ship's state and visuals each frame.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        if (this.despawned) return; // Skip updates for despawned ships

        this.age += deltaTime; // Increment ship age for animations

        // Log NaN position errors in debug mode
        if (isNaN(this.position.x) && this.debug) {
            console.log('Position became NaN');
        }

        // Call the appropriate state handler
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime);
        } else {
            console.warn(`No handler for state: ${this.state}`);
        }

        // Update trail position and visuals
        this._scratchThrustVector.set(-Math.sin(this.angle), Math.cos(this.angle))
            .multiplyInPlace(this.trailPosition * this.shipScale)
            .addInPlace(this.position);
        this.trail.update(deltaTime, this._scratchThrustVector, this.angle, this.debug);

        // Update thrust animation timer
        if (this.isThrusting) {
            this.thrustTime += deltaTime * 2;
            this.thrustTime = Math.min(1, this.thrustTime);
        } else {
            this.thrustTime -= deltaTime;
            this.thrustTime = Math.max(0, this.thrustTime);
        }
    }

    /**
     * Updates the ship in the 'Flying' state, handling rotation and movement.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateFlying(deltaTime) {
        // Rotate towards target angle
        const angleDiff = normalizeAngle(this.targetAngle - this.angle);
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * deltaTime), this.rotationSpeed * deltaTime);
        this.angle = normalizeAngle(this.angle);

        if (this.isThrusting) {
            // Apply thrust in the direction the ship is facing
            this._scratchThrustVector.set(Math.sin(this.angle), -Math.cos(this.angle))
                .multiplyInPlace(this.thrust * deltaTime);
            this.velocity.addInPlace(this._scratchThrustVector);
        } else if (this.isBraking) {
            // Align with velocity direction to slow down
            const velAngle = Math.atan2(-this.velocity.x, this.velocity.y);
            const brakeAngleDiff = normalizeAngle(velAngle - this.angle);
            this.angle += brakeAngleDiff * this.rotationSpeed * deltaTime;
            this.angle = normalizeAngle(this.angle);
        }

        // Cap velocity to maxVelocity
        const speedSquared = this.velocity.squareMagnitude();
        if (speedSquared > this.maxVelocity * this.maxVelocity) {
            const scale = this.maxVelocity / Math.sqrt(speedSquared);
            this.velocity.multiplyInPlace(scale);
        }

        // Update position based on velocity
        this._scratchVelocityDelta.set(this.velocity).multiplyInPlace(deltaTime);
        this.position.addInPlace(this._scratchVelocityDelta);
    }

    /**
     * Updates the ship in the 'Landing' state, animating the landing process.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateLanding(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);

        // Log error if landedObject is missing
        if (!this.landedObject) {
            console.warn('!this.landedObject', this, this.ship);
        }

        // Interpolate position from start to target
        this.position.lerpInPlace(this.landingStartPosition, this.landedObject.position, t);

        // Adjust scale and behavior based on target type
        if (this.landedObject instanceof CelestialBody) {
            this.shipScale = 1 - t; // Shrink to 0 for planets
        } else if (this.landedObject instanceof Asteroid) {
            this.shipScale = 1 - (t * 0.2); // Shrink to 0.8 for asteroids
            // Update landing start position with asteroid's velocity
            this.landingStartPosition.addInPlace(this._scratchTemp.set(this.landedObject.velocity).multiplyInPlace(deltaTime));
            // Rotate with asteroid's spin
            const currentAngularVelocity = t * this.landedObject.spinSpeed;
            this.angle += currentAngularVelocity * deltaTime;
            this.angle = normalizeAngle(this.angle);
        }

        // Complete landing when animation finishes
        if (t >= 1) {
            this.setState('Landed');
            this.position.set(this.landedObject.position);
            this.velocity.set(this.landedObject.velocity || new Vector2D(0, 0));
            if (this.landedObject instanceof CelestialBody) {
                this.shipScale = 0;
                this.landedObject.addLandedShip(this);
            } else if (this.landedObject instanceof Asteroid) {
                this.shipScale = 0.8;
            }
        }
    }

    /**
     * Updates the ship in the 'Landed' state, keeping it attached to the target.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateLanded(deltaTime) {
        if (this.landedObject instanceof Asteroid) {
            // Stay attached to asteroid, matching position, velocity, and rotation
            this.position.set(this.landedObject.position);
            this.velocity.set(this.landedObject.velocity || new Vector2D(0, 0));
            this.angle += this.landedObject.spinSpeed * deltaTime;
            this.angle = normalizeAngle(this.angle);
        }
        // Note: For planets, position is updated via landedObject.addLandedShip
    }

    /**
     * Updates the ship in the 'TakingOff' state, animating the takeoff process.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateTakingOff(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);
        // Interpolate position and angle
        this.position.lerpInPlace(this.landedObject.position, this.takeoffEndPosition, t);
        this.angle = this.startAngle + (this.targetAngle - this.startAngle) * t;

        // Adjust scale based on target type
        if (this.landedObject instanceof CelestialBody) {
            this.shipScale = t; // Grow from 0 to 1 for planets
        } else if (this.landedObject instanceof Asteroid) {
            this.shipScale = 0.8 + (t * 0.2); // Grow from 0.8 to 1 for asteroids
            // Update takeoff end position with asteroid's velocity
            this.takeoffEndPosition.addInPlace(this._scratchTemp.set(this.landedObject.velocity).multiplyInPlace(deltaTime));
        }

        // Complete takeoff when animation finishes
        if (t >= 1) {
            this.setState('Flying');
            this.setTargetAngle(this.angle);
            this.shipScale = 1;
            // Calculate takeoff velocity
            this._scratchVelocityDelta.set(this.takeoffEndPosition)
                .subtractInPlace(this.landedObject.position)
                .divideInPlace(this.animationDuration);
            this.velocity.set(this.landedObject.velocity || new Vector2D(0, 0))
                .addInPlace(this._scratchVelocityDelta);
            this.landedObject = null;
        }
    }

    /**
     * Updates the ship in the 'JumpingOut' state, animating the exit jump.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateJumpingOut(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);

        if (t < 0.5) {
            // First half: Shrink and move to gate
            this.shipScale = 1 - (t * 1.5);
            this.position.lerpInPlace(this.jumpStartPosition, this.jumpGate.position, t * 2);
            this._scratchRadialOut.set(this.jumpGate.position).normalizeInPlace();
            const desiredAngle = Math.atan2(this._scratchRadialOut.x, -this._scratchRadialOut.y);
            const startAngle = this.jumpStartAngle || this.angle;
            if (!this.jumpStartAngle) this.jumpStartAngle = this.angle;
            const angleDiff = normalizeAngle(desiredAngle - startAngle);
            this.angle = startAngle + angleDiff * (t * 2);
            this.targetAngle = this.angle;
            this.stretchFactor = 1;
        } else {
            // Second half: Stretch and accelerate outward
            this.shipScale = 0.25;
            const easedT = (t - 0.5) * 2;
            const progress = easedT * easedT;
            this.stretchFactor = 1 + progress * 9;
            this._scratchRadialOut.set(this.jumpGate.position).normalizeInPlace();
            const maxDistance = 5000;
            this._scratchVelocityDelta.set(this._scratchRadialOut).multiplyInPlace(maxDistance * progress);
            this.position.set(this.jumpGate.position).addInPlace(this._scratchVelocityDelta);
            this.velocity.set(this._scratchRadialOut).multiplyInPlace(2000 * easedT);
        }

        // Transition to JumpingIn when animation completes
        if (t >= 1) {
            const oldSystem = this.starSystem;
            this.starSystem = this.jumpGate.lane.target;
            this._scratchRadialIn.set(this.jumpGate.lane.targetGate.position)
                .normalizeInPlace()
                .multiplyInPlace(-1);
            this.jumpEndPosition.set(this.jumpGate.lane.targetGate.position);
            this._scratchVelocityDelta.set(this._scratchRadialIn).multiplyInPlace(5000);
            this.position.set(this.jumpEndPosition).subtractInPlace(this._scratchVelocityDelta);
            this.setState('JumpingIn');
            this.velocity.set(this._scratchRadialIn).multiplyInPlace(2000);
            this.trail.clear();
            this.jumpStartAngle = null;
            // Update star system ship lists
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this);
            this.starSystem.ships.push(this);
        }
    }

    /**
     * Updates the ship in the 'JumpingIn' state, animating the entry jump.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateJumpingIn(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);

        // Handle missing jumpEndPosition
        if (!this.jumpEndPosition) {
            console.error('jumpEndPosition is null in JumpingIn state; resetting to current position');
            this.jumpEndPosition.set(this.position);
        }

        if (t < 0.5) {
            // First half: Stretched and decelerating
            this.shipScale = 0.25;
            const easedT = t * 2;
            const progress = 1 - (1 - easedT) * (1 - easedT);
            this.stretchFactor = 10 - progress * 9;
            this._scratchRadialOut.set(this.jumpEndPosition).normalizeInPlace();
            this._scratchRadialIn.set(this._scratchRadialOut).multiplyInPlace(-1);

            const maxDistance = 5000;
            this._scratchVelocityDelta.set(this._scratchRadialOut).multiplyInPlace(maxDistance)
                .addInPlace(this.jumpEndPosition);
            this.position.lerpInPlace(this._scratchVelocityDelta, this.jumpEndPosition, progress);
            const desiredAngle = Math.atan2(this._scratchRadialIn.x, -this._scratchRadialIn.y);
            const startAngle = this.jumpStartAngle || this.angle;
            if (!this.jumpStartAngle) this.jumpStartAngle = this.angle;
            const angleDiff = normalizeAngle(desiredAngle - startAngle);
            this.angle = startAngle + angleDiff * easedT;
            this.targetAngle = this.angle;
            this.velocity.set(this._scratchRadialIn).multiplyInPlace(2000 * (1 - easedT));
        } else {
            // Second half: Expand and stop
            this.shipScale = 0.25 + (t - 0.5) * 1.5;
            this.stretchFactor = 1;
            this.position.set(this.jumpEndPosition);
            this.velocity.set(0, 0);
        }

        // Transition to Flying when animation completes
        if (t >= 1) {
            this.setState('Flying');
            this.shipScale = 1;
            this.stretchFactor = 1;
            this.jumpGate = null;
            this.jumpStartPosition.set(0, 0);
            this.jumpEndPosition.set(0, 0);
            this.jumpStartAngle = null;
            this.hyperdriveReady = false;
            // Set hyperdrive cooldown
            setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
        }
    }

    /**
     * Renders the ship and its visual effects to the canvas.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Object} camera - The camera object for world-to-screen conversion.
     */
    draw(ctx, camera) {
        // Draw trail if visible and scaled
        if (this.trail && this.shipScale > 0 && camera.isBoxInView(this.trail.boundsMin, this.trail.boundsMax, this.trail.startWidth)) {
            this.trail.draw(ctx, camera, this.shipScale);
        }

        // Skip rendering if fully scaled down (e.g., landed on planet)
        if (this.shipScale === 0) {
            return;
        }

        // Render ship if within camera view
        if (camera.isInView(this.position, this.radius)) {
            ctx.save();
            camera.worldToScreen(this.position, this._scratchScreenPos);
            ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.rotate(this.angle);
            const scale = camera.zoom * this.shipScale;
            ctx.scale(scale, scale * this.stretchFactor);
            this.drawEngines(ctx, camera);
            this.drawShip(ctx, camera);
            this.drawTurrets(ctx, camera);
            this.drawLights(ctx, camera);
            ctx.restore();
            this.drawDebug(ctx, camera, scale);
        }
    }

    /**
     * Draws the ship's main body and thrust effects.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Object} camera - The camera object.
     */
    drawShip(ctx, camera) {
        ctx.save();
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);

        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);

        // Draw ship body as a triangle
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(10, 10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();

        // Draw thrust effect if active
        if ((this.isThrusting && this.state === 'Flying') || this.state === 'Landing' || this.state === 'TakingOff') {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            ctx.beginPath();
            ctx.moveTo(0, 15);
            ctx.lineTo(5, 10);
            ctx.lineTo(-5, 10);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Draws engine thrust effects if active.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Object} camera - The camera object.
     */
    drawEngines(ctx, camera) {
        if (this.thrustTime <= 0) return; // Skip if no thrust effect

        // Draw layered thrust effects with varying colors and sizes
        ctx.fillStyle = new Colour(1, 0, 0, 0.5).toRGBA();
        ctx.beginPath();
        for (let i = 0; i < this.featurePoints.engines.length; i++) {
            const engine = this.featurePoints.engines[i];
            ctx.moveTo(engine.x - engine.radius, engine.y);
            ctx.lineTo(engine.x + engine.radius, engine.y);
            ctx.lineTo(engine.x, engine.y + (engine.radius * 15 + (Math.random() * engine.radius * 5)) * this.thrustTime);
            ctx.closePath();
        }
        ctx.fill();

        ctx.fillStyle = new Colour(1, 1, 0).toRGB();
        ctx.beginPath();
        for (let i = 0; i < this.featurePoints.engines.length; i++) {
            const engine = this.featurePoints.engines[i];
            ctx.moveTo(engine.x - engine.radius * 0.5, engine.y);
            ctx.lineTo(engine.x + engine.radius * 0.5, engine.y);
            ctx.lineTo(engine.x, engine.y + (engine.radius * 9 + (Math.random() * engine.radius * 2)) * this.thrustTime);
            ctx.closePath();
        }
        ctx.fill();

        ctx.fillStyle = new Colour(1, 1, 1).toRGB();
        ctx.beginPath();
        for (let i = 0; i < this.featurePoints.engines.length; i++) {
            const engine = this.featurePoints.engines[i];
            ctx.moveTo(engine.x - engine.radius * 0.25, engine.y);
            ctx.lineTo(engine.x + engine.radius * 0.25, engine.y);
            ctx.lineTo(engine.x, engine.y + (engine.radius * 4.5 + (Math.random() * engine.radius * 2)) * this.thrustTime);
            ctx.closePath();
        }
        ctx.fill();
    }

    /**
     * Draws turrets as pink circles.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Object} camera - The camera object.
     */
    drawTurrets(ctx, camera) {
        ctx.fillStyle = '#FF77A8';
        ctx.beginPath();
        for (let i = 0; i < this.featurePoints.turrets.length; i++) {
            const turret = this.featurePoints.turrets[i];
            ctx.moveTo(turret.x, turret.y);
            ctx.arc(turret.x, turret.y, turret.radius, 0, TWO_PI);
            ctx.closePath();
        }
        ctx.fill();
    }

    /**
     * Draws blinking navigation lights.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Object} camera - The camera object.
     */
    drawLights(ctx, camera) {
        for (let i = 0; i < this.featurePoints.lights.length; i++) {
            const light = this.featurePoints.lights[i];
            const sinAge = Math.sin(this.age * 5);
            const leftBrightness = Math.max(0, sinAge) ** 8;
            const rightBrightness = Math.max(0, -sinAge) ** 8;

            // Draw outer light layer
            if (light.x < -3) {
                ctx.fillStyle = `rgba(255,0,0,${leftBrightness * 0.5})`; // Red for left
            } else if (light.x > 3) {
                ctx.fillStyle = `rgba(0,255,0,${rightBrightness * 0.5})`; // Green for right
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; // White for center
            }
            ctx.beginPath();
            ctx.moveTo(light.x, light.y);
            ctx.arc(light.x, light.y, light.radius * 2, 0, TWO_PI);
            ctx.closePath();
            ctx.fill();

            // Draw middle light layer
            if (light.x < -3) {
                ctx.fillStyle = `rgba(255,0,0,${leftBrightness})`;
            } else if (light.x > 3) {
                ctx.fillStyle = `rgba(0,255,0,${rightBrightness})`;
            } else {
                ctx.fillStyle = 'rgba(255,255,255,1)';
            }
            ctx.beginPath();
            ctx.moveTo(light.x, light.y);
            ctx.arc(light.x, light.y, light.radius, 0, TWO_PI);
            ctx.closePath();
            ctx.fill();

            // Draw inner light layer
            if (light.x < 3) {
                ctx.fillStyle = `rgba(255,255,255,${leftBrightness})`;
            } else if (light.x > 3) {
                ctx.fillStyle = `rgba(255,255,255,${rightBrightness})`;
            } else {
                ctx.fillStyle = 'rgba(255,255,255,1)';
            }
            ctx.beginPath();
            ctx.moveTo(light.x, light.y);
            ctx.arc(light.x, light.y, light.radius * 0.5, 0, TWO_PI);
            ctx.closePath();
            ctx.fill();
        }
    }

    /**
     * Draws debug information if enabled, including velocity, target, and autopilot data.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Object} camera - The camera object.
     * @param {number} scale - The current render scale.
     */
    drawDebug(ctx, camera, scale) {
        if (!this.debug || !camera.debug) return;

        this.trail.drawDebug(ctx, camera, this.position);
        ctx.lineWidth = 2;

        // Draw autopilot future position and target distances
        if (this.pilot && this.pilot.autopilot && (this.pilot.autopilot._scratchFuturePosition ||
            (this.pilot.autopilot.subPilot && this.pilot.autopilot.subPilot._scratchFuturePosition))) {
            const autopilot = this.pilot.autopilot.subPilot || this.pilot.autopilot;
            camera.worldToScreen(autopilot._scratchFuturePosition, this._scratchScreenPos);
            ctx.save();
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(255,0,255,0.5)';
            ctx.strokeStyle = 'rgb(255,0,255)';

            // Draw future position as a circle
            ctx.beginPath();
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, 5 * scale, 0, TWO_PI);
            ctx.fill();
            ctx.closePath();

            // Draw target approach distances (final, mid, far)
            ctx.beginPath();
            camera.worldToScreen(autopilot.target.position, this._scratchScreenPos);
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, autopilot.finalRadius * scale, 0, TWO_PI);
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, autopilot.midApproachDistance * scale, 0, TWO_PI);
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, autopilot.farApproachDistance * scale, 0, TWO_PI);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // Convert world positions to screen coordinates
        this._scratchScreenPos.set(this.position);
        camera.worldToScreen(this._scratchScreenPos, this._scratchScreenPos);

        // Draw velocity error if available
        let velocityError = null;
        if (this.pilot && this.pilot.autopilot && this.pilot.autopilot.subPilot && this.pilot.autopilot.subPilot.active && this.pilot.autopilot.subPilot._scratchVelocityError) {
            velocityError = this.pilot.autopilot.subPilot._scratchVelocityError;
        } else if (this.pilot && this.pilot.autopilot && this.pilot.autopilot.active && this.pilot.autopilot._scratchVelocityError) {
            velocityError = this.pilot.autopilot._scratchVelocityError;
        } else if (this.pilot && this.pilot._scratchVelocityError) {
            velocityError = this.pilot._scratchVelocityError;
        }

        if (velocityError) {
            this._scratchVelocityEnd.set(velocityError).addInPlace(this.position);
            camera.worldToScreen(this._scratchVelocityEnd, this._scratchVelocityEnd);
            ctx.strokeStyle = 'cyan';
            ctx.beginPath();
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.lineTo(this._scratchVelocityEnd.x, this._scratchVelocityEnd.y);
            ctx.stroke();
        }

        // Draw velocity vector
        this._scratchVelocityEnd.set(this.velocity).multiplyInPlace(1).addInPlace(this.position);
        camera.worldToScreen(this._scratchVelocityEnd, this._scratchVelocityEnd);
        ctx.strokeStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.lineTo(this._scratchVelocityEnd.x, this._scratchVelocityEnd.y);
        ctx.stroke();

        // Draw angle difference arc
        ctx.save();
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle - Math.PI * 0.5);
        const angleDiff = normalizeAngle(this.targetAngle - this.angle);
        ctx.fillStyle = 'rgba(255,0,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 30 * scale, 0, angleDiff, angleDiff < 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Draw pilot state text
        if (this.pilot) {
            const state = this.pilot.getState();
            ctx.fillStyle = 'white';
            ctx.font = `${10 * scale}px Arial`;
            const textMetrics = ctx.measureText(state);
            const textX = this._scratchScreenPos.x - textMetrics.width / 2;
            const textY = this._scratchScreenPos.y + 20 * scale;
            ctx.fillText(state, textX, textY);
        }

        // Draw stopping point based on velocity
        const currentSpeed = this.velocity.magnitude();
        if (currentSpeed > 0) {
            this._scratchStoppingPoint.set(this.velocity)
                .normalizeInPlace()
                .multiplyInPlace((currentSpeed * currentSpeed) / (2 * this.thrust))
                .addInPlace(this.position);
            camera.worldToScreen(this._scratchStoppingPoint, this._scratchStoppingPoint);
            ctx.strokeStyle = 'gray';
            ctx.beginPath();
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.lineTo(this._scratchStoppingPoint.x, this._scratchStoppingPoint.y);
            ctx.stroke();

            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.arc(this._scratchStoppingPoint.x, this._scratchStoppingPoint.y, 3 * scale, 0, TWO_PI);
            ctx.fill();
        }

        // Draw target approach distances
        if (this.target && this.target.position) {
            camera.worldToScreen(this.target.position, this._scratchRadialOut);
            if (this.farApproachDistance > 0) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(0,255,0,0.1)';
                ctx.arc(this._scratchRadialOut.x, this._scratchRadialOut.y, this.farApproachDistance * scale, 0, TWO_PI, false);
                if (this.closeApproachDistance > 0) {
                    ctx.arc(this._scratchRadialOut.x, this._scratchRadialOut.y, this.closeApproachDistance * scale, 0, TWO_PI, true);
                }
                ctx.fill();
                if (this.closeApproachDistance > 0) {
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(255,255,0,0.2)';
                    ctx.arc(this._scratchRadialOut.x, this._scratchRadialOut.y, this.closeApproachDistance * scale, 0, TWO_PI);
                    ctx.fill();
                }
            }
        }
    }
}

export class Flivver extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 2.5;
        this.thrust = 800;
        this.maxVelocity = 700;
        this.setupTrail();
    }

    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        this.boundingBox.set(38.00, 31.00);
        this.radius = 38;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: -6.00, y: 13.50, radius: 1.00 },
                { x: 6.00, y: 13.50, radius: 1.00 },
                { x: 0.00, y: 13.50, radius: 2.00 },
            ],
            turrets: [
            ],
            lights: [
                { x: -18.00, y: 14.50, radius: 1.00 },
                { x: 18.00, y: 14.50, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the Ships hull, wings and cockpit
     */
    drawShip(ctx, camera) {
        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, 0.50);
        ctx.lineTo(2.00, 2.50);
        ctx.lineTo(3.00, 6.50);
        ctx.lineTo(3.00, 9.50);
        ctx.lineTo(2.00, 11.50);
        ctx.lineTo(-2.00, 11.50);
        ctx.lineTo(-3.00, 9.50);
        ctx.lineTo(-3.00, 6.50);
        ctx.lineTo(-2.00, 2.50);
        ctx.closePath();
        ctx.moveTo(-2.00, -15.50);
        ctx.lineTo(-2.00, -7.50);
        ctx.lineTo(-4.00, -5.50);
        ctx.lineTo(-5.00, 6.50);
        ctx.lineTo(-5.00, 9.50);
        ctx.lineTo(-4.00, 11.50);
        ctx.lineTo(-4.00, 12.50);
        ctx.lineTo(-8.00, 12.50);
        ctx.lineTo(-8.00, 4.50);
        ctx.closePath();
        ctx.moveTo(-3.00, -6.50);
        ctx.lineTo(-3.00, 6.50);
        ctx.lineTo(-3.00, 9.50);
        ctx.lineTo(-4.00, 11.50);
        ctx.lineTo(-5.00, 9.50);
        ctx.lineTo(-5.00, 6.50);
        ctx.lineTo(-4.00, -5.50);
        ctx.closePath();
        ctx.moveTo(-8.00, 12.50);
        ctx.lineTo(-4.00, 12.50);
        ctx.lineTo(-5.00, 13.50);
        ctx.lineTo(-7.00, 13.50);
        ctx.closePath();
        ctx.moveTo(2.00, -15.50);
        ctx.lineTo(2.00, -7.50);
        ctx.lineTo(4.00, -5.50);
        ctx.lineTo(5.00, 6.50);
        ctx.lineTo(5.00, 9.50);
        ctx.lineTo(4.00, 11.50);
        ctx.lineTo(4.00, 12.50);
        ctx.lineTo(8.00, 12.50);
        ctx.lineTo(8.00, 4.50);
        ctx.closePath();
        ctx.moveTo(3.00, -6.50);
        ctx.lineTo(3.00, 6.50);
        ctx.lineTo(3.00, 9.50);
        ctx.lineTo(4.00, 11.50);
        ctx.lineTo(5.00, 9.50);
        ctx.lineTo(5.00, 6.50);
        ctx.lineTo(4.00, -5.50);
        ctx.closePath();
        ctx.moveTo(8.00, 12.50);
        ctx.lineTo(4.00, 12.50);
        ctx.lineTo(5.00, 13.50);
        ctx.lineTo(7.00, 13.50);
        ctx.closePath();
        ctx.moveTo(-2.00, 11.50);
        ctx.lineTo(-2.00, 13.50);
        ctx.lineTo(2.00, 13.50);
        ctx.lineTo(2.00, 11.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, 3.50);
        ctx.lineTo(1.00, 3.50);
        ctx.lineTo(2.00, 6.50);
        ctx.lineTo(2.00, 7.50);
        ctx.lineTo(1.00, 8.50);
        ctx.lineTo(-1.00, 8.50);
        ctx.lineTo(-2.00, 7.50);
        ctx.lineTo(-2.00, 6.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(-8.00, 4.50);
        ctx.lineTo(-18.00, 12.50);
        ctx.lineTo(-18.00, 14.50);
        ctx.lineTo(-8.00, 12.50);
        ctx.closePath();
        ctx.moveTo(-4.00, 4.50);
        ctx.lineTo(-6.00, 9.50);
        ctx.lineTo(-6.00, 11.50);
        ctx.lineTo(-4.00, 9.50);
        ctx.closePath();
        ctx.moveTo(8.00, 4.50);
        ctx.lineTo(18.00, 12.50);
        ctx.lineTo(18.00, 14.50);
        ctx.lineTo(8.00, 12.50);
        ctx.closePath();
        ctx.moveTo(4.00, 4.50);
        ctx.lineTo(6.00, 9.50);
        ctx.lineTo(6.00, 11.50);
        ctx.lineTo(4.00, 9.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class Shuttle extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 1.2;
        this.thrust = 200;
        this.maxVelocity = 400;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 270.0 (from 67.5 to 337.5), height = 405.0 (from 101.3 to 506.3)
        this.boundingBox.set(18.00, 27.00);
        this.radius = 27;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: 2.00, y: 12.50, radius: 1.00 },
                { x: -2.00, y: 12.50, radius: 1.00 },
            ],
            turrets: [
            ],
            lights: [
                { x: -8.00, y: 10.50, radius: 1.00 },
                { x: 8.00, y: 10.50, radius: 1.00 },
                { x: -4.00, y: -7.50, radius: 1.00 },
                { x: 4.00, y: -7.50, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the Ships hull, wings and cockpit
     */
    drawShip(ctx, camera) {
        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -13.50);
        ctx.lineTo(2.00, -12.50);
        ctx.lineTo(3.00, -10.50);
        ctx.lineTo(3.00, -6.50);
        ctx.lineTo(2.00, -5.50);
        ctx.lineTo(-2.00, -5.50);
        ctx.lineTo(-3.00, -6.50);
        ctx.lineTo(-3.00, -10.50);
        ctx.lineTo(-2.00, -12.50);
        ctx.closePath();
        ctx.moveTo(2.00, -5.50);
        ctx.lineTo(5.00, -4.50);
        ctx.lineTo(6.00, 1.50);
        ctx.lineTo(6.00, 10.50);
        ctx.lineTo(4.00, 11.50);
        ctx.lineTo(-4.00, 11.50);
        ctx.lineTo(-6.00, 10.50);
        ctx.lineTo(-6.00, 1.50);
        ctx.lineTo(-5.00, -4.50);
        ctx.lineTo(-2.00, -5.50);
        ctx.closePath();
        ctx.moveTo(0.00, 11.50);
        ctx.lineTo(-1.00, 12.50);
        ctx.lineTo(-3.00, 12.50);
        ctx.lineTo(-4.00, 11.50);
        ctx.closePath();
        ctx.moveTo(0.00, 11.50);
        ctx.lineTo(4.00, 11.50);
        ctx.lineTo(3.00, 12.50);
        ctx.lineTo(1.00, 12.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -11.50);
        ctx.lineTo(1.00, -11.50);
        ctx.lineTo(2.00, -7.50);
        ctx.lineTo(-2.00, -7.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(3.00, -10.50);
        ctx.lineTo(4.00, -8.50);
        ctx.lineTo(4.00, -7.50);
        ctx.lineTo(3.00, -8.50);
        ctx.closePath();
        ctx.moveTo(-3.00, -10.50);
        ctx.lineTo(-3.00, -8.50);
        ctx.lineTo(-4.00, -7.50);
        ctx.lineTo(-4.00, -8.50);
        ctx.closePath();
        ctx.moveTo(6.00, 1.50);
        ctx.lineTo(8.00, 5.50);
        ctx.lineTo(8.00, 10.50);
        ctx.lineTo(6.00, 10.50);
        ctx.closePath();
        ctx.moveTo(-6.00, 1.50);
        ctx.lineTo(-8.00, 5.50);
        ctx.lineTo(-8.00, 10.50);
        ctx.lineTo(-6.00, 10.50);
        ctx.closePath();
        ctx.moveTo(0.00, 1.50);
        ctx.lineTo(1.00, 10.50);
        ctx.lineTo(-1.00, 10.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class HeavyShuttle extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 1.1;
        this.thrust = 150;
        this.maxVelocity = 350;
        this.setupTrail();
    }

    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 270.0 (from 67.5 to 337.5), height = 510.0 (from 127.5 to 637.5)
        this.boundingBox.set(18.00, 34.00);
        this.radius = 34;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: 2.00, y: 16.00, radius: 1.00 },
                { x: -2.00, y: 16.00, radius: 1.00 },
            ],
            turrets: [
            ],
            lights: [
                { x: -8.00, y: 14.00, radius: 1.00 },
                { x: 8.00, y: 14.00, radius: 1.00 },
                { x: 5.00, y: -7.00, radius: 1.00 },
                { x: -5.00, y: -7.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the Ships hull, wings and cockpit
     */
    drawShip(ctx, camera) {
        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -17.00);
        ctx.lineTo(3.00, -16.00);
        ctx.lineTo(4.00, -12.00);
        ctx.lineTo(4.00, -6.00);
        ctx.lineTo(3.00, -5.00);
        ctx.lineTo(-3.00, -5.00);
        ctx.lineTo(-4.00, -6.00);
        ctx.lineTo(-4.00, -12.00);
        ctx.lineTo(-3.00, -16.00);
        ctx.closePath();
        ctx.moveTo(3.00, -5.00);
        ctx.lineTo(5.00, -4.00);
        ctx.lineTo(6.00, -1.00);
        ctx.lineTo(6.00, 13.00);
        ctx.lineTo(4.00, 15.00);
        ctx.lineTo(-4.00, 15.00);
        ctx.lineTo(-6.00, 13.00);
        ctx.lineTo(-6.00, -1.00);
        ctx.lineTo(-5.00, -4.00);
        ctx.lineTo(-3.00, -5.00);
        ctx.closePath();
        ctx.moveTo(-4.00, 15.00);
        ctx.lineTo(0.00, 15.00);
        ctx.lineTo(-1.00, 16.00);
        ctx.lineTo(-3.00, 16.00);
        ctx.closePath();
        ctx.moveTo(4.00, 15.00);
        ctx.lineTo(3.00, 16.00);
        ctx.lineTo(1.00, 16.00);
        ctx.lineTo(0.00, 15.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -15.00);
        ctx.lineTo(1.00, -15.00);
        ctx.lineTo(2.00, -11.00);
        ctx.lineTo(2.00, -9.00);
        ctx.lineTo(1.00, -8.00);
        ctx.lineTo(-1.00, -8.00);
        ctx.lineTo(-2.00, -9.00);
        ctx.lineTo(-2.00, -11.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(4.00, -12.00);
        ctx.lineTo(5.00, -10.00);
        ctx.lineTo(5.00, -7.00);
        ctx.lineTo(4.00, -8.00);
        ctx.closePath();
        ctx.moveTo(-4.00, -12.00);
        ctx.lineTo(-4.00, -8.00);
        ctx.lineTo(-5.00, -7.00);
        ctx.lineTo(-5.00, -10.00);
        ctx.closePath();
        ctx.moveTo(6.00, 2.00);
        ctx.lineTo(8.00, 6.00);
        ctx.lineTo(8.00, 14.00);
        ctx.lineTo(6.00, 13.00);
        ctx.closePath();
        ctx.moveTo(-6.00, 2.00);
        ctx.lineTo(-8.00, 6.00);
        ctx.lineTo(-8.00, 14.00);
        ctx.lineTo(-6.00, 13.00);
        ctx.closePath();
        ctx.moveTo(0.00, 2.00);
        ctx.lineTo(1.00, 14.00);
        ctx.lineTo(-1.00, 14.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class StarBarge extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.5;
        this.thrust = 25;
        this.maxVelocity = 100;
        this.setupTrail();
    }

    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 510.0 (from 127.5 to 637.5), height = 630.0 (from 157.5 to 787.5)
        this.boundingBox.set(34.00, 42.00);
        this.radius = 42;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 19.00, radius: 2.00 },
            ],
            turrets: [
                { x: 0.00, y: -2.00, radius: 2.00 },
            ],
            lights: [
                { x: 16.00, y: 14.00, radius: 1.00 },
                { x: -16.00, y: 14.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the ship's hull, wings, cockpit, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -21.00);
        ctx.lineTo(3.00, -20.00);
        ctx.lineTo(4.00, -16.00);
        ctx.lineTo(4.00, -11.00);
        ctx.lineTo(3.00, -10.00);
        ctx.lineTo(-3.00, -10.00);
        ctx.lineTo(-4.00, -11.00);
        ctx.lineTo(-4.00, -16.00);
        ctx.lineTo(-3.00, -20.00);
        ctx.closePath();
        ctx.moveTo(3.00, 18.00);
        ctx.lineTo(2.00, 19.00);
        ctx.lineTo(-2.00, 19.00);
        ctx.lineTo(-3.00, 18.00);
        ctx.closePath();
        ctx.moveTo(-3.00, -10.00);
        ctx.lineTo(3.00, -10.00);
        ctx.lineTo(8.00, -8.00);
        ctx.lineTo(2.00, -8.00);
        ctx.lineTo(1.00, -7.00);
        ctx.lineTo(1.00, 15.00);
        ctx.lineTo(2.00, 16.00);
        ctx.lineTo(8.00, 16.00);
        ctx.lineTo(3.00, 18.00);
        ctx.lineTo(-3.00, 18.00);
        ctx.lineTo(-8.00, 16.00);
        ctx.lineTo(-2.00, 16.00);
        ctx.lineTo(-1.00, 15.00);
        ctx.lineTo(-1.00, -7.00);
        ctx.lineTo(-2.00, -8.00);
        ctx.lineTo(-8.00, -8.00);
        ctx.closePath();
        ctx.moveTo(-2.00, -8.00);
        ctx.lineTo(-1.00, -7.00);
        ctx.lineTo(-1.00, 15.00);
        ctx.lineTo(-2.00, 16.00);
        ctx.lineTo(-12.00, 16.00);
        ctx.lineTo(-13.00, 15.00);
        ctx.lineTo(-13.00, -7.00);
        ctx.lineTo(-12.00, -8.00);
        ctx.closePath();
        ctx.moveTo(2.00, -8.00);
        ctx.lineTo(1.00, -7.00);
        ctx.lineTo(1.00, 15.00);
        ctx.lineTo(2.00, 16.00);
        ctx.lineTo(12.00, 16.00);
        ctx.lineTo(13.00, 15.00);
        ctx.lineTo(13.00, -7.00);
        ctx.lineTo(12.00, -8.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -19.00);
        ctx.lineTo(1.00, -19.00);
        ctx.lineTo(2.00, -15.00);
        ctx.lineTo(2.00, -13.00);
        ctx.lineTo(1.00, -12.00);
        ctx.lineTo(-1.00, -12.00);
        ctx.lineTo(-2.00, -13.00);
        ctx.lineTo(-2.00, -15.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(13.00, 2.00);
        ctx.lineTo(16.00, 8.00);
        ctx.lineTo(16.00, 14.00);
        ctx.lineTo(13.00, 13.00);
        ctx.closePath();
        ctx.moveTo(0.00, 5.00);
        ctx.lineTo(1.00, 17.00);
        ctx.lineTo(-1.00, 17.00);
        ctx.closePath();
        ctx.moveTo(-13.00, 2.00);
        ctx.lineTo(-16.00, 8.00);
        ctx.lineTo(-16.00, 14.00);
        ctx.lineTo(-13.00, 13.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.beginPath();
        ctx.moveTo(-8.00, -8.00);
        ctx.lineTo(-7.00, -7.00);
        ctx.lineTo(-7.00, 15.00);
        ctx.lineTo(-8.00, 16.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -8.00);
        ctx.lineTo(7.00, -7.00);
        ctx.lineTo(7.00, 15.00);
        ctx.lineTo(8.00, 16.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, -6.00);
        ctx.lineTo(-11.00, -7.00);
        ctx.lineTo(-9.00, -7.00);
        ctx.lineTo(-8.00, -6.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-9.00, 3.00);
        ctx.lineTo(-11.00, 3.00);
        ctx.lineTo(-12.00, 2.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, 6.00);
        ctx.lineTo(-11.00, 5.00);
        ctx.lineTo(-9.00, 5.00);
        ctx.lineTo(-8.00, 6.00);
        ctx.lineTo(-8.00, 14.00);
        ctx.lineTo(-9.00, 15.00);
        ctx.lineTo(-11.00, 15.00);
        ctx.lineTo(-12.00, 14.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -6.00);
        ctx.lineTo(9.00, -7.00);
        ctx.lineTo(11.00, -7.00);
        ctx.lineTo(12.00, -6.00);
        ctx.lineTo(12.00, 2.00);
        ctx.lineTo(11.00, 3.00);
        ctx.lineTo(9.00, 3.00);
        ctx.lineTo(8.00, 2.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, 6.00);
        ctx.lineTo(9.00, 5.00);
        ctx.lineTo(11.00, 5.00);
        ctx.lineTo(12.00, 6.00);
        ctx.lineTo(12.00, 14.00);
        ctx.lineTo(11.00, 15.00);
        ctx.lineTo(9.00, 15.00);
        ctx.lineTo(8.00, 14.00);
        ctx.closePath();
        ctx.stroke();

    }

}

export class Freighter extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.25;
        this.thrust = 25;
        this.maxVelocity = 100;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 630.0 (from 157.5 to 787.5), height = 1920.0 (from 480.0 to 2400.0)
        this.boundingBox.set(42.00, 128.00);
        this.radius = 128;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: -6.00, y: 62.00, radius: 2.00 },
                { x: 6.00, y: 62.00, radius: 2.00 },
            ],
            turrets: [
                { x: 0.00, y: 15.00, radius: 2.00 },
                { x: -0.07, y: -35.00, radius: 2.13 },
            ],
            lights: [
                { x: -7.00, y: -54.00, radius: 1.00 },
                { x: 7.00, y: -54.00, radius: 1.00 },
                { x: 20.00, y: -1.00, radius: 1.00 },
                { x: -20.00, y: -1.00, radius: 1.00 },
                { x: 20.00, y: 52.00, radius: 1.00 },
                { x: -20.00, y: 52.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the ship's hull, wings, cockpit, and detail lines
     */
    drawShip(ctx, camera) {
        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-3.00, -51.00);
        ctx.lineTo(3.00, -51.00);
        ctx.lineTo(8.00, -47.00);
        ctx.lineTo(2.00, -47.00);
        ctx.lineTo(1.00, -46.00);
        ctx.lineTo(1.00, -24.00);
        ctx.lineTo(2.00, -23.00);
        ctx.lineTo(8.00, -23.00);
        ctx.lineTo(8.00, -22.00);
        ctx.lineTo(2.00, -22.00);
        ctx.lineTo(1.00, -21.00);
        ctx.lineTo(1.00, 1.00);
        ctx.lineTo(2.00, 2.00);
        ctx.lineTo(8.00, 2.00);
        ctx.lineTo(8.00, 3.00);
        ctx.lineTo(2.00, 3.00);
        ctx.lineTo(1.00, 4.00);
        ctx.lineTo(1.00, 26.00);
        ctx.lineTo(2.00, 27.00);
        ctx.lineTo(8.00, 27.00);
        ctx.lineTo(8.00, 28.00);
        ctx.lineTo(2.00, 28.00);
        ctx.lineTo(1.00, 29.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.lineTo(-1.00, 29.00);
        ctx.lineTo(-2.00, 28.00);
        ctx.lineTo(-8.00, 28.00);
        ctx.lineTo(-8.00, 27.00);
        ctx.lineTo(-2.00, 27.00);
        ctx.lineTo(-1.00, 26.00);
        ctx.lineTo(-1.00, 4.00);
        ctx.lineTo(-2.00, 3.00);
        ctx.lineTo(-8.00, 3.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-2.00, 2.00);
        ctx.lineTo(-1.00, 1.00);
        ctx.lineTo(-1.00, -21.00);
        ctx.lineTo(-2.00, -22.00);
        ctx.lineTo(-8.00, -22.00);
        ctx.lineTo(-8.00, -23.00);
        ctx.lineTo(-2.00, -23.00);
        ctx.lineTo(-1.00, -24.00);
        ctx.lineTo(-1.00, -46.00);
        ctx.lineTo(-2.00, -47.00);
        ctx.lineTo(-8.00, -47.00);
        ctx.closePath();
        ctx.moveTo(-2.00, -47.00);
        ctx.lineTo(-1.00, -46.00);
        ctx.lineTo(-1.00, -24.00);
        ctx.lineTo(-2.00, -23.00);
        ctx.lineTo(-12.00, -23.00);
        ctx.lineTo(-13.00, -24.00);
        ctx.lineTo(-13.00, -46.00);
        ctx.lineTo(-12.00, -47.00);
        ctx.closePath();
        ctx.moveTo(0.00, 50.00);
        ctx.lineTo(2.00, 52.00);
        ctx.lineTo(12.00, 52.00);
        ctx.lineTo(11.00, 55.00);
        ctx.lineTo(1.00, 57.00);
        ctx.lineTo(-1.00, 57.00);
        ctx.lineTo(-11.00, 55.00);
        ctx.lineTo(-12.00, 52.00);
        ctx.lineTo(-2.00, 52.00);
        ctx.closePath();
        ctx.moveTo(0.00, -64.00);
        ctx.lineTo(3.00, -63.00);
        ctx.lineTo(4.00, -59.00);
        ctx.lineTo(4.00, -52.00);
        ctx.lineTo(3.00, -51.00);
        ctx.lineTo(-3.00, -51.00);
        ctx.lineTo(-4.00, -52.00);
        ctx.lineTo(-4.00, -59.00);
        ctx.lineTo(-3.00, -63.00);
        ctx.closePath();
        ctx.moveTo(8.00, 62.00);
        ctx.lineTo(10.00, 60.00);
        ctx.lineTo(11.00, 55.00);
        ctx.lineTo(1.00, 57.00);
        ctx.lineTo(2.00, 60.00);
        ctx.lineTo(4.00, 62.00);
        ctx.closePath();
        ctx.moveTo(-4.00, 62.00);
        ctx.lineTo(-2.00, 60.00);
        ctx.lineTo(-1.00, 57.00);
        ctx.lineTo(-11.00, 55.00);
        ctx.lineTo(-10.00, 60.00);
        ctx.lineTo(-8.00, 62.00);
        ctx.closePath();
        ctx.moveTo(-2.00, -22.00);
        ctx.lineTo(-1.00, -21.00);
        ctx.lineTo(-1.00, 1.00);
        ctx.lineTo(-2.00, 2.00);
        ctx.lineTo(-12.00, 2.00);
        ctx.lineTo(-13.00, 1.00);
        ctx.lineTo(-13.00, -21.00);
        ctx.lineTo(-12.00, -22.00);
        ctx.closePath();
        ctx.moveTo(-2.00, 3.00);
        ctx.lineTo(-1.00, 4.00);
        ctx.lineTo(-1.00, 26.00);
        ctx.lineTo(-2.00, 27.00);
        ctx.lineTo(-12.00, 27.00);
        ctx.lineTo(-13.00, 26.00);
        ctx.lineTo(-13.00, 4.00);
        ctx.lineTo(-12.00, 3.00);
        ctx.closePath();
        ctx.moveTo(-2.00, 28.00);
        ctx.lineTo(-1.00, 29.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.lineTo(-2.00, 52.00);
        ctx.lineTo(-12.00, 52.00);
        ctx.lineTo(-13.00, 51.00);
        ctx.lineTo(-13.00, 29.00);
        ctx.lineTo(-12.00, 28.00);
        ctx.closePath();
        ctx.moveTo(2.00, 28.00);
        ctx.lineTo(1.00, 29.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(2.00, 52.00);
        ctx.lineTo(12.00, 52.00);
        ctx.lineTo(13.00, 51.00);
        ctx.lineTo(13.00, 29.00);
        ctx.lineTo(12.00, 28.00);
        ctx.closePath();
        ctx.moveTo(2.00, 3.00);
        ctx.lineTo(1.00, 4.00);
        ctx.lineTo(1.00, 26.00);
        ctx.lineTo(2.00, 27.00);
        ctx.lineTo(12.00, 27.00);
        ctx.lineTo(13.00, 26.00);
        ctx.lineTo(13.00, 4.00);
        ctx.lineTo(12.00, 3.00);
        ctx.closePath();
        ctx.moveTo(2.00, -22.00);
        ctx.lineTo(1.00, -21.00);
        ctx.lineTo(1.00, 1.00);
        ctx.lineTo(2.00, 2.00);
        ctx.lineTo(12.00, 2.00);
        ctx.lineTo(13.00, 1.00);
        ctx.lineTo(13.00, -21.00);
        ctx.lineTo(12.00, -22.00);
        ctx.closePath();
        ctx.moveTo(2.00, -47.00);
        ctx.lineTo(1.00, -46.00);
        ctx.lineTo(1.00, -24.00);
        ctx.lineTo(2.00, -23.00);
        ctx.lineTo(12.00, -23.00);
        ctx.lineTo(13.00, -24.00);
        ctx.lineTo(13.00, -46.00);
        ctx.lineTo(12.00, -47.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -62.00);
        ctx.lineTo(1.00, -62.00);
        ctx.lineTo(2.00, -58.00);
        ctx.lineTo(2.00, -56.00);
        ctx.lineTo(1.00, -55.00);
        ctx.lineTo(-1.00, -55.00);
        ctx.lineTo(-2.00, -56.00);
        ctx.lineTo(-2.00, -58.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(13.00, 31.00);
        ctx.lineTo(20.00, 43.00);
        ctx.lineTo(20.00, 52.00);
        ctx.lineTo(13.00, 51.00);
        ctx.closePath();
        ctx.moveTo(13.00, -13.00);
        ctx.lineTo(20.00, -5.00);
        ctx.lineTo(20.00, -1.00);
        ctx.lineTo(13.00, -2.00);
        ctx.closePath();
        ctx.moveTo(4.00, -59.00);
        ctx.lineTo(7.00, -56.00);
        ctx.lineTo(7.00, -54.00);
        ctx.lineTo(4.00, -54.00);
        ctx.closePath();
        ctx.moveTo(-4.00, -59.00);
        ctx.lineTo(-7.00, -56.00);
        ctx.lineTo(-7.00, -54.00);
        ctx.lineTo(-4.00, -54.00);
        ctx.closePath();
        ctx.moveTo(-13.00, -13.00);
        ctx.lineTo(-20.00, -5.00);
        ctx.lineTo(-20.00, -1.00);
        ctx.lineTo(-13.00, -2.00);
        ctx.closePath();
        ctx.moveTo(-13.00, 31.00);
        ctx.lineTo(-20.00, 43.00);
        ctx.lineTo(-20.00, 52.00);
        ctx.lineTo(-13.00, 51.00);
        ctx.closePath();
        ctx.moveTo(0.00, -13.00);
        ctx.lineTo(1.00, -1.00);
        ctx.lineTo(-1.00, -1.00);
        ctx.closePath();
        ctx.moveTo(0.00, 29.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.beginPath();
        ctx.moveTo(-8.00, -47.00);
        ctx.lineTo(-7.00, -46.00);
        ctx.lineTo(-7.00, -24.00);
        ctx.lineTo(-8.00, -23.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8.00, -22.00);
        ctx.lineTo(-7.00, -21.00);
        ctx.lineTo(-7.00, 1.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8.00, 3.00);
        ctx.lineTo(-7.00, 4.00);
        ctx.lineTo(-7.00, 26.00);
        ctx.lineTo(-8.00, 27.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8.00, 28.00);
        ctx.lineTo(-7.00, 29.00);
        ctx.lineTo(-7.00, 51.00);
        ctx.lineTo(-8.00, 52.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, 28.00);
        ctx.lineTo(7.00, 29.00);
        ctx.lineTo(7.00, 51.00);
        ctx.lineTo(8.00, 52.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, 3.00);
        ctx.lineTo(7.00, 4.00);
        ctx.lineTo(7.00, 26.00);
        ctx.lineTo(8.00, 27.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -22.00);
        ctx.lineTo(7.00, -21.00);
        ctx.lineTo(7.00, 1.00);
        ctx.lineTo(8.00, 2.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -47.00);
        ctx.lineTo(7.00, -46.00);
        ctx.lineTo(7.00, -24.00);
        ctx.lineTo(8.00, -23.00);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, -45.00);
        ctx.lineTo(-11.00, -46.00);
        ctx.lineTo(-9.00, -46.00);
        ctx.lineTo(-8.00, -45.00);
        ctx.lineTo(-8.00, -37.00);
        ctx.lineTo(-9.00, -36.00);
        ctx.lineTo(-11.00, -36.00);
        ctx.lineTo(-12.00, -37.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -45.00);
        ctx.lineTo(9.00, -46.00);
        ctx.lineTo(11.00, -46.00);
        ctx.lineTo(12.00, -45.00);
        ctx.lineTo(12.00, -37.00);
        ctx.lineTo(11.00, -36.00);
        ctx.lineTo(9.00, -36.00);
        ctx.lineTo(8.00, -37.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, -33.00);
        ctx.lineTo(-11.00, -34.00);
        ctx.lineTo(-9.00, -34.00);
        ctx.lineTo(-8.00, -33.00);
        ctx.lineTo(-8.00, -25.00);
        ctx.lineTo(-9.00, -24.00);
        ctx.lineTo(-11.00, -24.00);
        ctx.lineTo(-12.00, -25.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -33.00);
        ctx.lineTo(9.00, -34.00);
        ctx.lineTo(11.00, -34.00);
        ctx.lineTo(12.00, -33.00);
        ctx.lineTo(12.00, -25.00);
        ctx.lineTo(11.00, -24.00);
        ctx.lineTo(9.00, -24.00);
        ctx.lineTo(8.00, -25.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -20.00);
        ctx.lineTo(9.00, -21.00);
        ctx.lineTo(11.00, -21.00);
        ctx.lineTo(12.00, -20.00);
        ctx.lineTo(12.00, -12.00);
        ctx.lineTo(11.00, -11.00);
        ctx.lineTo(9.00, -11.00);
        ctx.lineTo(8.00, -12.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, -8.00);
        ctx.lineTo(9.00, -9.00);
        ctx.lineTo(11.00, -9.00);
        ctx.lineTo(12.00, -8.00);
        ctx.lineTo(12.00, 0.00);
        ctx.lineTo(11.00, 1.00);
        ctx.lineTo(9.00, 1.00);
        ctx.lineTo(8.00, 0.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, -20.00);
        ctx.lineTo(-11.00, -21.00);
        ctx.lineTo(-9.00, -21.00);
        ctx.lineTo(-8.00, -20.00);
        ctx.lineTo(-8.00, -12.00);
        ctx.lineTo(-9.00, -11.00);
        ctx.lineTo(-11.00, -11.00);
        ctx.lineTo(-12.00, -12.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, -8.00);
        ctx.lineTo(-11.00, -9.00);
        ctx.lineTo(-9.00, -9.00);
        ctx.lineTo(-8.00, -8.00);
        ctx.lineTo(-8.00, 0.00);
        ctx.lineTo(-9.00, 1.00);
        ctx.lineTo(-11.00, 1.00);
        ctx.lineTo(-12.00, 0.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, 5.00);
        ctx.lineTo(9.00, 4.00);
        ctx.lineTo(11.00, 4.00);
        ctx.lineTo(12.00, 5.00);
        ctx.lineTo(12.00, 13.00);
        ctx.lineTo(11.00, 14.00);
        ctx.lineTo(9.00, 14.00);
        ctx.lineTo(8.00, 13.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, 17.00);
        ctx.lineTo(9.00, 16.00);
        ctx.lineTo(11.00, 16.00);
        ctx.lineTo(12.00, 17.00);
        ctx.lineTo(12.00, 25.00);
        ctx.lineTo(11.00, 26.00);
        ctx.lineTo(9.00, 26.00);
        ctx.lineTo(8.00, 25.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, 5.00);
        ctx.lineTo(-11.00, 4.00);
        ctx.lineTo(-9.00, 4.00);
        ctx.lineTo(-8.00, 5.00);
        ctx.lineTo(-8.00, 13.00);
        ctx.lineTo(-9.00, 14.00);
        ctx.lineTo(-11.00, 14.00);
        ctx.lineTo(-12.00, 13.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, 17.00);
        ctx.lineTo(-11.00, 16.00);
        ctx.lineTo(-9.00, 16.00);
        ctx.lineTo(-8.00, 17.00);
        ctx.lineTo(-8.00, 25.00);
        ctx.lineTo(-9.00, 26.00);
        ctx.lineTo(-11.00, 26.00);
        ctx.lineTo(-12.00, 25.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, 30.00);
        ctx.lineTo(9.00, 29.00);
        ctx.lineTo(11.00, 29.00);
        ctx.lineTo(12.00, 30.00);
        ctx.lineTo(12.00, 38.00);
        ctx.lineTo(11.00, 39.00);
        ctx.lineTo(9.00, 39.00);
        ctx.lineTo(8.00, 38.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8.00, 42.00);
        ctx.lineTo(9.00, 41.00);
        ctx.lineTo(11.00, 41.00);
        ctx.lineTo(12.00, 42.00);
        ctx.lineTo(12.00, 50.00);
        ctx.lineTo(11.00, 51.00);
        ctx.lineTo(9.00, 51.00);
        ctx.lineTo(8.00, 50.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, 30.00);
        ctx.lineTo(-11.00, 29.00);
        ctx.lineTo(-9.00, 29.00);
        ctx.lineTo(-8.00, 30.00);
        ctx.lineTo(-8.00, 38.00);
        ctx.lineTo(-9.00, 39.00);
        ctx.lineTo(-11.00, 39.00);
        ctx.lineTo(-12.00, 38.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12.00, 42.00);
        ctx.lineTo(-11.00, 41.00);
        ctx.lineTo(-9.00, 41.00);
        ctx.lineTo(-8.00, 42.00);
        ctx.lineTo(-8.00, 50.00);
        ctx.lineTo(-9.00, 51.00);
        ctx.lineTo(-11.00, 51.00);
        ctx.lineTo(-12.00, 50.00);
        ctx.closePath();
        ctx.stroke();

    }

}

export class Arrow extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.5;
        this.thrust = 300;
        this.maxVelocity = 600;
        this.setupTrail();
    }

    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 480.0 (from 120.0 to 600.0), height = 690.0 (from 172.5 to 862.5)
        this.boundingBox.set(32.00, 46.00);
        this.radius = 46;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: -5.00, y: 20.00, radius: 2.00 },
                { x: 5.00, y: 20.00, radius: 2.00 },
                { x: 0.00, y: 20.00, radius: 2.00 },
            ],
            turrets: [
            ],
            lights: [
                { x: -15.00, y: 22.00, radius: 1.00 },
                { x: 15.00, y: 22.00, radius: 1.00 },
                { x: -5.00, y: -1.00, radius: 1.00 },
                { x: 5.00, y: -1.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the Ships hull, wings and cockpit
     */
    drawShip(ctx, camera) {
        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-7.00, 8.00);
        ctx.lineTo(-3.00, 8.00);
        ctx.lineTo(-3.00, 20.00);
        ctx.lineTo(-7.00, 20.00);
        ctx.closePath();
        ctx.moveTo(3.00, 8.00);
        ctx.lineTo(7.00, 8.00);
        ctx.lineTo(7.00, 20.00);
        ctx.lineTo(3.00, 20.00);
        ctx.closePath();
        ctx.moveTo(3.00, 8.00);
        ctx.lineTo(3.00, 19.00);
        ctx.lineTo(-3.00, 19.00);
        ctx.lineTo(-3.00, 8.00);
        ctx.lineTo(-3.00, 4.00);
        ctx.lineTo(-2.00, -20.00);
        ctx.lineTo(-1.00, -22.00);
        ctx.lineTo(0.00, -23.00);
        ctx.lineTo(1.00, -22.00);
        ctx.lineTo(2.00, -20.00);
        ctx.lineTo(3.00, 4.00);
        ctx.lineTo(3.00, 8.00);
        ctx.moveTo(-2.00, 8.00);
        ctx.lineTo(2.00, 8.00);
        ctx.lineTo(2.00, 20.00);
        ctx.lineTo(-2.00, 20.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -12.00);
        ctx.lineTo(1.00, -12.00);
        ctx.lineTo(2.00, -8.00);
        ctx.lineTo(-2.00, -8.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(-2.00, -4.00);
        ctx.lineTo(-5.00, -2.00);
        ctx.lineTo(-5.00, -1.00);
        ctx.lineTo(-2.00, -2.00);
        ctx.closePath();
        ctx.moveTo(2.00, -4.00);
        ctx.lineTo(5.00, -2.00);
        ctx.lineTo(5.00, -1.00);
        ctx.lineTo(2.00, -2.00);
        ctx.closePath();
        ctx.moveTo(7.00, 14.00);
        ctx.lineTo(15.00, 18.00);
        ctx.lineTo(15.00, 21.00);
        ctx.lineTo(15.00, 22.00);
        ctx.lineTo(7.00, 19.00);
        ctx.closePath();
        ctx.moveTo(-7.00, 14.00);
        ctx.lineTo(-15.00, 18.00);
        ctx.lineTo(-15.00, 21.00);
        ctx.lineTo(-15.00, 22.00);
        ctx.lineTo(-7.00, 19.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class Boxwing extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.25;
        this.thrust = 25;
        this.maxVelocity = 100;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 270.0 (from 67.5 to 337.5), height = 262.6 (from 65.6 to 328.2)
        this.boundingBox.set(18.00, 17.50);
        this.radius = 18;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: -8.01, y: -2.76, radius: 0.50 },
                { x: 7.99, y: -2.74, radius: 0.50 },
                { x: 5.98, y: 8.25, radius: 0.50 },
                { x: -6.01, y: 8.25, radius: 0.50 },
            ],
            turrets: [
            ],
            lights: [
                { x: 8.00, y: -6.75, radius: 1.00 },
                { x: -8.00, y: -6.75, radius: 1.00 },
                { x: -6.00, y: 4.25, radius: 1.00 },
                { x: 6.00, y: 4.25, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the ship's hull, wings, cockpit, and detail lines
     */
    drawShip(ctx, camera) {
        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-4.00, -7.75);
        ctx.lineTo(-3.00, -8.75);
        ctx.lineTo(3.00, -8.75);
        ctx.lineTo(4.00, -7.75);
        ctx.lineTo(4.00, 7.25);
        ctx.lineTo(-4.00, 7.25);
        ctx.closePath();
        ctx.moveTo(7.00, -5.75);
        ctx.lineTo(8.00, -6.75);
        ctx.lineTo(9.00, -5.75);
        ctx.lineTo(9.00, -2.75);
        ctx.lineTo(7.00, -2.75);
        ctx.closePath();
        ctx.moveTo(5.00, 5.25);
        ctx.lineTo(6.00, 4.25);
        ctx.lineTo(7.00, 5.25);
        ctx.lineTo(7.00, 8.25);
        ctx.lineTo(5.00, 8.25);
        ctx.closePath();
        ctx.moveTo(-7.00, -5.75);
        ctx.lineTo(-8.00, -6.75);
        ctx.lineTo(-9.00, -5.75);
        ctx.lineTo(-9.00, -2.75);
        ctx.lineTo(-7.00, -2.75);
        ctx.closePath();
        ctx.moveTo(-5.00, 5.25);
        ctx.lineTo(-6.00, 4.25);
        ctx.lineTo(-7.00, 5.25);
        ctx.lineTo(-7.00, 8.25);
        ctx.lineTo(-5.00, 8.25);
        ctx.closePath();
        ctx.moveTo(-3.00, 7.25);
        ctx.lineTo(3.00, 7.25);
        ctx.lineTo(2.00, 8.25);
        ctx.lineTo(-2.00, 8.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-3.00, -6.75);
        ctx.lineTo(-2.00, -5.75);
        ctx.lineTo(-2.00, -4.75);
        ctx.lineTo(-3.00, -4.75);
        ctx.closePath();
        ctx.moveTo(3.00, -6.75);
        ctx.lineTo(3.00, -4.75);
        ctx.lineTo(2.00, -4.75);
        ctx.lineTo(2.00, -5.75);
        ctx.closePath();
        ctx.moveTo(-3.00, -7.75);
        ctx.lineTo(3.00, -7.75);
        ctx.lineTo(2.00, -6.75);
        ctx.lineTo(-2.00, -6.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(4.00, -3.75);
        ctx.lineTo(7.00, -5.75);
        ctx.lineTo(7.00, -3.75);
        ctx.lineTo(4.00, -1.75);
        ctx.closePath();
        ctx.moveTo(4.00, 4.25);
        ctx.lineTo(5.00, 5.25);
        ctx.lineTo(5.00, 7.25);
        ctx.lineTo(4.00, 6.25);
        ctx.closePath();
        ctx.moveTo(-4.00, -3.75);
        ctx.lineTo(-7.00, -5.75);
        ctx.lineTo(-7.00, -3.75);
        ctx.lineTo(-4.00, -1.75);
        ctx.closePath();
        ctx.moveTo(-4.00, 4.25);
        ctx.lineTo(-5.00, 5.25);
        ctx.lineTo(-5.00, 7.25);
        ctx.lineTo(-4.00, 6.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.beginPath();
        ctx.moveTo(-2.00, -2.75);
        ctx.lineTo(-1.00, -3.75);
        ctx.lineTo(1.00, -3.75);
        ctx.lineTo(2.00, -2.75);
        ctx.lineTo(2.00, 5.25);
        ctx.lineTo(1.00, 6.25);
        ctx.lineTo(-1.00, 6.25);
        ctx.lineTo(-2.00, 5.25);
        ctx.closePath();
        ctx.stroke();

    }

}

export class Interceptor extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 2;
        this.thrust = 1000;
        this.maxVelocity = 1000;
        this.setupTrail();
    }

    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 450.0 (from 112.5 to 562.5), height = 825.0 (from 206.3 to 1031.3)
        this.boundingBox.set(30.00, 55.00);
        this.radius = 55;
    }

    /**
     * Sets up the engine, turret and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 7.00, y: 20.50, radius: 1.00 },
                { x: -7.00, y: 20.50, radius: 1.00 },
                { x: 0.00, y: 23.50, radius: 3.00 },
            ],
            turrets: [
            ],
            lights: [
                { x: -14.00, y: 14.50, radius: 1.00 },
                { x: 14.00, y: 14.50, radius: 1.00 },
            ]
        };
    }

    /**
     * Draws the ship's hull, wings, cockpit, and detail lines
     */
    drawShip(ctx, camera) {
        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -27.50);
        ctx.lineTo(-2.00, -24.50);
        ctx.lineTo(-3.00, 7.50);
        ctx.lineTo(-5.00, 11.50);
        ctx.lineTo(-5.00, 19.50);
        ctx.lineTo(-3.00, 23.50);
        ctx.lineTo(-1.00, 24.50);
        ctx.lineTo(0.00, 27.50);
        ctx.lineTo(1.00, 24.50);
        ctx.lineTo(3.00, 23.50);
        ctx.lineTo(5.00, 19.50);
        ctx.lineTo(5.00, 11.50);
        ctx.lineTo(3.00, 7.50);
        ctx.lineTo(2.00, -24.50);
        ctx.closePath();
        ctx.moveTo(-9.00, 19.50);
        ctx.lineTo(-8.00, 20.50);
        ctx.lineTo(-6.00, 20.50);
        ctx.lineTo(-5.00, 19.50);
        ctx.closePath();
        ctx.moveTo(5.00, 19.50);
        ctx.lineTo(9.00, 19.50);
        ctx.lineTo(8.00, 20.50);
        ctx.lineTo(6.00, 20.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, 16.50);
        ctx.lineTo(1.00, 16.50);
        ctx.lineTo(2.00, 19.50);
        ctx.lineTo(2.00, 20.50);
        ctx.lineTo(1.00, 21.50);
        ctx.lineTo(-1.00, 21.50);
        ctx.lineTo(-2.00, 20.50);
        ctx.lineTo(-2.00, 19.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(2.00, -24.50);
        ctx.lineTo(14.00, 14.50);
        ctx.lineTo(12.00, 19.50);
        ctx.lineTo(5.00, 19.50);
        ctx.lineTo(5.00, 11.50);
        ctx.lineTo(3.00, 7.50);
        ctx.closePath();
        ctx.moveTo(-2.00, -24.50);
        ctx.lineTo(-14.00, 14.50);
        ctx.lineTo(-12.00, 19.50);
        ctx.lineTo(-5.00, 19.50);
        ctx.lineTo(-5.00, 11.50);
        ctx.lineTo(-3.00, 7.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(0.00, 13.50);
        ctx.lineTo(-1.00, 13.50);
        ctx.lineTo(-3.00, 18.50);
        ctx.lineTo(-3.00, 11.50);
        ctx.lineTo(-1.00, 7.50);
        ctx.lineTo(0.00, -24.50);
        ctx.lineTo(1.00, 7.50);
        ctx.lineTo(3.00, 11.50);
        ctx.lineTo(3.00, 18.50);
        ctx.lineTo(1.00, 13.50);
        ctx.lineTo(0.00, 13.50);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, 11.50);
        ctx.lineTo(-4.00, -12.50);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(9.00, 11.50);
        ctx.lineTo(4.00, -12.50);
        ctx.stroke();
    }
}

// Factory function to create a random ship type
export function createRandomShip(x, y, starSystem) {
    const shipClasses = [Flivver, Shuttle, HeavyShuttle, StarBarge, Freighter, Arrow, Boxwing, Interceptor];
    //const shipClasses = [Boxwing];
    const RandomShipClass = shipClasses[Math.floor(Math.random() * shipClasses.length)];
    return new RandomShipClass(x, y, starSystem);
}