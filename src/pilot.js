// pilot.js

import { Vector2D } from './vector2d.js';
import { JumpGate } from './celestialBody.js';
import { remapClamp } from './utils.js';
import { TraverseJumpGateAutoPilot, FlyToTargetAutoPilot, LandOnPlanetAutoPilot } from './autopilot.js';
import { Ship } from './ship.js';

/**
 * Base class for pilots that control ships. Subclasses must implement core methods.
 */
export class Pilot {
    /**
     * Creates a new Pilot instance.
     * @param {Ship} ship - The ship this pilot controls.
     */
    constructor(ship) {
        this.ship = ship;
    }

    /**
     * Updates the ship's state based on pilot logic. Must be overridden by subclasses.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager object providing game state.
     */
    update(deltaTime, gameManager) {
        throw new Error("update() must be implemented by subclass");
    }

    /**
     * Attempts to perform a hyperjump. Must be overridden by subclasses.
     * @param {GameManager} gameManager - The game manager object providing game state.
     * @returns {boolean} True if hyperjump succeeds, false otherwise.
     */
    tryHyperjump(gameManager) {
        throw new Error("tryHyperjump() must be implemented by subclass");
    }

    /**
     * get the current pilot status
     * @returns {string} A text description of the current status.
     */
    getState() {
        throw new Error("getState() must be implemented by subclass");
    }
}

/**
 * A pilot controlled by the player using keyboard inputs.
 * @extends Pilot
 */
export class PlayerPilot extends Pilot {
    /**
     * Creates a new PlayerPilot instance.
     * @param {Ship} ship - The ship this pilot controls.
     */
    constructor(ship) {
        super(ship);
        this.autopilot = null;
    }

    /**
     * Lists targetable objects in the ship's star system.
     * @returns {Array} Array of targetable game objects (planets, gates, ships, asteroids).
     */
    listTargetableObjects() {
        const starSystem = this.ship.starSystem;
        const planets = starSystem.celestialBodies.filter(body => !(body instanceof JumpGate) && !body.isDespawned());
        const gates = starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        const ships = starSystem.ships.filter(ship => ship !== this.ship && !ship.isDespawned());
        const asteroids = starSystem.asteroidBelt ? starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        return [...planets, ...gates, ...ships, ...asteroids];
    }

    /**
     * Updates the player's ship based on input and autopilot state.
     * @param {number} deltaTime - Time elapsed since last update in seconds.
     * @param {GameManager} gameManager - The game manager instance for input and state.
     */
    update(deltaTime, gameManager) {
        const keys = gameManager.keys;
        const lastKeys = gameManager.lastKeys;

        // Interrupt autopilot if movement keys are pressed
        if (keys['ArrowLeft'] || keys['ArrowRight'] || keys['ArrowUp'] || keys['ArrowDown']) {
            if (this.autopilot?.active) {
                this.autopilot.stop();
                this.autopilot = null;
            }
        }

        // Manual controls
        if (keys['ArrowLeft']) {
            this.ship.setTargetAngle(this.ship.angle - this.ship.rotationSpeed * deltaTime);
            console.log('ArrowLeft');
        }
        if (keys['ArrowRight']) {
            this.ship.setTargetAngle(this.ship.angle + this.ship.rotationSpeed * deltaTime);
            console.log('ArrowRight');
        }
        this.ship.applyThrust(keys['ArrowUp']);
        this.ship.applyBrakes(keys['ArrowDown']);

        // Landing automation with 'L'
        if (keys['l'] && !lastKeys['l']) {
            if (this.ship.state === 'Flying' && this.ship.target) {
                if (!(this.ship.target instanceof JumpGate)) {
                    if (this.ship.canLand(this.ship.target)) {
                        this.ship.initiateLanding(this.ship.target);
                    } else {
                        this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.ship.target);
                        this.autopilot.start();
                    }
                }
            } else if (this.ship.state === 'Landed') {
                if (this.ship.target) {
                    const directionToTarget = this.ship.target.position.subtract(this.ship.position);
                    this.ship.setTargetAngle(Math.atan2(directionToTarget.y, directionToTarget.x));
                }
                this.ship.initiateTakeoff();
            }
        }

        // Jump gate traversal with 'J'
        if (keys['j'] && !lastKeys['j']) {
            if (this.ship.state === 'Flying' && this.ship.target) {
                if (this.ship.target instanceof JumpGate) {
                    const distanceToGate = this.ship.position.subtract(this.ship.target.position).magnitude();
                    if (distanceToGate <= 50 && this.ship.target.overlapsShip(this.ship.position)) {
                        this.ship.initiateHyperjump();
                    } else {
                        this.autopilot = new TraverseJumpGateAutoPilot(this.ship, this.ship.target);
                        this.autopilot.start();
                    }
                }
            }
        }

        // Update autopilot if active
        if (this.autopilot?.active) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                if (this.autopilot.error) {
                    console.warn(`Autopilot failed: ${this.autopilot.error}`);
                }
                this.autopilot = null;
            }
        }

        // Target selection with 'T' and 'Shift + T'
        if (keys['t'] && !lastKeys['t']) {
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const nextIndex = (currentIndex + 1) % targets.length;
                this.ship.setTarget(targets[nextIndex]);
            }
        }
        if (keys['T'] && !lastKeys['T']) {
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const prevIndex = (currentIndex - 1 + targets.length) % targets.length;
                this.ship.setTarget(targets[prevIndex]);
            }
        }

        // Note: Removed redundant manual 'j' hyperjump check since it's now handled above
    }

    /**
     * get the current pilot status
     * @returns {string} A text description of the current status.
     */
    getState() {
        if (this.autopilot?.active) {
            return this.autopilot.getStatus(); // Fixed typo from previous 'getStatus'
        }
        return 'Flying free!';
    }
}

/**
 * An AI-controlled pilot that navigates to planets or jump gates autonomously using autopilot.
 * @extends Pilot
 */
export class AIPilot extends Pilot {
    /**
     * Creates a new AIPilot instance.
     * @param {Ship} ship - The ship this pilot controls.
     * @param {CelestialBody} spawnPlanet - The celestial body where the ship spawned.
     */
    constructor(ship, spawnPlanet) {
        super(ship);
        this.spawnPlanet = spawnPlanet; // Initial planet to exclude from first destination
        this.target = this.pickDestination(ship.starSystem, spawnPlanet); // Initial target (planet or gate)
        this.state = 'Idle'; // Current state: 'Idle', 'FlyingToPlanet', 'Landed', 'TakingOff', 'TraversingJumpGate'
        this.waitTime = 0; // Time to wait on planet in seconds
        this.autopilot = null; // Instance of LandOnPlanetAutoPilot or TraverseJumpGateAutoPilot when active

        // State machine handlers
        this.stateHandlers = {
            'Idle': this.updateIdle.bind(this),
            'FlyingToPlanet': this.updateFlyingToPlanet.bind(this),
            'Landed': this.updateLanded.bind(this),
            'TakingOff': this.updateTakingOff.bind(this),
            'TraversingJumpGate': this.updateTraversingJumpGate.bind(this)
        };
    }

    /**
     * Picks a random destination (planet or jump gate) in the star system, excluding a specified body.
     * @param {StarSystem} starSystem - The current star system.
     * @param {CelestialBody} excludeBody - The body to exclude (e.g., spawn or current planet).
     * @returns {CelestialBody|JumpGate} The selected destination (planet or jump gate).
     */
    pickDestination(starSystem, excludeBody) {
        const destinations = starSystem.celestialBodies.filter(body =>
            body !== excludeBody && body.type.type !== 'star'
        ); // Include both planets and jump gates, exclude stars
        if (destinations.length === 0) {
            console.warn('No valid destinations found; defaulting to spawn planet');
            return excludeBody; // Fallback to avoid breaking the loop
        }
        return destinations[Math.floor(Math.random() * destinations.length)];
    }

    /**
     * Updates the AI pilot’s behavior, delegating to the appropriate state handler.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    update(deltaTime, gameManager) {
        // Set the ship’s target for visualization/debugging
        if (this.ship.starSystem === this.target.starSystem) {
            this.ship.setTarget(this.target);
        }

        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager); // Call the state-specific update method
        } else {
            console.warn(`No handler for state: ${this.state}`);
            this.state = 'Idle'; // Reset to a safe state if invalid
        }
    }

    /**
     * Updates the AI in the 'Idle' state, initiating travel to a new target.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    updateIdle(deltaTime, gameManager) {
        // Decide whether to fly to a planet or traverse a jump gate based on target type
        if (this.target instanceof JumpGate) {
            this.autopilot = new TraverseJumpGateAutoPilot(this.ship, this.target);
            this.autopilot.start();
            this.state = 'TraversingJumpGate';
        } else {
            this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.target);
            this.autopilot.start();
            this.state = 'FlyingToPlanet';
        }
    }

    /**
     * Updates the AI in the 'FlyingToPlanet' state, managing autopilot navigation to a planet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    updateFlyingToPlanet(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during FlyingToPlanet state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Landed') {
                    this.state = 'Landed';
                    this.waitTime = Math.random() * 5 + 2; // Wait 2-7 seconds
                    this.autopilot = null;
                } else {
                    console.warn('Autopilot completed but ship is not landed; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during FlyingToPlanet state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * Updates the AI in the 'Landed' state, waiting before takeoff.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    updateLanded(deltaTime, gameManager) {
        // Wait on the planet until waitTime expires
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            // Pick a new destination before takeoff
            this.spawnPlanet = this.target; // Update spawn to current planet
            this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
            // Align ship towards the new target and initiate takeoff
            const directionToTarget = this.target.position.subtract(this.ship.position);
            this.ship.setTargetAngle(Math.atan2(directionToTarget.y, directionToTarget.x));
            this.ship.initiateTakeoff();
            this.state = 'TakingOff';
        }
    }

    /**
     * Updates the AI in the 'TakingOff' state, transitioning back to Idle after takeoff.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    updateTakingOff(deltaTime, gameManager) {
        // Wait for takeoff animation to complete
        if (this.ship.state === 'Flying') {
            this.state = 'Idle';
        }
    }

    /**
     * Updates the AI in the 'TraversingJumpGate' state, managing autopilot navigation through a jump gate.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager providing game state.
     */
    updateTraversingJumpGate(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during TraversingJumpGate state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.target = this.pickDestination(this.ship.starSystem, null); // No exclusion after jump failure
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.lane.target) {
                    // Jump complete; pick a new destination in the new system
                    this.target = this.pickDestination(this.ship.starSystem, this.target.lane.targetGate); // Exclude the gate we just jumped into!
                    this.autopilot = null;
                    this.state = 'Idle';
                } else {
                    console.warn('Autopilot completed but jump not finished; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during TraversingJumpGate state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    /**
     * AI pilots do not perform manual hyperjumps; handled via autopilot.
     * @param {GameManager} gameManager - The game manager providing game state.
     * @returns {boolean} Always false.
     */
    tryHyperjump(gameManager) {
        return false; // Hyperjumps managed by autopilot
    }

    /**
     * Gets the current status of the AI pilot.
     * @returns {string} A text description of the current state.
     */
    getState() {
        if ((this.state === 'FlyingToPlanet' || this.state === 'TraversingJumpGate') && this.autopilot?.active) {
            return this.autopilot.getStatus(); // Delegate to autopilot for detailed status
        }
        return `AI: ${this.state} (Target: ${this.target?.name || 'None'})`;
    }
}