// /src/pilot/aiPilot.js

import { Pilot } from '/src/pilot/pilot.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { FleeAutopilot } from '/src/autopilot/fleeAutopilot.js';
import { LandOnPlanetDespawnAutopilot } from '/src/autopilot/landOnPlanetDespawnAutopilot.js';
import { AvoidAutopilot } from '/src/autopilot/avoidAutopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { CargoCollectorAutopilot } from '/src/autopilot/cargoCollectorAutopilot.js';
import { Job } from '/src/job/job.js';
import { GameManager } from '/src/core/game.js';
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
     * @throws {Error} If called directly instead of sub classing.
     */
    constructor(ship, job = null, attackDisabledShips = false) {
        super(ship);
        if (job) {
            // Set the job pilot so it can update back to us
            job.pilot = this;
        }
        /** @type {Job} The job instance controlling high-level behavior (e.g., WandererJob). */
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
            'Collecting': this.updateCollecting.bind(this),
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

        if (this.isSafe()) {
            this.safeTime += deltaTime;
        } else {
            this.safeTime = 0.0;
        }

        // Run state handler
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
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
                console.log(`${this.constructor.name}: Job failed, transitioning to Despawning`);
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
                    console.log(`${this.autopilot.constructor.name} is complete, setting to null`);
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
                console.log(`${this.constructor.name}: Avoid: Incorrect autopilot, setting AvoidAutopilot`);
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
                console.log(`${this.constructor.name}: Flee: Setting FleeAutopilot`);
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
                console.log(`${this.constructor.name}: Not Flying (${this.ship.state}), reverting to Job`);
            }
            this.changeState('Job');
            return;
        }

        if (this.autopilot && this.autopilot.active && this.autopilot instanceof AttackAutopilot && !this.autopilot.error) {
            this.autopilot.update(deltaTime, gameManager);
        } else {
            // Log error if present
            if (this.autopilot && this.autopilot.error && this.ship.debug) {
                console.warn(`${this.constructor.name}: AttackAutopilot error: ${this.autopilot.error}`);
            }

            // Select a target from hostiles
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (!target) {
                if (this.ship.debug) {
                    console.log(`${this.constructor.name}: No valid hostile target, reverting to Job`);
                }
                this.ship.target = null;
                this.changeState('Job');
                return;
            }

            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Setting AttackAutopilot for target ${target.name}`);
            }
            this.ship.target = target; // Set for turret firing
            this.setAutopilot(new AttackAutopilot(this.ship, target, true));
        }
    }

    /**
     * Handles the 'Collecting' state, collecting cargo using CargoCollectorAutopilot.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateCollecting(deltaTime, gameManager) {
        // Use CargoCollectorAutopilot
        if (!this.autopilot || !(this.autopilot instanceof CargoCollectorAutopilot)) {
            this.setAutopilot(new CargoCollectorAutopilot(this.ship));
        }

        // Did the autopilot complete? Either no cargo room left or no cargo containers available.
        if (this.autopilot.isComplete()) {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Collecting complete, back to Job`);
            }
            this.ship.target = null;
            this.changeState('Job');
            return;
        }

        if (this.ship.state !== 'Flying') {
            if (this.ship.debug) {
                console.log(`${this.constructor.name}: Not Flying (${this.ship.state}), reverting to Job`);
            }
            this.changeState('Job');
            return;
        }

        if (this.autopilot && this.autopilot.active) {
            this.autopilot.update(deltaTime, gameManager);
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
            console.log(`${this.constructor.name}: setAutopilot ${this.ship.name}: ${this.autopilot?.constructor?.name} >> ${newAutopilot?.constructor?.name}`);
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

        if (!this.job) {
            console.error('!this.job', this);
        }

        // Resume the job when entering Job state
        if (newState === 'Job') {
            this.job.resume();
        }
        // Set new state and autopilot
        this.state = newState;
        this.setAutopilot(newAutopilot);
        if (this.ship.debug) {
            console.log(`${this.constructor.name}: State changed to ${newState}`);
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