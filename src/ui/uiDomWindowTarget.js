// /src/ui/uiDomWindowTarget.js

import { TargetCamera } from '/src/camera/camera.js';
import { HeadsUpDisplay } from '/src/camera/headsUpDisplay.js';
import { StarField } from '/src/camera/starField.js';
import { FactionRelationship } from '/src/core/faction.js';
import { GameManager } from '/src/core/game.js';
import { clamp } from '/src/core/utils.js';
import { Ship } from '/src/ship/ship.js';
import { UiDomWindow } from '/src/ui/uiDomWindow.js';

/**
 * Class for managing the target window, extending UiDomWindow.
 * Handles resizing of the target camera view.
 */
export class UiDomWindowTarget extends UiDomWindow {
    /**
     * Creates a new UiDomWindowTarget instance.
     * @param {HTMLElement} element - The DOM element to manage.
     * @param {TargetCamera} targetCamera - The target camera to resize.
     * @param {HeadsUpDisplay} targetHud - The HUD for the target view.
     * @param {StarField} starField - The starfield for the target view.
     * @param {GameManager} gameManager - The game manager where we can find cameraTarget
     */
    constructor(element, targetCamera, targetHud, starField, gameManager) {
        super(element);
        /** @type {TargetCamera} The camera for the target view. */
        this.targetCamera = targetCamera;
        /** @type {HeadsUpDisplay} The HUD for displaying game information. */
        this.targetHud = targetHud;
        /** @type {StarField} The starfield for rendering background stars. */
        this.starField = starField;

        const nameElement = document.getElementById('target-ui_name');
        const factionElement = document.getElementById('target-ui_faction');
        const hullElement = document.getElementById('target-ui_hull');
        const shieldElement = document.getElementById('target-ui_shield');

        if (!(nameElement instanceof HTMLElement)) {
            throw new TypeError('nameElement not a HTMLElement');
        }
        if (!(factionElement instanceof HTMLElement)) {
            throw new TypeError('factionElement not a HTMLElement');
        }
        if (!(hullElement instanceof HTMLElement)) {
            throw new TypeError('hullElement not a HTMLElement');
        }
        if (!(shieldElement instanceof HTMLElement)) {
            throw new TypeError('shieldElement not a HTMLElement');
        }

        /** @type {HTMLElement} The element for the targets name. */
        this.nameElement = nameElement;

        /** @type {HTMLElement} The element for the targets faction. */
        this.factionElement = factionElement;

        /** @type {HTMLElement} The element for the targets hull. */
        this.hullElement = hullElement;

        /** @type {HTMLElement} The element for teh targets shield. */
        this.shieldElement = shieldElement;

        const distanceElement = document.getElementById('target-ui_distance');
        const distanceValueElement = document.getElementById('target-ui_distance_value');
        const distanceUnitElement = document.getElementById('target-ui_distance_unit');

        if (!(distanceElement instanceof HTMLElement)) {
            throw new TypeError('distanceElement not a HTMLElement');
        }
        if (!(distanceValueElement instanceof HTMLElement)) {
            throw new TypeError('distanceValueElement not a HTMLElement');
        }
        if (!(distanceUnitElement instanceof HTMLElement)) {
            throw new TypeError('distanceUnitElement not a HTMLElement');
        }

        /** @type {HTMLElement} The element for the targets distance container. */
        this.distanceElement = distanceElement;

        /** @type {HTMLElement} The element for the targets distance value. */
        this.distanceValueElement = distanceValueElement;

        /** @type {HTMLElement} The element for the targets distance unit. */
        this.distanceUnitElement = distanceUnitElement;

        /** @type {GameManager} The game manager where we can find cameraTarget */
        this.gameManager = gameManager;

        /** @type {{name: string|null, faction: string|null, factionHidden: boolean, hull: number, hullHidden: boolean, hullPulse:boolean, shield: number, shieldHidden: boolean, shieldPulse:boolean, distanceValue: string|null, distanceUnit: string}} The last displayed values to avoid unnecessary DOM updates. */
        this._lastDisplayed = {
            name: null,
            faction: null,
            factionHidden: false,
            hull: 0.0,
            hullHidden: false,
            hullPulse: false,
            shield: 0.0,
            shieldHidden: false,
            shieldPulse: false,
            distanceValue: null,
            distanceUnit: '',
        }

        if (new.target === UiDomWindowTarget) Object.seal(this);
    }

    /**
      * Updates the main status window
      * @returns {void}
      */
    update() {
        const target = this.gameManager.cameraTarget.target;

        if (target instanceof Ship) {
            this.setTintFromRelationship(this.gameManager.cameraTarget.getRelationship(target));
        } else {
            this.setTintFromRelationship(FactionRelationship.Neutral);
        }

        if (!target) {
            return;
        }

        const name = (target.name ?? '');
        if (name !== this._lastDisplayed.name) {
            //this.nameElement.innerText = name;
            this.nameElement.style.setProperty('--text', `'${name.replace("'", "\\'")}'`);
            this._lastDisplayed.name = name;
        }

        // Calculate and display distance
        const distance = Math.round(this.gameManager.cameraTarget.position.distanceTo(target.position));
        const isKm = distance >= 1000;
        const distanceValue = isKm ? (distance / 1000).toFixed(1) : distance.toString();
        const distanceUnit = isKm ? 'km' : 'm';

        if (distanceValue !== this._lastDisplayed.distanceValue) {
            this.distanceValueElement.innerText = distanceValue;
            this._lastDisplayed.distanceValue = distanceValue;
        }

        if (distanceUnit !== this._lastDisplayed.distanceUnit) {
            this.distanceUnitElement.innerText = distanceUnit;
            this._lastDisplayed.distanceUnit = distanceUnit;
        }

        if (!(target instanceof Ship)) {
            if (!this._lastDisplayed.factionHidden) {
                this.factionElement.classList.add('hidden');
                this._lastDisplayed.factionHidden = true;
            }
            if (!this._lastDisplayed.hullHidden) {
                this.hullElement.classList.add('hidden');
                this._lastDisplayed.hullHidden = true;
            }
            if (!this._lastDisplayed.shieldHidden) {
                this.shieldElement.classList.add('hidden');
                this._lastDisplayed.shieldHidden = true;
            }
            return;
        }

        if (target instanceof Ship) {
            const faction = (target.faction?.name ?? '');
            if (faction !== this._lastDisplayed.faction) {
                // this.factionElement.innerText = faction;
                this.factionElement.style.setProperty('--text', `'${faction.replace("'", "\\'")}'`);
                this._lastDisplayed.faction = faction;
            }
            if (this._lastDisplayed.factionHidden) {
                this.factionElement.classList.remove('hidden');
                this._lastDisplayed.factionHidden = false;
            }

            const hull = clamp(Math.round(target.hullRatio * 100.0), 0, 100);
            if (hull !== this._lastDisplayed.hull) {
                this.hullElement.style.setProperty('--percent', hull.toString());
                this._lastDisplayed.hull = hull;
            }

            const hullPulse = target.protectionTime > 0;
            if (hullPulse !== this._lastDisplayed.hullPulse) {
                if (hullPulse) {
                    this.hullElement.classList.add('pulse');
                } else {
                    this.hullElement.classList.remove('pulse');
                }
                this._lastDisplayed.hullPulse = hullPulse;
            }

            if (this._lastDisplayed.hullHidden) {
                this.hullElement.classList.remove('hidden');
                this._lastDisplayed.hullHidden = false;
            }

            const shield = clamp(Math.round(target.shieldRatio * 100.0), 0, 100);
            if (shield !== this._lastDisplayed.shield) {
                this.shieldElement.style.setProperty('--percent', shield.toString());
                this._lastDisplayed.shield = shield;
            }

            const shieldPulse = target.shield.rapidRechargeEffectTime > 0;
            if (shieldPulse !== this._lastDisplayed.shieldPulse) {
                if (shieldPulse) {
                    this.shieldElement.classList.add('pulse');
                } else {
                    this.shieldElement.classList.remove('pulse');
                }
                this._lastDisplayed.shieldPulse = shieldPulse;
            }
            if (this._lastDisplayed.shieldHidden) {
                this.shieldElement.classList.remove('hidden');
                this._lastDisplayed.shieldHidden = false;
            }
        }
    }

    /**
     * Called during resizing (on mouse move). Resizes the camera components.
     * @protected
     * @override
     */
    _onResize() {
        this.targetCamera.resize(this._resizableElement.clientWidth, this._resizableElement.clientHeight);
        this.targetHud.resize(this._resizableElement.clientWidth, this._resizableElement.clientHeight);
        this.starField.resize('target', this._resizableElement.clientWidth, this._resizableElement.clientHeight);
    }

    /**
     * Called when resizing ends (on mouse up). Resizes the camera components.
     * @protected
     * @override
     */
    _onResizeEnd() {
        this._onResize();
    }
}
