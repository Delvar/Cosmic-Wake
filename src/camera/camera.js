// /src/camera/camera.js

import { Vector2D } from '/src/core/vector2d.js';
import { normalizeAngle, TWO_PI } from '/src/core/utils.js';
import { StarSystem } from '/src/starSystem/starSystem.js';
import { GameObject } from '/src/core/gameObject.js';

/**
 * Represents a camera that handles rendering and coordinate transformations in a 2D space.
 */
export class Camera {
    /**
     * Creates a new Camera instance.
     * @param {HTMLCanvasElement} foregroundCanvas - The main canvas for rendering ships etc.
     * @param {HTMLCanvasElement} backgroundCanvas - The background canvas for rendering starfield.
     * @param {HTMLCanvasElement} [hudCanvas=null] - The canvas for rendering the HUD (optional).
     * @param {number} [zoom=1] - The initial zoom level (default is  1.0).
     */
    constructor(foregroundCanvas, backgroundCanvas, hudCanvas = null, zoom = 1.0) {
        /** @type {boolean} Enables or disables debug mode for the camera. */
        this.debug = false;
        /** @type {StarSystem|null} The star system the camera is currently viewing. */
        this.starSystem = null;
        /** @type {Vector2D} The position of the camera in world coordinates. */
        this.position = new Vector2D(0.0, 0.0);

        /** @type {HTMLCanvasElement} The main canvas for rendering. */
        this.foregroundCanvas = foregroundCanvas;
        /** @type {CanvasRenderingContext2D} The 2D rendering context for the main canvas. */
        this.foregroundCtx = this.foregroundCanvas.getContext('2d');

        /** @type {HTMLCanvasElement} The main canvas for rendering. */
        this.backgroundCanvas = backgroundCanvas;
        /** @type {CanvasRenderingContext2D} The 2D rendering context for the main canvas. */
        this.backgroundCtx = this.backgroundCanvas.getContext('2d', { alpha: false });

        /** @type {HTMLCanvasElement} The canvas for rendering the HUD. */
        this.hudCanvas = hudCanvas;
        /** @type {CanvasRenderingContext2D} The 2D rendering context for the HUD canvas. */
        this.hudCtx = this.hudCanvas ? this.hudCanvas.getContext('2d') : null;

        /** @type {Vector2D} The size of the screen in pixels. */
        this.screenSize = new Vector2D(0.0, 0.0);
        /** @type {number} The current zoom level of the camera. */
        this.zoom = zoom;
        /** @type {number} The reciprocal of the zoom level for faster calculations. */
        this.zoomReciprocal = 1 / zoom;
        /** @type {Vector2D} The size of the world view in world coordinates, based on screen size and zoom. */
        this.worldSize = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} The center of the screen in pixels. */
        this.screenCenter = new Vector2D(0.0, 0.0);
        /** @type {Object} The bounds of the camera's view in world coordinates, with angles for visibility. */
        this.worldBounds = {
            /** @type {number} The left boundary of the camera's view in world coordinates. */
            left: 0.0,
            /** @type {number} The right boundary of the camera's view in world coordinates. */
            right: 0.0,
            /** @type {number} The top boundary of the camera's view in world coordinates. */
            top: 0.0,
            /** @type {number} The bottom boundary of the camera's view in world coordinates. */
            bottom: 0.0,
            /** @type {number} The minimum angle of the camera's view corners. */
            minAngle: 0.0,
            /** @type {number} The maximum angle of the camera's view corners. */
            maxAngle: 0.0
        };
        // Set initial bounds
        this._updateWorldBounds();

        // Temporary scratch values to avoid allocations
        /** @type {Vector2D} Scratch vector for world-to-screen relative position calculations. */
        this._scratchRelativePosition = new Vector2D();
        /** @type {Vector2D} Scratch vector for minimum cell visibility calculations. */
        this._scratchMin = new Vector2D();
        /** @type {Vector2D} Scratch vector for maximum cell visibility calculations. */
        this._scratchMax = new Vector2D();

        if (new.target === Camera) Object.seal(this);
    }

    /**
     * Updates the camera's position to follow a target.
     * @param {StarSystem} starSystem - The initial starSystem.
     * @param {Vector2D} position - The new position to set in world coordinates.
     */
    update(starSystem, position) {
        if (!starSystem) {
            throw new Error('No starSystem on camera');
        }
        this.starSystem = starSystem;
        this.position.set(position); // Reuse position vector
        this._updateWorldBounds(); // Update world-space bounds
    }

    /**
     * Resizes the screen and updates the world size and screen center.
     * @param {number} screenSizeX - The new screen width in pixels.
     * @param {number} screenSizeY - The new screen height in pixels.
     */
    resize(screenSizeX, screenSizeY) {
        this.screenSize.set(screenSizeX, screenSizeY);
        this.screenCenter.set(screenSizeX / 2.0, screenSizeY / 2.0); // Update cached screen center
        this.worldSize.set(screenSizeX * this.zoomReciprocal, screenSizeY * this.zoomReciprocal);

        this.foregroundCanvas.width = screenSizeX;
        this.foregroundCanvas.height = screenSizeY;
        this.backgroundCanvas.width = screenSizeX;
        this.backgroundCanvas.height = screenSizeY;
        this.foregroundCtx.font = 'bolder 16px "Century Gothic Paneuropean", "Century Gothic", "CenturyGothic", "AppleGothic", sans-serif';

        if (this.hudCanvas) {
            this.hudCanvas.width = screenSizeX;
            this.hudCanvas.height = screenSizeY;
            this.hudCtx.font = 'bolder 16px "Century Gothic Paneuropean", "Century Gothic", "CenturyGothic", "AppleGothic", sans-serif';
        }

        this._updateWorldBounds(); // Update world-space bounds
    }

    /**
     * Sets the zoom level, constrained between 0.5 and 5.0, and updates world size.
     * @param {number} zoom - The new zoom level.
     */
    setZoom(zoom) {
        this.zoom = Math.max(0.5, Math.min(5, zoom));
        this.zoomReciprocal = 1 / this.zoom; // Update reciprocal
        this.worldSize.set(this.screenSize.x * this.zoomReciprocal, this.screenSize.y * this.zoomReciprocal);
        this._updateWorldBounds(); // Update world-space bounds
    }

    /**
     * Sets the camera's center position.
     * @param {Vector2D} position - The new center position in world coordinates.
     */
    setCenter(position) {
        this.position.set(position); // Reuse position vector
        this._updateWorldBounds(); // Update world-space bounds
    }

    /**
     * Updates the world-space bounds for visibility checks without allocation.
     */
    _updateWorldBounds() {
        const halfWidth = this.worldSize.width / 2.0;
        const halfHeight = this.worldSize.height / 2.0;
        // Update existing worldBounds fields instead of creating a new object
        this.worldBounds.left = this.position.x - halfWidth;
        this.worldBounds.right = this.position.x + halfWidth;
        this.worldBounds.top = this.position.y - halfHeight;
        this.worldBounds.bottom = this.position.y + halfHeight;

        // Cache camera corner angles for cell visibility
        // Compute center angle from camera position
        const centerAngle = (Math.atan2(this.position.x, -this.position.y));
        let minDelta = Infinity;
        let maxDelta = -Infinity;

        // Compute delta angles for each corner relative to center
        let angle = Math.atan2(this.worldBounds.left, -this.worldBounds.top);
        let delta = normalizeAngle(angle - centerAngle);
        minDelta = Math.min(minDelta, delta);
        maxDelta = Math.max(maxDelta, delta);

        angle = Math.atan2(this.worldBounds.right, -this.worldBounds.top);
        delta = normalizeAngle(angle - centerAngle);
        minDelta = Math.min(minDelta, delta);
        maxDelta = Math.max(maxDelta, delta);

        angle = Math.atan2(this.worldBounds.left, -this.worldBounds.bottom);
        delta = normalizeAngle(angle - centerAngle);
        minDelta = Math.min(minDelta, delta);
        maxDelta = Math.max(maxDelta, delta);

        angle = Math.atan2(this.worldBounds.right, -this.worldBounds.bottom);
        delta = normalizeAngle(angle - centerAngle);
        minDelta = Math.min(minDelta, delta);
        maxDelta = Math.max(maxDelta, delta);

        // Compute final min/max angles by adding center angle back
        this.worldBounds.minAngle = normalizeAngle(centerAngle + minDelta);
        this.worldBounds.maxAngle = normalizeAngle(centerAngle + maxDelta);
    }


    /**
     * Converts a world position to screen coordinates, modifying the provided output vector.
     * @param {Vector2D} position - The position in world coordinates.
     * @param {Vector2D} out - The vector to store the result in.
     * @returns {Vector2D} The position in screen coordinates (pixels), stored in out.
     */
    worldToScreen(position, out) {
        // Combine operations into a single set for clarity and efficiency
        const relX = (position.x - this.position.x) * this.zoom;
        const relY = (position.y - this.position.y) * this.zoom;
        return out.set(this.screenCenter.x + relX, this.screenCenter.y + relY);
    }

    /**
     * Converts a world size to a screen size based on zoom.
     * @param {number} size - The size in world coordinates.
     * @returns {number} The size in screen coordinates (pixels).
     */
    worldToSize(size) {
        return size * this.zoom;
    }

    /**
     * Converts a world position to camera-relative coordinates, modifying the provided output vector.
     * @param {Vector2D} position - The position in world coordinates.
     * @param {Vector2D} out - The vector to store the result in.
     * @returns {Vector2D} The position relative to the camera in zoomed world units, stored in out.
     */
    worldToCamera(position, out) {
        // Combine operations into a single set
        return out.set(
            (position.x - this.position.x) * this.zoom,
            (position.y - this.position.y) * this.zoom
        );
    }

    /**
     * Converts a camera-relative position to screen coordinates, modifying the provided output vector.
     * @param {Vector2D} position - The position relative to the camera in zoomed world units.
     * @param {Vector2D} out - The vector to store the result in.
     * @returns {Vector2D} The position in screen coordinates (pixels), stored in out.
     */
    cameraToScreen(position, out) {
        return out.set(this.screenCenter.x + position.x, this.screenCenter.y + position.y);
    }

    /**
     * Checks if a position is within the camera's view, with a buffer, directly in world space.
     * @param {Vector2D} position - The position to check in world coordinates.
     * @param {number} size - The size of the object in world units.
     * @returns {boolean} True if the position is in view, false otherwise.
     */
    isInView(position, size) {
        // Use precomputed world-space bounds
        const buffer = size * 2.0; // Double the size for a conservative buffer
        return (
            position.x + buffer > this.worldBounds.left &&
            position.x - buffer < this.worldBounds.right &&
            position.y + buffer > this.worldBounds.top &&
            position.y - buffer < this.worldBounds.bottom
        );
    }

    /**
     * Checks if a bounding box defined by two Vector2D points intersects with the camera's view.
     * @param {Vector2D} min - The minimum corner of the bounding box (minX, minY) in world space.
     * @param {Vector2D} max - The maximum corner of the bounding box (maxX, maxY) in world space.
     * @param {number} [buffer=0] - An optional buffer to expand the bounding box (e.g., to account for object width).
     * @returns {boolean} True if the bounding box intersects the camera's view, false otherwise.
     */
    isBoxInView(min, max, buffer = 0.0) {
        // Expand the bounding box by the buffer
        const minX = min.x - buffer;
        const minY = min.y - buffer;
        const maxX = max.x + buffer;
        const maxY = max.y + buffer;

        // Check for intersection with the camera's world bounds
        return !(
            maxX < this.worldBounds.left ||  // Box is completely to the left of the viewport
            minX > this.worldBounds.right || // Box is completely to the right of the viewport
            maxY < this.worldBounds.top ||   // Box is completely above the viewport
            minY > this.worldBounds.bottom   // Box is completely below the viewport
        );
    }

    /**
     * Checks if a polar cell (defined by angle range) intersects the camera’s view.
     * Assumes isBeltOffScreen has confirmed radius overlap. Angles normalized to [-π, π] with 0.0 upward.
     * @param {number} fromAngle - Start angle of the cell in radians.
     * @param {number} toAngle - End angle of the cell in radians.
     * @returns {boolean} True if the cell is in view, false otherwise.
     */
    isCellInView(fromAngle, toAngle) {
        // Compute normalized angle deltas
        let deltaToMin = normalizeAngle(toAngle - this.worldBounds.minAngle);
        let deltaFromMax = normalizeAngle(fromAngle - this.worldBounds.maxAngle);
        return (deltaToMin > 0.0 && deltaFromMax < 0.0);
    }
}

/**
 * Represents a camera that follows a target object, typically used for a target view.
 * @extends Camera
 */
export class TargetCamera extends Camera {
    /**
     * Creates a new TargetCamera instance.
     * @param {HTMLCanvasElement} foregroundCanvas - The main canvas for rendering ships etc.
     * @param {HTMLCanvasElement} backgroundCanvas - The background canvas for rendering starfield.
     * @param {HTMLCanvasElement} hudCanvas - The canvas for rendering the HUD.
     * @param {number} [zoom=1] - The initial zoom level (default is  1.0).
     */
    constructor(foregroundCanvas, backgroundCanvas, hudCanvas, zoom = 1.0) {
        super(foregroundCanvas, backgroundCanvas, hudCanvas, zoom);
        /** @type {number} Cache for the last target size to avoid recomputing zoom. */
        this.lastTargetSize = null;
        /** @type {number} Cache for the last zoom level to detect changes. */
        this.lastZoom = this.zoom;

        if (new.target === TargetCamera) Object.seal(this);
    }

    /**
     * Resizes the screen and updates the world size and screen center.
     * @param {number} screenSizeX - The new screen width in pixels.
     * @param {number} screenSizeY - The new screen height in pixels.
     */
    resize(screenSizeX, screenSizeY) {
        super.resize(screenSizeX, screenSizeY);
        // Adjust zoom calculation to ensure the target fits comfortably on screen
        const targetWorldSize = this.lastTargetSize * 4.0;
        const viewSize = Math.min(this.screenSize.width, this.screenSize.height);
        const newZoom = Math.max(0.5, Math.min((viewSize * 0.8) / targetWorldSize, 5.0));
        if (newZoom !== this.lastZoom) {
            this.setZoom(newZoom);
            this.lastZoom = newZoom;
        }
    }

    /**
     * Updates the camera to follow the target object and adjusts zoom based on target size.
     * @param {GameObject} target - The target GameObject to follow, or null to do nothing.
     */
    updateTarget(target) {
        if (!target || !target.position) return;
        this.position.set(target.position);
        this.starSystem = target.starSystem;
        let size = 10.0;
        // Compute target size and check if it has changed
        size = target.radius;

        if (this.lastTargetSize == null || size !== this.lastTargetSize) {
            // Adjust zoom calculation to ensure the target fits comfortably on screen
            const targetWorldSize = size * 4.0;
            const viewSize = Math.min(this.screenSize.width, this.screenSize.height);
            const newZoom = Math.max(0.5, Math.min((viewSize * 0.8) / targetWorldSize, 5.0));
            if (newZoom !== this.lastZoom) {
                this.setZoom(newZoom);
                this.lastZoom = newZoom;
            }
            this.lastTargetSize = size;
        }

        // Update world bounds after position change
        this._updateWorldBounds();
    }
}