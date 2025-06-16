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
        /** @type {string} The current job state ('Starting', 'Traveling', 'Waiting'). */
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
            Traveling: this.updateTraveling.bind(this),
            Waiting: this.updateWaiting.bind(this),
            'Failed': () => { }
        };

        if (new.target === WandererJob) Object.seal(this);
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
            console.warn(`WandererJob: Invalid state ${this.state}`);
            this.error = `Invalid state: ${this.state}`;
            this.state = 'Starting';
        }
    }

    /**
     * Handles the 'Starting' state, planning a route to a random planet.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateStarting(deltaTime, gameManager) {
        if (this.ship.debug) {
            console.log(`WandererJob: Planning route, ship state: ${this.ship.state}`);
        }

        this.target = null;
        this.finalTarget = null;
        this.route = [];

        if (!this.planRoute()) {
            if (this.ship.debug) {
                console.warn('WandererJob: Failed to plan route, retrying next frame');
            }
            this.error = 'No valid destination found';
            return;
        }

        if (this.ship.debug) {
            console.log(`WandererJob: Planned target ${this.target?.name}, transitioning to Traveling`);
        }
        this.state = 'Traveling';
    }

    /**
     * Handles the 'Traveling' state, managing takeoff and navigation to the target.
     * @param {number} deltaTime - Time elapsed since last update (seconds).
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateTraveling(deltaTime, gameManager) {
        if (this.ship.state === 'Landed' && this.target === this.finalTarget && this.route.length === 0.0) {
            if (this.ship.debug) {
                console.log(`WandererJob: Landed at final target ${this.target?.name}, transitioning to Waiting`);
            }
            this.waitTime = 10 + Math.random() * 20.0;
            this.state = 'Waiting';
            return;
        }

        if (this.ship.state === 'Landed') {
            if (!this.target || !isValidTarget(this.ship, this.target)) {
                if (this.ship.debug) {
                    console.warn('WandererJob: Invalid target while landed, transitioning to Starting');
                }
                this.error = 'Invalid target';
                this.state = 'Starting';
                return;
            }
            this.waitTime -= deltaTime;
            if (this.waitTime <= 0.0) {
                if (this.ship.debug) {
                    console.log(`WandererJob: Initiating takeoff toward ${this.target.name}`);
                }
                this.ship.setTarget(this.target);
                this.ship.initiateTakeoff();
                this.waitTime = 0.0;
            }
            return;
        }

        if (this.ship.state !== 'Flying') {
            if (this.ship.debug) {
                console.log(`WandererJob: Not flying (state: ${this.ship.state}), transitioning to Starting`);
            }
            this.state = 'Starting';
            return;
        }

        if (!this.target || !isValidTarget(this.ship, this.target)) {
            this.target = this.selectNextValidTarget();
            if (!this.target) {
                if (this.ship.debug) {
                    console.warn('WandererJob: No valid target or route, transitioning to Starting');
                }
                this.error = 'No valid target';
                this.state = 'Starting';
                return;
            }
            if (this.ship.debug) {
                console.log(`WandererJob: Selected new target ${this.target.name}`);
            }
        }

        if (!this.pilot.autopilot) {
            const AutopilotClass = this.target instanceof JumpGate ? TraverseJumpGateAutopilot : LandOnPlanetAutopilot;
            if (this.ship.debug) {
                console.log(`WandererJob: Setting ${AutopilotClass.name} for ${this.target.name}`);
            }
            this.pilot.setAutopilot(new AutopilotClass(this.ship, this.target));
        }

        if (this.pilot.autopilot?.isComplete()) {
            if (this.ship.debug) {
                console.log('WandererJob: Autopilot complete, clearing');
            }
            this.pilot.setAutopilot(null);
            this.target = null;
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
                console.log(`WandererJob: Waiting but not landed (state: ${this.ship.state}), transitioning to Starting`);
            }
            this.state = 'Starting';
            this.waitTime = 0.0;
            return;
        }

        this.waitTime -= deltaTime;
        if (this.waitTime <= 0.0) {
            if (this.ship.debug) {
                console.log(`WandererJob: Finished Waiting, transitioning to Starting`);
            }
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
        const excludePlanet = this.ship.state === 'Landed' ? this.ship.landedObject : null;
        if (this.ship.debug) {
            console.log(`WandererJob: Planning route, system: ${currentSystem.name}, exclude: ${excludePlanet?.name || 'none'}`);
        }

        if (Math.random() < 0.2) {
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet);
            if (this.finalTarget) {
                this.target = this.finalTarget;
                this.route = [];
                if (this.ship.debug) {
                    console.log(`WandererJob: Selected same-system target: ${this.finalTarget.name}`);
                }
                return true;
            }
        }

        return this.planCrossSystemRoute(currentSystem, excludePlanet);
    }

    /**
     * Plans a route to a planet in a different star system.
     * @param {StarSystem} currentSystem - The current star system.
     * @param {CelestialBody|Asteroid|null} excludePlanet - Planet to exclude.
     * @returns {boolean} True if a valid route was planned, false otherwise.
     */
    planCrossSystemRoute(currentSystem, excludePlanet) {
        const jumpGate = currentSystem.getRandomJumpGate(this.ship);
        if (!jumpGate) {
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
            if (this.finalTarget) {
                this.target = this.finalTarget;
                this.route = [];
                if (this.ship.debug) {
                    console.log(`WandererJob: No jump gate, selected fallback: ${this.finalTarget.name}`);
                }
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
                if (this.ship.debug) {
                    console.log(`WandererJob: No planet in destination, selected fallback: ${this.finalTarget.name}`);
                }
                return true;
            }
            return false;
        }

        this.target = jumpGate;
        this.route = [jumpGate, this.finalTarget];
        if (this.ship.debug) {
            console.log(`WandererJob: Selected cross-system target: ${this.finalTarget.name} via ${jumpGate.name}`);
        }
        return true;
    }

    /**
     * Selects the next valid target from the route or finalTarget.
     * @returns {CelestialBody|Asteroid|JumpGate|null} The next valid target, or null if none.
     */
    selectNextValidTarget() {
        while (this.route.length > 0.0) {
            const nextTarget = this.route.shift();
            if (isValidTarget(this.ship, nextTarget)) {
                return nextTarget;
            }
            if (this.ship.debug) {
                console.log(`WandererJob: Skipped invalid route target ${nextTarget.name}`);
            }
        }

        if (this.finalTarget && isValidTarget(this.ship, this.finalTarget)) {
            return this.finalTarget;
        }

        return null;
    }

    /**
     * Pauses the job, saving the current state.
     */
    pause() {
        super.pause();
        if (this.pilot.autopilot) {
            this.pilot.setAutopilot(null);
        }
        if (this.ship.debug) {
            console.log(`WandererJob: Paused in state ${this.state}`);
        }
    }

    /**
     * Resumes the job, resetting to Starting.
     */
    resume() {
        super.resume();
        this.state = 'Starting';
        this.target = null;
        this.finalTarget = null;
        this.route = [];
        this.waitTime = 0.0;
        if (this.ship.debug) {
            console.log(`WandererJob: Resumed, transitioning to Starting`);
        }
    }
}
// export class WandererJob extends Job {
//     constructor(ship, pilot = null) {
//         super(ship, pilot);
//         this.state = 'Starting';
//         this.target = null;
//         this.finalTarget = null;
//         this.route = [];
//         this.waitTime =  0.0;
//         this.waitDuration =  0.0;
//         this._scratchVector = new Vector2D();
//         this.stateHandlers = {
//             Starting: this.updateStarting.bind(this),
//             Traveling: this.updateTraveling.bind(this),
//             Waiting: this.updateWaiting.bind(this)
//         };
//     }

//     update(deltaTime, gameManager) {
//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime, gameManager);
//         } else if (this.ship.debug) {
//             console.warn(`WandererJob: Invalid state ${this.state}`);
//             this.error = `Invalid state: ${this.state}`;
//             this.state = 'Starting';
//         }
//     }

//     updateStarting(deltaTime, gameManager) {
//         if (this.ship.debug) {
//             console.log(`WandererJob: Planning route, ship state: ${this.ship.state}`);
//         }

//         this.target = null;
//         this.finalTarget = null;
//         this.route.length =  0.0;

//         if (!this.planRoute()) {
//             if (this.ship.debug) {
//                 console.warn('WandererJob: Failed to plan route, retrying next frame');
//             }
//             this.error = 'No valid destination found';
//             return;
//         }

//         if (this.ship.debug) {
//             console.log(`WandererJob: Planned target ${this.target?.name}, transitioning to Traveling`);
//         }
//         this.state = 'Traveling';
//     }

//     updateTraveling(deltaTime, gameManager) {
//         if (this.ship.state === 'Landed' && this.target === this.finalTarget && this.route.length ===  0.0) {
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Landed at final target ${this.target?.name}, transitioning to Waiting`);
//             }
//             this.waitTime =  0.0;
//             this.waitDuration = 10 + Math.random() *  20.0;
//             this.state = 'Waiting';
//             return;
//         }

//         if (this.ship.state === 'Landed') {
//             if (!this.target || !isValidTarget(this.ship, this.target)) {
//                 if (this.ship.debug) {
//                     console.warn('WandererJob: Invalid target while landed, transitioning to Starting');
//                 }
//                 this.error = 'Invalid target';
//                 this.state = 'Starting';
//                 return;
//             }
//             if (this.waitTime >= this.waitDuration) {
//                 if (this.ship.debug) {
//                     console.log(`WandererJob: Initiating takeoff toward ${this.target.name}`);
//                 }
//                 this.ship.setTarget(this.target);
//                 this.ship.initiateTakeoff();
//                 this.waitTime =  0.0;
//                 this.waitDuration =  0.0;
//             } else {
//                 this.waitTime += deltaTime;
//             }
//             return;
//         }

//         if (this.ship.state !== 'Flying') {
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Not flying (state: ${this.ship.state}), transitioning to Starting`);
//             }
//             this.state = 'Starting';
//             return;
//         }

//         if (!this.target || !isValidTarget(this.ship, this.target)) {
//             this.target = this.selectNextValidTarget();
//             if (!this.target) {
//                 if (this.ship.debug) {
//                     console.warn('WandererJob: No valid target or route, transitioning to Starting');
//                 }
//                 this.error = 'No valid target';
//                 this.state = 'Starting';
//                 return;
//             }
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Selected new target ${this.target.name}`);
//             }
//         }

//         if (!this.pilot.autopilot) {
//             const AutopilotClass = this.target instanceof JumpGate ? TraverseJumpGateAutopilot : LandOnPlanetAutopilot;
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Setting ${AutopilotClass.name} for ${this.target.name}`);
//             }
//             this.pilot.setAutopilot(new AutopilotClass(this.ship, this.target));
//         }

//         if (this.pilot.autopilot?.isComplete()) {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Autopilot complete, clearing');
//             }
//             this.pilot.setAutopilot(null);
//             this.target = null;
//         }
//     }

//     updateWaiting(deltaTime, gameManager) {
//         if (this.ship.state !== 'Landed') {
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Waiting but not landed (state: ${this.ship.state}), transitioning to Starting`);
//             }
//             this.state = 'Starting';
//             this.waitTime =  0.0;
//             this.waitDuration =  0.0;
//             return;
//         }

//         this.waitTime += deltaTime;
//         if (this.waitTime >= this.waitDuration) {
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Waited ${this.waitTime.toFixed(1)}s, transitioning to Starting`);
//             }
//             this.state = 'Starting';
//             this.waitTime =  0.0;
//             this.waitDuration =  0.0;
//         }
//     }

//     planRoute() {
//         const currentSystem = this.ship.starSystem;
//         const excludePlanet = this.ship.state === 'Landed' ? this.ship.landedObject : null;
//         if (this.ship.debug) {
//             console.log(`WandererJob: Planning route, system: ${currentSystem.name}, exclude: ${excludePlanet?.name || 'none'}`);
//         }

//         if (Math.random() < 0.2) {
//             this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet);
//             if (this.finalTarget) {
//                 this.target = this.finalTarget;
//                 this.route = [];
//                 if (this.ship.debug) {
//                     console.log(`WandererJob: Selected same-system target: ${this.finalTarget.name}`);
//                 }
//                 return true;
//             }
//         }

//         return this.planCrossSystemRoute(currentSystem, excludePlanet);
//     }

//     planCrossSystemRoute(currentSystem, excludePlanet) {
//         const jumpGate = currentSystem.getRandomJumpGate(this.ship);
//         if (!jumpGate) {
//             this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
//             if (this.finalTarget) {
//                 this.target = this.finalTarget;
//                 this.route = [];
//                 if (this.ship.debug) {
//                     console.log(`WandererJob: No jump gate, selected fallback: ${this.finalTarget.name}`);
//                 }
//                 return true;
//             }
//             return false;
//         }

//         const destinationSystem = jumpGate.lane.target;
//         this.finalTarget = destinationSystem.getRandomPlanet(null, null);
//         if (!this.finalTarget) {
//             this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
//             if (this.finalTarget) {
//                 this.target = this.finalTarget;
//                 this.route = [];
//                 if (this.ship.debug) {
//                     console.log(`WandererJob: No planet in destination, selected fallback: ${this.finalTarget.name}`);
//                 }
//                 return true;
//             }
//             return false;
//         }

//         this.target = jumpGate;
//         this.route = [jumpGate, this.finalTarget];
//         if (this.ship.debug) {
//             console.log(`WandererJob: Selected cross-system target: ${this.finalTarget.name} via ${jumpGate.name}`);
//         }
//         return true;
//     }

//     selectNextValidTarget() {
//         while (this.route.length >  0.0) {
//             const nextTarget = this.route.shift();
//             if (isValidTarget(this.ship, nextTarget)) {
//                 return nextTarget;
//             }
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Skipped invalid route target ${nextTarget.name}`);
//             }
//         }

//         if (this.finalTarget && isValidTarget(this.ship, this.finalTarget)) {
//             return this.finalTarget;
//         }

//         return null;
//     }

//     pause() {
//         super.pause();
//         if (this.pilot.autopilot) {
//             this.pilot.setAutopilot(null);
//         }
//         if (this.ship.debug) {
//             console.log(`WandererJob: Paused in state ${this.state}`);
//         }
//     }

//     resume() {
//         super.resume();
//         this.state = 'Starting';
//         this.target = null;
//         this.finalTarget = null;
//         this.route = [];
//         this.waitTime =  0.0;
//         this.waitDuration =  0.0;
//         if (this.ship.debug) {
//             console.log(`WandererJob: Resumed, transitioning to Starting`);
//         }
//     }
// }
// export class WandererJob extends Job {
//     /**
//      * Creates a new WandererJob instance.
//      * @param {Ship} ship - The ship to control.
//      * @param {AiPilot} [pilot=null] - The pilot controlling the ship (optional).
//      */
//     constructor(ship, pilot = null) {
//         super(ship, pilot);
//         /** @type {string} The current job state ('Starting', 'Planning', 'Traveling', 'Waiting'). */
//         this.state = 'Starting';
//         /** @type {CelestialBody|Asteroid|null} The current navigation target (jump gate or planet). */
//         this.target = null;
//         /** @type {CelestialBody|Asteroid|null} The final destination planet. */
//         this.finalTarget = null;
//         /** @type {JumpGate[]} Array of jump gates to reach finalTarget. */
//         this.route = [];
//         /** @type {number} Time (seconds) spent in Waiting state. */
//         this.waitTime =  0.0;
//         /** @type {number} Random delay (seconds, 10-30s) for Waiting state. */
//         this.waitDuration =  0.0;
//         /** @type {Vector2D} Temporary vector for distance calculations. */
//         this._scratchVector = new Vector2D();
//         /** @type {Object.<string, Function>} Map of state names to handler methods. */
//         this.stateHandlers = {
//             'Starting': this.updateStarting.bind(this),
//             'Planning': this.updatePlanning.bind(this),
//             'Traveling': this.updateTraveling.bind(this),
//             'Waiting': this.updateWaiting.bind(this)
//         };
//     }

//     /**
//      * Updates the job's behavior by delegating to the current state handler.
//      * @param {number} deltaTime - Time elapsed since last update (seconds).
//      * @param {GameManager} gameManager - The game manager instance for context.
//      */
//     update(deltaTime, gameManager) {
//         const handler = this.stateHandlers[this.state];
//         if (handler) {
//             handler(deltaTime, gameManager);
//         } else if (this.ship.debug) {
//             console.log(`WandererJob: Invalid state ${this.state}`);
//         }
//     }

//     /**
//      * Handles the 'Starting' state, initiating takeoff if landed.
//      * @param {number} deltaTime - Time elapsed since last update (seconds).
//      * @param {GameManager} gameManager - The game manager instance for context.
//      */
//     updateStarting(deltaTime, gameManager) {
//         if (this.ship.state === 'Landed') {
//             if (this.waitDuration ===  0.0) { // No delay for initial start
//                 if (this.ship.debug) {
//                     console.log('WandererJob: Initial start, initiating takeoff');
//                 }
//                 this.ship.initiateTakeoff();
//             } else if (this.waitTime >= this.waitDuration) { // Delayed takeoff
//                 if (this.ship.debug) {
//                     console.log(`WandererJob: Waited ${this.waitTime.toFixed(1)}s, initiating takeoff`);
//                 }
//                 this.ship.initiateTakeoff();
//                 this.waitTime =  0.0;
//                 this.waitDuration =  0.0;
//             }
//         } else if (this.ship.state === 'Flying') {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Ship flying, transitioning to Planning');
//             }
//             this.state = 'Planning';
//         }
//     }

//     /**
//      * Handles the 'Planning' state, planning a route if flying.
//      * @param {number} deltaTime - Time elapsed since last update (seconds).
//      * @param {GameManager} gameManager - The game manager instance for context.
//      */
//     updatePlanning(deltaTime, gameManager) {
//         if (this.ship.state === 'Landed') {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Planning while landed, transitioning to Starting');
//             }
//             this.state = 'Starting';
//             return;
//         }
//         if (this.ship.state === 'Flying') {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Planning route');
//             }
//             this.planRoute();
//             this.state = 'Traveling';
//         }
//     }

//     /**
//      * Handles the 'Traveling' state, navigating to the target.
//      * @param {number} deltaTime - Time elapsed since last update (seconds).
//      * @param {GameManager} gameManager - The game manager instance for context.
//      */
//     updateTraveling(deltaTime, gameManager) {
//         if (this.ship.state === 'Landed' && this.target === this.finalTarget && this.route.length ===  0.0) {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Landed at final target, transitioning to Waiting');
//             }
//             this.waitTime =  0.0;
//             this.waitDuration = 10 + Math.random() *  20.0; // 10-30s
//             this.state = 'Waiting';
//             return;
//         }

//         if (this.ship.state === 'Flying') {
//             // Handle post-jump or invalid target
//             if (!this.target || !isValidTarget(this.ship, this.target)) {
//                 if (this.ship.debug) {
//                     console.log('WandererJob: Invalid or no target, checking route');
//                 }
//                 // Iterate route for next valid target
//                 this.target = null;
//                 while (this.route.length >  0.0) {
//                     const selectedTarget = this.route.shift();
//                     if (isValidTarget(this.ship, selectedTarget)) {
//                         if (this.ship.debug) {
//                             console.log(`WandererJob: Selected valid target ${selectedTarget.name}`);
//                         }
//                         this.target = selectedTarget;
//                         break;
//                     }
//                     if (this.ship.debug) {
//                         console.log(`WandererJob: Skipped invalid route target ${selectedTarget.name}`);
//                     }
//                 }

//                 // If route empty, try finalTarget
//                 if (!this.target && this.finalTarget && isValidTarget(this.ship, this.finalTarget)) {
//                     this.target = this.finalTarget;
//                     if (this.ship.debug) {
//                         console.log(`WandererJob: Selected valid finalTarget ${this.target.name}`);
//                     }
//                 }
//                 // No valid target, re-plan
//                 if (!this.target) {
//                     if (this.ship.debug) {
//                         console.log('WandererJob: No valid target/route, transitioning to Planning');
//                     }
//                     this.state = 'Planning';
//                     this.target = null;
//                     this.finalTarget = null;
//                     this.route = [];
//                     return;
//                 }
//             }

//             if (!this.pilot.autopilot) {
//                 if (this.target instanceof JumpGate) {
//                     if (this.ship.debug) {
//                         console.log(`WandererJob: Setting autopilot to jump gate ${this.target.name}`);
//                     }
//                     this.pilot.setAutopilot(new TraverseJumpGateAutopilot(this.ship, this.target));
//                 } else {
//                     if (this.ship.debug) {
//                         console.log(`WandererJob: Setting autopilot to land on ${this.target.name}`);
//                     }
//                     this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, this.target));
//                 }
//             }
//         }
//         if (this.pilot.autopilot && this.pilot.autopilot.isComplete()) {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Autopilot complete, clearing');
//             }
//             this.pilot.setAutopilot(null);
//         }
//     }

//     /**
//      * Handles the 'Waiting' state, delaying before re-planning.
//      * @param {number} deltaTime - Time elapsed since last update (seconds).
//      * @param {GameManager} gameManager - The game manager instance for context.
//      */
//     updateWaiting(deltaTime, gameManager) {
//         if (this.ship.state !== 'Landed') {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Waiting but not landed, transitioning to Starting');
//             }
//             this.state = 'Starting';
//             this.waitTime =  0.0;
//             this.waitDuration =  0.0;
//             return;
//         }
//         this.waitTime += deltaTime;
//         if (this.waitTime >= this.waitDuration) {
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Waited ${this.waitTime.toFixed(1)}s, transitioning to Starting`);
//             }
//             this.state = 'Starting';
//             this.waitTime =  0.0;
//             this.waitDuration =  0.0;
//         }
//     }

//     /**
//      * Plans a route to a random planet, prioritizing different star systems (80% chance).
//      */
//     planRoute() {
//         const currentSystem = this.ship.starSystem;
//         const excludePlanet = this.ship.state === 'Landed' ? this.ship.landedObject : null;
//         if (this.ship.debug) {
//             console.log(`WandererJob: Planning route, current system: ${currentSystem.name}, exclude: ${excludePlanet?.name || 'none'}`);
//         }

//         if (Math.random() < 0.2) {
//             // 20% chance: Same system, exclude current planet
//             this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet);
//             if (this.finalTarget) {
//                 this.target = this.finalTarget;
//                 this.route = [];
//                 if (this.ship.debug) {
//                     console.log(`WandererJob: Selected same-system target: ${this.finalTarget.name}`);
//                 }
//             } else {
//                 // Fallback to cross-system
//                 this.planCrossSystemRoute(currentSystem, excludePlanet);
//             }
//         } else {
//             // 80% chance: Different system
//             this.planCrossSystemRoute(currentSystem, excludePlanet);
//         }
//     }

//     /**
//      * Plans a route to a planet in a different star system.
//      * @param {StarSystem} currentSystem - The current star system.
//      * @param {CelestialBody|Asteroid|null} excludePlanet - The CelestialBody or Asteroid to exclude (if landed).
//      */
//     planCrossSystemRoute(currentSystem, excludePlanet) {
//         const jumpGate = currentSystem.getRandomJumpGate(this.ship);
//         if (!jumpGate) {
//             // Fallback to same system
//             this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
//             this.target = this.finalTarget;
//             this.route = [];
//             if (this.ship.debug) {
//                 console.log(`WandererJob: No jump gate, selected fallback: ${this.finalTarget.name}`);
//             }
//             return;
//         }

//         // Use jumpGate.lane.target for destination system
//         const destinationSystem = jumpGate.lane.target;
//         this.finalTarget = destinationSystem.getRandomPlanet(this.ship);
//         if (!this.finalTarget) {
//             // Fallback to same system
//             this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
//             this.target = this.finalTarget;
//             this.route = [];
//             if (this.ship.debug) {
//                 console.log(`WandererJob: No planet in destination, selected fallback: ${this.finalTarget.name}`);
//             }
//         } else {
//             this.target = jumpGate;
//             this.route = [jumpGate];
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Selected cross-system target: ${this.finalTarget.name} via ${jumpGate.name}`);
//             }
//         }
//     }

//     /**
//      * Pauses the job, saving the current state.
//      */
//     pause() {
//         super.pause();
//         if (this.ship.debug) {
//             console.log(`WandererJob: Paused in state ${this.state}`);
//         }
//     }

//     /**
//      * Resumes the job, setting appropriate state based on ship status.
//      */
//     resume() {
//         super.resume();
//         if (this.ship.state === 'Landed') {
//             if (this.ship.debug) {
//                 console.log('WandererJob: Resuming, ship landed, setting Waiting');
//             }
//             this.state = 'Waiting';
//             this.target = null;
//             this.finalTarget = null;
//             this.route = [];
//             this.waitTime =  0.0;
//             this.waitDuration = 10 + Math.random() *  20.0; // 10-30s
//         } else {
//             if (this.ship.debug) {
//                 console.log(`WandererJob: Resuming, ship ${this.ship.state}, setting Planning`);
//             }
//             this.state = 'Planning';
//             this.target = null;
//             this.finalTarget = null;
//             this.route = [];
//         }
//     }
// }