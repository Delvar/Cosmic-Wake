// /src/job/wandererJob.js

import { Job } from '/src/job/job.js';
import { Vector2D } from '/src/core/vector2d.js';
import { LandOnPlanetAutopilot, TraverseJumpGateAutopilot } from '/src/autopilot/autopilot.js';
import { CelestialBody, JumpGate, Planet } from '/src/starSystem/celestialBody.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { Ship } from '/src/ship/ship.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { GameManager } from '/src/core/game.js';
import { StarSystem } from '/src/starSystem/starSystem.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';

/**
 * Job for a ship to wander between planets, prioritizing different star systems.
 * @extends Job
 */
export class WandererJob extends Job {
    /**
     * Creates a new WandererJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {AiPilot} [pilot=null] - The pilot controlling the ship (optional).
     */
    constructor(ship, pilot = null) {
        super(ship, pilot);
        /** @type {string} The current job state ('Starting', 'Planning', 'Traveling', 'Waiting'). */
        this.state = 'Starting';
        /** @type {CelestialBody|Asteroid|null} The current navigation target (jump gate or planet). */
        this.target = null;
        /** @type {CelestialBody|Asteroid|null} The final destination planet. */
        this.finalTarget = null;
        /** @type {JumpGate[]} Array of jump gates to reach finalTarget. */
        this.route = [];
        /** @type {number} Time (seconds) spent in Waiting state. */
        this.waitTime = 0;
        /** @type {number} Random delay (seconds, 10-30s) for Waiting state. */
        this.waitDuration = 0;
        /** @type {Vector2D} Temporary vector for distance calculations. */
        this._scratchVector = new Vector2D();
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'Planning': this.updatePlanning.bind(this),
            'Traveling': this.updateTraveling.bind(this),
            'Waiting': this.updateWaiting.bind(this)
        };
    }

    /**
     * Updates the job's behavior by delegating to the current state handler.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else if (this.ship.debug) {
            console.log(`WandererJob: Invalid state ${this.state}`);
        }
    }

    /**
     * Handles the 'Starting' state, initiating takeoff if landed.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateStarting(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (this.waitDuration === 0) { // No delay for initial start
                if (this.ship.debug) {
                    console.log('WandererJob: Initial start, initiating takeoff');
                }
                this.ship.initiateTakeoff();
            } else if (this.waitTime >= this.waitDuration) { // Delayed takeoff
                if (this.ship.debug) {
                    console.log(`WandererJob: Waited ${this.waitTime.toFixed(1)}s, initiating takeoff`);
                }
                this.ship.initiateTakeoff();
                this.waitTime = 0;
                this.waitDuration = 0;
            }
        } else if (this.ship.state === 'Flying') {
            if (this.ship.debug) {
                console.log('WandererJob: Ship flying, transitioning to Planning');
            }
            this.state = 'Planning';
        }
    }

    /**
     * Handles the 'Planning' state, planning a route if flying.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updatePlanning(deltaTime, gameManager) {
        if (this.ship.state === 'Landed') {
            if (this.ship.debug) {
                console.log('WandererJob: Planning while landed, transitioning to Starting');
            }
            this.state = 'Starting';
            return;
        }
        if (this.ship.state === 'Flying') {
            if (this.ship.debug) {
                console.log('WandererJob: Planning route');
            }
            this.planRoute();
            this.state = 'Traveling';
        }
    }

    /**
     * Handles the 'Traveling' state, navigating to the target.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateTraveling(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.target === this.finalTarget && this.route.length === 0) {
            if (this.ship.debug) {
                console.log('WandererJob: Landed at final target, transitioning to Waiting');
            }
            this.waitTime = 0;
            this.waitDuration = 10 + Math.random() * 20; // 10-30s
            this.state = 'Waiting';
            return;
        }

        if (this.ship.state === 'Flying') {
            // Handle post-jump or invalid target
            if (!this.target || !isValidTarget(this.ship, this.target)) {
                if (this.ship.debug) {
                    console.log('WandererJob: Invalid or no target, checking route');
                }
                // Iterate route for next valid target
                this.target = null;
                while (this.route.length > 0) {
                    const selectedTarget = this.route.shift();
                    if (isValidTarget(this.ship, selectedTarget)) {
                        if (this.ship.debug) {
                            console.log(`WandererJob: Selected valid target ${selectedTarget.name}`);
                        }
                        this.target = selectedTarget;
                        break;
                    }
                    if (this.ship.debug) {
                        console.log(`WandererJob: Skipped invalid route target ${selectedTarget.name}`);
                    }
                }

                // If route empty, try finalTarget
                if (!this.target && this.finalTarget && isValidTarget(this.ship, this.finalTarget)) {
                    this.target = this.finalTarget;
                    if (this.ship.debug) {
                        console.log(`WandererJob: Selected valid finalTarget ${this.target.name}`);
                    }
                }
                // No valid target, re-plan
                if (!this.target) {
                    if (this.ship.debug) {
                        console.log('WandererJob: No valid target/route, transitioning to Planning');
                    }
                    this.state = 'Planning';
                    this.target = null;
                    this.finalTarget = null;
                    this.route = [];
                    return;
                }
            }

            if (!this.pilot.autopilot) {
                if (this.target instanceof JumpGate) {
                    if (this.ship.debug) {
                        console.log(`WandererJob: Setting autopilot to jump gate ${this.target.name}`);
                    }
                    this.pilot.setAutopilot(new TraverseJumpGateAutopilot(this.ship, this.target));
                } else {
                    if (this.ship.debug) {
                        console.log(`WandererJob: Setting autopilot to land on ${this.target.name}`);
                    }
                    this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, this.target));
                }
            }
        }
        if (this.pilot.autopilot && this.pilot.autopilot.isComplete()) {
            if (this.ship.debug) {
                console.log('WandererJob: Autopilot complete, clearing');
            }
            this.pilot.setAutopilot(null);
        }
    }

    /**
     * Handles the 'Waiting' state, delaying before re-planning.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateWaiting(deltaTime, gameManager) {
        if (this.ship.state !== 'Landed') {
            if (this.ship.debug) {
                console.log('WandererJob: Waiting but not landed, transitioning to Planning');
            }
            this.state = 'Planning';
            this.waitTime = 0;
            this.waitDuration = 0;
            return;
        }
        this.waitTime += deltaTime;
        if (this.waitTime >= this.waitDuration) {
            if (this.ship.debug) {
                console.log(`WandererJob: Waited ${this.waitTime.toFixed(1)}s, transitioning to Starting`);
            }
            this.state = 'Starting';
            this.waitTime = 0;
            this.waitDuration = 0;
        }
    }

    /**
     * Plans a route to a random planet, prioritizing different star systems (80% chance).
     */
    planRoute() {
        const currentSystem = this.ship.starSystem;
        const excludePlanet = this.ship.state === 'Landed' ? this.ship.landedObject : null;
        if (this.ship.debug) {
            console.log(`WandererJob: Planning route, current system: ${currentSystem.name}, exclude: ${excludePlanet?.name || 'none'}`);
        }

        if (Math.random() < 0.2) {
            // 20% chance: Same system, exclude current planet
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet);
            if (this.finalTarget) {
                this.target = this.finalTarget;
                this.route = [];
                if (this.ship.debug) {
                    console.log(`WandererJob: Selected same-system target: ${this.finalTarget.name}`);
                }
            } else {
                // Fallback to cross-system
                this.planCrossSystemRoute(currentSystem, excludePlanet);
            }
        } else {
            // 80% chance: Different system
            this.planCrossSystemRoute(currentSystem, excludePlanet);
        }
    }

    /**
     * Plans a route to a planet in a different star system.
     * @param {StarSystem} currentSystem - The current star system.
     * @param {CelestialBody|Asteroid|null} excludePlanet - The CelestialBody or Asteroid to exclude (if landed).
     */
    planCrossSystemRoute(currentSystem, excludePlanet) {
        const jumpGate = currentSystem.getRandomJumpGate(this.ship);
        if (!jumpGate) {
            // Fallback to same system
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
            this.target = this.finalTarget;
            this.route = [];
            if (this.ship.debug) {
                console.log(`WandererJob: No jump gate, selected fallback: ${this.finalTarget.name}`);
            }
            return;
        }

        // Use jumpGate.lane.target for destination system
        const destinationSystem = jumpGate.lane.target;
        this.finalTarget = destinationSystem.getRandomPlanet(this.ship);
        if (!this.finalTarget) {
            // Fallback to same system
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
            this.target = this.finalTarget;
            this.route = [];
            if (this.ship.debug) {
                console.log(`WandererJob: No planet in destination, selected fallback: ${this.finalTarget.name}`);
            }
        } else {
            this.target = jumpGate;
            this.route = [jumpGate];
            if (this.ship.debug) {
                console.log(`WandererJob: Selected cross-system target: ${this.finalTarget.name} via ${jumpGate.name}`);
            }
        }
    }

    /**
     * Pauses the job, saving the current state.
     */
    pause() {
        super.pause();
        if (this.ship.debug) {
            console.log(`WandererJob: Paused in state ${this.state}`);
        }
    }

    /**
     * Resumes the job, setting appropriate state based on ship status.
     */
    resume() {
        super.resume();
        if (this.ship.state === 'Landed') {
            if (this.ship.debug) {
                console.log('WandererJob: Resuming, ship landed, setting Waiting');
            }
            this.state = 'Waiting';
            this.target = null;
            this.finalTarget = null;
            this.route = [];
            this.waitTime = 0;
            this.waitDuration = 10 + Math.random() * 20; // 10-30s
        } else {
            if (this.ship.debug) {
                console.log(`WandererJob: Resuming, ship ${this.ship.state}, setting Planning`);
            }
            this.state = 'Planning';
            this.target = null;
            this.finalTarget = null;
            this.route = [];
        }
    }

    /**
     * Returns the job's status for HUD display.
     * @returns {string} A descriptive status message.
     */
    getStatus() {
        if (this.ship.debug && (!this.target || !isValidTarget(this.ship, this.target))) {
            return `Invalid route, re-planning`;
        }
        if (this.ship.debug && this.state === 'Waiting') {
            return `Waiting (${(this.waitDuration - this.waitTime).toFixed(1)}s)`;
        }
        if (this.state === 'Paused') return 'Paused';
        if (this.state === 'Completed') return 'Landed';
        if (this.finalTarget) return `Traveling to ${this.finalTarget.name}`;
        return 'Planning route';
    }
}