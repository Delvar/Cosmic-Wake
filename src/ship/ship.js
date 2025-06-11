// /src/ship/ship.js

import { Vector2D } from '/src/core/vector2d.js';
import { Trail } from '/src/ship/trail.js';
import { Colour } from '/src/core/colour.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { CelestialBody, JumpGate } from '/src/starSystem/celestialBody.js';
import { TWO_PI, clamp, remapClamp, normalizeAngle, randomBetween, removeAtIndexInPlace } from '/src/core/utils.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { Shield } from '/src/ship/shield.js';
import { Turret } from '/src/weapon/turret.js';
import { FixedWeapon } from '/src/weapon/fixedWeapon.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { Pilot, PlayerPilot } from '/src/pilot/pilot.js';
import { StarSystem } from '/src/starSystem/starSystem.js';
import { Camera } from '/src/camera/camera.js';
import { FlyToTargetAutopilot } from '/src/autopilot/autopilot.js';
import { Faction, FactionRelationship } from '/src/core/faction.js';

//Colours used for the lights
const colourRed = new Colour(1.0, 0.0, 0.0);
const colourGreen = new Colour(0.0, 1.0, 0.0);
const colourBlue = new Colour(0.0, 0.0, 1.0);
const colourWhite = new Colour(1.0, 1.0, 1.0);

/**
 * Generates a random, sometimes quirky, name for a ship.
 * @returns {string} the generated name.
 */
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
 * Checks if a target is still valid (not despawned and exists in the galaxy).
 * @param {Ship} source - The source game object to validate.
 * @param {Ship} target - The target game object to validate.
 * @returns {boolean} True if the target is valid, false otherwise.
 */
export function isValidAttackTarget(source, target) {
    if (!(source instanceof Ship)) return false;
    if (!(target instanceof Ship)) return false;
    if (!isValidTarget(source, target)) return false;
    if (target.state !== 'Flying' && target.state !== 'Disabled') return false;
    if (source.getRelationship(target) === FactionRelationship.Allied) return false;
    return true;
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
     * @param {StarSystem} starSystem - The star system the ship is in.
     * @param {Faction} faction - The faction the ship belongs to.
     */
    constructor(x, y, starSystem, faction) {
        super(new Vector2D(x, y), starSystem);

        /** @type {Faction} The faction the ship belongs to. */
        this.faction = faction;
        /** @type {Ship[]} List of hostile ships. */
        this.hostiles = [];
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
        /**
         * @type {Object} Colors for cockpit, wings, and hull.
         * @property {Colour} cockpit - The color of the ship's cockpit, generated randomly.
         * @property {Colour} wings - The color of the ship's wings, generated randomly.
         * @property {Colour} hull - The grayscale color of the ship's hull, generated randomly.
         */
        this.colors = {
            cockpit: this.generateRandomWindowColour(),
            wings: this.generateRandomColor(),
            hull: this.generateRandomGrey()
        };

        /** @type {GameObject|null} Current target (e.g., planet, asteroid, ship). */
        this.target = null;
        /** @type {Ship|null} the last Ship to cause damage. */
        this.lastAttacker = null;
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
            'JumpingIn': this.updateJumpingIn.bind(this),
            'Disabled': this.updateDisabled.bind(this),
            'Exploding': this.updateExploding.bind(this)
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
        /** @type {number} Hull percentage below which the ship becomes disabled. */
        this.disabledThreshold = 10;

        /** @type {number} Angular velocity in radians per second for rotation. */
        this.angularVelocity = 0;
        /** @type {number} Maximum angular velocity in radians per second. */
        this.maxAngularVelocity = TWO_PI; // One full rotation per second
        /** @type {number} Time until next explosion in seconds. */
        this.explosionDelay = 0.0;
        /** @type {number} Base force magnitude for explosion impulses (units/s²). */
        this.explosionForce = 30.0;
        /** @type {number} Base torque for explosion impulses (rad/s). */
        this.explosionTorque = 30.0;
        /** @type {number} Time elapsed since last explosion (seconds). */
        this.explosionTime = 0;
        /** @type {Array<{position: Vector2D, time: number, force: number}>} Recent explosion positions for debug visuals. */
        this._recentExplosions = Array(5).fill().map(() => ({ position: new Vector2D(0, 0), time: -Infinity, force: 0 }));
        /** @type {Turret[]} Array of turrets. */
        this.turrets = [];
        /** @type {string} the mode of the turrest 'Full-auto', 'Auto-target', 'Target-only', 'Disabled'. */
        this.turretMode = 'Full-auto';
        /** @type {FixedWeapon[]} Array of fixed weapons. */
        this.fixedWeapons = [];
        /** @type {string} Current mode for the lights (e.g., 'Normal', 'Flicker', 'Disabled', 'Warden'). */
        this.lightMode = 'Normal';

        // Initialize feature points and bounding box
        this.setupFeaturePoints();
        this.setupBoundingBox();
        this.setupTurrets();
        this.setupFixedWeapons();

        //Calculate hull and shields, bigger ships have higher hull and shields
        const area = (this.radius ** 2) * Math.PI * 0.1;
        /** @type {Shield} The ship's energy shield. */
        this.shield = new Shield(area * 2.0, 1, 10, area * 0.1, 4);
        /** @type {number} Maximum hull health. */
        this.maxHull = area;
        /** @type {number} Current hull health. */
        this.hullIntegrity = this.maxHull;

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
        /** @type {Vector2D} Temporary vector for explosion position. */
        this._scratchExplosionPos = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for explosion force. */
        this._scratchForce = new Vector2D(0, 0);
    }

    /**
     * Gets the effective relationship with another ship, considering faction and hostiles list.
     * @param {Ship} otherShip - The other ship to check.
     * @returns {number} The relationship (FactionRelationship value).
     */
    getRelationship(otherShip) {
        if (!(otherShip instanceof Ship)) {
            return FactionRelationship.Neutral;
        }
        if (this.hostiles.includes(otherShip) || otherShip.hostiles.includes(this)) {
            return FactionRelationship.Hostile;
        }
        return this.faction.getRelationship(otherShip.faction);
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
            turrets: [], // Turret positions
            fixedWeapons: [], // Fixed gun positions
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
     * Sets up turrets from featurePoints.turrets.
     */
    setupTurrets() {
        this.turrets = [];
        for (const feature of this.featurePoints.turrets) {
            const relativePosition = new Vector2D(feature.x, feature.y);
            this.turrets.push(new Turret(relativePosition, feature.radius));
        }
    }

    /**
     * Sets up fixed weapons from featurePoints.fixedWeapons.
     */
    setupFixedWeapons() {
        this.fixedWeapons = this.featurePoints.fixedWeapons.map(feature =>
            new FixedWeapon(new Vector2D(feature.x, feature.y), feature.radius)
        );
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
    generateRandomWindowColour() {
        const r = randomBetween(0.5, 0.8);
        const g = randomBetween(0.5, 0.8);
        const b = randomBetween(0.9, 1);
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
        const shade = randomBetween(0.4, 0.7); // Light to dark grey
        return new Colour(shade, shade, shade);
    }

    /**
     * Sets the pilot for this ship.
     * @param {Pilot} pilot - The pilot to control the ship.
     */
    setPilot(pilot) {
        this.pilot = pilot;
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

        if (newState === 'Disabled' && this.lightMode !== 'Flicker') {
            this.lightMode = 'Flicker';
        } else if (this.lightMode !== 'Normal') {
            this.lightMode = 'Normal';
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
        if (this.state === 'Flying') {
            this.isThrusting = thrusting == true;
        } else {
            this.isThrusting = false;
        }
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
        this.lastJumpTime = this.age;
        this.isThrusting = false;
        this.isBraking = false;
        return true;
    }

    /**
     * Fires all the ship's weapons.
     */
    fire() {
        if (this.state !== 'Flying') return;
        this.fireFixedWeapons();
        this.fireTurrets();
    }

    /**
     * Fires the ship's fixed weapons.
     */
    fireFixedWeapons() {
        if (this.state !== 'Flying') return;
        for (const fixedWeapon of this.fixedWeapons) {
            fixedWeapon.fire(this, this.starSystem.projectileManager);
        }
    }

    /**
     * Fires the ship's turrets.
     */
    fireTurrets() {
        if (this.state !== 'Flying') return;
        for (const turret of this.turrets) {
            turret.fire(this, this.starSystem.projectileManager);
        }
    }

    /**
     * Applies damage to the ship, processing through shields and hull.
     * @param {number} damage - Amount of damage to apply.
     * @param {Vector2D} hitPosition - World-space position of the hit.
     * @param {Ship} source - Ship causing damage.
     */
    takeDamage(damage, hitPosition, source) {
        if (source instanceof Ship && isValidAttackTarget(this, source)) {
            this.lastAttacker = source;
            // Add to hostiles if Hostile or deliberately targeted (ensured by projectile logic)
            const relationship = this.getRelationship(source);
            if ((relationship === FactionRelationship.Hostile || source.target === this) && !this.hostiles.includes(source)) {
                this.hostiles.push(source);
            }
        }

        let excessDamage = damage;
        if (this.shield && this.shield.isActive) {
            excessDamage = this.shield.takeDamage(damage, hitPosition, this.position, this.age);
        }

        //Debug: player takes no hull damage
        if (this.pilot instanceof PlayerPilot) {
            excessDamage = 0;
        }

        if (excessDamage > 0) {
            if (this.hullIntegrity < 0) {
                excessDamage = 1;
            }
            this.hullIntegrity = Math.max(this.hullIntegrity - excessDamage, -50);
        }

        if (this.pilot instanceof AiPilot) {
            this.pilot.onDamage(damage, source);
        }
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

        // Remove despawned ships from hostiles without allocations
        for (let i = this.hostiles.length - 1; i >= 0; i--) {
            if (!isValidAttackTarget(this, this.hostiles[i])) {
                removeAtIndexInPlace(i, this.hostiles);
            }
        }

        if (!isValidAttackTarget(this, this.lastAttacker)) {
            if (this.hostiles.length > 0) {
                this.lastAttacker = this.hostiles[0];
            } else {
                this.lastAttacker = null;
            }
        }

        if (this.target?.isDespawned()) {
            this.clearTarget();
        }

        // Update turrets and fixed weapons
        for (const turret of this.turrets) {
            turret.update(deltaTime, this);
        }
        for (const fixedWeapon of this.fixedWeapons) {
            fixedWeapon.update(deltaTime);
        }

        // Update shield
        if (this.shield) {
            this.shield.update(deltaTime, this.age);
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
        // Check for Disabled or Exploding state transitions
        if (this.hullIntegrity <= this.disabledThreshold) {
            this.setState('Disabled');
            this.isThrusting = false;
            this.isBraking = false;
            this.shield.isActive = false;
            this.shield.strength = 0;
            this.shield.restartTime = null;
            this.target = null;
            return;
        }

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
                this.hullIntegrity = this.maxHull;
                this.shield.isActive = true;
                this.shield.strength = this.shield.maxStrength;
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
     * Updates the ship in the 'Disabled' state, decelerating.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateDisabled(deltaTime) {
        // Check for transition to Exploding
        if (this.hullIntegrity <= 0) {
            this.setState('Exploding');
            this.pilot = null; // Disable pilot controls!
            this.explosionTime = 0; // Initialize explosion timer
            this.isThrusting = false;
            this.isBraking = false;
            this.shield.isActive = false;
            this.shield.strength = 0;
            this.shield.restartTime = null;
            this.target = null;
            return;
        }

        // Decelerate: reduce velocity if significant
        if (this.velocity.squareMagnitude() > 1) {
            this.velocity.multiplyInPlace(1 - (0.1 * deltaTime)); // 10% loss per second
            // Update position based on velocity
            this._scratchVelocityDelta.set(this.velocity).multiplyInPlace(deltaTime);
            this.position.addInPlace(this._scratchVelocityDelta);
        } else {
            this.velocity.set(0, 0); // Dead stop
        }
    }

    /**
     * Updates the ship in the 'Exploding' state, triggering explosions based on hull integrity.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateExploding(deltaTime) {
        this.velocity.multiplyInPlace(1 - (0.1 * deltaTime)); // 10% loss per second

        this.explosionTime += deltaTime;

        // Compute lerp factor based on hullIntegrity (0 at hull=0, 1 at hull=-50)
        const t = clamp(this.hullIntegrity / -50, 0, 1);

        // Check for final explosion and despawn
        if (this.hullIntegrity <= -50) {
            // Trigger large final explosion
            this._scratchExplosionPos.set(this.position);
            // Store for debug visuals
            const explosionEntry = this._recentExplosions.shift();
            explosionEntry.position.set(this._scratchExplosionPos);
            explosionEntry.time = this.age;
            explosionEntry.force = this.explosionForce * 5;
            this._recentExplosions.push(explosionEntry);

            this.starSystem.particleManager.spawnExplosion(this._scratchExplosionPos, this.radius * 2, this.velocity);

            // Despawn the ship
            this.despawn();

            if (this.debug) {
                console.log(`Ship ${this.name} despawned with final explosion at (${this._scratchExplosionPos.x.toFixed(2)}, ${this._scratchExplosionPos.y.toFixed(2)})`);
            }
            return;
        }

        // Trigger explosion if time exceeds delay
        if (this.explosionTime >= this.explosionDelay) {
            const explosionSizeRatio = randomBetween(0.0, 1.0);

            //Get the size of the explosion
            const explosionRadius = clamp(this.radius * remapClamp(explosionSizeRatio, 0, 1, 0.01, 0.25), 1, 300);
            // Calculate next explosion time
            const baseInterval = remapClamp(1 - t, 0, 1, 0.1, 2);
            const nextExplosionTime = baseInterval * randomBetween(0.75, 1.25) * explosionSizeRatio;

            // Calculate scaled force and torque
            const currentForce = this.explosionForce * explosionSizeRatio;
            const currentTorque = this.explosionTorque * explosionSizeRatio;

            // Generate random explosion position within rotated bounding box
            this._getRandomPointInBoundingBox(this._scratchExplosionPos);
            this._applyExplosionImpulse(this._scratchExplosionPos, currentForce, currentTorque);

            // Store for debug visuals
            const explosionEntry = this._recentExplosions.shift();
            explosionEntry.position.set(this._scratchExplosionPos);
            explosionEntry.time = this.age;
            explosionEntry.force = this.explosionForce;
            this._recentExplosions.push(explosionEntry);

            // Spawn particles with scaled radius
            this.starSystem.particleManager.spawnExplosion(this._scratchExplosionPos, explosionRadius, this.velocity);

            // Reduce hull integrity
            const hullReduction = 1 + (2 * explosionSizeRatio);
            this.hullIntegrity = Math.max(this.hullIntegrity - hullReduction, -50);

            // Update explosion delay
            this.explosionDelay = this.explosionTime + nextExplosionTime;

            if (this.debug) {
                console.log(`Explosion at (${this._scratchExplosionPos.x.toFixed(2)}, ${this._scratchExplosionPos.y.toFixed(2)}), hullIntegrity: ${this.hullIntegrity.toFixed(2)}, nextExplosionTime: ${nextExplosionTime.toFixed(2)}s`);
            }
        }

        // Update position based on velocity
        this._scratchVelocityDelta.set(this.velocity).multiplyInPlace(deltaTime);
        this.position.addInPlace(this._scratchVelocityDelta);

        // Update angle based on angular velocity
        this.angle += this.angularVelocity * deltaTime;
        this.angle = normalizeAngle(this.angle);

        // Cap angular velocity
        if (Math.abs(this.angularVelocity) > this.maxAngularVelocity) {
            this.angularVelocity = Math.sign(this.angularVelocity) * this.maxAngularVelocity;
        }
    }

    /**
     * Generates a random point within the ship's rotated bounding box.
     * @param {Vector2D} out - The vector to store the world-space position.
     */
    _getRandomPointInBoundingBox(out) {
        // Generate random point in unrotated bounding box, centered at (0,0)
        const halfWidth = this.boundingBox.x * 0.5;
        const halfHeight = this.boundingBox.y * 0.5;
        const x = randomBetween(-halfWidth, halfWidth);
        const y = randomBetween(-halfHeight, halfHeight);

        // Rotate point by ship angle
        const cosAngle = Math.cos(this.angle);
        const sinAngle = Math.sin(this.angle);
        const rotatedX = x * cosAngle - y * sinAngle;
        const rotatedY = x * sinAngle + y * cosAngle;

        // Translate to world position
        out.set(rotatedX, rotatedY).addInPlace(this.position);
    }

    /**
     * Applies a physics impulse for an explosion at the given position.
     * @param {Vector2D} explosionPos - World-space position of the explosion.
     */
    _applyExplosionImpulse(explosionPos, currentForce, currentTorque) {
        // Calculate force direction (randomized)
        const forceAngle = randomBetween(0, TWO_PI);
        this._scratchForce.setFromPolar(currentForce, forceAngle);

        // Apply linear force to velocity
        this.velocity.addInPlace(this._scratchForce.multiplyInPlace(1 / 60)); // Scale for 60 FPS

        // Calculate torque: cross product of (explosionPos - shipPos) and force
        this._scratchTemp.set(explosionPos).subtractInPlace(this.position);
        const torque = this._scratchTemp.x * this._scratchForce.y - this._scratchTemp.y * this._scratchForce.x;
        this.angularVelocity += (torque / (this.radius * this.radius)) * currentTorque;

        // Debug log for torque
        if (this.debug) {
            console.log(`Explosion at (${explosionPos.x.toFixed(2)}, ${explosionPos.y.toFixed(2)}), torque: ${torque.toFixed(2)}`);
        }
    }

    /**
     * Renders the ship and its visual effects to the canvas.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object for world-to-screen conversion.
     */
    draw(ctx, camera) {
        // Draw trail if visible and scaled
        if (this.trail && this.shipScale > 0 && camera.isBoxInView(this.trail.boundsMin, this.trail.boundsMax, this.trail.startWidth)) {
            this.trail.draw(ctx, camera, this.shipScale);
        }

        // Skip rendering if fully scaled down (e.g., landed on planet)
        if (this.shipScale <= 0) {
            return;
        }

        const scale = camera.zoom * this.shipScale;

        // Render ship if within camera view
        if (camera.isInView(this.position, this.radius)) {
            ctx.save();
            camera.worldToScreen(this.position, this._scratchScreenPos);
            ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.rotate(this.angle);
            ctx.scale(scale, scale * this.stretchFactor);
            this.drawEngines(ctx, camera);
            this.drawShip(ctx, camera);
            this.drawWindows(ctx, camera);
            this.drawTurrets(ctx, camera);
            this.drawLights(ctx, camera);
            ctx.restore();
        }

        // Draw shield effect and debug in untransformed context
        if (camera.isInView(this.position, this.radius)) {
            ctx.save();
            this.drawShieldEffect(ctx, camera);
            this.drawDebug(ctx, camera, scale);
            ctx.restore();
        }

        // Draw explosion debug visuals
        if (this.debug || camera.debug) {
            ctx.save();
            for (let i = 0; i < this._recentExplosions.length; i++) {
                const explosion = this._recentExplosions[i];
                if (this.age - explosion.time > 1) continue; // Skip expired explosions
                camera.worldToScreen(explosion.position, this._scratchScreenPos);
                const opacity = 1 - (this.age - explosion.time); // Fade over 1s
                const visualRadius = (explosion.force / this.explosionForce) * 5 * scale; // Scale by force
                ctx.fillStyle = `rgba(128, 0, 128, ${opacity})`; // Purple
                ctx.beginPath();
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, visualRadius, 0, TWO_PI);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    /**
     * Draws the shield effect using the Shield class.
     * @param {CanvasRenderingContext2D} ctx - Canvas context.
     * @param {Camera} camera - Camera for world-to-screen transform.
     */
    drawShieldEffect(ctx, camera) {
        this.shield.draw(ctx, camera, this.position, this.radius);
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(0.0, 0.0);
        ctx.closePath();
    }

    /**
     * Draws the ship's main body
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
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
     * @param {Camera} camera - The camera object.
     */
    drawEngines(ctx, camera) {
        if (this.thrustTime <= 0) return; // Skip if no thrust effect
        ctx.save()
        ctx.globalCompositeOperation = "hard-light";
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
        ctx.restore();
    }

    /**
     * Draws turrets as rectangles (base + barrel).
     * @param {CanvasRenderingContext2D} ctx - Canvas context.
     * @param {Camera} camera - Camera for transform.
     */
    drawTurrets(ctx, camera) {
        if (!this.turrets || this.turrets.length == 0) return;

        ctx.save();
        ctx.fillStyle = 'rgb(100, 100, 100)';
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        for (const turret of this.turrets) {
            const screenX = turret.relativePosition.x;
            const screenY = turret.relativePosition.y;
            ctx.save();
            ctx.translate(screenX, screenY);

            // Mount: Circle
            ctx.beginPath();
            ctx.arc(0, 0, turret.radius, 0, TWO_PI);
            ctx.fillStyle = 'rgb(100, 100, 100)';
            ctx.fill();
            ctx.stroke();

            ctx.rotate(turret.direction);
            ctx.beginPath();
            // Base: 1.2 × 2 rectangle
            const baseWidth = turret.radius * 0.6;
            const baseLength = turret.radius;
            ctx.moveTo(-baseWidth, -baseLength);
            ctx.lineTo(baseWidth, -baseLength);
            ctx.lineTo(baseWidth, baseLength);
            ctx.lineTo(-baseWidth, baseLength);
            ctx.closePath();
            // Barrel: 0.2 × 2 rectangle
            const barrelWidth = turret.radius * 0.2;
            const barrelLength = baseLength + turret.radius * 2;
            ctx.moveTo(-barrelWidth, -barrelLength);
            ctx.lineTo(barrelWidth, -barrelLength);
            ctx.lineTo(barrelWidth, -baseLength);
            ctx.lineTo(-barrelWidth, -baseLength);
            ctx.closePath();
            ctx.fillStyle = 'rgb(128, 128, 128)';
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    /**
     * Draws blinking navigation lights.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    drawLights(ctx, camera) {
        if (this.state === 'Exploding') return;

        for (let i = 0; i < this.featurePoints.lights.length; i++) {
            const light = this.featurePoints.lights[i];
            let brightness = 1;
            let colour = colourWhite;

            if (this.lightMode === 'Flicker') {
                let blink = Math.abs(Math.sin(107 + i * 0.3 + this.age * 1.3) * Math.cos(113 + i * 0.2 + this.age * 1.5));
                blink = blink < 0.8 ? 0 : blink;
                brightness = Math.abs(Math.sin(109 + i * 2.0 + this.age * 13) * Math.cos(127 + i * 3.5 + this.age * 7));
                brightness = (brightness *= blink) > 0.50 ? 1 : brightness;
                brightness *= blink;
            } else if (this.lightMode === 'Warden') {
                // Cycle time for two full cycles per second (0.5s per cycle)
                const cycleTime = this.age % 0.5;
                // Each phase lasts 1/16s (0.0625s)
                const phaseDuration = 0.0625;
                // Determine which phase we're in (0 to 7)
                const phase = Math.floor(cycleTime / phaseDuration);

                if (light.x < -3) {
                    // Left side (red): On for phase 0 and 2, off for 1 and 3
                    brightness = (phase === 0 || phase === 2) ? 1 : 0;
                } else if (light.x > 3) {
                    // Right side (blue): On for phase 4 and 6, off for 5 and 7
                    brightness = (phase === 4 || phase === 6) ? 1 : 0;
                } else {
                    // Center lights: Off in Warden mode
                    brightness = 0;
                }
            } else {
                const sinAge = Math.sin((this.age * 5) - (light.y / this.boundingBox.y));
                brightness = Math.max(0, sinAge) ** 8;
            }

            if (light.x < -3) {
                // Left: Red
                colour = colourRed;
            } else if (light.x > 3) {
                // Right: Green or Blue
                if (this.lightMode === 'Warden') {
                    colour = colourBlue;
                } else {
                    colour = colourGreen;
                }
            } else {
                // Center: White
                colour = colourWhite;
            }

            const lightRadius = light.radius * (this.lightMode === 'Warden' ? 20 : 5) * brightness;

            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, lightRadius);
            gradient.addColorStop(0, colourWhite.toRGBA(brightness * 0.75));
            gradient.addColorStop(0.05, colourWhite.toRGBA(brightness * 0.5));
            gradient.addColorStop(0.2, colour.toRGBA(brightness * 0.25));
            gradient.addColorStop(1, colour.toRGBA(0));
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(light.x, light.y);
            ctx.arc(light.x, light.y, lightRadius, 0, TWO_PI);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Draws the ship's windows/cockpit.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    drawWindows(ctx, camera) {
        // Draw the cockpit
        ctx.save();
        let brightness = 1;
        let colour;

        if (this.state === 'Disabled') {
            let blink = Math.abs(Math.sin(this.age * 1.35) * Math.cos(this.age * 1.55));
            blink = blink < 0.8 ? 0 : blink;
            brightness = Math.abs(Math.sin(this.age * 13) * Math.cos(this.age * 7));
            brightness = (brightness *= blink) > 0.50 ? 1 : brightness;
            brightness *= blink;
            colour = this.colors.cockpit.clone();
            const multiplier = 0.2 + brightness * 0.8;
            colour.r *= multiplier;
            colour.g *= multiplier;
            colour.b *= multiplier;
        } else if (this.state === 'Exploding') {
            colour = this.colors.cockpit.clone();
            colour.r *= 0.2;
            colour.g *= 0.2;
            colour.b *= 0.2;
        } else {
            colour = this.colors.cockpit;
        }

        const colourString = colour.toRGB();
        ctx.fillStyle = colourString;
        this.getWindowPath(ctx, camera);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draws debug information if enabled, including velocity, target, and autopilot data.
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     * @param {number} scale - The current render scale.
     */
    drawDebug(ctx, camera, scale) {
        if (!this.debug || !camera.debug) return;

        this.trail.drawDebug(ctx, camera, this.position);
        ctx.lineWidth = 2;

        // Convert world positions to screen coordinates
        camera.worldToScreen(this.position, this._scratchScreenPos);

        if (this.isThrusting) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,0,1.0)';
            ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, 10, 0, TWO_PI);
            ctx.closePath();
            ctx.fill();
        }

        // Draw velocity error if available
        let velocityError = null;
        if (this.pilot && this.pilot.autopilot && this.pilot.autopilot.subAutopilot && this.pilot.autopilot.subAutopilot.active && this.pilot.autopilot.subAutopilot._scratchVelocityError) {
            velocityError = this.pilot.autopilot.subAutopilot._scratchVelocityError;
        } else if (this.pilot && this.pilot.autopilot && this.pilot.autopilot.active && this.pilot.autopilot._scratchVelocityError) {
            velocityError = this.pilot.autopilot._scratchVelocityError;
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
        this._scratchVelocityEnd.set(this.velocity).addInPlace(this.position);
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
            const state = this.pilot.getStatus();
            ctx.fillStyle = 'white';
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

        if (this.target && this.target.position) {
            // Draw velocity error if available
            let closeApproachDistance = null;
            let farApproachDistance = null;
            let arrivalDistance = null;
            if (this.pilot && this.pilot.autopilot && this.pilot.autopilot.subAutopilot instanceof FlyToTargetAutopilot && this.pilot.autopilot.subAutopilot.active && this.pilot.autopilot.subAutopilot.closeApproachDistance) {
                closeApproachDistance = this.pilot.autopilot.subAutopilot.closeApproachDistance;
                farApproachDistance = this.pilot.autopilot.subAutopilot.farApproachDistance;
                arrivalDistance = this.pilot.autopilot.subAutopilot.arrivalDistance;
            } else if (this.pilot && this.pilot.autopilot instanceof FlyToTargetAutopilot && this.pilot.autopilot.active && this.pilot.autopilot.closeApproachDistance) {
                closeApproachDistance = this.pilot.autopilot.closeApproachDistance;
                farApproachDistance = this.pilot.autopilot.farApproachDistance;
                arrivalDistance = this.pilot.autopilot.arrivalDistance;
            }

            if (farApproachDistance || closeApproachDistance || arrivalDistance) {
                camera.worldToScreen(this.target.position, this._scratchScreenPos);
            }

            if (farApproachDistance > 0) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(0,255,0,0.1)';
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, farApproachDistance * scale, 0, TWO_PI, false);
                ctx.fill();
            }

            if (closeApproachDistance > 0) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255,255,0,0.2)';
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, closeApproachDistance * scale, 0, TWO_PI, false);
                ctx.fill();
            }

            if (arrivalDistance > 0) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, arrivalDistance * scale, 0, TWO_PI, false);
                ctx.fill();
            }
        }
    }
}