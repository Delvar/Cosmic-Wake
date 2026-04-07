// /src/core/galaxy.js

import { StarSystem } from '/src/starSystem/starSystem.js';
import { Planet, Star, PlanetaryRing, celestialTypes } from '/src/starSystem/celestialBody.js';
import { AsteroidBelt } from '/src/starSystem/asteroidBelt.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Colour } from '/src/core/colour.js';
import { TWO_PI } from '/src/core/utils.js';

/**
 * Creates and initializes the galaxy with star systems, celestial bodies, and hyperlanes.
 * @returns {Array<StarSystem>} An array of initialized StarSystem instances.
 */
export function createGalaxy() {

    const randomAngle = () => Math.random() * TWO_PI;
    const subtypes = celestialTypes['planet'].subtypes;
    const au = 4000.0;
    const planetScale = 0.008;

    // Define the Sol System
    const sol = new StarSystem("sol", "Sol", new Vector2D(0.0, 0.0));
    const sun = new Star(0.0, 300.0, new Colour(1, 1.0, 0.0), null, 0.0, celestialTypes['star'], null, 'Sun', sol, null);
    sol.addGameObject(sun);
    sol.addGameObject(new Planet(0.39 * au, 4879 * planetScale, new Colour(0.55, 0.27, 0.07), sun, randomAngle(), celestialTypes['planet'], subtypes['Iron'], 'Mercury', sol, null));
    sol.addGameObject(new Planet(0.72 * au, 12104 * planetScale, new Colour(1, 0.84, 0.0), sun, randomAngle(), celestialTypes['planet'], subtypes['Terrestrial'], 'Venus', sol, null));
    const earth = new Planet(1.0 * au, 12756 * planetScale, new Colour(0.0, 0.72, 0.92), sun, randomAngle(), celestialTypes['planet'], subtypes['Terrestrial'], 'Earth', sol, null);
    sol.addGameObject(earth);
    sol.addGameObject(new Planet(earth.radius * 3.0, 20.0, new Colour(0.83, 0.83, 0.83), earth, randomAngle(), celestialTypes['satellite'], null, 'Luna', sol, null));
    const mars = new Planet(1.52 * au, 6792 * planetScale, new Colour(1, 0.27, 0.0), sun, randomAngle(), celestialTypes['planet'], subtypes['Terrestrial'], 'Mars', sol, null);
    sol.addGameObject(mars);
    const jupiter = new Planet(5.2 * 0.4 * au, 142984 * 0.15 * planetScale, new Colour(0.85, 0.65, 0.13), sun, randomAngle(), celestialTypes['planet'], subtypes['Gas Giant'], 'Jupiter', sol, null);
    sol.addGameObject(jupiter);
    sol.addGameObject(new Planet(9.54 * 0.4 * au, 120536 * 0.15 * planetScale, new Colour(0.96, 0.64, 0.38), sun, randomAngle(), celestialTypes['planet'], subtypes['Gas Giant'], 'Saturn', sol, new PlanetaryRing(1.5, 2.5, new Colour(0.96, 0.71, 0.51, 0.75))));
    sol.addGameObject(new Planet(19.2 * 0.25 * au, 51118 * 0.2 * planetScale, new Colour(0.53, 0.81, 0.92), sun, randomAngle(), celestialTypes['planet'], subtypes['Ice Giant'], 'Uranus', sol, new PlanetaryRing(1.8, 2.0, new Colour(0.6, 0.9, 1.0, 0.25))));
    sol.addGameObject(new Planet(30.06 * 0.18 * au, 49528 * 0.2 * planetScale, new Colour(0.0, 0.0, 0.55), sun, randomAngle(), celestialTypes['planet'], subtypes['Ice Giant'], 'Neptune', sol, new PlanetaryRing(2.3, 2.5, new Colour(0.7, 0.7, 0.8, 0.1))));

    const halfWidth = (jupiter.distance - mars.distance) * 0.3;
    const middle = (jupiter.distance + mars.distance) * 0.5;
    sol.setAsteroidBelt(new AsteroidBelt(middle - halfWidth, middle + halfWidth, 20.0, 20.0, 5.0));

    // Define the Alpha Centauri System
    const alphaCentauri = new StarSystem('alpha-centauri', 'Alpha Centauri', new Vector2D(10000, 5000.0));
    const alphaCentauriA = new Star(0.0, 100.0, new Colour(1, 0.8, 0.0), null, 0.0, celestialTypes['star'], null, 'Alpha Centauri A', alphaCentauri, null);
    alphaCentauri.addGameObject(alphaCentauriA);
    alphaCentauri.addGameObject(new Star(200, 70.0, new Colour(0.9, 0.6, 0.0), null, randomAngle(), celestialTypes['star'], null, 'Alpha Centauri B', alphaCentauri, null));
    alphaCentauri.addGameObject(new Planet(1000, 25.0, new Colour(0.6, 0.4, 0.2), alphaCentauriA, randomAngle(), celestialTypes['planet'], subtypes['Desert'], 'Procyon', alphaCentauri, null));
    alphaCentauri.addGameObject(new Planet(1500, 30.0, new Colour(0.5, 0.7, 0.9), alphaCentauriA, randomAngle(), celestialTypes['planet'], subtypes['Ice'], 'Triton', alphaCentauri, null));
    alphaCentauri.setAsteroidBelt(new AsteroidBelt(1800, 2200.0, 20.0, 20.0, 5.0));

    // Define the Proxima Centauri System
    const proximaCentauri = new StarSystem('proxima-centauri', 'Proxima Centauri', new Vector2D(8000, -2000.0));

    const proximaCentauriA = new Star(0.0, 60.0, new Colour(0.8, 0.2, 0.0), null, 0.0, celestialTypes['star'], null, 'Proxima Centauri', proximaCentauri, null);
    proximaCentauri.addGameObject(proximaCentauriA);
    proximaCentauri.addGameObject(new Planet(500, 15.0, new Colour(0.4, 0.3, 0.2), proximaCentauriA, randomAngle(), celestialTypes['planet'], subtypes['Iron'], 'Proxima b', proximaCentauri, null));
    proximaCentauri.addGameObject(new Planet(800, 20.0, new Colour(0.5, 0.4, 0.3), proximaCentauriA, randomAngle(), celestialTypes['planet'], subtypes['Desert'], 'Proxima c', proximaCentauri, null));

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