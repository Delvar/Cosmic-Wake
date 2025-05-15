// asteroidBelt.js

import { Vector2D } from '/src/core/vector2d.js';
import { TWO_PI, remapRange01, removeObjectFromArrayInPlace, SimpleRNG, hash, normalizeAngle, clamp } from '/src/core/utils.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';

/**
 * A precomputed asteroid shape, stored as a Float32Array of [x1, y1, x2, y2, ...].
 */
class AsteroidShape {
    /**
     * @param {number} numPoints - Number of points in the shape.
     * @returns {AsteroidShape} The created asteroid shape instance.
     */
    constructor(numPoints) {
        this.numPoints = numPoints;
        this.points = new Float32Array(numPoints * 2); // [x1, y1, x2, y2, ...]
        this.path = new Path2D(); // Cached Path2D for drawing
        const angleStep = (Math.PI * 2) / numPoints;
        let centerPoint = new Vector2D(0, 0);
        for (let i = 0; i < numPoints; i++) {
            const angle = i * angleStep + (Math.random() - 0.5) * 0.5;
            const radius = 0.5 + Math.random() * 0.5; // Radius between 0.5 and 1 for varied shape
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
            if (i === 0) {
                this.path.moveTo(this.points[i * 2], this.points[i * 2 + 1]);
            } else {
                this.path.lineTo(this.points[i * 2], this.points[i * 2 + 1]);
            }
        }
        this.path.closePath();
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
     * @returns {AsteroidBelt} The created asteroid belt instance.
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
            const minTangentialVelocity = 25 / outerRadius;
            const maxTangentialVelocity = 95 / outerRadius;
            this.orbitalSpeeds[i] = remapRange01(speedRatio, minTangentialVelocity, maxTangentialVelocity);
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
        this.elapsedTime = 0;

        // Scratch variables
        this._scratchWorldPos = new Vector2D();
        this._scratchScreenPos = new Vector2D();
        this._scratchVertex = new Vector2D();
        this._scratchCorner = new Vector2D();
        this._scratchMatrix = new DOMMatrix();

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
     * @returns {Float32Array} [radius, angleOffset, rotationSpeed, shapeIndex, size, ...] or empty array if generation fails.
     * @remarks Data is cached to avoid regeneration; cache is pruned periodically.
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

        const time = this.elapsedTime;
        const globalPath = new Path2D(); // Separate Path2D for background asteroids to simplify layering
        const matrix = this._scratchMatrix;

        // Draw background asteroids in a batch per layer
        //let renderedCells = 0;
        for (let layerIdx = 0; layerIdx < this.layerCount; layerIdx++) {
            const orbitalSpeed = this.orbitalSpeeds[layerIdx];
            // Adjust camera angles for layer rotation
            const layerAngle = orbitalSpeed * this.elapsedTime;
            let minAngleLayer = normalizeAngle(camera.worldBounds.minAngle - layerAngle);
            let maxAngleLayer = normalizeAngle(camera.worldBounds.maxAngle - layerAngle);
            // Handle wrapping (if max < min, add TWO_PI to max)
            if (maxAngleLayer < minAngleLayer) maxAngleLayer += TWO_PI;
            // Compute cell index range
            const startIdx = Math.floor(minAngleLayer / this.cellAngleSize);
            const endIdx = Math.ceil(maxAngleLayer / this.cellAngleSize);
            for (let i = startIdx; i <= endIdx; i++) {
                // Normalize index to [0, cellCount)
                const idx = (i % this.cellCount + this.cellCount) % this.cellCount;
                const baseCellAngle = idx * this.cellAngleSize;
                const cellAngle = baseCellAngle + layerAngle;
                const cellEndAngle = cellAngle + this.cellAngleSize;
                // Optional: Verify cell is in view (for safety)
                if (camera.isCellInView(cellAngle, cellEndAngle, this.innerRadius, this.outerRadius)) {
                    //renderedCells++;
                    const asteroids = this.getCellAsteroids(layerIdx, baseCellAngle, time);
                    for (let j = 0; j < asteroids.length; j += 5) {
                        const radius = asteroids[j];
                        const angleOffset = asteroids[j + 1];
                        const rotationSpeed = asteroids[j + 2];
                        const shapeIndex = asteroids[j + 3];
                        const size = asteroids[j + 4];

                        this._scratchWorldPos.setFromPolar(radius, cellAngle + angleOffset);
                        if (camera.isInView(this._scratchWorldPos, size)) {
                            const rotation = rotationSpeed * this.elapsedTime + Math.PI / 2; // Adjust for 0 = up
                            const scaledSize = camera.worldToSize(size); // Direct zoom scaling
                            const shape = this.shapes[shapeIndex];
                            camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                            const cosA = Math.cos(rotation);
                            const sinA = Math.sin(rotation);
                            matrix.a = scaledSize * cosA;
                            matrix.b = scaledSize * sinA;
                            matrix.c = -scaledSize * sinA;
                            matrix.d = scaledSize * cosA;
                            matrix.e = this._scratchScreenPos.x;
                            matrix.f = this._scratchScreenPos.y;
                            globalPath.addPath(shape.path, matrix);
                        }
                    }
                }
            }
        }
        ctx.fill(globalPath);
        ctx.stroke(globalPath);

        if (camera.debug) {
            //console.log(`renderedCells: ${renderedCells}`);
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
            // Batch debug circles and cell outlines in a single loop per layer
            ctx.save();
            for (let layerIdx = 0; layerIdx < this.layerCount; layerIdx++) {
                const orbitalSpeed = this.orbitalSpeeds[layerIdx];
                const layerAngle = orbitalSpeed * this.elapsedTime;
                let minAngleLayer = normalizeAngle(camera.worldBounds.minAngle - layerAngle);
                let maxAngleLayer = normalizeAngle(camera.worldBounds.maxAngle - layerAngle);
                if (maxAngleLayer < minAngleLayer) maxAngleLayer += TWO_PI;
                const startIdx = Math.floor(minAngleLayer / this.cellAngleSize);
                const endIdx = Math.ceil(maxAngleLayer / this.cellAngleSize);

                const circlePath = new Path2D();
                const outlinePath = new Path2D();
                for (let i = startIdx; i <= endIdx; i++) {
                    const idx = (i % this.cellCount + this.cellCount) % this.cellCount;
                    const baseCellAngle = idx * this.cellAngleSize;
                    const cellAngle = baseCellAngle + layerAngle;
                    const cellEndAngle = cellAngle + this.cellAngleSize;

                    // Build circle path for asteroid positions
                    const asteroids = this.getCellAsteroids(layerIdx, baseCellAngle, time);
                    for (let j = 0; j < asteroids.length; j += 5) {
                        const radius = asteroids[j];
                        const angleOffset = asteroids[j + 1];
                        const size = asteroids[j + 4];

                        this._scratchWorldPos.setFromPolar(radius, cellAngle + angleOffset);
                        if (camera.isInView(this._scratchWorldPos, size)) {
                            camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                            circlePath.moveTo(this._scratchScreenPos.x + 5 * camera.zoom, this._scratchScreenPos.y);
                            circlePath.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, 5 * camera.zoom, 0, TWO_PI);
                        }
                    }

                    // Build cell outline path
                    this._scratchWorldPos.setFromPolar(this.innerRadius, cellAngle);
                    camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                    outlinePath.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                    this._scratchWorldPos.setFromPolar(this.outerRadius, cellAngle);
                    camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                    outlinePath.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                    this._scratchWorldPos.setFromPolar(this.outerRadius, cellEndAngle);
                    camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                    outlinePath.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                    this._scratchWorldPos.setFromPolar(this.innerRadius, cellEndAngle);
                    camera.worldToScreen(this._scratchWorldPos, this._scratchScreenPos);
                    outlinePath.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                    outlinePath.closePath();
                }

                // Draw batched paths with layer color
                ctx.fillStyle = this._debugColors[layerIdx % this._debugColors.length];
                ctx.strokeStyle = this._debugColors[layerIdx % this._debugColors.length];
                ctx.lineWidth = 2;
                ctx.fill(circlePath);
                ctx.stroke(outlinePath);
            }
            ctx.restore();
        }

        // Draw interactive asteroids with Path2D
        const globalPathInteractive = new Path2D(); // Separate Path2D for interactive asteroids
        for (const asteroid of this.interactiveAsteroids) {
            if (camera.isInView(asteroid.position, asteroid.radius)) {
                camera.worldToScreen(asteroid.position, this._scratchScreenPos);
                const scaledSize = camera.worldToSize(asteroid.radius);
                const rotation = asteroid.spin + Math.PI / 2; // Adjust for 0 = up
                const cosA = Math.cos(rotation);
                const sinA = Math.sin(rotation);
                matrix.a = scaledSize * cosA;
                matrix.b = scaledSize * sinA;
                matrix.c = -scaledSize * sinA;
                matrix.d = scaledSize * cosA;
                matrix.e = this._scratchScreenPos.x;
                matrix.f = this._scratchScreenPos.y;
                globalPathInteractive.addPath(asteroid.shape.path, matrix);
            }
        }
        ctx.fill(globalPathInteractive);
        ctx.stroke(globalPathInteractive);

        ctx.restore();
    }
}

/**
 * Represents an individual interactive asteroid within a belt.
 */
export class Asteroid extends GameObject {
    /**
     * @extends GameObject
     * @param {AsteroidBelt} belt - The asteroid belt this asteroid belongs to.
     */
    constructor(belt) {
        super(new Vector2D(0, 0), belt.starSystem);
        /** @type {AsteroidBelt} The asteroid belt this asteroid belongs to. */
        this.belt = belt;
        /** @type {number} Index of the shape used for rendering. */
        this.shapeIndex = Math.floor(Math.random() * belt.shapeCount);
        /** @type {Shape} The shape used for rendering this asteroid. */
        this.shape = belt.shapes[this.shapeIndex];
        /** @type {number} The radius of the asteroid (world units). */
        this.radius = remapRange01(Math.random(), 15, 30);
        /** @type {number} Current spin angle (radians). */
        this.spin = 0;
        /** @type {number} Spin angular velocity (radians/second). */
        this.spinSpeed = remapRange01(Math.random(), -TWO_PI, TWO_PI) * 0.5;

        // Calculate orbital speed to achieve tangential velocity between 25 and 95 units/second
        const tangentialVelocity = remapRange01(Math.random(), 25, 95);
        /** @type {number} Orbital radius from system center (world units). */
        this.orbitRadius = remapRange01(Math.random(), belt.innerRadius, belt.outerRadius);
        /** @type {number} Orbital angular velocity (radians/second). */
        this.orbitSpeed = tangentialVelocity / this.orbitRadius; // ω = v / r

        // Clamp orbitSpeed to prevent extreme values for small or large radii
        this.orbitSpeed = clamp(this.orbitSpeed, Math.PI * 0.0001, Math.PI * 0.01);
        /** @type {number} Current orbital angle (radians). */
        this.orbitAngle = remapRange01(Math.random(), 0, TWO_PI);
        /** @type {Vector2D} Current position in world coordinates. */
        this.position.setFromPolar(this.orbitRadius, this.orbitAngle);
        /** @type {Vector2D} Scratch vector for screen position calculations. */
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