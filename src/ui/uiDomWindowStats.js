// /src/ui/uiDomWindowStats.js

import { GameManager } from "/src/core/game.js";
import { clamp } from "/src/core/utils.js";
import { UiDomWindow } from "/src/ui/uiDomWindow.js";

/**
 * Manages an in-game log display with automatic message fading and line limits.
 * Handles adding new log entries, removing old ones, and animating their appearance/disappearance.
 */
export class UiDomWindowStats extends UiDomWindow {
    /**
     * Creates a new UiLog instance.
     * @param {HTMLElement} element - The DOM element to manage.
     * @param {GameManager} gameManager - The game manager where we can find cameraTarget
     */
    constructor(element, gameManager) {
        super(element);
        const hullElement = document.getElementById('main-status-hull');
        const shieldElement = document.getElementById('main-status-shield');
        if (!hullElement || !shieldElement) {
            throw new TypeError('Missing required element!');
        }
        if (!(hullElement instanceof HTMLElement || shieldElement instanceof HTMLElement)) {
            throw new TypeError('Element not a HTMLElement');
        }
        /** @type {HTMLElement} The span for the docked object's name. */
        this.hullElement = hullElement;

        /** @type {HTMLElement} The span for the docked object's name. */
        this.shieldElement = shieldElement;

        this.gameManager = gameManager;
        /** @type {{hull: number, shield: number, rapidRecharge:boolean}} The last displayed values to avoid unnecessary DOM updates. */
        this._lastDisplayed = {
            hull: 0.0,
            shield: 0.0,
            rapidRecharge: false
        }
    }
    /**
      * Updates the main status window
      * @returns {void}
      */
    update() {
        const ship = this.gameManager.cameraTarget;
        const hull = clamp(Math.round(ship.hullRatio * 100.0), 0, 100);
        if (hull !== this._lastDisplayed.hull) {
            this.hullElement.style.setProperty('--percent', hull.toString());
            this._lastDisplayed.hull = hull;
            console.log(`hull: ${hull} : this._lastDisplayed.hull ${this._lastDisplayed.hull}`);
        }

        const shield = clamp(Math.round(ship.shieldRatio * 100.0), 0, 100);
        if (shield !== this._lastDisplayed.shield) {
            this.shieldElement.style.setProperty('--percent', shield.toString());
            this._lastDisplayed.shield = shield;
        }

        const rapidRecharge = ship.shield.rapidRechargeEffectTime > 0;
        if (rapidRecharge !== this._lastDisplayed.rapidRecharge) {
            if (rapidRecharge) {
                this.shieldElement.classList.add('rapid-recharge');
            } else {
                this.shieldElement.classList.remove('rapid-recharge');
            }
            this._lastDisplayed.rapidRecharge = rapidRecharge;
        }
    }

}