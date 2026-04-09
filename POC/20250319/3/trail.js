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
        this.parent = parent; // The object the trail is attached to
        this.points = []; // Array of TrailPoint instances
        this.startWidth = startWidth; // Initial width of the trail
        this.currentLength = 0; // Current total length of the trail
        this.softMaxLength = maxLength; // Soft maximum length before erosion increases
        this.hardMaxLength = maxLength * 1.2; // Hard maximum length before immediate trimming
        this.erosionSpeed = parent.maxVelocity * 0.5; // Rate at which the trail erodes
        this.minPointDist = 5; // Minimum distance between points to add a new one
        this.maxPointDist = 200; // Maximum distance between points before forcing a new one
        this.lateralThreshold = 2; // Threshold for lateral movement to trigger a new point
        this.color = color; // Color of the trail
    }

    /**
     * Updates the trail based on the parent's movement and time elapsed.
     * @param {number} deltaTime - Time elapsed since the last update (in seconds).
     */
    update(deltaTime) {
        // Ensure currentLength is valid
        if (isNaN(this.currentLength)) {
            this.currentLength = 0;
        }

        // Erode the trail length over time
        if (this.currentLength > this.hardMaxLength) {
            this.currentLength = this.hardMaxLength - this.erosionSpeed * deltaTime;
        } else if (this.currentLength > this.softMaxLength) {
            this.currentLength -= this.erosionSpeed * 2 * deltaTime;
        } else if (this.currentLength > 0) {
            const erosionFactor = Math.max(0.25, this.currentLength / this.softMaxLength);
            this.currentLength -= this.erosionSpeed * erosionFactor * deltaTime;
        }
        this.currentLength = Math.max(0, this.currentLength);

        // Create a new point at the parent's current position
        const currentPoint = new TrailPoint(this.parent.position);

        // Initialize trail with at least 2 points
        if (this.points.length < 2) {
            currentPoint.backwards = new Vector2D(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            currentPoint.right = new Vector2D(Math.sin(this.parent.angle), -Math.cos(this.parent.angle));
            currentPoint.distance = 1;
            this.addPoint(currentPoint);
            return;
        }

        const firstPoint = this.points[0];
        const secondPoint = this.points[1];
        const relativePosition = currentPoint.position.subtract(secondPoint.position);
        const distance = relativePosition.magnitude();

        let shouldAddPoint = false;

        // Conditions to add a new point
        if (firstPoint.distance > distance + 0.1) {
            shouldAddPoint = true; // First point is too far ahead
        }
        if (distance > this.maxPointDist) {
            shouldAddPoint = true; // Distance exceeds maximum threshold
        }
        if (distance > this.minPointDist && !shouldAddPoint) {
            if (secondPoint.backwards) {
                const forward = relativePosition.divide(distance);
                const dot = secondPoint.backwards.multiply(-1).dot(forward);
                let minDot = distance <= this.lateralThreshold ? 0 : Math.sqrt(1 - (this.lateralThreshold / distance) ** 2);
                if (dot < minDot) {
                    shouldAddPoint = true; // Significant lateral movement detected
                }
            }
        }

        if (shouldAddPoint) {
            const relativeFirstPosition = currentPoint.position.subtract(firstPoint.position);
            currentPoint.distance = relativeFirstPosition.magnitude() || 0;
            this.currentLength += currentPoint.distance;
            if (currentPoint.distance > 0.1) {
                currentPoint.backwards = relativeFirstPosition.multiply(-1).divide(currentPoint.distance);
            } else {
                currentPoint.backwards = new Vector2D(
                    firstPoint.backwards?.x ?? -Math.cos(this.parent.angle),
                    firstPoint.backwards?.y ?? -Math.sin(this.parent.angle)
                );
            }
            currentPoint.right = new Vector2D(-currentPoint.backwards.y, currentPoint.backwards.x);
            this.addPoint(currentPoint);
        } else {
            // Update the first point instead of adding a new one
            firstPoint.position = currentPoint.position;
            this.currentLength += Math.abs(distance - (firstPoint.distance || 0));
            firstPoint.distance = distance;
            if (distance > 0.1) {
                firstPoint.backwards = relativePosition.multiply(-1).divide(distance);
            } else {
                firstPoint.backwards = new Vector2D(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            }
            firstPoint.right = new Vector2D(-firstPoint.backwards.y, firstPoint.backwards.x);
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

            rightPoints.push(point.right.multiply(currentWidth).add(screenPos));
            leftPoints.unshift(point.right.multiply(-currentWidth).add(screenPos));

            if (totalDistance + (point.distance || 0) > this.currentLength) {
                const remainingDistance = this.currentLength - totalDistance;
                if (remainingDistance < (point.distance || 0)) {
                    const endPoint = camera.worldToScreen(point.position.add(point.backwards.multiply(remainingDistance)));
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