// /src/starSystem/starSystem.js

/**
 * This file contains classes for managing star systems and their connections via hyperlanes.
 * The StarSystem class represents a star system with celestial bodies, ships, and hyperlanes.
 * The Hyperlane class represents a connection between two star systems.
 */
import { Vector2D } from '/src/core/vector2d.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { Planet, Star, JumpGate } from '/src/starSystem/celestialBody.js';
import { Ship } from '/src/ship/ship.js';
import { Asteroid, AsteroidBelt } from '/src/starSystem/asteroidBelt.js';
import { removeObjectFromArrayInPlace } from '/src/core/utils.js';
import { ProjectileManager } from '/src/starSystem/projectileManager.js';
import { ParticleManager } from '/src/starSystem/particleManager.js';
import { CargoContainerManager } from '/src/starSystem/cargoContainerManager.js';
import { CargoContainer } from '/src/starSystem/cargoContainer.js';

/**
 * Represents a star system containing celestial bodies, ships, and connections to other systems.
 */
export class StarSystem {
    /**
     * Creates a new StarSystem instance.
     * @param {string} id - Unique identifier for the star system.
     * @param {string} name - Name of the star system.
     * @param {Vector2D} position - Position of the star system in space.
     */
    constructor(id, name, position) {
        /** @type {string} Unique identifier for the star system. */
        this.id = id;
        /** @type {string} Name of the star system. */
        this.name = name;
        /** @type {Vector2D} Position of the star system in space. */
        this.position = position;
        /** @type {ProjectileManager} Manager for handling projectiles in the star system. */
        this.projectileManager = new ProjectileManager(this);
        /** @type {ParticleManager} Manager for handling particles in the star system. */
        this.particleManager = new ParticleManager(this);
        /** @type {CargoContainerManager} Manager for handling cargo containers in the star system. */
        this.cargoContainerManager = new CargoContainerManager(this);
        /** @type {Array<Star>} Array of stars in the star system. */
        this.stars = [];
        /** @type {Array<Planet>} Array of planets in the star system. */
        this.planets = [];
        /** @type {AsteroidBelt|null} Optional AsteroidBelt for this system*/
        this.asteroidBelt = null;
        /** @type {Array<Asteroid>} Array of interactive asteroids from the asteroid belt, or empty if no belt exists. */
        this.asteroids = [];
        /** @type {Array<JumpGate>} Array of jump gates in the star system. */
        this.jumpGates = [];
        /** @type {Array<Ship>} Array of ships in the star system. */
        this.ships = [];
        /** @type {Array<Hyperlane>} Array of hyperlane connections to other star systems. */
        this.hyperlanes = [];
        /** @type {AsteroidBelt|null} Optional asteroid belt in the star system. */
        /** @type {number} Maximum number of AI-controlled ships allowed in the star system. */
        this.maxAiShips = 5.0;

        /**
         * Seals this instance if directly instantiated (`new Shield()`),
         * but skips for subclasses. Prevents adding/deleting properties.
         */
        if (new.target === StarSystem) Object.seal(this);
    }

    /**
     * Given a game object it removes it from the relevant arrays
     * @param {GameObject} gameObject - The GameObject to remove
     * @returns {boolean} true if the GameObject was not found or removed, false if it was invalid or not removed
     */
    removeGameObject(gameObject) {
        if (!(gameObject instanceof GameObject)) {
            return false;
        }
        if (gameObject.starSystem !== this) {
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
            if (this.asteroidBelt) {
                this.asteroidBelt.removeAsteroid(gameObject);
            } else {
                return false;
            }
        } else if (gameObject instanceof CargoContainer) {
            this.cargoContainerManager.removeCargoContainer(gameObject);
        } else {
            console.warn(`removeGameObject of none supported GameObject`, gameObject);
            return false;
        }
        //gameObject.starSystem = null;
        return true;
    }

    /**
     * Given a game object it adds it to the relevant arrays
     * @param {GameObject} gameObject - The GameObject to remove
     * @returns {boolean} true if the GameObject added
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
            if (this.asteroidBelt) {
                this.asteroidBelt.removeAsteroid(gameObject);
                this.asteroidBelt.addAsteroid(gameObject);
            } else {
                return false;
            }
        } else {
            console.warn(`addGameObject of none supported GameObject`, gameObject);
            return false;
        }
        gameObject.starSystem = this;
        return true;
    }

    /**
     * Given a game object it adds it to the relevant arrays
     * @param {AsteroidBelt} asteroidBelt - The AsteroidBelt to set
     * @returns {boolean} true if the GameObject added
     */
    setAsteroidBelt(asteroidBelt) {
        this.asteroidBelt = asteroidBelt;
        this.asteroids = asteroidBelt.interactiveAsteroids;
        this.asteroidBelt.starSystem = this;
        return true;
    }

    /**
     * Initializes the star system by setting up asteroid belts and jump gates.
     * @returns {void}
     */
    initialize() {
        if (this.asteroidBelt) {
            this.asteroidBelt.init();
        }
        this.initializeJumpGates();
        this.maxAiShips = this.planets.length * 5.0;
    }

    /**
     * Adds a bidirectional hyperlane connection to another star system.
     * @param {StarSystem} targetSystem - The target star system to connect to.
     * @returns {void}
     */
    addHyperlane(targetSystem) {
        const lane = new Hyperlane(this, targetSystem);
        this.hyperlanes.push(lane);
        targetSystem.hyperlanes.push(new Hyperlane(targetSystem, this));
    }

    /**
     * Initializes jump gates for outgoing hyperlanes.
     * @returns {void}
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

    /**
     * Links target gates for hyperlanes.
     * @returns {void}
     */
    linkTargetGates() {
        this.hyperlanes.forEach(lane => {
            if (lane.source === this && !lane.targetGate) {
                const targetGate = lane.target.jumpGates.find(jumpGate =>
                    jumpGate.lane.target === this
                );
                if (!targetGate) {
                    throw new TypeError('Unable to find Jump Gate Lane');
                }
                lane.targetGate = targetGate;
            }
        });
    }

    /**
     * Selects a random ship from the available ships, using a provided validation function.
     * @param {Ship|null} [ship=null] the ship looking for a target
     * @param {GameObject|null} [exclude=null] exclude this other GameObject
     * @param {function(GameObject, GameObject): boolean} [isValid=isValidTarget] - Validation function to check if a target is valid.
     * @return {Ship|null} The selected ship, or null if none available.
     */
    getRandomShip(ship = null, exclude = null, isValid = isValidTarget) {
        const arr1 = this.ships;
        const length1 = arr1 ? arr1.length : 0.0;
        const totalLength = length1;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship) {
                if (item !== ship && item !== exclude && isValid(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Selects a random valid planet from the available planets in the star system.
     * @param {Ship|null} [ship=null] The ship looking for a target (used for validation if provided).
     * @param {Planet|null} [exclude=null] Exclude this planet from selection.
     * @return {Planet|null} The selected planet, or null if none available.
     */
    getRandomPlanet(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0.0;
        const totalLength = length1;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship) {
                if (item !== exclude && isValidTarget(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Selects a random valid star from the available stars in the star system.
     * @param {Ship|null} [ship=null] The ship looking for a target (used for validation if provided).
     * @param {Star|null} [exclude=null] Exclude this star from selection.
     * @return {Star|null} The selected star, or null if none available.
     */
    getRandomStar(ship = null, exclude = null) {
        const arr1 = this.stars;
        const length1 = arr1 ? arr1.length : 0.0;
        const totalLength = length1;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship) {
                if (item !== exclude && isValidTarget(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Selects a random valid jump gate from the available jump gates in the star system.
     * @param {Ship|null} [ship=null] The ship looking for a target (used for validation if provided).
     * @param {JumpGate|null} [exclude=null] Exclude this jump gate from selection.
     * @return {JumpGate|null} The selected jump gate, or null if none available.
     */
    getRandomJumpGate(ship = null, exclude = null) {
        const arr1 = this.jumpGates;
        const length1 = arr1 ? arr1.length : 0.0;
        const totalLength = length1;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship) {
                if (item !== exclude && isValidTarget(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Selects a random valid asteroid from the available asteroids in the star system.
     * @param {Ship|null} [ship=null] The ship looking for a target (used for validation if provided).
     * @param {Asteroid|null} [exclude=null] Exclude this asteroid from selection.
     * @return {Asteroid|null} The selected asteroid, or null if none available.
     */
    getRandomAsteroid(ship = null, exclude = null) {
        const arr1 = this.asteroids;
        const length1 = arr1 ? arr1.length : 0.0;
        const totalLength = length1;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            item = arr1[randomIndex];
            if (ship) {
                if (item !== exclude && isValidTarget(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Selects a random valid jump gate or planet from the available ones in the star system.
     * @param {Ship|null} [ship=null] The ship looking for a target (used for validation if provided).
     * @param {GameObject|null} [exclude=null] Exclude this game object from selection.
     * @return {JumpGate|Planet|null} The selected jump gate or planet, or null if none available.
     */
    getRandomJumpGatePlanet(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0.0;
        const arr2 = this.jumpGates;
        const length2 = arr2 ? arr2.length : 0.0;
        const totalLength = length1 + length2;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            if (randomIndex < length1) {
                item = arr1[randomIndex];
            } else {
                item = arr2[randomIndex - length1];
            }
            if (ship) {
                if (item !== exclude && isValidTarget(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Selects a random valid planet or asteroid from the available ones in the star system.
     * @param {Ship|null} [ship=null] The ship looking for a target (used for validation if provided).
     * @param {GameObject|null} [exclude=null] Exclude this game object from selection.
     * @return {Planet|Asteroid|null} The selected planet or asteroid, or null if none available.
     */
    getRandomPlanetAsteroid(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0.0;
        const arr2 = this.asteroids;
        const length2 = arr2 ? arr2.length : 0.0;
        const totalLength = length1 + length2;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            if (randomIndex < length1) {
                item = arr1[randomIndex];
            } else {
                item = arr2[randomIndex - length1];
            }
            if (ship) {
                if (item !== exclude && isValidTarget(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Selects a random valid jump gate, planet, or asteroid from the available ones in the star system.
     * @param {Ship|null} [ship=null] The ship looking for a target (used for validation if provided).
     * @param {GameObject|null} [exclude=null] Exclude this game object from selection.
     * @return {JumpGate|Planet|Asteroid|null} The selected jump gate, planet, or asteroid, or null if none available.
     */
    getRandomJumpGatePlanetAsteroid(ship = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0.0;
        const arr2 = this.jumpGates;
        const length2 = arr2 ? arr2.length : 0.0;
        const arr3 = this.asteroids;
        const length3 = arr3 ? arr3.length : 0.0;
        const totalLength = length1 + length2 + length3;
        if (totalLength == 0.0) {
            return null;
        }
        let attempts = totalLength;
        let item = null;
        while (attempts > 0.0) {
            const randomIndex = Math.floor(Math.random() * totalLength);
            if (randomIndex < length1) {
                item = arr1[randomIndex];
            } else if (randomIndex < length1 + length2) {
                item = arr2[randomIndex - length1];
            } else {
                item = arr3[randomIndex - length1 - length2];
            }
            if (ship) {
                if (item !== exclude && isValidTarget(ship, item)) {
                    return item;
                }
            } else if (!item.isDespawned() && item !== exclude) {
                return item;
            }
            attempts--;
        }
        return null;
    }

    /**
     * Finds the closest valid jump gate to the ship.
     * @param {Ship} ship - The ship looking for a target.
     * @param {GameObject|null} [exclude=null] - Exclude this GameObject.
     * @returns {JumpGate|null} The closest jump gate, or null if none available.
     */
    getClosestJumpGate(ship, exclude = null) {
        const arr1 = this.jumpGates;
        const length1 = arr1 ? arr1.length : 0.0;
        if (length1 === 0.0) return null;

        let closestItem = null;
        let closestSquaredDistance = Infinity;

        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            if (item !== exclude && isValidTarget(ship, item)) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestSquaredDistance) {
                    closestSquaredDistance = squaredDistance;
                    closestItem = item;
                }
            }
        }

        return closestItem;
    }

    /**
     * Finds the next closest valid jump gate after the current gate, wrapping to the closest if none further.
     * @param {Ship} ship - The ship looking for a target.
     * @param {JumpGate|null} [currentGate=null] - The currently selected jump gate.
     * @param {GameObject|null} [exclude=null] - Exclude this GameObject.
     * @returns {JumpGate|null} The next closest jump gate, or null if none available.
     */
    cycleClosestJumpGate(ship, currentGate = null, exclude = null) {
        const arr1 = this.jumpGates;
        const length1 = arr1 ? arr1.length : 0.0;
        if (length1 === 0.0) return null;

        // Compute current gate's distance if provided
        let currentDistanceSq = Infinity;
        if (currentGate && isValidTarget(ship, currentGate)) {
            currentDistanceSq = currentGate.position.distanceSquaredTo(ship.position);
        }

        let closestItem = null;
        let closestSquaredDistance = Infinity;
        let nextClosestItem = null;
        let nextClosestSquaredDistance = Infinity;

        // Single pass: find closest and next closest gate
        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            if (item !== exclude && isValidTarget(ship, item)) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                // Update closest gate
                if (squaredDistance < closestSquaredDistance) {
                    closestSquaredDistance = squaredDistance;
                    closestItem = item;
                }
                // Update next closest (greater than current, smallest such distance)
                if (squaredDistance > currentDistanceSq && squaredDistance < nextClosestSquaredDistance) {
                    nextClosestSquaredDistance = squaredDistance;
                    nextClosestItem = item;
                }
            }
        }

        // Return next closest if found, else wrap to closest
        return nextClosestItem || closestItem;
    }

    /**
     * Finds the closest valid planet to the ship.
     * @param {Ship} ship - The ship looking for a target.
     * @param {Planet|null} [exclude=null] - Exclude this Planet.
     * @returns {Planet|null} The closest planet, or null if none available.
     */
    getClosestPlanet(ship, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0.0;
        if (length1 === 0.0) {
            ship.debugLog(() => console.log(`${this.constructor.name}: No planets in system`));
            return null;
        }

        let closestItem = null;
        let closestSquaredDistance = Infinity;

        ship.debugLog(() => console.log(`${this.constructor.name}: Checking ${length1} planets`));

        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            const isValid = isValidTarget(ship, item);
            ship.debugLog(() => console.log(`${this.constructor.name}: Planet ${item.name}: isValid=${isValid}, distance=${item.position.distanceSquaredTo(ship.position)}`));
            if (item !== exclude && isValid) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestSquaredDistance) {
                    closestSquaredDistance = squaredDistance;
                    closestItem = item;
                }
            }
        }

        if (!closestItem) {
            ship.debugLog(() => console.log(`${this.constructor.name}: No valid planets found`));
        }

        return closestItem;
    }

    /**
     * Finds the next closest valid planet after the current planet, wrapping to the closest if none further.
     * @param {Ship} ship - The ship looking for a target.
     * @param {Planet|null} [currentPlanet=null] - The currently selected planet.
     * @param {Planet|null} [exclude=null] - Exclude this Planet.
     * @returns {Planet|null} The next closest planet, or null if none available.
     */
    cycleClosestPlanet(ship, currentPlanet = null, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0.0;
        if (length1 === 0.0) return null;

        let currentDistanceSq = Infinity;
        if (currentPlanet && isValidTarget(ship, currentPlanet)) {
            currentDistanceSq = currentPlanet.position.distanceSquaredTo(ship.position);
        }

        let closestItem = null;
        let closestDistanceSq = Infinity;
        let nextClosestItem = null;
        let nextClosestDistanceSq = Infinity;

        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            if (item !== exclude && isValidTarget(ship, item)) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestDistanceSq) {
                    closestDistanceSq = squaredDistance;
                    closestItem = item;
                }
                if (squaredDistance > currentDistanceSq && squaredDistance < nextClosestDistanceSq) {
                    nextClosestDistanceSq = squaredDistance;
                    nextClosestItem = item;
                }
            }
        }

        return nextClosestItem || closestItem;
    }

    /**
     * Finds the closest valid ship to the source ship.
     * @param {Ship} ship - The ship looking for a target.
     * @param {Ship|null} [exclude=null] - Exclude this ship.
     * @param {function(Ship, Ship): boolean} [isValid=isValidTarget] - Validation function to check if a target is valid.
     * @returns {Ship|null} The closest ship, or null if none available.
     */
    getClosestShip(ship, exclude = null, isValid = isValidTarget) {
        const arr1 = this.ships;
        const length1 = arr1 ? arr1.length : 0.0;
        if (length1 === 0.0) {
            ship.debugLog(() => console.log(`${this.constructor.name}: No ships in system`));
            return null;
        }

        let closestItem = null;
        let closestSquaredDistance = Infinity;

        ship.debugLog(() => console.log(`${this.constructor.name}: Checking ${length1} ships`));

        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            const valid = isValid(ship, item);
            ship.debugLog(() => console.log(`${this.constructor.name}: Ship ${item.name}: isValid=${valid}, distance=${item.position.distanceSquaredTo(ship.position)}`));
            if (item !== ship && item !== exclude && valid) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestSquaredDistance) {
                    closestSquaredDistance = squaredDistance;
                    closestItem = item;
                }
            }
        }

        if (!closestItem) {
            ship.debugLog(() => console.log(`${this.constructor.name}: No valid ships found`));
        }

        return closestItem;
    }

    /**
     * Finds the next closest valid ship after the current ship, wrapping to the closest if none further.
     * @param {Ship} ship - The ship looking for a target.
     * @param {Ship|null} [currentShip=null] - The currently selected ship.
     * @param {Ship|null} [exclude=null] - Exclude this ship.
     * @param {function(Ship, Ship): boolean} [isValid=isValidTarget] - Validation function to check if a target is valid.
     * @returns {Ship|null} The next closest ship, or null if none available.
     */
    cycleClosestShip(ship, currentShip = null, exclude = null, isValid = isValidTarget) {
        const arr1 = this.ships;
        const length1 = arr1 ? arr1.length : 0.0;
        if (length1 === 0.0) return null;

        let currentDistanceSq = Infinity;
        if (currentShip && isValid(ship, currentShip)) {
            currentDistanceSq = currentShip.position.distanceSquaredTo(ship.position);
        }

        let closestItem = null;
        let closestDistanceSq = Infinity;
        let nextClosestItem = null;
        let nextClosestDistanceSq = Infinity;

        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            const valid = isValid(ship, item);
            if (item !== ship && item !== exclude && valid) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestDistanceSq) {
                    closestDistanceSq = squaredDistance;
                    closestItem = item;
                }
                if (squaredDistance > currentDistanceSq && squaredDistance < nextClosestDistanceSq) {
                    nextClosestDistanceSq = squaredDistance;
                    nextClosestItem = item;
                }
            }
        }

        return nextClosestItem || closestItem;
    }

    /**
     * Finds the closest valid asteroid to the ship.
     * @param {Ship} ship - The ship looking for a target.
     * @param {Asteroid|null} [exclude=null] - Exclude this Asteroid.
     * @returns {Asteroid|null} The closest asteroid, or null if none available.
     */
    getClosestAsteroid(ship, exclude = null) {
        const arr1 = this.asteroids;
        const length1 = arr1 ? arr1.length : 0.0;

        if (length1 === 0.0) return null;

        let closestItem = null;
        let closestSquaredDistance = Infinity;

        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            if (item !== exclude && isValidTarget(ship, item)) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestSquaredDistance) {
                    closestSquaredDistance = squaredDistance;
                    closestItem = item;
                }
            }
        }

        return closestItem;
    }

    /**
     * Finds the next closest valid asteroid after the current asteroid, wrapping to the closest if none further.
     * @param {Ship} ship - The ship looking for a target.
     * @param {Asteroid|null} [currentAsteroid=null] - The currently selected asteroid.
     * @param {Asteroid|null} [exclude=null] - Exclude this Asteroid.
     * @returns {Asteroid|null} The next closest asteroid, or null if none available.
     */
    cycleClosestAsteroid(ship, currentAsteroid = null, exclude = null) {
        const arr1 = this.asteroids;
        const length1 = arr1 ? arr1.length : 0.0;
        if (length1 === 0.0) return null;

        let currentDistanceSq = Infinity;
        if (currentAsteroid && isValidTarget(ship, currentAsteroid)) {
            currentDistanceSq = currentAsteroid.position.distanceSquaredTo(ship.position);
        }

        let closestItem = null;
        let closestDistanceSq = Infinity;
        let nextClosestItem = null;
        let nextClosestDistanceSq = Infinity;

        for (let i = 0.0; i < length1; i++) {
            const item = arr1[i];
            if (item !== exclude && isValidTarget(ship, item)) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestDistanceSq) {
                    closestDistanceSq = squaredDistance;
                    closestItem = item;
                }
                if (squaredDistance > currentDistanceSq && squaredDistance < nextClosestDistanceSq) {
                    nextClosestDistanceSq = squaredDistance;
                    nextClosestItem = item;
                }
            }
        }

        return nextClosestItem || closestItem;
    }

    /**
     * Finds the closest valid jump gate or planet to the ship.
     * @param {Ship} ship The ship looking for a target.
     * @param {GameObject|null} [exclude=null] Exclude this game object from selection.
     * @return {JumpGate|Planet|null} The closest jump gate or planet, or null if none available.
     */
    getClosestJumpGatePlanet(ship, exclude = null) {
        const arr1 = this.planets;
        const length1 = arr1 ? arr1.length : 0.0;
        const arr2 = this.jumpGates;
        const length2 = arr2 ? arr2.length : 0.0;
        const totalLength = length1 + length2;
        if (totalLength == 0.0) {
            return null;
        }
        let item = null;
        let closestItem = arr1[0];
        let closestSquaredDistance = closestItem.position.distanceSquaredTo(ship.position);
        for (let i = 1.0; i < totalLength; i++) {
            if (i < length1) {
                item = arr1[i];
            } else {
                item = arr2[i - length1];
            }
            if (item !== exclude && isValidTarget(ship, item)) {
                const squaredDistance = item.position.distanceSquaredTo(ship.position);
                if (squaredDistance < closestSquaredDistance) {
                    closestItem = item;
                }
            }
        }
        return closestItem;
    }

    /**
     * Finds a jump gate in the current system that leads to the target system.
     * @param {StarSystem} targetSystem - The star system to jump to.
     * @returns {JumpGate|null} The jump gate leading to the target system, or null if none found.
     */
    getJumpGateToSystem(targetSystem) {
        const gates = this.jumpGates;
        for (let i = 0.0; i < gates.length; i++) {
            const gate = gates[i];
            if (gate.lane && gate.lane.target === targetSystem) return gate;
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
        /** @type {StarSystem} The source star system of the hyperlane. */
        this.source = source;
        /** @type {StarSystem} The target star system of the hyperlane. */
        this.target = target;
        /** @type {number} The squared distance between the source and target star systems. */
        this.distSquared = this.calculateDistSquared();
        /** @type {JumpGate|null} The jump gate associated with the source star system. */
        this.sourceGate = null;
        /** @type {JumpGate|null} The jump gate associated with the target star system. */
        this.targetGate = null;

        if (new.target === Hyperlane) Object.seal(this);
    }

    /**
     * Calculates the squared distance between the source and target star systems.
     * @returns {number} The squared distance.
     */
    calculateDistSquared() {
        return this.source.position.distanceSquaredTo(this.target.position);
    }
}