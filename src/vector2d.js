// vector2d.js

/**
 * Represents a 2D vector with x and y components.
 * Can also be used to represent dimensions with width and height aliases for x and y, respectively.
 */
export class Vector2D {
    /**
     * Creates a new Vector2D instance.
     * @param {number} [x=0] - The x component of the vector.
     * @param {number} [y=0] - The y component of the vector.
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * Gets the width of the vector (alias for x).
     * @returns {number} The x component.
     */
    get width() { return this.x; }

    /**
     * Sets the width of the vector (alias for x).
     * @param {number} value - The new x component.
     */
    set width(value) { this.x = value; }

    /**
     * Gets the height of the vector (alias for y).
     * @returns {number} The y component.
     */
    get height() { return this.y; }

    /**
     * Sets the height of the vector (alias for y).
     * @param {number} value - The new y component.
     */
    set height(value) { this.y = value; }

    /**
     * Adds another vector to this vector and returns a new Vector2D.
     * @param {Vector2D} other - The vector to add.
     * @throws {Error} Always throws; use addInPlace to avoid allocations.
     */
    add(other) {
        throw new Error("Use addInPlace to avoid allocations");
    }

    /**
     * Subtracts another vector from this vector and returns a new Vector2D.
     * @param {Vector2D} other - The vector to subtract.
     * @throws {Error} Always throws; use subtractInPlace to avoid allocations.
     */
    subtract(other) {
        throw new Error("Use subtractInPlace to avoid allocations");
    }

    /**
     * Multiplies this vector by a scalar and returns a new Vector2D.
     * @param {number} scalar - The scalar to multiply by.
     * @throws {Error} Always throws; use multiplyInPlace to avoid allocations.
     */
    multiply(scalar) {
        throw new Error("Use multiplyInPlace to avoid allocations");
    }

    /**
     * Normalizes this vector and returns a new Vector2D.
     * @throws {Error} Always throws; use normalizeInPlace to avoid allocations.
     */
    normalize() {
        throw new Error("Use normalizeInPlace to avoid allocations");
    }

    /**
     * Calculates the magnitude (length) of the vector.
     * @returns {number} The magnitude (square root of squared components).
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Estimates the magnitude without using square root.
     * @returns {number} The estimated magnitude using alpha-beta approximation.
     */
    magnitudeEstimate() {
        const absX = Math.abs(this.x);
        const absY = Math.abs(this.y);
        const maxVal = Math.max(absX, absY);
        const minVal = Math.min(absX, absY);
        return 1.0 * maxVal + 0.4 * minVal;
    }

    /**
     * Calculates the squared magnitude of the vector.
     * More efficient than magnitude() for distance comparisons.
     * @returns {number} The squared magnitude.
     */
    squareMagnitude() {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * Computes the dot product of this vector and another vector.
     * @param {Vector2D} other - The other vector.
     * @returns {number} The dot product.
     */
    dot(other) {
        return this.x * other.x + this.y * other.y;
    }

    /**
     * Divides this vector by a scalar and returns a new vector.
     * @param {number} scalar - The scalar to divide by.
     * @throws {Error} Always throws; use divideInPlace to avoid allocations.
     */
    divide(scalar) {
        throw new Error("Use divideInPlace to avoid allocations");
    }

    /**
     * Creates a copy of this vector.
     * @returns {Vector2D} A new Vector2D with the same x and y values.
     */
    clone() {
        return new Vector2D(this.x, this.y);
    }

    /**
     * Linearly interpolates between two vectors, returning a new vector.
     * @param {Vector2D} source - The starting vector.
     * @param {Vector2D} target - The target vector.
     * @param {number} factor - Interpolation factor (0 = source, 1 = target).
     * @throws {Error} Always throws; use lerpInPlace to avoid allocations.
     */
    lerp(source, target, factor) {
        throw new Error("Use lerpInPlace to avoid allocations");
    }

    /**
     * Sets the components of this vector.
     * @param {number|Vector2D} xOrVector - The x component or another Vector2D.
     * @param {number} [y] - The y component (required if xOrVector is a number).
     * @throws {Error} If y is undefined when xOrVector is a number.
     * @returns {Vector2D} This vector, for chaining.
     */
    set(xOrVector, y) {
        if (xOrVector instanceof Vector2D) {
            this.x = xOrVector.x;
            this.y = xOrVector.y;
        } else {
            if (y === undefined) throw new Error("y must be provided when xOrVector is a number");
            this.x = xOrVector;
            this.y = y;
        }
        return this;
    }

    /**
     * Sets this vector from polar coordinates.
     * @param {number} radius - The radial distance from origin.
     * @param {number} angle - The angle in radians.
     * @returns {Vector2D} This vector, for chaining.
     */
    setFromPolar(radius, angle) {
        // Compute x and y for upward direction
        this.x = radius * Math.sin(angle);
        this.y = -radius * Math.cos(angle);
        return this;
    }

    /**
     * Adds another vector to this vector in-place.
     * @param {Vector2D} other - The vector to add.
     * @returns {Vector2D} This vector, for chaining.
     */
    addInPlace(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    /**
     * Subtracts another vector from this vector in-place.
     * @param {Vector2D} other - The vector to subtract.
     * @returns {Vector2D} This vector, for chaining.
     */
    subtractInPlace(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    /**
     * Multiplies this vector by a scalar in-place.
     * @param {number} scalar - The scalar to multiply by.
     * @returns {Vector2D} This vector, for chaining.
     */
    multiplyInPlace(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    /**
     * Divides this vector by a scalar in-place.
     * @param {number} scalar - The scalar to divide by.
     * @throws {Error} If scalar is zero.
     * @returns {Vector2D} This vector, for chaining.
     */
    divideInPlace(scalar) {
        if (scalar === 0) throw new Error("Cannot divide by zero");
        this.x /= scalar;
        this.y /= scalar;
        return this;
    }

    /**
     * Normalizes this vector in-place (makes it a unit vector).
     * If the vector is zero, sets it to (0, 0).
     * @returns {Vector2D} This vector, for chaining.
     */
    normalizeInPlace() {
        const mag = Math.sqrt(this.x * this.x + this.y * this.y);
        if (mag > 0) {
            this.x /= mag;
            this.y /= mag;
        } else {
            this.x = 0;
            this.y = 0;
        }
        return this;
    }

    /**
     * Linearly interpolates between two vectors in-place.
     * @param {Vector2D} source - The starting vector.
     * @param {Vector2D} target - The target vector.
     * @param {number} factor - Interpolation factor (0 = source, 1 = target).
     * @returns {Vector2D} This vector, for chaining.
     */
    lerpInPlace(source, target, factor) {
        this.x = source.x + (target.x - source.x) * factor;
        this.y = source.y + (target.y - source.y) * factor;
        return this;
    }

    /**
     * Calculates the distance to another vector.
     * @param {Vector2D} other - The other vector.
     * @returns {number} The distance.
     */
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Estimates the distance to another vector without using square root.
     * @param {Vector2D} other - The other vector.
     * @returns {number} The estimated distance using alpha-beta approximation.
     */
    distanceEstimateTo(other) {
        const absX = Math.abs(this.x - other.x);
        const absY = Math.abs(this.y - other.y);
        const maxVal = Math.max(absX, absY);
        const minVal = Math.min(absX, absY);
        return 1.0 * maxVal + 0.4 * minVal;
    }

    /**
     * Calculates the squared distance to another vector.
     * @param {Vector2D} other - The other vector.
     * @returns {number} The squared distance.
     */
    distanceSquaredTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return dx * dx + dy * dy;
    }
}