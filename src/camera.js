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
        this.position = position.clone();
        this.zoom = zoom;
        this.screenSize = screenSize.clone();
        this.worldSize = screenSize.clone().divideInPlace(zoom); // Use in-place to avoid allocation

        // Temporary scratch values to avoid allocations
        this._scratchScreenCenter = new Vector2D(); // For getScreenCenter calculations
        this._scratchRelativePosition = new Vector2D(); // For world-to-screen relative position
    }

    /**
     * Updates the camera's position to follow a target.
     * @param {Vector2D} position - The new position to set in world coordinates.
     */
    update(position) {
        this.position.set(position); // Reuse position vector
    }

    /**
     * Resizes the screen and updates the world size accordingly.
     * @param {number} screenSizeX - The new screen width in pixels.
     * @param {number} screenSizeY - The new screen height in pixels.
     */
    resize(screenSizeX, screenSizeY) {
        this.screenSize.set(screenSizeX, screenSizeY);
        this.worldSize.set(this.screenSize).divideInPlace(this.zoom); // Reuse worldSize
    }

    /**
     * Sets the zoom level, constrained between 0.5 and 5, and updates world size.
     * @param {number} zoom - The new zoom level.
     */
    setZoom(zoom) {
        this.zoom = Math.max(0.5, Math.min(5, zoom));
        this.worldSize.set(this.screenSize).divideInPlace(this.zoom); // Reuse worldSize
    }

    /**
     * Sets the camera's center position.
     * @param {Vector2D} position - The new center position in world coordinates.
     */
    setCenter(position) {
        this.position.set(position); // Reuse position vector
    }

    /**
     * Gets the center of the screen in screen coordinates, modifying the provided output vector.
     * @param {Vector2D} out - The vector to store the screen center position in pixels.
     * @returns {Vector2D} The modified output vector with screen center coordinates.
     */
    getScreenCenter(out) {
        return out.set(this.screenSize).divideInPlace(2);
    }

    /**
     * Converts a world position to screen coordinates, modifying the provided output vector.
     * @param {Vector2D} position - The position in world coordinates.
     * @param {Vector2D} out - The vector to store the result in.
     * @returns {Vector2D} The position in screen coordinates (pixels), stored in out.
     */
    worldToScreen(position, out) {
        this.getScreenCenter(this._scratchScreenCenter); // Use scratch for center
        this._scratchRelativePosition.set(position)
            .subtractInPlace(this.position)
            .multiplyInPlace(this.zoom); // Compute relative position in-place
        return out.set(this._scratchScreenCenter)
            .addInPlace(this._scratchRelativePosition); // Combine in output
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
        return out.set(position)
            .subtractInPlace(this.position)
            .multiplyInPlace(this.zoom);
    }

    /**
     * Converts a camera-relative position to screen coordinates, modifying the provided output vector.
     * @param {Vector2D} position - The position relative to the camera in zoomed world units.
     * @param {Vector2D} out - The vector to store the result in.
     * @returns {Vector2D} The position in screen coordinates (pixels), stored in out.
     */
    cameraToScreen(position, out) {
        this.getScreenCenter(this._scratchScreenCenter);
        return out.set(this._scratchScreenCenter)
            .addInPlace(position);
    }

    /**
     * Checks if a position is within the camera's view, with a buffer.
     * @param {Vector2D} position - The position to check in world coordinates.
     * @param {number} size - The size of the object in world units.
     * @returns {boolean} True if the position is in view, false otherwise.
     */
    isInView(position, size) {
        this.worldToScreen(position, this._scratchRelativePosition); // Reuse scratch as temp storage
        const buffer = size * this.zoom * 2; // Buffer scales with zoom
        return (
            this._scratchRelativePosition.x + buffer > 0 &&
            this._scratchRelativePosition.x - buffer < this.screenSize.width &&
            this._scratchRelativePosition.y + buffer > 0 &&
            this._scratchRelativePosition.y - buffer < this.screenSize.height
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
    }

    /**
     * Updates the camera to follow the target object and adjusts zoom based on target size.
     * @param {GameObject} target - The target GameObject to follow, or null to do nothing.
     */
    updateTarget(target) {
        if (!target) return;
        this.position.set(target.position); // Reuse position vector

        const size = target instanceof Ship ? 20 : target.radius || target.size || 10;
        const buffer = size * 2;
        const targetWorldSize = buffer * 2;
        const viewSize = Math.min(this.screenSize.width, this.screenSize.height);
        this.zoom = Math.max(0.5, Math.min(viewSize / targetWorldSize, 5));
        this.worldSize.set(this.screenSize).divideInPlace(this.zoom); // Update worldSize in-place
    }
}