// ai/wandererJob.js

import { Job } from '/src/ai/job.js';
import { Vector2D } from '/src/core/vector2d.js';
import { FlyToTargetAutoPilot, LandOnPlanetAutoPilot, TraverseJumpGateAutoPilot } from '/src/autopilot/autopilot.js';

/**
 * Job for a ship to wander between planets, prioritizing different star systems.
 * @extends Job
 */
export class WandererJob extends Job {
    /**
     * Creates a new WandererJob instance.
     * @param {Ship} ship - The ship to control.
     */
    constructor(ship) {
        super(ship);
        this.target = null; // Planet or jump gate
        this.finalTarget = null; // Destination planet
        this.route = []; // Array of jump gates to final target
        this._scratchVector = new Vector2D(); // For future distance checks
    }

    /**
     * Updates the job's behavior.
     * @param {number} deltaTime - Time elapsed in seconds.
     * @param {AIPilot} pilot - The controlling AI pilot.
     */
    update(deltaTime, pilot) {
        switch (this.state) {
            case 'Starting':
                if (this.ship.state === 'Landed') {
                    this.ship.initiateTakeoff();
                } else if (this.ship.state === 'Flying') {
                    this.state = 'Planning';
                }
                break;

            case 'Planning':
                if (this.ship.state === 'Flying') {
                    this.planRoute();
                    this.state = 'Traveling';
                }
                break;

            case 'Traveling':
                if (this.ship.state === 'Flying' || this.ship.state === 'Landed') {
                    if (!pilot.autopilot) {
                        if (this.route.length > 0) {
                            this.target = this.route.shift();
                            pilot.setAutoPilot(new TraverseJumpGateAutoPilot(this.ship, this.target));
                        } else if (this.target && this.target !== this.finalTarget) {
                            this.target = this.finalTarget;
                            pilot.setAutoPilot(new FlyToTargetAutoPilot(this.ship, this.target, this.target.radius));
                        } else if (this.target && this.ship.state === 'Flying') {
                            pilot.setAutoPilot(new LandOnPlanetAutoPilot(this.ship, this.target));
                        }
                    }
                }
                if (pilot.autopilot && pilot.autopilot.isComplete()) {
                    pilot.setAutoPilot(null);
                    if (this.ship.state === 'Landed' && this.target === this.finalTarget) {
                        this.state = 'Completed';
                    }
                }
                break;

            case 'Completed':
                if (this.ship.state === 'Landed') {
                    this.target = null;
                    this.finalTarget = null;
                    this.route = [];
                    this.state = 'Starting';
                }
                break;
        }
    }

    /**
     * Plans a route to a random planet, prioritizing different systems (80%).
     */
    planRoute() {
        const currentSystem = this.ship.starSystem;
        const excludePlanet = this.ship.state === 'Landed' ? this.ship.landedBody : null;
        
        if (Math.random() < 0.2) {
            // 20% chance: Same system, exclude current planet
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet);
            if (this.finalTarget) {
                this.target = this.finalTarget;
                this.route = [];
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
     * Plans a route to a planet in a different system.
     * @param {Object} currentSystem - Current star system.
     * @param {Object} excludePlanet - Planet to exclude.
     */
    planCrossSystemRoute(currentSystem, excludePlanet) {
        const jumpGate = currentSystem.getRandomJumpGate(this.ship);
        if (!jumpGate) {
            // Fallback to same system
            this.finalTarget = currentSystem.getRandomPlanet(this.ship, excludePlanet) || excludePlanet;
            this.target = this.finalTarget;
            this.route = [];
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
        } else {
            this.target = jumpGate;
            this.route = [jumpGate];
        }
    }

    /**
     * Pauses the job, saving state.
     */
    pause() {
        super.pause();
    }

    /**
     * Resumes the job, restoring state.
     */
    resume() {
        super.resume();
        if (this.state !== 'Paused') {
            // Recalculate route if system changed
            if (this.finalTarget && this.ship.starSystem !== this.finalTarget.starSystem && this.state !== 'Completed') {
                this.state = 'Planning';
                this.target = null;
                this.route = [];
            }
        }
    }

    /**
     * Returns the job's status for HUD.
     * @returns {string} Status message.
     */
    getStatus() {
        if (this.state === 'Paused') return 'Paused';
        if (this.state === 'Completed') return 'Landed';
        if (this.finalTarget) return `Traveling to ${this.finalTarget.name}`;
        return 'Planning route';
    }
}