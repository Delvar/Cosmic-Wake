// pilot.js

import { Vector2D } from './vector2d.js';
import { JumpGate } from './celestialBody.js';
import { remapClamp } from './utils.js';
import { TraverseJumpGateAutoPilot, FlyToTargetAutoPilot, LandOnPlanetAutoPilot } from './autopilot.js';
import { Ship } from './ship.js';

export class Pilot {
    constructor(ship) {
        this.ship = ship;
    }

    update(deltaTime, gameManager) {
        throw new Error("update() must be implemented by subclass");
    }

    tryHyperjump(gameManager) {
        throw new Error("tryHyperjump() must be implemented by subclass");
    }

    getState() {
        throw new Error("getState() must be implemented by subclass");
    }
}

export class PlayerPilot extends Pilot {
    constructor(ship) {
        super(ship);
        this.autopilot = null;

        // Scratch vector to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D(); // For direction calculations
        this._scratchDistanceToTarget = new Vector2D(); // For distance calculations
    }

    listTargetableObjects() {
        const starSystem = this.ship.starSystem;
        const planets = starSystem.celestialBodies.filter(body => !(body instanceof JumpGate) && !body.isDespawned());
        const gates = starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        const ships = starSystem.ships.filter(ship => ship !== this.ship && !ship.isDespawned());
        const asteroids = starSystem.asteroidBelt ? starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        return [...planets, ...gates, ...ships, ...asteroids];
    }

    update(deltaTime, gameManager) {
        const keys = gameManager.keys;
        const lastKeys = gameManager.lastKeys;

        if (keys['ArrowLeft'] || keys['ArrowRight'] || keys['ArrowUp'] || keys['ArrowDown']) {
            if (this.autopilot?.active) {
                this.autopilot.stop();
                this.autopilot = null;
            }
        }

        if (keys['ArrowLeft']) {
            this.ship.setTargetAngle(this.ship.angle - this.ship.rotationSpeed * deltaTime);
        }
        if (keys['ArrowRight']) {
            this.ship.setTargetAngle(this.ship.angle + this.ship.rotationSpeed * deltaTime);
        }
        this.ship.applyThrust(keys['ArrowUp']);
        this.ship.applyBrakes(keys['ArrowDown']);

        if (keys['l'] && !lastKeys['l']) {
            if (this.ship.state === 'Flying' && this.ship.target) {
                if (!(this.ship.target instanceof JumpGate)) {
                    if (this.ship.canLand(this.ship.target)) {
                        this.ship.initiateLanding(this.ship.target);
                    } else {
                        this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.ship.target);
                        this.autopilot.start();
                    }
                }
            } else if (this.ship.state === 'Landed') {
                if (this.ship.target) {
                    this._scratchDirectionToTarget.set(this.ship.target.position)
                        .subtractInPlace(this.ship.position);
                    this.ship.setTargetAngle(Math.atan2(this._scratchDirectionToTarget.x, -this._scratchDirectionToTarget.y));
                }
                this.ship.initiateTakeoff();
            }
        }

        if (keys['j'] && !lastKeys['j']) {
            if (this.ship.state === 'Flying' && this.ship.target) {
                if (this.ship.target instanceof JumpGate) {
                    this._scratchDistanceToTarget.set(this.ship.position)
                        .subtractInPlace(this.ship.target.position);
                    const distanceToGate = this._scratchDistanceToTarget.magnitude();
                    if (distanceToGate <= 50 && this.ship.target.overlapsShip(this.ship.position)) {
                        this.ship.initiateHyperjump();
                    } else {
                        this.autopilot = new TraverseJumpGateAutoPilot(this.ship, this.ship.target);
                        this.autopilot.start();
                    }
                }
            }
        }

        if (this.autopilot?.active) {
            this.autopilot.update(deltaTime);
            if (this.autopilot.isComplete()) {
                if (this.autopilot.error) {
                    console.warn(`Autopilot failed: ${this.autopilot.error}`);
                }
                this.autopilot = null;
            }
        }

        if (keys['t'] && !lastKeys['t']) {
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const nextIndex = (currentIndex + 1) % targets.length;
                this.ship.setTarget(targets[nextIndex]);
            }
        }
        if (keys['T'] && !lastKeys['T']) {
            const targets = this.listTargetableObjects(gameManager);
            if (targets.length > 0) {
                const currentIndex = targets.indexOf(this.ship.target);
                const prevIndex = (currentIndex - 1 + targets.length) % targets.length;
                this.ship.setTarget(targets[prevIndex]);
            }
        }
    }

    getState() {
        if (this.autopilot?.active) {
            return this.autopilot.getStatus();
        }
        return 'Flying free!';
    }
}

export class AIPilot extends Pilot {
    constructor(ship, spawnPlanet) {
        super(ship);
        this.spawnPlanet = spawnPlanet;
        this.target = this.pickDestination(ship.starSystem, spawnPlanet);
        this.state = 'Idle';
        this.waitTime = 0;
        this.autopilot = null;

        this.stateHandlers = {
            'Idle': this.updateIdle.bind(this),
            'FlyingToPlanet': this.updateFlyingToPlanet.bind(this),
            'Landed': this.updateLanded.bind(this),
            'TakingOff': this.updateTakingOff.bind(this),
            'TraversingJumpGate': this.updateTraversingJumpGate.bind(this)
        };

        // Scratch vector to eliminate allocations in update
        this._scratchDirectionToTarget = new Vector2D(); // For direction calculations in updateLanded
    }

    pickDestination(starSystem, excludeBody) {
        const destinations = starSystem.celestialBodies.filter(body =>
            body !== excludeBody && body.type.type !== 'star'
        );
        if (destinations.length === 0) {
            console.warn('No valid destinations found; defaulting to spawn planet');
            return excludeBody;
        }
        return destinations[Math.floor(Math.random() * destinations.length)];
    }

    update(deltaTime, gameManager) {
        if (this.ship.starSystem === this.target.starSystem) {
            this.ship.setTarget(this.target);
        }

        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime, gameManager);
        } else {
            console.warn(`No handler for state: ${this.state}`);
            this.state = 'Idle';
        }
    }

    updateIdle(deltaTime, gameManager) {
        if (this.target instanceof JumpGate) {
            this.autopilot = new TraverseJumpGateAutoPilot(this.ship, this.target);
            this.autopilot.start();
            this.state = 'TraversingJumpGate';
        } else {
            this.autopilot = new LandOnPlanetAutoPilot(this.ship, this.target);
            this.autopilot.start();
            this.state = 'FlyingToPlanet';
        }
    }

    updateFlyingToPlanet(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during FlyingToPlanet state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Landed') {
                    this.state = 'Landed';
                    this.waitTime = Math.random() * 5 + 2;
                    this.autopilot = null;
                } else {
                    console.warn('Autopilot completed but ship is not landed; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during FlyingToPlanet state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    updateLanded(deltaTime, gameManager) {
        this.waitTime -= deltaTime;
        if (this.waitTime <= 0) {
            this.spawnPlanet = this.target;
            this.target = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
            this._scratchDirectionToTarget.set(this.target.position)
                .subtractInPlace(this.ship.position);
            this.ship.setTargetAngle(Math.atan2(this._scratchDirectionToTarget.x, -this._scratchDirectionToTarget.y));
            this.ship.initiateTakeoff();
            this.state = 'TakingOff';
        }
    }

    updateTakingOff(deltaTime, gameManager) {
        if (this.ship.state === 'Flying') {
            this.state = 'Idle';
        }
    }

    updateTraversingJumpGate(deltaTime, gameManager) {
        if (!this.autopilot) {
            console.warn('Autopilot is not set during TraversingJumpGate state');
            this.state = 'Idle';
            return;
        }

        this.autopilot.update(deltaTime);

        if (this.autopilot.isComplete()) {
            if (this.autopilot.error) {
                console.warn(`Autopilot failed: ${this.autopilot.error}`);
                this.target = this.pickDestination(this.ship.starSystem, null);
                this.autopilot = null;
                this.state = 'Idle';
            } else {
                if (this.ship.state === 'Flying' && this.ship.starSystem === this.target.lane.target) {
                    this.target = this.pickDestination(this.ship.starSystem, this.target.lane.targetGate);
                    this.autopilot = null;
                    this.state = 'Idle';
                } else {
                    console.warn('Autopilot completed but jump not finished; resetting');
                    this.autopilot = null;
                    this.state = 'Idle';
                }
            }
        } else if (!this.autopilot.active) {
            console.warn('Autopilot is inactive but not complete during TraversingJumpGate state');
            this.autopilot = null;
            this.state = 'Idle';
        }
    }

    tryHyperjump(gameManager) {
        return false;
    }

    getState() {
        if ((this.state === 'FlyingToPlanet' || this.state === 'TraversingJumpGate') && this.autopilot?.active) {
            return this.autopilot.getStatus();
        }
        return `AI: ${this.state} (Target: ${this.target?.name || 'None'})`;
    }
}