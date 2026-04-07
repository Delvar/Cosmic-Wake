// /src/autopilot/cargoCollectorAutopilot.js

import { Autopilot } from './autopilot.js';
import { FlyToTargetAutopilot } from './flyToTargetAutopilot.js';
import { Ship } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';
import { CargoContainer } from '/src/starSystem/cargoContainer.js';
import { isValidTarget } from '/src/core/gameObject.js';

/**
 * Autopilot that collects cargo containers by flying to the closest available container.
 * Uses FlyToTargetAutopilot as a sub-autopilot for approach and pickup.
 * @extends {Autopilot<CargoContainer>}
 */
export class CargoCollectorAutopilot extends Autopilot {
    /**
     * Creates a new CargoCollectorAutopilot instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        super(ship, null);
        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {
            Searching: this.updateSearching.bind(this),
            Collecting: this.updateCollecting.bind(this)
        };

        if (new.target === CargoCollectorAutopilot) Object.seal(this);
    }

    /**
     * Starts the cargo collection behaviour and enters the searching state.
     * @returns {void}
     */
    start() {
        super.start();
        this.state = 'Searching';
        this.debugLog(() => console.log(`${this.constructor.name}: Starting`));
    }

    /**
     * Handles the Searching state: finds the nearest cargo container and starts the pickup approach.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateSearching(deltaTime, gameManager) {
        if (this.ship.isCargoFull()) {
            this.completed = true;
            this.stop();
            return;
        }
        const manager = this.ship.starSystem.cargoContainerManager;
        const closest = manager.getClosestContainer(this.ship);
        if (!closest) {
            this.completed = true;
            this.stop();
            return;
        }
        this.ship.target = this.target = closest;
        if (!this.ship.isRetrievingCargo) {
            this.ship.startRetrievingCargo();
        }
        this.state = 'Collecting';
        this.subAutopilot = new FlyToTargetAutopilot(this.ship, this.target, this.target.radius, 50); // Close arrival for pickup
        this.subAutopilot.start();
    }

    /**
     * Handles the Collecting state: follows the current pickup target, or returns to searching if the target becomes invalid.
     * @param {number} deltaTime - Time elapsed since the last update, in seconds.
     * @param {GameManager} gameManager - The game manager instance for coordinate and entity context.
     * @returns {void}
     */
    updateCollecting(deltaTime, gameManager) {
        if (this.ship.isCargoFull()) {
            this.completed = true;
            this.stop();
            return;
        }
        // If no sub-autopilot or target invalid/despawned
        if (!this.subAutopilot || this.subAutopilot.completed || !isValidTarget(this.ship, this.target)) {
            this.state = 'Searching';
            if (this.subAutopilot) {
                this.subAutopilot.stop();
            }
        } else {
            // Update sub-autopilot
            this.subAutopilot.update(deltaTime, gameManager);
        }
    }

    /**
     * Stops the cargo collection behaviour, clears the target, and disables cargo retrieval.
     * @returns {void}
     */
    stop() {
        if (this.subAutopilot) {
            this.subAutopilot.stop();
            this.subAutopilot = null;
        }
        this.ship.target = null;
        if (this.ship.isRetrievingCargo) {
            this.ship.stopRetrievingCargo();
        }
        super.stop();
    }
}