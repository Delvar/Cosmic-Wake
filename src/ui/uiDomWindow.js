// /src/ui/uiDomWindow.js

import { FactionRelationship } from '/src/core/faction.js';
import { clamp } from '/src/core/utils.js';

/** @enum {string} */
export const ResizeHandle = Object.freeze({
    'top-left': 'top-left',
    'top': 'top',
    'top-right': 'top-right',
    'left': 'left',
    'right': 'right',
    'bottom-left': 'bottom-left',
    'bottom': 'bottom',
    'bottom-right': 'bottom-right'
});

const PIN_ZONE_RATIO = 200 / 1920;
const PIN_EDGE_RATIO = 100 / 1920;
const CENTRE_ZONE_RATIO = 200 / 1920;

/**
 * Abstract base class for managing DOM-based UI windows with optional resizing,
 * dragging, pinning to screen edges/centre, and visibility toggling.
 */
export class UiDomWindow {
    /**
     * Static map of FactionRelationship values to tint class names.
     * @type {Record<FactionRelationship, string>}
     */
    static #TINT_CLASS_MAP = {
        [FactionRelationship.Allied]: 'tint-allied',
        [FactionRelationship.Neutral]: 'tint-neutral',
        [FactionRelationship.Hostile]: 'tint-hostile',
        [FactionRelationship.Disabled]: 'tint-disabled'
    };

    /**
     * @param {HTMLElement} element - The root DOM element representing this window.
     * @param {FactionRelationship | null} factionRelationship - Optional faction relationship used to apply a tint class.
     */
    constructor(element, factionRelationship = null) {
        if (this.constructor === UiDomWindow) {
            throw new TypeError('UiDomWindow is an abstract class and cannot be instantiated directly.');
        }

        /** @type {HTMLElement} */
        this.element = element;
        /** @type {HTMLElement} */
        this._resizableElement = this._findResizableElement();
        /** @type {boolean} */
        this._isNested = this._resizableElement !== this.element;
        /** @type {{left: number; top: number}} */
        this._offset = { left: 0, top: 0 };
        this._computeOffset();
        /** @type {boolean} */
        this._isResizing = false;
        /** @type {number} */
        this._startX = 0.0;
        /** @type {number} */
        this._startY = 0.0;
        /** @type {number} */
        this._startWidth = 0.0;
        /** @type {number} */
        this._startHeight = 0.0;
        /** @type {number} */
        this._startLeft = 0.0;
        /** @type {number} */
        this._startTop = 0.0;
        /** @type {ResizeHandle | ''} */
        this._activeResizeHandle = '';
        /** @type {string | null} */
        this.tintClass = null;
        /** @type {{top: boolean; bottom: boolean; left: boolean; right: boolean; centreHorizontal: boolean; centreVertical: boolean}} */
        this._pins = {
            top: false,
            bottom: false,
            left: false,
            right: false,
            centreHorizontal: false,
            centreVertical: false
        };
        /** @type {Record<keyof typeof ResizeHandle, HTMLElement | null>} */
        this._resizeHandles = {
            'top-left': null,
            'top': null,
            'top-right': null,
            'left': null,
            'right': null,
            'bottom-left': null,
            'bottom': null,
            'bottom-right': null
        };

        /** @type {boolean} */
        this._isDragging = false;
        /** @type {number} */
        this._offsetX = 0.0;
        /** @type {number} */
        this._offsetY = 0.0;

        const computedStyle = window.getComputedStyle(this._resizableElement);

        /** @type {number} */
        this.minWidth = parseFloat(computedStyle.minWidth) || 0.0;
        /** @type {number} */
        this.maxWidth = computedStyle.maxWidth === 'none' ? Infinity : parseFloat(computedStyle.maxWidth);
        /** @type {number} */
        this.minHeight = parseFloat(computedStyle.minHeight) || 0.0;
        /** @type {number} */
        this.maxHeight = computedStyle.maxHeight === 'none' ? Infinity : parseFloat(computedStyle.maxHeight);
        /** @type {boolean} */
        this.isHidden = this.element.classList.contains('hidden');

        this._setupResizing();
        this._updateResizeHandlesVisibility();
        this._setupDragging();
        window.addEventListener('resize', this._onWindowResize.bind(this));
        this._setupVisibility();

        if (factionRelationship !== null) {
            this.setTintFromRelationship(factionRelationship);
        }

        const initialRect = this.element.getBoundingClientRect();
        this.element.style.left = `${Math.round(initialRect.left)}px`;
        this.element.style.top = `${Math.round(initialRect.top)}px`;
        this.element.style.bottom = 'unset';
        this.element.style.right = 'unset';

        this._evaluatePinStateFromCurrentRect();
        this._syncInnerPosition();
    }

    /**
     * Finds the element that contains the resize handles.
     * @returns {HTMLElement} The element that should be resized (either the element itself or its inner resizable container).
     * @private
     */
    _findResizableElement() {
        const handles = this.element.querySelectorAll('.resize-handle');
        if (handles.length === 0) return this.element;
        return /** @type {HTMLElement} */ (handles[0].parentElement);
    }

    /**
     * Computes and caches the offset between outer element and inner resizable element.
     * @private
     */
    _computeOffset() {
        if (!this._isNested) {
            this._offset = { left: 0, top: 0 };
            return;
        }
        const outerRect = this.element.getBoundingClientRect();
        const innerRect = this._resizableElement.getBoundingClientRect();
        this._offset = {
            left: innerRect.left - outerRect.left,
            top: innerRect.top - outerRect.top
        };
    }

    /**
     * Sets up resize handles if present in the DOM.
     * @private
     */
    _setupResizing() {
        const handles = this.element.querySelectorAll('.resize-handle');
        if (handles.length === 0) return;

        const rect = this._resizableElement.getBoundingClientRect();
        this._resizableElement.style.width = `${clamp(rect.width, this.minWidth, this.maxWidth)}px`;
        this._resizableElement.style.height = `${clamp(rect.height, this.minHeight, this.maxHeight)}px`;

        for (const handle of handles) {
            if (!(handle instanceof HTMLElement)) continue;
            for (const cls of handle.classList) {
                if (cls == 'resize-handle') continue;
                const key = /** @type {keyof typeof ResizeHandle} */ (cls);
                if (key in ResizeHandle) {
                    this._resizeHandles[key] = handle;
                    handle.addEventListener('mousedown', this._onResizeMouseDown.bind(this));
                    break;
                }
            }
        }

        document.addEventListener('mousemove', this._onResizeMouseMove.bind(this));
        document.addEventListener('mouseup', this._onResizeMouseUp.bind(this));
    }

    /**
     * Returns true if any pin or centre constraint is active.
     * @returns {boolean} True when any edge pin or centre constraint is set.
     * @private
     */
    _hasPin() {
        const p = this._pins;
        return p.top || p.bottom || p.left || p.right || p.centreHorizontal || p.centreVertical;
    }

    /**
     * Updates visibility of resize handles based on current pins.
     * @private
     */
    _updateResizeHandlesVisibility() {
        const { top, bottom, left, right } = this._pins;
        const visibility = {
            'top-left': top || left,
            'top': top,
            'top-right': top || right,
            'left': left,
            'right': right,
            'bottom-left': bottom || left,
            'bottom': bottom,
            'bottom-right': bottom || right
        };

        for (const [key, hidden] of Object.entries(visibility)) {
            const handle = this._resizeHandles[/** @type {keyof typeof ResizeHandle} */(key)];
            if (handle) {
                if (hidden) {
                    handle.classList.add('hidden');
                } else {
                    handle.classList.remove('hidden');
                }
            }
        }
    }

    /**
     * Handles browser window resize events for pinned windows.
     * @private
     */
    _onWindowResize() {
        this._computeOffset();
        if (!this._hasPin()) return;

        if (this._pins.top || this._pins.bottom || this._pins.left || this._pins.right) {
            this._applyPinStylesFromRect(this.element.getBoundingClientRect());
        }
        this._updateResizeHandlesVisibility();
    }

    /**
     * Mouse down handler for resize handles.
     * @param {MouseEvent} e - The initiating mouse event for the resize operation.
     * @private
     */
    _onResizeMouseDown(e) {
        if (this._isResizing || this._isDragging) return;
        if (!(e instanceof MouseEvent)) return;

        e.preventDefault();
        e.stopPropagation();

        this._isResizing = true;
        this.element.classList.add('resizing');
        this._activeResizeHandle = '';
        for (const [key, handle] of Object.entries(this._resizeHandles)) {
            if (!(e.target instanceof Node)) continue;
            if (handle && (handle === e.target || handle.contains(e.target))) {
                this._activeResizeHandle = ResizeHandle[/** @type {keyof typeof ResizeHandle} */(key)];
                break;
            }
        }

        if (!this._activeResizeHandle) {
            this._isResizing = false;
            return;
        }

        this._startX = e.clientX;
        this._startY = e.clientY;

        const rect = this._resizableElement.getBoundingClientRect();
        this._startWidth = rect.width;
        this._startHeight = rect.height;

        const windowRect = this.element.getBoundingClientRect();
        this._startLeft = windowRect.left + (this._isNested ? this._offset.left : 0);
        this._startTop = windowRect.top + (this._isNested ? this._offset.top : 0);
    }

    /**
     * Mouse move handler during active resize.
     * @param {MouseEvent} e - The mousemove event describing pointer movement.
     * @private
     */
    _onResizeMouseMove(e) {
        if (!this._isResizing) return;
        if (!(e instanceof MouseEvent)) return;

        e.preventDefault();
        e.stopPropagation();
        if (!this._activeResizeHandle) return;

        const deltaX = e.clientX - this._startX;
        const deltaY = e.clientY - this._startY;

        let widthDelta = 0;
        if (this._activeResizeHandle.includes('left')) widthDelta -= deltaX;
        if (this._activeResizeHandle.includes('right')) widthDelta += deltaX;
        if (this._pins.centreHorizontal && (this._activeResizeHandle.includes('left') || this._activeResizeHandle.includes('right'))) {
            widthDelta *= 2;
        }

        let newWidth = clamp(this._startWidth + widthDelta, this.minWidth, this.maxWidth);

        let heightDelta = 0;
        if (this._activeResizeHandle.includes('top')) heightDelta -= deltaY;
        if (this._activeResizeHandle.includes('bottom')) heightDelta += deltaY;
        if (this._pins.centreVertical && (this._activeResizeHandle.includes('top') || this._activeResizeHandle.includes('bottom'))) {
            heightDelta *= 2;
        }

        let newHeight = clamp(this._startHeight + heightDelta, this.minHeight, this.maxHeight);

        let newLeft = this._startLeft;
        let newTop = this._startTop;

        if (this._activeResizeHandle.includes('left') && !this._pins.centreHorizontal) {
            newLeft = this._startLeft + (this._startWidth - newWidth);
        }

        if (this._activeResizeHandle.includes('top') && !this._pins.centreVertical) {
            newTop = this._startTop + (this._startHeight - newHeight);
        }

        if (this._activeResizeHandle.includes('left') || this._activeResizeHandle.includes('right')) {
            this._resizableElement.style.width = `${newWidth}px`;
        }

        if (this._activeResizeHandle.includes('top') || this._activeResizeHandle.includes('bottom')) {
            this._resizableElement.style.height = `${newHeight}px`;
        }

        if (this._activeResizeHandle.includes('left') && !this._pins.centreHorizontal) {
            const outerLeft = this._isNested ? newLeft - this._offset.left : newLeft;
            this.element.style.left = `${Math.round(outerLeft)}px`;
            this.element.style.right = 'unset';
        }

        if (this._activeResizeHandle.includes('top') && !this._pins.centreVertical) {
            const outerTop = this._isNested ? newTop - this._offset.top : newTop;
            this.element.style.top = `${Math.round(outerTop)}px`;
            this.element.style.bottom = 'unset';
        }

        this._onResize();
    }

    /**
     * Called on every resize move. Override in subclasses.
     * @protected
     */
    _onResize() { }

    /**
     * Mouse up handler after resize.
     * @param {MouseEvent} e - The mouseup event signaling resize end.
     * @private
     */
    _onResizeMouseUp(e) {
        if (!this._isResizing) return;

        this._isResizing = false;
        if (!(e instanceof MouseEvent)) return;

        e.preventDefault();
        e.stopPropagation();

        this.element.classList.remove('resizing');
        this._onResizeEnd(e);

        this._evaluatePinStateFromCurrentRect();
        this._syncInnerPosition();
    }

    /**
     * Called after resize ends. Override in subclasses.
     * @param {MouseEvent} _e - The mouseup event that ended the resize.
     * @protected
     */
    _onResizeEnd(_e) { }

    /**
     * Recomputes offset after layout changes (relies on CSS for inner positioning).
     * @private
     */
    _syncInnerPosition() {
        if (!this._isNested) return;
        this._computeOffset();
    }

    /**
     * Calculates current pin/centre state from window position.
     * @param {DOMRect} rect - The bounding client rect of the window to evaluate.
     * @returns {typeof this._pins} An object describing which edges or centre constraints should be active.
     * @private
     */
    _getPinStateForRect(rect) {
        // Calculate viewport dimensions and the center point of the window
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const halfWidth = rect.width * 0.5;
        const halfHeight = rect.height * 0.5;
        const centreX = rect.left + halfWidth;
        const centreY = rect.top + halfHeight;

        // Define the central zone boundaries where centring can occur (25% of viewport by default)
        // This creates a central area for detecting if the window should be centred horizontally/vertically
        const centreWidth = viewportWidth * CENTRE_ZONE_RATIO;
        const centreHeight = viewportHeight * CENTRE_ZONE_RATIO;
        const centreLeft = (viewportWidth - centreWidth) * 0.5;
        const centreRight = centreLeft + centreWidth;
        const centreTop = (viewportHeight - centreHeight) * 0.5;
        const centreBottom = centreTop + centreHeight;

        // Define conditions for corner pinning (window overlaps corner zones) and edge detection
        // Corner/edge thresholds are computed as ratios of viewport width/height so
        // behaviour scales across different screen sizes.
        const pinZoneX = viewportWidth * PIN_ZONE_RATIO;
        const pinZoneY = viewportHeight * PIN_ZONE_RATIO;
        const pinEdgeX = viewportWidth * PIN_EDGE_RATIO;
        const pinEdgeY = viewportHeight * PIN_EDGE_RATIO;

        const topLeft = rect.left <= pinZoneX && rect.top <= pinZoneY;
        const topRight = rect.right >= viewportWidth - pinZoneX && rect.top <= pinZoneY;
        const bottomLeft = rect.left <= pinZoneX && rect.bottom >= viewportHeight - pinZoneY;
        const bottomRight = rect.right >= viewportWidth - pinZoneX && rect.bottom >= viewportHeight - pinZoneY;
        const leftEdge = rect.left <= pinEdgeX;
        const rightEdge = rect.right >= viewportWidth - pinEdgeX;
        const topEdge = rect.top <= pinEdgeY;
        const bottomEdge = rect.bottom >= viewportHeight - pinEdgeY;

        // Determine pin states for each edge:
        // - Corners trigger both adjacent edges (e.g., topLeft pins top and left)
        // - Pure edge pinning only if not in corner zones and center is away from sides (to avoid false positives)
        // This logic prioritizes corner detection and ensures side pinning only for non-corner edge overlaps
        let pinTop = topLeft || topRight || (topEdge && centreX > pinZoneX && centreX < viewportWidth - pinZoneX);
        let pinBottom = bottomLeft || bottomRight || (bottomEdge && centreX > pinZoneX && centreX < viewportWidth - pinZoneX);
        let pinLeft = topLeft || bottomLeft || (leftEdge && centreY > pinZoneY && centreY < viewportHeight - pinZoneY);
        let pinRight = topRight || bottomRight || (rightEdge && centreY > pinZoneY && centreY < viewportHeight - pinZoneY);

        // Initialize flags for centring the window horizontally and/or vertically
        let centreHorizontal = false;
        let centreVertical = false;

        // Check if any edge pinning is active
        const hasAnyEdge = pinTop || pinBottom || pinLeft || pinRight;

        // Centring logic:
        // - If no edges pinned, check if window center is fully within the central zone -> enable both horizontal and vertical centring
        // - If edges pinned, enable centring only on the axis without edge pins, and only if center is not near sides (prevents centring pinned windows)
        // This ensures centring is applied appropriately without conflicting with edge pins
        if (!hasAnyEdge) {
            if (centreX >= centreLeft && centreX <= centreRight && centreY >= centreTop && centreY <= centreBottom) {
                centreHorizontal = true;
                centreVertical = true;
            }
        } else {
            if ((pinTop || pinBottom) && !(pinLeft || pinRight) && centreX >= centreLeft && centreX <= centreRight) {
                centreHorizontal = true;
            }
            if ((pinLeft || pinRight) && !(pinTop || pinBottom) && centreY >= centreTop && centreY <= centreBottom) {
                centreVertical = true;
            }
        }

        // Return the computed pin state object
        return { top: pinTop, bottom: pinBottom, left: pinLeft, right: pinRight, centreHorizontal, centreVertical };
    }

    /**
     * Applies the current pin state as CSS styles.
     * @param {DOMRect} rect - The bounding client rect used to compute pinned CSS positions.
     * @private
     */
    _applyPinStylesFromRect(rect) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const innerRect = this._resizableElement.getBoundingClientRect();
        const innerWidth = clamp(innerRect.width, this.minWidth, this.maxWidth);
        const innerHeight = clamp(innerRect.height, this.minHeight, this.maxHeight);

        const { top, bottom, left, right, centreHorizontal, centreVertical } = this._pins;

        // Horizontal positioning
        if (centreHorizontal) {
            this.element.style.left = '50%';
            this.element.style.right = 'unset';
        } else if (left && right) {
            this.element.style.left = `${Math.round(rect.left)}px`;
            this.element.style.right = `${Math.round(viewportWidth - rect.right)}px`;
            this._resizableElement.style.width = this._resizableElement === this.element ? 'auto' : '100%';
        } else if (left) {
            this.element.style.left = `${Math.round(rect.left)}px`;
            this.element.style.right = 'unset';
            this._resizableElement.style.width = `${innerWidth}px`;
        } else if (right) {
            this.element.style.right = `${Math.round(viewportWidth - rect.right)}px`;
            this.element.style.left = 'unset';
            this._resizableElement.style.width = `${innerWidth}px`;
        } else {
            this.element.style.left = `${Math.round(rect.left)}px`;
            this.element.style.right = 'unset';
        }

        // Vertical positioning
        if (centreVertical) {
            this.element.style.top = '50%';
            this.element.style.bottom = 'unset';
        } else if (top && bottom) {
            this.element.style.top = `${Math.round(rect.top)}px`;
            this.element.style.bottom = `${Math.round(viewportHeight - rect.bottom)}px`;
            this._resizableElement.style.height = this._resizableElement === this.element ? 'auto' : '100%';
        } else if (top) {
            this.element.style.top = `${Math.round(rect.top)}px`;
            this.element.style.bottom = 'unset';
            this._resizableElement.style.height = `${innerHeight}px`;
        } else if (bottom) {
            this.element.style.bottom = `${Math.round(viewportHeight - rect.bottom)}px`;
            this.element.style.top = 'unset';
            this._resizableElement.style.height = `${innerHeight}px`;
        } else {
            this.element.style.top = `${Math.round(rect.top)}px`;
            this.element.style.bottom = 'unset';
        }

        // Mixed dual-edge + centre overrides
        if (left && right && centreHorizontal) {
            this.element.style.left = '50%';
            this.element.style.right = 'unset';
            this._resizableElement.style.width = `${innerWidth}px`;
        }
        if (top && bottom && centreVertical) {
            this.element.style.top = '50%';
            this.element.style.bottom = 'unset';
            this._resizableElement.style.height = `${innerHeight}px`;
        }

        // Centring transform
        let transformValue = 'none';
        if (centreHorizontal && centreVertical) {
            transformValue = 'translate(-50%, -50%)';
        } else if (centreHorizontal) {
            transformValue = 'translateX(-50%)';
        } else if (centreVertical) {
            transformValue = 'translateY(-50%)';
        }
        this.element.style.transform = transformValue;
    }

    /**
     * Evaluates current position and reapplies pins if changed.
     * @private
     */
    _evaluatePinStateFromCurrentRect() {
        const rect = this.element.getBoundingClientRect();
        const newPinState = this._getPinStateForRect(rect);

        const same = this._pins.top === newPinState.top &&
            this._pins.bottom === newPinState.bottom &&
            this._pins.left === newPinState.left &&
            this._pins.right === newPinState.right &&
            this._pins.centreHorizontal === newPinState.centreHorizontal &&
            this._pins.centreVertical === newPinState.centreVertical;

        if (same) return;

        this._pins = newPinState;
        this._applyPinStylesFromRect(rect);
        this._updateResizeHandlesVisibility();
    }

    /**
     * Sets up dragging if the element has the draggable attribute.
     * @private
     */
    _setupDragging() {
        if (!this.element.draggable) return;
        this.element.draggable = false;

        this.element.addEventListener('mousedown', this._onDragMouseDown.bind(this));
        document.addEventListener('mousemove', this._onDragMouseMove.bind(this));
        document.addEventListener('mouseup', this._onDragMouseUp.bind(this));
    }

    /**
     * Mouse down handler for dragging.
     * @param {MouseEvent} e - The initiating mouse event for the drag operation.
     * @private
     */
    _onDragMouseDown(e) {
        if (!(e instanceof MouseEvent)) return;
        if (e.button !== 0 || this._isResizing || this._isDragging) return;
        e.preventDefault();
        e.stopPropagation();

        if (this._hasPin()) {
            const rect = this.element.getBoundingClientRect();
            const innerRect = this._resizableElement.getBoundingClientRect();
            const innerWidth = clamp(innerRect.width, this.minWidth, this.maxWidth);
            const innerHeight = clamp(innerRect.height, this.minHeight, this.maxHeight);

            if (this._pins.left && this._pins.right) this._resizableElement.style.width = `${innerWidth}px`;
            if (this._pins.top && this._pins.bottom) this._resizableElement.style.height = `${innerHeight}px`;

            this.element.style.left = `${Math.round(rect.left)}px`;
            this.element.style.top = `${Math.round(rect.top)}px`;
            this.element.style.right = 'unset';
            this.element.style.bottom = 'unset';
            if (this._pins.centreHorizontal || this._pins.centreVertical) {
                this.element.style.transform = 'none';
            }
        }

        this._isDragging = true;
        this.element.classList.add('dragging');

        const rect = this.element.getBoundingClientRect();
        this._offsetX = e.clientX - rect.left;
        this._offsetY = e.clientY - rect.top;
    }

    /**
     * Mouse move handler during drag.
     * @param {MouseEvent} e - The mousemove event used to update the element position.
     * @private
     */
    _onDragMouseMove(e) {
        if (this._isResizing || !this._isDragging) return;
        if (!(e instanceof MouseEvent)) return;
        e.preventDefault();
        e.stopPropagation();

        this.element.style.left = `${Math.round(e.clientX - this._offsetX)}px`;
        this.element.style.top = `${Math.round(e.clientY - this._offsetY)}px`;
    }

    /**
     * Mouse up handler after drag.
     * @param {MouseEvent} e - The mouseup event ending the drag operation.
     * @private
     */
    _onDragMouseUp(e) {
        if (this._isResizing || !this._isDragging) return;
        if (!(e instanceof MouseEvent)) return;

        e.preventDefault();
        e.stopPropagation();

        this._isDragging = false;
        this.element.classList.remove('dragging');
        this._evaluatePinStateFromCurrentRect();
    }

    /**
     * Placeholder for visibility setup.
     * @private
     */
    _setupVisibility() { }

    /** Shows the window. */
    show() {
        if (this.isHidden) {
            this.element.classList.remove('hidden');
            this.isHidden = false;
        }
    }

    /** Hides the window. */
    hide() {
        if (!this.isHidden) {
            this.element.classList.add('hidden');
            this.isHidden = true;
        }
    }

    /**
     * Sets window tint from faction relationship.
     * @param {FactionRelationship} relationshipValue - The faction relationship value used to select a tint class.
     * @throws {Error}
     * @returns {void} No return value.
     */
    setTintFromRelationship(relationshipValue) {
        const targetTintClass = UiDomWindow.#TINT_CLASS_MAP[relationshipValue];
        if (targetTintClass === undefined) {
            throw new Error(`Unknown relationship value: ${relationshipValue}. Add mapping to UiDomWindow.#TINT_CLASS_MAP.`);
        }
        if (this.tintClass === targetTintClass) return;

        if (this.tintClass) this.element.classList.remove(this.tintClass);
        if (targetTintClass) this.element.classList.add(targetTintClass);

        this.tintClass = targetTintClass;

        if (this._isNested) this._computeOffset();
    }
}