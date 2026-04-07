// /src/autopilot/avoidAutopilot.js
import { Autopilot } from './autopilot.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';

/**
 * Autopilot that moves a ship away from a threat while biasing motion toward sector center.
 * It maintains avoidance for a limited timeout and then completes.
 * @extends {Autopilot<Ship>}
 */
export class AvoidAutopilot extends Autopilot {
    /**
     * Creates a new AvoidAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} threat - The threat to avoid.
     */
    constructor(ship, threat) {
        super(ship);
        /** @type {Ship} The ship posing a threat to avoid. */
        this.threat = threat;
        /** @type {number} Maximum duration (seconds) to attempt avoiding the threat. */
        this.timeout = 30.0;
        /** @type {number} Cumulative time (seconds) spent avoiding the threat. */
        this.timeElapsed = 0.0;
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);

        if (new.target === AvoidAutopilot) Object.seal(this);
    }

    /**
     * Starts avoidance behavior, validating the threat and resetting the timeout.
     * @returns {void}
     */
    start() {
        super.start();

        if (!(this.threat instanceof Ship)) {
            this.error = 'Threat is not a ship';
            this.active = false;
            return;
        }

        if (!this.threat) {
            this.error = 'No threat';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.threat)) {
            this.error = 'Threat not in same system';
            this.active = false;
            return;
        }

        this.timeElapsed = 0.0;
        this.ship.target = this.threat;
    }

    /**
     * Updates avoidance behaviour each frame, steering the ship away from the threat while still maintaining control.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    update(deltaTime, gameManager) {
        if (!this.threat || this.ship.state !== 'Flying') {
            this.completed = true;
            this.stop();
            return;
        }

        this.timeElapsed += deltaTime;
        if (this.timeElapsed >= this.timeout) {
            this.completed = true;
            this.stop();
            return;
        }

        // Calculate distance and direction to threat
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.threat.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Compute desired velocity away from threat and towards system center
        this._scratchDesiredVelocity.set(this.ship.position).normalizeInPlace().multiplyInPlace(0.5).addInPlace(this._scratchDirectionToTarget).normalizeInPlace().multiplyInPlace(-this.ship.maxVelocity);

        // Apply thrust with hysteresis
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this.ship.velocity,
            1.0,
            this._scratchVelocityError
        );
    }

    /**
     * Returns a status string for HUD display describing the current avoidance action or error.
     * @returns {string} The status string.
     */
    getStatus() {
        if (this.subAutopilot?.active) {
            return `${this.getActionName()}: ${this.subAutopilot.getStatus()}`;
        }

        const threatName = this.threat?.name || (this.target instanceof Ship ? 'ship' : 'threat');
        const baseStatus = this.state ? `${this.getActionName()} ${threatName} (${this.state})` : `${this.getActionName()} ${threatName}`;
        return this.error ? `${baseStatus}, Error: ${this.error}` : baseStatus;
    }
}