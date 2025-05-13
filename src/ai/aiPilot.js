// ai/aiPilot.js

import { Pilot } from '/src/pilot.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { AvoidAutoPilot, FleeAutoPilot } from '/src/autopilot/autopilot.js';

/**
 * Base AI pilot with common states and reaction handling.
 * @extends Pilot
 */
export class AIPilot extends Pilot {
    /**
     * Creates a new AIPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Object} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship);
        this.job = job;
        this.autopilot = null;
        this.threat = null;
        this.state = 'Job';
        this.reactionCooldown = 0; // Anti-flip-flop cooldown
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchDistance = new Vector2D();
        this.stateHandlers = {
            'Job': this.updateJob.bind(this),
            'Flee': this.updateFlee.bind(this),
            'Avoid': this.updateAvoid.bind(this),
            'Attack': this.updateAttack.bind(this)
        };
    }

    /**
     * Notified when the ship takes damage.
     * @param {number} damage - Amount of damage.
     * @param {Ship} source - Ship causing damage.
     */
    onDamage(damage, source) {
        if (source instanceof Ship && source !== this.ship) {
            this.threat = source;
        }
    }

    /**
     * Sets a new autopilot, stopping and cleaning up the current one.
     * @param {AutoPilot} newAutoPilot - The new autopilot to set.
     */
    setAutoPilot(newAutoPilot) {
        console.log(`setAutoPilot ${this.ship.name}: ${this.autopilot?.constructor?.name} >> ${newAutoPilot?.constructor?.name}`);
        if (this.autopilot) {
            this.autopilot.stop();
            this.autopilot = null;
        }
        this.autopilot = newAutoPilot;
        if (this.autopilot) {
            this.autopilot.start();
        }
    }

    /**
     * Changes state and autopilot, handling cleanup.
     * @param {string} newState - The new state ('Job', 'Flee', 'Avoid', 'Attack').
     * @param {AutoPilot} newAutoPilot - The new autopilot, if any.
     */
    changeState(newState, newAutoPilot = null) {
        if (this.state === newState) return;
        // Pause job only when leaving Job state
        if (this.state === 'Job') {
            this.job.pause();
        }
        // Set new state and autopilot
        this.state = newState;
        this.setAutoPilot(newAutoPilot);
        // Reset cooldown for reaction states
        if (newState !== 'Job') {
            this.reactionCooldown = 0;
        }
    }

    /**
     * Updates the AI pilot's behavior.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {Object} gameManager - The game manager instance.
     */
    update(deltaTime, gameManager) {
        // Skip if ship is in animation or non-functional states
        if (this.ship.state === 'Landing' || this.ship.state === 'TakingOff' ||
            this.ship.state === 'JumpingOut' || this.ship.state === 'JumpingIn' ||
            this.ship.state === 'Disabled' || this.ship.state === 'Exploding') {
            return;
        }

        // Update reaction cooldown
        if (this.reactionCooldown > 0) {
            this.reactionCooldown = Math.max(0, this.reactionCooldown - deltaTime);
        }

        // Fire at threat if within 500 units
        if (this.threat && this.threat.state === 'Flying' && !this.threat.isDespawned()) {
            const distanceSq = this.ship.position.distanceSquaredTo(this.threat.position);
            if (distanceSq < 500 * 500) {
                this.ship.setTarget(this.threat);
                this.ship.fire();
            }
        }

        // Run state handler
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        }
    }

    /**
     * Handles Job state, running the assigned job.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    updateJob(deltaTime) {
        // Execute active autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
        } else {
            // Run job to set next autopilot
            if (this.ship.state === 'Landed' || this.ship.state === 'Flying') {
                this.job.update(deltaTime, this);
            }
        }
    }

    /**
     * Handles Flee state, running FleeAutoPilot.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    updateFlee(deltaTime) {
        // Ensure correct autopilot
        if (!(this.autopilot instanceof FleeAutoPilot) && this.ship.state === 'Flying' && this.threat) {
            this.setAutoPilot(new FleeAutoPilot(this.ship, this.threat));
        }
        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
        }
        // Transition to Job if safe
        if (this.isSafe() && !this.autopilot) {
            this.changeState('Job');
            this.threat = null;
            this.job.resume();
        }
    }

    /**
     * Handles Avoid state, running AvoidAutoPilot.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    updateAvoid(deltaTime) {
        // Ensure correct autopilot
        if (!(this.autopilot instanceof AvoidAutoPilot) && this.ship.state === 'Flying' && this.threat) {
            this.setAutoPilot(new AvoidAutoPilot(this.ship, this.threat));
        }
        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
        }
        // Transition to Job if safe
        if (this.isSafe() && !this.autopilot) {
            this.changeState('Job');
            this.threat = null;
            this.job.resume();
        }
    }

    /**
     * Handles Attack state, placeholder for subclasses.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    updateAttack(deltaTime) {
        this.changeState('Job');
    }

    /**
     * Checks if the ship is safe from the threat.
     * @returns {boolean} True if safe.
     */
    isSafe() {
        if (this.ship.state === 'Landed') return true;
        if (!this.threat) return true;
        if (this.ship.starSystem !== this.threat.starSystem) return true;
        const distanceSq = this._scratchDistance.set(this.threat.position)
            .subtractInPlace(this.ship.position).squareMagnitude();
        return distanceSq > 1000 * 1000; // Safe if threat > 1000 units
    }

    /**
     * Returns the pilot's status for debugging.
     * @returns {string} Status string.
     */
    getStatus() {
        if (this.ship.debug) {
            let status = `${this.constructor.name}: ${this.state}, `;
            if (this.state === 'Job') {
                status += `${this.job.constructor.name}: ${this.job.getStatus()}, `;
            }
            if (this.autopilot) {
                status += `${this.autopilot.constructor.name}: ${this.autopilot.getStatus()}`;
            }
            return status;
        } else {
            if (this.autopilot) {
                return this.autopilot.getStatus();
            }
            return 'idle';
        }
    }
}