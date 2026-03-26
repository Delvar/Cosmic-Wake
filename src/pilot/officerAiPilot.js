// /src/pilot/officerAiPilot.js

import { AiPilot } from '/src/pilot/aiPilot.js';
import { Autopilot } from '/src/autopilot/autopilot.js';
import { FleeAutopilot } from '/src/autopilot/fleeAutopilot.js';
import { AvoidAutopilot } from '/src/autopilot/avoidAutopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { FactionRelationship } from '/src/core/faction.js';
import { isValidAttackTarget, Ship } from '/src/ship/ship.js';
import { Job } from '/src/job/job.js';
import { GameManager } from '/src/core/game.js';
import { remapClamp } from '/src/core/utils.js';

/**
 * AI pilot for officer ships, focusing on attacking and fleeing.
 * @extends AiPilot
 */
export class OfficerAiPilot extends AiPilot {
    /**
     * Creates a new OfficerAiPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Job} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0.0;

        if (new.target === OfficerAiPilot) Object.seal(this);
    }

    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        // Check shields/hull for immediate flee
        if (this.ship.state === 'Flying' && ((this.ship.shield && this.ship.shield.strength <= 0.0) || !this.ship.shield) && remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.5) {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                if (this.ship.debug) {
                    console.log('Shields down or low hull, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }

        // Update target if in Attack state
        if (this.state === 'Attack') {
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, this.attackDisabledShips));
            if (target && this.ship.target !== target) {
                this.ship.target = target;
                if (this.autopilot instanceof AttackAutopilot) {
                    this.autopilot.target = target;
                    this.autopilot.start();
                }
            }
        }

        // Set light mode
        if (this.state === 'Job' && this.job.state === 'Boarding') {
            this.ship.lightMode = 'Rescue';
        } else if (this.state === 'Attack') {
            this.ship.lightMode = 'Warden';
        } else {
            this.ship.lightMode = 'Normal';
        }


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
            // Check for nearby hostile
            if (this.ship.state === 'Flying') {
                for (const hostile of this.ship.hostiles) {
                    if (!isValidAttackTarget(this.ship, hostile, this.attackDisabledShips) || this.ship.getRelationship(hostile) !== FactionRelationship.Hostile) continue;
                    const distanceSq = this._scratchDistance.set(hostile.position)
                        .subtractInPlace(this.ship.position).squareMagnitude();
                    if (distanceSq < 500 * 500.0) {
                        if (this.ship.debug) {
                            console.log('Job: Hostile within 500 units, switching to Attack');
                        }
                        this.ship.target = hostile;
                        this.changeState('Attack', new AttackAutopilot(this.ship, hostile, true));
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
     * Handles damage, updating state based on shields and hull.
     * @param {number} damage - Amount of damage received.
     * @param {Ship} source - The ship causing the damage.
     */
    onDamage(damage, source) {
        super.onDamage(damage, source);
        this.safeTime = 0.0;

        // Check if shields are down and hull <50%
        if (this.ship.state === 'Flying' && ((this.ship.shield && this.ship.shield.strength <= 0.0) || !this.ship.shield) && remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.5) {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, false)) {
                if (this.ship.debug) {
                    console.log('onDamage: Shields down and low hull, switching to Flee');
                }
                this.changeState('Flee', new FleeAutopilot(this.ship, source));
            }
        } else if (this.state !== 'Avoid' && this.state !== 'Flee' && this.state !== 'Attack') {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, this.attackDisabledShips)) {
                if (this.ship.debug) {
                    console.log('onDamage: Hostile detected, switching to Attack');
                }
                this.changeState('Attack', new AttackAutopilot(this.ship, source, true));
            }
        }
    }

    /**
     * Changes state and autopilot, handling cleanup.
     * @param {string} newState - The new state ('Job', 'Flee', 'Avoid', 'Attack').
     * @param {Autopilot} [newAutopilot=null] - The new autopilot, if any.
     */
    changeState(newState, newAutopilot = null) {
        super.changeState(newState, newAutopilot);
        // Light mode handled in update
    }
}