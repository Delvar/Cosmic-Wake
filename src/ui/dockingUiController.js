// /src/ui/dockingUiController.js

import { GameManager } from '/src/core/game.js';
import { DockingContext } from '/src/ship/dockingContext.js';

/**
 * DockingUiController manages the UI state and interactions for the docking screen.
 * It handles button visibility, labels, and click handlers based on the current DockingContext.
 * This separates UI logic from the GameManager and DockingContext, allowing AI to use DockingContext directly.
 */
export class DockingUiController {
    /**
     * Creates a new DockingUiController instance.
     *
     * @param {GameManager} manager - The game manager instance.
     * @param {Object} elements - DOM elements for the docking UI.
     * @param {HTMLElement} elements.dockingUI - The main docking UI div.
     * @param {HTMLElement} elements.dockingName - The span for the docked object's name.
     * @param {HTMLButtonElement} elements.dockingButton - The take off button.
     * @param {HTMLButtonElement} elements.dockingRepairButton - The repair hull button.
     * @param {HTMLButtonElement} elements.dockingStartMiningButton - The start mining button.
     * @param {HTMLButtonElement} elements.dockingStopMiningButton - The stop mining button.
     */
    constructor(manager, elements) {
        /** @type {GameManager} The game manager instance. */
        this.manager = manager;

        /** @type {HTMLElement} The main docking UI div. */
        this.dockingUI = elements.dockingUI;
        /** @type {HTMLElement} The span for the docked object's name. */
        this.dockingName = elements.dockingName;
        /** @type {HTMLButtonElement} The take off button. */
        this.dockingButton = elements.dockingButton;
        /** @type {HTMLButtonElement} The repair hull button. */
        this.dockingRepairButton = elements.dockingRepairButton;
        /** @type {HTMLButtonElement} The start mining button. */
        this.dockingStartMiningButton = elements.dockingStartMiningButton;
        /** @type {HTMLButtonElement} The stop mining button. */
        this.dockingStopMiningButton = elements.dockingStopMiningButton;

        /** @type {DockingContext|null} The current docking context. */
        this.dockingContext = null;

        /** @type {{landedObjectName: string|null, takeOffVisible: boolean|null, repairVisible: boolean|null, miningStartVisible: boolean|null, miningStopVisible: boolean|null}} The last displayed values to avoid unnecessary DOM updates. */
        this._lastDisplayed = {
            landedObjectName: null,
            takeOffVisible: null,
            repairVisible: null,
            miningStartVisible: null,
            miningStopVisible: null
        };

        // Bind event handlers
        this.dockingButton.onclick = this.onTakeOff.bind(this);
        this.dockingRepairButton.onclick = this.onRepair.bind(this);
        this.dockingStartMiningButton.onclick = this.onStartMining.bind(this);
        this.dockingStopMiningButton.onclick = this.onStopMining.bind(this);

        if (new.target === DockingUiController) Object.seal(this);
    }

    /**
     * Sets the docking context for this controller.
     * @param {DockingContext|null} dockingContext - The docking context to set.
     */
    setDockingContext(dockingContext) {
        this.dockingContext = dockingContext;
        this._lastDisplayed.landedObjectName = null;
        this._lastDisplayed.takeOffVisible = null;
        this._lastDisplayed.repairVisible = null;
        this._lastDisplayed.miningStartVisible = null;
        this._lastDisplayed.miningStopVisible = null;
        this.update();
    }

    /**
     * Updates the UI based on the current docking context.
     * Shows or hides buttons and sets labels accordingly.
     */
    /**
     * Hides or shows a UI element by adding/removing the hidden class.
     * @param {HTMLElement} element - The element to hide/show.
     * @param {boolean} hidden - True to hide, false to show.
     */
    _setHidden(element, hidden) {
        if (!element) return;
        if (hidden) {
            element.classList.add('hidden');
        } else {
            element.classList.remove('hidden');
        }
    }

    update() {
        if (!this.dockingContext) {
            this.hide();
            return;
        }

        // Diff against last displayed values to avoid unnecessary DOM updates
        const landedObjectName = this.dockingContext.landedObject.name;
        if (landedObjectName !== this._lastDisplayed.landedObjectName) {
            this.dockingName.textContent = landedObjectName;
            this._lastDisplayed.landedObjectName = landedObjectName;
        }

        const takeOffVisible = this.dockingContext.hasTakeOffCapability;
        if (takeOffVisible !== this._lastDisplayed.takeOffVisible) {
            this._setHidden(this.dockingButton, !takeOffVisible);
            this._lastDisplayed.takeOffVisible = takeOffVisible;
        }

        const repairVisible = this.dockingContext.hasRepairCapability;
        if (repairVisible !== this._lastDisplayed.repairVisible) {
            this._setHidden(this.dockingRepairButton, !repairVisible);
            this._lastDisplayed.repairVisible = repairVisible;
        }

        const hasMining = this.dockingContext.hasMiningCapability;
        const miningEnabled = this.dockingContext.ship.miningEnabled;
        const miningStartVisible = hasMining && !miningEnabled;
        const miningStopVisible = hasMining && miningEnabled;

        if (miningStartVisible !== this._lastDisplayed.miningStartVisible) {
            this._setHidden(this.dockingStartMiningButton, !miningStartVisible);
            this._lastDisplayed.miningStartVisible = miningStartVisible;
        }

        if (miningStopVisible !== this._lastDisplayed.miningStopVisible) {
            this._setHidden(this.dockingStopMiningButton, !miningStopVisible);
            this._lastDisplayed.miningStopVisible = miningStopVisible;
        }
    }

    /**
     * Shows the docking UI.
     */
    show() {
        this.dockingUI.classList.remove('hidden');
    }

    /**
     * Hides the docking UI.
     */
    hide() {
        this.dockingUI.classList.add('hidden');
    }

    /**
     * Handles the take off button click.
     */
    onTakeOff() {
        if (this.dockingContext) {
            this.dockingContext.takeOff();
        }
    }

    /**
     * Handles the repair hull button click.
     */
    onRepair() {
        if (this.dockingContext) {
            this.dockingContext.repairHull();
            // Update UI after repair to hide the button
            this.update();
        }
    }

    /**
     * Handles the start mining button click.
     */
    onStartMining() {
        if (this.dockingContext) {
            if (!this.dockingContext.ship.miningEnabled) {
                this.dockingContext.startMining();
            }
            // Update UI to toggle buttons
            this.update();
        }
    }

    /**
     * Handles the stop mining button click.
     */
    onStopMining() {
        if (this.dockingContext) {
            if (this.dockingContext.ship.miningEnabled) {
                this.dockingContext.stopMining();
            }
            // Update UI to toggle buttons
            this.update();
        }
    }
    /**
     * Disposes of this controller, clearing references.
     */
    dispose() {
        this.dockingContext = null;
        // Clear event handlers
        this.dockingButton.onclick = null;
        this.dockingRepairButton.onclick = null;
        this.dockingStartMiningButton.onclick = null;
        this.dockingStopMiningButton.onclick = null;
    }
}