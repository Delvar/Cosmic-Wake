// /src/autopilot/attackAutopilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { FlyToTargetAutopilot } from '/src/autopilot/flyToTargetAutopilot.js';
import { OrbitAttackAutopilot } from '/src/autopilot/orbitAttackAutopilot.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';
import { InRangeAttackAutopilot } from '/src/autopilot/inRangeAttackAutopilot.js';
import { FlybyAttackAutopilot } from '/src/autopilot/flybyAttackAutopilot.js';

/**
 * Coordinates attack behavior, selecting a pattern-specific sub-autopilot based on ship velocity.
 * @extends {Autopilot<Ship>}
 */
export class AttackAutopilot extends Autopilot {
    /**
     * Creates a new AttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target to attack.
     * @param {boolean} [stopOnDisabled=true] - Whether to stop if the ship is disabled.
     */
    constructor(ship, target, stopOnDisabled = true) {
        super(ship, target);
        /** @type {Ship} The Ship to target. */
        this.target = target;
        /** @type {boolean} Whether to stop autopilot if the ship is disabled. */
        this.stopOnDisabled = stopOnDisabled;
        /** @type {string} Attack pattern: "orbit", "flyby", or "in_range". */
        this.pattern = 'orbit';
        /** @type {string} Current state: "Approaching" or "Attacking". */
        this.state = "Approaching";
        /** @type {number} Radius to transition from Approaching to Attacking. */
        this.approachRadius = 1.75 * this.ship.maxVelocity;
        /** @type {number} Radius to revert from Attacking to Approaching. */
        this.revertRadius = 5.0 * this.ship.maxVelocity;
        /** @type {Vector2D} Scratch vector for distance calculations. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {
            Approaching: this.updateApproaching.bind(this),
            Attacking: this.updateAttacking.bind(this)
        };
        /** @type {number} the remaining time to execute the selected attack pattern. */
        this.attackTime = 0.0;

        if (new.target === AttackAutopilot) Object.seal(this);
    }

    /**
     * Determines the attack pattern based on ship max velocity.
     * @param {number} maxVelocity - The ship's maximum velocity.
     * @returns {string} The pattern ("in_range", "orbit", "flyby").
     */
    determinePattern(maxVelocity) {
        if (maxVelocity > 150.0) {
            if (Math.random() > 0.5) {
                return "orbit";
            } else {
                return "flyby";
            }
        } else {
            return "in_range";
        }
    }

    /**
     * Starts the attack sequence, validating the target and beginning approach.
     * @returns {void}
     */
    start() {
        if (!(this.target instanceof Ship)) {
            throw new TypeError('target must be an instance of Ship');
        }
        if (!isValidAttackTarget(this.ship, this.target, !this.stopOnDisabled)) {
            this.error = "Invalid or unreachable target";
            this.stop();
            return;
        }
        this.active = true;
        this.completed = false;
        this.error = null;
        this.state = "Approaching";
        if (this.subAutopilot?.active) {
            this.subAutopilot.stop();
        }
        this.subAutopilot = new FlyToTargetAutopilot(
            this.ship,
            this.target,
            this.approachRadius,
            this.ship.maxVelocity,
        );
        this.subAutopilot.start();
        this.debugLog(() => console.log(`${this.constructor.name}: Started, pattern=${this.pattern}, state=Approaching`));
    }

    /**
     * Updates the attack sequence each frame, validating the target and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (!isValidAttackTarget(this.ship, this.target, !this.stopOnDisabled)) {
            this.completed = true;
            this.stop();
            return;
        }

        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the Approaching state by using FlyToTargetAutopilot to close the distance to the target.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateApproaching(deltaTime, gameManager) {
        if (!(this.target instanceof Ship)) {
            throw new TypeError('target must be an instance of Ship');
        }
        if (this.subAutopilot && this.subAutopilot.active) {
            this.subAutopilot.update(deltaTime, gameManager);
            // Check distance to target
            const distanceSq = this.ship.position.distanceSquaredTo(this.target.position);
            if (distanceSq <= this.approachRadius * this.approachRadius || this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot.stop();
                this.subAutopilot = null;
                this.startAttack();
            }
        } else {
            this.error = "No sub-autopilot in Approaching state";
            this.stop();
        }
    }

    /**
     * Initiates the selected attack pattern and starts its sub-autopilot.
     * @returns {void}
     */
    startAttack() {
        if (!(this.target instanceof Ship)) {
            throw new TypeError('target must be an instance of Ship');
        }
        this.state = "Attacking";
        this.attackTime = Math.random() * 5.0 + 5.0;
        this.pattern = this.determinePattern(this.ship.maxVelocity);
        // Initialize pattern-specific sub-autopilot
        if (this.pattern === "in_range") {
            this.subAutopilot = new InRangeAttackAutopilot(this.ship, this.target, this.stopOnDisabled);
        } else if (this.pattern === "orbit") {
            this.subAutopilot = new OrbitAttackAutopilot(this.ship, this.target, this.stopOnDisabled);
        } else {
            this.subAutopilot = new FlybyAttackAutopilot(this.ship, this.target, this.stopOnDisabled);
        }
        this.subAutopilot.start();
        this.debugLog(() => console.log(`${this.constructor.name}: Transitioned to Attacking, pattern=${this.pattern}`));
    }

    /**
     * Handles the Attacking state by updating the active attack pattern and reverting to approach if the target moves away.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateAttacking(deltaTime, gameManager) {
        if (!(this.target instanceof Ship)) {
            throw new TypeError('target must be an instance of Ship');
        }
        this.attackTime -= deltaTime;

        if (this.attackTime <= 0.0) {
            this.startAttack();
        }

        if (this.subAutopilot && this.subAutopilot.active) {
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete() || this.subAutopilot.error) {
                this.error = this.subAutopilot.error || "Sub-autopilot completed unexpectedly";
                this.stop();
                return;
            }
            // Check distance to revert to Approaching
            const distanceSq = this.ship.position.distanceSquaredTo(this.target.position);
            if (distanceSq > this.revertRadius * this.revertRadius) {
                this.subAutopilot.stop();
                this.subAutopilot = null;
                this.state = "Approaching";
                this.subAutopilot = new FlyToTargetAutopilot(
                    this.ship,
                    this.target,
                    this.approachRadius,
                    this.ship.maxVelocity,
                );
                this.subAutopilot.start();
                this.debugLog(() => console.log(`${this.constructor.name}: Reverted to Approaching, distance=${Math.sqrt(distanceSq)}`));
            }
        } else {
            this.error = "No sub-autopilot in Attacking state";
            this.stop();
        }
    }

    /**
     * Stops the attack autopilot and any active pattern sub-autopilot.
     * @returns {void}
     */
    stop() {
        if (this.subAutopilot) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
        }
        this.active = false;
        this.ship.applyThrust(false);
        this.debugLog(() => console.log(`${this.constructor.name}: Stopped`));
    }
}
