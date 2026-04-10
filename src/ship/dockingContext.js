// /src/ship/dockingContext.js

import { Ship } from "/src/ship/ship.js";
import { Asteroid } from "/src/starSystem/asteroidBelt.js";
import { CelestialBody } from "/src/starSystem/celestialBody.js";
import { PlayerPilot } from "/src/pilot/pilot.js";
import { AiPilot } from "/src/pilot/aiPilot.js";
import { OfficerAiPilot } from "/src/pilot/officerAiPilot.js";
import { CivilianAiPilot } from "/src/pilot/civilianAiPilot.js";
import { EscortJob } from "/src/job/escortJob.js";
import { LandOnPlanetDespawnAutopilot } from "/src/autopilot/landOnPlanetDespawnAutopilot.js";

/**
 * DockingContext represents the in-game context for a landed or docked ship.
 * It is created when a ship touches down on a celestial body, asteroid, or docks with another ship.
 * This class centralises the available actions and permission checks for the docking UI and AI.
 *
 * Available actions: take off, repair hull (on planet), start mining/stop mining (on asteroids),
 * capture (on disabled ships), undock (on disabled ships).
 */
export class DockingContext {
    /**
     * Creates a new docking context.
     *
     * @param {CelestialBody|Asteroid|Ship} landedObject - The object that the ship is landed on or docked with.
     * @param {Ship} ship - The ship that is currently in docking state.
     */
    constructor(landedObject, ship) {
        /** @type {CelestialBody|Asteroid|Ship} */
        this.landedObject = landedObject;

        /** @type {Ship} */
        this.ship = ship;

        /** @type {boolean} Whether the ship is allowed to take off. */
        this.hasTakeOffAction = !(this.landedObject instanceof Ship);

        /** @type {boolean} Whether undock action is available (only when boarding disabled ships). */
        this.hasUndockAction = this.landedObject instanceof Ship;

        /** @type {boolean} Whether hull repair is available, only on celestial bodies. */
        this.hasRepairAction = this.landedObject instanceof CelestialBody;

        /** @type {boolean} Whether the ship can start mining (only on asteroids). */
        this.hasMiningAction = this.landedObject instanceof Asteroid;

        /** @type {boolean} Whether capture action is available (only when boarding disabled ships). */
        this.hasCaptureAction = this.landedObject instanceof Ship;

    }

    /**
     * Debug log helper that delegates to the ship's debug logger.
     * The callback is only evaluated when ship debug logging is enabled.
     *
     * @param {() => void} callback - A function to execute only when debug logging is active.
     * @return {void}
     */
    debugLog(callback) {
        if (this.ship) {
            this.ship.debugLog(callback);
        }
    }

    /**
     * Initiates take off from the current platform and transitions the ship out of docked state.
     * Validates current state and capability, logs errors for invalid calls.
     *
     * @return {boolean} True when take off was successfully requested, false otherwise.
     */
    takeOff() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasTakeOffAction && !this.hasUndockAction) {
            console.error(`${this.constructor.name}: takeOff Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: takeOff`));

        this.ship.initiateTakeoff();
        return true;
    }

    /**
     * Repairs the ship's hull to maximum when landed on a repair-capable celestial body.
     * Updates context capability to prevent repeated repair in the same docking session.
     *
     * @return {boolean} True if repair was performed, false if invalid.
     */
    repairHull() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasRepairAction) {
            console.error(`${this.constructor.name}: repairHull Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: repairHull`));
        this.ship.hullIntegrity = this.ship.maxHull;
        //this.hasRepairCapability = false;
        return true;
    }

    /**
     * Starts mining operations when docked on an asteroid.
     * Ensures the ship is not already mining before toggling.
     *
     * @return {boolean} True if mining start was successful, false otherwise.
     */
    startMining() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasMiningAction) {
            console.error(`${this.constructor.name}: startMining Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: startMining`));
        if (!this.ship.miningEnabled) {
            this.ship.startMining();
        }
        return true;
    }

    /**
     * Stops mining operations when docked on an asteroid.
     * Safely handles already-stopped mining state.
     *
     * @return {boolean} True if mining stop was successful, false otherwise.
     */
    stopMining() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasMiningAction) {
            console.error(`${this.constructor.name}: stopMining Not Valid`);
            return false;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: stopMining`));
        if (this.ship.miningEnabled) {
            this.ship.stopMining();
        }
        return true;
    }

    /**
     * Captures a disabled ship when boarding, transferring ownership and repairing it.
     * Only available when boarding disabled ships.
     *
     * @return {boolean} True if capture was performed, false if invalid.
     */
    capture() {
        if (!this.ship || !this.landedObject) {
            return false;
        }
        if (!this.hasCaptureAction) {
            console.error(`${this.constructor.name}: capture Not Valid`);
            return false;
        }
        if (!(this.landedObject instanceof Ship)) {
            console.error(`${this.constructor.name}: not a Ship`);
            return false;
        }

        this.debugLog(() => console.log(`${this.constructor.name}: capture`));

        /** @type {Ship} */
        const boardedShip = this.landedObject;
        // Transfer ownership
        boardedShip.faction = this.ship.faction;
        // Repair the ship
        boardedShip.hullIntegrity = boardedShip.disabledThreshold + 1.0;
        // Activate shield
        boardedShip.shield.isActive = true;
        // Set to flying state
        boardedShip.setState('Flying');
        // Clear hostiles
        boardedShip.hostiles.length = 0;
        boardedShip.lastAttacker = null;

        // Assign new pilot based on captor's pilot type
        if (this.ship.pilot instanceof PlayerPilot) {
            const pilot = new OfficerAiPilot(boardedShip);
            pilot.setJob(new EscortJob(boardedShip, pilot, this.ship));
            boardedShip.setPilot(pilot);
        } else if (this.ship.pilot instanceof AiPilot) {
            boardedShip.pilot = new CivilianAiPilot(boardedShip);
            const pilot = new CivilianAiPilot(boardedShip);
            pilot.changeState('Despawning', new LandOnPlanetDespawnAutopilot(boardedShip));
            boardedShip.setPilot(pilot);
        }

        // Take off from the captured ship
        this.takeOff();
        return true;
    }

    /**
     * Undocks from a boarded disabled ship without capturing it.
     * Only available when boarding disabled ships.
     *
     * @return {boolean} True if undock was performed, false if invalid.
     */
    undock() {
        // Undock is just take off with different naming
        return this.takeOff();
    }

    /**
     * Dispose of this context when docking interactions are complete.
     * Clears references to help garbage collection and avoid accidental reuse.
     *
     * @return {void}
     */
    dispose() {
        this.hasTakeOffAction = false;
        this.hasUndockAction = false;
        this.hasRepairAction = false;
        this.hasMiningAction = false;
        this.hasCaptureAction = false;
    }
}
