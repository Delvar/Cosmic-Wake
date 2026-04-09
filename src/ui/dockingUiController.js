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
     * @param {HTMLButtonElement} elements.takeoffButton - The takeoff button.
     * @param {HTMLButtonElement} elements.undockButton - The undock button.
     * @param {HTMLButtonElement} elements.repairButton - The repair hull button.
     * @param {HTMLButtonElement} elements.startMiningButton - The start mining button.
     * @param {HTMLButtonElement} elements.stopMiningButton - The stop mining button.
     * @param {HTMLButtonElement} elements.captureButton - The capture button.
     */
    constructor(manager, elements) {
        /** @type {GameManager} The game manager instance. */
        this.manager = manager;

        /** @type {HTMLElement} The main docking UI div. */
        this.dockingUI = elements.dockingUI;
        /** @type {HTMLElement} The span for the docked object's name. */
        this.dockingName = elements.dockingName;
        /** @type {HTMLButtonElement} The takeoff button. */
        this.takeoffButton = elements.takeoffButton;
        /** @type {HTMLButtonElement} The undock button. */
        this.undockButton = elements.undockButton;
        /** @type {HTMLButtonElement} The repair hull button. */
        this.repairButton = elements.repairButton;
        /** @type {HTMLButtonElement} The start mining button. */
        this.startMiningButton = elements.startMiningButton;
        /** @type {HTMLButtonElement} The stop mining button. */
        this.stopMiningButton = elements.stopMiningButton;
        /** @type {HTMLButtonElement} The capture button. */
        this.captureButton = elements.captureButton;

        /** @type {DockingContext|null} The current docking context. */
        this.dockingContext = null;

        /** @type {{landedObjectName: string|null, takeOffVisible: boolean|null, repairVisible: boolean|null, miningStartVisible: boolean|null, miningStopVisible: boolean|null, captureVisible: boolean|null, undockVisible: boolean|null}} The last displayed values to avoid unnecessary DOM updates. */
        this._lastDisplayed = {
            landedObjectName: null,
            takeOffVisible: null,
            undockVisible: null,
            repairVisible: null,
            miningStartVisible: null,
            miningStopVisible: null,
            captureVisible: null
        };

        // Bind event handlers
        this.takeoffButton.onclick = this.onTakeOff.bind(this);
        this.undockButton.onclick = this.onTakeOff.bind(this);
        this.repairButton.onclick = this.onRepair.bind(this);
        this.startMiningButton.onclick = this.onStartMining.bind(this);
        this.stopMiningButton.onclick = this.onStopMining.bind(this);
        this.captureButton.onclick = this.onCapture.bind(this);

        if (new.target === DockingUiController) Object.seal(this);
    }

    /**
     * Sets the docking context for this controller.
     * @param {DockingContext|null} dockingContext - The docking context to set.
     * @returns {void}
     */
    setDockingContext(dockingContext) {
        this.dockingContext = dockingContext;
        this._lastDisplayed.landedObjectName = null;
        this._lastDisplayed.takeOffVisible = null;
        this._lastDisplayed.repairVisible = null;
        this._lastDisplayed.miningStartVisible = null;
        this._lastDisplayed.miningStopVisible = null;
        this._lastDisplayed.captureVisible = null;
        this._lastDisplayed.undockVisible = null;
        this.update();
    }

    /**
     * Hides or shows a UI element by adding/removing the hidden class.
     * @param {HTMLElement} element - The element to hide/show.
     * @param {boolean} hidden - True to hide, false to show.
     * @returns {void}
     */
    _setHidden(element, hidden) {
        if (!element) return;
        if (hidden) {
            element.classList.add('hidden');
        } else {
            element.classList.remove('hidden');
        }
    }

    /**
     * Updates the docking UI based on the current docking context, showing/hiding buttons and updating labels as needed.
     * @returns {void}
     */
    update() {
        if (!this.dockingContext) {
            this.hide();
            return;
        }

        // Diff against last displayed values to avoid unnecessary DOM updates
        let landedObjectName = this.dockingContext.landedObject.name;

        if (landedObjectName !== this._lastDisplayed.landedObjectName) {
            this.dockingName.textContent = landedObjectName;
            this._lastDisplayed.landedObjectName = landedObjectName;
        }

        // Boarding disabled ship - show capture and undock buttons
        const captureVisible = this.dockingContext.hasCaptureAction;
        if (captureVisible !== this._lastDisplayed.captureVisible) {
            this._setHidden(this.captureButton, !captureVisible);
            this._lastDisplayed.captureVisible = captureVisible;
        }

        const undockVisible = this.dockingContext.hasUndockAction;
        if (undockVisible !== this._lastDisplayed.undockVisible) {
            this._setHidden(this.undockButton, !undockVisible);
            this._lastDisplayed.undockVisible = undockVisible;
        }

        // Normal planet/asteroid docking - show normal buttons
        const takeOffVisible = this.dockingContext.hasTakeOffAction;
        if (takeOffVisible !== this._lastDisplayed.takeOffVisible) {
            this._setHidden(this.takeoffButton, !takeOffVisible);
            this._lastDisplayed.takeOffVisible = takeOffVisible;
        }

        const repairVisible = this.dockingContext.hasRepairAction;
        if (repairVisible !== this._lastDisplayed.repairVisible) {
            this._setHidden(this.repairButton, !repairVisible);
            this._lastDisplayed.repairVisible = repairVisible;
        }

        if (!this.dockingContext.hasMiningAction) {
            if (this._lastDisplayed.miningStartVisible !== false) {
                this._setHidden(this.startMiningButton, true);
                this._lastDisplayed.miningStartVisible = false;
            }
            if (this._lastDisplayed.miningStopVisible !== false) {
                this._setHidden(this.stopMiningButton, true);
                this._lastDisplayed.miningStopVisible = false;
            }
        } else {
            const miningEnabled = this.dockingContext.ship.miningEnabled;
            if (this._lastDisplayed.miningStartVisible !== !miningEnabled) {
                this._setHidden(this.startMiningButton, miningEnabled);
                this._lastDisplayed.miningStartVisible = !miningEnabled;
            }
            if (this._lastDisplayed.miningStopVisible !== miningEnabled) {
                this._setHidden(this.stopMiningButton, !miningEnabled);
                this._lastDisplayed.miningStopVisible = miningEnabled;
            }
        }
    }

    /**
     * Displays the docking UI to the user.
     * @returns {void}
     */
    show() {
        this.dockingUI.classList.remove('hidden');
    }

    /**
     * Hides the docking UI from the user.
     * @returns {void}
     */
    hide() {
        this.dockingUI.classList.add('hidden');
    }

    /**
     * Handles the takeoff button click by initiating takeoff from the docked object.
     * @returns {void}
     */
    onTakeOff() {
        if (this.dockingContext) {
            this.dockingContext.takeOff();
        }
    }

    /**
     * Handles the repair hull button click by repairing the ship's hull using the docking context and updating the UI.
     * @returns {void}
     */
    onRepair() {
        if (this.dockingContext) {
            this.dockingContext.repairHull();
            // Update UI after repair to hide the button
            this.update();
        }
    }

    /**
     * Handles the start mining button click by enabling mining on the docked object if not already enabled and updating the UI.
     * @returns {void}
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
     * Handles the stop mining button click by disabling mining on the docked object if enabled and updating the UI.
     * @returns {void}
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
     * Handles the capture button click by capturing the docked object using the docking context and updating the UI.
     * @returns {void}
     */
    onCapture() {
        if (this.dockingContext) {
            this.dockingContext.capture();
            // Update UI to toggle buttons
            this.update();
        }
    }

    /**
     * Disposes of this controller by clearing the docking context reference and removing event handlers from the UI elements.
     * @returns {void}
     */
    dispose() {
        this.dockingContext = null;
        // Clear event handlers
        this.takeoffButton.onclick = null;
        this.undockButton.onclick = null;
        this.repairButton.onclick = null;
        this.startMiningButton.onclick = null;
        this.stopMiningButton.onclick = null;
        this.captureButton.onclick = null;
    }
}