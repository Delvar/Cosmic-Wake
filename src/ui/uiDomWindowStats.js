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
        const hullElement = document.getElementById('stats-ui_hull');
        const shieldElement = document.getElementById('stats-ui_shield');
        const cargoElement = document.getElementById('stats-ui_cargo');
        if (!hullElement || !shieldElement || !cargoElement) {
            throw new TypeError('Missing required element!');
        }
        if (!(hullElement instanceof HTMLElement || shieldElement instanceof HTMLElement || cargoElement instanceof HTMLElement)) {
            throw new TypeError('Element not a HTMLElement');
        }
        /** @type {HTMLElement} The span for the docked object's name. */
        this.hullElement = hullElement;

        /** @type {HTMLElement} The span for the docked object's name. */
        this.shieldElement = shieldElement;

        /** @type {HTMLElement} The element for the cargo bar. */
        this.cargoElement = cargoElement;

        /** @type {GameManager} The game manager where we can find cameraTarget */
        this.gameManager = gameManager;

        /** @type {{hull: number, hullPulse:boolean, shield: number, shieldPulse:boolean, cargo: number, cargoPulse:boolean}} The last displayed values to avoid unnecessary DOM updates. */
        this._lastDisplayed = {
            hull: 0.0,
            hullPulse: false,
            shield: 0.0,
            shieldPulse: false,
            cargo: 0.0,
            cargoPulse: false
        };
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
        }

        const hullPulse = ship.protectionTime > 0;
        if (hullPulse !== this._lastDisplayed.hullPulse) {
            if (hullPulse) {
                this.hullElement.classList.add('pulse');
            } else {
                this.hullElement.classList.remove('pulse');
            }
            this._lastDisplayed.hullPulse = hullPulse;
        }

        const shield = clamp(Math.round(ship.shieldRatio * 100.0), 0, 100);
        if (shield !== this._lastDisplayed.shield) {
            this.shieldElement.style.setProperty('--percent', shield.toString());
            this._lastDisplayed.shield = shield;
        }

        const shieldPulse = ship.shield.rapidRechargeEffectTime > 0;
        if (shieldPulse !== this._lastDisplayed.shieldPulse) {
            if (shieldPulse) {
                this.shieldElement.classList.add('pulse');
            } else {
                this.shieldElement.classList.remove('pulse');
            }
            this._lastDisplayed.shieldPulse = shieldPulse;
        }

        const cargo = clamp(Math.round(ship.cargoRatio * 100.0), 0, 100);
        if (cargo !== this._lastDisplayed.cargo) {
            this.cargoElement.style.setProperty('--percent', cargo.toString());
            this._lastDisplayed.cargo = cargo;
        }

        const cargoPulse = ship.isJettisoningCargo;
        if (cargoPulse !== this._lastDisplayed.cargoPulse) {
            if (cargoPulse) {
                this.cargoElement.classList.add('pulse');
            } else {
                this.cargoElement.classList.remove('pulse');
            }
            this._lastDisplayed.cargoPulse = cargoPulse;
        }
    }

}