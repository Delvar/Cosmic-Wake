// ai/aiPilot.js

import { Pilot } from '/src/pilot.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { AvoidAutoPilot, FleeAutoPilot, LandOnPlanetDespawnAutoPilot } from '/src/autopilot/autopilot.js';

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
        /** @type {Object} The job instance controlling high-level behavior (e.g., WandererJob). */
        this.job = job;
        // set the job pilot so it can update back to us
        this.job.pilot = this;
        /** @type {AutoPilot|null} The active autopilot controlling ship navigation (e.g., FlyToTargetAutoPilot). */
        this.autopilot = null;
        /** @type {Ship|null} The current threat triggering reactions (e.g., player ship). */
        this.threat = null;
        /** @type {string} The current state ('Job', 'Flee', 'Avoid', 'Attack'). */
        this.state = 'Job';
        /** @type {number} Cooldown timer (seconds) to prevent rapid state changes. */
        this.reactionCooldown = 0; // Anti-flip-flop cooldown
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchDistance = new Vector2D();
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Job': this.updateJob.bind(this),
            'Flee': this.updateFlee.bind(this),
            'Avoid': this.updateAvoid.bind(this),
            'Attack': this.updateAttack.bind(this),
            'Despawning': this.updateDespawning.bind(this)
        };
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
     * Handles the 'Job' state, running the job and checking reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateJob(deltaTime, gameManager) {
        if (this.job.state === 'Failed') {
            if (this.ship.debug) {
                console.log('AIPilot: Job failed, transitioning to Despawning');
            }
            this.changeState('Despawning', new LandOnPlanetDespawnAutoPilot(this.ship));
            return;
        }

        // Execute active autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime, gameManager);
            return;
        }

        // Run job to set next autopilot
        if (this.ship.state === 'Landed' || this.ship.state === 'Flying') {
            this.job.update(deltaTime, gameManager);
        }

        // If autopilot is compelte null it, this ensures Job gets to see the compelte autopilot first
        if (this.autopilot) {
            if (this.autopilot.error && this.ship.debug) {
                console.warn(`autopilot ${this.autopilot.constructor.name} has an error: ${this.autopilot.error}`);
            }
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
        }
    }

    /**
     * Handles the 'Flee' state, managing flee behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
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
     * Handles the 'Avoid' state, managing avoidance behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
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
     * Handles the 'Attack' state, managing attack behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAttack(deltaTime, gameManager) {
        this.changeState('Job');
    }

    /**
     * Handles the 'Despawning' state, landing on the closest planet and despawning.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateDespawning(deltaTime, gameManager) {
        if (!(this.autopilot instanceof LandOnPlanetDespawnAutoPilot)) {
            this.setAutoPilot(new LandOnPlanetDespawnAutoPilot(this.ship));
        }
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
        }
        if (this.autopilot?.error) {
            if (this.ship.debug) {
                console.warn(`Despawn failed: ${this.autopilot.error}`);
            }
            this.ship.despawn();
            this.setAutoPilot(null);
        }
    }

    /**
     * Sets a new autopilot, stopping and cleaning up the current one.
     * @param {AutoPilot|null} newAutoPilot - The new autopilot to set, or null to clear.
     */
    setAutoPilot(newAutoPilot) {
        if (this.ship.debug) {
            console.log(`setAutoPilot ${this.ship.name}: ${this.autopilot?.constructor?.name} >> ${newAutoPilot?.constructor?.name}`);
        }
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
     * Notified when the ship takes damage.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - Ship causing the damage.
     */
    onDamage(damage, source) {
        if (source instanceof Ship && source !== this.ship) {
            this.threat = source;
        }
    }

    /**
     * Changes state and autopilot, handling cleanup.
     * @param {string} newState - The new state ('Job', 'Flee', 'Avoid', 'Attack').
     * @param {AutoPilot} [newAutoPilot=null] - The new autopilot, if any.
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
        if (this.ship.debug) {
            console.log(`AIPilot: State changed to ${newState}`);
        }
    }

    /**
     * Returns the pilot's status for HUD display and debugging.
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