// celestialBody.js

import { Vector2D } from './vector2d.js';
import { Colour } from './colour.js';
import { GameObject } from './gameObject.js';
//import { StarSystem } from './starSystem.js';

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
    'jumpgate': { type: 'jumpgate', color: new Colour(0, 1, 0) }
};

/**
 * Represents a celestial body such as a star, planet, or satellite.
 * Extends the base GameObject class.
 */
export class CelestialBody extends GameObject {
    /**
     * Creates a new CelestialBody instance.
     * @param {number} distance - The distance from the parent body or origin.
     * @param {number} radius - The radius of the celestial body.
     * @param {Colour} color - The color of the celestial body.
     * @param {CelestialBody} [parent=null] - The parent celestial body (e.g., a planet for a moon).
     * @param {number} [angle=0] - The initial angle relative to the parent.
     * @param {Object} [type=celestialTypes['planet']] - The type of celestial body.
     * @param {Object} [subtype=null] - The subtype of the celestial body (e.g., for planets).
     * @param {string} [name=''] - The name of the celestial body.
     * @param {StarSystem} [starSystem=null] - The star system the body belongs to.
     * @param {PlanetaryRing} [ring=null] - An optional ring around the body.
     */
    constructor(distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '', starSystem = null, ring = null) {
        super(parent ? new Vector2D(parent.position.x + Math.cos(angle) * distance, parent.position.y + Math.sin(angle) * distance) : new Vector2D(Math.cos(angle) * distance, Math.sin(angle) * distance), starSystem);
        this.distance = distance;
        this.radius = radius;
        this.color = color;
        this.parent = parent;
        this.angle = angle;
        this.type = type;
        this.subtype = subtype;
        this.name = name;
        this.ring = ring;
        this.landedShips = [];
    }

    /**
     * Draws the celestial body and its ring (if any) on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     */
    draw(ctx, camera) {
        ctx.save();
        const screenPos = camera.worldToScreen(this.position);
        const screenX = screenPos.x;
        const screenY = screenPos.y;
        const scaledRadius = camera.worldToSize(this.radius);

        if (!isFinite(screenX) || !isFinite(screenY) || !isFinite(scaledRadius) || scaledRadius <= 0) {
            ctx.restore();
            return;
        }

        if (this.ring) {
            this.ring.drawBack(ctx, camera, screenX, screenY, this.radius);
        }

        const sunAngle = Math.atan2(-this.position.y, -this.position.x);
        const lightX = screenX + Math.cos(sunAngle) * scaledRadius * 0.7;
        const lightY = screenY + Math.sin(sunAngle) * scaledRadius * 0.7;

        let fillStyle = this.color.toRGB();
        if (this.type.type !== 'star') {
            const gradient = ctx.createRadialGradient(
                lightX, lightY, 0,
                screenX, screenY, scaledRadius * 3
            );
            gradient.addColorStop(0, this.color.toRGB());
            gradient.addColorStop(1, 'rgb(0, 0, 0)');
            fillStyle = gradient;
        }

        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.closePath();

        if (this.ring) {
            this.ring.drawFront(ctx, camera, screenX, screenY, this.radius);
        }

        ctx.restore();
    }

    addLandedShip(ship) {
        this.landedShips.push(ship);
    }

    removeLandedShip(ship) {
        const index = this.landedShips.indexOf(ship);
        if (index !== -1) {
            this.landedShips.splice(index, 1);
        }
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
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.color = color;
        this.tiltAngle = tiltAngle;
        this.scalingFactor = 1 - 0.5 * (1 - this.innerRadius / this.outerRadius);
    }

    /**
     * Draws the back half of the ring (behind the planet).
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     * @param {number} planetX - The x-coordinate of the planet on the screen.
     * @param {number} planetY - The y-coordinate of the planet on the screen.
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
        ctx.ellipse(flooredX, flooredY, scaledOuterRadius, scaledOuterRadius * tiltFactor, 0, Math.PI, Math.PI * 2);
        ctx.ellipse(flooredX, flooredY, scaledInnerRadius, scaledInnerRadius * innerTiltFactor, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = this.color.toRGBA();
        ctx.fill('evenodd');
        ctx.restore();
    }

    /**
     * Draws the front half of the ring (in front of the planet).
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     * @param {number} planetX - The x-coordinate of the planet on the screen.
     * @param {number} planetY - The y-coordinate of the planet on the screen.
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
 * Represents a jump gate, a special celestial body that connects two star systems.
 * Extends the CelestialBody class.
 */
export class JumpGate extends CelestialBody {
    /**
     * Creates a new JumpGate instance.
     * @param {Hyperlane} lane - The hyperlane connection between two star systems.
     * @param {Vector2D} sysPosition - The position of the star system where the gate is located.
     */
    constructor(lane, sysPosition) {
        const dir = new Vector2D(lane.target.position.x - sysPosition.x, lane.target.position.y - sysPosition.y);
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const norm = new Vector2D(dir.x / mag, dir.y / mag);
        const radius = 50;
        const dist = 1000;
        const angle = Math.atan2(norm.y, norm.x);
        super(dist, radius, celestialTypes['jumpgate'].color, null, angle, celestialTypes['jumpgate'], null, `Jump To ${lane.target.name}`, lane.source);
        this.lane = lane;
    }

    /**
     * Draws the jump gate on the canvas as a circle with a stroke.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object handling coordinate transformations.
     */
    draw(ctx, camera) {
        ctx.save();
        const screenPos = camera.worldToScreen(this.position);
        const radius = camera.worldToSize(this.radius);
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color.toRGB();
        ctx.lineWidth = camera.worldToSize(5);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }

    /**
     * Checks if the ship is within the jump gate's radius.
     * @param {Vector2D} shipPosition - The position of the ship.
     * @returns {boolean} True if the ship overlaps with the jump gate, false otherwise.
     */
    overlapsShip(shipPosition) {
        const dx = this.position.x - shipPosition.x;
        const dy = this.position.y - shipPosition.y;
        return (dx * dx + dy * dy) < (this.radius * this.radius);
    }
}