// /src/autopilot/attackAutopilot.js

import { Vector2D } from '/src/core/vector2d.js';
import { Autopilot, FlyToTargetAutopilot } from '/src/autopilot/autopilot.js';
import { remapClamp, randomBetween, clamp } from '/src/core/utils.js';
import { GameObject } from '/src/core/gameObject.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';

/**
 * Coordinates attack behavior, selecting a pattern-specific sub-autopilot based on ship velocity.
 * @extends Autopilot
 */
export class AttackAutopilot extends Autopilot {
    /**
     * Creates a new AttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target to attack.
     */
    constructor(ship, target) {
        super(ship, target);
        /** @type {Ship} The Ship to target. */
        this.target = target;
        /** @type {string} Attack pattern: "orbit", "flyby", or "inrange". */
        this.pattern = null;
        /** @type {string} Current state: "Approaching" or "Attacking". */
        this.state = "Approaching";
        /** @type {Autopilot|null} Sub-autopilot for specific attack behavior. */
        this.subAutopilot = null;
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
        /** @type {number} the remaining time to execute the selected attack patern. */
        this.attackTime = 0.0;

        if (new.target === AttackAutopilot) Object.seal(this);
    }

    /**
     * Determines the attack pattern based on ship max velocity.
     * @param {number} maxVelocity - The ship's maximum velocity.
     * @returns {string} The pattern ("inrange", "orbit", "flyby").
     */
    determinePattern(maxVelocity) {
        if (maxVelocity > 150.0) {
            if (Math.random() > 0.5) {
                return "orbit";
            } else {
                return "flyby";
            }
        } else {
            return "inrange";
        }
    }

    /**
     * Starts the autopilot, initializing the approach sub-autopilot.
     */
    start() {
        if (!isValidAttackTarget(this.ship, this.target)) {
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
        if (this.ship.debug) {
            console.log(`AttackAutopilot: Started, pattern=${this.pattern}, state=Approaching`);
        }
    }

    /**
     * Updates the autopilot, delegating to the base class.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (!isValidAttackTarget(this.ship, this.target)) {
            this.completed = true;
            this.stop();
            return;
        }

        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the Approaching state, running FlyToTargetAutopilot until within approach radius.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateApproaching(deltaTime, gameManager) {
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
     * Initiates the attack auto pilot
     */
    startAttack() {
        this.state = "Attacking";
        this.attackTime = Math.random() * 5.0 + 5.0;
        this.pattern = this.determinePattern(this.ship.maxVelocity);
        // Initialize pattern-specific sub-autopilot
        if (this.pattern === "inrange") {
            this.subAutopilot = new InRangeAttackAutopilot(this.ship, this.target);
        } else if (this.pattern === "orbit") {
            this.subAutopilot = new OrbitAttackAutopilot(this.ship, this.target);
        } else {
            this.subAutopilot = new FlybyAttackAutopilot(this.ship, this.target);
        }
        this.subAutopilot.start();
        if (this.ship.debug) {
            console.log(`AttackAutopilot: Transitioned to Attacking, pattern=${this.pattern}`);
        }
    }

    /**
     * Handles the Attacking state, running the pattern-specific sub-autopilot.
     * Reverts to Approaching if distance > revertRadius.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAttacking(deltaTime, gameManager) {
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
                if (this.ship.debug) {
                    console.log(`AttackAutopilot: Reverted to Approaching, distance=${Math.sqrt(distanceSq)}`);
                }
            }
        } else {
            this.error = "No sub-autopilot in Attacking state";
            this.stop();
        }
    }

    /**
     * Stops the autopilot and sub-autopilot.
     */
    stop() {
        if (this.subAutopilot) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
        }
        this.active = false;
        this.ship.applyThrust(false);
        if (this.ship.debug) {
            console.log("AttackAutopilot: Stopped");
        }
    }
}

/**
 * Manages orbiting attack behavior, maintaining a distance from the target while firing.
 * @extends Autopilot
 */
export class OrbitAttackAutopilot extends Autopilot {
    /**
     * Creates a new OrbitAttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target to orbit and attack.
     */
    constructor(ship, target) {
        super(ship, target);
        /** @type {Ship} The Ship to target. */
        this.target = target;
        /** @type {number} Desired orbital radius around the target. */
        this.orbitRadius = randomBetween(250.0, 500.0);
        /** @type {number} Minimum allowed orbital radius. */
        this.minRadius = this.orbitRadius * 0.25;
        /** @type {number} Maximum allowed orbital radius. */
        this.maxRadius = this.orbitRadius * 1.75;
        /** @type {number} Speed of projectiles for lead aiming. */
        this.projectileSpeed = 1000.0;
        /** @type {string} Current state: "Approaching" or "Orbiting". */
        this.state = "Approaching";
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for desired velocity. */
        this._scratchDesiredVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for velocity error. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead offset. */
        this._scratchLeadOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lateral offset. */
        this._scratchLateralOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead position. */
        this._scratchLeadPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead direction. */
        this._scratchLeadDirection = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for tangent direction. */
        this._scratchTangent = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for offset position. */
        this._scratchOffsetPosition = new Vector2D(0.0, 0.0);
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {
            Approaching: this.updateApproaching.bind(this),
            Orbiting: this.updateOrbiting.bind(this)
        };

        if (new.target === OrbitAttackAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, initializing the Approaching state.
     */
    start() {
        if (!isValidAttackTarget(this.ship, this.target)) return;
        this.active = true;
        this.completed = false;
        this.error = null;
        this.state = "Approaching";
        if (this.ship.debug) {
            console.log(`OrbitAttackAutopilot: Started, orbitRadius=${this.orbitRadius}`);
        }
    }

    /**
     * Updates the autopilot, delegating to the base class.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (!this.target || !isValidAttackTarget(this.ship, this.target) || (this.target instanceof Ship && this.target.state !== 'Flying' && this.target.state !== 'Disabled')) {
            this.completed = true;
            this.stop();
            return;
        }
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the Approaching state, moving the ship toward the orbit radius.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateApproaching(deltaTime, gameManager) {
        // Calculate distance and direction to target
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Compute offset position (to the side of target)
        this._scratchTangent.set(-this._scratchDirectionToTarget.y, this._scratchDirectionToTarget.x);
        this._scratchOffsetPosition.set(this.target.position).addInPlace(
            this._scratchTangent.multiplyInPlace(this.orbitRadius)
        );

        // Compute desired velocity toward offset position
        this._scratchDesiredVelocity.set(this._scratchOffsetPosition).subtractInPlace(this.ship.position)
            .normalizeInPlace().multiplyInPlace(this.ship.maxVelocity);

        // Apply thrust with hysteresis
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this._scratchDirectionToTarget,
            1.0,
            this._scratchVelocityError
        );

        // Transition to Orbiting if close enough
        if (distance <= this.orbitRadius * 1.2) {
            this.state = "Orbiting";
        }
    }

    /**
     * Handles the Orbiting state, maintaining orbit and firing at the target.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateOrbiting(deltaTime, gameManager) {
        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        const targetVelocity = this.target.velocity || Vector2D.Zero;

        // Compute lead position and angles
        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.projectileSpeed,
            targetVelocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );

        // Compute desired orbital velocity
        this.computeOrbitalVelocity(targetVelocity, distance, this._scratchLeadDirection);

        // Apply thrust logic
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this.ship.fixedWeapons.length !== 0.0 ? this._scratchLeadDirection : null,
            1.0,
            this._scratchVelocityError
        );

        // Handle firing
        this.handleFiring(distance, angleToLead);
    }

    /**
     * Computes the desired velocity for orbiting the target.
     * @param {Vector2D} targetVelocity - The target's velocity.
     * @param {number} distance - Distance to the target.
     * @param {Vector2D} leadDirection - Normalized lead direction vector.
     */
    computeOrbitalVelocity(targetVelocity, distance, leadDirection) {
        const maxSpeedDelta = clamp(this.ship.maxVelocity * 0.5, 50.0, 250.0);
        const orbitSpeed = maxSpeedDelta;

        // Determine orbit direction using cross product
        const crossProduct = leadDirection.x * this.ship.velocity.y - leadDirection.y * this.ship.velocity.x;
        if (crossProduct >= 0.0) {
            this._scratchTangent.set(-leadDirection.y, leadDirection.x); // Counterclockwise
        } else {
            this._scratchTangent.set(leadDirection.y, -leadDirection.x); // Clockwise
        }
        const radialSpeed = remapClamp(distance, this.minRadius, this.maxRadius, -1.0, 1.0) * this.ship.maxVelocity * 0.2;

        this._scratchDesiredVelocity.set(this._scratchTangent).multiplyInPlace(orbitSpeed).addInPlace(
            this._scratchTemp.set(leadDirection).multiplyInPlace(radialSpeed)
        ).addInPlace(targetVelocity);
    }

    /**
     * Stops the autopilot, disabling ship thrust.
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        if (this.ship.debug) {
            console.log("OrbitAttackAutopilot: Stopped");
        }
    }
}

/**
 * Performs high-speed attack runs, firing when close, retreating, and turning for the next run.
 * @extends Autopilot
 */
export class FlybyAttackAutopilot extends Autopilot {
    /**
     * Creates a new FlybyAttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target to attack.
     */
    constructor(ship, target) {
        super(ship, target);
        /** @type {Ship} The Ship to target. */
        this.target = target;
        /** @type {number} Speed for flyby passes. */
        this.passSpeed = this.ship.maxVelocity * 0.5;
        /** @type {number} Minimum distance to avoid collision. */
        this.minRange = 100.0;
        /** @type {number} Maximum distance to loop back for another pass. */
        this.maxRange = this.firingRange * 1.1;
        /** @type {number} The length of tiem we have been turning. */
        this.turningTime = 0.0;
        /** @type {number} Speed of projectiles for lead aiming. */
        this.projectileSpeed = 1000.0;
        /** @type {string} Current state: "Approaching", "Firing", "Retreating", or "Turning". */
        this.state = "Approaching";
        /** @type {number} Last recorded distance to detect chasing. */
        this.lastDistance = Infinity;
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for desired velocity. */
        this._scratchDesiredVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for velocity error. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead offset. */
        this._scratchLeadOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lateral offset. */
        this._scratchLateralOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead position. */
        this._scratchLeadPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead direction. */
        this._scratchLeadDirection = new Vector2D(0.0, 0.0);
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {
            Approaching: this.updateApproaching.bind(this),
            Firing: this.updateFiring.bind(this),
            Retreating: this.updateRetreating.bind(this),
            Turning: this.updateTurning.bind(this)
        };

        if (new.target === FlybyAttackAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, initializing the Approaching state.
     */
    start() {
        if (!isValidAttackTarget(this.ship, this.target)) return;
        this.active = true;
        this.completed = false;
        this.error = null;
        this.state = "Approaching";
        this.lastDistance = Infinity;
        if (this.ship.debug) {
            console.log(`FlybyAttackAutopilot: Started, passSpeed=${this.passSpeed}, maxRange=${this.maxRange}`);
        }
    }

    /**
     * Updates the autopilot, delegating to the base class.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (!this.target || !isValidAttackTarget(this.ship, this.target) || (this.target instanceof Ship && this.target.state !== 'Flying' && this.target.state !== 'Disabled')) {
            this.completed = true;
            this.stop();
            return;
        }
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the Approaching state, moving the ship toward the target.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateApproaching(deltaTime, gameManager) {
        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.projectileSpeed,
            this.target.velocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );

        // Compute desired velocity toward lead position
        this._scratchDesiredVelocity.set(this._scratchLeadDirection)
            .multiplyInPlace(this.passSpeed);

        // Apply thrust
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this._scratchLeadDirection,
            1.0,
            this._scratchVelocityError
        );

        // Transition to Firing
        if (distance <= this.firingRange) {
            this.state = "Firing";
            if (this.ship.debug) {
                console.log("FlybyAttackAutopilot: Transitioned to Firing");
            }
        }
    }

    /**
     * Handles the Firing state, firing at the target during a close pass.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFiring(deltaTime, gameManager) {
        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        const targetVelocity = this.target.velocity || Vector2D.Zero;

        // Compute lead position and angles
        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.projectileSpeed,
            targetVelocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );

        // Compute desired velocity toward lead position
        this._scratchDesiredVelocity.set(this._scratchLeadDirection)
            .multiplyInPlace(this.passSpeed);

        this.ship.applyThrust(true);
        this.ship.setTargetAngle(angleToLead + this.ship.angle);
        // Handle firing
        this.handleFiring(distance, angleToLead);

        // Transition to Retreating
        if (Math.abs(angleToLead) > Math.PI / 3.0 && distance < this.minRange) {
            this.state = "Retreating";
            this.lastDistance = distance;
            if (this.ship.debug) {
                console.log("FlybyAttackAutopilot: Transitioned to Retreating");
            }
        }
    }

    /**
     * Handles the Retreating state, moving away from the target.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateRetreating(deltaTime, gameManager) {
        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        // Always be thrusting
        this.ship.applyThrust(true);
        // Aim away from the target
        this.ship.setTargetAngle(this._scratchDirectionToTarget.getAngle() + Math.PI);

        // Check for chasing target
        const isChasing = distance <= this.lastDistance;
        this.lastDistance = distance;

        // Transition to Turning
        if (distance >= this.maxRange * 0.25 && !isChasing) {
            this.turningTime = 0.0;
            this.state = "Turning";
            if (this.ship.debug) {
                console.log(`FlybyAttackAutopilot: Transitioned to Turning${isChasing ? ' (chasing detected)' : ''}`);
            }
        }
    }

    /**
     * Handles the Turning state, turning toward the target for another pass.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateTurning(deltaTime, gameManager) {
        this.turningTime += deltaTime;
        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        const targetVelocity = this.target.velocity || Vector2D.Zero;

        // Compute lead position and angles
        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.projectileSpeed,
            targetVelocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );
        const leadAngle = this._scratchLeadDirection.getAngle();
        const requestedAngle = (1.0 - remapClamp(this.turningTime, 0.0, 3.0, 0.0, 1.0)) * Math.PI + leadAngle;
        this.ship.setTargetAngle(requestedAngle);
        this.ship.applyThrust(true);
        this._scratchDesiredVelocity.setFromPolar(this.ship.maxVelocity, requestedAngle);
        this._scratchVelocityError.set(this._scratchDesiredVelocity).subtractInPlace(this.ship.velocity);

        // Handle firing
        this.handleFiring(distance, angleToLead);

        // Transition to Approaching
        if (this.turningTime > 3.0) {
            this.state = "Approaching";
            if (this.ship.debug) {
                console.log("FlybyAttackAutopilot: Transitioned to Approaching");
            }
        }
    }

    /**
     * Stops the autopilot, disabling ship thrust.
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        if (this.ship.debug) {
            console.log("FlybyAttackAutopilot: Stopped");
        }
    }
}

/**
 * Moves within 100–450 units, matches target velocity, and fires continuously.
 * @extends Autopilot
 */
export class InRangeAttackAutopilot extends Autopilot {
    /**
     * Creates a new InRangeAttackAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} target - The target to attack.
     */
    constructor(ship, target) {
        super(ship, target);
        /** @type {Ship} The Ship to target. */
        this.target = target;
        /** @type {number} Minimum distance to avoid collision. */
        this.minRange = 100.0;
        /** @type {number} Maximum distance to loop back for another pass. */
        this.maxRange = 2.0 * this.ship.maxVelocity;
        /** @type {number} Speed of projectiles for lead aiming. */
        this.projectileSpeed = 1000.0;
        /** @type {Vector2D} Scratch vector for target direction. */
        this._scratchDirectionToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for delta to target. */
        this._scratchDeltaToTarget = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for desired velocity. */
        this._scratchDesiredVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for velocity error. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead position. */
        this._scratchLeadPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead offset. */
        this._scratchLeadOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lateral offset. */
        this._scratchLateralOffset = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for lead direction. */
        this._scratchLeadDirection = new Vector2D(0.0, 0.0);

        if (new.target === InRangeAttackAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating the target.
     */
    start() {
        if (!this.target || !isValidAttackTarget(this.ship, this.target) || this.target.starSystem !== this.ship.starSystem) {
            this.error = "Invalid or unreachable target";
            this.active = false;
            return;
        }
        this.active = true;
        this.completed = false;
        this.error = null;
        if (this.ship.debug) {
            console.log("InRangeAttackAutopilot: Started");
        }
    }

    /**
     * Updates the autopilot, maintaining 100–450 unit range and firing with lead-aiming.
     * @param {number} deltaTime - Time elapsed in seconds.
     */
    update(deltaTime) {
        if (!this.active) return;
        if (!this.target || !isValidAttackTarget(this.ship, this.target) || (this.target instanceof Ship && this.target.state !== 'Flying' && this.target.state !== 'Disabled')) {
            this.completed = true;
            this.stop();
            return;
        }

        // Calculate distance and direction
        const distance = this.ship.position.getDirectionAndDistanceTo(
            this.target.position,
            this._scratchDeltaToTarget,
            this._scratchDirectionToTarget
        );

        const targetVelocity = this.target.velocity || Vector2D.Zero;

        // Compute lead position and angles
        const angleToLead = this.computeLeadPosition(
            this.ship,
            this.target,
            this.projectileSpeed,
            targetVelocity,
            distance,
            this._scratchDirectionToTarget,
            this._scratchLeadPosition,
            this._scratchLeadOffset,
            this._scratchLateralOffset,
            this._scratchLeadDirection,
            this._scratchVelocityError
        );

        // Desired velocity: match target velocity, adjust to maintain range
        this._scratchDesiredVelocity.set(this._scratchDirectionToTarget);
        if (distance < this.minRange) {
            const thrustMultiplier = 1.0 - remapClamp(distance, 0.0, this.minRange, 0.0, 1.0);
            this._scratchDesiredVelocity.multiplyInPlace(-100.0 * thrustMultiplier);
        } else if (distance > this.maxRange) {
            const thrustMultiplier = 1.0 - remapClamp(distance - this.maxRange, 0.0, 1000.0, 0.0, 1.0);
            this._scratchDesiredVelocity.multiplyInPlace(100.0 * thrustMultiplier);
        }
        this._scratchDesiredVelocity.addInPlace(targetVelocity);

        // Apply thrust
        const shouldThrust = this.applyThrustLogic(
            this.ship,
            this._scratchDesiredVelocity,
            this._scratchLeadDirection,
            1.0,
            this._scratchVelocityError
        );

        // Fire if in range
        if (distance <= this.maxRange) {
            this.ship.fireTurrets();
            if (Math.abs(angleToLead) < Math.PI / 25.0) {
                this.ship.fireFixedWeapons();
            }
            if (this.ship.debug) {
                console.log("InRangeAttackAutopilot: Firing at target");
            }
        }
    }

    /**
     * Stops the autopilot, disabling thrust.
     */
    stop() {
        this.active = false;
        this.ship.applyThrust(false);
        if (this.ship.debug) {
            console.log("InRangeAttackAutopilot: Stopped");
        }
    }
}
