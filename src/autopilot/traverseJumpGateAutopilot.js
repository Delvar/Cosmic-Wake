// /src/autopilot/traverseJumpGateAutopilot.js

import { Autopilot } from '/src/autopilot/autopilot.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { JumpGate } from '/src/starSystem/celestialBody.js';
import { normalizeAngle } from '/src/core/utils.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';
import { FlyToTargetAutopilot } from '/src/autopilot/flyToTargetAutopilot.js';

/**
 * @extends Autopilot
 */
export class TraverseJumpGateAutopilot extends Autopilot {
    /**
     * Creates a new TraverseJumpGateAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {JumpGate} gate - The jump gate to traverse.
     */
    constructor(ship, gate) {
        super(ship, gate);
        /** @type {FlyToTargetAutopilot|null} Sub-autopilot for approaching the jump gate. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target jump gate. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === TraverseJumpGateAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is a jump gate in the same system.
     */
    start() {
        super.start();

        if (!(this.target instanceof JumpGate)) {
            this.error = 'Target is not a JumpGate';
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

        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, this.ship.maxVelocity);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, hyperjump initiation, and jump completion.
     * Restarts the sub-autopilot if the ship is not aligned with the gate.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot to approach the jump gate
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to jump phase
            }
        } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.lane.target) {
            // Jump completed successfully
            this.completed = true;
            this.stop();
        } else if (this.ship.state === 'Flying') {
            // Check if ship is close enough to initiate hyperjump
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            if (this.target.overlapsPoint(this.ship.position)) {
                if (this.ship.initiateHyperjump()) {
                    // Hyperjump initiated; wait for animation
                } else {
                    // Slow down if hyperjump fails (e.g., not ready)
                    // TODO: Replace this hack with better alignment logic
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    this._scratchVelocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                }
            } else {
                // Not aligned with gate; restart sub-pilot
                if (this.ship.debug) {
                    console.log(`Not aligned with ${this.target.name || 'jump gate'}; restarting fly-to phase`);
                }
                this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'JumpingOut' || this.ship.state === 'JumpingIn') {
            // Wait for jump animation to complete
        } else {
            // Handle unexpected ship states
            this.error = `Unexpected ship state during jump: ${this.ship.state}`;
            this.stop();
        }
    }
}