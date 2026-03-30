// /src/autopilot/cargoCollectorAutopilot.js
import { Autopilot } from './autopilot.js';
import { FlyToTargetAutopilot } from './flyToTargetAutopilot.js';
import { Ship } from '/src/ship/ship.js';
import { GameManager } from '/src/core/game.js';
import { CargoContainer } from '/src/starSystem/cargoContainer.js';
import { isValidTarget } from '/src/core/gameObject.js';

/**
 * Autopilot that collects cargo containers by flying to the closest one.
 * Uses FlyToTargetAutopilot as sub-autopilot for navigation.
 * @extends Autopilot
 */
export class CargoCollectorAutopilot extends Autopilot {
    /**
     * Creates a new CargoCollectorAutopilot instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        super(ship, null);
        /** @type {FlyToTargetAutopilot|null} Sub-autopilot for flying to target container. */
        this.subAutopilot = null;

        /** @type {CargoContainer|null} target container. */
        this.target = null;

        /** @type {Object.<string, Function>} State handlers for update logic. */
        this.stateHandlers = {
            Searching: this.updateSearching.bind(this),
            Collecting: this.updateCollecting.bind(this)
        };

        if (new.target === CargoCollectorAutopilot) Object.seal(this);
    }

    /**
     * Starts the autopilot, enabling cargo retrieval.
     */
    start() {
        super.start();
        this.state = 'Searching';
        this.debugLog(`${this.constructor.name}: Starting`);
    }

    /**
     * Updates the autopilot in the 'Searching' state.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
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
     * Updates the autopilot in the 'Collecting' state.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
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
            if (!this.subAutopilot) {
                this.subAutopilot.stop();
            }
        } else {
            // Update sub-autopilot
            this.subAutopilot.update(deltaTime, gameManager);
        }
    }

    /**
     * Stops the autopilot, disabling cargo retrieval and stopping sub-autopilot.
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