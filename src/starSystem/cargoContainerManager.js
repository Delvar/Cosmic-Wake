// /src/starSystem/cargoContainerManager.js

import { Vector2D } from '/src/core/vector2d.js';
import { CargoContainer } from './cargoContainer.js';
import { TWO_PI, randomBetween, remapClamp, normalizeAngle, removeObjectFromArrayInPlace } from '/src/core/utils.js';
import { StarSystem } from './starSystem.js';
import { Camera } from '/src/camera/camera.js';
import { Colour } from '/src/core/colour.js';
import { Ship } from '/src/ship/ship.js';

/**
 * Manages active cargo containers in a star system, handling updates, rendering, and lifecycle.
 */
export class CargoContainerManager {
    /**
     * @param {StarSystem} starSystem - The parent star system.
     */
    constructor(starSystem) {
        /** @type {StarSystem} */
        this.starSystem = starSystem;
        /** @type {CargoContainer[]} */
        this.cargoContainers = [];
        /** @type {number} Accumulated time. */
        this.currentTime = 0.0;

        /** @type {number} World-space radius of cargo beacon light. */
        this.lightRadius = 20;
        /** @type {number} World-space size of cargo container box. */
        this.containerSize = 5;

        /** @type {Colour} Outer colour for cargo beacon light (green). */
        this.lightOuterColour = new Colour(0.0, 1.0, 0.0);
        /** @type {Colour} Inner colour for cargo beacon light (white). */
        this.lightInnerColour = new Colour(1.0, 1.0, 1.0);
        /** @type {Colour} Colour for rendering cargo containers. */
        this.containerColour = Colour.Grey;

        /** @type {Vector2D} Scratch for screen pos. */
        this._scratchScreenPos = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch for delta pos. */
        this._scratchDeltaPos = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch for local position in ship's space. */
        this._scratchLocalPos = new Vector2D(0.0, 0.0);

        if (new.target === CargoContainerManager) Object.seal(this);
    }

    /**
     * Spawns a cargo container.
     * @param {Vector2D} position
     * @param {Vector2D} velocity
     * @param {string} commodityType
     * @param {number} amount
     */
    spawn(position, velocity, commodityType, amount) {
        if (this.cargoContainers.length >= 1000.0) {
            console.warn('Cargo container limit reached');
            return;
        }

        const angle = randomBetween(0.0, TWO_PI);
        const angularVelocity = randomBetween(-Math.PI, Math.PI);
        const container = new CargoContainer(position, velocity, angle, angularVelocity, commodityType, amount, this.currentTime, this.starSystem);
        this.cargoContainers.push(container);
    }

    /**
     * Gets the closest cargo container with amount > 0 to the ship.
     * @param {Ship} ship - The ship to find closest container for.
     * @returns {CargoContainer|null} The closest container or null if none.
     */
    getClosestContainer(ship) {
        let closest = null;
        let minDistSq = Infinity;
        for (const c of this.cargoContainers) {
            if (c.amount <= 0) continue;
            const distSq = ship.position.distanceSquaredTo(c.position);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest = c;
            }
        }
        return closest;
    }

    /**
     * Gets a list of cargo containers overlapping with the ship.
     * @param {Ship} ship - The ship to check overlaps for.
     * @returns {CargoContainer[]} Array of overlapping containers.
     */
    getOverlappingContainers(ship) {
        const overlapping = [];
        for (const container of this.cargoContainers) {
            const distSq = ship.position.distanceSquaredTo(container.position);
            const combinedRadius = ship.radius + container.radius;
            if (distSq > combinedRadius * combinedRadius) {
                continue; // Too far, skip
            }

            // Check rotated bounding box for precise collision
            this._scratchLocalPos.set(container.position).subtractInPlace(ship.position);
            const cosAngle = Math.cos(-ship.angle);
            const sinAngle = Math.sin(-ship.angle);
            const localX = this._scratchLocalPos.x * cosAngle - this._scratchLocalPos.y * sinAngle;
            const localY = this._scratchLocalPos.x * sinAngle + this._scratchLocalPos.y * cosAngle;
            // Check if point is within bounding box
            const halfWidth = ship.boundingBox.x * 0.5;
            const halfHeight = ship.boundingBox.y * 0.5;
            if (Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight) {
                overlapping.push(container);
            }
        }
        return overlapping;
    }

    /**
     * Attempts to pick up a specified amount from a cargo container.
     * Deducts the amount from the container and despawns it if empty.
     * @param {CargoContainer} container - The container to pick up from.
     * @param {number} amount - The amount to deduct.
     * @returns {boolean} True if pickup was successful, false otherwise.
     */
    pickupFromContainer(container, amount) {
        if (!this.cargoContainers.includes(container) || amount <= 0) {
            return false;
        }
        const actualAmount = Math.min(amount, container.amount);
        container.amount -= actualAmount;
        if (container.amount <= 0) {
            // Despawn empty container
            container.despawn();
        }
        return true;
    }

    /**
     * Removes a cargo container from the manager's list.
     * @param {CargoContainer} container - The container to remove.
     */
    removeCargoContainer(container) {
        removeObjectFromArrayInPlace(container, this.cargoContainers);
    }

    /**
     * Updates positions, applies drag and rotation.
     * @param {number} deltaTime
     */
    update(deltaTime) {
        this.currentTime += deltaTime;
        for (let i = this.cargoContainers.length - 1; i >= 0; i--) {
            const c = this.cargoContainers[i];
            c.angle = normalizeAngle(c.angle + c.angularVelocity * deltaTime);

            const speed = c.velocity.magnitude();
            if (speed < 1.0) {
                c.velocity.set(0.0, 0.0);
            } else {
                c.velocity.multiplyInPlace(1.0 - 0.1 * deltaTime);
            }

            this._scratchDeltaPos.set(c.velocity).multiplyInPlace(deltaTime);
            c.position.addInPlace(this._scratchDeltaPos);
        }
    }

    /**
     * Renders visible cargo containers and beacon lights.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    draw(ctx, camera) {
        ctx.save();

        for (const c of this.cargoContainers) {
            if (!camera.isInView(c.position, c.radius)) continue;

            camera.worldToScreen(c.position, this._scratchScreenPos);

            const age = this.currentTime - c.spawnTime;
            const period = 4.0;
            const cycle = age % period;
            let brightness = 0.0;
            if (cycle > 2.0) {
                if (cycle < 2.1) {
                    brightness = remapClamp(cycle - 2.0, 0.0, 0.1, 0.0, 1.0);
                } else {
                    brightness = remapClamp(cycle - 2.1, 0.0, 1.9, 1.0, 0.0);
                }
            }

            // Container
            ctx.save();
            ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.rotate(c.angle);
            const size = camera.worldToSize(this.containerSize);
            ctx.fillStyle = this.containerColour.toRGB();
            ctx.fillRect(-size / 2, -size / 2, size, size);

            // Beacon
            if (brightness > 0.0) {
                const lightRadiusScreen = camera.worldToSize(this.lightRadius);
                ctx.globalCompositeOperation = 'lighter';
                const gradient = ctx.createRadialGradient(
                    0.0, 0.0, 0.0,
                    0.0, 0.0, lightRadiusScreen
                );
                gradient.addColorStop(0.0, this.lightInnerColour.toRGBA(brightness * 0.75));
                gradient.addColorStop(0.05, this.lightInnerColour.toRGBA(brightness * 0.5));
                gradient.addColorStop(0.2, this.lightOuterColour.toRGBA(brightness * 0.25));
                gradient.addColorStop(1.0, this.lightOuterColour.toRGBA(0.0));
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0.0, 0.0, lightRadiusScreen, 0.0, TWO_PI);
                ctx.fill();
            }
            ctx.restore();
        }

        ctx.restore();
    }

    /**
     * Clears all cargo.
     */
    clear() {
        this.cargoContainers.length = 0;
        this.currentTime = 0.0;
    }
}
