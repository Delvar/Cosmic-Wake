// vector2d.js

/**
 * Represents a 2D vector with x and y components.
 * Can also be used to represent dimensions with width and height aliases for x and y, respectively.
 */
export class Vector2D {
    /**
     * Creates a new Vector2D instance.
     * @param {number} x - The x component of the vector.
     * @param {number} y - The y component of the vector.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Gets the width of the vector (alias for the x component).
     * @returns {number} The x component value.
     */
    get width() { return this.x; }

    /**
     * Sets the width of the vector (alias for the x component).
     * @param {number} value - The new value for the x component.
     */
    set width(value) { this.x = value; }

    /**
     * Gets the height of the vector (alias for the y component).
     * @returns {number} The y component value.
     */
    get height() { return this.y; }

    /**
     * Sets the height of the vector (alias for the y component).
     * @param {number} value - The new value for the y component.
     */
    set height(value) { this.y = value; }

    /**
     * Adds another vector to this vector and returns a new Vector2D.
     * @param {Vector2D} other - The vector to add.
     * @returns {Vector2D} A new vector representing the sum.
     */
    add(other) {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    /**
     * Subtracts another vector from this vector and returns a new Vector2D.
     * @param {Vector2D} other - The vector to subtract.
     * @returns {Vector2D} A new vector representing the difference.
     */
    subtract(other) {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    /**
     * Multiplies this vector by a scalar and returns a new Vector2D.
     * @param {number} scalar - The scalar value to multiply by.
     * @returns {Vector2D} A new vector scaled by the scalar.
     */
    multiply(scalar) {
        return new Vector2D(this.x * scalar, this.y * scalar);
    }

    /**
     * Normalizes this vector (makes it a unit vector) and returns a new Vector2D.
     * If the vector is zero, returns a zero vector.
     * @returns {Vector2D} A new normalized vector.
     */
    normalize() {
        const mag = Math.sqrt(this.x * this.x + this.y * this.y);
        return mag > 0 ? new Vector2D(this.x / mag, this.y / mag) : new Vector2D(0, 0);
    }

    /**
    * Calculates the magnitude (length) of the vector.
    * @returns {number} The magnitude of the vector, computed as the square root of the sum of squared components.
    */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Calculates the square of the magnitude (length) of the vector.
     * This is more efficient than magnitude() when comparing distances, as it avoids the square root operation.
     * @returns {number} The squared magnitude of the vector.
     */
    squareMagnitude() {
        return (this.x * this.x + this.y * this.y);
    }

    /**
     * Computes the dot product of this vector and another vector.
     * Useful for determining the angle between vectors or for projection operations.
     * @param {Vector2D} other - The other vector to compute the dot product with.
     * @returns {number} The dot product of the two vectors.
     */
    dot(other) {
        return (this.x * other.x + this.y * other.y);
    }

    /**
     * Divides this vector by a scalar value and returns a new vector.
     * @param {number} scalar - The scalar value to divide each component by.
     * @returns {Vector2D} A new Vector2D instance with components divided by the scalar.
     */
    divide(scalar) {
        return new Vector2D(this.x / scalar, this.y / scalar);
    }

    /**
     * Creates a copy of this vector.
     * Useful for avoiding unintended modifications to the original vector.
     * @returns {Vector2D} A new Vector2D instance with the same x and y values.
     */
    clone() {
        return new Vector2D(this.x, this.y);
    }

    lerp(target, factor) {
        return new Vector2D(
            this.x + (target.x - this.x) * factor,
            this.y + (target.y - this.y) * factor
        );
    }
}