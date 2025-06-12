// /src/starSystem/celestialBody.js

import { Vector2D } from '/src/core/vector2d.js';
import { Colour } from '/src/core/colour.js';
import { GameObject } from '/src/core/gameObject.js';
import { TWO_PI, removeObjectFromArrayInPlace } from '/src/core/utils.js';
import { Hyperlane, StarSystem } from '/src/starSystem/starSystem.js';
import { Ship } from '/src/ship/ship.js';
import { Camera } from '/src/camera/camera.js';

/**
 * Defines the types and colors for celestial bodies in the game.
 */
export const celestialTypes = {
    'star': { type: 'star', color: new Colour(1, 1, 0) },
    'planet': {
        type: 'planet', color: new Colour(0, 0, 1), subtypes: {
            'Chthonian': { subtype: 'Chthonian', color: new Colour(1, 0.27, 0) },
            'Carbon': { subtype: 'Carbon', color: new Colour(0.41, 0.41, 0.41) },
            'Desert': { subtype: 'Desert', color: new Colour(0.96, 0.64, 0.38) },
            'Gas Dwarf': { subtype: 'Gas Dwarf', color: new Colour(0.68, 0.85, 0.90) },
            'Gas Giant': { subtype: 'Gas Giant', color: new Colour(1, 0.65, 0) },
            'Helium': { subtype: 'Helium', color: new Colour(0.94, 0.97, 1) },
            'Hycean': { subtype: 'Hycean', color: new Colour(0, 0.81, 0.82) },
            'Ice Giant': { subtype: 'Ice Giant', color: new Colour(0, 0.75, 1) },
            'Ice': { subtype: 'Ice', color: new Colour(0.53, 0.81, 0.92) },
            'Iron': { subtype: 'Iron', color: new Colour(0.66, 0.66, 0.66) },
            'Lava': { subtype: 'Lava', color: new Colour(1, 0, 0) },
            'Ocean': { subtype: 'Ocean', color: new Colour(0, 0.41, 0.58) },
            'Protoplanet': { subtype: 'Protoplanet', color: new Colour(0.55, 0.53, 0.47) },
            'Puffy': { subtype: 'Puffy', color: new Colour(0.87, 0.63, 0.87) },
            'Super-puff': { subtype: 'Super-puff', color: new Colour(0.93, 0.51, 0.93) },
            'Silicate': { subtype: 'Silicate', color: new Colour(0.75, 0.75, 0.75) },
            'Terrestrial': { subtype: 'Terrestrial', color: new Colour(0, 0, 1) }
        }
    },
    'satellite': { type: 'satellite', color: new Colour(0.5, 0.5, 0.5) },
    'comet': { type: 'comet', color: new Colour(1, 1, 1) },
    'asteroid': { type: 'asteroid', color: new Colour(0.55, 0.27, 0.07) },
    'jumpgate': { type: 'jumpgate', color: new Colour(0.25, 0.25, 1.0) }
};

/**
 * Represents a celestial body such as a star, planet, or satellite.
 * Extends the base GameObject class.
 * @extends GameObject
 */
export class CelestialBody extends GameObject {
    /**
     * Creates a new CelestialBody instance.
     * @param {number} distance - The distance from the parent body or origin in world units.
     * @param {number} radius - The radius of the celestial body in world units.
     * @param {Colour} color - The color of the celestial body.
     * @param {CelestialBody} [parent=null] - The parent celestial body (e.g., a planet for a moon).
     * @param {number} [angle=0] - The initial angle relative to the parent in radians.
     * @param {Object} [type=celestialTypes['planet']] - The type of celestial body from celestialTypes.
     * @param {Object} [subtype=null] - The subtype of the celestial body (e.g., for planets).
     * @param {string|null} [name=null] - The name of the celestial body.
     * @param {StarSystem} [starSystem=null] - The star system the body belongs to.
     * @param {PlanetaryRing} [ring=null] - An optional ring around the body.
     */
    constructor(distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = null, starSystem = null, ring = null) {
        super(new Vector2D(0, 0), starSystem);
        /** @type {Vector2D} The position of the celestial body in world coordinates, calculated from parent and angle. */
        this.position = new Vector2D(
            parent ? parent.position.x + Math.sin(angle) * distance : Math.sin(angle) * distance,
            parent ? parent.position.y - Math.cos(angle) * distance : -Math.cos(angle) * distance
        );
        /** @type {number} The distance from the parent body or origin in world units. */
        this.distance = distance;
        /** @type {number} The radius of the celestial body in world units. */
        this.radius = radius;
        /** @type {Colour} The color of the celestial body. */
        this.color = color;
        /** @type {CelestialBody|null} The parent celestial body (e.g., a planet for a moon). */
        this.parent = parent;
        /** @type {number} The initial angle relative to the parent in radians. */
        this.angle = angle;
        /** @type {Object} The type of celestial body, sourced from celestialTypes. */
        this.type = type;
        /** @type {Object|null} The subtype of the celestial body (e.g., for planets). */
        this.subtype = subtype;
        /** @type {PlanetaryRing|null} An optional ring around the celestial body. */
        this.ring = ring;
        /** @type {Array<Ship>} Array of ships currently landed on the celestial body. */
        this.landedShips = [];
        /** @type {Vector2D} Scratch vector for storing screen position during drawing. */
        this._scratchScreenPos = new Vector2D();
        /** @type {string|null} The name of the CelestialBody */
        this.name = name;

        if (new.target === CelestialBody) Object.seal(this);
    }

    /**
     * Draws the celestial body and its ring (if any) on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     */
    draw(ctx, camera) {
        if (!camera.isInView(this.position, this.radius)) {
            return;
        }

        ctx.save();
        camera.worldToScreen(this.position, this._scratchScreenPos); // Use scratch for screen pos
        const screenX = this._scratchScreenPos.x;
        const screenY = this._scratchScreenPos.y;
        const scaledRadius = camera.worldToSize(this.radius);

        if (!isFinite(screenX) || !isFinite(screenY) || !isFinite(scaledRadius) || scaledRadius <= 0) {
            ctx.restore();
            return;
        }

        if (this.ring) {
            this.ring.drawBack(ctx, camera, screenX, screenY, this.radius);
        }

        const sunAngle = Math.atan2(-this.position.x, this.position.y);
        const lightX = screenX + Math.sin(sunAngle) * scaledRadius * 0.7;
        const lightY = screenY - Math.cos(sunAngle) * scaledRadius * 0.7;

        let fillStyle;
        if (this.type.type !== 'star') {
            const gradient = ctx.createRadialGradient(
                lightX, lightY, 0,
                screenX, screenY, scaledRadius * 3
            );
            gradient.addColorStop(0, this.color.toRGB());
            gradient.addColorStop(1, 'rgb(0, 0, 0)');
            fillStyle = gradient;
        } else {
            fillStyle = this.color.toRGB();
        }

        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius, 0, TWO_PI);
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.closePath();

        if (this.ring) {
            this.ring.drawFront(ctx, camera, screenX, screenY, this.radius);
        }

        ctx.restore();
    }

    /**
     * Adds a landed ship to the celestial body's list.
     * @param {Ship} ship - The ship to add.
     */
    addLandedShip(ship) {
        this.landedShips.push(ship);
    }

    /**
     * Removes a landed ship from the celestial body's list.
     * @param {Ship} ship - The ship to remove.
     */
    removeLandedShip(ship) {
        removeObjectFromArrayInPlace(ship, this.landedShips);
    }
}

/**
 * Represents a ring around a celestial body, such as a planet.
 */
export class PlanetaryRing {
    /**
     * Creates a new PlanetaryRing instance.
     * @param {number} innerRadius - The inner radius of the ring as a fraction of the planet's radius.
     * @param {number} outerRadius - The outer radius of the ring as a fraction of the planet's radius.
     * @param {Colour} color - The color of the ring.
     * @param {number} [tiltAngle=Math.PI / 2.5] - The tilt angle of the ring in radians.
     */
    constructor(innerRadius, outerRadius, color, tiltAngle = Math.PI / 2.5) {
        /** @type {number} The inner radius of the ring as a fraction of the planet's radius. */
        this.innerRadius = innerRadius;
        /** @type {number} The outer radius of the ring as a fraction of the planet's radius. */
        this.outerRadius = outerRadius;
        /** @type {Colour} The color of the ring. */
        this.color = color;
        /** @type {number} The tilt angle of the ring in radians. */
        this.tiltAngle = tiltAngle;
        /** @type {number} The scaling factor for the ring, based on the ratio of inner to outer radius. */
        this.scalingFactor = 1 - 0.5 * (1 - this.innerRadius / this.outerRadius);

        if (new.target === PlanetaryRing) Object.seal(this);
    }

    /**
     * Draws the back half of the ring (behind the planet).
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     * @param {number} planetX - The x-coordinate of the planet on the screen in pixels.
     * @param {number} planetY - The y-coordinate of the planet on the screen in pixels.
     * @param {number} planetRadius - The radius of the planet in world units.
     */
    drawBack(ctx, camera, planetX, planetY, planetRadius) {
        ctx.save();
        const flooredX = Math.floor(planetX);
        const flooredY = Math.floor(planetY);
        const scaledInnerRadius = camera.worldToSize(planetRadius * this.innerRadius);
        const scaledOuterRadius = camera.worldToSize(planetRadius * this.outerRadius);
        const tiltFactor = Math.cos(this.tiltAngle);
        const innerTiltFactor = tiltFactor * this.scalingFactor;

        ctx.beginPath();
        ctx.ellipse(flooredX, flooredY, scaledOuterRadius, scaledOuterRadius * tiltFactor, 0, Math.PI, TWO_PI);
        ctx.ellipse(flooredX, flooredY, scaledInnerRadius, scaledInnerRadius * innerTiltFactor, 0, Math.PI, TWO_PI);
        ctx.fillStyle = this.color.toRGBA();
        ctx.fill('evenodd');
        ctx.restore();
    }

    /**
     * Draws the front half of the ring (in front of the planet).
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     * @param {number} planetX - The x-coordinate of the planet on the screen in pixels.
     * @param {number} planetY - The y-coordinate of the planet on the screen in pixels.
     * @param {number} planetRadius - The radius of the planet in world units.
     */
    drawFront(ctx, camera, planetX, planetY, planetRadius) {
        ctx.save();
        const flooredX = Math.floor(planetX);
        const flooredY = Math.floor(planetY);
        const scaledInnerRadius = camera.worldToSize(planetRadius * this.innerRadius);
        const scaledOuterRadius = camera.worldToSize(planetRadius * this.outerRadius);
        const tiltFactor = Math.cos(this.tiltAngle);
        const innerTiltFactor = tiltFactor * this.scalingFactor;

        ctx.beginPath();
        ctx.ellipse(flooredX, flooredY, scaledOuterRadius, scaledOuterRadius * tiltFactor, 0, 0, Math.PI);
        ctx.ellipse(flooredX, flooredY, scaledInnerRadius, scaledInnerRadius * innerTiltFactor, 0, 0, Math.PI);
        ctx.fillStyle = this.color.toRGBA();
        ctx.fill('evenodd');
        ctx.restore();
    }
}

/**
 * Represents a planet.
 * @extends CelestialBody
 */
export class Planet extends CelestialBody {
    /**
     * Creates a new Planet instance.
     * @param {number} distance - The distance from the parent body or origin in world units.
     * @param {number} radius - The radius of the celestial body in world units.
     * @param {Colour} color - The color of the celestial body.
     * @param {CelestialBody} [parent=null] - The parent celestial body (e.g., a planet for a moon).
     * @param {number} [angle=0] - The initial angle relative to the parent in radians.
     * @param {Object} [type=celestialTypes['planet']] - The type of celestial body from celestialTypes.
     * @param {Object} [subtype=null] - The subtype of the celestial body (e.g., for planets).
     * @param {string} [name=''] - The name of the celestial body.
     * @param {StarSystem} [starSystem=null] - The star system the body belongs to.
     * @param {PlanetaryRing} [ring=null] - An optional ring around the body.
     */
    constructor(distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '', starSystem = null, ring = null) {
        super(distance, radius, color, parent, angle, type, subtype, name, starSystem, ring);
        if (new.target === Planet) Object.seal(this);
    }
}

/**
 * Represents a star.
 * @extends CelestialBody
 */
export class Star extends CelestialBody {
    /**
     * Creates a new Star instance.
     * @param {number} distance - The distance from the parent body or origin in world units.
     * @param {number} radius - The radius of the celestial body in world units.
     * @param {Colour} color - The color of the celestial body.
     * @param {CelestialBody} [parent=null] - The parent celestial body (e.g., a planet for a moon).
     * @param {number} [angle=0] - The initial angle relative to the parent in radians.
     * @param {Object} [type=celestialTypes['star']] - The type of celestial body from celestialTypes.
     * @param {Object} [subtype=null] - The subtype of the celestial body (e.g., for planets).
     * @param {string} [name=''] - The name of the celestial body.
     * @param {StarSystem} [starSystem=null] - The star system the body belongs to.
     * @param {PlanetaryRing} [ring=null] - An optional ring around the body.
     */
    constructor(distance, radius, color, parent = null, angle = 0, type = celestialTypes['star'], subtype = null, name = 'Unknown Star', starSystem = null, ring = null) {
        super(distance, radius, color, parent, angle, type, subtype, name, starSystem, ring);
        if (new.target === Star) Object.seal(this);
    }
}

/**
 * Represents a jump gate, a special celestial body that connects two star systems.
 * Extends the CelestialBody class.
 * @extends CelestialBody
 */
export class JumpGate extends CelestialBody {
    /**
     * Creates a new JumpGate instance.
     * @param {Hyperlane} lane - The hyperlane connection between two star systems.
     * @param {Vector2D} sysPosition - The position of the star system where the gate is located in world coordinates.
     */
    constructor(lane, sysPosition) {
        const dir = new Vector2D(0, 0);
        dir.set(lane.target.position.x - sysPosition.x, lane.target.position.y - sysPosition.y);
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const norm = new Vector2D(0, 0);
        norm.set(dir).divideInPlace(mag);
        const radius = 50;
        const dist = 1000;
        const angle = Math.atan2(norm.x, norm.y);
        super(dist, radius, celestialTypes['jumpgate'].color, null, angle, celestialTypes['jumpgate'], null, `Jump To ${lane.target.name}`, lane.source);
        /** @type {Hyperlane} The hyperlane connection between two star systems. */
        this.lane = lane;

        if (new.target === JumpGate) Object.seal(this);
    }

    /**
     * Draws the jump gate on the canvas as a circle with a stroke.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     */
    draw(ctx, camera) {
        ctx.save();
        camera.worldToScreen(this.position, this._scratchScreenPos); // Use scratch for screen pos
        const radius = camera.worldToSize(this.radius);
        ctx.beginPath();
        ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, 0, TWO_PI);
        ctx.strokeStyle = this.color.toRGB();
        ctx.lineWidth = camera.worldToSize(5);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }
}