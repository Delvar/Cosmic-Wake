// /src/autopilot/autopilot.js
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { Planet } from '/src/starSystem/celestialBody.js';
import { remapClamp, normalizeAngle, randomBetween } from '/src/core/utils.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { GameManager } from '/src/core/game.js';

/**
 * Base class for autopilot behaviors controlling ship navigation.
 * @template {GameObject} TargetType - The type of the target object, extending GameObject.
 */
export class Autopilot {
    /**
     * Creates a new Autopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {TargetType|null} [target=null] - The target object (e.g., planet, jump gate).
     */
    constructor(ship, target = null) {
        /** @type {Ship} The ship controlled by this autopilot. */
        this.ship = ship;
        /** @type {TargetType|null} The target object (e.g., planet, jump gate). */
        this.target = target;
        /** @type {boolean} Whether the autopilot is active. */
        this.active = false;
        /** @type {boolean} Whether the autopilot has completed its task. */
        this.completed = false;
        /** @type {string|null} Error message if the autopilot fails, null if no error. */
        this.error = null;
        /** @type {Autopilot<TargetType>|null} Optional sub-autopilot for delegated tasks. */
        this.subAutopilot = null;
        /** @type {number} Maximum angle deviation to apply thrust. */
        this.thrustAngleLimit = Math.PI / 16.0;
        /** @type {number} Upper threshold for thrust activation. between 5 and 15 frames*/
        this.upperVelocityErrorThreshold = (this.ship.thrust * randomBetween(5.0, 15.0)) / 60.0;
        /** @type {number} Lower threshold for thrust hysteresis. We use maxThrust for 1 frame*/
        this.lowerVelocityErrorThreshold = this.ship.thrust / 60.0;
        /** @type {number} Maximum distance to fire weapons. */
        this.firingRange = 1000.0;
        /** @type {string} Current state of the autopilot (e.g., "Approaching"). */
        this.state = "";
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {};

        // Initialize scratch vectors for calculations
        /** @type {Vector2D} Temporary scratch vector for calculations. */
        this._scratchTemp = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Final desired velocity after corrections. */
        this._scratchDesiredVelocity = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Difference between desired and current velocity. */
        this._scratchVelocityError = new Vector2D(0.0, 0.0);

        if (new.target === Autopilot) Object.seal(this);
    }

    /**
     * Logs a message to the console if debug mode is enabled.
     * If a callback is passed, it is executed only when debug is true, so the console frame
     * is attributed to the caller location.
     * @param {Function} callback - Callback function
     */
    debugLog(callback) {
        if (this.ship) {
            this.ship.debugLog(callback);
        }
    }

    /**
     * Starts the autopilot, validating preconditions and setting it active.
     */
    start() {
        if (!this.ship) {
            this.error = "No ship assigned";
            this.active = false;
            return;
        }
        this.active = true;
        this.completed = false;
        this.error = null;
    }

    /**
     * Updates the autopilot, executing the current state's handler.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     * @throws {Error} If the current state is invalid.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        const handler = this.stateHandlers[this.state];
        if (!handler) {
            throw new Error(`Invalid autopilot state: ${this.state}`);
        }
        handler(deltaTime, gameManager);
    }

    /**
     * Stops the autopilot, resetting ship controls and deactivating it.
     */
    stop() {
        if (this.subAutopilot) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
        }
        this.active = false;
        this.ship.applyThrust(false);
        this.ship.applyBrakes(false);
    }

    /**
     * Returns the action name by processing the class name, removing 'Autopilot' and adding spaces before capital letters.
     * @returns {string} The action name.
     */
    getActionName() {
        const className = this.constructor.name;
        if (className.endsWith('Autopilot')) {
            const baseName = className.slice(0.0, -9.0); // Remove 'Autopilot'
            // Insert space before each capital letter (except first) and trim
            return baseName.replace(/([A-Z])/g, ' $1').trim();
        }
        return className; // Fallback if no 'Autopilot' suffix
    }

    /**
     * Returns the current status for HUD display.
     * @returns {string} The status string.
     */
    getStatus() {
        if (this.subAutopilot?.active) {
            return `${this.getActionName()}: ${this.subAutopilot.getStatus()}`;
        }

        const targetName = this.target?.name || (this.target instanceof Ship ? 'ship' : this.target instanceof Planet ? 'planet' : this.target instanceof Asteroid ? 'asteroid' : 'target');
        const baseStatus = this.state ? `${this.getActionName()} ${targetName} (${this.state})` : `${this.getActionName()} ${targetName}`;
        return this.error ? `${baseStatus}, Error: ${this.error}` : baseStatus;
    }

    /**
     * Checks if the autopilot has completed its task (success or failure).
     * @returns {boolean} True if completed or errored, false if still running.
     */
    isComplete() {
        return this.completed || !!this.error;
    }

    /**
     * Given a velocity error decide if we we should thrust or not including hysteresis.
     * @param {number} velocityErrorMagnitude Magnitude of the error between teh current velocity and the desired velocity.
     * @param {number} [errorThresholdRatio=1.0] The ratio for the error threshold, lower is more accurate but can cause twitching.
     * @returns {boolean} True if should thrust, false if not.
     */
    shouldThrust(velocityErrorMagnitude, errorThresholdRatio = 1.0) {
        if (this.ship.isThrusting) {
            if (velocityErrorMagnitude <= this.lowerVelocityErrorThreshold) {
                return false;
            }
        } else {
            if (velocityErrorMagnitude > Math.max(this.lowerVelocityErrorThreshold, this.upperVelocityErrorThreshold * errorThresholdRatio)) {
                return true;
            }
        }
        return this.ship.isThrusting;
    }

    /**
     * Validates the target, setting error if invalid.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    validateTarget() {
        if (!isValidTarget(this.ship, this.target)) {
            this.debugLog(() => console.log(`${this.constructor.name}: validateTarget, Invalid or unreachable target`));
            this.error = "Invalid or unreachable target";
            this.active = false;
            return false;
        }
        if (this.target instanceof Ship && this.target.state !== 'Flying') {
            this.debugLog(() => console.log(`${this.constructor.name}: validateTarget, Target not flying`));
            this.error = "Target not flying";
            this.active = false;
            return false;
        }
        return true;
    }

    /**
     * Computes the lead position and direction for aiming at the target.
     * @param {Ship} ship - The ship to control.
     * @param {GameObject} target - The target to aim at.
     * @param {number} projectileSpeed - Speed of projectiles for lead aiming.
     * @param {Vector2D} targetVelocity - The target's velocity.
     * @param {number} distance - Distance to the target.
     * @param {Vector2D} directionToTarget - Normalized direction to the target.
     * @param {Vector2D} outLeadPosition - Output vector for lead position.
     * @param {Vector2D} outLeadOffset - Output vector for lead offset.
     * @param {Vector2D} outLateralOffset - Output vector for lateral offset.
     * @param {Vector2D} outLeadDirection - Output vector for normalized lead direction.
     * @param {Vector2D} outVelocityError - Output vector for velocity error.
     * @returns {number} Angle to lead position (radians).
     */
    computeLeadPosition(
        ship,
        target,
        projectileSpeed,
        targetVelocity,
        distance,
        directionToTarget,
        outLeadPosition,
        outLeadOffset,
        outLateralOffset,
        outLeadDirection,
        outVelocityError
    ) {
        outVelocityError.set(targetVelocity).subtractInPlace(ship.velocity);
        const timeToImpact = Math.min(distance / projectileSpeed, 3.0); // Maximum 3 second lead
        outLeadPosition.set(outVelocityError).multiplyInPlace(timeToImpact).addInPlace(target.position);
        outLeadOffset.set(outLeadPosition).subtractInPlace(target.position);
        const longitudinalComponent = outLeadOffset.dot(directionToTarget);
        outLateralOffset.set(outLeadOffset).subtractInPlace(
            this._scratchTemp.set(directionToTarget).multiplyInPlace(longitudinalComponent)
        );
        outLeadPosition.set(target.position).addInPlace(outLateralOffset);
        outLeadDirection.set(outLeadPosition).subtractInPlace(ship.position).normalizeInPlace();
        const leadAngle = outLeadDirection.getAngle();
        return normalizeAngle(leadAngle - ship.angle);
    }

    /**
    * Applies thrust based on velocity error and angle alignment.
    * @param {Ship} ship - The ship to control.
    * @param {Vector2D} desiredVelocity - Desired velocity vector.
    * @param {number|Vector2D|null} [failoverAngle=null] - Angle to face when not thrusting, or null.
    * @param {number} [errorThresholdRatio=1.0] The ratio for the error threshold, lower is more accurate but can cause twitching.
    * @param {Vector2D} [outVelocityError] - Output vector for velocity error.
    * @returns {boolean} True if thrusting, false otherwise.
    */
    applyThrustLogic(ship, desiredVelocity, failoverAngle = null, errorThresholdRatio = 1.0, outVelocityError) {
        if (!outVelocityError) {
            return false;
        }
        outVelocityError.set(desiredVelocity).subtractInPlace(ship.velocity);
        const velocityErrorMagnitude = outVelocityError.magnitude();

        //Cheat to avoid twitching
        if (velocityErrorMagnitude <= this.lowerVelocityErrorThreshold) {
            ship.velocity.set(desiredVelocity); // Snap to desired velocity
            outVelocityError.set(0.0, 0.0);
            ship.applyThrust(false);
            if (failoverAngle === null) {
                ship.setTargetAngle(desiredVelocity.getAngle());
            } else {
                ship.setTargetAngle(failoverAngle instanceof Vector2D ? failoverAngle.getAngle() : failoverAngle);
            }
            return false;
        }
        const desiredAngle = outVelocityError.getAngle();
        const angleToDesired = normalizeAngle(desiredAngle - ship.angle);
        const shouldThrust = this.shouldThrust(velocityErrorMagnitude, errorThresholdRatio);

        if (shouldThrust || failoverAngle === null) {
            ship.setTargetAngle(desiredAngle);
        } else {
            ship.setTargetAngle(failoverAngle instanceof Vector2D ? failoverAngle.getAngle() : failoverAngle);
        }

        if (shouldThrust && Math.abs(angleToDesired) < this.thrustAngleLimit) {
            ship.applyThrust(true);
        } else {
            ship.applyThrust(false);
        }

        return shouldThrust;
    }

    /**
     * Handles firing weapons if within range and aligned with the target.
     * @param {number} distance - Distance to the target.
     * @param {number} angleToLead - Angle to the lead position (radians).
     */
    handleFiring(distance, angleToLead) {
        if (!this.target) {
            return;
        }
        if (distance <= this.firingRange) {
            this.ship.fireTurrets();
            if (Math.abs(angleToLead) < this.target.radius / distance) {
                this.ship.fireFixedWeapons();
            }
        }
    }
}







/**
//OLD Auto Pilots
// /**
//  * @ extends Autopilot
//  */
// export class EscortAutopilot extends Autopilot {
//     /**
//      * Creates a new EscortAutopilot instance.
//      * @param {Ship} ship - The ship to control with this autopilot.
//      * @param {Ship} escortedShip - The target ship to escort.
//      * @param {number} [followDistance=250] - The desired distance to maintain while following the escorted ship.
//      */
//     constructor(ship, escortedShip, followDistance = 250.0) {
//         super(ship, escortedShip);
//         /** @type {number} The distance to maintain while following the escorted ship. */
//         this.followDistance = followDistance;
//         /** @type {string} The current state of the autopilot (e.g., 'Idle', 'Following'). */
//         this.state = 'Idle';
//         /** @type {number} Time (seconds) remaining to wait in the 'Waiting' state. */
//         this.waitTime =  0.0;
//         /** @type {Vector2D} Pre-allocated vector for direction calculations to avoid allocations. */
//         this._scratchDirectionToTarget = new Vector2D(0.0,  0.0);
//         /** @type {Vector2D} Pre-allocated vector for distance (unused but retained for consistency). */
//         this._scratchDistanceToTarget = new Vector2D(0.0,  0.0);
//         /** @type {number} Minimum wait time (seconds) after landing before taking off. */
//         this.waitTimeMin =  2.0;
//         /** @type {number} Maximum wait time (seconds) after landing before taking off. */
//         this.waitTimeMax =  5.0;
//         /** @type {Object.<string, Function>} Map of state names to their respective handler methods. */
//         this.stateHandlers = {
//             Idle: this.updateIdle.bind(this),
//             Following: this.updateFollowing.bind(this),
//             TakingOff: this.updateTakingOff.bind(this),
//             Landing: this.updateLanding.bind(this),
//             TraversingJumpGate: this.updateTraversingJumpGate.bind(this),
//             Waiting: this.updateWaiting.bind(this)
//         };
//     }

//     /**
//      * Starts the autopilot, validating that the target is a ship in the same star system.
//      * @override
//      */
//     start() {
//         super.start();
//         if (!(this.target instanceof Ship)) {
//             this.error = 'Target is not a ship';
//             this.active = false;
//             return;
//         }
//         if (this.target.starSystem !== this.ship.starSystem) {
//             this.error = 'Target ship not in same system';
//             this.active = false;
//             return;
//         }
//     }

//     /**
//      * Updates the autopilot's behavior based on its current state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      */
//     update(deltaTime) {
//         if (!this.active) return;

//         // Check if the escorted ship still exists
//         if (!this.target || this.target.isDespawned()) {
//             this.stop();
//             this.error = 'Escorted ship despawned';
//             console.warn('Escorted ship despawned');
//             return;
//         }

//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime);
//         } else {
//             console.warn(`No handler for state: ${this.state}`);
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'Idle' state: initiates following or takeoff based on the escorted ship's state.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateIdle(deltaTime) {
//         if (this.ship.state === 'Landed') {
//             // Take off if the escorted ship is moving
//             if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
//                 this.ship.initiateTakeoff();
//                 this.state = 'TakingOff';
//             }
//         } else if (this.ship.state === 'Flying') {
//             // Begin following the escorted ship
//             this.subAutopilot = new FollowShipAutopilot(this.ship, this.target, this.followDistance,  100.0);
//             this.subAutopilot.start();
//             this.state = 'Following';
//         } else if (this.ship.state === 'TakingOff' || this.ship.state === 'Landing') {
//             // Wait for transitional states to complete
//         } else {
//             console.warn(`Invalid ship state '${this.ship.state}' in EscortAutopilot updateIdle`);
//         }
//     }

//     /**
//      * Handles the 'Following' state: follows the escorted ship and reacts to its actions (landing, jumping).
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateFollowing(deltaTime) {
//         if (!this.subAutopilot) {
//             console.warn('Sub-autopilot not set during Following state');
//             this.state = 'Idle';
//             return;
//         }

//         // Handle the escorted ship jumping out
//         if (this.target.state === 'JumpingOut') {
//             this.subAutopilot.stop();
//             const jumpGate = this.target.jumpGate;
//             if (jumpGate && jumpGate instanceof JumpGate && !jumpGate.isDespawned()) {
//                 this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
//                 this.subAutopilot.start();
//                 this.state = 'TraversingJumpGate';
//             } else {
//                 console.warn('Jump gate invalid or not found; entering wait mode');
//                 this.subAutopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'Waiting';
//             }
//             return;
//         }

//         // Handle the escorted ship landing
//         if (this.target.state === 'Landed' || this.target.state === 'Landing') {
//             this.subAutopilot.stop();
//             this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target.landedObject);
//             this.subAutopilot.start();
//             this.state = 'Landing';
//             return;
//         }

//         // Handle the escorted ship moving to another star system
//         if (this.target.starSystem !== this.ship.starSystem) {
//             this.subAutopilot.stop();
//             const targetSystem = this.target.starSystem;
//             const jumpGate = this.ship.starSystem.getJumpGateToSystem(targetSystem);
//             if (jumpGate) {
//                 this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, jumpGate);
//                 this.subAutopilot.start();
//                 this.state = 'TraversingJumpGate';
//             } else {
//                 console.warn('No jump gate found to target system; entering wait mode');
//                 this.subAutopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'Waiting';
//             }
//             return;
//         }

//         // Continue following the escorted ship
//         this.subAutopilot.update(deltaTime);
//         if (!this.subAutopilot.active) {
//             console.warn('Sub-autopilot inactive during Following state; resetting');
//             this.subAutopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'TakingOff' state: waits for the ship to complete takeoff.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateTakingOff(deltaTime) {
//         if (this.ship.state === 'Flying') {
//             this.state = 'Idle'; // Transition to determine the next action
//         }
//     }

//     /**
//      * Handles the 'Landing' state: lands on the same body as the escorted ship, aborting if it takes off.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateLanding(deltaTime) {
//         if (!this.subAutopilot) {
//             console.warn('Sub-autopilot not set during Landing state');
//             this.state = 'Idle';
//             return;
//         }

//         // Abort landing if the escorted ship takes off
//         if (this.target.state === 'TakingOff' || this.target.state === 'Flying') {
//             this.subAutopilot.stop();
//             this.subAutopilot = null;
//             this.state = 'Idle';
//             return;
//         }

//         // Process landing
//         this.subAutopilot.update(deltaTime);
//         if (this.subAutopilot.isComplete()) {
//             if (this.subAutopilot.error) {
//                 console.warn(`Landing failed: ${this.subAutopilot.error}`);
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Landed') {
//                 this.subAutopilot = null;
//                 this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
//                 this.state = 'Waiting';
//             } else {
//                 console.warn('Landing completed but ship not landed; resetting');
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.subAutopilot.active) {
//             console.warn('Sub-autopilot inactive but not complete during Landing state');
//             this.subAutopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'TraversingJumpGate' state: jumps to the escorted ship's star system.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateTraversingJumpGate(deltaTime) {
//         if (!this.subAutopilot) {
//             console.warn('Sub-autopilot not set during TraversingJumpGate state');
//             this.state = 'Idle';
//             return;
//         }

//         // Process the jump
//         this.subAutopilot.update(deltaTime);
//         if (this.subAutopilot.isComplete()) {
//             if (this.subAutopilot.error) {
//                 console.warn(`Jump failed: ${this.subAutopilot.error}`);
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             } else if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.starSystem) {
//                 this.subAutopilot = null;
//                 this.state = 'Idle'; // Transition to resume following
//             } else {
//                 console.warn('Jump completed but not in target system; resetting');
//                 this.subAutopilot = null;
//                 this.state = 'Idle';
//             }
//         } else if (!this.subAutopilot.active) {
//             console.warn('Sub-autopilot inactive but not complete during TraversingJumpGate state');
//             this.subAutopilot = null;
//             this.state = 'Idle';
//         }
//     }

//     /**
//      * Handles the 'Waiting' state: pauses after landing before resuming escort duties.
//      * @param {number} deltaTime - Time elapsed since the last update in seconds.
//      * @private
//      */
//     updateWaiting(deltaTime) {
//         this.waitTime -= deltaTime;
//         if (this.waitTime <= 0.0) {
//             this.state = 'Idle'; // Check the escorted ship's state next update
//         }
//     }

//     /**
//      * Returns the current status of the autopilot for display (e.g., on a HUD).
//      * @returns {string} A descriptive status string based on the current state.
//      */
//     getStatus() {
//         if (this.state === 'Following' && this.subAutopilot?.active) {
//             return `Escorting ${this.target.name || 'ship'}`;
//         }
//         if (this.state === 'Landing' && this.subAutopilot?.active) {
//             return `Landing on ${this.target.landedOn?.name || 'body'}`;
//         }
//         if (this.state === 'TraversingJumpGate' && this.subAutopilot?.active) {
//             return `Jumping to ${this.target.starSystem?.name || 'system'}`;
//         }
//         if (this.state === 'Waiting') {
//             return 'Waiting';
//         }
//         return `Escorting (${this.state})`;
//     }
// }



