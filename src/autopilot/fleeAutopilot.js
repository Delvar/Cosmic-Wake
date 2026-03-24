// /src/autopilot/fleeAutopilot.js

import { Autopilot } from '/src/autopilot/autopilot.js';
import { Ship } from '/src/ship/ship.js';
import { JumpGate, Planet } from '/src/starSystem/celestialBody.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { Vector2D } from '/src/core/vector2d.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/landOnPlanetAutopilot.js';
import { TraverseJumpGateAutopilot } from '/src/autopilot/traverseJumpGateAutopilot.js';
import { remapClamp } from '/src/core/utils.js';

/**
 * @extends Autopilot
 */
export class FleeAutopilot extends Autopilot {
    /**
     * Creates a new FleeAutopilot instance.
     * @param {Ship} ship - The ship to control.
     * @param {Ship} threat - The threat to flee from.
     */
    constructor(ship, threat) {
        super(ship);
        /** @type {Ship} The ship posing a threat to flee from. */
        this.threat = threat;
        /** @type {JumpGate|Planet|null} The target to flee to (jump gate or planet). */
        this.target = ship.starSystem.getClosestJumpGatePlanet(ship);
        /** @type {Vector2D} Temporary vector for calculations. */
        this._scratchVector = new Vector2D();

        if (new.target === FleeAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating the target.
     */
    start() {
        super.start();

        if (!(this.threat instanceof Ship)) {
            this.error = 'Threat is not a ship';
            this.active = false;
            return;
        }

        if (!this.threat) {
            this.error = 'No threat';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.threat)) {
            this.error = 'Threat not in same system';
            this.active = false;
            return;
        }

        this.ship.target = this.threat;
    }

    /**
     * Updates the autopilot, fleeing to the target and managing sub-autopilots.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.target || this.ship.state !== 'Flying') {
            this.completed = true;
            this.stop();
            return;
        }

        if ((!this.ship.shield || !this.ship.shield.isActive) && (this.ship.cargoUsed) > 0 && (remapClamp(this.ship.hullIntegrity, 0.0, this.ship.maxHull, 0.0, 1.0) < 0.75)) {
            this.ship.startJettison();
        } else if (this.ship.isJettisoningCargo) {
            this.ship.stopJettison();
        }

        if (!isValidTarget(this.ship, this.target)) {
            console.log('FleeAutopilot: target not valid!');
            this.target = this.ship.starSystem.getClosestPlanet(this.ship);
            if (this.subAutopilot) {
                this.subAutopilot.stop();
                this.subAutopilot = null;
            }
        }

        if (!this.subAutopilot) {
            // Navigate to target
            if (this.target instanceof JumpGate) {
                this.subAutopilot = new TraverseJumpGateAutopilot(this.ship, this.target);
            } else {
                this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
            }
            this.subAutopilot.start();
        } else {
            this.subAutopilot.update(deltaTime, gameManager);
            return;
        }
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
        const threatName = this.threat?.name || (this.target instanceof Ship ? 'ship' : 'threat');
        const baseStatus = this.state ? `${this.getActionName()} from ${threatName} to ${targetName} (${this.state})` : `${this.getActionName()} from ${threatName} to ${targetName}`;
        return this.error ? `${baseStatus}, Error: ${this.error}` : baseStatus;
    }
}