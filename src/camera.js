// camera.js

//import { Vector2D } from './vector2d.js';
//import { GameObject } from './gameObject.js';
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
        this.worldSize = screenSize.divide(zoom);
    }

    /**
     * Updates the camera's position.
     * @param {Vector2D} position - The new position to set.
     */
    update(position) {
        this.position = position.clone();
    }

    /**
     * Resizes the screen and updates the world size accordingly.
     * @param {Vector2D} screenSize - The new screen size.
     */
    resize(screenSizeX, screenSizeY) {
        this.screenSize.x = screenSizeX;
        this.screenSize.y = screenSizeY;
        this.worldSize = this.screenSize.divide(this.zoom);
    }

    /**
     * Sets the zoom level, constrained between 0.5 and 5, and updates world size.
     * @param {number} zoom - The new zoom level.
     */
    setZoom(zoom) {
        this.zoom = Math.max(0.5, Math.min(5, zoom));
        this.worldSize = this.screenSize.divide(this.zoom);
    }

    /**
     * Sets the camera's center position.
     * @param {Vector2D} position - The new center position.
     */
    setCenter(position) {
        this.position = position.clone();
    }

    /**
     * Gets the center of the screen in screen coordinates.
     * @returns {Vector2D} The screen center position.
     */
    getScreenCenter() {
        return this.screenSize.divide(2);
    }

    /**
     * Converts a world position to screen coordinates.
     * @param {Vector2D} position - The position in world coordinates.
     * @returns {Vector2D} The position in screen coordinates.
     */
    worldToScreen(position) {
        const center = this.getScreenCenter();
        const relativePosition = position.subtract(this.position).multiply(this.zoom);
        return center.add(relativePosition);
    }

    /**
     * Converts a world size to a screen size based on zoom.
     * @param {number} size - The size in world coordinates.
     * @returns {number} The size in screen coordinates.
     */
    worldToSize(size) {
        return size * this.zoom;
    }

    /**
     * Converts a world position to camera-relative coordinates.
     * @param {Vector2D} position - The position in world coordinates.
     * @returns {Vector2D} The position relative to the camera.
     */
    worldToCamera(position) {
        return position.subtract(this.position).multiply(this.zoom);
    }

    /**
     * Converts a camera-relative position to screen coordinates.
     * @param {Vector2D} position - The position relative to the camera.
     * @returns {Vector2D} The position in screen coordinates.
     */
    cameraToScreen(position) {
        const center = this.getScreenCenter();
        return center.add(position);
    }

    /**
     * Checks if a position is within the camera's view, with a buffer.
     * @param {Vector2D} position - The position to check in world coordinates.
     * @param {number} size - The size of the object (assumed in world units).
     * @returns {boolean} True if the position is in view, false otherwise.
     */
    isInView(position, size) {
        const screenPos = this.worldToScreen(position);
        const buffer = size * this.zoom * 2; // Buffer scales with zoom
        return (
            screenPos.x + buffer > 0 &&
            screenPos.x - buffer < this.screenSize.width &&
            screenPos.y + buffer > 0 &&
            screenPos.y - buffer < this.screenSize.height
        );
    }
}

/**
 * Represents a camera that follows a target object, typically used for a target view.
 * Extends the base Camera class.
 */
export class TargetCamera extends Camera {
    /**
     * Creates a new TargetCamera instance.
     * @param {Vector2D} position - The initial position of the camera.
     * @param {Vector2D} screenSize - The size of the screen in pixels.
     */
    constructor(position, screenSize) {
        super(position, screenSize, 1);
    }

    /**
     * Updates the camera to follow the target object.
     * @param {GameObject} target - The target GameObject to follow
     */
    updateTarget(target) {
        if (!target) return;
        this.position = target.position.clone();

        const size = target instanceof Ship ? 20 : target.radius || target.size || 10;
        const buffer = size * 2;
        const targetWorldSize = buffer * 2;
        const viewSize = Math.min(this.screenSize.width, this.screenSize.height);
        this.zoom = Math.max(0.5, Math.min(viewSize / targetWorldSize, 5));
    }
}