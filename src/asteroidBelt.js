// asteroidBelt.js

import { Vector2D } from './vector2d.js';
import { TWO_PI, remapRange01 } from './utils.js';
import { GameObject, isValidTarget } from './gameObject.js';
import { removeObjectFromArrayInPlace } from './utils.js';

/**
 * A precomputed asteroid shape, stored as a Float32Array of [x1, y1, x2, y2, ...].
 */
class AsteroidShape {
    /**
     * @param {number} numPoints - Number of points in the shape.
     */
    constructor(numPoints) {
        this.numPoints = numPoints;
        this.points = new Float32Array(numPoints * 2); // [x1, y1, x2, y2, ...]
        const angleStep = (Math.PI * 2) / numPoints;
        let centerPoint = new Vector2D(0, 0);
        for (let i = 0; i < numPoints; i++) {
            const angle = i * angleStep + (Math.random() - 0.5) * 0.5;
            const radius = 0.5 + Math.random() * 0.5; // Between 0.5 and 1
            this.points[i * 2] = Math.sin(angle) * radius;
            this.points[i * 2 + 1] = -Math.cos(angle) * radius;
            centerPoint.x += this.points[i * 2];
            centerPoint.y += this.points[i * 2 + 1];
        }

        //recenter the asteroid if one side sticks out too far
        centerPoint.divideInPlace(numPoints);
        for (let i = 0; i < numPoints; i++) {
            this.points[i * 2] -= centerPoint.x;
            this.points[i * 2 + 1] -= centerPoint.y;
        }
    }
}

/**
 * Manages a collection of asteroids forming a belt in a star system.
 */
export class AsteroidBelt {
    /**
     * Creates a new AsteroidBelt instance.
     * @param {number} innerRadius - Inner radius of the asteroid belt in world units.
     * @param {number} outerRadius - Outer radius of the asteroid belt in world units.
     * @param {number} backgroundCount - Number of background (non-interactive) asteroids.
     * @param {number} interactiveCount - Number of interactive asteroids.
     */
    constructor(innerRadius, outerRadius, backgroundCount, interactiveCount) {
        this.starSystem = null;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.backgroundCount = backgroundCount;
        this.interactiveCount = interactiveCount;
        this.interactiveAsteroids = [];
        this.backgroundAsteroids = [];

        // Precompute asteroid shapes (tunable number of shapes)
        this.shapeCount = 20;
        this.shapes = new Array(this.shapeCount);
        for (let i = 0; i < this.shapeCount; i++) {
            const numPoints = 5 + Math.floor(Math.random() * 4); // 5 to 8 points
            this.shapes[i] = new AsteroidShape(numPoints);
        }

        // Temporary scratch values to avoid allocations
        this._scratchWorldPos = new Vector2D();
        this._scratchScreenPos = new Vector2D();
        this.elapsedTime = 0;
    }

    init() {
        if (!this.starSystem) {
            console.warn('no star system on asteroiid belt init', this);
        }
        // Background asteroids stored in a Float32Array
        // Each asteroid: [shapeIndex, size, spinSpeed, orbitalDistance, orbitalSpeed, orbitalOffset]
        this.backgroundAsteroids = new Float32Array(this.backgroundCount * 6);
        for (let i = 0; i < this.backgroundCount; i++) {
            const idx = i * 6;
            const radius = remapRange01(Math.random(), this.innerRadius, this.outerRadius);
            const size = remapRange01(Math.random(), 2, 20);
            const spinSpeed = remapRange01(Math.random(), -TWO_PI, TWO_PI);
            const orbitSpeed = remapRange01(Math.random(), Math.PI * 0.001, Math.PI * 0.006);
            this.backgroundAsteroids[idx] = Math.floor(Math.random() * this.shapeCount); // shapeIndex
            this.backgroundAsteroids[idx + 1] = size;
            this.backgroundAsteroids[idx + 2] = spinSpeed;
            this.backgroundAsteroids[idx + 3] = radius; // orbitalDistance
            this.backgroundAsteroids[idx + 4] = orbitSpeed;
            this.backgroundAsteroids[idx + 5] = Math.random() * TWO_PI; // orbitalOffset
        }

        // Generate interactive asteroids
        for (let i = 0; i < this.interactiveCount; i++) {
            this.interactiveAsteroids.push(new Asteroid(this));
        }
    }

    /**
     * Remove an interactive Asteroid
     * @param {Asteroid} interactiveAsteroid - The Asteroid to remove
     * @returns {boolean} true if the Asteroid was not found or removed, false if it was invalid or not removed
     */
    removeAsteroid(interactiveAsteroid) {
        if (!(interactiveAsteroid instanceof Asteroid)) {
            return false;
        }
        removeObjectFromArrayInPlace(interactiveAsteroid, this.interactiveAsteroids);
        interactiveAsteroid.starSystem = null;
        interactiveAsteroid.belt = null;
        return true;
    }

    /**
     * Add an interactive Asteroid
     * @param {Asteroid} interactiveAsteroid - The Asteroid to add
     * @returns {boolean} true if the Asteroid was added
     */
    addAsteroid(interactiveAsteroid) {
        if (!(interactiveAsteroid instanceof Asteroid)) {
            return false;
        }
        removeObjectFromArrayInPlace(interactiveAsteroid, this.interactiveAsteroids);
        this.interactiveAsteroids.push(interactiveAsteroid);
        interactiveAsteroid.starSystem = this.starSystem;
        interactiveAsteroid.belt = this;
        return true;
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {Asteroid|null} The selected body, or null if none available.
     */
    getRandomAsteroid(ship = null, exclude = null) {
        const arr1 = this.interactiveAsteroids;
        const length1 = arr1 ? arr1.length : 0;
        const totalLength = length1;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Updates the asteroid belt.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        this.elapsedTime += deltaTime;
        // Only update interactive asteroids
        this.interactiveAsteroids.forEach(asteroid => asteroid.update(deltaTime));
    }

    /**
     * Draws all asteroids in the belt on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     */
    draw(ctx, camera) {
        ctx.save();
        ctx.fillStyle = 'rgb(100, 100, 100)';
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 1;

        // Draw background asteroids in a single fill
        ctx.beginPath();
        for (let i = 0; i < this.backgroundCount; i++) {
            const idx = i * 6;
            const shapeIndex = this.backgroundAsteroids[idx];
            const size = this.backgroundAsteroids[idx + 1];
            const spinSpeed = this.backgroundAsteroids[idx + 2];
            const orbitalDistance = this.backgroundAsteroids[idx + 3];
            const orbitalSpeed = this.backgroundAsteroids[idx + 4];
            const orbitalOffset = this.backgroundAsteroids[idx + 5];

            // Calculate orbital angle and position
            const orbitalAngle = this.elapsedTime * orbitalSpeed + orbitalOffset;
            this._scratchWorldPos.set(
                Math.sin(orbitalAngle) * orbitalDistance,
                -Math.cos(orbitalAngle) * orbitalDistance
            );

            // Check visibility
            if (camera.isInView(this._scratchWorldPos, size)) {
                camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                const scaledSize = camera.worldToSize(size);
                const rotationAngle = this.elapsedTime * spinSpeed;
                const shape = this.shapes[shapeIndex];
                const cosA = Math.cos(rotationAngle);
                const sinA = Math.sin(rotationAngle);

                // Draw shape points
                for (let j = 0; j < shape.numPoints; j++) {
                    const px = shape.points[j * 2];
                    const py = shape.points[j * 2 + 1];
                    // Rotate
                    const rotatedX = px * cosA - py * sinA;
                    const rotatedY = px * sinA + py * cosA;
                    // Scale and translate
                    const x = rotatedX * scaledSize + this._scratchScreenPos.x;
                    const y = rotatedY * scaledSize + this._scratchScreenPos.y;
                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
            }
        }
        ctx.fill();
        ctx.stroke();

        // Draw interactive asteroids in a single fill
        ctx.beginPath();
        for (let i = 0; i < this.interactiveAsteroids.length; i++) {
            const asteroid = this.interactiveAsteroids[i];
            // Check visibility
            if (camera.isInView(asteroid.position, asteroid.radius)) {
                camera.worldToScreen(asteroid.position, this._scratchScreenPos);
                const scaledSize = camera.worldToSize(asteroid.radius);
                const cosA = Math.cos(asteroid.spin);
                const sinA = Math.sin(asteroid.spin);
                const shape = asteroid.shape;

                // Draw shape points
                for (let j = 0; j < shape.numPoints; j++) {
                    const px = shape.points[j * 2];
                    const py = shape.points[j * 2 + 1];
                    // Rotate
                    const rotatedX = px * cosA - py * sinA;
                    const rotatedY = px * sinA + py * cosA;
                    // Scale and translate
                    const x = rotatedX * scaledSize + this._scratchScreenPos.x;
                    const y = rotatedY * scaledSize + this._scratchScreenPos.y;
                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
            }
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * Represents an individual interactive asteroid within a belt.
 * @extends GameObject
 */
export class Asteroid extends GameObject {
    /**
     * Creates a new Asteroid instance.
     * @param {AsteroidBelt} belt - The asteroid belt this asteroid belongs to.
     */
    constructor(belt) {
        const orbitRadius = remapRange01(Math.random(), belt.innerRadius, belt.outerRadius);
        const angle = remapRange01(Math.random(), 0, TWO_PI);
        super(new Vector2D(0, 0), belt.starSystem);
        this.belt = belt;
        this.shapeIndex = Math.floor(Math.random() * belt.shapeCount);
        this.shape = belt.shapes[this.shapeIndex];
        this.radius = remapRange01(Math.random(), 15, 30);
        this.spin = 0;
        this.spinSpeed = remapRange01(Math.random(), -TWO_PI, TWO_PI) * 0.5;
        this.orbitSpeed = remapRange01(Math.random(), Math.PI * 0.002, Math.PI * 0.006);
        this.orbitRadius = orbitRadius;
        this.orbitAngle = angle;
        this.position.set(
            Math.sin(this.orbitAngle) * this.orbitRadius,
            -Math.cos(this.orbitAngle) * this.orbitRadius
        );
        // Temporary scratch values to avoid allocations
        this._scratchScreenPos = new Vector2D();
    }

    /**
     * Marks the object as despawned, removing it from active gameplay.
     */
    despawn() {
        super.despawn();
        if (this.belt) {
            this.belt.removeAsteroid(this);
        }
        this.shapeIndex = null;
        this.shape = null;
    }

    /**
     * Updates the asteroid's position and spin based on its orbit.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        this.orbitAngle += this.orbitSpeed * deltaTime;
        this.spin += this.spinSpeed * deltaTime;
        const sinOrbitalAngle = Math.sin(this.orbitAngle);
        const cosOrbitalAngle = Math.cos(this.orbitAngle);
        this.position.set(
            sinOrbitalAngle * this.orbitRadius,
            -cosOrbitalAngle * this.orbitRadius
        );
        this.velocity.set(
            cosOrbitalAngle * this.orbitSpeed * this.orbitRadius,
            sinOrbitalAngle * this.orbitSpeed * this.orbitRadius
        );
        this.orbitAngle %= TWO_PI;
        this.spin %= TWO_PI;
    }
}