// colour.js

/**
 * Represents a color with red, green, blue, and alpha components.
 * All components are expected to be in the range [0, 1].
 */
export class Colour {
    /**
     * Creates a new Colour instance.
     * @param {number} r - The red component (0 to 1).
     * @param {number} g - The green component (0 to 1).
     * @param {number} b - The blue component (0 to 1).
     * @param {number} [a=1] - The alpha component (0 to 1, default is 1 for fully opaque).
     */
    constructor(r, g, b, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    /**
     * Creates a copy of this colour.
     * @returns {Colour} A new Colour with the same values.
     */
    clone() {
        return new Colour(this.r, this.g, this.b, this.a);
    }

    /**
     * Converts the color to an RGB string format.
     * @returns {string} The RGB string in the format 'rgb(r, g, b)', where r, g, b are integers from 0 to 255.
     */
    toRGB() {
        const r = Math.round(this.r * 255);
        const g = Math.round(this.g * 255);
        const b = Math.round(this.b * 255);
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Converts the color to an RGBA string format, with an optional alpha override.
     * @param {number} [overrideAlpha=null] - An optional alpha value to override the instance’s alpha (clamped between 0 and 1).
     * @returns {string} The RGBA string in the format 'rgba(r, g, b, a)', where r, g, b are integers from 0 to 255, and a is from 0 to 1.
     */
    toRGBA(overrideAlpha = null) {
        const alpha = overrideAlpha !== null ? Math.min(Math.max(overrideAlpha, 0), 1) : this.a;
        const r = Math.round(this.r * 255);
        const g = Math.round(this.g * 255);
        const b = Math.round(this.b * 255);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Converts the color to a hexadecimal string without the alpha channel.
     * @returns {string} The hex string in the format '#rrggbb', where each component is a two-digit hexadecimal value.
     */
    toHex() {
        const toHex = (value) => {
            const hex = Math.round(value * 255).toString(16).padStart(2, '0');
            return hex.length === 2 ? hex : '00';
        };
        return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}`;
    }

    /**
     * Converts the color to a hexadecimal string including the alpha channel.
     * @returns {string} The hex string in the format '#rrggbbaa', where each component is a two-digit hexadecimal value.
     */
    toHexAlpha() {
        const toHex = (value) => {
            const hex = Math.round(value * 255).toString(16).padStart(2, '0');
            return hex.length === 2 ? hex : '00';
        };
        return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}${toHex(this.a)}`;
    }
}