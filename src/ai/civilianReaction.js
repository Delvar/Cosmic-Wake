// ai/civilianReaction.js

import { Vector2D } from '/src/core/vector2d.js';
import { AvoidAutoPilot, FleeAutoPilot } from '/src/autopilot/autopilot.js';

/**
 * Reaction for civilian ships to avoid or flee threats.
 */
export class CivilianReaction {
    /**
     * Creates a new CivilianReaction instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        this.ship = ship;
        this.threatScanInterval = 0.5; // Scan every 0.5s
        this.nextThreatScan = 0;
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchDistance = new Vector2D();
    }

    /**
     * Updates the reaction, checking for threats.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {AIPilot} pilot - The controlling AI pilot.
     */
    update(deltaTime, pilot) {
        if (this.ship.age < this.nextThreatScan) return;
        this.nextThreatScan = this.ship.age + this.threatScanInterval;

        // Check shields for immediate flee
        if (this.ship.shield && this.ship.shield.shield <= 0 && pilot.threat) {
            this.startFleeAutoPilot(pilot);
            return;
        }

        // Check for nearby threat
        if (pilot.threat && this.ship.state === 'Flying') {
            const distanceSq = this._scratchDistance.set(pilot.threat.position)
                .subtractInPlace(this.ship.position).squareMagnitude();
            if (distanceSq < 500 * 500) {
                this.startAvoidAutoPilot(pilot);
            }
        }

        // Check for timeout fleeing
        if (pilot.autopilot instanceof AvoidAutoPilot && pilot.autopilot.isComplete() && !this.isComplete(pilot)) {
            this.startFleeAutoPilot(pilot);
        }
    }

    /**
     * Notified when the ship takes damage.
     * @param {Ship} source - Ship causing damage.
     * @param {AIPilot} pilot - The controlling AI pilot.
     */
    onDamage(source, pilot) {
        if (this.ship.shield && this.ship.shield.shield <= 0) {
            this.startFleeAutoPilot(pilot);
        } else {
            this.startAvoidAutoPilot(pilot);
        }
    }

    /**
     * Starts the avoid autopilot to move away from the threat.
     * @param {AIPilot} pilot - The controlling AI pilot.
     */
    startAvoidAutoPilot(pilot) {
        if (this.ship.state !== 'Flying' || !pilot.threat) return;
        pilot.job.pause();
        pilot.setAutoPilot(new AvoidAutoPilot(this.ship, pilot.threat), true);
    }

    /**
     * Starts the flee autopilot to nearest planet or jump gate.
     * @param {AIPilot} pilot - The controlling AI pilot.
     */
    startFleeAutoPilot(pilot) {
        if (this.ship.state !== 'Flying' || !pilot.threat) return;
        pilot.job.pause();
        pilot.setAutoPilot(new FleeAutoPilot(this.ship, pilot.threat), true);
    }

    /**
     * Checks if the reaction is complete.
     * @param {AIPilot} pilot - The controlling AI pilot.
     * @returns {boolean} True if safe.
     */
    isComplete(pilot) {
        if (this.ship.state === 'Landed') return true;
        if (!pilot.threat) return true;
        if (this.ship.starSystem !== pilot.threat.starSystem) return true;
        const distanceSq = this._scratchDistance.set(pilot.threat.position)
            .subtractInPlace(this.ship.position).squareMagnitude();
        return distanceSq > 1000 * 1000; // Safe if threat > 1000 units
    }
}