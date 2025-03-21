// trail.js

import { Vector2D } from './vector2d.js';

/**
 * Represents a point in a trail with position, direction, and distance properties.
 */
class TrailPoint {
    /**
     * Creates a new TrailPoint instance.
     * @param {Vector2D} [position=new Vector2D(0, 0)] - The position of the trail point. Defaults to (0, 0).
     * @param {Vector2D} [backwards=new Vector2D(0, 0)] - The backwards direction vector. Defaults to (0, 0).
     * @param {Vector2D} [right=new Vector2D(0, 0)] - The right direction vector. Defaults to (0, 0).
     * @param {number} [distance=0] - The distance from the previous point. Defaults to 0.
     */
    constructor(position = new Vector2D(0, 0), backwards = new Vector2D(0, 0), right = new Vector2D(0, 0), distance = 0) {
        this.position = position.clone();
        this.backwards = backwards.clone();
        this.right = right.clone();
        this.distance = distance;
    }

    clone() {
        return new TrailPoint(this.position, this.backwards, this.right, this.distance);
    }
}

/**
 * Represents a trail that follows a moving object, such as a ship.
 * The trail is composed of points that fade over time, creating a visual effect.
 */
export class Trail {
    /**
     * Creates a new Trail instance.
     * @param {Ship} parent - The object the trail follows (must have `position`, `angle`, and `maxVelocity` properties).
     * @param {number} [maxLength=250] - The soft maximum length of the trail before increased erosion.
     * @param {number} [startWidth=2] - The initial width of the trail in world units.
     * @param {string} [color='rgba(255, 255, 255, 0.5)'] - The color of the trail (CSS color string).
     */
    constructor(parent, maxLength = 250, startWidth = 2, color = 'rgba(255, 255, 255, 0.5)') {
        this.parent = parent;
        this.points = [];
        this.startWidth = startWidth;
        this.currentLength = 0;
        this.softMaxLength = maxLength;
        this.hardMaxLength = maxLength * 1.2;
        this.erosionSpeed = parent.maxVelocity * 0.5;
        this.minPointDist = 5;
        this.maxPointDist = 200;
        this.lateralThreshold = 2;
        this.color = color;

        // Reusable temporary vectors to reduce garbage collection
        this.tempVec1 = new Vector2D();
        this.tempVec2 = new Vector2D();
        this.tempVec3 = new Vector2D();

        // Precompute squared thresholds for efficiency
        this.minPointDistSquared = this.minPointDist * this.minPointDist;
        this.maxPointDistSquared = this.maxPointDist * this.maxPointDist;
        this.lateralThresholdSquared = this.lateralThreshold * this.lateralThreshold;
    }

    /**
     * Updates the trail based on the parent's movement and time elapsed.
     * @param {number} deltaTime - Time elapsed since the last update (in seconds).
     */
    update(deltaTime) {
        // Validate currentLength
        if (isNaN(this.currentLength)) {
            this.currentLength = 0;
        }

        // Erode trail length
        if (this.currentLength > this.hardMaxLength) {
            this.currentLength = this.hardMaxLength - this.erosionSpeed * deltaTime;
        } else if (this.currentLength > this.softMaxLength) {
            this.currentLength -= this.erosionSpeed * 2 * deltaTime;
        } else if (this.currentLength > 0) {
            const erosionFactor = Math.max(0.25, this.currentLength / this.softMaxLength);
            this.currentLength -= this.erosionSpeed * erosionFactor * deltaTime;
        }
        this.currentLength = Math.max(0, this.currentLength);

        // New point at parent's position
        const currentPoint = new TrailPoint(this.parent.position.clone());

        // Initialize with at least 2 points
        if (this.points.length < 2) {
            currentPoint.backwards.set(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            currentPoint.right.set(Math.sin(this.parent.angle), -Math.cos(this.parent.angle));
            currentPoint.distance = 1;
            this.addPoint(currentPoint);
            return;
        }

        const firstPoint = this.points[0];
        const secondPoint = this.points[1];

        // Use tempVec1 for relative position
        this.tempVec1.set(currentPoint.position).subtractInPlace(secondPoint.position);
        const distanceSquared = this.tempVec1.distanceSquaredTo(secondPoint.position); // Already computed via subtraction
        const distance = Math.sqrt(distanceSquared);

        let shouldAddPoint = false;

        // Conditions to add a new point
        if (firstPoint.distance > distance + 0.1) {
            shouldAddPoint = true;
        }
        if (distanceSquared > this.maxPointDistSquared) {
            shouldAddPoint = true;
        }
        if (distanceSquared > this.minPointDistSquared && !shouldAddPoint) {
            if (secondPoint.backwards) {
                // Compute forward vector in-place
                this.tempVec2.set(this.tempVec1).divideInPlace(distance);
                const dot = secondPoint.backwards.multiply(-1).dot(this.tempVec2);
                let minDot = distance <= this.lateralThreshold ? 0 : Math.sqrt(1 - (this.lateralThreshold / distance) ** 2);
                if (dot < minDot) {
                    shouldAddPoint = true;
                }
            }
        }

        if (shouldAddPoint) {
            // Compute distance to first point
            this.tempVec1.set(currentPoint.position).subtractInPlace(firstPoint.position);
            currentPoint.distance = this.tempVec1.magnitude() || 0;
            this.currentLength += currentPoint.distance;
            if (currentPoint.distance > 0.1) {
                currentPoint.backwards.set(this.tempVec1).multiplyInPlace(-1).divideInPlace(currentPoint.distance);
            } else {
                currentPoint.backwards.set(
                    firstPoint.backwards?.x ?? -Math.cos(this.parent.angle),
                    firstPoint.backwards?.y ?? -Math.sin(this.parent.angle)
                );
            }
            currentPoint.right.set(-currentPoint.backwards.y, currentPoint.backwards.x);
            this.addPoint(currentPoint);
        } else {
            // Update first point in-place
            firstPoint.position.set(currentPoint.position);
            this.currentLength += Math.abs(distance - (firstPoint.distance || 0));
            firstPoint.distance = distance;
            if (distance > 0.1) {
                firstPoint.backwards.set(this.tempVec1).multiplyInPlace(-1).divideInPlace(distance);
            } else {
                firstPoint.backwards.set(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            }
            firstPoint.right.set(-firstPoint.backwards.y, firstPoint.backwards.x);
        }
        this.trim();
    }

    /**
     * Adds a new point to the start of the trail.
     * @param {TrailPoint} newPoint - The point to add.
     */
    addPoint(newPoint) {
        this.points.unshift(newPoint.clone());
    }

    /**
     * Trims excess points from the end of the trail if it exceeds currentLength.
     */
    trim() {
        if (this.points.length <= 2) return;
        let totalDistance = 0;
        for (let i = 0; i < this.points.length; i++) {
            totalDistance += this.points[i].distance || 0;
            if (totalDistance > this.currentLength) {
                this.points.length = Math.max(2, Math.min(i + 2, this.points.length));
                break;
            }
        }
    }

    /**
     * Draws the trail on the canvas as a tapering polygon.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object with worldToScreen and worldToSize methods.
     */
    draw(ctx, camera) {
        if (this.points.length < 2) return;

        let totalDistance = 0;
        const rightPoints = [];
        const leftPoints = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            if (!point.right || !point.backwards) continue;

            const screenPos = camera.worldToScreen(point.position);
            const progress = Math.min(1, totalDistance / this.currentLength);
            const currentWidth = camera.worldToSize(this.startWidth) * (1 - progress);

            // Use temp vectors for right and left points
            this.tempVec1.set(point.right).multiplyInPlace(currentWidth).addInPlace(screenPos);
            rightPoints.push(this.tempVec1.clone());

            this.tempVec2.set(point.right).multiplyInPlace(-currentWidth).addInPlace(screenPos);
            leftPoints.unshift(this.tempVec2.clone());

            if (totalDistance + (point.distance || 0) > this.currentLength) {
                const remainingDistance = this.currentLength - totalDistance;
                if (remainingDistance < (point.distance || 0)) {
                    this.tempVec3.set(point.backwards).multiplyInPlace(remainingDistance).addInPlace(point.position);
                    const endPoint = camera.worldToScreen(this.tempVec3);
                    totalDistance += remainingDistance;
                    rightPoints.push(endPoint);
                }
                break;
            }
            totalDistance += point.distance || 0;
        }

        if (rightPoints.length < 1) return;

        ctx.beginPath();
        ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
        for (let i = 1; i < rightPoints.length; i++) {
            ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
        }
        for (let i = 0; i < leftPoints.length; i++) {
            ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        this.renderDebug(ctx, camera);
    }

    /**
     * Renders debug information (points and backwards vectors) on the canvas.
     * Currently commented out.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object with worldToScreen method.
     */
    renderDebug(ctx, camera) {
        // ctx.fillStyle = 'red';
        // ctx.strokeStyle = 'green';
        // for (const point of this.points) {
        //     const screenPos = camera.worldToScreen(point.position);
        //     ctx.beginPath();
        //     ctx.arc(screenPos.x, screenPos.y, 2, 0, Math.PI * 2);
        //     ctx.fill();

        //     if (point.backwards) {
        //         const endX = screenPos.x + point.backwards.x * 10;
        //         const endY = screenPos.y + point.backwards.y * 10;
        //         ctx.beginPath();
        //         ctx.moveTo(screenPos.x, screenPos.y);
        //         ctx.lineTo(endX, endY);
        //         ctx.stroke();
        //     }
        // }
    }
}