// trail.js

import { Vector2D } from './vector2d.js';

/**
 * A ring buffer managing trail points in a Float32Array.
 * Each point stores 9 floats: [x, y, backX, backY, rightX, rightY, distance, screenLeftPositionX, screenLeftPositionY].
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
        this.data = new Float32Array(maxPoints * 9); // Updated to 9 floats per point
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
     * @param {number} distance - Distance to the previous point.
     */
    addPoint(position, backwards, right, distance) {
        if (this.count >= this.maxPoints) {
            this.expand();
        }
        const index = this.head * 9; // Each point now uses 9 floats
        this.data[index] = position.x;
        this.data[index + 1] = position.y;
        this.data[index + 2] = backwards.x;
        this.data[index + 3] = backwards.y;
        this.data[index + 4] = right.x;
        this.data[index + 5] = right.y;
        this.data[index + 6] = distance;
        this.data[index + 7] = 0; // screenLeftPositionX (to be set during draw)
        this.data[index + 8] = 0; // screenLeftPositionY (to be set during draw)
        this.head = (this.head + 1) % this.maxPoints; // Wrap around if at end
        if (this.count === this.maxPoints) {
            this.tail = (this.tail + 1) % this.maxPoints; // Shift tail if full
        } else {
            this.count++; // Increment count until full
        }
    }

    /**
     * Doubles the buffer size when full, copying existing points.
     * @returns {number} The new maximum number of points.
     */
    expand() {
        const newMaxPoints = this.maxPoints * 2;
        const newData = new Float32Array(newMaxPoints * 9); // Updated to 9 floats per point
        let oldIdx = this.tail * 9; // Adjust for new size
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
        return ((this.head - 1 - n + this.maxPoints) % this.maxPoints) * 9; // Updated to 9 floats per point
    }

    /**
     * Trims the trail to keep only the first targetTail points from head.
     * @param {number} targetTail - Number of points to keep (sets new tail).
     */
    trim(targetTail) {
        if (targetTail > this.count + 2) {
            return; // Prevent over-trimming beyond current count
        }
        this.tail = this.getIndex(targetTail); // Set tail to the target point’s index
        this.count = targetTail; // Adjust count to match points kept
    }
}

/**
 * A trail renderer for a parent object (e.g., ship), with ring buffer management.
 */
export class Trail {
    /**
     * Creates a new Trail instance.
     * @param {number} [maxLength=250] - Maximum length of the trail before erosion.
     * @param {number} [startWidth=2] - Initial width of the trail in world units.
     * @param {string} [color='rgba(255, 255, 255, 0.5)'] - CSS color for the trail fill.
     */
    constructor(maxLength = 250, erosionSpeed, startWidth = 2, color = 'rgba(255, 255, 255, 0.5)') {
        /** @type {TrailPointPool} Ring buffer for trail points. */
        this.points = new TrailPointPool(20);
        /** @type {number} Starting width of the trail in world units. */
        this.startWidth = startWidth;
        /** @type {number} Current total length of the trail. */
        this.currentLength = 0;
        /** @type {number} Soft maximum length before faster erosion begins. */
        this.softMaxLength = maxLength;
        /** @type {number} Hard maximum length, beyond which trail is capped. */
        this.hardMaxLength = this.softMaxLength * 1.2;
        /** @type {number} Speed at which the trail erodes, based on parent velocity. */
        this.erosionSpeed = erosionSpeed;
        /** @type {number} Minimum distance between points to add a new one. */
        this.minPointDist = 2;
        /** @type {number} Maximum distance before forcing a new point. */
        this.maxPointDist = 200;
        /** @type {number} Threshold for lateral movement to add a point. */
        this.lateralThreshold = 2;
        /** @type {string} Color of the trail fill. */
        this.color = color;
        /** @type {boolean} Shpuild we draw debug?. */
        this.debug = false;

        // Scratch vectors for temporary calculations
        /** @type {Vector2D} Temporary vector for relative position. */
        this._scratchRelativePos = new Vector2D();
        /** @type {Vector2D} Temporary vector for forward direction. */
        this._scratchForwardVec = new Vector2D();
        /** @type {Vector2D} Temporary vector for screen position. */
        this._scratchScreenPos = new Vector2D();
        /** @type {Vector2D} Temporary vector for right point. */
        this._scratchRightPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for left point. */
        this._scratchLeftPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for endpoint calculation. */
        this._scratchEndPoint = new Vector2D();
        /** @type {Vector2D} Temporary vector for miscellaneous use. */
        this._scratchTemp = new Vector2D();

        // Precomputed squared thresholds for performance
        this.minPointDistSquared = this.minPointDist * this.minPointDist;
        this.maxPointDistSquared = this.maxPointDist * this.maxPointDist;
        this.lateralThresholdSquared = this.lateralThreshold * this.lateralThreshold;
    }

    /**
     * Updates the trail state based on parent movement and time elapsed.
     * @param {number} deltaTime - Time elapsed since last update (in seconds).
     */
    update(deltaTime, currentPostion, currentAngle, debug) {
        this.debug = debug;
        if (isNaN(this.currentLength)) this.currentLength = 0;
        //Push back any points we have
        let lastPoint = this.points.count;
        for (let i = 0; i < lastPoint; i++) {
            const idx = this.points.getIndex(i);
            this._scratchEndPoint.set(this.points.data[idx + 2], this.points.data[idx + 3]).multiplyInPlace(10 * deltaTime);
            //this._scratchLeftPoint.set(this.points.data[idx + 4], this.points.data[idx + 5]).multiplyInPlace(Math.sin((this.points.data[idx] + this.points.data[idx + 1]) * 3) * 100 * deltaTime);
            this.points.data[idx] += this._scratchEndPoint.x;// + this._scratchLeftPoint.x;
            this.points.data[idx + 1] += this._scratchEndPoint.y;// + this._scratchLeftPoint.y;
        }

        // Erode trail length over time
        if (this.currentLength > this.hardMaxLength) {
            this.currentLength = this.hardMaxLength - this.erosionSpeed * deltaTime;
        } else if (this.currentLength > this.softMaxLength) {
            this.currentLength -= this.erosionSpeed * 2 * deltaTime;
        } else if (this.currentLength > 0) {
            const erosionFactor = Math.max(0.25, this.currentLength / this.softMaxLength);
            this.currentLength -= this.erosionSpeed * erosionFactor * deltaTime;
        }
        this.currentLength = Math.max(0, this.currentLength);

        // Initialize with at least 2 points
        if (this.points.count < 2) {
            const cosAngle = Math.cos(currentAngle);
            const sinAngle = Math.sin(currentAngle);
            this._scratchForwardVec.set(sinAngle, -cosAngle); // Forward is up
            this._scratchRightPoint.set(-cosAngle, -sinAngle); // Right is perpendicular
            this.points.addPoint(currentPostion, this._scratchForwardVec, this._scratchRightPoint, 1);
            this.currentLength += 1;
            return;
        }

        const firstIdx = this.points.getIndex(0); // Newest point
        const secondIdx = this.points.getIndex(1); // Second newest

        // Calculate distance from second-to-last point to parent
        this._scratchRelativePos.set(currentPostion.x - this.points.data[secondIdx],
            currentPostion.y - this.points.data[secondIdx + 1]);
        const distanceSquared = this._scratchRelativePos.squareMagnitude();
        const distance = Math.sqrt(distanceSquared);

        let shouldAddPoint = false;

        // Conditions to add a new point
        if (this.points.data[firstIdx + 6] > distance + 0.1) { // Distance shrinking
            shouldAddPoint = true;
        }
        if (distanceSquared > this.maxPointDistSquared) { // Exceeds max distance
            shouldAddPoint = true;
        }
        if (distanceSquared > this.minPointDistSquared && !shouldAddPoint) { // Lateral movement check
            this._scratchForwardVec.set(this._scratchRelativePos).divideInPlace(distance);
            this._scratchTemp.set(-this.points.data[secondIdx + 2], -this.points.data[secondIdx + 3]);
            const dot = this._scratchTemp.dot(this._scratchForwardVec);
            const minDot = distance <= this.lateralThreshold ? 0 : Math.sqrt(1 - (this.lateralThreshold / distance) ** 2);
            if (dot < minDot) {
                shouldAddPoint = true;
            }
        }

        if (shouldAddPoint) {
            // Add new point at parent position
            this._scratchRelativePos.set(currentPostion.x - this.points.data[firstIdx],
                currentPostion.y - this.points.data[firstIdx + 1]);
            const newDistance = this._scratchRelativePos.magnitude() || 0;
            this.currentLength += newDistance;
            if (newDistance > 0.1) {
                this._scratchForwardVec.set(this._scratchRelativePos).multiplyInPlace(-1).divideInPlace(newDistance);
            } else {
                this._scratchForwardVec.set(this.points.data[firstIdx + 2], this.points.data[firstIdx + 3]);
            }
            this._scratchRightPoint.set(-this._scratchForwardVec.y, this._scratchForwardVec.x);
            this.points.addPoint(currentPostion, this._scratchForwardVec, this._scratchRightPoint, newDistance);
        } else {
            // Update newest point’s position
            this.currentLength += Math.abs(distance - this.points.data[firstIdx + 6]);
            this.points.data[firstIdx] = currentPostion.x;
            this.points.data[firstIdx + 1] = currentPostion.y;
            this.points.data[firstIdx + 6] = distance;
            if (distance > 0.1) {
                this._scratchForwardVec.set(this._scratchRelativePos).multiplyInPlace(-1).divideInPlace(distance);
            } else {
                this._scratchForwardVec.set(Math.sin(currentAngle), -Math.cos(currentAngle));
            }
            this.points.data[firstIdx + 2] = this._scratchForwardVec.x;
            this.points.data[firstIdx + 3] = this._scratchForwardVec.y;
            this.points.data[firstIdx + 4] = -this._scratchForwardVec.y;
            this.points.data[firstIdx + 5] = this._scratchForwardVec.x;
        }

        // Trim points exceeding currentLength, keeping at least 2
        if (this.points.count > 2) {
            let totalDistance = 0;
            for (let i = 0; i < this.points.count; i++) {
                const idx = this.points.getIndex(i);
                totalDistance += this.points.data[idx + 6] || 0;
                if (totalDistance > this.currentLength) {
                    this.points.trim(i + 2); // Keep i + 2 points
                    break;
                }
            }
        }
    }

    /**
     * Draws the trail as a filled polygon on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The 2D canvas rendering context.
     * @param {Object} camera - Camera object with worldToScreen and worldToSize methods.
     */
    draw(ctx, camera, shipPosition) {
        if (this.points.count < 2 || this.currentLength < 1) return;

        let totalDistance = 0;

        ctx.beginPath();
        camera.worldToScreen(shipPosition, this._scratchScreenPos);
        ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);

        let lastPoint = this.points.count;
        // Forward pass: Draw right side, calculate and store left positions
        for (let i = 0; i < lastPoint; i++) {
            const idx = this.points.getIndex(i);
            this._scratchScreenPos.set(this.points.data[idx], this.points.data[idx + 1]);
            camera.worldToScreen(this._scratchScreenPos, this._scratchScreenPos);
            const progress = Math.min(1, totalDistance / this.currentLength);
            const currentWidth = camera.worldToSize(this.startWidth) * (1 - progress);

            // Calculate right point for drawing
            this._scratchRightPoint.set(this.points.data[idx + 4], this.points.data[idx + 5])
                .multiplyInPlace(currentWidth)
                .addInPlace(this._scratchScreenPos);
            ctx.lineTo(this._scratchRightPoint.x, this._scratchRightPoint.y);


            // Calculate left point and store in ring buffer
            this._scratchLeftPoint.set(this.points.data[idx + 4], this.points.data[idx + 5])
                .multiplyInPlace(-currentWidth)
                .addInPlace(this._scratchScreenPos);
            this.points.data[idx + 7] = this._scratchLeftPoint.x; // screenLeftPositionX
            this.points.data[idx + 8] = this._scratchLeftPoint.y; // screenLeftPositionY

            totalDistance += this.points.data[idx + 6];
            if (totalDistance > this.currentLength) {
                const remainingDistance = this.currentLength - (totalDistance - this.points.data[idx + 6]);
                if (remainingDistance < this.points.data[idx + 6]) {
                    this._scratchEndPoint.set(this.points.data[idx + 2], this.points.data[idx + 3])
                        .multiplyInPlace(camera.worldToSize(remainingDistance))
                        .addInPlace(this._scratchScreenPos);
                    ctx.lineTo(this._scratchEndPoint.x, this._scratchEndPoint.y);
                }
                lastPoint = i;
                break;
            }
        }

        // Backward pass: Draw left side using stored screen positions
        for (let i = lastPoint; i >= 0; i--) {
            const idx = this.points.getIndex(i);
            const leftX = this.points.data[idx + 7]; // screenLeftPositionX
            const leftY = this.points.data[idx + 8]; // screenLeftPositionY
            ctx.lineTo(leftX, leftY);
        }

        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        // Optional debug rendering, toggled by parent.debug
        if (this.debug) {
            ctx.fillStyle = 'red';
            ctx.strokeStyle = 'green';
            for (let i = 0; i < this.points.count; i++) {
                const idx = this.points.getIndex(i);
                this._scratchScreenPos.set(this.points.data[idx], this.points.data[idx + 1]);
                camera.worldToScreen(this._scratchScreenPos, this._scratchScreenPos);
                ctx.beginPath();
                ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, 2, 0, Math.PI * 2);
                ctx.fill();

                const endX = this._scratchScreenPos.x + this.points.data[idx + 2] * 10;
                const endY = this._scratchScreenPos.y + this.points.data[idx + 3] * 10;
                ctx.beginPath();
                ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
    }
}