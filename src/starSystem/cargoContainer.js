// /src/starSystem/cargoContainer.js

import { randomBetween } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';

/**
 * Lightweight data holder for a cargo container.
 * Managed by CargoManager.
 */
export class CargoContainer {
    constructor() {
        /** @type {Vector2D} World position. */
        this.position = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} World velocity. */
        this.velocity = new Vector2D(0.0, 0.0);
        /** @type {number} Rotation angle in radians. */
        this.angle = 0.0;
        /** @type {number} Angular velocity (radians per second). */
        this.angularVelocity = 0.0;
        /** @type {string} Commodity type key. */
        this.commodityType = '';
        /** @type {number} Amount of commodity (tonnes). */
        this.amount = 0.0;
        /** @type {number} Spawn time for age calculation. */
        this.spawnTime = 0.0;
        /** @type {number} Collision/view radius. */
        this.radius = 5.0;
    }

    /**
     * Resets for reuse.
     */
    reset(position, velocity, angle, angularVelocity, commodityType, amount, spawnTime) {
        this.position.set(position);
        this.velocity.set(velocity);
        this.velocity.x += randomBetween(-50.0, 50.0);
        this.velocity.y += randomBetween(-50.0, 50.0);
        this.angle = angle;
        this.angularVelocity = angularVelocity;
        this.commodityType = commodityType;
        this.amount = amount;
        this.spawnTime = spawnTime;
    }
}
