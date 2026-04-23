// /src/core/game.js

// import { UiDomWindowDocking } from '../ui/uiDomWindowDocking.js';
import { UiDomWindowTarget } from '../ui/uiDomWindowTarget.js';

/**
 * Handles the game loop, rendering, and updates for the game.
 * @param {GameManager} manager - The game manager providing game state.
 */
export class Game {
    /**
     * Creates a new Game instance.
     * @param {GameManager} manager - The game manager providing game state.
     */
    constructor(manager) {
        /** @type {GameManager} The game manager providing access to game state. */
        this.manager = manager;
        if (new.target === Game) Object.seal(this);
    }
}

/**
 * Manages the overall game state, including initialization, event handling, and updates.
 */
export class GameManager {
    /**
     * Creates a new GameManager instance.
     */
    constructor() {
        // /** @type {boolean} Whether the docking UI is currently shown. */
        // this.dockingUIShown = false;

        // /** @type {UiDomWindowDocking} The controller for docking UI interactions. */
        // this.uiDomWindowDocking = new UiDomWindowDocking(this, {
        //     dockingUI: /** @type {HTMLElement} */ (document.getElementById('docking-ui')),
        //     dockingName: /** @type {HTMLElement} */ (document.getElementById('docking-ui-name')),
        //     takeoffButton: /** @type {HTMLButtonElement} */ (document.getElementById('docking-ui-takeoff')),
        //     undockButton: /** @type {HTMLButtonElement} */ (document.getElementById('docking-ui-undock')),
        //     repairButton: /** @type {HTMLButtonElement} */ (document.getElementById('docking-ui-repair')),
        //     startMiningButton: /** @type {HTMLButtonElement} */ (document.getElementById('docking-ui-start-mining')),
        //     stopMiningButton: /** @type {HTMLButtonElement} */ (document.getElementById('docking-ui-stop-mining')),
        //     captureButton: /** @type {HTMLButtonElement} */ (document.getElementById('docking-ui-capture')),
        // });

        /** @type {UiDomWindowTarget} Initialize UiDomWindowTarget for handling target window resizing */
        this.uiDomWindowTarget = new UiDomWindowTarget(document.getElementById('target-ui'), null, null, null);

        /** @type {UiDomWindowTarget} Initialize UiDomWindowTarget for handling target window resizing */
        this.uiDomWindowTarget2 = new UiDomWindowTarget(document.getElementById('target-ui2'), null, null, null);

        /** @type {UiDomWindowTarget} Initialize UiDomWindowTarget for handling target window resizing */
        this.uiDomWindowTarget3 = new UiDomWindowTarget(document.getElementById('target-ui3'), null, null, null);

        /** @type {UiDomWindowTarget} Initialize UiDomWindowTarget for handling target window resizing */
        this.uiDomWindowTarget4 = new UiDomWindowTarget(document.getElementById('target-ui4'), null, null, null);

        /** @type {UiDomWindowTarget} Initialize UiDomWindowTarget for handling target window resizing */
        this.uiDomWindowTarget5 = new UiDomWindowTarget(document.getElementById('target-ui5'), null, null, null);

        /** @type {Game} The game instance managing rendering and updates. */
        this.game = new Game(this);

        if (new.target === GameManager) Object.seal(this);
    }

}

// Initialize the game manager and expose it to the window object
// @ts-ignore
window.gameManager = new GameManager();