// /src/ui/uiDomWindowDocking.js

import { GameManager } from '/src/core/game.js';
import { DockingContext } from '/src/ship/dockingContext.js';
import { UiDomWindow } from '/src/ui/uiDomWindow.js';

/**
 * Enum-like object for button states to ensure type safety and avoid string literals.
 */
const ButtonState = Object.freeze({
    HIDDEN: 'hidden',
    ACTIVE: 'active',
    DISABLED: 'disabled'
});

/**
 * UiDomWindowDocking manages the UI state and interactions for the docking screen.
 * It handles button visibility, labels, and click handlers based on the current DockingContext.
 * This separates UI logic from the GameManager and DockingContext, allowing AI to use DockingContext directly.
 */
export class UiDomWindowDocking extends UiDomWindow {
    /**
     * Creates a new UiDomWindowDocking instance.
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
        super(elements.dockingUI, 250.0, 160.0);
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

        /** @type {{landedObjectName: string|null, takeOffButtonState: string|null, undockButtonState: string|null, repairButtonState: string|null, miningStartButtonState: string|null, miningStopButtonState: string|null, captureButtonState: string|null}} The last displayed values to avoid unnecessary DOM updates. */
        this._lastDisplayed = {
            landedObjectName: null,
            takeOffButtonState: ButtonState.HIDDEN,
            undockButtonState: ButtonState.HIDDEN,
            repairButtonState: ButtonState.HIDDEN,
            miningStartButtonState: ButtonState.HIDDEN,
            miningStopButtonState: ButtonState.HIDDEN,
            captureButtonState: ButtonState.HIDDEN
        };

        // Bind event handlers
        this.takeoffButton.onclick = this.onTakeOff.bind(this);
        this.undockButton.onclick = this.onTakeOff.bind(this);
        this.repairButton.onclick = this.onRepair.bind(this);
        this.startMiningButton.onclick = this.onStartMining.bind(this);
        this.stopMiningButton.onclick = this.onStopMining.bind(this);
        this.captureButton.onclick = this.onCapture.bind(this);

        if (new.target === UiDomWindowDocking) Object.seal(this);
    }

    /**
     * Sets the docking context for this controller.
     * @param {DockingContext|null} dockingContext - The docking context to set.
     * @returns {void}
     */
    setDockingContext(dockingContext) {
        this.dockingContext = dockingContext;
        this._lastDisplayed.landedObjectName = null;
        this._lastDisplayed.takeOffButtonState = null;
        this._lastDisplayed.repairButtonState = null;
        this._lastDisplayed.miningStartButtonState = null;
        this._lastDisplayed.miningStopButtonState = null;
        this._lastDisplayed.captureButtonState = null;
        this._lastDisplayed.undockButtonState = null;
        this.update();
    }

    /**
     * Sets the state of a button element (hidden, active, or disabled) by managing CSS classes.
     * @param {HTMLElement} element - The button element to update.
     * @param {string} state - The desired state: ButtonState.HIDDEN, ButtonState.ACTIVE, or ButtonState.DISABLED.
     * @returns {void}
     */
    _setButtonState(element, state) {
        if (!element) return;
        if (state === ButtonState.HIDDEN) {
            element.classList.add('hidden');
            element.classList.remove('disabled');
        } else if (state === ButtonState.ACTIVE) {
            element.classList.remove('hidden');
            element.classList.remove('disabled');
        } else if (state === ButtonState.DISABLED) {
            element.classList.remove('hidden');
            element.classList.add('disabled');
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
        const captureButtonState = this.dockingContext.hasCaptureAction ? ButtonState.ACTIVE : ButtonState.HIDDEN;
        if (captureButtonState !== this._lastDisplayed.captureButtonState) {
            this._setButtonState(this.captureButton, captureButtonState);
            this._lastDisplayed.captureButtonState = captureButtonState;
        }

        const undockButtonState = this.dockingContext.hasUndockAction ? ButtonState.ACTIVE : ButtonState.HIDDEN;
        if (undockButtonState !== this._lastDisplayed.undockButtonState) {
            this._setButtonState(this.undockButton, undockButtonState);
            this._lastDisplayed.undockButtonState = undockButtonState;
        }

        // Normal planet/asteroid docking - show normal buttons
        const takeOffButtonState = this.dockingContext.hasTakeOffAction ? ButtonState.ACTIVE : ButtonState.HIDDEN;
        if (takeOffButtonState !== this._lastDisplayed.takeOffButtonState) {
            this._setButtonState(this.takeoffButton, takeOffButtonState);
            this._lastDisplayed.takeOffButtonState = takeOffButtonState;
        }

        const isHullFull = this.dockingContext.ship.hullIntegrity >= this.dockingContext.ship.maxHull;
        const repairButtonState = !this.dockingContext.hasRepairAction ? ButtonState.HIDDEN : isHullFull ? ButtonState.DISABLED : ButtonState.ACTIVE;
        if (repairButtonState !== this._lastDisplayed.repairButtonState) {
            this._setButtonState(this.repairButton, repairButtonState);
            this._lastDisplayed.repairButtonState = repairButtonState;
        }

        if (!this.dockingContext.hasMiningAction) {
            const miningStartButtonState = ButtonState.HIDDEN;
            if (this._lastDisplayed.miningStartButtonState !== miningStartButtonState) {
                this._setButtonState(this.startMiningButton, miningStartButtonState);
                this._lastDisplayed.miningStartButtonState = miningStartButtonState;
            }
            const miningStopButtonState = ButtonState.HIDDEN;
            if (this._lastDisplayed.miningStopButtonState !== miningStopButtonState) {
                this._setButtonState(this.stopMiningButton, miningStopButtonState);
                this._lastDisplayed.miningStopButtonState = miningStopButtonState;
            }
        } else {
            const isCargoFull = this.dockingContext.ship.isCargoFull();
            const miningEnabled = this.dockingContext.ship.miningEnabled;
            const miningStartButtonState = miningEnabled ? ButtonState.HIDDEN : isCargoFull ? ButtonState.DISABLED : ButtonState.ACTIVE;
            if (this._lastDisplayed.miningStartButtonState !== miningStartButtonState) {
                this._setButtonState(this.startMiningButton, miningStartButtonState);
                this._lastDisplayed.miningStartButtonState = miningStartButtonState;
            }
            const miningStopButtonState = !miningEnabled ? ButtonState.HIDDEN : ButtonState.ACTIVE;
            if (this._lastDisplayed.miningStopButtonState !== miningStopButtonState) {
                this._setButtonState(this.stopMiningButton, miningStopButtonState);
                this._lastDisplayed.miningStopButtonState = miningStopButtonState;
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