// /src/pilot/pirateAiPilot.js

import { AiPilot } from './aiPilot.js';
import { Ship, isValidAttackTarget } from '/src/ship/ship.js';
import { FleeAutopilot } from '/src/autopilot/fleeAutopilot.js';
import { AvoidAutopilot } from '/src/autopilot/avoidAutopilot.js';
import { AttackAutopilot } from '/src/autopilot/attackAutopilot.js';
import { remapClamp } from '/src/core/utils.js';
import { FactionRelationship } from '/src/core/faction.js';
import { GameManager } from '/src/core/game.js';
import { Job } from '/src/job/job.js';
import { CargoCollectorAutopilot } from '/src/autopilot/cargoCollectorAutopilot.js';

/**
 * AI pilot for pirate ships, focusing on attacking and fleeing.
 * @extends AiPilot
 */
export class PirateAiPilot extends AiPilot {
    /**
     * Creates a new PirateAiPilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Job} job - The job instance (e.g., WandererJob).
     */
    constructor(ship, job) {
        super(ship, job);
        /** @type {number} Interval (seconds) between threat scans in Job state. */
        this.threatScanInterval = 0.5;
        /** @type {number} Ship age (seconds) when the next threat scan is due. */
        this.nextThreatScan = 0.0;

        if (new.target === PirateAiPilot) Object.seal(this);
    }

    /**
     * Updates the AI pilot's behavior, tracking safe time and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        // Check shields/hull for immediate flee
        if (this.ship.state === 'Flying' && this.state != 'Flee' && ((this.ship.shield && this.ship.shield.strength <= 0.0) || !this.ship.shield) && remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.75) {
            //FIXME: array.find
            const target = this.ship.hostiles.find(s => this.ship.getRelationship(s) === FactionRelationship.Hostile && isValidAttackTarget(this.ship, s, false));
            if (target) {
                this.debugLog(() => console.log(`${this.constructor.name}: Shields down or low hull, switching to Flee`));
                this.changeState('Flee', new FleeAutopilot(this.ship, target));
                return;
            }
        }
        // If we spot cargo, break off to collect it
        if (this.ship.state === 'Flying' && this.state != 'Collecting' && !this.ship.isCargoFull()) {
            if (this.ship.starSystem.cargoContainerManager.hasCargoContainer()) {
                this.debugLog(() => console.log(`${this.constructor.name}: Spotted cargo, switching to Collecting`));
                this.changeState('Collecting', new CargoCollectorAutopilot(this.ship));
                return;
            }
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
                        this.debugLog(() => console.log(`${this.constructor.name}: Job: Hostile within 500 units, switching to Attack`));
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
                this.debugLog(() => console.log(`${this.constructor.name}: Avoid: Timeout or complete and not safe, switching to Flee`));
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
                this.debugLog(() => console.log(`${this.constructor.name}: onDamage: Shields down and low hull, switching to Flee`));
                this.changeState('Flee', new FleeAutopilot(this.ship, source));
            }
        } else if (this.state !== 'Avoid' && this.state !== 'Flee' && this.state !== 'Attack' && this.state != 'Collecting' && this.state != 'Despawning') {
            if (this.ship.hostiles.includes(source) && isValidAttackTarget(this.ship, source, this.attackDisabledShips)) {
                //FIXME: we want to ignore the odd attack but need a way to detect a constant attacker, so if say we are collecting, we can abandon that and attack the main attacker.
                this.debugLog(() => console.log(`${this.constructor.name}: onDamage: Hostile detected, switching to Attack`));
                this.changeState('Attack', new AttackAutopilot(this.ship, source, true));
            }
        }
    }
}