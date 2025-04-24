// asteroidBelt.js

import { Vector2D } from './vector2d.js';
import { TWO_PI, remapRange01, removeObjectFromArrayInPlace, SimpleRNG, hash, normalizeAngle, clamp } from './utils.js';
import { GameObject, isValidTarget } from './gameObject.js';

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
        // Log points for debugging
        //console.log(`AsteroidShape: numPoints=${numPoints}, points=[${this.points.join(', ')}]`);
    }
}

/**
 * Manages a collection of asteroids forming a belt in a star system.
 */
export class AsteroidBelt {
    /**
     * @param {number} innerRadius - Inner radius of the belt.
     * @param {number} outerRadius - Outer radius of the belt.
     * @param {number} backgroundDensity - Asteroids per 500x500 unit area.
     * @param {number} interactiveCount - Number of interactive asteroids.
     * @param {number} [layerCount=10] - Number of orbital layers.
     */
    constructor(innerRadius, outerRadius, backgroundDensity, interactiveCount, layerCount = 10) {
        this.starSystem = null;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.backgroundDensity = backgroundDensity;
        this.interactiveCount = interactiveCount;
        this.interactiveAsteroids = [];

        // Validate and set layer count
        this.layerCount = clamp(Math.floor(layerCount), 1, 10);

        this.orbitalSpeeds = new Float32Array(this.layerCount);
        for (let i = 0; i < this.layerCount; i++) {
            const speedRatio = this.layerCount > 1 ? i / (this.layerCount - 1) : 0;
            this.orbitalSpeeds[i] = remapRange01(speedRatio, 0.001, 0.006) * Math.PI;
        }

        // Cell configuration: target ~500 units arc length at innerRadius
        const targetArcLength = 500;
        this.cellCount = Math.max(4, Math.ceil(TWO_PI * innerRadius / targetArcLength));
        this.cellAngleSize = TWO_PI / this.cellCount;
        // Calculate asteroidsPerCell based on density and cell area
        const cellArea = 0.5 * this.cellAngleSize * (outerRadius * outerRadius - innerRadius * innerRadius);
        this.asteroidsPerCell = clamp(Math.ceil((backgroundDensity * cellArea) / (250000 * this.layerCount)), 1, 50);
        this.cellCache = new Map();
        this.maxCacheSize = 100;
        this._lastCachePrune = performance.now();

        // Precompute asteroid shapes
        this.shapeCount = 20;
        this.shapes = new Array(this.shapeCount);
        for (let i = 0; i < this.shapeCount; i++) {
            const numPoints = 5 + Math.floor(Math.random() * 4);
            this.shapes[i] = new AsteroidShape(numPoints);
        }

        // Scratch variables
        this._scratchWorldPos = new Vector2D();
        this._scratchScreenPos = new Vector2D();
        this._scratchVertex = new Vector2D();
        this._scratchCorner = new Vector2D();
        this.elapsedTime = 0;

        // Debug colors for layers
        this._debugColors = [
            'red', 'blue', 'green', 'yellow', 'cyan',
            'magenta', 'purple', 'orange', 'pink', 'lime'
        ];
    }

    init() {
        if (!this.starSystem) {
            console.warn('No star system on asteroid belt init', this);
        }
        for (let i = 0; i < this.interactiveCount; i++) {
            this.interactiveAsteroids.push(new Asteroid(this));
        }
    }

    removeAsteroid(interactiveAsteroid) {
        if (!(interactiveAsteroid instanceof Asteroid)) return false;
        removeObjectFromArrayInPlace(interactiveAsteroid, this.interactiveAsteroids);
        interactiveAsteroid.starSystem = null;
        interactiveAsteroid.belt = null;
        return true;
    }

    addAsteroid(interactiveAsteroid) {
        if (!(interactiveAsteroid instanceof Asteroid)) return false;
        removeObjectFromArrayInPlace(interactiveAsteroid, this.interactiveAsteroids);
        this.interactiveAsteroids.push(interactiveAsteroid);
        interactiveAsteroid.starSystem = this.starSystem;
        interactiveAsteroid.belt = this;
        return true;
    }

    getRandomAsteroid(ship = null, exclude = null) {
        const arr1 = this.interactiveAsteroids;
        const length1 = arr1 ? arr1.length : 0;
        if (length1 === 0) return null;
        let attempts = length1;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * length1);
            const item = arr1[randomIndex];
            if (ship && item !== exclude && isValidTarget(ship, item)) return item;
            if (!item.isDespawned() && item !== exclude) return item;
            attempts--;
        }
        return null;
    }

    /**
     * Checks if the entire belt is off-screen using camera bounds.
     * @param {Camera} camera - The camera object.
     * @returns {boolean} True if the belt is entirely off-screen, false otherwise.
     */
    isBeltOffScreen(camera) {
        const innerRadiusSquared = this.innerRadius * this.innerRadius;
        const outerRadiusSquared = this.outerRadius * this.outerRadius;
        let hasInside = false;
        let hasOutside = false;

        // Check top-left corner
        this._scratchCorner.set(camera.worldBounds.left, camera.worldBounds.top);
        let distSquared = this._scratchCorner.squareMagnitude();
        if (innerRadiusSquared <= distSquared && distSquared <= outerRadiusSquared) return false;
        if (distSquared < innerRadiusSquared) hasInside = true;
        if (distSquared > outerRadiusSquared) hasOutside = true;

        // Check top-right corner
        this._scratchCorner.set(camera.worldBounds.right, camera.worldBounds.top);
        distSquared = this._scratchCorner.squareMagnitude();
        if (innerRadiusSquared <= distSquared && distSquared <= outerRadiusSquared) return false;
        if (distSquared < innerRadiusSquared) hasInside = true;
        if (distSquared > outerRadiusSquared) hasOutside = true;
        if (hasInside && hasOutside) return false;

        // Check bottom-left corner
        this._scratchCorner.set(camera.worldBounds.left, camera.worldBounds.bottom);
        distSquared = this._scratchCorner.squareMagnitude();
        if (innerRadiusSquared <= distSquared && distSquared <= outerRadiusSquared) return false;
        if (distSquared < innerRadiusSquared) hasInside = true;
        if (distSquared > outerRadiusSquared) hasOutside = true;
        if (hasInside && hasOutside) return false;

        // Check bottom-right corner
        this._scratchCorner.set(camera.worldBounds.right, camera.worldBounds.bottom);
        distSquared = this._scratchCorner.squareMagnitude();
        if (innerRadiusSquared <= distSquared && distSquared <= outerRadiusSquared) return false;
        if (distSquared < innerRadiusSquared) hasInside = true;
        if (distSquared > outerRadiusSquared) hasOutside = true;

        return !hasInside || !hasOutside;
    }

    /**
     * Generates or retrieves cached asteroid data for a cell.
     * @param {number} layer - Layer index.
     * @param {number} cellAngle - Cell's starting angle in radians.
     * @param {number} time - Current time for cache expiration.
     * @returns {Float32Array} [radius, angleOffset, rotationSpeed, shapeIndex, size, ...]
     */
    getCellAsteroids(layer, cellAngle, time) {
        const cellKey = layer * 100000 + Math.round(cellAngle / this.cellAngleSize);
        let asteroidData = this.cellCache.get(cellKey);
        if (!asteroidData || !asteroidData.data) {
            try {
                const seed = hash(layer, Math.round(cellAngle / this.cellAngleSize), 0);
                const rng = new SimpleRNG(seed);
                asteroidData = { data: new Float32Array(this.asteroidsPerCell * 5), time };
                for (let i = 0; i < this.asteroidsPerCell; i++) {
                    const idx = i * 5;
                    asteroidData.data[idx] = remapRange01(rng.next(), this.innerRadius, this.outerRadius);
                    asteroidData.data[idx + 1] = rng.next() * this.cellAngleSize;
                    asteroidData.data[idx + 2] = (rng.next() - 0.5) * TWO_PI * 0.75;
                    asteroidData.data[idx + 3] = Math.floor(rng.next() * this.shapeCount);
                    asteroidData.data[idx + 4] = remapRange01(rng.next(), 2, 20);
                }
                this.cellCache.set(cellKey, asteroidData);
                if (this.cellCache.size > this.maxCacheSize) this.pruneCache(time);
                //console.log(`Generated asteroid cell for cellKey ${cellKey}`, asteroidData);
            } catch (e) {
                console.warn(`Failed to generate asteroids for cellKey ${cellKey}:`, e);
                // Return empty array to prevent crash
                return new Float32Array(0);
            }
        }

        return asteroidData.data;
    }

    /**
     * Prunes old cache entries.
     * @param {number} time - Current time in milliseconds.
     */
    pruneCache(time) {
        if (time - this._lastCachePrune < 10000) return;
        //const from = this.cellCache.size;
        for (const [key, entry] of this.cellCache) {
            if (time - entry.time > 10000) this.cellCache.delete(key);
        }
        //const to = this.cellCache.size;
        this._lastCachePrune = time;
        //console.log(`Prune Cells: ${from} > ${to}`);
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        for (const asteroid of this.interactiveAsteroids) {
            asteroid.update(deltaTime);
        }
    }

    draw(ctx, camera) {
        // Quick bounds check
        if (this.isBeltOffScreen(camera)) {
            return;
        }

        ctx.save();
        ctx.fillStyle = 'rgb(100, 100, 100)';
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 1;

        const time = performance.now();

        // Draw background asteroids in a batch per layer
        let renderedCells = 0;
        for (let layerIdx = 0; layerIdx < this.layerCount; layerIdx++) {
            ctx.beginPath();
            const orbitalSpeed = this.orbitalSpeeds[layerIdx];
            for (let i = 0; i < this.cellCount; i++) {
                const baseCellAngle = i * this.cellAngleSize;
                const cellAngle = baseCellAngle + orbitalSpeed * this.elapsedTime;
                const cellEndAngle = cellAngle + this.cellAngleSize;
                if (camera.isCellInView(cellAngle, cellEndAngle, this.innerRadius, this.outerRadius)) {
                    renderedCells++;
                    const asteroids = this.getCellAsteroids(layerIdx, baseCellAngle, time);
                    for (let j = 0; j < asteroids.length; j += 5) {
                        const radius = asteroids[j];
                        const angleOffset = asteroids[j + 1];
                        const rotationSpeed = asteroids[j + 2];
                        const shapeIndex = asteroids[j + 3];
                        const size = asteroids[j + 4];

                        this._scratchWorldPos.setFromPolar(radius, cellAngle + angleOffset);
                        if (camera.isInView(this._scratchWorldPos, size)) {
                            camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);

                            const rotation = rotationSpeed * this.elapsedTime;
                            const scaledSize = camera.worldToSize(size);
                            const shape = this.shapes[shapeIndex];
                            const cosA = Math.cos(rotation);
                            const sinA = Math.sin(rotation);

                            for (let k = 0; k < shape.numPoints; k++) {
                                const px = shape.points[k * 2];
                                const py = shape.points[k * 2 + 1];
                                const rotatedX = px * cosA - py * sinA;
                                const rotatedY = px * sinA + py * cosA;
                                const vx = rotatedX * scaledSize + this._scratchScreenPos.x;
                                const vy = rotatedY * scaledSize + this._scratchScreenPos.y;
                                if (k === 0) ctx.moveTo(vx, vy);
                                else ctx.lineTo(vx, vy);
                            }
                            ctx.closePath();
                        }
                    }
                }
            }
            ctx.fill();
            ctx.stroke();
        }

        if (camera.debug) {
            console.log(`renderedCells: ${renderedCells}`);
            // Draw translucent purple cone for camera’s minAngle to maxAngle
            ctx.save();
            ctx.fillStyle = 'rgba(128, 0, 128, 0.3)';
            ctx.beginPath();
            // Start at origin
            this._scratchWorldPos.set(0, 0);
            camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            // Line to minAngle at outerRadius
            let minAngle = normalizeAngle(camera.worldBounds.minAngle);
            let maxAngle = normalizeAngle(camera.worldBounds.maxAngle);
            if (maxAngle < minAngle) maxAngle += TWO_PI;
            this._scratchWorldPos.setFromPolar(this.outerRadius, minAngle);
            camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
            ctx.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            // Arc to maxAngle at outerRadius
            this._scratchWorldPos.setFromPolar(this.outerRadius, maxAngle);
            camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
            ctx.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            // Back to origin
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Draw debug circles for asteroid positions in a separate batch
            ctx.save();
            for (let layerIdx = 0; layerIdx < this.layerCount; layerIdx++) {
                ctx.beginPath();
                ctx.fillStyle = this._debugColors[layerIdx % this._debugColors.length];//'rgba(255, 0, 255, 0.5)';
                const orbitalSpeed = this.orbitalSpeeds[layerIdx];
                for (let i = 0; i < this.cellCount; i++) {
                    const baseCellAngle = i * this.cellAngleSize;
                    const cellAngle = baseCellAngle + orbitalSpeed * this.elapsedTime;
                    const cellEndAngle = cellAngle + this.cellAngleSize;
                    if (camera.isCellInView(cellAngle, cellEndAngle)) {
                        const asteroids = this.getCellAsteroids(layerIdx, baseCellAngle, time);
                        for (let j = 0; j < asteroids.length; j += 5) {
                            const radius = asteroids[j];
                            const angleOffset = asteroids[j + 1];
                            const size = asteroids[j + 4];

                            this._scratchWorldPos.setFromPolar(radius, cellAngle + angleOffset);
                            if (camera.isInView(this._scratchWorldPos, size)) {
                                camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                                ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, 5 * camera.zoom, 0, TWO_PI);
                            }
                        }
                    }
                }
                ctx.fill();
            }
            ctx.restore();
        }

        // Draw debug cell outlines
        if (camera.debug) {
            for (let layerIdx = 0; layerIdx < this.layerCount; layerIdx++) {
                const orbitalSpeed = this.orbitalSpeeds[layerIdx];
                for (let i = 0; i < this.cellCount; i++) {
                    const baseCellAngle = i * this.cellAngleSize;
                    const cellAngle = baseCellAngle + orbitalSpeed * this.elapsedTime;
                    const cellEndAngle = cellAngle + this.cellAngleSize;
                    if (camera.isCellInView(cellAngle, cellEndAngle, this.innerRadius, this.outerRadius)) {
                        ctx.save();
                        ctx.strokeStyle = this._debugColors[layerIdx % this._debugColors.length];
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        this._scratchWorldPos.setFromPolar(this.innerRadius, cellAngle);
                        camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                        ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                        this._scratchWorldPos.setFromPolar(this.outerRadius, cellAngle);
                        camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                        ctx.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                        this._scratchWorldPos.setFromPolar(this.outerRadius, cellEndAngle);
                        camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                        ctx.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                        this._scratchWorldPos.setFromPolar(this.innerRadius, cellEndAngle);
                        camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                        ctx.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                        ctx.closePath();
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }

        // Draw interactive asteroids in a separate batch
        ctx.beginPath();
        for (const asteroid of this.interactiveAsteroids) {
            if (camera.isInView(asteroid.position, asteroid.radius)) {
                camera.worldToScreen(asteroid.position, this._scratchScreenPos);
                const scaledSize = camera.worldToSize(asteroid.radius);
                const cosA = Math.cos(asteroid.spin);
                const sinA = Math.sin(asteroid.spin);
                const shape = asteroid.shape;
                for (let j = 0; j < shape.numPoints; j++) {
                    const px = shape.points[j * 2];
                    const py = shape.points[j * 2 + 1];
                    const rotatedX = px * cosA - py * sinA;
                    const rotatedY = px * sinA + py * cosA;
                    const x = rotatedX * scaledSize + this._scratchScreenPos.x;
                    const y = rotatedY * scaledSize + this._scratchScreenPos.y;
                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
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
        this.position.setFromPolar(this.orbitRadius, this.orbitAngle);
        this._scratchScreenPos = new Vector2D();
    }

    despawn() {
        super.despawn();
        if (this.belt) {
            this.belt.removeAsteroid(this);
        }
        this.shapeIndex = null;
        this.shape = null;
    }

    update(deltaTime) {
        this.orbitAngle += this.orbitSpeed * deltaTime;
        this.spin += this.spinSpeed * deltaTime;
        this.position.setFromPolar(this.orbitRadius, this.orbitAngle);
        this.velocity.setFromPolar(this.orbitSpeed * this.orbitRadius, this.orbitAngle + Math.PI / 2);
        this.orbitAngle %= TWO_PI;
        this.spin %= TWO_PI;
    }
}