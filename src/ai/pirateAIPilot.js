// ai/pirateAIPilot.js

import { AIPilot } from '/src/ai/aiPilot.js';
import { AvoidAutopilot, FleeAutopilot } from '/src/autopilot/autopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { remapClamp } from '/src/core/utils.js';
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