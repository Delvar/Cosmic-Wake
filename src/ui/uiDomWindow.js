// /src/ui/uiDomWindow.js

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
 */
export class UiDomWindow {
    /**
     * Creates a new UiDomWindow instance.
     * @param {HTMLElement} element - The DOM element to manage.
     */
    constructor(element) {
        if (this.constructor === UiDomWindow) {
            throw new TypeError('UiDomWindow is an abstract class and cannot be instantiated directly.');
        }

        /** @type {HTMLElement} The DOM element managed by this window. */
        this.element = element;

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
        /** @type {number} Starting right position for resizing. */
        this._startRight = 0.0;
        /** @type {number} Starting top position for resizing. */
        this._startTop = 0.0;
        /** @type {'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | ''} The corner being resized. */
        this._corner = '';

        // Instance properties for dragging
        /** @type {number} Offset X for dragging. */
        this._offsetX = 0.0;
        /** @type {number} Offset Y for dragging. */
        this._offsetY = 0.0;

        this._setupResizing();
        this._setupDragging();
        this._setupVisibility();
    }

    /**
     * Sets up resizing functionality if resize handles are present.
     * @private
     */
    _setupResizing() {
        const handles = this.element.querySelectorAll('.resize-handle');
        if (handles.length === 0) return; // No handles, skip setup

        handles.forEach((handle, number, parent) => {
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
        if (!(e instanceof MouseEvent)) return;
        if (!e.target) return;
        if (!(e.target instanceof HTMLElement)) return;

        e.preventDefault(); // Prevent drag interference
        this._isResizing = true;
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
        const rect = this.element.getBoundingClientRect();
        this._startWidth = rect.width;
        this._startHeight = rect.height;
        this._startRight = window.innerWidth - (rect.right - 2.0); // Account for 2px border
        this._startTop = rect.top - 2.0;
    }

    /**
     * Handles mousemove event during resizing.
     * @param {MouseEvent} e - The mouse event.
     * @private
     */
    _onMouseMove(e) {
        if (!this._isResizing) return;

        const minWidth = 100.0; // Match CSS min-width
        const minHeight = 100.0; // Match CSS min-height
        let newWidth, newHeight, newRight, newTop;

        // Calculate mouse movement (positive deltaX when dragging left)
        const deltaX = this._startX - e.clientX; // Left drag = positive
        const deltaY = this._startY - e.clientY; // Up drag = positive

        if (this._corner === Corner.TOP_LEFT) {
            // Resize left: Increase/decrease width, keep right fixed
            newWidth = Math.max(minWidth, this._startWidth + deltaX);
            newRight = this._startRight; // Right edge stays fixed
            // Resize up: Increase/decrease height, adjust top
            newHeight = Math.max(minHeight, this._startHeight + deltaY);
            newTop = this._startTop - deltaY;
        } else if (this._corner === Corner.TOP_RIGHT) {
            // Resize right: Increase/decrease width, adjust right
            newWidth = Math.max(minWidth, this._startWidth - deltaX);
            newRight = this._startRight + deltaX;
            // Resize up: Increase/decrease height, adjust top
            newHeight = Math.max(minHeight, this._startHeight + deltaY);
            newTop = this._startTop - deltaY;
        } else if (this._corner === Corner.BOTTOM_LEFT) {
            // Resize left: Increase/decrease width, keep right fixed
            newWidth = Math.max(minWidth, this._startWidth + deltaX);
            newRight = this._startRight;
            // Resize down: Increase/decrease height, keep top fixed
            newHeight = Math.max(minHeight, this._startHeight - deltaY);
            newTop = this._startTop;
        } else if (this._corner === Corner.BOTTOM_RIGHT) {
            // Resize right: Increase/decrease width, adjust right
            newWidth = Math.max(minWidth, this._startWidth - deltaX);
            newRight = this._startRight + deltaX;
            // Resize down: Increase/decrease height, keep top fixed
            newHeight = Math.max(minHeight, this._startHeight - deltaY);
            newTop = this._startTop;
        }

        // Update element styles
        this.element.style.width = `${newWidth}px`;
        this.element.style.height = `${newHeight}px`;
        this.element.style.right = `${newRight}px`;
        this.element.style.top = `${newTop}px`;
        this.element.style.left = ''; // Clear conflicting style
        this._onResize();
    }

    /**
     * Called during resizing (on mouse move). Override in subclasses.
     * @protected
     */
    _onResize() {}

    /**
     * Handles mouseup event to end resizing.
     * @private
     */
    _onMouseUp() {
        this._isResizing = false;
        this._onResizeEnd();
    }

    /**
     * Called when resizing ends (on mouse up). Override in subclasses.
     * @protected
     */
    _onResizeEnd() {}

    /**
     * Sets up dragging functionality if the element is draggable.
     * @private
     */
    _setupDragging() {
        if (!this.element.draggable) return; // Not draggable, skip setup

        this.element.addEventListener('dragstart', this._onDragStart.bind(this));
        this.element.addEventListener('drag', this._onDrag.bind(this));
    }

    /**
     * Handles dragstart event.
     * @param {DragEvent} e - The drag event.
     * @private
     */
    _onDragStart(e) {
        this._offsetX = e.offsetX;
        this._offsetY = e.offsetY;
    }

    /**
     * Handles drag event.
     * @param {DragEvent} e - The drag event.
     * @private
     */
    _onDrag(e) {
        if (e.clientX > 0.0 && e.clientY > 0.0) {
            this.element.style.left = `${e.clientX - this._offsetX}px`;
            this.element.style.top = `${e.clientY - this._offsetY}px`;
        }
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
     */
    show() {
        this.element.classList.remove('hidden');
    }

    /**
     * Hides the UI window.
     */
    hide() {
        this.element.classList.add('hidden');
    }
}
