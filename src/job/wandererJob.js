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
 * Replaces complex route/finalTarget/target planning with random selection of a planet or jump gate in the current system (excluding lastVisited).
 * Retains Starting/Travelling/Waiting states with the exact flow specified in the plan.
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
        /** @type {string} The current job state ('Starting', 'Travelling', 'Waiting'). */
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
     * Sets the initial lastVisited based on ship state (landed planet or closest planet).
     * @returns {void}
     */
    setInitialLastVisited() {
        this.debugLog(() => console.log(`${this.constructor.name}: Setting initial lastVisited, ship state: ${this.ship.state}`));
        if (this.ship.state === 'Landed' && this.ship.dockingContext?.landedObject instanceof Planet) {
            this.lastVisited = this.ship.dockingContext.landedObject;
        } else {
            this.lastVisited = this.ship.starSystem.getClosestPlanet(this.ship, null);
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
            let jumpGate = currentSystem.getRandomJumpGate(this.ship, excludejumpGate);
            if (jumpGate) {
                return jumpGate;
            }
        }

        // fallback
        return currentSystem.getRandomPlanet(this.ship) || null;
    }

    /**
     * Handles the 'Starting' state: sets lastVisited then switches to Travelling.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateStarting(deltaTime, gameManager) {
        this.setInitialLastVisited();
        const destination = this.pickDestination();
        if (!destination) {
            console.error(`${this.constructor.name}: updateStarting: No valid destination found`);
            this.state = 'Error';
            this.error = 'No valid destination found';
            return;
        }
        this.debugLog(() => console.log(`${this.constructor.name}: updateStarting: Setting autopilot to ${destination.name}`));
        if (destination instanceof JumpGate) {
            this.pilot.setAutopilot(new TraverseJumpGateAutopilot(this.ship, destination));
            this.debugLog(() => console.log(`${this.constructor.name}: updateStarting: updateTravelling : setAutopilot TraverseJumpGateAutopilot ${destination.name}`));
        } else {
            this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, destination));
            this.debugLog(() => console.log(`${this.constructor.name}: updateStarting: updateTravelling : setAutopilot LandOnPlanetAutopilot ${destination.name}`));
        }
        this.destination = destination;
        this.debugLog(() => console.log(`${this.constructor.name}: updateStarting: Transitioning to Travelling`));
        this.state = 'Travelling';
    }

    /**
     * Handles the 'Travelling' state: manages autopilot completion (updates lastVisited if jumped) and picks/sets new autopilot if none.
     * Switches to Waiting if landed on a planet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateTravelling(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            this.debugLog(() => console.log(`${this.constructor.name}: Landed at planet, transitioning to Waiting`));
            this.waitTime = 5.0 + Math.random() * 5.0;
            this.state = 'Waiting';
            return;
        }

        if (this.ship.state !== 'Flying') {
            this.debugLog(() => console.log(`${this.constructor.name}: Not flying (state: ${this.ship.state}), transitioning to Starting`));
            this.state = 'Starting';
            return;
        }

        if (!this.pilot.autopilot || !(this.pilot.autopilot instanceof TraverseJumpGateAutopilot || this.pilot.autopilot instanceof LandOnPlanetAutopilot)) {
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Not a valid autopilot (state: ${this.pilot.autopilot?.constructor.name}), transitioning to Starting`));
            return;
        }

        if (this.pilot.autopilot.isComplete()) {
            if (this.pilot.autopilot instanceof TraverseJumpGateAutopilot) {
                this.debugLog(() => console.log(`${this.constructor.name}: Jump complete, setting lastVisited to arrival jump gate`));
                if (this.pilot.autopilot.target?.lane.targetGate) {
                    this.lastVisited = this.pilot.autopilot.target?.lane.targetGate;
                }
                const destination = this.pickDestination();
                if (!destination) {
                    console.error(`${this.constructor.name}: updateTravelling: No valid destination found`);
                    this.state = 'Error';
                    this.error = 'No valid destination found';
                    return;
                }
                this.debugLog(() => console.log(`${this.constructor.name}: updateTravelling: Setting autopilot to ${destination.name}`));
                if (destination instanceof JumpGate) {
                    this.pilot.setAutopilot(new TraverseJumpGateAutopilot(this.ship, destination));
                    this.debugLog(() => console.log(`${this.constructor.name}: updateTravelling: updateTravelling : setAutopilot TraverseJumpGateAutopilot ${destination.name}`));
                } else {
                    this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, destination));
                    this.debugLog(() => console.log(`${this.constructor.name}: updateTravelling: updateTravelling : setAutopilot LandOnPlanetAutopilot ${destination.name}`));
                }
                this.destination = destination;
            }
        }

        if (this.destination == null || !(this.destination instanceof JumpGate || this.destination instanceof Planet) || !isValidTarget(this.ship, this.destination)) {
            this.state = 'Starting';
            this.debugLog(() => console.log(`${this.constructor.name}: Not a valid destination (state: ${this.destination?.constructor.name}), transitioning to Starting`));
            return;
        }
    }

    /**
     * Handles the 'Waiting' state: waits, then sets lastVisited to current planet, takes off, and switches to Travelling.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateWaiting(deltaTime, gameManager) {
        if (this.ship.state !== 'Landed') {
            this.debugLog(() => console.log(`${this.constructor.name}: Waiting but not landed (state: ${this.ship.state}), transitioning to Starting`));
            this.state = 'Starting';
            this.waitTime = 0.0;
            return;
        }

        this.waitTime -= deltaTime;
        if (this.waitTime <= 0.0) {
            this.debugLog(() => console.log(`${this.constructor.name}: Finished Waiting, setting lastVisited to current planet and taking off`));
            if (this.ship.dockingContext?.landedObject instanceof Planet) {
                this.lastVisited = this.ship.dockingContext.landedObject;
            } else {
                this.lastVisited = this.ship.starSystem.getClosestPlanet(this.ship, null);
            }
            this.waitTime = 0.0;

            if (!this.ship.dockingContext) {
                throw new TypeError('dockingContext is missing on Landed ship');
            }
            this.ship.dockingContext.takeOff();
            this.state = 'Travelling';
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
        // const destination = this.destination;
        // if (!(destination instanceof JumpGate || destination instanceof Planet) || !isValidTarget(this.ship, destination)) {
        //     this.state = 'Starting';
        //     this.lastVisited = null;
        //     this.waitTime = 0.0;
        //     this.debugLog(() => console.log(`${this.constructor.name}: resume : (!(destination instanceof JumpGate || destination instanceof Planet) || !isValidTarget(this.ship, destination))`));
        // } else {
        //     if (destination instanceof JumpGate) {
        //         this.pilot.setAutopilot(new TraverseJumpGateAutopilot(this.ship, destination));
        //         this.debugLog(() => console.log(`${this.constructor.name}: resume : setAutopilot TraverseJumpGateAutopilot ${destination.name}`));
        //     } else if (destination instanceof Planet) {
        //         this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, destination));
        //         this.debugLog(() => console.log(`${this.constructor.name}: resume : setAutopilot LandOnPlanetAutopilot ${destination.name}`));
        //     }
        // }
        this.debugLog(() => console.log(`${this.constructor.name}: Resumed, transitioning to ${this.state}`));
    }
}
