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
 * Clamps a value between a minimum and maximum.
 * @param {number} value - The value to remap and clamp.
 * @param {number} inMin - The minimum value of the input range.
 * @param {number} inMax - The maximum value of the input range.
 * @param {number} outMin - The minimum value of the output range.
 * @param {number} outMax - The maximum value of the output range.
 * @returns {number} The clamped value.
 */
export function remapClamp(value, inMin, inMax, outMin, outMax) {
    return Math.min(Math.max((outMax - outMin) * (value - inMin) / (inMax - inMin) + outMin, outMin), outMax);
}

/**
 * Normalizes an angle to the range [-π, π).
 * @param {number} angle - The angle in radians to normalize.
 * @returns {number} The normalized angle in radians, between -π (inclusive) and π (exclusive).
 */
export function normalizeAngle(angle) {
    return ((angle + Math.PI) % (TWO_PI)) - Math.PI;
}