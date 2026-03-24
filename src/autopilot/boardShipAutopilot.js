// /src/autopilot/boardShipAutopilot.js
import { Autopilot } from '/src/autopilot/autopilot.js';
import { FlyToTargetAutopilot } from '/src/autopilot/flyToTargetAutopilot.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { normalizeAngle } from '/src/core/utils.js';
import { GameManager } from '/src/core/game.js';

/**
 * Autopilot that uses FlyToTargetAutopilot to approach a disabled ship, then initiate boarding to capture it.
 * @extends Autopilot
 */
export class BoardShipAutopilot extends Autopilot {
    /**
     * Creates a new BoardShipAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} targetShip - The target ship to board and capture.
     */
    constructor(ship, targetShip) {
        super(ship, targetShip);
        /** @type {FlyToTargetAutopilot|null} Sub-autopilot for approaching the target ship. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target ship. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === BoardShipAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is a disabled ship in the same system.
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

        if (this.target.state !== 'Disabled') {
            this.error = 'Target ship is not disabled';
            this.active = false;
            return;
        }

        // Initialize sub-autopilot to approach the target ship
        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, boarding initiation, and completion.
     * Restarts the sub-autopilot if the ship overshoots and cannot board yet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (!this.target || this.target.state !== 'Disabled' || this.target.isDespawned() || !(this.target instanceof Ship)) {
            this.error = 'Target ship is no longer valid or not disabled';
            this.stop();
            return;
        }

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot for approaching the target ship
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to boarding check
            }
        } else if (this.ship.state === 'Flying') {
            // Check distance to target ship for boarding readiness
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            const distanceToTargetCenter = this._scratchDistanceToTarget.magnitude();

            if (distanceToTargetCenter <= this.target.radius) {
                if (this.target instanceof Ship && this.ship.canBoard(this.target)) {
                    // Initiate boarding if conditions are met
                    this.ship.initiateBoarding(this.target);
                } else {
                    // Slow down and adjust position if not ready to board
                    // Adapted from LandOnPlanetAutopilot for smooth approach
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    this._scratchVelocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                }
            } else {
                // Overshot the target ship; restart sub-pilot to re-approach
                this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'Landing') {
            // Wait for boarding action to complete (e.g., animation or timer)
        } else if (this.ship.state === 'Landed') {
            // Boarding completed successfully, ship captured
            this.completed = true;
            this.stop();
        } else {
            // Handle unexpected ship states
            this.error = `Unexpected ship state during boarding: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot and any active sub-autopilot.
     */
    stop() {
        if (this.subAutopilot) this.subAutopilot.stop();
        super.stop();
    }
}