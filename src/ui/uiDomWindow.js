// /src/ui/uiDomWindow.js

import { FactionRelationship } from '/src/core/faction.js';
import { clamp } from '/src/core/utils.js';

/**
 * Enum for resize corners.
 * @enum {string}
 */
export const Corner = Object.freeze({
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right'
});

/**
 * Abstract base class for managing DOM-based UI windows with optional resizing, dragging, and visibility toggling.
 * @abstract
 */
export class UiDomWindow {
    /**
     * Static map of FactionRelationship values to their corresponding tint class names.
     * Avoids string allocation on every call to setTintFromRelationship().
     * @type {Object<FactionRelationship, string>}
     */
    static #TINT_CLASS_MAP = {
        [FactionRelationship.Allied]: 'tint-allied',
        [FactionRelationship.Neutral]: 'tint-neutral',
        [FactionRelationship.Hostile]: 'tint-hostile',
        [FactionRelationship.Disabled]: 'tint-disabled'
    };

    /**
     * Initializes a new UiDomWindow instance. This class is abstract and cannot be instantiated directly.
     * @param {HTMLElement} element - The DOM element to manage as a UI window.
     * @param {FactionRelationship|null} factionRelationship - Optional faction relationship value to set initial tint (FactionRelationship).
     */
    constructor(element, factionRelationship = null) {
        if (this.constructor === UiDomWindow) {
            throw new TypeError('UiDomWindow is an abstract class and cannot be instantiated directly.');
        }

        /** @type {HTMLElement} The DOM element managed by this window. */
        this.element = element;
        /** @type {HTMLElement} The actual element that owns the resize handles and will be resized (viewport). */
        this._resizableElement = this._findResizableElement();

        // Instance properties for resizing
        /** @type {boolean} Flag indicating if resizing is active. */
        this._isResizing = false;
        /** @type {number} Starting X position for resizing. */
        this._startX = 0.0;
        /** @type {number} Starting Y position for resizing. */
        this._startY = 0.0;
        /** @type {number} Starting width for resizing. */
        this._startWidth = 0.0;
        /** @type {number} Starting height for resizing. */
        this._startHeight = 0.0;
        /** @type {number} Starting left position for resizing. */
        this._startLeft = 0.0;
        /** @type {number} Starting top position for resizing. */
        this._startTop = 0.0;
        /** @type {'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | ''} The corner being resized. */
        this._corner = '';

        // Instance properties for dragging
        /** @type {boolean} Flag indicating if dragging is active. */
        this._isDragging = false;
        /** @type {number} Offset X for dragging. */
        this._offsetX = 0.0;
        /** @type {number} Offset Y for dragging. */
        this._offsetY = 0.0;

        const computedStyle = window.getComputedStyle(this._resizableElement);
        const minWidth = parseFloat(computedStyle.minWidth) || 0.0;
        const maxWidth = computedStyle.maxWidth === 'none' ? Infinity : parseFloat(computedStyle.maxWidth);
        const minHeight = parseFloat(computedStyle.minHeight) || 0.0;
        const maxHeight = computedStyle.maxHeight === 'none' ? Infinity : parseFloat(computedStyle.maxHeight);

        /** @type {number} Enforced minimum width. */
        this.minWidth = minWidth;
        /** @type {number} Enforced maximum width. */
        this.maxWidth = maxWidth;
        /** @type {number} Enforced minimum height. */
        this.minHeight = minHeight;
        /** @type {number} Enforced maximum height. */
        this.maxHeight = maxHeight;

        // Cache for visibility and tint state to avoid unnecessary DOM updates
        /** @type {boolean} Cached visibility state (true if element has 'hidden' class). */
        this.isHidden = this.element.classList.contains('hidden');
        /** @type {string|null} Cached tint class name (e.g., 'tint-allied' or null if none). */
        this.tintClass = null;

        this._setupResizing();
        this._setupDragging();
        this._setupVisibility();

        // Apply tint based on faction relationship if provided
        if (factionRelationship !== null) {
            this.setTintFromRelationship(factionRelationship);
        }
    }

    /**
     * Finds the element containing the resize handles (generic traversal - works with any nesting).
     * Falls back to the root if no handles are found.
     * @private
     * @returns {HTMLElement}
     */
    _findResizableElement() {
        const handles = this.element.querySelectorAll('.resize-handle');
        if (handles.length === 0) return this.element;
        // Handles share a single parent by design (the viewport)
        return /** @type {HTMLElement} */ (handles[0].parentElement);
    }

    /**
     * Sets up resizing functionality if resize handles are present.
     * @private
     */
    _setupResizing() {
        const handles = this.element.querySelectorAll('.resize-handle');
        if (handles.length === 0) return; // No handles, skip setup

        const rect = this._resizableElement.getBoundingClientRect();
        this._resizableElement.style.width = `${clamp(rect.width, this.minWidth, this.maxWidth)}px`;
        this._resizableElement.style.height = `${clamp(rect.width, this.minHeight, this.maxHeight)}px`;

        handles.forEach((handle) => {
            handle.addEventListener('mousedown', this._onMouseDown.bind(this));
        });

        // Global listeners for mousemove and mouseup
        document.addEventListener('mousemove', this._onMouseMove.bind(this));
        document.addEventListener('mouseup', this._onMouseUp.bind(this));
    }

    /**
     * Handles mousedown event on resize handles.
     * @param {Event} e - The mouse event.
     * @private
     */
    _onMouseDown(e) {
        // console.log(`${this.constructor.name}: _onMouseDown`, e);
        if (!(e instanceof MouseEvent)) return;
        if (!e.target) return;
        if (!(e.target instanceof HTMLElement)) return;

        e.preventDefault();
        e.stopPropagation();

        this._isResizing = true;
        this.element.classList.add('resizing');

        this._corner = '';
        for (const cls of e.target.classList) {
            if (cls === Corner.TOP_LEFT || cls === Corner.TOP_RIGHT ||
                cls === Corner.BOTTOM_LEFT || cls === Corner.BOTTOM_RIGHT) {
                this._corner = cls;
                break;
            }
        }
        if (this._corner === '') {
            console.warn('No valid corner class found on resize handle');
            this._isResizing = false;
            return;
        }
        this._startX = e.clientX;
        this._startY = e.clientY;
        const rect = this._resizableElement.getBoundingClientRect();
        this._startWidth = rect.width;
        this._startHeight = rect.height;
    }

    /**
     * Handles mousemove event during resizing.
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onMouseMove(e) {
        // console.log(`${this.constructor.name}: _onMouseMove : _isResizing: ${this._isResizing}`, e);
        if (!this._isResizing) return;

        // Bottom-right only (per agreed prototype - other corners added later)
        if (this._corner !== Corner.BOTTOM_RIGHT) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const minWidth = this.minWidth;
        const minHeight = this.minHeight;
        //let newWidth = this._startWidth, newHeight = this._startHeight, newLeft = this._startLeft, newTop = this._startTop;
        let newWidth = this._startWidth;
        let newHeight = this._startHeight;

        // Calculate mouse movement (positive deltaX when dragging left)
        const deltaX = this._startX - e.clientX; // Left drag = positive
        const deltaY = this._startY - e.clientY; // Up drag = positive

        // if (this._corner === Corner.TOP_LEFT) {
        //     // Resize left: Increase/decrease width, Increase/decrease left
        //     newWidth = Math.max(minWidth, this._startWidth + deltaX);
        //     const effectiveDeltaX = newWidth - this._startWidth;
        //     newLeft = this._startLeft - effectiveDeltaX;
        //     // Resize up: Increase/decrease height, Increase/decrease top
        //     newHeight = Math.max(minHeight, this._startHeight + deltaY);
        //     const effectiveDeltaY = newHeight - this._startHeight;
        //     newTop = this._startTop - effectiveDeltaY;
        // } else if (this._corner === Corner.TOP_RIGHT) {
        //     // Resize right: Increase/decrease width, left fixed
        //     newWidth = Math.max(minWidth, this._startWidth - deltaX);
        //     // Resize up: Increase/decrease height, Increase/decrease top
        //     newHeight = Math.max(minHeight, this._startHeight + deltaY);
        //     const effectiveDeltaY = newHeight - this._startHeight;
        //     newTop = this._startTop - effectiveDeltaY;
        // } else if (this._corner === Corner.BOTTOM_LEFT) {
        //     // Resize left: Increase/decrease width, Increase/decrease left
        //     newWidth = Math.max(minWidth, this._startWidth + deltaX);
        //     const effectiveDeltaX = newWidth - this._startWidth;
        //     newLeft = this._startLeft - effectiveDeltaX;
        //     // Resize down: Increase/decrease height, top fixed
        //     newHeight = Math.max(minHeight, this._startHeight - deltaY);
        // } else if (this._corner === Corner.BOTTOM_RIGHT) {
        //     // Resize right: Increase/decrease width, left fixed
        //     newWidth = Math.max(minWidth, this._startWidth - deltaX);
        //     // Resize down: Increase/decrease height, top fixed
        //     newHeight = Math.max(minHeight, this._startHeight - deltaY);
        // }

        // Update element styles
        // this.element.style.width = `${newWidth}px`;
        // this.element.style.height = `${newHeight}px`;
        // this.element.style.left = `${newLeft}px`;
        // this.element.style.top = `${newTop}px`;

        // Bottom-right only
        newWidth = Math.max(minWidth, this._startWidth - deltaX);
        newHeight = Math.max(minHeight, this._startHeight - deltaY);

        newWidth = clamp(newWidth, this.minWidth, this.maxWidth);
        newHeight = clamp(newHeight, this.minHeight, this.maxHeight);

        this._resizableElement.style.width = `${newWidth}px`;
        this._resizableElement.style.height = `${newHeight}px`;

        this._onResize();
    }

    /**
     * Called during resizing (on mouse move). Override in subclasses.
     * @protected
     */
    _onResize() { }

    /**
     * Handles mouseup event to end resizing.
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onMouseUp(e) {
        // console.log(`${this.constructor.name}: _onMouseUp : _isResizing: ${this._isResizing}`, e);
        this._isResizing = false;

        e.preventDefault();
        e.stopPropagation();

        this.element.classList.remove('resizing');
        this._onResizeEnd(e);
    }

    /**
     * Called when resizing ends (on mouse up). Override in subclasses.
     * @param {MouseEvent} e - The mouse event.
     * @protected
     */
    _onResizeEnd(e) {
        // console.log(`${this.constructor.name}: _onResizeEnd : _isResizing: ${this._isResizing}`, e);
    }

    /**
     * Sets up dragging functionality if the element is draggable.
     * @private
     */
    _setupDragging() {
        if (!this.element.draggable) return; // Not draggable, skip setup

        // Remove any native draggable attribute to prevent red no-drop cursor
        this.element.draggable = false;

        const rect = this.element.getBoundingClientRect();
        this.element.style.left = `${rect.left}px`;
        this.element.style.top = `${rect.top}px`;
        this.element.style.bottom = 'unset';
        this.element.style.right = 'unset';

        this.element.addEventListener('mousedown', this._onDragMouseDown.bind(this));
        document.addEventListener('mousemove', this._onDragMouseMove.bind(this));
        document.addEventListener('mouseup', this._onDragMouseUp.bind(this));
    }

    /**
     * Starts dragging when mouse is pressed on the window (title bar area or whole element).
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onDragMouseDown(e) {
        // console.log(`${this.constructor.name}: _onDragMouseDown : _isResizing: ${this._isResizing} : _isDragging: ${this._isDragging}`, e);
        if (e.button !== 0) return;                    // left mouse button only
        if (this._isResizing) return;                  // don't drag while resizing

        e.preventDefault();
        e.stopPropagation();

        this._isDragging = true;
        this.element.classList.add('dragging');        // triggers grabbing cursor

        const rect = this.element.getBoundingClientRect();
        this._offsetX = e.clientX - rect.left;
        this._offsetY = e.clientY - rect.top;
    }

    /**
     * Updates window position while dragging.
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onDragMouseMove(e) {
        // console.log(`${this.constructor.name}: _onDragMouseMove : _isResizing: ${this._isResizing} : _isDragging: ${this._isDragging}`, e);
        if (!this._isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        this.element.style.left = `${e.clientX - this._offsetX}px`;
        this.element.style.top = `${e.clientY - this._offsetY}px`;
    }

    /**
     * Ends dragging.
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onDragMouseUp(e) {
        // console.log(`${this.constructor.name}: _onDragMouseUp : _isResizing: ${this._isResizing} : _isDragging: ${this._isDragging}`, e);
        if (!this._isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        this._isDragging = false;
        this.element.classList.remove('dragging');
    }

    /**
     * Sets up visibility toggling (initial state).
     * @private
     */
    _setupVisibility() {
        // Optional: Initialize based on current class (e.g., if 'hidden' is present)
    }

    /**
     * Shows the UI window.
     * @returns {void}
     */
    show() {
        if (this.isHidden) {
            this.element.classList.remove('hidden');
            this.isHidden = false;
        }
    }

    /**
     * Hides the UI window.
     * @returns {void}
     */
    hide() {
        if (!this.isHidden) {
            this.element.classList.add('hidden');
            this.isHidden = true;
        }
    }

    /**
     * Sets the window tint based on a faction relationship value.
     * Uses a static map to look up the tint class, avoiding string allocations.
     * Only updates the DOM if the tint class has actually changed.
     * @param {FactionRelationship} relationshipValue - A FactionRelationship value (Allied, Neutral, Hostile, or Disabled).
     * @returns {void}
     * @throws {Error} If the relationship value is not found in the tint class map.
     */
    setTintFromRelationship(relationshipValue) {
        // Look up the tint class from the static map
        const targetTintClass = UiDomWindow.#TINT_CLASS_MAP[relationshipValue];
        if (targetTintClass === undefined) {
            throw new Error(`Unknown relationship value: ${relationshipValue}. Add mapping to UiDomWindow.#TINT_CLASS_MAP.`);
        }

        // Only update DOM if the tint class has changed
        if (this.tintClass === targetTintClass) {
            return; // No change needed
        }

        // Remove old tint class if one was applied
        if (this.tintClass) {
            this.element.classList.remove(this.tintClass);
        }

        // Apply new tint class if one is needed
        if (targetTintClass) {
            this.element.classList.add(targetTintClass);
        }

        // Update cache
        this.tintClass = targetTintClass;
    }
}
