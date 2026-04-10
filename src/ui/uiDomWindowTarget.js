// /src/ui/uiDomWindowTarget.js

import { TargetCamera } from '/src/camera/camera.js';
import { HeadsUpDisplay } from '/src/camera/headsUpDisplay.js';
import { StarField } from '/src/camera/starField.js';
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
     */
    constructor(element, targetCamera, targetHud, starField) {
        super(element, 200.0, 200.0);
        /** @type {TargetCamera} The camera for the target view. */
        this.targetCamera = targetCamera;
        /** @type {HeadsUpDisplay} The HUD for displaying game information. */
        this.targetHud = targetHud;
        /** @type {StarField} The starfield for rendering background stars. */
        this.starField = starField;
        if (new.target === UiDomWindowTarget) Object.seal(this);
    }

    /**
     * Called during resizing (on mouse move). Resizes the camera components.
     * @protected
     * @override
     */
    _onResize() {
        this.targetCamera.resize(this.element.clientWidth, this.element.clientHeight);
        this.targetHud.resize(this.element.clientWidth, this.element.clientHeight);
        this.starField.resize('target', this.element.clientWidth, this.element.clientHeight);
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
