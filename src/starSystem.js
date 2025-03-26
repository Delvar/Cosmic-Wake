// starSystem.js

/**
 * This file contains classes for managing star systems and their connections via hyperlanes.
 * The StarSystem class represents a star system with celestial bodies, ships, and hyperlanes.
 * The Hyperlane class represents a connection between two star systems.
 */

import { JumpGate } from './celestialBody.js';

/**
 * Represents a star system containing celestial bodies, ships, and connections to other systems.
 */
export class StarSystem {
    /**
     * Creates a new StarSystem instance.
     * @param {string} id - Unique identifier for the star system.
     * @param {string} name - Name of the star system.
     * @param {Vector2D} position - Position of the star system in space.
     * @param {Array} celestialBodies - Array of celestial bodies (e.g., planets, stars) in the system.
     */
    constructor(id, name, position, celestialBodies) {
        this.id = id;
        this.name = name;
        this.position = position;
        // Link each celestial body to this star system
        this.celestialBodies = celestialBodies.map(body => {
            body.starSystem = this;
            return body;
        });
        this.ships = []; // Array to hold ships in the system
        this.maxAIShips = 10; // Maximum number of AI-controlled ships allowed
        this.hyperlanes = []; // Array to hold hyperlane connections
        this.asteroidBelt = null; // Optional asteroid belt
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
                this.celestialBodies.push(jumpGate);
                lane.sourceGate = jumpGate; // Set source gate reference
            }
        });
    }

    linkTargetGates() {
        this.hyperlanes.forEach(lane => {
            if (lane.source === this && !lane.targetGate) {
                lane.targetGate = lane.target.celestialBodies.find(body =>
                    body instanceof JumpGate && body.lane.target === this
                );
            }
        });
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