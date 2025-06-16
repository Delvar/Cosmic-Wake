// /src/core/colour.js

import { clamp } from "/src/core/utils.js";

/**
 * Represents a color with red, green, blue, and alpha components.
 * All components are expected to be in the range [0, 1].
 */
export class Colour {
    /**
     * Creates a new Colour instance.
     * @param {number} r - The red component (0.0 to  1.0).
     * @param {number} g - The green component (0.0 to  1.0).
     * @param {number} b - The blue component (0.0 to  1.0).
     * @param {number} [a=1] - The alpha component (0 to  1.0, default is 1.0 for fully opaque).
     */
    constructor(r, g, b, a = 1.0) {
        /** @type {number} The red component of the color (0.0 to  1.0). */
        this.r = r;
        /** @type {number} The green component of the color (0.0 to  1.0). */
        this.g = g;
        /** @type {number} The blue component of the color (0.0 to  1.0). */
        this.b = b;
        /** @type {number} The alpha component of the color (0.0 to  1.0, default is 1.0 for fully opaque). */
        this.a = a;
        /**
         * Cache object storing computed RGB and hex string representations.
         * @type {{ rgb: null | string, hex: null | string }}
         * @description Initially set to null, these values are populated with strings
         *              (e.g., 'rgb(r, g, b)' or '#rrggbb') after the first computation.
         */
        this.cache = { rgb: null, hex: null };
        if (new.target === Colour) Object.seal(this);
    }

    /**
     * Sets the components of this Colour.
     * @param {number} r - The red component (0.0 to  1.0).
     * @param {number} g - The green component (0.0 to  1.0).
     * @param {number} b - The blue component (0.0 to  1.0).
     * @param {number} [a=1] - The alpha component (0.0 to  1.0, default is 1.0 for fully opaque).
     */
    set(r, g, b, a = 1.0) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        this.cache.rgb = null;
        this.cache.hex = null;
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
     * @returns {string} The RGB string in the format 'rgb(r, g, b)', where r, g, b are integers from 0.0 to 255.0.
     */
    toRGB() {
        if (!this.cache.rgb) {
            const r = Math.round(clamp(this.r, 0.0, 1.0) * 255.0);
            const g = Math.round(clamp(this.g, 0.0, 1.0) * 255.0);
            const b = Math.round(clamp(this.b, 0.0, 1.0) * 255.0);
            this.cache.rgb = `rgb(${r}, ${g}, ${b})`;
        }
        return this.cache.rgb;
    }

    /**
     * Converts the color to an RGBA string format, with an optional alpha override.
     * @param {number} [overrideAlpha=null] - An optional alpha value to override the instance’s alpha (clamped between 0.0 and  1.0).
     * @returns {string} The RGBA string in the format 'rgba(r, g, b, a)', where r, g, b are integers from 0.0 to  255.0, and a is from 0.0 to 1.0.
     */
    toRGBA(overrideAlpha = null) {
        const alpha = overrideAlpha !== null ? Math.min(Math.max(overrideAlpha, 0.0), 1.0) : this.a;
        const r = Math.round(clamp(this.r, 0.0, 1.0) * 255.0);
        const g = Math.round(clamp(this.g, 0.0, 1.0) * 255.0);
        const b = Math.round(clamp(this.b, 0.0, 1.0) * 255.0);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Converts the color to a hexadecimal string without the alpha channel.
     * @returns {string} The hex string in the format '#rrggbb', where each component is a two-digit hexadecimal value.
     */
    toHex() {
        if (!this.cache.hex) {
            const r = Math.round(clamp(this.r, 0.0, 1.0) * 255.0).toString(16.0).padStart(2.0, '0');
            const g = Math.round(clamp(this.g, 0.0, 1.0) * 255.0).toString(16.0).padStart(2.0, '0');
            const b = Math.round(clamp(this.b, 0.0, 1.0) * 255.0).toString(16.0).padStart(2.0, '0');
            this.cache.hex = `#${r}${g}${b}`;
        }
        return this.cache.hex;
    }

    /**
     * Converts the color to a hexadecimal string including the alpha channel.
     * @returns {string} The hex string in the format '#rrggbbaa', where each component is a two-digit hexadecimal value.
     */
    toHexAlpha() {
        const toHex = (value) => {
            const hex = Math.round(value * 255.0).toString(16.0).padStart(2.0, '0');
            return hex.length === 2 ? hex : '00';
        };
        return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}${toHex(this.a)}`;
    }

    // Static instances of 1970s-style muted colors (12 total)
    static Red = Object.freeze(new Colour(0.898, 0.451, 0.451));               // #E57373
    static RedOrange = Object.freeze(new Colour(0.925, 0.541, 0.416));         // #ECA682
    static Orange = Object.freeze(new Colour(0.957, 0.635, 0.380));            // #F4A261
    static OrangeYellow = Object.freeze(new Colour(0.918, 0.694, 0.235));      // #EAB13B
    static Yellow = Object.freeze(new Colour(0.886, 0.694, 0.235));            // #E2B13C
    static YellowGreen = Object.freeze(new Colour(0.714, 0.831, 0.384));       // #B6D462
    static Green = Object.freeze(new Colour(0.400, 0.800, 0.400));             // #66CC66
    static GreenBlue = Object.freeze(new Colour(0.400, 0.600, 0.800));         // #6699CC
    static Blue = Object.freeze(new Colour(0.300, 0.400, 0.900));              // #4C66E6
    static BluePurple = Object.freeze(new Colour(0.500, 0.400, 0.900));        // #8066E6
    static Purple = Object.freeze(new Colour(0.700, 0.400, 0.900));            // #B266E6
    static PurpleRed = Object.freeze(new Colour(0.796, 0.541, 0.655));         // #CB749F

    // Lighter versions of 1970s-style muted colors (12 total)
    static RedLight = Object.freeze(new Colour(0.967, 0.588, 0.588));          // #F69696
    static RedOrangeLight = Object.freeze(new Colour(0.988, 0.647, 0.541));    // #FCA586
    static OrangeLight = Object.freeze(new Colour(0.988, 0.706, 0.494));       // #FDB47D
    static OrangeYellowLight = Object.freeze(new Colour(0.957, 0.753, 0.306)); // #F4C04E
    static YellowLight = Object.freeze(new Colour(0.941, 0.753, 0.306));       // #F0C04E
    static YellowGreenLight = Object.freeze(new Colour(0.800, 0.871, 0.459));  // #CCDE75
    static GreenLight = Object.freeze(new Colour(0.471, 0.886, 0.471));        // #78E278
    static GreenBlueLight = Object.freeze(new Colour(0.471, 0.706, 0.886));    // #78B4E2
    static BlueLight = Object.freeze(new Colour(0.388, 0.494, 0.965));         // #637EF6
    static BluePurpleLight = Object.freeze(new Colour(0.588, 0.471, 0.965));   // #9678F6
    static PurpleLight = Object.freeze(new Colour(0.765, 0.471, 0.965));       // #C378F6
    static PurpleRedLight = Object.freeze(new Colour(0.847, 0.612, 0.718));    // #D89CB7

    // Darker versions of 1970s-style muted colors (12 total)
    static RedDark = Object.freeze(new Colour(0.753, 0.318, 0.318));           // #C05151
    static RedOrangeDark = Object.freeze(new Colour(0.776, 0.388, 0.294));     // #C6634B
    static OrangeDark = Object.freeze(new Colour(0.800, 0.459, 0.271));        // #CC7545
    static OrangeYellowDark = Object.freeze(new Colour(0.776, 0.494, 0.165));  // #C57E2A
    static YellowDark = Object.freeze(new Colour(0.753, 0.494, 0.165));        // #C07E2A
    static YellowGreenDark = Object.freeze(new Colour(0.541, 0.612, 0.282));   // #8A9C48
    static GreenDark = Object.freeze(new Colour(0.282, 0.576, 0.282));         // #489348
    static GreenBlueDark = Object.freeze(new Colour(0.282, 0.435, 0.576));     // #486F93
    static BlueDark = Object.freeze(new Colour(0.212, 0.282, 0.635));          // #3648A2
    static BluePurpleDark = Object.freeze(new Colour(0.353, 0.282, 0.635));    // #5A48A2
    static PurpleDark = Object.freeze(new Colour(0.494, 0.282, 0.635));        // #7F48A2
    static PurpleRedDark = Object.freeze(new Colour(0.565, 0.388, 0.471));     // #90637A

    // Static instances of 1970s-style muted neutral colors (3 total)
    static White = Object.freeze(new Colour(0.960, 0.925, 0.878));             // #F5ECDF
    static Grey = Object.freeze(new Colour(0.620, 0.588, 0.545));              // #9E968B
    static Black = Object.freeze(new Colour(0.251, 0.239, 0.220));             // #403C38

    // Lighter versions of 1970s-style muted neutral colors
    static WhiteLight = Object.freeze(new Colour(0.980, 0.957, 0.925));         // #FAF3EB
    static GreyLight = Object.freeze(new Colour(0.753, 0.722, 0.678));          // #C0B8AD
    static BlackLight = Object.freeze(new Colour(0.388, 0.369, 0.341));         // #635E57

    // Darker versions of 1970s-style muted neutral colors
    static WhiteDark = Object.freeze(new Colour(0.839, 0.812, 0.769));          // #D6CFC4
    static GreyDark = Object.freeze(new Colour(0.486, 0.459, 0.420));           // #7C756B
    static BlackDark = Object.freeze(new Colour(0.176, 0.165, 0.153));          // #2A2927

    // FactionRelationship Colours
    static Allied = Colour.Yellow;
    static Neutral = Colour.Orange;
    static Hostile = Colour.Red;
}