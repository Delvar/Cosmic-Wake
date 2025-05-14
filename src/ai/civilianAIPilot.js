// ai/civilianAIPilot.js

import { AIPilot } from '/src/ai/aiPilot.js';
import { AvoidAutoPilot, FleeAutoPilot } from '/src/autopilot/autopilot.js';

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
        /** @type {number} Time (seconds) the ship has been safe from threats. */
        this.safeTime = 0;
    }
    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        super.update(deltaTime, gameManager);
        if (this.isSafe()) {
            this.safeTime += deltaTime;
        } else {
            this.safeTime = 0;
        }
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
                this.changeState('Flee', new FleeAutoPilot(this.ship, this.threat));
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
                    this.changeState('Avoid', new AvoidAutoPilot(this.ship, this.threat));
                    return;
                }
            }
        }

        // Execute active autopilot (set by job)
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
        } else {
            // Run job to set next autopilot
            if (this.ship.state === 'Landed' || this.ship.state === 'Flying') {
                this.job.update(deltaTime, this);
            }
        }
    }

    /**
     * Handles the 'Avoid' state, running AvoidAutoPilot and checking for flee or job transitions.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateAvoid(deltaTime, gameManager) {
        // Ensure correct autopilot
        if (!(this.autopilot instanceof AvoidAutoPilot) && this.ship.state === 'Flying' && this.threat) {
            if (this.ship.debug) {
                console.log('Avoid: Incorrect autopilot, setting AvoidAutoPilot');
                if (this.autopilot) {
                    console.log(`${this.autopilot.constructor.name}`);
                }
            }
            this.setAutoPilot(new AvoidAutoPilot(this.ship, this.threat));
        }

        // Transition to Job if safe
        if (this.safeTime > 5) {
            if (this.ship.debug) {
                console.log('Avoid: Safe, switching to Job');
            }
            this.setAutoPilot(null);
            this.changeState('Job');
            this.threat = null;
            this.job.resume();
            return;
        }

        //Check if the shilds have gone down
        if (this.ship.shield && this.ship.shield.strength <= 0 && this.threat) {
            if (this.ship.debug) {
                console.log('Avoid: Shields down, switching to Flee');
            }
            this.changeState('Flee', new FleeAutoPilot(this.ship, this.threat));
            return;
        }

        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
            }
        }

        // Check for timeout fleeing
        if (!this.autopilot && !this.isSafe()) {
            if (this.ship.debug) {
                console.log('Avoid: Timeout or complete and not safe, switching to Flee');
            }
            this.changeState('Flee', new FleeAutoPilot(this.ship, this.threat));
            return;
        }
    }

    /**
     * Handles the 'Flee' state, running FleeAutoPilot and checking for job transition.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlee(deltaTime, gameManager) {
        // Ensure correct autopilot
        if (!(this.autopilot instanceof FleeAutoPilot) && this.ship.state === 'Flying' && this.threat) {
            if (this.ship.debug) {
                console.log('Flee: Incorrect autopilot, setting FleeAutoPilot');
            }
            this.setAutoPilot(new FleeAutoPilot(this.ship, this.threat));
        }

        // Transition to Job if safe
        if (this.safeTime > 10) {
            if (this.ship.debug) {
                console.log('Flee: Safe, switching to Job');
            }
            this.setAutoPilot(null);
            this.changeState('Job');
            this.threat = null;
            this.job.resume();
            return;
        }

        // Execute autopilot
        if (this.autopilot && !this.autopilot.isComplete()) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                this.setAutoPilot(null);
                this.changeState('Job');
                this.threat = null;
                this.job.resume();
            }
        }
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
            this.changeState('Flee', new FleeAutoPilot(this.ship, this.threat));
        } else if (this.state !== 'Avoid' && this.state !== 'Flee' && this.threat) {
            if (this.ship.debug) {
                console.log('onDamage: Threat detected, switching to Avoid');
            }
            this.changeState('Avoid', new AvoidAutoPilot(this.ship, this.threat));
        }
    }
}