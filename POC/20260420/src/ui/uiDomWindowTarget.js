// /src/ui/uiDomWindowTarget.js

import { UiDomWindow } from './uiDomWindow.js';

/**
 * Class for managing the target window, extending UiDomWindow.
 * Handles resizing of the target camera view.
 */
export class UiDomWindowTarget extends UiDomWindow {
    /**
     * Creates a new UiDomWindowTarget instance.
     * @param {HTMLElement} element - The DOM element to manage.
     */
    constructor(element) {
        super(element, 200.0, 200.0);
        if (new.target === UiDomWindowTarget) Object.seal(this);
    }

    /**
     * Called during resizing (on mouse move). Resizes the camera components.
     * @protected
     * @override
     */
    _onResize() {
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
