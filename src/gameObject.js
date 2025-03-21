// gameObject.js

import { Vector2D } from './vector2d.js';

/**
 * Represents a base game object with position and despawn functionality.
 */
export class GameObject {
    /**
     * Creates a new GameObject instance.
     * @param {Vector2D} position - The position of the object in world coordinates.
     * @param {StarSystem} starSystem - The star system the object belongs to.
     */
    constructor(position, starSystem) {
        this.position = new Vector2D(0, 0);
        this.position.set(position);
        this.starSystem = starSystem;
        this.despawned = false;
        this.debug = false;
    }

    /**
     * Marks the object as despawned, removing it from active gameplay.
     */
    despawn() {
        this.despawned = true;
    }

    /**
     * Checks if the object has been despawned.
     * @returns {boolean} True if the object is despawned, false otherwise.
     */
    isDespawned() {
        return this.despawned;
    }
}