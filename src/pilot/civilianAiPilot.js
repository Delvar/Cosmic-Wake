// /src/pilot/civilianAiPilot.js

import { AiPilot } from '/src/pilot/aiPilot.js';
import { FleeAutopilot } from '/src/autopilot/fleeAutopilot.js';
import { AvoidAutopilot } from '/src/autopilot/avoidAutopilot.js';
import { FactionRelationship } from '/src/core/faction.js';
import { isValidAttackTarget, Ship } from '/src/ship/ship.js';
import { Job } from '/src/job/job.js';
import { GameManager } from '/src/core/game.js';

/**
 * AI pilot for civilian ships, focusing on avoidance and fleeing.
 * @extends AiPilot
 */
export class CivilianAiPilot extends AiPilot {
    /**
     * Creates a new CivilianAiPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Job} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0.0;

        if (new.target === CivilianAiPilot) Object.seal(this);
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
        // Check shields for immediate flee
        if (this.ship.shield && this.ship.shield.strength <= 0.0) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (target) {
                if (this.ship.debug) {
                    console.log('Job: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }

        // Check reactions
        if (this.ship.age >= this.nextThreatScan) {
            this.nextThreatScan = this.ship.age + this.threatScanInterval;
            // Check for nearby hostile
            if (this.ship.state === 'Flying') {
                for (const hostile of this.ship.hostiles) {
                    if (!isValidAttackTarget(this.ship, hostile, this.attackDisabledShips) || this.ship.getRelationship(hostile) !== FactionRelationship.Hostile) continue;
                    const distanceSq = this._scratchDistance.set(hostile.position)
                        .subtractInPlace(this.ship.position).squareMagnitude();
                    if (distanceSq < 500 * 500.0) {
                        if (this.ship.debug) {
                            console.log('Job: Hostile within 500 units, switching to Avoid');
                        }
                        this.changeState('Avoid', new AvoidAutopilot(this.ship, hostile));
                        return;
                    }
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

        // Check if shields have gone down
        if (this.ship.shield && this.ship.shield.strength <= 0.0) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (target) {
                if (this.ship.debug) {
                    console.log('Avoid: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }

        // Check for timeout fleeing
        if ((!this.autopilot || (this.autopilot instanceof AvoidAutopilot && this.autopilot.timeElapsed >= this.autopilot.timeout)) && !this.isSafe()) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                if (this.ship.debug) {
                    console.log('Avoid: Timeout or complete and not safe, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
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
     * @param {Ship} source - The ship causing damage.
     */
    onDamage(damage, source) {
        super.onDamage(damage, source);
        this.safeTime = 0.0;
        if (this.ship.shield && this.ship.shield.strength <= 0.0) {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, false)) {
                if (this.ship.debug) {
                    console.log('onDamage: Shields down, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, source));
            }
        } else if (this.state !== 'Avoid' && this.state !== 'Flee') {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, false)) {
                if (this.ship.debug) {
                    console.log('onDamage: Hostile detected, switching to Avoid');
                }
                this.changeState('Avoid', new AvoidAutopilot(this.ship, source));
            }
        }
    }
}