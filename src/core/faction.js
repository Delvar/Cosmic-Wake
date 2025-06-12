// /src/core/faction.js

/**
 * Enum for faction relationship states.
 * @type {Object.<string, number>}
 */
export const FactionRelationship = {
    Allied: 0,
    Neutral: 1,
    Hostile: 2
};
Object.freeze(FactionRelationship);

/**
 * Represents a faction with a unique name and ID.
 */
export class Faction {
    /**
     * @param {string} name - The faction name (e.g., "Player").
     * @param {number} id - The unique faction ID.
     * @param {FactionManager} manager - The FactionManager instance.
     */
    constructor(name, id, manager) {
        /** @type {string} The faction name. */
        this.name = name;
        /** @type {number} The unique faction ID. */
        this.id = id;
        /** @type {FactionManager} Reference to the FactionManager. */
        this.manager = manager;

        if (new.target === Faction) Object.seal(this);
    }

    /**
     * Gets the relationship with another faction.
     * @param {Faction} otherFaction - The other faction.
     * @returns {number} The relationship (FactionRelationship value).
     */
    getRelationship(otherFaction) {
        return this.manager.getRelationship(this, otherFaction);
    }

    /**
     * Gets the faction name.
     * @returns {string} The faction name.
     */
    getName() {
        return this.name;
    }
}

/**
 * Manages factions and their relationships.
 */
export class FactionManager {
    /**
     * Creates a new FactionManager instance.
     */
    constructor() {
        /** @type {Map<string, Faction>} Map of faction names to Faction objects. */
        this.factions = new Map();
        /** @type {number[][]} 2D array of relationships (FactionRelationship values). */
        this.relationships = [];

        if (new.target === FactionManager) Object.seal(this);
    }

    /**
     * Adds a new faction with default Neutral relationships.
     * @param {string} name - The faction name.
     * @returns {Faction} The created faction.
     */
    addFaction(name) {
        if (this.factions.has(name)) {
            return this.factions.get(name);
        }

        const id = this.factions.size;
        const faction = new Faction(name, id, this);
        this.factions.set(name, faction);

        // Initialize relationships for new faction
        this.relationships[id] = new Array(this.factions.size).fill(FactionRelationship.Neutral);
        for (let i = 0; i < id; i++) {
            this.relationships[i][id] = FactionRelationship.Neutral;
        }
        this.relationships[id][id] = FactionRelationship.Allied; // Self-allied

        return faction;
    }

    /**
     * Sets the relationship between two factions (symmetric).
     * @param {string|Faction} factionA - First faction or its name.
     * @param {string|Faction} factionB - Second faction or its name.
     * @param {number} relationship - FactionRelationship value.
     */
    setRelationship(factionA, factionB, relationship) {
        const idA = typeof factionA === 'string' ? this.getFaction(factionA).id : factionA.id;
        const idB = typeof factionB === 'string' ? this.getFaction(factionB).id : factionB.id;
        this.relationships[idA][idB] = relationship;
        this.relationships[idB][idA] = relationship; // Symmetric
    }

    /**
     * Gets the relationship between two factions.
     * @param {Faction} factionA - First faction.
     * @param {Faction} factionB - Second faction.
     * @returns {number} FactionRelationship value.
     */
    getRelationship(factionA, factionB) {
        if (!(factionA instanceof Faction) || !(factionB instanceof Faction)) {
            return FactionRelationship.Neutral;
        }
        return this.relationships[factionA.id]?.[factionB.id] ?? FactionRelationship.Neutral;
    }

    /**
     * Gets a faction by name.
     * @param {string} name - The faction name.
     * @returns {Faction|null} The faction or null if not found.
     */
    getFaction(name) {
        return this.factions.get(name) || null;
    }
}