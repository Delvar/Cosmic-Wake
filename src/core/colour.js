// /src/core/colour.js

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
        /** @type {number} The red component of the color (0 to 1). */
        this.r = r;
        /** @type {number} The green component of the color (0 to 1). */
        this.g = g;
        /** @type {number} The blue component of the color (0 to 1). */
        this.b = b;
        /** @type {number} The alpha component of the color (0 to 1, default is 1 for fully opaque). */
        this.a = a;

        if (new.target === Colour) Object.seal(this);
    }

    /**
     * Sets the components of this Colour.
     * @param {number} r - The red component (0 to 1).
     * @param {number} g - The green component (0 to 1).
     * @param {number} b - The blue component (0 to 1).
     * @param {number} [a=1] - The alpha component (0 to 1, default is 1 for fully opaque).
     */
    set(r, g, b, a = 1) {
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

    // Static instances of 1970s-style muted colors (12 total)
    static Red = new Colour(0.898, 0.451, 0.451);               // #E57373
    static RedOrange = new Colour(0.925, 0.541, 0.416);         // #ECA682
    static Orange = new Colour(0.957, 0.635, 0.380);            // #F4A261
    static OrangeYellow = new Colour(0.918, 0.694, 0.235);      // #EAB13B
    static Yellow = new Colour(0.886, 0.694, 0.235);            // #E2B13C
    static YellowGreen = new Colour(0.714, 0.831, 0.384);       // #B6D462
    static Green = new Colour(0.400, 0.800, 0.400);             // #66CC66
    static GreenBlue = new Colour(0.400, 0.600, 0.800);         // #6699CC
    static Blue = new Colour(0.300, 0.400, 0.900);              // #4C66E6
    static BluePurple = new Colour(0.500, 0.400, 0.900);        // #8066E6
    static Purple = new Colour(0.700, 0.400, 0.900);            // #B266E6
    static PurpleRed = new Colour(0.796, 0.541, 0.655);         // #CB749F

    // Lighter versions of 1970s-style muted colors (12 total)
    static RedLight = new Colour(0.967, 0.588, 0.588);          // #F69696
    static RedOrangeLight = new Colour(0.988, 0.647, 0.541);    // #FCA586
    static OrangeLight = new Colour(0.988, 0.706, 0.494);       // #FDB47D
    static OrangeYellowLight = new Colour(0.957, 0.753, 0.306); // #F4C04E
    static YellowLight = new Colour(0.941, 0.753, 0.306);       // #F0C04E
    static YellowGreenLight = new Colour(0.800, 0.871, 0.459);  // #CCDE75
    static GreenLight = new Colour(0.471, 0.886, 0.471);        // #78E278
    static GreenBlueLight = new Colour(0.471, 0.706, 0.886);    // #78B4E2
    static BlueLight = new Colour(0.388, 0.494, 0.965);         // #637EF6
    static BluePurpleLight = new Colour(0.588, 0.471, 0.965);   // #9678F6
    static PurpleLight = new Colour(0.765, 0.471, 0.965);       // #C378F6
    static PurpleRedLight = new Colour(0.847, 0.612, 0.718);    // #D89CB7

    // Darker versions of 1970s-style muted colors (12 total)
    static RedDark = new Colour(0.753, 0.318, 0.318);           // #C05151
    static RedOrangeDark = new Colour(0.776, 0.388, 0.294);     // #C6634B
    static OrangeDark = new Colour(0.800, 0.459, 0.271);        // #CC7545
    static OrangeYellowDark = new Colour(0.776, 0.494, 0.165);  // #C57E2A
    static YellowDark = new Colour(0.753, 0.494, 0.165);        // #C07E2A
    static YellowGreenDark = new Colour(0.541, 0.612, 0.282);   // #8A9C48
    static GreenDark = new Colour(0.282, 0.576, 0.282);         // #489348
    static GreenBlueDark = new Colour(0.282, 0.435, 0.576);     // #486F93
    static BlueDark = new Colour(0.212, 0.282, 0.635);          // #3648A2
    static BluePurpleDark = new Colour(0.353, 0.282, 0.635);    // #5A48A2
    static PurpleDark = new Colour(0.494, 0.282, 0.635);        // #7F48A2
    static PurpleRedDark = new Colour(0.565, 0.388, 0.471);     // #90637A


    // Static instances of 1970s-style muted neutral colors (3 total)
    static White = new Colour(0.960, 0.925, 0.878);             // #F5ECDF
    static Grey = new Colour(0.620, 0.588, 0.545);              // #9E968B
    static Black = new Colour(0.251, 0.239, 0.220);             // #403C38

    // Lighter versions of 1970s-style muted neutral colors
    static WhiteLight = new Colour(0.980, 0.957, 0.925);         // #FAF3EB
    static GreyLight = new Colour(0.753, 0.722, 0.678);          // #C0B8AD
    static BlackLight = new Colour(0.388, 0.369, 0.341);         // #635E57

    // Darker versions of 1970s-style muted neutral colors
    static WhiteDark = new Colour(0.839, 0.812, 0.769);          // #D6CFC4
    static GreyDark = new Colour(0.486, 0.459, 0.420);           // #7C756B
    static BlackDark = new Colour(0.176, 0.165, 0.153);          // #2A2927

    // FactionRelationship Colours
    static Allied = Colour.Yellow;
    static Neutral = Colour.Orange;
    static Hostile = Colour.Red;
}