// /src/autopilot/landOnPlanetAutopilot.js
import { Autopilot } from './autopilot.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { Planet } from '/src/starSystem/celestialBody.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { normalizeAngle } from '/src/core/utils.js';
import { GameManager } from '/src/core/game.js';
import { FlyToTargetAutopilot } from '/src/autopilot/flyToTargetAutopilot.js';

/**
 * Autopilot that uses FlyToTargetAutopilot to a target, then initiate landing.
 * @extends Autopilot
 */
export class LandOnPlanetAutopilot extends Autopilot {
    /**
     * Creates a new LandOnPlanetAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Planet} planet - The planet to land on.
     */
    constructor(ship, planet) {
        super(ship, planet);
        /** @type {FlyToTargetAutopilot|null} Sub-autopilot for approaching the planet. */
        this.subAutopilot = null;
        /** @type {Vector2D} Distance vector from ship to target planet. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === LandOnPlanetAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is a planet in the same system.
     */
    start() {
        super.start();

        if (!(this.target instanceof Planet)) {
            this.error = 'Target is not a planet';
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

        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing the fly-to phase, landing initiation, and completion.
     * Restarts the sub-autopilot if the ship overshoots and cannot land yet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot for approaching the planet
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to landing check
            }
        } else if (this.ship.state === 'Flying') {
            // Check distance to planet for landing readiness
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            const distanceToPlanetCenter = this._scratchDistanceToTarget.magnitude();

            if (distanceToPlanetCenter <= this.target.radius) {
                if (this.target instanceof Planet && this.ship.canLand(this.target)) {
                    // Initiate landing if conditions are met
                    this.ship.initiateLanding(this.target);
                } else {
                    // Slow down if not ready to land (e.g., speed too high)
                    // TODO: Replace this hack with better approach tuning
                    this.ship.velocity.multiplyInPlace(1 - (0.5 * deltaTime));
                    this.ship.position.addInPlace(this._scratchTemp.set(this._scratchDistanceToTarget).multiplyInPlace(-0.5 * deltaTime));
                    this._scratchVelocityError.set(-this.ship.velocity.x, -this.ship.velocity.y);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                }
            } else {
                // Overshot the planet; restart sub-pilot to re-approach
                this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, Ship.LANDING_SPEED);
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'Landing') {
            // Wait for landing animation to complete
        } else if (this.ship.state === 'Landed') {
            // Landing completed successfully
            this.completed = true;
            this.stop();
        } else {
            // Handle unexpected ship states (e.g., TakingOff, JumpingOut)
            this.error = `Unexpected ship state during landing: ${this.ship.state}`;
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