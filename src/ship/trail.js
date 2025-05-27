// /src/ship/trail.js

import { Vector2D } from '/src/core/vector2d.js';

/**
 * A ring buffer managing trail points in a Float32Array.
 * Each point stores 9 floats: [x, y, backX, backY, rightX, rightY, screenLeftPositionX, screenLeftPositionY, age].
 */
class TrailPointPool {
    /**
     * Creates a new TrailPointPool.
     * @param {number} [maxPoints=300] - Initial maximum number of points the pool can hold.
     */
    constructor(maxPoints = 300) {
        /** @type {number} Maximum number of points the buffer can store. */
        this.maxPoints = maxPoints;
        /** @type {Float32Array} Buffer storing point data (9 floats per point). */
        this.data = new Float32Array(maxPoints * 9);
        /** @type {number} Index where the next point will be added (newest). */
        this.head = 0;
        /** @type {number} Index of the oldest point to be removed (start of trail). */
        this.tail = 0;
        /** @type {number} Current number of active points in the buffer. */
        this.count = 0;
    }

    /**
     * Resets the trail by clearing all points.
     * Useful for events like ship jumps to restart the trail.
     */
    clear() {
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }

    /**
     * Adds a new point to the trail at the head.
     * @param {Vector2D} position - The point's position (x, y).
     * @param {Vector2D} backwards - The backward direction vector (backX, backY).
     * @param {Vector2D} right - The right direction vector (rightX, rightY).
     * @param {number} age - Initial age of the point in seconds.
     */
    addPoint(position, backwards, right, age) {
        if (this.count >= this.maxPoints) {
            this.expand();
        }
        const index = this.head * 9;
        this.data[index] = position.x;
        this.data[index + 1] = position.y;
        this.data[index + 2] = backwards.x;
        this.data[index + 3] = backwards.y;
        this.data[index + 4] = right.x;
        this.data[index + 5] = right.y;
        this.data[index + 6] = 0; // screenLeftPositionX (to be set during draw)
        this.data[index + 7] = 0; // screenLeftPositionY (to be set during draw)
        this.data[index + 8] = age; // Age of the point
        this.head = (this.head + 1) % this.maxPoints;
        if (this.count === this.maxPoints) {
            this.tail = (this.tail + 1) % this.maxPoints;
        } else {
            this.count++;
        }
    }

    /**
     * Doubles the buffer size when full, copying existing points.
     * @returns {number} The new maximum number of points.
     */
    expand() {
        const newMaxPoints = this.maxPoints * 2;
        const newData = new Float32Array(newMaxPoints * 9);
        let oldIdx = this.tail * 9;
        for (let i = 0; i < this.count * 9; i++) {
            newData[i] = this.data[oldIdx];
            oldIdx = (oldIdx + 1) % (this.maxPoints * 9);
        }
        this.data = newData;
        this.tail = 0;
        this.head = this.count;
        this.maxPoints = newMaxPoints;
        return newMaxPoints;
    }

    /**
     * Gets the buffer index for the nth point from the head (newest to oldest).
     * @param {number} n - The point’s position from head (0 = newest).
     * @returns {number} The index in the data array (multiple of 9).
     */
    getIndex(n) {
        return ((this.head - 1 - n + this.maxPoints) % this.maxPoints) * 9;
    }

    /**
     * Removes points with age <= 0, starting from the tail (oldest points), but only if both the tail and the next point have age <= 0.
     * This ensures the tail always has age <= 0 for smooth projection.
     * @returns {number} The number of points removed.
     */
    removeExpiredPoints() {
        let removedCount = 0;
        while (this.count > 1) { // Ensure at least 1 point remains
            const tailIdx = this.tail * 9;
            const tailAge = this.data[tailIdx + 8];
            if (tailAge > 0) break; // Stop if the tail is still alive
            // Check the next point's age
            const nextTailIdx = ((this.tail + 1) % this.maxPoints) * 9;
            const nextTailAge = this.data[nextTailIdx + 8];
            if (nextTailAge > 0) break; // Stop if the next point is alive, ensuring tail has age <= 0
            this.tail = (this.tail + 1) % this.maxPoints;
            this.count--;
            removedCount++;
        }
        return removedCount;
    }
}

/**
 * A trail renderer for a parent object (e.g., ship), with ring buffer management.
 */
export class Trail {
    /**
     * Creates a new Trail instance.
     * @param {number} [maxAge=5] - Maximum age of a trail point in seconds.
     * @param {number} [decayMultiplier=1] - Multiplier for age decay rate.
     * @param {number} [startWidth=2] - Initial width of the trail in world units.
     * @param {string} [color='rgba(255, 255, 255, 0.5)'] - CSS color for the trail fill.
     */
    constructor(maxAge = 5, decayMultiplier = 1, startWidth = 2, color = 'rgba(255, 255, 255, 0.5)') {
        /** @type {TrailPointPool} Ring buffer for trail points. */
        this.points = new TrailPointPool(20);
        /** @type {number} Starting width of the trail in world units. */
        this.startWidth = startWidth;
        /** @type {number} Maximum age of a trail point in seconds. */
        this.maxAge = maxAge;
        /** @type {number} Multiplier for age decay rate (higher = faster decay). */
        this.decayMultiplier = decayMultiplier;
        /** @type {number} Minimum distance between points to add a new one. */
        this.minPointDist = 2;
        /** @type {number} Maximum distance before forcing a new point. */
        this.maxPointDist = 200;
        /** @type {number} Threshold for lateral movement to add a point. */
        this.lateralThreshold = 2;
        /** @type {string} Color of the trail fill. */
        this.color = color;
        /** @type {boolean} Should we draw debug visuals? */
        this.debug = true;

        /** @type {Vector2D} Upper left point of bounding box for visibility culling (in world space) */
        this.boundsMin = new Vector2D(Infinity, Infinity);
        /** @type {Vector2D} Lower right point of bounding box for visibility culling (in world space) */
        this.boundsMax = new Vector2D(-Infinity, -Infinity);

        // Scratch vectors for temporary calculations
        /** @type {Vector2D} Temporary vector for relative position. */
        this._scratchRelativePos = new Vector2D();
        /** @type {Vector2D} Temporary vector for forward direction. */
        this._scratchForwardDirection = new Vector2D();
        /** @type {Vector2D} Temporary vector for backward direction. */
        this._scratchBackwardDirection = new Vector2D();
        /** @type {Vector2D} Temporary vector for screen position. */
        this._scratchScreenPos = new Vector2D();
        /** @type {Vector2D} Temporary vector for right point. */
        this._scratchRightDirection = new Vector2D();
        /** @type {Vector2D} Temporary vector for left point. */
        this._scratchRightPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for left point. */
        this._scratchLeftPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for endpoint calculation. */
        this._scratchEndPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for endpoint calculation. */
        this._scratchLastPositionPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for endpoint calculation. */
        this._scratchThisPositionPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for miscellaneous use. */
        this._scratchTemp = new Vector2D();
        /** @type {Vector2D} Temporary vector for endpoint calculation. */
        this._scratchFirstPositionPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for endpoint calculation. */
        this._scratchSecondPositionPoint = new Vector2D();

        // Precomputed squared thresholds for performance
        this.minPointDistSquared = this.minPointDist * this.minPointDist;
        this.maxPointDistSquared = this.maxPointDist * this.maxPointDist;
        this.lateralThresholdSquared = this.lateralThreshold * this.lateralThreshold;
    }

    /**
     * Resets the bounding box when the trail is cleared.
     */
    clear() {
        this.points.clear();
        this.boundsMin.set(Infinity, Infinity);
        this.boundsMax.set(-Infinity, -Infinity);
    }

    /**
     * Updates the bounding box to include a new point.
     * @param {number} x - The x-coordinate of the point.
     * @param {number} y - The y-coordinate of the point.
     */
    updateBounds(x, y) {
        this.boundsMin.x = Math.min(this.boundsMin.x, x);
        this.boundsMin.y = Math.min(this.boundsMin.y, y);
        this.boundsMax.x = Math.max(this.boundsMax.x, x);
        this.boundsMax.y = Math.max(this.boundsMax.y, y);
    }

    /**
     * Updates the trail state based on parent movement and time elapsed.
     * @param {number} deltaTime - Time elapsed since last update (in seconds).
     * @param {Vector2D} currentPosition - The current position of the parent.
     * @param {number} currentAngle - The current angle of the parent in radians.
     * @param {boolean} debug - Whether to enable debug rendering.
     */
    update(deltaTime, currentPosition, currentAngle, debug) {
        this.debug = debug;

        // Validate inputs to prevent NaN propagation
        if (isNaN(currentPosition.x) || isNaN(currentPosition.y) || isNaN(currentAngle)) {
            console.warn("Invalid input in Trail.update; skipping update");
            return;
        }

        // Initialize with at least 2 points
        if (this.points.count < 2) {
            const cosAngle = Math.cos(currentAngle);
            const sinAngle = Math.sin(currentAngle);
            this._scratchBackwardDirection.set(-sinAngle, cosAngle);
            this._scratchRightDirection.set(cosAngle, sinAngle); // Right is perpendicular
            if (this.points.count == 0) {
                this.points.addPoint(currentPosition, this._scratchBackwardDirection, this._scratchRightDirection, 0);
            }
            if (this.points.count == 1) {
                this.points.addPoint(currentPosition, this._scratchBackwardDirection, this._scratchRightDirection, this.maxAge);
            }
        }

        // Reset bounds before updating points
        this.boundsMin.set(Infinity, Infinity);
        this.boundsMax.set(-Infinity, -Infinity);

        // Reduce age of all points and remove expired ones
        for (let i = 0; i < this.points.count; i++) {
            const idx = this.points.getIndex(i);
            //Age them down
            this.points.data[idx + 8] -= deltaTime * this.decayMultiplier;
            // Push back points
            this.points.data[idx] += this.points.data[idx + 2] * 10 * deltaTime;
            this.points.data[idx + 1] += this.points.data[idx + 3] * 10 * deltaTime;
            // Update bounds with the new position
            this.updateBounds(this.points.data[idx], this.points.data[idx + 1]);
        }
        this.points.removeExpiredPoints();

        const firstIdx = this.points.getIndex(0); // Newest point
        const secondIdx = this.points.getIndex(1); // Second newest

        this._scratchFirstPositionPoint.set(this.points.data[firstIdx], this.points.data[firstIdx + 1]);
        this._scratchSecondPositionPoint.set(this.points.data[secondIdx], this.points.data[secondIdx + 1]);

        // Calculate distance from second-to-last point to parent
        this._scratchRelativePos.set(currentPosition)
            .subtractInPlace(this._scratchSecondPositionPoint);
        const distanceSquared = this._scratchRelativePos.squareMagnitude();
        const distance = Math.sqrt(distanceSquared);

        let shouldAddPoint = false;

        // Conditions to add a new point
        const prevDistanceSquared = this._scratchFirstPositionPoint.distanceSquaredTo(this._scratchSecondPositionPoint);

        if (prevDistanceSquared > distanceSquared + 0.1) { // Distance shrinking
            shouldAddPoint = true;
        }
        if (distanceSquared > this.maxPointDistSquared) { // Exceeds max distance
            shouldAddPoint = true;
        }
        if (distanceSquared > this.minPointDistSquared && !shouldAddPoint) { // Lateral movement check
            this._scratchForwardDirection.set(this._scratchRelativePos)
                .normalizeInPlace();
            this._scratchTemp.set(-this.points.data[secondIdx + 2], -this.points.data[secondIdx + 3]);
            const dot = this._scratchTemp.dot(this._scratchForwardDirection);
            const minDot = distance <= this.lateralThreshold ? 0 : Math.sqrt(1 - (this.lateralThreshold / distance) ** 2);
            if (dot < minDot) {
                shouldAddPoint = true;
            }
        }

        if (shouldAddPoint) {
            // Add new point at parent position
            this._scratchRelativePos.set(currentPosition)
                .subtractInPlace(this._scratchFirstPositionPoint);
            const newDistance = this._scratchRelativePos.magnitude() || 0;
            if (newDistance > 0.1) {
                this._scratchBackwardDirection.set(this._scratchRelativePos)
                    .multiplyInPlace(-1)
                    .divideInPlace(newDistance);
            } else {
                this._scratchBackwardDirection.set(this.points.data[firstIdx + 2], this.points.data[firstIdx + 3]);
            }
            this._scratchRightDirection.set(-this._scratchBackwardDirection.y, this._scratchBackwardDirection.x);
            this.points.addPoint(currentPosition, this._scratchBackwardDirection, this._scratchRightDirection, this.maxAge);
        } else {
            // Update newest point’s position
            this.points.data[firstIdx] = currentPosition.x;
            this.points.data[firstIdx + 1] = currentPosition.y;
            if (distance > 0.1) {
                this._scratchBackwardDirection.set(this._scratchRelativePos)
                    .multiplyInPlace(-1)
                    .divideInPlace(distance);
            } else {
                const cosAngle = Math.cos(currentAngle);
                const sinAngle = Math.sin(currentAngle);
                this._scratchBackwardDirection.set(-sinAngle, cosAngle);
            }
            this.points.data[firstIdx + 2] = this._scratchBackwardDirection.x;
            this.points.data[firstIdx + 3] = this._scratchBackwardDirection.y;
            this.points.data[firstIdx + 4] = -this._scratchBackwardDirection.y;
            this.points.data[firstIdx + 5] = this._scratchBackwardDirection.x;
            this.points.data[firstIdx + 8] = this.maxAge;
        }
    }

    /**
     * Draws the trail as a filled polygon on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The 2D canvas rendering context.
     * @param {Camera} camera - Camera object with worldToScreen and worldToSize methods.
     * @param {Number} shipScale - The current scale of the ship.
     */
    draw(ctx, camera, shipScale) {
        if (this.points.count < 2) return;

        const startWidthInScreen = camera.worldToSize(this.startWidth * shipScale);
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        //camera.worldToScreen(shipPosition, this._scratchScreenPos);
        //ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
        // const firstIdx = this.points.getIndex(0);
        // this._scratchThisPositionPoint.set(this.points.data[firstIdx], this.points.data[firstIdx + 1]);
        // camera.worldToScreen(this._scratchThisPositionPoint, this._scratchScreenPos);
        // ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, startWidthInScreen, 0, Math.PI * 4);
        // ctx.closePath();
        // ctx.fill();
        // ctx.beginPath();
        let lastPoint = this.points.count;
        let previousIdx = -1; // Store the previous point's index

        // Forward pass: Draw right side, calculate and store left positions
        for (let i = 0; i < lastPoint; i++) {
            const idx = this.points.getIndex(i);
            const pointAge = this.points.data[idx + 8];

            // Check if the current point's age is <= 0 to project the tail
            if (pointAge <= 0 && i > 0) { // Need at least one previous point to project
                // Use the previous point (last with age > 0) to project to the point where age = 0
                const previousAge = this.points.data[previousIdx + 8];
                const ageDiff = previousAge - pointAge;
                let ageRatio = 0;
                if (ageDiff > 0) {
                    ageRatio = previousAge / ageDiff; // Ratio where age would be 0
                }

                // Project in world space
                this._scratchLastPositionPoint.set(this.points.data[previousIdx], this.points.data[previousIdx + 1]);
                this._scratchThisPositionPoint.set(this.points.data[idx], this.points.data[idx + 1]);
                this._scratchEndPoint.lerpInPlace(this._scratchLastPositionPoint, this._scratchThisPositionPoint, ageRatio);

                // Convert the projected point to screen space
                camera.worldToScreen(this._scratchEndPoint, this._scratchScreenPos);
                ctx.lineTo(this._scratchScreenPos.x, this._scratchScreenPos.y);

                lastPoint = i - 1; // Exclude the current point and beyond
                break;
            }

            // Draw the current point
            this._scratchScreenPos.set(this.points.data[idx], this.points.data[idx + 1]);
            camera.worldToScreen(this._scratchScreenPos, this._scratchScreenPos);
            const ageProgress = Math.min(1, 1 - (pointAge / this.maxAge)); // 0 (new) to 1 (old)
            const currentWidth = startWidthInScreen * (1 - ageProgress);

            // Calculate right point for drawing
            this._scratchRightPoint.set(this.points.data[idx + 4], this.points.data[idx + 5])
                .multiplyInPlace(currentWidth)
                .addInPlace(this._scratchScreenPos);
            ctx.lineTo(this._scratchRightPoint.x, this._scratchRightPoint.y);

            // Calculate left point and store in ring buffer
            this._scratchLeftPoint.set(this.points.data[idx + 4], this.points.data[idx + 5])
                .multiplyInPlace(-currentWidth)
                .addInPlace(this._scratchScreenPos);
            this.points.data[idx + 6] = this._scratchLeftPoint.x; // screenLeftPositionX
            this.points.data[idx + 7] = this._scratchLeftPoint.y; // screenLeftPositionY

            if (i == 0) {
                ctx.moveTo(this._scratchLeftPoint.x, this._scratchLeftPoint.y);
                const radius = currentWidth;
                const angleToRight = Math.atan2(this.points.data[idx + 5], this.points.data[idx + 4]);
                const angleToLeft = angleToRight + Math.PI;
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, angleToLeft, angleToRight, true);
            }
            previousIdx = idx; // Store the current index as the previous for the next iteration
        }

        // Backward pass: Draw left side using stored screen positions
        for (let i = lastPoint; i >= 0; i--) {
            const idx = this.points.getIndex(i);
            const leftX = this.points.data[idx + 6]; // screenLeftPositionX
            const leftY = this.points.data[idx + 7]; // screenLeftPositionY
            ctx.lineTo(leftX, leftY);
        }

        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawDebug(ctx, camera, shipPosition) {
        // Optional debug rendering
        if (this.debug) {
            ctx.fillStyle = 'red';
            ctx.strokeStyle = 'green';
            for (let i = 0; i < this.points.count; i++) {
                const idx = this.points.getIndex(i);
                this._scratchScreenPos.set(this.points.data[idx], this.points.data[idx + 1]);
                camera.worldToScreen(this._scratchScreenPos, this._scratchScreenPos);
                ctx.beginPath();
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();

                const endX = this._scratchScreenPos.x + this.points.data[idx + 2] * 10;
                const endY = this._scratchScreenPos.y + this.points.data[idx + 3] * 10;
                ctx.beginPath();
                ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            camera.worldToScreen(this._scratchEndPoint, this._scratchScreenPos);
            ctx.beginPath();
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = 'lightgreen';
            ctx.fill();
        }
    }
}