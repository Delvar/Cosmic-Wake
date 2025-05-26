// /src/pilot/aiPilot.js

import { Pilot } from '/src/pilot/pilot.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { AvoidAutopilot, FleeAutopilot, LandOnPlanetDespawnAutopilot } from '/src/autopilot/autopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { remapClamp } from '/src/core/utils.js';

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
        /** @type {Autopilot|null} The active autopilot controlling ship navigation (e.g., FlyToTargetAutopilot). */
        this.autopilot = null;
        /** @type {Ship|null} The current threat triggering reactions (e.g., player ship). */
        this.threat = null;
        /** @type {string} The current state ('Job', 'Flee', 'Avoid', 'Attack'). */
        this.state = 'Job';
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Job': this.updateJob.bind(this),
            'Flee': this.updateFlee.bind(this),
            'Avoid': this.updateAvoid.bind(this),
            'Attack': this.updateAttack.bind(this),
            'Despawning': this.updateDespawning.bind(this)
        };
        /** @type {number} Time (seconds) the ship has been safe from threats. */
        this.safeTime = 0;
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchDistance = new Vector2D();
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

        // Run state handler
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        }

        if (this.isSafe()) {
            this.safeTime += deltaTime;
        } else {
            this.safeTime = 0;
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
            this.changeState('Despawning', new LandOnPlanetDespawnAutopilot(this.ship));
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
                if (this.ship.debug) {
                    console.log(`${this.autopilot.constructor.name} is compelte, nulling`);
                }
                this.setAutopilot(null);
            }
        }
    }

    /**
     * Handles the 'Avoid' state, managing avoidance behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        // Ensure correct autopilot
        if (!(this.autopilot instanceof AvoidAutopilot) && this.ship.state === 'Flying') {
            if (this.ship.debug) {
                console.log('Avoid: Incorrect autopilot, setting AvoidAutopilot');
            }
            if (this.threat) {
                this.ship.target = this.threat;
                this.changeState('Avoid', new AvoidAutopilot(this.ship, this.threat));
            } else {
                if (this.ship.debug) {
                    console.log('Avoid: No threat, switching to Job');
                }
                this.changeState('Job');
            }
        }

        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
        }

        // Transition to Job if safe
        if (this.safeTime > 5) {
            if (this.ship.debug) {
                console.log('Avoid: Safe, switching to Job');
            }
            this.changeState('Job');
        }
    }

    /**
     * Handles the 'Flee' state, managing flee behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        // Ensure correct autopilot
        if (!(this.autopilot instanceof FleeAutopilot) && this.ship.state === 'Flying' && this.threat) {
            if (this.ship.debug) {
                console.log('Flee: Incorrect autopilot, setting FleeAutopilot');
            }
            this.setAutopilot(new FleeAutopilot(this.ship, this.threat));
        }

        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.changeState('Job');
            }
        }

        // Transition to Job if safe
        if (this.safeTime > 10) {
            this.changeState('Job');
        }
    }

    /**
     * Handles the 'Attack' state, managing attack behavior and reactions.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAttack(deltaTime, gameManager) {
        if (!this.threat || !isValidAttackTarget(this.ship, this.threat)) {
            this.changeState('Job');
            return;
        }
        if (!(this.autopilot instanceof AttackAutopilot) && this.ship.state === 'Flying') {
            this.setAutopilot(new AttackAutopilot(this.ship, this.threat));
            if (this.ship.debug) {
                console.log("AIPilot: Set AttackAutopilot");
            }
        }
        if (this.autopilot) {
            if (!this.autopilot.active) {
                if (this.ship.debug && this.autopilot.error) {
                    console.log(`AIPilot: AttackAutopilot error ${this.autopilot.error}`);
                }
                if (this.ship.debug && this.autopilot.isComplete()) {
                    console.log(`AIPilot: AttackAutopilot completed`);
                }
                this.changeState('Job');
            } else {
                this.autopilot.update(deltaTime);
            }
        }
    }

    /**
     * Handles the 'Despawning' state, landing on the closest planet and despawning.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateDespawning(deltaTime, gameManager) {
        if (!(this.autopilot instanceof LandOnPlanetDespawnAutopilot)) {
            this.setAutopilot(new LandOnPlanetDespawnAutopilot(this.ship));
        }
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutopilot(null);
            }
        }
        if (this.autopilot?.error) {
            if (this.ship.debug) {
                console.warn(`Despawn failed: ${this.autopilot.error}`);
            }
            this.ship.despawn();
            this.setAutopilot(null);
        }
    }

    /**
     * Sets a new autopilot, stopping and cleaning up the current one.
     * @param {Autopilot|null} newAutopilot - The new autopilot to set, or null to clear.
     */
    setAutopilot(newAutopilot) {
        if (this.ship.debug) {
            console.log(`setAutopilot ${this.ship.name}: ${this.autopilot?.constructor?.name} >> ${newAutopilot?.constructor?.name}`);
            // if (this.autopilot instanceof AttackAutopilot && newAutopilot === null) {
            //     throw new Error('Attack Stop!');
            // }
            // if (newAutopilot instanceof AttackAutopilot && this.autopilot === null) {
            //     throw new Error('Attack Start!');
            // }
        }
        if (this.autopilot) {
            this.autopilot.stop();
            this.autopilot = null;
        }
        this.autopilot = newAutopilot;
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
     * @param {Autopilot} [newAutopilot=null] - The new autopilot, if any.
     */
    changeState(newState, newAutopilot = null) {
        if (this.state === newState) return;
        // Pause job only when leaving Job state
        if (this.state === 'Job') {
            this.job.pause();
        }
        // Resume the job when entering Job state
        if (newState === 'Job') {
            this.job.resume();
        }
        // Set new state and autopilot
        this.state = newState;
        this.setAutopilot(newAutopilot);
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

/**
 * AI pilot for civilian ships with reaction logic.
 * @extends AIPilot
 */
export class CivilianAIPilot extends AIPilot {
    /**
     * Creates a new CivilianAIPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Object} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0;
    }

    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the 'Job' state, running the job and checking for threats to trigger reactions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateJob(deltaTime, gameManager) {
        // Check reactions
        if (this.ship.age >= this.nextThreatScan) {
            this.nextThreatScan = this.ship.age + this.threatScanInterval;

            // Check shields for immediate flee
            if (this.ship.shield && this.ship.shield.strength <= 0 && this.threat) {
                if (this.ship.debug) {
                    console.log('Job: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
                return;
            }

            // Check for nearby threat
            if (this.threat && this.ship.state === 'Flying') {
                const distanceSq = this._scratchDistance.set(this.threat.position)
                    .subtractInPlace(this.ship.position).squareMagnitude();
                if (distanceSq < 500 * 500) {
                    if (this.ship.debug) {
                        console.log('Job: Threat within 500 units, switching to Avoid');
                    }
                    this.changeState('Avoid', new AvoidAutopilot(this.ship, this.threat));
                    return;
                }
            }
        }

        super.updateJob(deltaTime, gameManager);
    }

    /**
     * Handles the 'Avoid' state, running AvoidAutopilot and checking for flee or job transitions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        super.updateAvoid(deltaTime, gameManager);

        //Check if the shilds have gone down
        if (this.ship.shield && this.ship.shield.strength <= 0 && this.threat) {
            if (this.ship.debug) {
                console.log('Avoid: Shields down, switching to Flee');
            }
            this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
            return;
        }

        // Check for timeout fleeing
        if ((!this.autopilot || this.autopilot.timeElapsed >= this.autopilot.timeout) && !this.isSafe()) {
            if (this.ship.debug) {
                console.log('Avoid: Timeout or complete and not safe, switching to Flee');
            }
            this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
            return;
        }
    }

    /**
     * Handles the 'Flee' state, running FleeAutopilot and checking for job transition.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        super.updateFlee(deltaTime, gameManager);
    }

    /**
     * Handles damage, updating state based on shields.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - The ship causing the damage.
     */
    onDamage(damage, source) {
        super.onDamage(damage, source);
        this.safeTime = 0;
        if (this.ship.shield && this.ship.shield.strength <= 0 && this.threat) {
            if (this.ship.debug) {
                console.log('onDamage: Shields down, switching to Flee');
            }
            this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
        } else if (this.state !== 'Avoid' && this.state !== 'Flee' && this.threat) {
            if (this.ship.debug) {
                console.log('onDamage: Threat detected, switching to Avoid');
            }
            this.ship.target = this.threat;
            this.changeState('Avoid', new AvoidAutopilot(this.ship, this.threat));
        }
    }
}

/**
 * AI pilot for pirate ships with reaction logic.
 * @extends AIPilot
 */
export class PirateAIPilot extends AIPilot {
    /**
     * Creates a new CivilianAIPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Object} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0;
    }

    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        super.update(deltaTime, gameManager);
    }

    /**
     * Handles the 'Job' state, running the job and checking for threats to trigger reactions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateJob(deltaTime, gameManager) {
        // Check reactions
        if (this.ship.age >= this.nextThreatScan) {
            this.nextThreatScan = this.ship.age + this.threatScanInterval;

            // Check shields for immediate flee
            if (this.ship.shield && this.ship.shield.strength <= 0 && this.threat) {
                if (this.ship.debug) {
                    console.log('Job: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
                return;
            }

            // Check for nearby threat
            if (this.threat && this.ship.state === 'Flying') {
                const distanceSq = this._scratchDistance.set(this.threat.position)
                    .subtractInPlace(this.ship.position).squareMagnitude();
                if (distanceSq < 500 * 500) {
                    if (this.ship.debug) {
                        console.log('Job: Threat within 500 units, switching to Avoid');
                    }
                    this.ship.target = this.threat;
                    this.changeState('Avoid', new AttackAutopilot(this.ship, this.threat));
                    return;
                }
            }
        }
        super.updateJob(deltaTime, gameManager);
    }

    /**
     * Handles the 'Avoid' state, running AvoidAutopilot and checking for flee or job transitions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        super.updateAvoid(deltaTime, gameManager);

        const hullRatio = remapClamp(this.ship.hullIntegrity, 0, this.ship.maxHull, 0, 1);

        //Check if the shilds have gone down and 50% hull
        if (((this.ship.shield && this.ship.shield.strength <= 0) || !this.ship.shield) && hullRatio < 0.5 && this.threat) {
            if (this.ship.debug) {
                console.log('Avoid: Shields down, switching to Flee');
            }
            this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
            return;
        }

        // Check for timeout fleeing
        if ((!this.autopilot || this.autopilot.timeElapsed >= this.autopilot.timeout) && !this.isSafe()) {
            if (this.ship.debug) {
                console.log('Avoid: Timeout or complete and not safe, switching to Flee');
            }
            this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
            return;
        }
    }

    /**
     * Handles the 'Flee' state, running FleeAutopilot and checking for job transition.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        super.updateFlee(deltaTime, gameManager);
    }

    /**
     * Handles damage, updating state based on shields.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - The ship causing the damage.
     */
    onDamage(damage, source) {
        super.onDamage(damage, source);
        this.safeTime = 0;
        const hullRatio = remapClamp(this.ship.hullIntegrity, 0, this.ship.maxHull, 0, 1);

        //Check if the shilds have gone down and 50% hull
        if (((this.ship.shield && this.ship.shield.strength <= 0) || !this.ship.shield) && hullRatio < 0.5 && this.threat) {
            if (this.ship.debug) {
                console.log('onDamage: Shields down, switching to Flee');
            }
            this.changeState('Flee', new FleeAutopilot(this.ship, this.threat));
        } else if (this.state !== 'Avoid' && this.state !== 'Flee' && this.state !== 'Attack' && this.threat) {
            if (this.ship.debug) {
                console.log('onDamage: Threat detected, switching to Attack');
            }
            this.ship.target = this.threat;
            this.changeState('Attack', new AttackAutopilot(this.ship, this.threat));
        }
    }
}