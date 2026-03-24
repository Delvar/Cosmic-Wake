// /src/autopilot/landOnPlanetDespawnAutopilot.js
import { Autopilot } from './autopilot.js';
import { Ship } from '/src/ship/ship.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Planet } from '/src/starSystem/celestialBody.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { GameManager } from '/src/core/game.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/landOnPlanetAutopilot.js';

/**
 * @extends Autopilot
 */
export class LandOnPlanetDespawnAutopilot extends Autopilot {
    /**
     * Creates a new LandOnPlanetDespawnAutopilot instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        super(ship);
        /** @type {Planet|null} The closest planet to land on. */
        this.target = ship.starSystem?.getClosestPlanet(ship);
        /** @type {Vector2D} Scratch vector for distance calculations. */
        this._scratchDistanceToTarget = new Vector2D();

        if (new.target === LandOnPlanetDespawnAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, validating the target planet.
     */
    start() {
        super.start();

        if (!(this.target instanceof Planet)) {
            this.error = 'Target is not a Planet';
            this.active = false;
            return;
        }

        if (!this.target) {
            this.error = 'No planet available';
            this.active = false;
            return;
        }

        if (!isValidTarget(this.ship, this.target)) {
            this.error = 'Target not in same system';
            this.active = false;
            return;
        }

        this.ship.target = this.target;
        this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
        this.subAutopilot.start();
    }

    /**
     * Updates the autopilot, managing landing and despawning.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (!this.active) return;
        if (!this.target || this.target.isDespawned()) {
            this.target = this.ship.starSystem?.getClosestPlanet(this.ship);
            if (!this.target) {
                this.error = 'No planet available';
                this.stop();
                return;
            }
            this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
            this.subAutopilot.start();
        }

        if (this.subAutopilot && this.subAutopilot.active) {
            this.subAutopilot.update(deltaTime, gameManager);
            if (this.subAutopilot.isComplete()) {
                if (this.subAutopilot.error) {
                    this.error = this.subAutopilot.error;
                    this.stop();
                    return;
                }
                this.subAutopilot = null;
            }
        } else if (this.ship.state === 'Landed') {
            this.ship.despawn();
            this.completed = true;
            this.stop();
        } else if (this.ship.state !== 'Landing') {
            this.subAutopilot = new LandOnPlanetAutopilot(this.ship, this.target);
            this.subAutopilot.start();
        }
    }
}