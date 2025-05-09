// ai/aiPilot.js

import { Pilot } from '/src/pilot.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';

/**
 * AI pilot coordinating jobs and reactions without a state machine.
 * @extends Pilot
 */
export class AIPilot extends Pilot {
    /**
     * Creates a new AIPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Object} job - The job instance (e.g., WandererJob).
     * @param {Object} reaction - The reaction instance (e.g., CivilianReaction).
     */
    constructor(ship, job, reaction) {
        super(ship);
        this.job = job;
        this.reaction = reaction;
        this.autopilot = null;
        this.threat = null;
        this.reactionAutopilot = false; // Track if autopilot is from reaction
        this.reactionCooldown = 0; // Anti-flip-flop cooldown
        this._scratchVector = new Vector2D(); // For threat distance checks
    }

    /**
     * Notified when the ship takes damage.
     * @param {number} damage - Amount of damage.
     * @param {Ship} source - Ship causing damage.
     */
    onDamage(damage, source) {
        if (source instanceof Ship && source !== this.ship) {
            this.threat = source;
            this.reaction.onDamage(source, this);
        }
    }

    /**
     * Sets a new autopilot, stopping and cleaning up the current one.
     * @param {AutoPilot} newAutoPilot - The new autopilot to set.
     * @param {boolean} isReaction - True if set by reaction.
     */
    setAutoPilot(newAutoPilot, isReaction = false) {
        if (this.autopilot) {
            this.autopilot.stop();
            this.autopilot = null;
        }
        this.autopilot = newAutoPilot;
        this.reactionAutopilot = isReaction;
        if (this.autopilot) {
            this.autopilot.start();
        }
        console.log(`setAutoPilot`, newAutoPilot, isReaction);
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

        // Check reaction for threats
        this.reaction.update(deltaTime, this);

        // Execute active autopilot (from reaction or job)
        if (this.autopilot) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
            // Check reaction completion only for reaction autopilots
            if (this.reactionAutopilot && this.reaction.isComplete(this)) {
                this.setAutoPilot(null);
                this.threat = null;
                this.reactionCooldown = 1; // 1s cooldown to prevent flip-flopping
                this.job.resume();
            }
            return;
        }

        // No autopilot, delegate to job
        if (this.ship.state === 'Landed' || this.ship.state === 'Flying') {
            this.job.update(deltaTime, this);
        }
    }
}