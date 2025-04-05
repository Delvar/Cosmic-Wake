// camera.js

import { Vector2D } from './vector2d.js';
import { Ship } from './ship.js';

/**
 * Represents a camera that handles rendering and coordinate transformations in a 2D space.
 */
export class Camera {
    /**
     * Creates a new Camera instance.
     * @param {Vector2D} position - The initial position of the camera in world coordinates.
     * @param {Vector2D} screenSize - The size of the screen in pixels.
     * @param {number} [zoom=1] - The initial zoom level (default is 1).
     */
    constructor(position, screenSize, zoom = 1) {
        this.debug = false;
        // Clone position and screenSize to ensure they aren't modified externally
        this.position = position.clone();
        this.screenSize = screenSize.clone();
        this.zoom = zoom;
        this.zoomReciprocal = 1 / zoom; // Precompute reciprocal for faster division
        this.worldSize = new Vector2D(screenSize.x * this.zoomReciprocal, screenSize.y * this.zoomReciprocal);
        // Precompute screen center
        this.screenCenter = new Vector2D(screenSize.x / 2, screenSize.y / 2);
        // Initialize worldBounds object once to avoid allocations in _updateWorldBounds
        this.worldBounds = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        };
        this._updateWorldBounds(); // Set initial bounds

        // Temporary scratch values to avoid allocations
        this._scratchRelativePosition = new Vector2D(); // For world-to-screen relative position
    }

    /**
     * Updates the camera's position to follow a target.
     * @param {Vector2D} position - The new position to set in world coordinates.
     */
    update(position) {
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
        this.screenCenter.set(screenSizeX / 2, screenSizeY / 2); // Update cached screen center
        this.worldSize.set(screenSizeX * this.zoomReciprocal, screenSizeY * this.zoomReciprocal);
        this._updateWorldBounds(); // Update world-space bounds
    }

    /**
     * Sets the zoom level, constrained between 0.5 and 5, and updates world size.
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
     * @private
     */
    _updateWorldBounds() {
        const halfWidth = this.worldSize.width / 2;
        const halfHeight = this.worldSize.height / 2;
        // Update existing worldBounds fields instead of creating a new object
        this.worldBounds.left = this.position.x - halfWidth;
        this.worldBounds.right = this.position.x + halfWidth;
        this.worldBounds.top = this.position.y - halfHeight;
        this.worldBounds.bottom = this.position.y + halfHeight;
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
        const buffer = size * 2; // Double the size for a conservative buffer
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
    isBoxInView(min, max, buffer = 0) {
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
}

/**
 * Represents a camera that follows a target object, typically used for a target view.
 * Extends the base Camera class.
 * @extends Camera
 */
export class TargetCamera extends Camera {
    /**
     * Creates a new TargetCamera instance.
     * @param {Vector2D} position - The initial position of the camera in world coordinates.
     * @param {Vector2D} screenSize - The size of the screen in pixels.
     */
    constructor(position, screenSize) {
        super(position, screenSize, 1);
        this.lastTargetSize = null; // Cache for target size to avoid recomputing zoom
        this.lastZoom = this.zoom; // Cache for zoom to detect changes
    }

    /**
     * Updates the camera to follow the target object and adjusts zoom based on target size.
     * @param {GameObject} target - The target GameObject to follow, or null to do nothing.
     */
    updateTarget(target) {
        if (!target) return;
        this.position.set(target.position); // Reuse position vector
        let size = 10;
        // Compute target size and check if it has changed
        if (target instanceof Ship) {
            size = Math.max(target.boundingBox.width, target.boundingBox.height) * 0.5;
        } else {
            size = target.radius || target.size;
        }

        if (size !== this.lastTargetSize) {
            // Adjust zoom calculation to ensure the target fits comfortably on screen
            const targetWorldSize = size * 4; // Simplified: Use diameter * 2 for buffer
            const viewSize = Math.min(this.screenSize.width, this.screenSize.height);
            const newZoom = Math.max(0.5, Math.min((viewSize * 0.8) / targetWorldSize, 5)); // 0.8 to leave some padding
            if (newZoom !== this.lastZoom) {
                this.setZoom(newZoom); // Only update zoom if it has changed
                this.lastZoom = newZoom;
            }
            this.lastTargetSize = size;
        }

        // Update world bounds after position change
        this._updateWorldBounds();
    }
}