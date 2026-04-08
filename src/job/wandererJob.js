// /src/job/wandererJob.js

import { Job } from '/src/job/job.js';
import { Vector2D } from '/src/core/vector2d.js';
import { LandOnPlanetAutopilot } from '/src/autopilot/landOnPlanetAutopilot.js';
import { CelestialBody, JumpGate, Planet } from '/src/starSystem/celestialBody.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { Ship } from '/src/ship/ship.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { GameManager } from '/src/core/game.js';
import { StarSystem } from '/src/starSystem/starSystem.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { TraverseJumpGateAutopilot } from '/src/autopilot/traverseJumpGateAutopilot.js';

/**
 * Job for a ship to wander between planets, prioritizing different star systems.
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
        /** @type {CelestialBody|Asteroid|JumpGate|null} The current navigation target (jump gate or planet). */
        this.target = null;
        /** @type {CelestialBody|Asteroid|null} The final destination planet. */
        this.finalTarget = null;
        /** @type {(JumpGate|CelestialBody|Asteroid)[]} Array of jump gates and planets to reach finalTarget. */
        this.route = [];
        /** @type {number} Time (seconds) spent in Waiting state. */
        this.waitTime = 0.0;
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchVector = new Vector2D();
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            Starting: this.updateStarting.bind(this),
            Travelling: this.updateTravelling.bind(this),
            Waiting: this.updateWaiting.bind(this),
            'Failed': () => { }
        };

        if (new.target === WandererJob) Object.seal(this);
    }

    /**
     * Updates the job's behavior by delegating to the current state handler.
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
     * Handles the 'Starting' state, planning a route to a random planet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateStarting(deltaTime, gameManager) {
        this.debugLog(() => console.log(`${this.constructor.name}: Planning route, ship state: ${this.ship.state}`));

        this.target = null;
        this.finalTarget = null;
        this.route = [];

        if (!this.planRoute()) {
            this.debugLog(() => console.log(`${this.constructor.name}: Failed to plan route, retrying next frame`));
            this.error = 'No valid destination found';
            return;
        }

        this.debugLog(() => console.log(`${this.constructor.name}: Planned target ${this.target?.name}, transitioning to Travelling`));

        this.state = 'Travelling';
    }

    /**
     * Handles the 'Travelling' state, managing takeoff and navigation to the target.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     * @returns {void}
     */
    updateTravelling(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.target === this.finalTarget && this.route.length === 0.0) {
            this.debugLog(() => console.log(`${this.constructor.name}: Landed at final target ${this.target?.name}, transitioning to Waiting`));
            this.waitTime = 10 + Math.random() * 20.0;
            this.state = 'Waiting';
            return;
        }

        if (this.ship.state === 'Landed') {
            if (!this.target || !isValidTarget(this.ship, this.target)) {
                this.debugLog(() => console.log(`${this.constructor.name}: Invalid target while landed, transitioning to Starting`));
                this.error = 'Invalid target';
                this.state = 'Starting';
                return;
            }
            if (!this.ship.dockingContext) {
                throw new TypeError('dockingContext is missing on Landed ship');
            }
            this.waitTime -= deltaTime;
            if (this.waitTime <= 0.0) {
                this.debugLog(() => console.log(`${this.constructor.name}: Initiating takeoff toward ${this.target?.name}`));
                this.ship.setTarget(this.target);
                this.ship.dockingContext.takeOff();
                this.waitTime = 0.0;
            }
            return;
        }

        if (this.ship.state !== 'Flying') {
            this.debugLog(() => console.log(`${this.constructor.name}: Not flying (state: ${this.ship.state}), transitioning to Starting`));
            this.state = 'Starting';
            return;
        }

        if (!this.target || !isValidTarget(this.ship, this.target)) {
            this.target = this.selectNextValidTarget();
            if (!this.target) {
                this.debugLog(() => console.log(`${this.constructor.name}: No valid target or route, transitioning to Starting`));
                this.error = 'No valid target';
                this.state = 'Starting';
                return;
            }
            this.debugLog(() => console.log(`${this.constructor.name}: Selected new target ${this.target?.name}`));
        }

        if (!this.pilot.autopilot) {
            if (this.target instanceof JumpGate) {
                this.debugLog(() => console.log(`${this.constructor.name}: Setting TraverseJumpGateAutopilot for ${this.target?.name}`));
                this.pilot.setAutopilot(new TraverseJumpGateAutopilot(this.ship, this.target));
            } else if (this.target instanceof JumpGate) {
                this.debugLog(() => console.log(`${this.constructor.name}: Setting LandOnPlanetAutopilot for ${this.target?.name}`));
                this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, this.target));
            } else {
                //FIXME: need a better recovery method than this.
                this.resume();
                //this.debugLog(() => console.warn(`${this.constructor.name}: Autopilot missing, no valid target, restarting!`));
                console.warn(`${this.constructor.name}: Autopilot missing, no valid target, restarting!`)
                return;
            }
        }

        if (this.pilot.autopilot?.isComplete()) {
            this.debugLog(() => console.log(`${this.constructor.name}: Autopilot complete, clearing`));
            this.pilot.setAutopilot(null);
            this.target = null;
        }
    }

    /**
     * Handles the 'Waiting' state, delaying before re-planning.
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
            this.debugLog(() => console.log(`${this.constructor.name}: Finished Waiting, transitioning to Starting`));
            this.state = 'Starting';
            this.waitTime = 0.0;
        }
    }

    /**
     * Plans a route to a random planet, prioritizing different star systems (80% chance).
     * @returns {boolean} True if a valid route was planned, false otherwise.
     */
    planRoute() {
        const currentSystem = this.ship.starSystem;
        const excludePlanet = (this.ship.state === 'Landed' && this.ship.dockingContext?.landedObject instanceof Planet) ? this.ship.dockingContext.landedObject : null;

        this.debugLog(() => console.log(`${this.constructor.name}: Planning route, system: ${currentSystem.name}, exclude: ${excludePlanet?.name || 'none'}`));

        if (Math.random() < 0.2) {
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet);
            if (this.finalTarget) {
                this.target = this.finalTarget;
                this.route = [];
                this.debugLog(() => console.log(`${this.constructor.name}: Selected same-system target: ${this.finalTarget?.name}`));
                return true;
            }
        }

        return this.planCrossSystemRoute(currentSystem, excludePlanet);
    }

    /**
     * Plans a route to a planet in a different star system.
     * @param {StarSystem} currentSystem - The current star system.
     * @param {Planet|null} excludePlanet - Planet to exclude.
     * @returns {boolean} True if a valid route was planned, false otherwise.
     */
    planCrossSystemRoute(currentSystem, excludePlanet) {
        const jumpGate = currentSystem.getRandomJumpGate(this.ship);
        if (!jumpGate) {
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
            if (this.finalTarget) {
                this.target = this.finalTarget;
                this.route = [];
                this.debugLog(() => console.log(`${this.constructor.name}: No jump gate, selected fallback: ${this.finalTarget?.name}`));
                return true;
            }
            return false;
        }

        const destinationSystem = jumpGate.lane.target;
        this.finalTarget = destinationSystem.getRandomPlanet();
        if (!this.finalTarget) {
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
            if (this.finalTarget) {
                this.target = this.finalTarget;
                this.route = [];
                this.debugLog(() => console.log(`${this.constructor.name}: No planet in destination, selected fallback: ${this.finalTarget?.name}`));
                return true;
            }
            return false;
        }

        this.target = jumpGate;
        this.route = [jumpGate, this.finalTarget];
        this.debugLog(() => console.log(`${this.constructor.name}: Selected cross-system target: ${this.finalTarget?.name} via ${jumpGate.name}`));
        return true;
    }

    /**
     * Selects the next valid target from the route or finalTarget.
     * @returns {CelestialBody|Asteroid|JumpGate|null} The next valid target, or null if none.
     */
    selectNextValidTarget() {
        while (this.route.length > 0.0) {
            const nextTarget = this.route.shift() || null;
            if (isValidTarget(this.ship, nextTarget)) {
                return nextTarget;
            }
            this.debugLog(() => console.log(`${this.constructor.name}: Skipped invalid route target ${nextTarget?.name}`));
        }

        if (this.finalTarget && isValidTarget(this.ship, this.finalTarget)) {
            return this.finalTarget;
        }

        return null;
    }

    /**
     * Pauses the job, saving the current state.
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
     * Resumes the job, resetting to Starting.
     * @returns {void}
     */
    resume() {
        super.resume();
        this.state = 'Starting';
        this.target = null;
        this.finalTarget = null;
        this.route = [];
        this.waitTime = 0.0;
        this.debugLog(() => console.log(`${this.constructor.name}: Resumed, transitioning to Starting`));
    }
}
