// /src/job/wandererJob.js

import { Job } from '/src/job/job.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/landOnPlanetAutopilot.js';
import { JumpGate, Planet } from '/src/starSystem/celestialBody.js';
import { Ship } from '/src/ship/ship.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { GameManager } from '/src/core/game.js';
import { TraverseJumpGateAutopilot } from '/src/autopilot/traverseJumpGateAutopilot.js';
import { isValidTarget } from '/src/core/gameObject.js';

/**
 * Job for a ship to wander between planets and star systems using simple last-visited tracking to avoid immediate looping.
 * Uses explicit Planning state for resume/continuation (re-uses valid destination when possible).
 * Starting is the canonical entry point for brand-new ships only.
 * States: Starting → Planning → Travelling → (Waiting only after planet landing).
 * @extends Job
 */
export class WandererJob extends Job {
    /**
     * Creates a new WandererJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {AiPilot} pilot - The pilot controlling the ship (optional).
     */
    constructor(ship, pilot) {
        super(ship, pilot);
        /** @type {string} The current job state ('Starting', 'Planning', 'Travelling', 'Waiting'). */
        this.state = 'Starting';
        /** @type {Planet|JumpGate|null} The destination picked to travel to, sued when resuming. */
        this.destination = null;
        /** @type {Planet|JumpGate|null} The last visited body or gate to prevent immediate looping. */
        this.lastVisited = null;
        /** @type {number} Time (seconds) spent in Waiting state. */
        this.waitTime = 0.0;
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            Starting: this.updateStarting.bind(this),
            Planning: this.updatePlanning.bind(this),
            Travelling: this.updateTravelling.bind(this),
            Waiting: this.updateWaiting.bind(this)
        };

        if (new.target === WandererJob) Object.seal(this);
    }

    /**
     * Updates the job's behaviour by delegating to the current state handler.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    update(deltaTime, gameManager) {
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: Invalid state ${this.state}`));
            this.error = `Invalid state: ${this.state}`;
            this.state = 'Starting';
        }
    }

    /**
     * Sets the initial lastVisited based on ship state (landed planet or closest planet or jump gate).
     * @returns {void}
     */
    setInitialLastVisited() {
        this.debugLog(() => console.log(`${this.constructor.name}: Setting initial lastVisited, ship state: ${this.ship.state}`));
        if (this.ship.state === 'Landed' && this.ship.dockingContext?.landedObject instanceof Planet) {
            this.lastVisited = this.ship.dockingContext.landedObject;
        } else {
            this.lastVisited = this.ship.starSystem.getClosestJumpGatePlanet(this.ship, null);
        }
    }

    /**
     * Picks a random valid planet or jump gate in the current system, excluding lastVisited.
     * @returns {Planet|JumpGate|null} The selected destination or null if none available.
     */
    pickDestination() {
        const currentSystem = this.ship.starSystem;
        const excludePlanet = this.lastVisited instanceof Planet ? this.lastVisited : null;
        const excludejumpGate = this.lastVisited instanceof JumpGate ? this.lastVisited : null;

        this.debugLog(() => console.log(`${this.constructor.name}: Picking destination excluding ${this.lastVisited?.name || 'none'}`));

        // simple 50/50 random choice between planet and gate
        if (Math.random() < 0.5) {
            const planet = currentSystem.getRandomPlanet(this.ship, excludePlanet);
            if (planet) {
                return planet;
            }
        } else {
            const jumpGate = currentSystem.getRandomJumpGate(this.ship, excludejumpGate);
            if (jumpGate) {
                return jumpGate;
            }
        }

        // fallback
        return currentSystem.getRandomPlanet(this.ship) || null;
    }

    /**
     * Handles the 'Starting' state.
     * Resets lastVisited based on current ship position and immediately transitions to Planning.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateStarting(deltaTime, gameManager) {
        this.setInitialLastVisited();
        this.destination = null;
        this.waitTime = 0.0;
        this.debugLog(() => console.log(`${this.constructor.name}: Starting - reset complete, transitioning to Planning`));
        this.state = 'Planning';
    }

    /**
     * Handles the 'Planning' state: picks next destination (excluding lastVisited) and launches the correct autopilot.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updatePlanning(deltaTime, gameManager) {
        if (!this.lastVisited || !isValidTarget(this.ship, this.lastVisited)) {
            this.debugLog(() => console.log(`${this.constructor.name}: updatePlanning lastVisited invalid ${this.lastVisited?.name}`));
            this.setInitialLastVisited();
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: updatePlanning lastVisited valid ${this.lastVisited?.name}`));
        }

        if (!this.destination || this.destination === this.lastVisited || !isValidTarget(this.ship, this.destination)) {
            this.debugLog(() => console.log(`${this.constructor.name}: updatePlanning destination invalid ${this.destination?.name}`));
            this.destination = null;
        } else {
            this.debugLog(() => console.log(`${this.constructor.name}: updatePlanning destination valid ${this.destination?.name}`));
        }

        if (!this.destination) {
            this.destination = this.pickDestination();
            if (!this.destination) {
                console.error(`${this.constructor.name}: updatePlanning: No valid destination found`);
                this.state = 'Error';
                this.error = 'No valid destination found';
                return;
            }
        }

        this.debugLog(() => console.log(`${this.constructor.name}: updatePlanning: selected ${this.destination?.name}`));
        if (this.destination instanceof JumpGate) {
            this.pilot.setAutopilot(new TraverseJumpGateAutopilot(this.ship, this.destination));
            this.debugLog(() => console.log(`${this.constructor.name}: updatePlanning: setAutopilot TraverseJumpGateAutopilot ${this.destination?.name}`));
        } else {
            this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, this.destination));
            this.debugLog(() => console.log(`${this.constructor.name}: updatePlanning: setAutopilot LandOnPlanetAutopilot ${this.destination?.name}`));
        }
        this.debugLog(() => console.log(`${this.constructor.name}: Transitioning to Travelling`));
        this.state = 'Travelling';
    }

    /**
     * Handles the 'Travelling' state: waits for arrival (planet via ship.state or gate via autopilot complete).
     * lastVisited is now set exactly once on arrival; no more fallback cycles after takeoff.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateTravelling(deltaTime, gameManager) {
        if (!this.pilot.autopilot || !(this.pilot.autopilot instanceof TraverseJumpGateAutopilot || this.pilot.autopilot instanceof LandOnPlanetAutopilot)) {
            this.debugLog(() => console.log(`${this.constructor.name}: Not a valid autopilot (state: ${this.pilot.autopilot?.constructor.name}), transitioning to Planning`));
            this.state = 'Planning';
            return;
        }
        if (this.pilot.autopilot.isComplete()) {
            if (this.pilot.autopilot instanceof TraverseJumpGateAutopilot) {
                this.debugLog(() => console.log(`${this.constructor.name}: Jump complete, setting lastVisited to arrival jump gate`));
                if (this.pilot.autopilot.target?.lane.targetGate) {
                    this.lastVisited = this.pilot.autopilot.target?.lane.targetGate;
                }
                this.state = 'Planning';
                this.debugLog(() => console.log(`${this.constructor.name}: Jump complete, transitioning to Planning`));
            } else if (this.pilot.autopilot instanceof LandOnPlanetAutopilot) {
                if (this.ship.dockingContext?.landedObject instanceof Planet) {
                    this.lastVisited = this.ship.dockingContext?.landedObject;
                }
                this.waitTime = 5.0 + Math.random() * 5.0;
                this.state = 'Waiting';
                this.debugLog(() => console.log(`${this.constructor.name}: Landing complete, transitioning to Waiting`));
            } else {
                this.state = 'Planning';
                this.debugLog(() => console.log(`${this.constructor.name}: Autopilot complete but unhandled type, transitioning to Planning`));

            }
            this.pilot.setAutopilot(null);
            this.destination = null;
        }
    }

    /**
     * Handles the 'Waiting' state: waits, then takes off and returns to Planning.
     * lastVisited is now set on arrival (in Travelling), not here.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateWaiting(deltaTime, gameManager) {
        if (this.ship.state !== 'Landed') {
            this.debugLog(() => console.log(`${this.constructor.name}: Waiting but not landed (state: ${this.ship.state}), transitioning to Planning`));
            this.state = 'Planning';
            this.waitTime = 0.0;
            return;
        }

        this.waitTime -= deltaTime;
        if (this.waitTime <= 0.0) {
            this.debugLog(() => console.log(`${this.constructor.name}: Finished Waiting, transitioning to Planning`));
            this.waitTime = 0.0;

            if (!this.ship.dockingContext) {
                throw new TypeError('dockingContext is missing on Landed ship');
            }
            this.state = 'Planning';
        }
    }

    /**
     * Pauses the job, clearing autopilot.
     * @returns {void}
     */
    pause() {
        super.pause();
        if (this.pilot.autopilot) {
            this.pilot.setAutopilot(null);
        }
        this.debugLog(() => console.log(`${this.constructor.name}: Paused in state ${this.state}`));
    }

    /**
     * Resumes the job, resetting to Starting state and clearing lastVisited.
     * @returns {void}
     */
    resume() {
        super.resume();
        this.state = 'Planning';
        this.debugLog(() => console.log(`${this.constructor.name}: Resumed - transitioning to Planning`));
    }
}
