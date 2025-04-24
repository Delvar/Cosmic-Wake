// utils.js

export const TWO_PI = Math.PI * 2;

/**
 * Remaps a value from 0 to 1 to a specified output range.
 * @param {number} value - The value to remap (between 0 and 1).
 * @param {number} minOut - The minimum of the output range.
 * @param {number} maxOut - The maximum of the output range.
 * @returns {number} The remapped value.
 */
export function remapRange01(value, minOut, maxOut) {
    return (value * (maxOut - minOut)) + minOut;
}

/**
 * Generates a random number between min and max.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random number between min and max.
 */
export function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Clamps a value between a minimum and maximum.
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} The clamped value.
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Remaps a value from an input range to an output range, clamping the result.
 * @param {number} value - The value to remap and clamp.
 * @param {number} inMin - The minimum value of the input range.
 * @param {number} inMax - The maximum value of the input range.
 * @param {number} outMin - The minimum value of the output range.
 * @param {number} outMax - The maximum value of the output range.
 * @throws {Error} If inMax equals inMin (division by zero).
 * @returns {number} The remapped and clamped value.
 */
export function remapClamp(value, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) throw new Error("inMax cannot equal inMin (division by zero)");
    return Math.min(Math.max((outMax - outMin) * (value - inMin) / (inMax - inMin) + outMin, outMin), outMax);
}

/**
 * Normalizes an angle to the range [-π, π].
 * @param {number} angle - The angle in radians to normalize.
 * @returns {number} The normalized angle in radians, between -π (inclusive) and π (exclusive).
 */
export function normalizeAngle(angle) {
    return ((angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
}

/**
 * Removes an item from an array in place without allocating new arrays.
 * @param {Object} object - The object to find and remove.
 * @param {Array} array - The array to remove the object from.
 * @returns {Array} The modified array.
 */
export function removeObjectFromArrayInPlace(object, array) {
    const index = array.indexOf(object);
    // Not found!
    if (index === -1) {
        return array;
    }
    const length = array.length;
    const lastIndex = length - 1;

    if (index !== lastIndex) {
        array[index] = array[lastIndex];
    }

    array.pop();
    return array;
}

/**
 * Generates a hash value from grid coordinates and layer index for consistent RNG seeding.
 * @param {number} i - The x-index of the grid cell.
 * @param {number} j - The y-index of the grid cell.
 * @param {number} layer - The layer index (0 to 4).
 * @returns {number} A unique hash value.
 */
export function hash(i, j, layer) {
    return i * 73856093 + j * 19349663 + layer * 83492791;
}

/**
 * A simple seeded random number generator for consistent star properties across frames.
 */
export class SimpleRNG {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}