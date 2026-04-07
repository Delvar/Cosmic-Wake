// /src/autopilot/escortAutopilot.js

import { Autopilot } from '/src/autopilot/autopilot.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/landOnPlanetAutopilot.js';
import { FollowAutopilot } from '/src/autopilot/followAutopilot.js';
import { Ship } from '/src/ship/ship.js';
import { Planet } from '/src/starSystem/celestialBody.js';
import { randomBetween } from '/src/core/utils.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';
import { TraverseJumpGateAutopilot } from '/src/autopilot/traverseJumpGateAutopilot.js';

/**
 * Autopilot that escorts a target ship, moves within range of the ship, lands, takes off, jumps with the ship.
 * @extends {Autopilot<Ship>}
 */
export class EscortAutopilot extends Autopilot {
    /**
     * Creates a new EscortAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target ship to escort.
     * @param {number} [minFollowDistance=100] - Minimum distance from target center.
     * @param {number} [maxFollowDistance=500] - Maximum distance from target center.
     */
    constructor(ship, target, minFollowDistance = 100.0, maxFollowDistance = 500.0) {
        super(ship, target);
        /** @type {Ship} The target to follow. */
        this.target = target;
        /** @type {number} Minimum distance from target center. */
        this.minFollowDistance = minFollowDistance;
        /** @type {number} Maximum distance from target center. */
        this.maxFollowDistance = maxFollowDistance;
        /** @type {Object.<string, Function>} Map of state names to their respective handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Following': this.updateFollowing.bind(this),
            'FollowLanding': this.updateFollowLanding.bind(this),
            'Landing': this.updateLanding.bind(this),
            'TraversingJumpGate': this.updateTraversingJumpGate.bind(this),
            'Waiting': this.updateWaiting.bind(this)
        };
        /** @type {number} Minimum wait time (seconds) */
        this.waitTimeMin = 5.0;
        /** @type {number} Maximum wait time (seconds) */
        this.waitTimeMax = 10.0;
        /** @type {number} Time (seconds) remaining to wait in the 'Waiting' state. */
        this.waitTime = 0.0;

        if (new.target === EscortAutopilot) Object.seal(this);
    }

    /**
     * Starts escort behaviour, validating the target ship and setting the initial state.
     * @override
     * @returns {void}
     */
    start() {
        super.start();

        if (!(this.target instanceof Ship)) {
            this.error = 'Target is not a ship';
            this.active = false;
            return;
        }

        if (!this.target) {
            this.error = 'No target';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.target)) {
            this.error = 'Target not in same system';
            this.active = false;
            return;
        }

        this.ship.target = this.target;
        this.state = 'Starting';
    }

    /**
     * Updates escort behaviour each frame, validating the target and delegating to the state machine.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (this.ship.state !== "Landed" && this.ship.state !== "Flying") {
            return;
        }
        // Check if the escorted ship still exists
        if (!this.target || this.target.isDespawned() || !(this.target instanceof Ship)) {
            this.stop();
            this.error = 'Escorted ship despawned';
            return;
        }
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the 'Starting' state by determining whether to follow, land, or traverse a jump gate based on the target ship.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateStarting(deltaTime, gameManager) {
        if (!(this.target instanceof Ship)) {
            throw new TypeError('target must be an instance of Ship');
        }
        // Check if target is in another star system
        if (this.target.starSystem !== this.ship.starSystem) {
            const jumpGate = this.ship.starSystem.getJumpGateToSystem(this.target.starSystem);
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = "TraversingJumpGate";
                this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to TraversingJumpGate for system ${this.target?.starSystem?.name}`));
            } else {
                if (this.ship.state === "Landed") {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = "Waiting";
                    this.debugLog(() => console.log(`${this.constructor.name}: No jump gate found, transitioned to Waiting`));
                } else {
                    // Find the closest planet in the current system to land on
                    const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                    if (closestPlanet) {
                        this.subAutopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
                        this.subAutopilot.start();
                        this.state = "Landing";
                        this.debugLog(() => console.log(`${this.constructor.name}: No jump gate found, transitioned to Landing on ${closestPlanet.name}`));
                    } else {
                        this.error = "No landable planets found in current system";
                        this.stop();
                        this.debugLog(() => console.log(`${this.constructor.name}: Stopped due to no landable planets`));
                    }
                }
            }
            return;
        }

        // Target is in the same system
        if (this.target.state === "Landed" || this.target.state === "Landing") {
            const landedObject = this.target.dockingContext?.landedObject;
            if (!landedObject) {
                this.error = "Target planet not found";
                this.stop();
                return;
            }
            if (this.ship.state === "Landed") {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                if (this.ship.dockingContext.landedObject === landedObject) {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = "Waiting";
                    this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Waiting on ${landedObject.name}`));
                } else {
                    this.ship.dockingContext.takeOff();
                    this.debugLog(() => console.log(`${this.constructor.name}: Taking Off to land on ${landedObject.name}`));
                }
            } else if (this.ship.state === "Flying") {
                if (landedObject instanceof Planet) {
                    this.subAutopilot = new LandOnPlanetAutopilot(this.ship, landedObject);
                    this.subAutopilot.start();
                    this.state = "Landing";
                    this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Landing on ${landedObject.name}`));
                } else {
                    //we don't know what it landed on so just follow the landed object
                    this.subAutopilot = new FollowAutopilot(this.ship, landedObject, this.minFollowDistance, this.maxFollowDistance);
                    this.subAutopilot.start()
                    this.state = "Following";
                    this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Following ${landedObject.name}`));
                }
            }
            // If ship is in TakingOff or Landing, let those states complete naturally
        } else if (this.target.state === "Flying" || this.target.state === "TakingOff") {
            if (this.ship.state === "Landed") {
                if (!this.ship.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                this.ship.dockingContext.takeOff();
                this.debugLog(() => console.log(`${this.constructor.name}: Taking Off to follow target`));
            } else if (this.ship.state === "Flying") {
                this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
                this.subAutopilot.start();
                this.state = "Following";
                this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Following target ${this.target?.name}`));
            }
            // If ship is in TakingOff or Landing, let those states complete naturally
        } else {
            this.error = `Invalid target state '${this.target.state}' in updateStarting`;
            this.stop();
            this.debugLog(() => console.log(`${this.constructor.name}: Stopped due to invalid target state '${this.target?.state}'`));
        }
    }

    /**
     * Handles the 'Waiting' state: pauses after landing before resuming escort duties, with early takeoff if the target takes off or is flying in the same system.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateWaiting(deltaTime, gameManager) {
        // Validate target
        if (!this.target || this.target.isDespawned() || !(this.target instanceof Ship)) {
            this.error = "Target is invalid or despawned";
            this.stop();
            this.debugLog(() => console.log(`${this.constructor.name}: Stopped due to invalid or despawned target`));
            return;
        }

        // Ensure ship is landed (should always be true in Waiting state)
        if (this.ship.state !== 'Landed') {
            console.warn(`Unexpected ship state '${this.ship.state}' in Waiting state; resetting`);
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to unexpected ship state '${this.ship.state}'`));
            return;
        }

        if (!this.ship.dockingContext) {
            throw new TypeError('dockingContext is missing on Landed ship');
        }

        // Handle target in the same system
        if (this.target.starSystem === this.ship.starSystem) {
            // Early takeoff if target is flying or taking off
            if (this.target.state === 'Flying' || this.target.state === 'TakingOff') {
                this.ship.dockingContext.takeOff();
                this.state = 'Starting';
                this.debugLog(() => console.log(`${this.constructor.name}: Early takeoff triggered, transitioned to Starting due to target ${this.target?.state}`));
                return;
            }

            // Handle target landed on a different planet
            if (this.target.state === 'Landed' || this.target.state === 'Landing') {
                if (!this.target.dockingContext) {
                    throw new TypeError('dockingContext is missing on Landed ship');
                }
                const landedObject = this.target.dockingContext.landedObject;
                if (landedObject && this.ship.dockingContext.landedObject !== landedObject) {
                    this.ship.dockingContext.takeOff();
                    this.state = 'Starting';
                    this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Starting to land on target's planet ${landedObject.name}`));
                    return;
                }
            }
        }

        // Continue waiting
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0.0) {
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Wait time expired, transitioned to Starting`));
        }
    }

    /**
     * Handles the 'Following' state: follows the escorted ship and reacts to its actions (landing, jumping).
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFollowing(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during Following state');
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to missing or inactive sub-autopilot`));
            return;
        }
        if (!this.target) {
            throw new TypeError('target is missing');
        }
        // Handle the escorted ship jumping out
        if (this.target.state === 'JumpingOut') {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            const jumpGate = this.target.jumpGate;
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
                this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to TraversingJumpGate for jump gate ${jumpGate.name}`));
            } else {
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
                this.debugLog(() => console.log(`${this.constructor.name}: No jump gate found, transitioned to Waiting`));
            }
            return;
        }

        // Handle the escorted ship landing or landed
        if (this.target.state === 'Landing' || this.target.state === 'Landed') {
            const landedObject = this.target.dockingContext?.landedObject;
            if (!landedObject) {
                this.error = 'Target landed but no landed object set!';
                this.subAutopilot.stop();
                this.subAutopilot = null;
                this.state = 'Starting';
                this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to missing target planet`));
                return;
            }
            if (landedObject instanceof Planet) {
                this.subAutopilot.stop();
                this.subAutopilot = new LandOnPlanetAutopilot(this.ship, landedObject);
                this.subAutopilot.start();
                this.state = "Landing";
                this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Landing on ${landedObject.name}`));
                return;
            } else {
                //we don't know what it landed on so just follow the landed object
                this.subAutopilot.stop();
                this.subAutopilot = new FollowAutopilot(this.ship, landedObject, this.minFollowDistance, this.maxFollowDistance);
                this.subAutopilot.start()
                this.state = "FollowLanding";
                this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to FollowLanding ${landedObject.name}`));
                return;
            }
        }

        // Handle the escorted ship moving to another star system
        if (this.target.starSystem !== this.ship.starSystem) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            const jumpGate = this.ship.starSystem.getJumpGateToSystem(this.target.starSystem);
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
                this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to TraversingJumpGate for system ${this.target?.starSystem.name}`));
            } else {
                // Land on the closest planet if no jump gate is found
                const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                if (closestPlanet) {
                    this.subAutopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
                    this.subAutopilot.start();
                    this.state = 'Landing';
                    this.debugLog(() => console.log(`${this.constructor.name}: No jump gate found, transitioned to Landing on ${closestPlanet.name}`));
                } else {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = 'Waiting';
                    this.debugLog(() => console.log(`${this.constructor.name}: No jump gate or planets found, transitioned to Waiting`));
                }
            }
            return;
        }

        // Continue following the escorted ship
        this.subAutopilot.update(deltaTime, gameManager);
        if (!this.subAutopilot.active || this.subAutopilot.error) {
            console.warn(`Sub-autopilot inactive or errored during Following state: ${this.subAutopilot.error || 'unknown error'}`);
            this.subAutopilot.stop();
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to sub-autopilot failure`));
        }
    }

    /**
     * Handles the 'FollowLanding' state: follows the same body as the escorted ship, aborting if it takes off.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFollowLanding(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during FollowLanding state');
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to missing or inactive sub-autopilot`));
            return;
        }

        if (!this.target) {
            throw new TypeError('target is missing');
        }

        // Abort landing if the escorted ship takes off or is flying
        if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
            this.subAutopilot.stop();
            this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
            this.subAutopilot.start();
            this.state = 'Following';
            this.debugLog(() => console.log(`${this.constructor.name}: Aborted landing, transitioned to Following target ${this.target?.name}`));
            return;
        }

        // Continue following the escorted ship
        this.subAutopilot.update(deltaTime, gameManager);
        if (!this.subAutopilot.active || this.subAutopilot.error) {
            console.warn(`Sub-autopilot inactive or errored during FollowLanding state: ${this.subAutopilot.error || 'unknown error'}`);
            this.subAutopilot.stop();
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to sub-autopilot failure`));
        }
    }


    /**
     * Handles the 'Landing' state: lands on the same body as the escorted ship, aborting if it takes off.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateLanding(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during Landing state');
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to missing or inactive sub-autopilot`));
            return;
        }

        if (!this.target) {
            throw new TypeError('target is missing');
        }

        // Abort landing if the escorted ship takes off or is flying
        if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
            this.subAutopilot.stop();
            this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
            this.subAutopilot.start();
            this.state = 'Following';
            this.debugLog(() => console.log(`${this.constructor.name}: Aborted landing, transitioned to Following target ${this.target?.name}`));
            return;
        }

        // Handle target moving to another star system
        if (this.target.starSystem !== this.ship.starSystem) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
            const jumpGate = this.ship.starSystem.getJumpGateToSystem(this.target.starSystem);
            if (jumpGate && !jumpGate.isDespawned()) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
                this.subAutopilot.start();
                this.state = 'TraversingJumpGate';
                this.debugLog(() => console.log(`${this.constructor.name}: Target moved to another system, transitioned to TraversingJumpGate for system ${this.target?.starSystem.name}`));
            } else {
                // Land on the closest planet if no jump gate is found
                const closestPlanet = this.ship.starSystem.getClosestPlanet(this.ship);
                if (closestPlanet) {
                    this.subAutopilot = new LandOnPlanetAutopilot(this.ship, closestPlanet);
                    this.subAutopilot.start();
                    this.state = 'Landing';
                    this.debugLog(() => console.log(`${this.constructor.name}: No jump gate found, continuing Landing on ${closestPlanet.name}`));
                } else {
                    this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                    this.state = 'Waiting';
                    this.debugLog(() => console.log(`${this.constructor.name}: No jump gate or planets found, transitioned to Waiting`));
                }
            }
            return;
        }

        // Process landing
        this.subAutopilot.update(deltaTime, gameManager);
        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Landing failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Starting';
                this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to landing failure: ${this.subAutopilot?.error}`));
            } else if (this.ship.state === 'Landed') {
                this.subAutopilot = null;
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Waiting';
                this.debugLog(() => console.log(`${this.constructor.name}: Landing complete, transitioned to Waiting on ${this.ship.dockingContext?.landedObject?.name || 'unknown'}`));
            } else {
                console.warn('Landing completed but ship not landed; resetting');
                this.subAutopilot = null;
                this.state = 'Starting';
                this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to unexpected ship state after landing`));
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive but not complete during Landing state');
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to inactive sub-autopilot`));
        }
    }

    /**
     * Handles the 'TraversingJumpGate' state: jumps to the escorted ship's star system.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateTraversingJumpGate(deltaTime, gameManager) {
        if (!this.subAutopilot || !this.subAutopilot.active) {
            console.warn('Sub-autopilot not set or inactive during TraversingJumpGate state');
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to missing or inactive sub-autopilot`));
            return;
        }

        // Process the jump
        this.subAutopilot.update(deltaTime, gameManager);
        if (this.subAutopilot.isComplete()) {
            if (this.subAutopilot.error) {
                console.warn(`Jump failed: ${this.subAutopilot.error}`);
                this.subAutopilot = null;
                this.state = 'Starting';
                this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to jump failure: ${this.subAutopilot?.error}`));
            } else if (this.ship.state === 'Flying' && this.target && this.ship.starSystem === this.target.starSystem) {
                this.subAutopilot = new FollowAutopilot(this.ship, this.target, this.minFollowDistance, this.maxFollowDistance);
                this.subAutopilot.start();
                this.state = 'Following';
                this.debugLog(() => console.log(`${this.constructor.name}: Jump complete, transitioned to Following target ${this.target?.name} in system ${this.ship.starSystem.name}`));
            } else {
                console.warn('Jump completed but not in target system or not flying; resetting');
                this.subAutopilot = null;
                this.state = 'Starting';
                this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to unexpected state or system mismatch after jump`));
            }
        } else if (!this.subAutopilot.active) {
            console.warn('Sub-autopilot inactive but not complete during TraversingJumpGate state');
            this.subAutopilot = null;
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Reset to Starting due to inactive sub-autopilot`));
        }
    }
}