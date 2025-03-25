// trail.js

import { Vector2D } from './vector2d.js';

/**
 * Represents a point in a trail with position, direction, and distance properties.
 */
class TrailPoint {
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

        // Reusable temporary vectors with descriptive names to eliminate allocations in main loop
        this._scratchRelativePos = new Vector2D(); // Relative position between points in update
        this._scratchForwardVec = new Vector2D(); // Forward direction in update
        this._scratchScreenPos = new Vector2D(); // Screen position in draw
        this._scratchRightPoint = new Vector2D(); // Right-side trail points in draw
        this._scratchLeftPoint = new Vector2D(); // Left-side trail points in draw
        this._scratchEndPoint = new Vector2D(); // Trail end point in draw
        this._scratchTemp = new Vector2D(); // Temporary vector for intermediate calculations

        // Precompute squared thresholds for efficiency
        this.minPointDistSquared = this.minPointDist * this.minPointDist;
        this.maxPointDistSquared = this.maxPointDist * this.maxPointDist;
        this.lateralThresholdSquared = this.lateralThreshold * this.lateralThreshold;
    }

    update(deltaTime) {
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

        // New point at parent's position (allocated once per point addition, not every frame)
        const currentPoint = new TrailPoint(this.parent.position.clone());

        if (this.points.length < 2) {
            currentPoint.backwards.set(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            currentPoint.right.set(Math.sin(this.parent.angle), -Math.cos(this.parent.angle));
            currentPoint.distance = 1;
            this.addPoint(currentPoint);
            return;
        }

        const firstPoint = this.points[0];
        const secondPoint = this.points[1];

        this._scratchRelativePos.set(currentPoint.position).subtractInPlace(secondPoint.position);
        const distanceSquared = this._scratchRelativePos.squareMagnitude();
        const distance = Math.sqrt(distanceSquared);

        let shouldAddPoint = false;

        if (firstPoint.distance > distance + 0.1) {
            shouldAddPoint = true;
        }
        if (distanceSquared > this.maxPointDistSquared) {
            shouldAddPoint = true;
        }
        if (distanceSquared > this.minPointDistSquared && !shouldAddPoint) {
            if (secondPoint.backwards) {
                this._scratchForwardVec.set(this._scratchRelativePos).divideInPlace(distance);
                this._scratchTemp.set(secondPoint.backwards).multiplyInPlace(-1); // Replace multiply(-1)
                const dot = this._scratchTemp.dot(this._scratchForwardVec);
                let minDot = distance <= this.lateralThreshold ? 0 : Math.sqrt(1 - (this.lateralThreshold / distance) ** 2);
                if (dot < minDot) {
                    shouldAddPoint = true;
                }
            }
        }

        if (shouldAddPoint) {
            this._scratchRelativePos.set(currentPoint.position).subtractInPlace(firstPoint.position);
            currentPoint.distance = this._scratchRelativePos.magnitude() || 0;
            this.currentLength += currentPoint.distance;
            if (currentPoint.distance > 0.1) {
                currentPoint.backwards.set(this._scratchRelativePos)
                    .multiplyInPlace(-1)
                    .divideInPlace(currentPoint.distance);
            } else {
                currentPoint.backwards.set(
                    firstPoint.backwards?.x ?? -Math.cos(this.parent.angle),
                    firstPoint.backwards?.y ?? -Math.sin(this.parent.angle)
                );
            }
            currentPoint.right.set(-currentPoint.backwards.y, currentPoint.backwards.x);
            this.addPoint(currentPoint);
        } else {
            firstPoint.position.set(currentPoint.position);
            this.currentLength += Math.abs(distance - (firstPoint.distance || 0));
            firstPoint.distance = distance;
            if (distance > 0.1) {
                firstPoint.backwards.set(this._scratchRelativePos)
                    .multiplyInPlace(-1)
                    .divideInPlace(distance);
            } else {
                firstPoint.backwards.set(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            }
            firstPoint.right.set(-firstPoint.backwards.y, firstPoint.backwards.x);
        }
        this.trim();
    }

    addPoint(newPoint) {
        this.points.unshift(newPoint.clone());
    }

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

    draw(ctx, camera) {
        if (this.points.length < 2) return;

        let totalDistance = 0;
        const rightPoints = [];
        const leftPoints = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            if (!point.right || !point.backwards) continue;

            camera.worldToScreen(point.position, this._scratchScreenPos);
            const progress = Math.min(1, totalDistance / this.currentLength);
            const currentWidth = camera.worldToSize(this.startWidth) * (1 - progress);

            this._scratchRightPoint.set(point.right)
                .multiplyInPlace(currentWidth)
                .addInPlace(this._scratchScreenPos);
            rightPoints.push(this._scratchRightPoint.clone());

            this._scratchLeftPoint.set(point.right)
                .multiplyInPlace(-currentWidth)
                .addInPlace(this._scratchScreenPos);
            leftPoints.unshift(this._scratchLeftPoint.clone());

            if (totalDistance + (point.distance || 0) > this.currentLength) {
                const remainingDistance = this.currentLength - totalDistance;
                if (remainingDistance < (point.distance || 0)) {
                    this._scratchEndPoint.set(point.backwards)
                        .multiplyInPlace(remainingDistance)
                        .addInPlace(point.position);
                    camera.worldToScreen(this._scratchEndPoint, this._scratchEndPoint);
                    totalDistance += remainingDistance;
                    rightPoints.push(this._scratchEndPoint.clone());
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

    renderDebug(ctx, camera) {
        // Debug rendering remains commented out
    }
}