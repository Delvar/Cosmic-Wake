// /src/job/minerJob.js

import { Job } from '/src/job/job.js';
import { LandOnAsteroidAutopilot, LandOnPlanetAutopilot } from '/src/autopilot/autopilot.js';
import { randomBetween } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { Ship } from '/src/ship/ship.js';
import { Planet } from '/src/starSystem/celestialBody.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';
import { GameManager } from '/src/core/game.js';

/**
 * Job for a ship to mine asteroids and return to a home planet.
 * @extends Job
 */
export class MinerJob extends Job {
    /**
     * Creates a new MinerJob instance.
     * @param {Ship} ship - The ship to control.
     * @param {Planet} [homePlanet=null] - The home planet to return to; if null, uses closest planet.
     * @param {AiPilot} [pilot=null] - The pilot controlling the ship.
     */
    constructor(ship, homePlanet = null, pilot = null) {
        super(ship, pilot);
        /** @type {Planet|null} The home planet to return to after mining. */
        this.homePlanet = homePlanet;
        /** @type {Asteroid|null} The current target asteroid to mine. */
        this.targetAsteroid = null;
        /** @type {number} Time remaining for mining or waiting (seconds). */
        this.waitTime = 0;
        /** @type {number} Time to spend mining an asteroid (seconds). */
        this.miningTime = 5;
        /** @type {number} Minimum wait time on home planet (seconds). */
        this.waitTimeMin = 5;
        /** @type {number} Maximum wait time on home planet (seconds). */
        this.waitTimeMax = 10;
        /** @type {Vector2D} Scratch vector for distance calculations. */
        this._scratchDistanceToTarget = new Vector2D();
        /** @type {Vector2D} Scratch vector for velocity corrections. */
        this._scratchVelocityError = new Vector2D();
        /** @type {Object.<string, Function>} Map of state names to handler methods. */
        this.stateHandlers = {
            'Starting': this.updateStarting.bind(this),
            'FlyingToAsteroid': this.updateFlyingToAsteroid.bind(this),
            'Mining': this.updateMining.bind(this),
            'FlyingToHomePlanet': this.updateFlyingToHomePlanet.bind(this),
            'WaitingOnHomePlanet': this.updateWaitingOnHomePlanet.bind(this)
        };
    }

    /**
     * Updates the job by validating targets and delegating to state handlers.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    update(deltaTime, gameManager) {
        if (this.state === 'Failed') {
            return;
        }
        // Reassign homePlanet if invalid
        if (!this.homePlanet || this.homePlanet.isDespawned()) {
            this.homePlanet = this.ship.starSystem?.getClosestPlanet(this.ship);
            if (!this.homePlanet) {
                this.state = 'Failed';
                return;
            }
        }

        // Run state handler
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else {
            console.warn(`MinerJob: Invalid state ${this.state}`);
            this.state = 'Starting';
        }
    }

    /**
     * Handles the 'Starting' state, deciding to mine or wait based on ship state.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateStarting(deltaTime, gameManager) {
        //ensure we have a target asteroid or we fail
        if (!this.targetAsteroid || !isValidTarget(this.ship, this.targetAsteroid)) {
            this.targetAsteroid = this.ship.starSystem.getRandomAsteroid(this.ship);
            if (!this.targetAsteroid || !isValidTarget(this.ship, this.targetAsteroid)) {
                this.state = 'Failed';
                if (this.ship.debug) {
                    console.log('MinerJob: No asteroids available, transitioning to Failed');
                }
                return;
            }
        }
        if (this.ship.state === 'Landed') {
            if (this.ship.landedObject === this.homePlanet) {
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'WaitingOnHomePlanet';
                if (this.ship.debug) {
                    console.log('MinerJob: Landed on home planet, transitioning to WaitingOnHomePlanet');
                }
            } else if (this.ship.landedObject === this.targetAsteroid) {
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'Mining';
                if (this.ship.debug) {
                    console.log('MinerJob: Landed on asteroid, transitioning to Mining');
                }
            } else {
                this.ship.initiateTakeoff();
                if (this.ship.debug) {
                    console.log('MinerJob: Found asteroid, initiating takeoff');
                }
                // Stay in Starting; next update handles Flying
            }
        } else if (this.ship.state === 'Flying') {
            this.pilot.setAutopilot(new LandOnAsteroidAutopilot(this.ship, this.targetAsteroid));
            this.state = 'FlyingToAsteroid';
            if (this.ship.debug) {
                console.log('MinerJob: Flying to asteroid');
            }
        }
        // Wait if TakingOff
    }

    /**
     * Handles the 'FlyingToAsteroid' state, managing flight to the target asteroid.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlyingToAsteroid(deltaTime, gameManager) {
        if (!this.targetAsteroid || !isValidTarget(this.ship, this.targetAsteroid)) {
            this.targetAsteroid = this.ship.starSystem?.getRandomAsteroid(this.ship);
            if (!this.targetAsteroid || !isValidTarget(this.ship, this.targetAsteroid)) {
                this.state = 'Failed';
                return;
            }
            this.pilot.setAutopilot(new LandOnAsteroidAutopilot(this.ship, this.targetAsteroid));
        }
        if (this.pilot.autopilot == null || this.pilot.autopilot.isComplete()) {
            if (this.ship.state === 'Landed' && this.ship.landedObject === this.targetAsteroid) {
                this.waitTime = this.miningTime;
                this.state = 'Mining';
            } else {
                console.warn('Autopilot complete but not landed on asteroid; resetting');
                this.targetAsteroid = null;
                this.state = 'Starting';
            }
            this.pilot.setAutopilot(null);
        }
    }

    /**
     * Handles the 'Mining' state, waiting while mining the asteroid.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateMining(deltaTime, gameManager) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.ship.initiateTakeoff();
            this.pilot.setAutopilot(new LandOnPlanetAutopilot(this.ship, this.homePlanet));
            this.state = 'FlyingToHomePlanet';
            this.targetAsteroid = null;
        }
    }

    /**
     * Handles the 'FlyingToHomePlanet' state, managing flight to the home planet.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateFlyingToHomePlanet(deltaTime, gameManager) {
        if (this.pilot.autopilot == null || this.pilot.autopilot.isComplete()) {
            if (this.ship.state === 'Landed' && this.ship.landedObject === this.homePlanet) {
                this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
                this.state = 'WaitingOnHomePlanet';
            } else {
                console.warn('Autopilot complete but not landed on home planet; resetting');
                this.state = 'Starting';
            }
            this.pilot.setAutopilot(null);
        }
    }

    /**
     * Handles the 'WaitingOnHomePlanet' state, waiting before restarting the cycle.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {GameManager} gameManager - The game manager instance for context.
     */
    updateWaitingOnHomePlanet(deltaTime, gameManager) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.ship.initiateTakeoff();
            this.state = 'Starting';
        }
    }

    /**
     * Pauses the job, saving the current state.
     */
    pause() {
        super.pause();
        if (this.ship.debug) {
            console.log(`MinerJob: Paused in state ${this.state}`);
        }
    }

    /**
     * Resumes the job, adjusting state based on ship status.
     */
    resume() {
        super.resume();
        if (this.ship.state === 'Landed') {
            this.state = 'WaitingOnHomePlanet';
            this.waitTime = randomBetween(this.waitTimeMin, this.waitTimeMax);
            if (this.ship.debug) {
                console.log('MinerJob: Resuming, ship landed, setting WaitingOnHomePlanet');
            }
        } else {
            this.state = 'Starting';
            if (this.ship.debug) {
                console.log(`MinerJob: Resuming, ship ${this.ship.state}, setting Starting`);
            }
        }
    }
}