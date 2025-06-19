// /src/pilot/aiPilot.js

import { Pilot } from '/src/pilot/pilot.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot, AvoidAutopilot, FleeAutopilot, LandOnPlanetDespawnAutopilot } from '/src/autopilot/autopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { remapClamp } from '/src/core/utils.js';
import { Job } from '/src/job/job.js';
import { GameManager } from '/src/core/game.js';
import { GameObject } from '/src/core/gameObject.js';
import { FactionRelationship } from '/src/core/faction.js';

/**
 * Base AI pilot with common states and reaction handling.
 * @extends Pilot
 */
export class AiPilot extends Pilot {
    /**
     * Creates a new AiPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Job|null} job - The job instance (e.g., WandererJob).
     * @param {boolean} [attackDisabledShips=false] - Whether to attack ships that are disabled.
     * @throws {Error} If called directly instead of subclassing.
     */
    constructor(ship, job = null, attackDisabledShips = false) {
        super(ship);
        if (job) {
            // Set the job pilot so it can update back to us
            job.pilot = this;
        }
        /** @type {Object} The job instance controlling high-level behavior (e.g., WandererJob). */
        this.job = job;
        /** @type {boolean} Whether to attack ships that are disabled. */
        this.attackDisabledShips = attackDisabledShips;
        /** @type {string} The current state ('Job', 'Flee', 'Avoid', 'Attack'). */
        this.state = job ? 'Job' : 'Despawning';
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Job': this.updateJob.bind(this),
            'Flee': this.updateFlee.bind(this),
            'Avoid': this.updateAvoid.bind(this),
            'Attack': this.updateAttack.bind(this),
            'Despawning': this.updateDespawning.bind(this)
        };
        /** @type {number} Time (seconds) the ship has been safe from threats. */
        this.safeTime = 0.0;
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchDistance = new Vector2D();

        if (new.target === AiPilot) Object.seal(this);
    }

    /**
     * Updates the AI pilot's behavior based on the current state.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        // Skip if ship is in animation or non-functional states
        if (this.ship.state === 'Landing' || this.ship.state === 'TakingOff' ||
            this.ship.state === 'JumpingOut' || this.ship.state === 'JumpingIn' ||
            this.ship.state === 'Disabled' || this.ship.state === 'Exploding') {
            return;
        }

        // Run state handler
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        }

        if (this.isSafe()) {
            this.safeTime += deltaTime;
        } else {
            this.safeTime = 0.0;
        }
    }

    /**
     * Handles the 'Job' state, running the job and checking reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateJob(deltaTime, gameManager) {
        if (this.job.state === 'Failed') {
            if (this.ship.debug) {
                console.log('AiPilot: Job failed, transitioning to Despawning');
            }
            this.changeState('Despawning', new LandOnPlanetDespawnAutopilot(this.ship));
            return;
        }

        // Execute active autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime, gameManager);
        }

        // Run job to set next autopilot
        if (this.ship.state === 'Landed' || this.ship.state === 'Flying') {
            this.job.update(deltaTime, gameManager);
        }

        // If autopilot is complete null it, this ensures Job gets to see the complete autopilot first
        if (this.autopilot) {
            if (this.autopilot.error && this.ship.debug) {
                console.warn(`autopilot ${this.autopilot.constructor.name} has an error: ${this.autopilot.error}`);
            }
            if (this.autopilot.isComplete()) {
                if (this.ship.debug) {
                    console.log(`${this.autopilot.constructor.name} is complete, nulling`);
                }
                this.setAutopilot(null);
            }
        }
    }

    /**
     * Handles the 'Avoid' state, managing avoidance behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        // Select a target from hostiles
        const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
        if (!target || this.safeTime > 5.0) {
            this.ship.target = null;
            this.changeState('Job');
            return;
        }

        // Ensure correct autopilot
        if (!(this.autopilot instanceof AvoidAutopilot) && this.ship.state === 'Flying') {
            if (this.ship.debug) {
                console.log('Avoid: Incorrect autopilot, setting AvoidAutopilot');
            }
            this.changeState('Avoid', new AvoidAutopilot(this.ship, target));
        }

        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime, gameManager);
            if (this.autopilot.isComplete()) {
                this.ship.target = null;
                this.changeState('Job');
            }
        }
    }

    /**
     * Handles the 'Flee' state, managing flee behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        // Select a target from hostiles
        const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
        if (!target || this.safeTime > 5.0) {
            this.ship.target = null;
            this.changeState('Job');
            return;
        }

        // Ensure correct autopilot
        if (!(this.autopilot instanceof FleeAutopilot) && this.ship.state === 'Flying') {
            if (this.ship.debug) {
                console.log('Flee: Setting FleeAutopilot');
            }
            this.setAutopilot(new FleeAutopilot(this.ship, target));
        }

        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime, gameManager);
            if (this.autopilot.isComplete()) {
                this.ship.target = null;
                this.changeState('Job');
            }
        }
    }

    /**
     * Handles the 'Attack' state, managing attack behavior.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAttack(deltaTime, gameManager) {
        if (this.ship.state !== 'Flying') {
            if (this.ship.debug) {
                console.log(`AiPilot: Not Flying (${this.ship.state}), reverting to Job`);
            }
            this.changeState('Job');
            return;
        }

        if (this.autopilot && this.autopilot.active && this.autopilot instanceof AttackAutopilot && !this.autopilot.error) {
            this.autopilot.update(deltaTime, gameManager);
        } else {
            // Log error if present
            if (this.autopilot && this.autopilot.error && this.ship.debug) {
                console.warn(`AiPilot: AttackAutopilot error: ${this.autopilot.error}`);
            }

            // Select a target from hostiles
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (!target) {
                if (this.ship.debug) {
                    console.log(`AiPilot: No valid hostile target, reverting to Job`);
                }
                this.ship.target = null;
                this.changeState('Job');
                return;
            }

            if (this.ship.debug) {
                console.log(`AiPilot: Setting AttackAutopilot for target ${target.name}`);
            }
            this.ship.target = target; // Set for turret firing
            this.setAutopilot(new AttackAutopilot(this.ship, target, true));
        }
    }

    /**
     * Handles the 'Despawning' state, landing on the closest planet and despawning.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateDespawning(deltaTime, gameManager) {
        if (!(this.autopilot instanceof LandOnPlanetDespawnAutopilot)) {
            this.setAutopilot(new LandOnPlanetDespawnAutopilot(this.ship));
        }
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime, gameManager);
            if (this.autopilot.isComplete()) {
                this.setAutopilot(null);
            }
        }
        if (this.autopilot?.error) {
            if (this.ship.debug) {
                console.warn(`Despawn failed: ${this.autopilot.error}`);
            }
            this.ship.despawn();
            this.setAutopilot(null);
        }
    }

    /**
     * Sets a new autopilot, stopping and cleaning up the current one.
     * @param {Autopilot|null} newAutopilot - The new autopilot to set, or null to clear.
     */
    setAutopilot(newAutopilot) {
        if (this.ship.debug) {
            console.log(`setAutopilot ${this.ship.name}: ${this.autopilot?.constructor?.name} >> ${newAutopilot?.constructor?.name}`);
            // if (this.autopilot?.constructor?.name === 'AttackAutopilot' && newAutopilot?.constructor?.name == undefined) {
            //     throw new Error("Autopilot set to undefined! This should never happen.");
            // }
        }
        if (this.autopilot) {
            this.autopilot.stop();
            this.autopilot = null;
        }
        this.autopilot = newAutopilot;
        if (this.autopilot) {
            this.autopilot.start();
        }
    }

    /**
     * Checks if the ship is safe from any hostile ships.
     * @returns {boolean} True if safe.
     */
    isSafe() {
        if (this.ship.state === 'Landed') return true;
        for (const hostile of this.ship.hostiles) {
            if (!isValidAttackTarget(this.ship, hostile, false)) continue;
            const distanceSq = this.ship.position.distanceSquaredTo(hostile.position);
            const threatSpeed = hostile.maxVelocity * 5.0; // Safe distance is 5 seconds away
            if (distanceSq <= threatSpeed * threatSpeed) {
                return false;
            }
        }
        return true;
    }

    /**
     * Notified when the ship takes damage.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - Ship causing damage.
     */
    onDamage(damage, source) {

    }

    /**
     * Changes state and autopilot, handling cleanup.
     * @param {string} newState - The new state ('Job', 'Flee', 'Avoid', 'Attack').
     * @param {Autopilot} [newAutopilot=null] - The new autopilot, if any.
     */
    changeState(newState, newAutopilot = null) {
        if (this.state === newState) return;
        // Pause job only when leaving Job state
        if (this.state === 'Job') {
            this.job.pause();
        }
        // Resume the job when entering Job state
        if (newState === 'Job') {
            this.job.resume();
        }
        // Set new state and autopilot
        this.state = newState;
        this.setAutopilot(newAutopilot);
        if (this.ship.debug) {
            console.log(`AiPilot: State changed to ${newState}`);
        }
    }

    /**
     * Returns the action name by processing the class name, removing 'Pilot' and adding spaces before capital letters.
     * @returns {string} The action name.
     */
    getActionName() {
        const className = this.constructor.name;
        if (className.endsWith('Pilot')) {
            const baseName = className.slice(0.0, -5.0); // Remove 'Pilot'
            // Insert space before each capital letter (except first) and trim
            return baseName.replace(/([A-Z])/g, ' $1').trim();
        }
        return className; // Fallback if no 'Pilot' suffix
    }

    /**
     * Returns the current status of the pilot for HUD display.
     * @returns {string} A descriptive status string.
     */
    getStatus() {
        if (this.state === 'Job') {
            if (this.autopilot?.active) {
                return `${this.getActionName()}: ${this.job.getStatus()}: ${this.autopilot.getStatus()}`;
            } else {
                return `${this.getActionName()}: ${this.job.getStatus()}`;
            }
        } else if (this.autopilot?.active) {
            return `${this.getActionName()}: ${this.autopilot.getStatus()}`;
        } else {
            return `${this.getActionName()}: Idle`;
        }
    }
}

/**
 * AI pilot for civilian ships, focusing on avoidance and fleeing.
 * @extends AiPilot
 */
export class CivilianAiPilot extends AiPilot {
    /**
     * Creates a new CivilianAiPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Job} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0.0;

        if (new.target === CivilianAiPilot) Object.seal(this);
    }

    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the 'Job' state, running the job and checking for threats to trigger reactions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateJob(deltaTime, gameManager) {
        // Check shields for immediate flee
        if (this.ship.shield && this.ship.shield.strength <= 0.0) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (target) {
                if (this.ship.debug) {
                    console.log('Job: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }

        // Check reactions
        if (this.ship.age >= this.nextThreatScan) {
            this.nextThreatScan = this.ship.age + this.threatScanInterval;
            // Check for nearby hostile
            if (this.ship.state === 'Flying') {
                for (const hostile of this.ship.hostiles) {
                    if (!isValidAttackTarget(this.ship, hostile, this.attackDisabledShips) || this.ship.getRelationship(hostile) !== FactionRelationship.Hostile) continue;
                    const distanceSq = this._scratchDistance.set(hostile.position)
                        .subtractInPlace(this.ship.position).squareMagnitude();
                    if (distanceSq < 500 * 500.0) {
                        if (this.ship.debug) {
                            console.log('Job: Hostile within 500 units, switching to Avoid');
                        }
                        this.changeState('Avoid', new AvoidAutopilot(this.ship, hostile));
                        return;
                    }
                }
            }
        }

        super.updateJob(deltaTime, gameManager);
    }

    /**
     * Handles the 'Avoid' state, running AvoidAutopilot and checking for flee or job transitions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        super.updateAvoid(deltaTime, gameManager);

        // Check if shields have gone down
        if (this.ship.shield && this.ship.shield.strength <= 0.0) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (target) {
                if (this.ship.debug) {
                    console.log('Avoid: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }

        // Check for timeout fleeing
        if ((!this.autopilot || (this.autopilot instanceof AvoidAutopilot && this.autopilot.timeElapsed >= this.autopilot.timeout)) && !this.isSafe()) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                if (this.ship.debug) {
                    console.log('Avoid: Timeout or complete and not safe, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }
    }

    /**
     * Handles the 'Flee' state, running FleeAutopilot and checking for job transition.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        super.updateFlee(deltaTime, gameManager);
    }

    /**
     * Handles damage, updating state based on shields.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - The ship causing damage.
     */
    onDamage(damage, source) {
        super.onDamage(damage, source);
        this.safeTime = 0.0;
        if (this.ship.shield && this.ship.shield.strength <= 0.0) {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, false)) {
                if (this.ship.debug) {
                    console.log('onDamage: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, source));
            }
        } else if (this.state !== 'Avoid' && this.state !== 'Flee') {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, false)) {
                if (this.ship.debug) {
                    console.log('onDamage: Hostile detected, switching to Avoid');
                }
                this.changeState('Avoid', new AvoidAutopilot(this.ship, source));
            }
        }
    }
}

/**
 * AI pilot for pirate ships, focusing on attacking and fleeing.
 * @extends AiPilot
 */
export class PirateAiPilot extends AiPilot {
    /**
     * Creates a new PirateAiPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Job} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0.0;

        if (new.target === PirateAiPilot) Object.seal(this);
    }

    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        // Check shields/hull for immediate flee
        if (this.ship.state === 'Flying' && ((this.ship.shield && this.ship.shield.strength <= 0.0) || !this.ship.shield) && remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.5) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                if (this.ship.debug) {
                    console.log('Shields down or low hull, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the 'Job' state, running the job and checking for threats to trigger reactions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateJob(deltaTime, gameManager) {
        // Check reactions
        if (this.ship.age >= this.nextThreatScan) {
            this.nextThreatScan = this.ship.age + this.threatScanInterval;
            // Check for nearby hostile
            if (this.ship.state === 'Flying') {
                for (const hostile of this.ship.hostiles) {
                    if (!isValidAttackTarget(this.ship, hostile, this.attackDisabledShips) || this.ship.getRelationship(hostile) !== FactionRelationship.Hostile) continue;
                    const distanceSq = this._scratchDistance.set(hostile.position)
                        .subtractInPlace(this.ship.position).squareMagnitude();
                    if (distanceSq < 500 * 500.0) {
                        if (this.ship.debug) {
                            console.log('Job: Hostile within 500 units, switching to Attack');
                        }
                        this.changeState('Attack', new AttackAutopilot(this.ship, hostile, true));
                        return;
                    }
                }
            }
        }
        super.updateJob(deltaTime, gameManager);
    }

    /**
     * Handles the 'Avoid' state, running AvoidAutopilot and checking for flee or job transitions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        super.updateAvoid(deltaTime, gameManager);

        // Check for timeout fleeing
        if ((!this.autopilot || (this.autopilot instanceof AvoidAutopilot && this.autopilot.timeElapsed >= this.autopilot.timeout)) && !this.isSafe()) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                if (this.ship.debug) {
                    console.log('Avoid: Timeout or complete and not safe, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }
    }

    /**
     * Handles the 'Flee' state, running FleeAutopilot and checking for job transition.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        super.updateFlee(deltaTime, gameManager);
    }

    /**
     * Handles damage, updating state based on shields and hull.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - The ship causing the damage.
     */
    onDamage(damage, source) {
        super.onDamage(damage, source);
        this.safeTime = 0.0;

        // Check if shields are down and hull <50%
        if (this.ship.state === 'Flying' && ((this.ship.shield && this.ship.shield.strength <= 0.0) || !this.ship.shield) && remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.5) {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, false)) {
                if (this.ship.debug) {
                    console.log('onDamage: Shields down and low hull, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, source));
            }
        } else if (this.state !== 'Avoid' && this.state !== 'Flee' && this.state !== 'Attack') {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, this.attackDisabledShips)) {
                if (this.ship.debug) {
                    console.log('onDamage: Hostile detected, switching to Attack');
                }
                this.changeState('Attack', new AttackAutopilot(this.ship, source, true));
            }
        }
    }
}

/**
 * AI pilot for officer ships, focusing on attacking and fleeing.
 * @extends AiPilot
 */
export class OfficerAiPilot extends AiPilot {
    /**
     * Creates a new OfficerAiPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Job} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0.0;

        if (new.target === OfficerAiPilot) Object.seal(this);
    }

    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        // Check shields/hull for immediate flee
        if (this.ship.state === 'Flying' && ((this.ship.shield && this.ship.shield.strength <= 0.0) || !this.ship.shield) && remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.5) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                if (this.ship.debug) {
                    console.log('Shields down or low hull, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }

        // Update target if in Attack state
        if (this.state === 'Attack') {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (target && this.ship.target !== target) {
                this.ship.target = target;
                if (this.autopilot instanceof AttackAutopilot) {
                    this.autopilot.target = target;
                    this.autopilot.start();
                }
            }
        }

        // Set light mode
        this.ship.lightMode = this.state === 'Attack' ? 'Warden' : 'Normal';

        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the 'Job' state, running the job and checking for threats to trigger reactions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateJob(deltaTime, gameManager) {
        // Check reactions
        if (this.ship.age >= this.nextThreatScan) {
            this.nextThreatScan = this.ship.age + this.threatScanInterval;
            // Check for nearby hostile
            if (this.ship.state === 'Flying') {
                for (const hostile of this.ship.hostiles) {
                    if (!isValidAttackTarget(this.ship, hostile, this.attackDisabledShips) || this.ship.getRelationship(hostile) !== FactionRelationship.Hostile) continue;
                    const distanceSq = this._scratchDistance.set(hostile.position)
                        .subtractInPlace(this.ship.position).squareMagnitude();
                    if (distanceSq < 500 * 500.0) {
                        if (this.ship.debug) {
                            console.log('Job: Hostile within 500 units, switching to Attack');
                        }
                        this.ship.target = hostile;
                        this.changeState('Attack', new AttackAutopilot(this.ship, hostile, true));
                        return;
                    }
                }
            }
        }
        super.updateJob(deltaTime, gameManager);
    }

    /**
     * Handles the 'Avoid' state, running AvoidAutopilot and checking for flee or job transitions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        super.updateAvoid(deltaTime, gameManager);
        // Check for timeout fleeing
        if ((!this.autopilot || (this.autopilot instanceof AvoidAutopilot && this.autopilot.timeElapsed >= this.autopilot.timeout)) && !this.isSafe()) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                if (this.ship.debug) {
                    console.log('Avoid: Timeout or complete and not safe, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }
    }

    /**
     * Handles the 'Flee' state, running FleeAutopilot and checking for job transition.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        super.updateFlee(deltaTime, gameManager);
    }

    /**
     * Handles damage, updating state based on shields and hull.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - The ship causing the damage.
     */
    onDamage(damage, source) {
        super.onDamage(damage, source);
        this.safeTime = 0.0;

        // Check if shields are down and hull <50%
        if (this.ship.state === 'Flying' && ((this.ship.shield && this.ship.shield.strength <= 0.0) || !this.ship.shield) && remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.5) {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, false)) {
                if (this.ship.debug) {
                    console.log('onDamage: Shields down and low hull, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, source));
            }
        } else if (this.state !== 'Avoid' && this.state !== 'Flee' && this.state !== 'Attack') {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, this.attackDisabledShips)) {
                if (this.ship.debug) {
                    console.log('onDamage: Hostile detected, switching to Attack');
                }
                this.changeState('Attack', new AttackAutopilot(this.ship, source, true));
            }
        }
    }

    /**
     * Changes state and autopilot, handling cleanup.
     * @param {string} newState - The new state ('Job', 'Flee', 'Avoid', 'Attack').
     * @param {Autopilot} [newAutopilot=null] - The new autopilot, if any.
     */
    changeState(newState, newAutopilot = null) {
        super.changeState(newState, newAutopilot);
        // Light mode handled in update
    }
}