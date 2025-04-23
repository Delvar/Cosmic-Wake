// galaxy.js
import { StarSystem } from './starSystem.js';
import { Planet, Star, PlanetaryRing, celestialTypes } from './celestialBody.js';
import { AsteroidBelt } from './asteroidBelt.js';
import { Vector2D } from './vector2d.js';
import { Colour } from './colour.js';
import { TWO_PI } from './utils.js';

/**
 * Creates and initializes the galaxy with star systems, celestial bodies, and hyperlanes.
 * @returns {Array<StarSystem>} An array of initialized StarSystem instances.
 */
export function createGalaxy() {
    const randomAngle = () => Math.random() * TWO_PI;
    const subtypes = celestialTypes['planet'].subtypes;
    const au = 4000;
    const planetScale = 0.008;
    let stars = [new Star(0, 300, new Colour(1, 1, 0), null, 0, celestialTypes['star'], null, 'Sun', null, null)];

    /* distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '', starSystem = null, ring = null */
    let planets = [
        new Planet(0.39 * au, 4879 * planetScale, new Colour(0.55, 0.27, 0.07), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Iron'], 'Mercury', null, null),
        new Planet(0.72 * au, 12104 * planetScale, new Colour(1, 0.84, 0), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Terrestrial'], 'Venus', null, null),
        new Planet(1.0 * au, 12756 * planetScale, new Colour(0, 0.72, 0.92), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Terrestrial'], 'Earth', null, null),
    ];

    const earth = planets[2];
    planets.push(
        new Planet(earth.radius * 3.0, 20, new Colour(0.83, 0.83, 0.83), earth, randomAngle(), celestialTypes['satellite'], null, 'Luna')
    );

    planets.push(new Planet(1.52 * au, 6792 * planetScale, new Colour(1, 0.27, 0), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Terrestrial'], 'Mars', null, null),
        new Planet(5.2 * 0.38 * au, 142984 * 0.15 * planetScale, new Colour(0.85, 0.65, 0.13), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Gas Giant'], 'Jupiter', null, null),
        new Planet(9.54 * 0.31 * au, 120536 * 0.15 * planetScale, new Colour(0.96, 0.64, 0.38), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Gas Giant'], 'Saturn', null,
            new PlanetaryRing(1.5, 2.5, new Colour(0.96, 0.71, 0.51, 0.75))),
        new Planet(19.2 * 0.25 * au, 51118 * 0.2 * planetScale, new Colour(0.53, 0.81, 0.92), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Ice Giant'], 'Uranus', null,
            new PlanetaryRing(1.8, 2.0, new Colour(0.6, 0.9, 1.0, 0.25))),
        new Planet(30.06 * 0.18 * au, 49528 * 0.2 * planetScale, new Colour(0, 0, 0.55), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Ice Giant'], 'Neptune', null,
            new PlanetaryRing(2.3, 2.5, new Colour(0.7, 0.7, 0.8, 0.1))));

    const mars = planets[4];
    const jupiter = planets[5];
    const halfWidth = (jupiter.distance - mars.distance) * 0.25;
    const middle = (jupiter.distance + mars.distance) * 0.5;

    // Define the Sol System
    const sol = new StarSystem(
        "sol",
        "Sol System",
        new Vector2D(0, 0),
        stars,
        planets,
        new AsteroidBelt(middle - halfWidth, middle + halfWidth, 1000, 20)
    );

    stars = [
        new Star(0, 100, new Colour(1, 0.8, 0), null, 0, celestialTypes['star'], null, 'Alpha Centauri A', null, null),
        new Star(200, 70, new Colour(0.9, 0.6, 0), null, randomAngle(), celestialTypes['star'], null, 'Alpha Centauri B', null, null)
    ];
    /* distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '', starSystem = null, ring = null */
    planets = [
        new Planet(1000, 25, new Colour(0.6, 0.4, 0.2), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Desert'], 'Procyon', null, null),
        new Planet(1500, 30, new Colour(0.5, 0.7, 0.9), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Ice'], 'Triton', null, null)
    ];
    // Define Alpha Centauri System
    const alphaCentauri = new StarSystem(
        'alpha-centauri',
        'Alpha Centauri',
        new Vector2D(10000, 5000),
        stars,
        planets,
        new AsteroidBelt(1800, 2200, 500, 8)
    );

    stars = [
        new Star(0, 60, new Colour(0.8, 0.2, 0), null, 0, celestialTypes['star'], null, 'Proxima Centauri', null, null)
    ];
    /* distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '', starSystem = null, ring = null */
    planets = [
        new Planet(500, 15, new Colour(0.4, 0.3, 0.2), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Iron'], 'Proxima b', null, null),
        new Planet(800, 20, new Colour(0.5, 0.4, 0.3), stars[0], randomAngle(), celestialTypes['planet'], subtypes['Desert'], 'Proxima c', null, null)
    ];
    // Define Proxima Centauri System
    const proximaCentauri = new StarSystem(
        'proxima-centauri',
        'Proxima Centauri',
        new Vector2D(8000, -2000),
        stars,
        planets,
        null
    );

    // Connect star systems via hyperlanes
    sol.addHyperlane(alphaCentauri);
    sol.addHyperlane(proximaCentauri);
    alphaCentauri.addHyperlane(proximaCentauri);

    // Initialize star systems
    sol.initialize();
    alphaCentauri.initialize();
    proximaCentauri.initialize();

    sol.linkTargetGates();
    alphaCentauri.linkTargetGates();
    proximaCentauri.linkTargetGates();

    return [sol, alphaCentauri, proximaCentauri];
}