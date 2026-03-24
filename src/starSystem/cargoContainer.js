// /src/starSystem/cargoContainer.js

import { randomBetween } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';
import { GameObject } from '/src/core/gameObject.js';
import { StarSystem } from '/src/starSystem/starSystem.js';

/**
 * Represents a cargo container floating in space, containing commodities.
 * Extends GameObject for position, velocity, and star system integration.
 * Managed by CargoContainerManager.
 * @extends GameObject
 */
export class CargoContainer extends GameObject {
    /**
     * Creates a new CargoContainer instance.
     * @param {Vector2D} position - Initial world position.
     * @param {Vector2D} velocity - Initial world velocity (randomised slightly).
     * @param {number} angle - Initial rotation angle in radians.
     * @param {number} angularVelocity - Angular velocity in radians per second.
     * @param {string} commodityType - Commodity type key.
     * @param {number} amount - Amount of commodity in tonnes.
     * @param {number} spawnTime - Time of spawn for age calculations.
     * @param {StarSystem} starSystem - The star system this container belongs to.
     */
    constructor(position, velocity, angle, angularVelocity, commodityType, amount, spawnTime, starSystem) {
        super(position, starSystem);
        /** @type {Vector2D} World velocity (inherited from GameObject, randomised here). */
        this.velocity.set(velocity);
        this.velocity.x += randomBetween(-50.0, 50.0);
        this.velocity.y += randomBetween(-50.0, 50.0);
        /** @type {number} Collision/view radius. */
        this.radius = 5.0;
        /** @type {number} Rotation angle in radians. */
        this.angle = angle;
        /** @type {number} Angular velocity (radians per second). */
        this.angularVelocity = angularVelocity;
        /** @type {string} Commodity type key. */
        this.commodityType = commodityType;
        /** @type {number} Amount of commodity (tonnes). */
        this.amount = amount;
        /** @type {number} Spawn time for age calculation. */
        this.spawnTime = spawnTime;

        if (new.target === CargoContainer) Object.seal(this);
    }
}
