// galaxy.js
import { StarSystem } from './starSystem.js';
import { CelestialBody, PlanetaryRing, celestialTypes } from './celestialBody.js';
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
    // Define the Sol System
    const sol = new StarSystem("sol", "Sol System", new Vector2D(0, 0), [
        new CelestialBody(0, 100, new Colour(1, 1, 0), null, 0, celestialTypes['star'], null, 'Sun', null),
        new CelestialBody(800, 20, new Colour(0.55, 0.27, 0.07), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Iron'], 'Mercury', null),
        new CelestialBody(1400, 30, new Colour(1, 0.84, 0), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Venus', null),
        new CelestialBody(2000, 34, new Colour(0, 0.72, 0.92), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Earth', null),
        new CelestialBody(2800, 24, new Colour(1, 0.27, 0), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Mars', null),
        new CelestialBody(4000, 60, new Colour(0.85, 0.65, 0.13), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Jupiter', null),
        new CelestialBody(5600, 50, new Colour(0.96, 0.64, 0.38), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Saturn', null,
            new PlanetaryRing(1.5, 2.5, new Colour(0.96, 0.71, 0.51, 0.75))),
        new CelestialBody(7200, 40, new Colour(0.53, 0.81, 0.92), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Uranus', null,
            new PlanetaryRing(1.8, 2.0, new Colour(0.6, 0.9, 1.0, 0.25))),
        new CelestialBody(8000, 40, new Colour(0, 0, 0.55), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Neptune', null,
            new PlanetaryRing(2.3, 2.5, new Colour(0.7, 0.7, 0.8, 0.1)))
    ]);
    const earth = sol.celestialBodies[3];
    sol.celestialBodies.push(
        new CelestialBody(60, 8, new Colour(0.83, 0.83, 0.83), earth, randomAngle(), celestialTypes['satellite'], null, 'Moon', sol)
    );
    sol.asteroidBelt = new AsteroidBelt(sol, 3000, 3800, 750, 10);

    // Define Alpha Centauri System
    const alphaCentauri = new StarSystem("alpha-centauri", "Alpha Centauri", new Vector2D(10000, 5000), [
        new CelestialBody(0, 80, new Colour(1, 0.8, 0), null, 0, celestialTypes['star'], null, 'Alpha Centauri A', null),
        new CelestialBody(200, 70, new Colour(0.9, 0.6, 0), null, randomAngle(), celestialTypes['star'], null, 'Alpha Centauri B', null),
        new CelestialBody(1000, 25, new Colour(0.6, 0.4, 0.2), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Desert'], 'Procyon', null),
        new CelestialBody(1500, 30, new Colour(0.5, 0.7, 0.9), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice'], 'Triton', null)
    ]);
    alphaCentauri.asteroidBelt = new AsteroidBelt(alphaCentauri, 1800, 2200, 500, 8);

    // Define Proxima Centauri System
    const proximaCentauri = new StarSystem("proxima-centauri", "Proxima Centauri", new Vector2D(8000, -2000), [
        new CelestialBody(0, 60, new Colour(0.8, 0.2, 0), null, 0, celestialTypes['star'], null, 'Proxima Centauri', null),
        new CelestialBody(500, 15, new Colour(0.4, 0.3, 0.2), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Iron'], 'Proxima b', null),
        new CelestialBody(800, 20, new Colour(0.5, 0.4, 0.3), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Desert'], 'Proxima c', null)
    ]);
    proximaCentauri.asteroidBelt = null;

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