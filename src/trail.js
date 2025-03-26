// trail.js

import { Vector2D } from './vector2d.js';

/**
 * Ring buffer for trail points in a Float32Array.
 * Each point: [x, y, backX, backY, rightX, rightY, distance] (7 floats).
 */
class TrailPointPool {
    constructor(maxPoints = 300) {
        this.maxPoints = maxPoints;
        this.data = new Float32Array(maxPoints * 7);
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }

    clear() {
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }

    addPoint(position, backwards, right, distance) {
        if (this.count >= this.maxPoints) {
            this.expand();
        }
        const index = this.head * 7;
        this.data[index] = position.x;
        this.data[index + 1] = position.y;
        this.data[index + 2] = backwards.x;
        this.data[index + 3] = backwards.y;
        this.data[index + 4] = right.x;
        this.data[index + 5] = right.y;
        this.data[index + 6] = distance;
        this.head = (this.head + 1) % this.maxPoints;
        if (this.count === this.maxPoints) {
            this.tail = (this.tail + 1) % this.maxPoints;
        } else {
            this.count++;
        }
    }

    expand() {
        const newMaxPoints = this.maxPoints * 2;
        const newData = new Float32Array(newMaxPoints * 7);
        let oldIdx = this.tail * 7;
        for (let i = 0; i < this.count * 7; i++) {
            newData[i] = this.data[oldIdx];
            oldIdx = (oldIdx + 1) % (this.maxPoints * 7);
        }
        this.data = newData;
        this.tail = 0;
        this.head = this.count;
        this.maxPoints = newMaxPoints;
        console.log(`Expanded TrailPointPool to ${this.maxPoints} points`);
        return newMaxPoints;
    }

    getIndex(n) {
        return ((this.head - 1 - n + this.maxPoints) % this.maxPoints) * 7;
    }

    trim(targetTail) {
        if (targetTail > this.count + 2) {
            return;
        }
        this.tail = this.getIndex(targetTail);
        this.count = targetTail;
    }
}

/**
 * Trail class with corrected trim and togglable debug output.
 */
export class Trail {
    constructor(parent, maxLength = 250, startWidth = 2, color = 'rgba(255, 255, 255, 0.5)') {
        this.parent = parent;
        this.points = new TrailPointPool(20);
        this.startWidth = startWidth;
        this.currentLength = 0;
        this.softMaxLength = maxLength;
        this.hardMaxLength = this.softMaxLength * 1.2;
        this.erosionSpeed = parent.maxVelocity * 0.5;
        this.minPointDist = 2;
        this.maxPointDist = 200;
        this.lateralThreshold = 2;
        this.color = color;

        this.renderPool = new Float32Array(40); // Left points only
        this.renderCount = 0;

        this._scratchRelativePos = new Vector2D();
        this._scratchForwardVec = new Vector2D();
        this._scratchScreenPos = new Vector2D();
        this._scratchRightPoint = new Vector2D();
        this._scratchLeftPoint = new Vector2D();
        this._scratchEndPoint = new Vector2D();
        this._scratchTemp = new Vector2D();

        this.minPointDistSquared = this.minPointDist * this.minPointDist;
        this.maxPointDistSquared = this.maxPointDist * this.maxPointDist;
        this.lateralThresholdSquared = this.lateralThreshold * this.lateralThreshold;
    }

    update(deltaTime) {
        if (isNaN(this.currentLength)) this.currentLength = 0;

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

        if (this.points.count < 2) {
            this._scratchForwardVec.set(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            this._scratchRightPoint.set(Math.sin(this.parent.angle), -Math.cos(this.parent.angle));
            this.points.addPoint(this.parent.position, this._scratchForwardVec, this._scratchRightPoint, 1);
            this.currentLength += 1;
            return;
        }

        const firstIdx = this.points.getIndex(0);
        const secondIdx = this.points.getIndex(1);

        this._scratchRelativePos.set(this.parent.position.x - this.points.data[secondIdx],
            this.parent.position.y - this.points.data[secondIdx + 1]);
        const distanceSquared = this._scratchRelativePos.squareMagnitude();
        const distance = Math.sqrt(distanceSquared);

        let shouldAddPoint = false;

        if (this.points.data[firstIdx + 6] > distance + 0.1) {
            shouldAddPoint = true;
        }
        if (distanceSquared > this.maxPointDistSquared) {
            shouldAddPoint = true;
        }
        if (distanceSquared > this.minPointDistSquared && !shouldAddPoint) {
            this._scratchForwardVec.set(this._scratchRelativePos).divideInPlace(distance);
            this._scratchTemp.set(-this.points.data[secondIdx + 2], -this.points.data[secondIdx + 3]);
            const dot = this._scratchTemp.dot(this._scratchForwardVec);
            const minDot = distance <= this.lateralThreshold ? 0 : Math.sqrt(1 - (this.lateralThreshold / distance) ** 2);
            if (dot < minDot) {
                shouldAddPoint = true;
            }
        }

        if (shouldAddPoint) {
            this._scratchRelativePos.set(this.parent.position.x - this.points.data[firstIdx],
                this.parent.position.y - this.points.data[firstIdx + 1]);
            const newDistance = this._scratchRelativePos.magnitude() || 0;
            this.currentLength += newDistance;
            if (newDistance > 0.1) {
                this._scratchForwardVec.set(this._scratchRelativePos).multiplyInPlace(-1).divideInPlace(newDistance);
            } else {
                this._scratchForwardVec.set(this.points.data[firstIdx + 2], this.points.data[firstIdx + 3]);
            }
            this._scratchRightPoint.set(-this._scratchForwardVec.y, this._scratchForwardVec.x);
            this.points.addPoint(this.parent.position, this._scratchForwardVec, this._scratchRightPoint, newDistance);
        } else {
            this.currentLength += Math.abs(distance - this.points.data[firstIdx + 6]);
            this.points.data[firstIdx] = this.parent.position.x;
            this.points.data[firstIdx + 1] = this.parent.position.y;
            this.points.data[firstIdx + 6] = distance;
            if (distance > 0.1) {
                this._scratchForwardVec.set(this._scratchRelativePos).multiplyInPlace(-1).divideInPlace(distance);
            } else {
                this._scratchForwardVec.set(-Math.cos(this.parent.angle), -Math.sin(this.parent.angle));
            }
            this.points.data[firstIdx + 2] = this._scratchForwardVec.x;
            this.points.data[firstIdx + 3] = this._scratchForwardVec.y;
            this.points.data[firstIdx + 4] = -this._scratchForwardVec.y;
            this.points.data[firstIdx + 5] = this._scratchForwardVec.x;
        }

        // Trim like original
        if (this.points.count > 2) {
            let totalDistance = 0;
            for (let i = 0; i < this.points.count; i++) {
                const idx = this.points.getIndex(i);
                totalDistance += this.points.data[idx + 6] || 0;
                if (totalDistance > this.currentLength) {
                    this.points.trim(i + 1);
                    break;
                }
            }
        }
    }

    expandRenderPool(requiredSize) {
        const currentCapacity = this.renderPool.length / 2;
        if (requiredSize <= currentCapacity) return;
        const newCapacity = Math.max(requiredSize, currentCapacity + 10);
        const newPool = new Float32Array(newCapacity * 2);
        newPool.set(this.renderPool);
        this.renderPool = newPool;
        console.log(`Expanded renderPool to ${newCapacity} points`);
    }

    draw(ctx, camera) {
        if (this.points.count < 2) return;

        this.renderCount = 0;
        let totalDistance = 0;
        let startDrawing = false;

        ctx.beginPath();

        for (let i = 0; i < this.points.count; i++) {
            const idx = this.points.getIndex(i);
            this._scratchScreenPos.set(this.points.data[idx], this.points.data[idx + 1]);
            camera.worldToScreen(this._scratchScreenPos, this._scratchScreenPos);
            const progress = Math.min(1, totalDistance / this.currentLength);
            const currentWidth = camera.worldToSize(this.startWidth) * (1 - progress);

            this._scratchRightPoint.set(this.points.data[idx + 4], this.points.data[idx + 5])
                .multiplyInPlace(currentWidth)
                .addInPlace(this._scratchScreenPos);
            if (!startDrawing) {
                ctx.moveTo(this._scratchRightPoint.x, this._scratchRightPoint.y);
                startDrawing = true;
            } else {
                ctx.lineTo(this._scratchRightPoint.x, this._scratchRightPoint.y);
            }

            this._scratchLeftPoint.set(this.points.data[idx + 4], this.points.data[idx + 5])
                .multiplyInPlace(-currentWidth)
                .addInPlace(this._scratchScreenPos);
            if (this.renderCount >= this.renderPool.length / 2) this.expandRenderPool(this.renderCount + 1);
            this.renderPool[this.renderCount * 2] = this._scratchLeftPoint.x;
            this.renderPool[this.renderCount * 2 + 1] = this._scratchLeftPoint.y;
            this.renderCount++;

            totalDistance += this.points.data[idx + 6];
            if (totalDistance > this.currentLength) {
                const remainingDistance = this.currentLength - (totalDistance - this.points.data[idx + 6]);
                if (remainingDistance < this.points.data[idx + 6]) {
                    this._scratchEndPoint.set(this.points.data[idx + 2], this.points.data[idx + 3])
                        .multiplyInPlace(camera.worldToSize(remainingDistance))
                        .addInPlace(this._scratchScreenPos);
                    ctx.lineTo(this._scratchEndPoint.x, this._scratchEndPoint.y);
                }
                break;
            }
        }

        for (let i = this.renderCount - 1; i >= 0; i--) {
            ctx.lineTo(this.renderPool[i * 2], this.renderPool[i * 2 + 1]);
        }

        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        // Debug rendering, toggled by parent.debug
        if (this.parent.debug) {
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