// starSystem.js

/**
 * This file contains classes for managing star systems and their connections via hyperlanes.
 * The StarSystem class represents a star system with celestial bodies, ships, and hyperlanes.
 * The Hyperlane class represents a connection between two star systems.
 */

import { GameObject, isValidTarget } from './gameObject.js';
import { CelestialBody, Planet, Star, JumpGate } from './celestialBody.js';
import { Ship } from './ship.js';
import { Asteroid } from './asteroidBelt.js';
import { removeObjectFromArrayInPlace } from './utils.js';
import { AsteroidBelt } from './asteroidBelt.js';

/**
 * Represents a star system containing celestial bodies, ships, and connections to other systems.
 */
export class StarSystem {
    /**
     * Creates a new StarSystem instance.
     * @param {string} id - Unique identifier for the star system.
     * @param {string} name - Name of the star system.
     * @param {Vector2D} position - Position of the star system in space.
     * @param {Array} stars - Array of stars in the system.
     * @param {Array} planets - Array of planets in the system.
     * @param {AsteroidBelt} asteroidBelt - an optional asteroidBelt.
     */
    constructor(id, name, position, stars, planets, asteroidBelt = null) {
        this.id = id;
        this.name = name;
        this.position = position;

        // Link each celestial body to this star system
        this.stars = stars;
        const starsLength = stars.length;
        for (let i = 0; i < starsLength; i++) {
            stars[i].starSystem = this;
        };

        this.planets = planets;
        const planetsLength = planets.length;
        for (let i = 0; i < planetsLength; i++) {
            planets[i].starSystem = this;
        };

        this.jumpGates = [];
        this.ships = []; // Array to hold ships in the system
        this.maxAIShips = 10; // Maximum number of AI-controlled ships allowed
        this.hyperlanes = []; // Array to hold hyperlane connections
        this.asteroidBelt = asteroidBelt; // Optional asteroid belt
        if (asteroidBelt) {
            asteroidBelt.starSystem = this;
            asteroidBelt.init();
        }
    }

    /**
     * Given a game object it removes it from the relevant arrays
     * @param {GameObject} gameObject - The GameObject to remove
     * @returns {boolean} true if the GameObejct was not found or removed, false if it was invalid or not removed
     */
    removeGameObject(gameObject) {
        if (!(gameObject instanceof GameObject)) {
            return false;
        }

        if (gameObject instanceof Ship) {
            removeObjectFromArrayInPlace(gameObject, this.ships);
        } else if (gameObject instanceof Planet) {
            removeObjectFromArrayInPlace(gameObject, this.planets);
        } else if (gameObject instanceof Star) {
            removeObjectFromArrayInPlace(gameObject, this.stars);
        } else if (gameObject instanceof JumpGate) {
            removeObjectFromArrayInPlace(gameObject, this.jumpGates);
        } else if (gameObject instanceof Asteroid) {
            this.asteroidBelt.removeAsteroid(gameObject);
        } else {
            console.warn(`removeGameObject of none supported GameObject`, gameObject);
            return false;
        }
        gameObject.starSystem = null;
        return true;
    }

    /**
     * Given a game object it adds it to the relevant arrays
     * @param {GameObject} gameObject - The GameObject to remove
     * @returns {boolean} true if the GameObejct added
     */
    addGameObject(gameObject) {
        if (!(gameObject instanceof GameObject)) {
            return false;
        }
        if (gameObject instanceof Ship) {
            removeObjectFromArrayInPlace(gameObject, this.ships);
            this.ships.push(gameObject);
        } else if (gameObject instanceof Planet) {
            removeObjectFromArrayInPlace(gameObject, this.planets);
            this.planets.push(gameObject);
        } else if (gameObject instanceof Star) {
            removeObjectFromArrayInPlace(gameObject, this.stars);
            this.stars.push(gameObject);
        } else if (gameObject instanceof JumpGate) {
            removeObjectFromArrayInPlace(gameObject, this.jumpGates);
            this.jumpGates.push(gameObject);
        } else if (gameObject instanceof Asteroid) {
            this.asteroidBelt.removeAsteroid(gameObject);
            this.asteroidBelt.addAsteroid(gameObject);
        } else {
            console.warn(`addGameObject of none supported GameObject`, gameObject);
            return false;
        }
        gameObject.starSystem = this;
        return true;
    }

    /**
     * Initializes the star system by setting up asteroid belts and jump gates.
     */
    initialize() {
        this.initializeJumpGates();
    }

    /**
     * Adds a bidirectional hyperlane connection to another star system.
     * @param {StarSystem} targetSystem - The target star system to connect to.
     */
    addHyperlane(targetSystem) {
        const lane = new Hyperlane(this, targetSystem);
        this.hyperlanes.push(lane);
        targetSystem.hyperlanes.push(new Hyperlane(targetSystem, this));
    }

    /**
     * Initializes jump gates for outgoing hyperlanes.
     */
    initializeJumpGates() {
        this.hyperlanes.forEach(lane => {
            if (lane.source === this) {
                const jumpGate = new JumpGate(lane, this.position);
                this.jumpGates.push(jumpGate);
                lane.sourceGate = jumpGate; // Set source gate reference
            }
        });
    }

    linkTargetGates() {
        this.hyperlanes.forEach(lane => {
            if (lane.source === this && !lane.targetGate) {
                lane.targetGate = lane.target.jumpGates.find(jumpGate =>
                    jumpGate.lane.target === this
                );
            }
        });
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {Ship|null} The selected ship, or null if none available.
     */
    getRandomShip(ship = null, exclude = null) {
        const arr1 = this.ships;
        const length1 = arr1 ? arr1.length : 0;
        const totalLength = length1;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {Planet|null} The selected body, or null if none available.
     */
    getRandomPlanet(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0;
        const totalLength = length1;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {Star|null} The selected body, or null if none available.
     */
    getRandomStar(ship = null, exclude = null) {
        const arr1 = this.stars;
        const length1 = arr1 ? arr1.length : 0;
        const totalLength = length1;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {JumpGate|null} The selected body, or null if none available.
     */
    getRandomJumpGate(ship = null, exclude = null) {
        const arr1 = this.jumpGates;
        const length1 = arr1 ? arr1.length : 0;
        const totalLength = length1;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {Asteroid|null} The selected body, or null if none available.
     */
    getRandomAsteroid(ship = null, exclude = null) {
        return this.asteroidBelt.getRandomAsteroid(ship, exclude);
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {JumpGate|Planet|null} The selected body, or null if none available.
     */
    getRandomJumpGatePlanet(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0;
        const arr2 = this.jumpGates;
        const length2 = arr2 ? arr2.length : 0;
        const totalLength = length1 + length2;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            if (randomIndex < length1) {
                item = arr1[randomIndex];
            } else {
                item = arr2[randomIndex - length1];
            }
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {Planet|Asteroid|null} The selected body, or null if none available.
     */
    getRandomPlanetAsteroid(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0;
        const arr2 = this.asteroidBelt?.interactiveAsteroids;
        const length2 = arr2 ? arr2.length : 0;
        const totalLength = length1 + length2;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            if (randomIndex < length1) {
                item = arr1[randomIndex];
            } else {
                item = arr2[randomIndex - length1];
            }
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * @param {Ship} [ship=null] the ship looking for a target
     * @param {GameObject} [exclude =null] exclude this other GameObject
     * @return {JumpGate|Planet|Asteroid|null} The selected body, or null if none available.
     */
    getRandomJumpGatePlanetAsteroid(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0;
        const arr2 = this.jumpGates;
        const length2 = arr2 ? arr2.length : 0;
        const arr3 = this.asteroidBelt?.interactiveAsteroids;
        const length3 = arr3 ? arr3.length : 0;
        const totalLength = length1 + length2 + length3;
        if (totalLength == 0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            if (randomIndex < length1) {
                item = arr1[randomIndex];
            } else if (randomIndex < length1 + length2) {
                item = arr2[randomIndex - length1];
            } else {
                item = arr3[randomIndex - length1 - length2];
            }
            if (ship && item !== exclude && isValidTarget(ship, item)) {
                return item;
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }
}

/**
 * Represents a hyperlane connection between two star systems.
 */
export class Hyperlane {
    /**
     * Creates a new Hyperlane instance.
     * @param {StarSystem} source - The source star system.
     * @param {StarSystem} target - The target star system.
     */
    constructor(source, target) {
        this.source = source;
        this.target = target;
        this.distSquared = this.calculateDistSquared();
        this.sourceGate = null;
        this.targetGate = null;
    }

    /**
     * Calculates the squared distance between the source and target star systems.
     * @returns {number} The squared distance.
     */
    calculateDistSquared() {
        return this.source.position.distanceSquaredTo(this.target.position);
    }
}