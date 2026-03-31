// /src/autopilot/landOnAsteroidAutopilot.js
import { Autopilot } from '/src/autopilot/autopilot.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { FlyToTargetAutopilot } from '/src/autopilot/flyToTargetAutopilot.js';
import { normalizeAngle } from '/src/core/utils.js';
import { GameManager } from '/src/core/game.js';

/**
 * @extends Autopilot
 */
export class LandOnAsteroidAutopilot extends Autopilot {
    /**
     * Creates a new LandOnAsteroidAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Asteroid} asteroid - The asteroid to land on and mine.
     */
    constructor(ship, asteroid) {
        super(ship, asteroid);
        /** @type {Vector2D} Pre-allocated vector for distance calculations. */
        this._scratchDistanceToTarget = new Vector2D(0.0, 0.0);

        if (new.target === LandOnAsteroidAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, ensuring the target is an asteroid in the same system.
     * @override
     */
    start() {
        super.start();

        if (!(this.target instanceof Asteroid)) {
            this.error = 'Target is not an Asteroid';
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
     * Updates the autopilot, managing the approach phase, mining initiation, and completion.
     * Restarts the sub-pilot if the ship overshoots and can't mine yet.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     * @override
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;

        if (this.subAutopilot && this.subAutopilot.active) {
            // Delegate to sub-pilot for approaching the asteroid
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null; // Sub-pilot done, proceed to mining check
            }
        } else if (this.ship.state === 'Flying') {
            // Check distance to asteroid for mining readiness
            this._scratchDistanceToTarget.set(this.ship.position).subtractInPlace(this.target.position);
            const distanceToAsteroidCenter = this._scratchDistanceToTarget.magnitude();

            if (distanceToAsteroidCenter <= this.target.radius) {
                if (this.ship.canLand(this.target)) {
                    // Initiate mining if conditions are met
                    this.ship.initiateLanding(this.target);
                    return;
                } else {
                    // Slow down if not ready to mine (e.g., speed too high)
                    this._scratchVelocityError.set(this.target.velocity).subtractInPlace(this.ship.velocity);
                    const desiredAngle = Math.atan2(this._scratchVelocityError.x, -this._scratchVelocityError.y);
                    const angleToDesired = normalizeAngle(desiredAngle - this.ship.angle);
                    this.ship.setTargetAngle(this.ship.angle + angleToDesired);
                    const velocityErrorMagnitude = this._scratchVelocityError.magnitude();
                    if (velocityErrorMagnitude > 1.0) {
                        this.ship.applyThrust(Math.abs(angleToDesired) < Math.PI / 12.0);
                    }
                }
            } else {
                // Overshot the asteroid; restart sub-pilot to re-approach
                this.debugLog(() => console.log(`${this.constructor.name}: Overshot ${this.target.name || 'asteroid'}; restarting approach phase`));
                this.subAutopilot = new FlyToTargetAutopilot(
                    this.ship,
                    this.target,
                    this.target.radius,
                    Ship.LANDING_SPEED,
                );
                this.subAutopilot.start();
            }
        } else if (this.ship.state === 'Landing') {
            // Wait for landing animation to complete
        } else if (this.ship.state === 'Landed') {
            // Mining started successfully; mark as complete
            this.completed = true;
            this.stop();
        } else {
            // Handle unexpected states (e.g., TakingOff, JumpingOut)
            this.error = `Unexpected ship state during mining: ${this.ship.state}`;
            this.stop();
        }
    }

    /**
     * Stops the autopilot and any active sub-autopilot.
     * @override
     */
    stop() {
        if (this.subAutopilot) this.subAutopilot.stop();
        super.stop();
    }
}