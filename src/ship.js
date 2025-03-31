// ship.js

import { Vector2D } from './vector2d.js';
import { Trail } from './trail.js';
import { Colour } from './colour.js';
import { GameObject } from './gameObject.js';
import { JumpGate } from './celestialBody.js';
import { TWO_PI, normalizeAngle, randomBetween } from './utils.js';
import { AIPilot } from './pilot.js';

function generateShipName() {
    const prefixes = [
        "Star", "Void", "Nova", "Astro", "Hyper", "Galacto", "Nebula",
        "Cosmo", "Solar", "Lunar", "Stellar", "Eclipse", "Quantum", "Ion",
        "Pulse", "Graviton", "Meteor", "Celestial",
        "Mega", "Disco", "Funky", "Wobbly", "Gizmo", "Bloop", "Snaccident"
    ];
    const roots = [
        "lance", "reaver", "scout", "wing", "drifter", "navigator", "breaker",
        "strike", "voyager", "frigate", "cruiser", "probe", "dread", "spire",
        "runner", "falcon", "comet", "raider",
        "tickler", "wobbler", "floof", "noodle", "blasterpants", "zoomzoom", "chugger"
    ];
    const suffixes = [
        "-X", "-on", "-ia", "-or", "-tron", "-ix", "-us", "-ex", "-is", "-oid",
        "-ara", "-tek", "-nova", "-pulse",
        "-inator", "-zoid", "-omatic", "-erino", "-splosion", "-licious", "-pants"
    ];
    const upperFirst = (word) => word.charAt(0).toUpperCase() + word.slice(1);
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const root = (Math.random() > 0.5) ? roots[Math.floor(Math.random() * roots.length)] : ' ' + upperFirst(roots[Math.floor(Math.random() * roots.length)]);
    let name = `${prefix}${root}`;
    const addSuffix = Math.random() < 0.2;
    if (addSuffix) name += suffixes[Math.floor(Math.random() * suffixes.length)];
    const addNumber = Math.random() < (addSuffix ? 0.05 : 0.2);
    if (addNumber) name += ` ${Math.floor(Math.random() * 99) + 1}`;
    return name;
}

export class Ship extends GameObject {
    static LANDING_SPEED = 10;

    constructor(x, y, starSystem) {
        super(new Vector2D(x, y), starSystem);

        this.name = generateShipName();
        this.rotationSpeed = Math.PI * 1; // Default rotation speed
        this.thrust = 250; // Default thrust
        this.maxVelocity = 500; // Default max velocity
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.targetAngle = 0;
        this.isThrusting = false;
        this.isBraking = false;
        this.hyperdriveReady = true;
        this.hyperdriveCooldown = 5000;
        this.lastJumpTime = 0;

        // Generate random colors for cockpit, wings, and hull
        this.colors = {
            cockpit: this.generateRandomBlue(),
            wings: this.generateRandomColor(),
            hull: this.generateRandomGrey()
        };

        this.trail = new Trail(this, 500, 2, this.colors.wings.toRGBA(0.5));
        this.target = null;
        this.landedPlanet = null;
        this.state = 'Flying';
        this.stateHandlers = {
            'Flying': this.updateFlying.bind(this),
            'Landing': this.updateLanding.bind(this),
            'Landed': this.updateLanded.bind(this),
            'TakingOff': this.updateTakingOff.bind(this),
            'JumpingOut': this.updateJumpingOut.bind(this),
            'JumpingIn': this.updateJumpingIn.bind(this)
        };
        this.shipScale = 1;
        this.stretchFactor = 1;
        this.animationTime = 0;
        this.animationDuration = 2;
        this.landingStartPosition = new Vector2D(0, 0);
        this.jumpGate = null;
        this.jumpStartPosition = new Vector2D(0, 0);
        this.jumpEndPosition = new Vector2D(0, 0);
        this.jumpStartAngle = null;
        this.velocityError = new Vector2D(0, 0);
        this.decelerationDistance = 0;
        this.farApproachDistance = 0;
        this.closeApproachDistance = 0;

        // Bounding box dimensions for HUD targeting rectangle (default values)
        this.boundingBox = new Vector2D(20, 20); // Default width and height

        // Scratch vectors to eliminate allocations in main loop
        this._scratchThrustVector = new Vector2D(0, 0);
        this._scratchTakeoffOffset = new Vector2D(0, 0);
        this._scratchRadialOut = new Vector2D(0, 0);
        this._scratchRadialIn = new Vector2D(0, 0);
        this._scratchScreenPos = new Vector2D(0, 0);
        this._scratchVelocityEnd = new Vector2D(0, 0);
        this._scratchStoppingPoint = new Vector2D(0, 0);
        this._scratchVelocityDelta = new Vector2D(0, 0);
        this._scratchDistanceToPlanet = new Vector2D(0, 0);
    }

    /**
     * Marks the object as despawned, removing it from active gameplay.
     */
    despawn() {
        super.despawn();
        if (this.landedPlanet) {
            this.landedPlanet.removeLandedShip(this);
            this.landedPlanet = null;
        }
    }

    // Generate a random shade of blue for the cockpit
    generateRandomBlue() {
        const r = randomBetween(0, 0.2); // Low red component
        const g = randomBetween(0, 0.5); // Medium green component
        const b = randomBetween(0.7, 1); // High blue component
        return new Colour(r, g, b);
    }

    // Generate a completely random color for the wings
    generateRandomColor() {
        const r = Math.random();
        const g = Math.random();
        const b = Math.random();
        return new Colour(r, g, b);
    }

    // Generate a random shade of grey for the hull
    generateRandomGrey() {
        const shade = randomBetween(0.3, 0.8); // Range from light grey (0.8) to dark grey (0.3)
        return new Colour(shade, shade, shade);
    }

    setState(newState) {
        if (!this.stateHandlers[newState]) {
            console.warn(`Invalid state transition attempted: ${newState}`);
            return;
        }
        this.state = newState;
        this.animationTime = 0;
    }

    setTarget(target) {
        this.target = target;
    }

    clearTarget() {
        this.target = null;
    }

    setTargetAngle(angle) {
        this.targetAngle = normalizeAngle(angle);
    }

    applyThrust(thrusting) {
        this.isThrusting = thrusting;
    }

    applyBrakes(braking) {
        this.isBraking = braking;
    }

    canLand(planet) {
        if (!planet || !planet.position || this.state !== 'Flying') return false;
        this._scratchDistanceToPlanet.set(this.position).subtractInPlace(planet.position);
        const distanceToPlanetCenter = this._scratchDistanceToPlanet.magnitude();
        const currentSpeed = this.velocity.magnitude();
        return distanceToPlanetCenter <= planet.radius && currentSpeed <= Ship.LANDING_SPEED;
    }

    initiateLanding(planet) {
        if (this.canLand(planet)) {
            this.setState('Landing');
            this.landedPlanet = planet;
            this.landingStartPosition.set(this.position);
            this.velocity.set(0, 0);
            this.isThrusting = false;
            this.isBraking = false;
            return true;
        }
        return false;
    }

    initiateTakeoff() {
        if (this.state === 'Landed' && this.landedPlanet) {
            this.setState('TakingOff');
            this.angle = this.targetAngle;
            this.landedPlanet.removeLandedShip(this);
            return true;
        }
        return false;
    }

    initiateHyperjump() {
        const currentTime = performance.now();
        //if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) return false;
        const gate = this.starSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.overlapsShip(this.position)
        );
        if (!gate) return false;

        this.setState('JumpingOut');
        this.jumpGate = gate;
        this.jumpStartPosition.set(this.position);
        this.lastJumpTime = currentTime;
        this.isThrusting = false;
        this.isBraking = false;
        return true;
    }

    update(deltaTime) {
        if (isNaN(this.position.x) && this.debug) {
            console.log('Position became NaN');
        }
        const handler = this.stateHandlers[this.state];
        if (handler) {
            handler(deltaTime);
        } else {
            console.warn(`No handler for state: ${this.state}`);
        }
        this.trail.update(deltaTime);
    }

    updateFlying(deltaTime) {
        const angleDiff = normalizeAngle(this.targetAngle - this.angle);
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * deltaTime), this.rotationSpeed * deltaTime);
        this.angle = normalizeAngle(this.angle);

        if (this.isThrusting) {
            // 0 radians = up (-Y), π/2 = right (+X)
            this._scratchThrustVector.set(Math.sin(this.angle), -Math.cos(this.angle))
                .multiplyInPlace(this.thrust * deltaTime);

            this.velocity.addInPlace(this._scratchThrustVector);
        } else if (this.isBraking) {
            const velAngle = Math.atan2(-this.velocity.x, this.velocity.y);
            const brakeAngleDiff = normalizeAngle(velAngle - this.angle);
            this.angle += brakeAngleDiff * this.rotationSpeed * deltaTime;
            this.angle = normalizeAngle(this.angle);
        }

        const speedSquared = this.velocity.squareMagnitude();
        if (speedSquared > this.maxVelocity * this.maxVelocity) {
            const scale = this.maxVelocity / Math.sqrt(speedSquared);
            this.velocity.multiplyInPlace(scale);
        }

        this._scratchVelocityDelta.set(this.velocity).multiplyInPlace(deltaTime);
        this.position.addInPlace(this._scratchVelocityDelta);
    }

    updateLanding(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);
        this.shipScale = 1 - t;

        if (!this.landingStartPosition || !this.landedPlanet || !this.landedPlanet.position ||
            isNaN(this.landingStartPosition.x) || isNaN(this.landingStartPosition.y) ||
            isNaN(this.landedPlanet.position.x) || isNaN(this.landedPlanet.position.y) ||
            isNaN(this.position.x) || isNaN(this.position.y)) {
            console.error('Invalid landing parameters detected in updateLanding:', {
                landingStartPosition: this.landingStartPosition,
                landedPlanetPosition: this.landedPlanet?.position,
                shipPosition: this.position
            });
            this.position.set(this.landedPlanet?.position || new Vector2D(0, 0));
            this.setState('Landed');
            this.shipScale = 0;
            if (this.landedPlanet) this.landedPlanet.addLandedShip(this);
            return;
        }

        this.position.lerpInPlace(this.landingStartPosition, this.landedPlanet.position, t);

        if (t >= 1) {
            this.setState('Landed');
            this.shipScale = 0;
            this.position.set(this.landedPlanet.position);
            this.landedPlanet.addLandedShip(this);
        }
    }

    updateLanded(deltaTime) {
        if (this.landedPlanet && this.landedPlanet.position) {
            this.position.set(this.landedPlanet.position);
        }
    }

    updateTakingOff(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);
        this.shipScale = t;
        this._scratchTakeoffOffset.set(Math.sin(this.angle), -Math.cos(this.angle))
            .multiplyInPlace(this.landedPlanet.radius * 1.5);
        this._scratchVelocityDelta.set(this._scratchTakeoffOffset).multiplyInPlace(t);
        this.position.set(this.landedPlanet.position)
            .addInPlace(this._scratchVelocityDelta);

        if (t >= 1) {
            this.setState('Flying');
            this.shipScale = 1;
            this.velocity.set(this._scratchTakeoffOffset).divideInPlace(this.animationDuration);
            this.landedPlanet = null;
        }
    }

    updateJumpingOut(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);

        if (t < 0.5) {
            this.shipScale = 1 - (t * 1.5);
            this.position.lerpInPlace(this.jumpStartPosition, this.jumpGate.position, t * 2);
            this._scratchRadialOut.set(this.jumpGate.position).normalizeInPlace();
            const desiredAngle = Math.atan2(this._scratchRadialOut.x, -this._scratchRadialOut.y);
            const startAngle = this.jumpStartAngle || this.angle;
            if (!this.jumpStartAngle) this.jumpStartAngle = this.angle;
            const angleDiff = normalizeAngle(desiredAngle - startAngle);
            this.angle = startAngle + angleDiff * (t * 2);
            this.targetAngle = this.angle;
            this.stretchFactor = 1;
        } else {
            this.shipScale = 0.25;
            const easedT = (t - 0.5) * 2;
            const progress = easedT * easedT;
            this.stretchFactor = 1 + progress * 9;
            this._scratchRadialOut.set(this.jumpGate.position).normalizeInPlace();
            const maxDistance = 5000;
            this._scratchVelocityDelta.set(this._scratchRadialOut).multiplyInPlace(maxDistance * progress);
            this.position.set(this.jumpGate.position)
                .addInPlace(this._scratchVelocityDelta);
            this.velocity.set(this._scratchRadialOut).multiplyInPlace(2000 * easedT);
        }

        if (t >= 1) {
            const oldSystem = this.starSystem;
            this.starSystem = this.jumpGate.lane.target;
            this._scratchRadialIn.set(this.jumpGate.lane.targetGate.position)
                .normalizeInPlace()
                .multiplyInPlace(-1);
            this.jumpEndPosition.set(this.jumpGate.lane.targetGate.position);
            this._scratchVelocityDelta.set(this._scratchRadialIn).multiplyInPlace(5000);
            this.position.set(this.jumpEndPosition)
                .subtractInPlace(this._scratchVelocityDelta);
            this.setState('JumpingIn');
            this.velocity.set(this._scratchRadialIn).multiplyInPlace(2000);
            this.trail.points.clear();
            this.jumpStartAngle = null;
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this);
            this.starSystem.ships.push(this);
        }
    }

    updateJumpingIn(deltaTime) {
        this.animationTime += deltaTime;
        const t = Math.min(this.animationTime / this.animationDuration, 1);

        if (!this.jumpEndPosition) {
            console.error('jumpEndPosition is null in JumpingIn state; resetting to current position');
            this.jumpEndPosition.set(this.position);
        }

        if (t < 0.5) {
            this.shipScale = 0.25;
            const easedT = t * 2;
            const progress = 1 - (1 - easedT) * (1 - easedT);
            this.stretchFactor = 10 - progress * 9;
            this._scratchRadialOut.set(this.jumpEndPosition).normalizeInPlace();
            this._scratchRadialIn.set(this._scratchRadialOut).multiplyInPlace(-1);

            const maxDistance = 5000;
            this._scratchVelocityDelta.set(this._scratchRadialOut).multiplyInPlace(maxDistance)
                .addInPlace(this.jumpEndPosition);
            this.position.lerpInPlace(this._scratchVelocityDelta, this.jumpEndPosition, progress);
            const desiredAngle = Math.atan2(this._scratchRadialIn.x, -this._scratchRadialIn.y);
            const startAngle = this.jumpStartAngle || this.angle;
            if (!this.jumpStartAngle) this.jumpStartAngle = this.angle;
            const angleDiff = normalizeAngle(desiredAngle - startAngle);
            this.angle = startAngle + angleDiff * easedT;
            this.targetAngle = this.angle;
            this.velocity.set(this._scratchRadialIn).multiplyInPlace(2000 * (1 - easedT));
        } else {
            this.shipScale = 0.25 + (t - 0.5) * 1.5;
            this.stretchFactor = 1;
            this.position.set(this.jumpEndPosition);
            this.velocity.set(0, 0);
        }

        if (t >= 1) {
            this.setState('Flying');
            this.shipScale = 1;
            this.stretchFactor = 1;
            this.jumpGate = null;
            this.jumpStartPosition.set(0, 0);
            this.jumpEndPosition.set(0, 0);
            this.jumpStartAngle = null;
            this.hyperdriveReady = false;
            setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
        }
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);

        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);

        // Default drawing (to be overridden by subclasses)
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(10, 10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();

        if ((this.isThrusting && this.state === 'Flying') || this.state === 'Landing' || this.state === 'TakingOff') {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            ctx.beginPath();
            ctx.moveTo(0, 15);
            ctx.lineTo(5, 10);
            ctx.lineTo(-5, 10);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }

    drawEngines(ctx, camera, scale) {
        // Relies on draw to setup scale and rotation
        // Draw thrust effect if applicable
        if ((this.isThrusting && this.state === 'Flying') || this.state === 'Landing' || this.state === 'TakingOff') {

            ctx.fillStyle = new Colour(1, 0, 0, 0.5).toRGBA();
            ctx.beginPath();
            for (let i = 0; i < this.featurePoints.engines.length; i++) {
                const engine = this.featurePoints.engines[i];
                ctx.moveTo(engine.x - engine.radius, engine.y);
                ctx.lineTo(engine.x + engine.radius, engine.y);
                ctx.lineTo(engine.x, engine.y + engine.radius * 15 + (Math.random() * engine.radius * 5));
                ctx.closePath();
            }
            ctx.fill();

            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            ctx.beginPath();
            for (let i = 0; i < this.featurePoints.engines.length; i++) {
                const engine = this.featurePoints.engines[i];
                ctx.moveTo(engine.x - engine.radius * 0.5, engine.y);
                ctx.lineTo(engine.x + engine.radius * 0.5, engine.y);
                ctx.lineTo(engine.x, engine.y + engine.radius * 9 + (Math.random() * engine.radius * 2));
                ctx.closePath();
            }
            ctx.fill();

            ctx.fillStyle = new Colour(1, 1, 1).toRGB();
            ctx.beginPath();
            for (let i = 0; i < this.featurePoints.engines.length; i++) {
                const engine = this.featurePoints.engines[i];
                ctx.moveTo(engine.x - engine.radius * 0.25, engine.y);
                ctx.lineTo(engine.x + engine.radius * 0.25, engine.y);
                ctx.lineTo(engine.x, engine.y + engine.radius * 4.5 + (Math.random() * engine.radius * 2));
                ctx.closePath();
            }
            ctx.fill();
        }
    }

    drawTurrets(ctx, camera, scale) {
        // Relies on draw to setup scale and rotation
        ctx.fillStyle = new Colour(0, 0, 1).toRGB();
        ctx.beginPath();
        for (let i = 0; i < this.featurePoints.turrets.length; i++) {
            const turret = this.featurePoints.turrets[i];
            ctx.moveTo(turret.x, turret.y);
            ctx.arc(turret.x, turret.y, turret.radius, 0, TWO_PI);
            ctx.closePath();
        }
        ctx.fill();
    }

    drawDebug(ctx, camera, scale) {
        if (!this.debug || !camera.debug) return;

        this._scratchVelocityEnd.set(this.velocity)
            .multiplyInPlace(1)
            .addInPlace(this.position);
        camera.worldToScreen(this._scratchVelocityEnd, this._scratchVelocityEnd);
        ctx.strokeStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.lineTo(this._scratchVelocityEnd.x, this._scratchVelocityEnd.y);
        ctx.stroke();

        ctx.save();
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle - Math.PI * 0.5);
        const angleDiff = normalizeAngle(this.targetAngle - this.angle);
        ctx.fillStyle = 'rgba(255,0,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 30 * scale, 0, angleDiff, angleDiff < 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        if (this.pilot) {
            const state = this.pilot.getState();
            ctx.fillStyle = 'white';
            ctx.font = `${10 * scale}px Arial`;
            const textMetrics = ctx.measureText(state);
            const textX = this._scratchScreenPos.x - textMetrics.width / 2;
            const textY = this._scratchScreenPos.y + 20 * scale;
            ctx.fillText(state, textX, textY);
        }

        const currentSpeed = this.velocity.magnitude();
        this._scratchStoppingPoint.set(this.velocity)
            .normalizeInPlace()
            .multiplyInPlace(currentSpeed > 0 ? this.decelerationDistance : 0)
            .addInPlace(this.position);
        camera.worldToScreen(this._scratchStoppingPoint, this._scratchStoppingPoint);

        ctx.strokeStyle = 'gray';
        ctx.beginPath();
        ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.lineTo(this._scratchStoppingPoint.x, this._scratchStoppingPoint.y);
        ctx.stroke();

        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(this._scratchStoppingPoint.x, this._scratchStoppingPoint.y, 1 * scale, 0, TWO_PI);
        ctx.fill();

        if (this.target && this.target.position) {
            camera.worldToScreen(this.target.position, this._scratchRadialOut);
            if (this.farApproachDistance > 0) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(0,255,0,0.1)';
                ctx.arc(this._scratchRadialOut.x, this._scratchRadialOut.y, this.farApproachDistance * scale, 0, TWO_PI, false);
                if (this.closeApproachDistance > 0) {
                    ctx.arc(this._scratchRadialOut.x, this._scratchRadialOut.y, this.closeApproachDistance * scale, 0, TWO_PI, true);
                }
                ctx.fill();
                if (this.closeApproachDistance > 0) {
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(255,255,0,0.2)';
                    ctx.arc(this._scratchRadialOut.x, this._scratchRadialOut.y, this.closeApproachDistance * scale, 0, TWO_PI);
                    ctx.fill();
                }
            }
        }

        if (this.pilot) {
            this._scratchRadialIn.set(this.position).addInPlace(this.velocityError);
            camera.worldToScreen(this._scratchRadialIn, this._scratchRadialIn);
            ctx.strokeStyle = 'green';
            ctx.beginPath();
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.lineTo(this._scratchRadialIn.x, this._scratchRadialIn.y);
            ctx.stroke();
        }
    }
}
export class Flivver extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 2.5;
        this.thrust = 800;
        this.maxVelocity = 700;
        // Bounding box: width = 36 (from -18 to 18), height = 36 (from -20 to 16)
        this.boundingBox.set(36, 36);

        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: -6.00, y: 13.50, radius: 1.00 },
                { x: 6.00, y: 13.50, radius: 1.00 },
                { x: 0.00, y: 13.50, radius: 2.00 },
            ],
            turrets: [
            ]
        };
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);

        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, 0.50);
        ctx.lineTo(2.00, 2.50);
        ctx.lineTo(3.00, 6.50);
        ctx.lineTo(3.00, 9.50);
        ctx.lineTo(2.00, 11.50);
        ctx.lineTo(-2.00, 11.50);
        ctx.lineTo(-3.00, 9.50);
        ctx.lineTo(-3.00, 6.50);
        ctx.lineTo(-2.00, 2.50);
        ctx.closePath();
        ctx.moveTo(-2.00, -15.50);
        ctx.lineTo(-2.00, -7.50);
        ctx.lineTo(-4.00, -5.50);
        ctx.lineTo(-5.00, 6.50);
        ctx.lineTo(-5.00, 9.50);
        ctx.lineTo(-4.00, 11.50);
        ctx.lineTo(-4.00, 12.50);
        ctx.lineTo(-8.00, 12.50);
        ctx.lineTo(-8.00, 4.50);
        ctx.closePath();
        ctx.moveTo(-3.00, -6.50);
        ctx.lineTo(-3.00, 6.50);
        ctx.lineTo(-3.00, 9.50);
        ctx.lineTo(-4.00, 11.50);
        ctx.lineTo(-5.00, 9.50);
        ctx.lineTo(-5.00, 6.50);
        ctx.lineTo(-4.00, -5.50);
        ctx.closePath();
        ctx.moveTo(-8.00, 12.50);
        ctx.lineTo(-4.00, 12.50);
        ctx.lineTo(-5.00, 13.50);
        ctx.lineTo(-7.00, 13.50);
        ctx.closePath();
        ctx.moveTo(2.00, -15.50);
        ctx.lineTo(2.00, -7.50);
        ctx.lineTo(4.00, -5.50);
        ctx.lineTo(5.00, 6.50);
        ctx.lineTo(5.00, 9.50);
        ctx.lineTo(4.00, 11.50);
        ctx.lineTo(4.00, 12.50);
        ctx.lineTo(8.00, 12.50);
        ctx.lineTo(8.00, 4.50);
        ctx.closePath();
        ctx.moveTo(3.00, -6.50);
        ctx.lineTo(3.00, 6.50);
        ctx.lineTo(3.00, 9.50);
        ctx.lineTo(4.00, 11.50);
        ctx.lineTo(5.00, 9.50);
        ctx.lineTo(5.00, 6.50);
        ctx.lineTo(4.00, -5.50);
        ctx.closePath();
        ctx.moveTo(8.00, 12.50);
        ctx.lineTo(4.00, 12.50);
        ctx.lineTo(5.00, 13.50);
        ctx.lineTo(7.00, 13.50);
        ctx.closePath();
        ctx.moveTo(-2.00, 11.50);
        ctx.lineTo(-2.00, 13.50);
        ctx.lineTo(2.00, 13.50);
        ctx.lineTo(2.00, 11.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, 3.50);
        ctx.lineTo(1.00, 3.50);
        ctx.lineTo(2.00, 6.50);
        ctx.lineTo(2.00, 7.50);
        ctx.lineTo(1.00, 8.50);
        ctx.lineTo(-1.00, 8.50);
        ctx.lineTo(-2.00, 7.50);
        ctx.lineTo(-2.00, 6.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(-8.00, 4.50);
        ctx.lineTo(-18.00, 12.50);
        ctx.lineTo(-18.00, 14.50);
        ctx.lineTo(-8.00, 12.50);
        ctx.closePath();
        ctx.moveTo(-4.00, 4.50);
        ctx.lineTo(-6.00, 9.50);
        ctx.lineTo(-6.00, 11.50);
        ctx.lineTo(-4.00, 9.50);
        ctx.closePath();
        ctx.moveTo(8.00, 4.50);
        ctx.lineTo(18.00, 12.50);
        ctx.lineTo(18.00, 14.50);
        ctx.lineTo(8.00, 12.50);
        ctx.closePath();
        ctx.moveTo(4.00, 4.50);
        ctx.lineTo(6.00, 9.50);
        ctx.lineTo(6.00, 11.50);
        ctx.lineTo(4.00, 9.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawEngines(ctx, camera, scale);
        this.drawTurrets(ctx, camera, scale);

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }


}

export class Shuttle extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 1.2;
        this.thrust = 200;
        this.maxVelocity = 400;
        // Bounding box: width = 16 (from -8 to 8), height = 41 (from -20.5 to 20.5)
        this.boundingBox.set(16, 41);

        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 12.00, radius: 2.00 },
            ],
            turrets: [
            ]
        };
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);

        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -14.00);
        ctx.lineTo(2.00, -13.00);
        ctx.lineTo(3.00, -11.00);
        ctx.lineTo(3.00, -7.00);
        ctx.lineTo(2.00, -6.00);
        ctx.lineTo(-2.00, -6.00);
        ctx.lineTo(-3.00, -7.00);
        ctx.lineTo(-3.00, -11.00);
        ctx.lineTo(-2.00, -13.00);
        ctx.closePath();
        ctx.moveTo(2.00, -6.00);
        ctx.lineTo(5.00, -5.00);
        ctx.lineTo(6.00, 1.00);
        ctx.lineTo(6.00, 10.00);
        ctx.lineTo(4.00, 11.00);
        ctx.lineTo(-4.00, 11.00);
        ctx.lineTo(-6.00, 10.00);
        ctx.lineTo(-6.00, 1.00);
        ctx.lineTo(-5.00, -5.00);
        ctx.lineTo(-2.00, -6.00);
        ctx.closePath();
        ctx.moveTo(3.00, 11.00);
        ctx.lineTo(2.00, 12.00);
        ctx.lineTo(-2.00, 12.00);
        ctx.lineTo(-3.00, 11.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -12.00);
        ctx.lineTo(1.00, -12.00);
        ctx.lineTo(2.00, -8.00);
        ctx.lineTo(-2.00, -8.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(3.00, -11.00);
        ctx.lineTo(4.00, -9.00);
        ctx.lineTo(4.00, -8.00);
        ctx.lineTo(3.00, -9.00);
        ctx.closePath();
        ctx.moveTo(-3.00, -11.00);
        ctx.lineTo(-3.00, -9.00);
        ctx.lineTo(-4.00, -8.00);
        ctx.lineTo(-4.00, -9.00);
        ctx.closePath();
        ctx.moveTo(6.00, 1.00);
        ctx.lineTo(8.00, 5.00);
        ctx.lineTo(8.00, 10.00);
        ctx.lineTo(6.00, 10.00);
        ctx.closePath();
        ctx.moveTo(-6.00, 1.00);
        ctx.lineTo(-8.00, 5.00);
        ctx.lineTo(-8.00, 10.00);
        ctx.lineTo(-6.00, 10.00);
        ctx.closePath();
        ctx.moveTo(0.00, 1.00);
        ctx.lineTo(1.00, 10.00);
        ctx.lineTo(-1.00, 10.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawEngines(ctx, camera, scale);
        this.drawTurrets(ctx, camera, scale);

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }
}

export class HeavyShuttle extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 1.1;
        this.thrust = 150;
        this.maxVelocity = 350;
        // Bounding box: width = 16 (from -8 to 8), height = 48 (from -24 to 24)
        this.boundingBox.set(16, 48);

        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 15.50, radius: 2.00 },
            ],
            turrets: [
            ]
        };
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);

        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -17.50);
        ctx.lineTo(3.00, -16.50);
        ctx.lineTo(4.00, -12.50);
        ctx.lineTo(4.00, -6.50);
        ctx.lineTo(3.00, -5.50);
        ctx.lineTo(-3.00, -5.50);
        ctx.lineTo(-4.00, -6.50);
        ctx.lineTo(-4.00, -12.50);
        ctx.lineTo(-3.00, -16.50);
        ctx.closePath();
        ctx.moveTo(3.00, -5.50);
        ctx.lineTo(5.00, -4.50);
        ctx.lineTo(6.00, -1.50);
        ctx.lineTo(6.00, 12.50);
        ctx.lineTo(4.00, 14.50);
        ctx.lineTo(-4.00, 14.50);
        ctx.lineTo(-6.00, 12.50);
        ctx.lineTo(-6.00, -1.50);
        ctx.lineTo(-5.00, -4.50);
        ctx.lineTo(-3.00, -5.50);
        ctx.closePath();
        ctx.moveTo(3.00, 14.50);
        ctx.lineTo(2.00, 15.50);
        ctx.lineTo(-2.00, 15.50);
        ctx.lineTo(-3.00, 14.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -15.50);
        ctx.lineTo(1.00, -15.50);
        ctx.lineTo(2.00, -11.50);
        ctx.lineTo(2.00, -9.50);
        ctx.lineTo(1.00, -8.50);
        ctx.lineTo(-1.00, -8.50);
        ctx.lineTo(-2.00, -9.50);
        ctx.lineTo(-2.00, -11.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(4.00, -12.50);
        ctx.lineTo(5.00, -10.50);
        ctx.lineTo(5.00, -7.50);
        ctx.lineTo(4.00, -8.50);
        ctx.closePath();
        ctx.moveTo(-4.00, -12.50);
        ctx.lineTo(-4.00, -8.50);
        ctx.lineTo(-5.00, -7.50);
        ctx.lineTo(-5.00, -10.50);
        ctx.closePath();
        ctx.moveTo(6.00, 1.50);
        ctx.lineTo(8.00, 5.50);
        ctx.lineTo(8.00, 13.50);
        ctx.lineTo(6.00, 12.50);
        ctx.closePath();
        ctx.moveTo(-6.00, 1.50);
        ctx.lineTo(-8.00, 5.50);
        ctx.lineTo(-8.00, 13.50);
        ctx.lineTo(-6.00, 12.50);
        ctx.closePath();
        ctx.moveTo(0.00, 1.50);
        ctx.lineTo(1.00, 13.50);
        ctx.lineTo(-1.00, 13.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawEngines(ctx, camera, scale);
        this.drawTurrets(ctx, camera, scale);

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }


}

export class StarBarge extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.5;
        this.thrust = 25;
        this.maxVelocity = 100;
        // Bounding box: width = 32 (from -16 to 16), height = 55 (from -27.5 to 27.5)
        this.boundingBox.set(32, 55);
        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 19.00, radius: 2.00 },
            ],
            turrets: [
                { x: 0.00, y: -2.00, radius: 2.00 },
            ]
        };
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);

        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -21.00);
        ctx.lineTo(3.00, -20.00);
        ctx.lineTo(4.00, -16.00);
        ctx.lineTo(4.00, -11.00);
        ctx.lineTo(3.00, -10.00);
        ctx.lineTo(-3.00, -10.00);
        ctx.lineTo(-4.00, -11.00);
        ctx.lineTo(-4.00, -16.00);
        ctx.lineTo(-3.00, -20.00);
        ctx.closePath();
        ctx.moveTo(3.00, 18.00);
        ctx.lineTo(2.00, 19.00);
        ctx.lineTo(-2.00, 19.00);
        ctx.lineTo(-3.00, 18.00);
        ctx.closePath();
        ctx.moveTo(2.00, 16.00);
        ctx.lineTo(1.00, 15.00);
        ctx.lineTo(1.00, -7.00);
        ctx.lineTo(2.00, -8.00);
        ctx.lineTo(8.00, -8.00);
        ctx.lineTo(7.00, -7.00);
        ctx.lineTo(7.00, 15.00);
        ctx.lineTo(8.00, 16.00);
        ctx.closePath();
        ctx.moveTo(8.00, -8.00);
        ctx.lineTo(7.00, -7.00);
        ctx.lineTo(7.00, 15.00);
        ctx.lineTo(8.00, 16.00);
        ctx.lineTo(12.00, 16.00);
        ctx.lineTo(13.00, 15.00);
        ctx.lineTo(13.00, -7.00);
        ctx.lineTo(12.00, -8.00);
        ctx.closePath();
        ctx.moveTo(9.00, 5.00);
        ctx.lineTo(8.00, 6.00);
        ctx.lineTo(8.00, 14.00);
        ctx.lineTo(9.00, 15.00);
        ctx.lineTo(11.00, 15.00);
        ctx.lineTo(12.00, 14.00);
        ctx.lineTo(12.00, 6.00);
        ctx.lineTo(11.00, 5.00);
        ctx.closePath();
        ctx.moveTo(9.00, -7.00);
        ctx.lineTo(8.00, -6.00);
        ctx.lineTo(8.00, 2.00);
        ctx.lineTo(9.00, 3.00);
        ctx.lineTo(11.00, 3.00);
        ctx.lineTo(12.00, 2.00);
        ctx.lineTo(12.00, -6.00);
        ctx.lineTo(11.00, -7.00);
        ctx.closePath();
        ctx.moveTo(-2.00, 16.00);
        ctx.lineTo(-1.00, 15.00);
        ctx.lineTo(-1.00, -7.00);
        ctx.lineTo(-2.00, -8.00);
        ctx.lineTo(-8.00, -8.00);
        ctx.lineTo(-7.00, -7.00);
        ctx.lineTo(-7.00, 15.00);
        ctx.lineTo(-8.00, 16.00);
        ctx.closePath();
        ctx.moveTo(-8.00, -8.00);
        ctx.lineTo(-7.00, -7.00);
        ctx.lineTo(-7.00, 15.00);
        ctx.lineTo(-8.00, 16.00);
        ctx.lineTo(-12.00, 16.00);
        ctx.lineTo(-13.00, 15.00);
        ctx.lineTo(-13.00, -7.00);
        ctx.lineTo(-12.00, -8.00);
        ctx.closePath();
        ctx.moveTo(-9.00, 5.00);
        ctx.lineTo(-8.00, 6.00);
        ctx.lineTo(-8.00, 14.00);
        ctx.lineTo(-9.00, 15.00);
        ctx.lineTo(-11.00, 15.00);
        ctx.lineTo(-12.00, 14.00);
        ctx.lineTo(-12.00, 6.00);
        ctx.lineTo(-11.00, 5.00);
        ctx.closePath();
        ctx.moveTo(-9.00, -7.00);
        ctx.lineTo(-8.00, -6.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-9.00, 3.00);
        ctx.lineTo(-11.00, 3.00);
        ctx.lineTo(-12.00, 2.00);
        ctx.lineTo(-12.00, -6.00);
        ctx.lineTo(-11.00, -7.00);
        ctx.closePath();
        ctx.moveTo(-3.00, -10.00);
        ctx.lineTo(3.00, -10.00);
        ctx.lineTo(8.00, -8.00);
        ctx.lineTo(2.00, -8.00);
        ctx.lineTo(1.00, -7.00);
        ctx.lineTo(1.00, 15.00);
        ctx.lineTo(2.00, 16.00);
        ctx.lineTo(8.00, 16.00);
        ctx.lineTo(3.00, 18.00);
        ctx.lineTo(-3.00, 18.00);
        ctx.lineTo(-8.00, 16.00);
        ctx.lineTo(-2.00, 16.00);
        ctx.lineTo(-1.00, 15.00);
        ctx.lineTo(-1.00, -7.00);
        ctx.lineTo(-2.00, -8.00);
        ctx.lineTo(-8.00, -8.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -19.00);
        ctx.lineTo(1.00, -19.00);
        ctx.lineTo(2.00, -15.00);
        ctx.lineTo(2.00, -13.00);
        ctx.lineTo(1.00, -12.00);
        ctx.lineTo(-1.00, -12.00);
        ctx.lineTo(-2.00, -13.00);
        ctx.lineTo(-2.00, -15.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(13.00, 2.00);
        ctx.lineTo(16.00, 8.00);
        ctx.lineTo(16.00, 14.00);
        ctx.lineTo(13.00, 13.00);
        ctx.closePath();
        ctx.moveTo(0.00, 5.00);
        ctx.lineTo(1.00, 17.00);
        ctx.lineTo(-1.00, 17.00);
        ctx.closePath();
        ctx.moveTo(-13.00, 2.00);
        ctx.lineTo(-16.00, 8.00);
        ctx.lineTo(-16.00, 14.00);
        ctx.lineTo(-13.00, 13.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawEngines(ctx, camera, scale);
        this.drawTurrets(ctx, camera, scale);

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }



}

export class Freighter extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.25;
        this.thrust = 25;
        this.maxVelocity = 100;
        // Bounding box: width = 40 (from -20 to 20), height = 141 (from -70.5 to 70.5)
        this.boundingBox.set(40, 141);

        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: -6.00, y: 62.00, radius: 2.00 },
                { x: 6.00, y: 62.00, radius: 2.00 },
            ],
            turrets: [
                { x: -0.07, y: -35.00, radius: 2.13 },
                { x: 0.00, y: 40.00, radius: 2.00 },
            ]
        };
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);

        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: -6.00, y: 62.00, radius: 2.00 },
                { x: 6.00, y: 62.00, radius: 2.00 },
            ],
            turrets: [
                { x: -0.07, y: -35.00, radius: 2.13 },
                { x: 0.00, y: 40.00, radius: 2.00 },
            ]
        };

        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, 50.00);
        ctx.lineTo(2.00, 52.00);
        ctx.lineTo(12.00, 52.00);
        ctx.lineTo(11.00, 55.00);
        ctx.lineTo(1.00, 57.00);
        ctx.lineTo(-1.00, 57.00);
        ctx.lineTo(-11.00, 55.00);
        ctx.lineTo(-12.00, 52.00);
        ctx.lineTo(-2.00, 52.00);
        ctx.closePath();
        ctx.moveTo(0.00, -64.00);
        ctx.lineTo(3.00, -63.00);
        ctx.lineTo(4.00, -59.00);
        ctx.lineTo(4.00, -52.00);
        ctx.lineTo(3.00, -51.00);
        ctx.lineTo(-3.00, -51.00);
        ctx.lineTo(-4.00, -52.00);
        ctx.lineTo(-4.00, -59.00);
        ctx.lineTo(-3.00, -63.00);
        ctx.closePath();
        ctx.moveTo(9.00, 62.00);
        ctx.lineTo(11.00, 60.00);
        ctx.lineTo(11.00, 55.00);
        ctx.lineTo(1.00, 57.00);
        ctx.lineTo(1.00, 60.00);
        ctx.lineTo(3.00, 62.00);
        ctx.closePath();
        ctx.moveTo(-3.00, 62.00);
        ctx.lineTo(-1.00, 60.00);
        ctx.lineTo(-1.00, 57.00);
        ctx.lineTo(-11.00, 55.00);
        ctx.lineTo(-11.00, 60.00);
        ctx.lineTo(-9.00, 62.00);
        ctx.closePath();
        ctx.moveTo(-2.00, -47.00);
        ctx.lineTo(-1.00, -46.00);
        ctx.lineTo(-1.00, -24.00);
        ctx.lineTo(-2.00, -23.00);
        ctx.lineTo(-8.00, -23.00);
        ctx.lineTo(-7.00, -24.00);
        ctx.lineTo(-7.00, -46.00);
        ctx.lineTo(-8.00, -47.00);
        ctx.closePath();
        ctx.moveTo(-8.00, -23.00);
        ctx.lineTo(-7.00, -24.00);
        ctx.lineTo(-7.00, -46.00);
        ctx.lineTo(-8.00, -47.00);
        ctx.lineTo(-12.00, -47.00);
        ctx.lineTo(-13.00, -46.00);
        ctx.lineTo(-13.00, -24.00);
        ctx.lineTo(-12.00, -23.00);
        ctx.closePath();
        ctx.moveTo(-9.00, -36.00);
        ctx.lineTo(-8.00, -37.00);
        ctx.lineTo(-8.00, -45.00);
        ctx.lineTo(-9.00, -46.00);
        ctx.lineTo(-11.00, -46.00);
        ctx.lineTo(-12.00, -45.00);
        ctx.lineTo(-12.00, -37.00);
        ctx.lineTo(-11.00, -36.00);
        ctx.closePath();
        ctx.moveTo(-9.00, -24.00);
        ctx.lineTo(-8.00, -25.00);
        ctx.lineTo(-8.00, -33.00);
        ctx.lineTo(-9.00, -34.00);
        ctx.lineTo(-11.00, -34.00);
        ctx.lineTo(-12.00, -33.00);
        ctx.lineTo(-12.00, -25.00);
        ctx.lineTo(-11.00, -24.00);
        ctx.closePath();
        ctx.moveTo(2.00, -23.00);
        ctx.lineTo(1.00, -24.00);
        ctx.lineTo(1.00, -46.00);
        ctx.lineTo(2.00, -47.00);
        ctx.lineTo(8.00, -47.00);
        ctx.lineTo(7.00, -46.00);
        ctx.lineTo(7.00, -24.00);
        ctx.lineTo(8.00, -23.00);
        ctx.closePath();
        ctx.moveTo(8.00, -47.00);
        ctx.lineTo(7.00, -46.00);
        ctx.lineTo(7.00, -24.00);
        ctx.lineTo(8.00, -23.00);
        ctx.lineTo(12.00, -23.00);
        ctx.lineTo(13.00, -24.00);
        ctx.lineTo(13.00, -46.00);
        ctx.lineTo(12.00, -47.00);
        ctx.closePath();
        ctx.moveTo(9.00, -34.00);
        ctx.lineTo(8.00, -33.00);
        ctx.lineTo(8.00, -25.00);
        ctx.lineTo(9.00, -24.00);
        ctx.lineTo(11.00, -24.00);
        ctx.lineTo(12.00, -25.00);
        ctx.lineTo(12.00, -33.00);
        ctx.lineTo(11.00, -34.00);
        ctx.closePath();
        ctx.moveTo(9.00, -46.00);
        ctx.lineTo(8.00, -45.00);
        ctx.lineTo(8.00, -37.00);
        ctx.lineTo(9.00, -36.00);
        ctx.lineTo(11.00, -36.00);
        ctx.lineTo(12.00, -37.00);
        ctx.lineTo(12.00, -45.00);
        ctx.lineTo(11.00, -46.00);
        ctx.closePath();
        ctx.moveTo(2.00, 2.00);
        ctx.lineTo(1.00, 1.00);
        ctx.lineTo(1.00, -21.00);
        ctx.lineTo(2.00, -22.00);
        ctx.lineTo(8.00, -22.00);
        ctx.lineTo(7.00, -21.00);
        ctx.lineTo(7.00, 1.00);
        ctx.lineTo(8.00, 2.00);
        ctx.closePath();
        ctx.moveTo(8.00, -22.00);
        ctx.lineTo(7.00, -21.00);
        ctx.lineTo(7.00, 1.00);
        ctx.lineTo(8.00, 2.00);
        ctx.lineTo(12.00, 2.00);
        ctx.lineTo(13.00, 1.00);
        ctx.lineTo(13.00, -21.00);
        ctx.lineTo(12.00, -22.00);
        ctx.closePath();
        ctx.moveTo(9.00, -9.00);
        ctx.lineTo(8.00, -8.00);
        ctx.lineTo(8.00, 0.00);
        ctx.lineTo(9.00, 1.00);
        ctx.lineTo(11.00, 1.00);
        ctx.lineTo(12.00, 0.00);
        ctx.lineTo(12.00, -8.00);
        ctx.lineTo(11.00, -9.00);
        ctx.closePath();
        ctx.moveTo(9.00, -21.00);
        ctx.lineTo(8.00, -20.00);
        ctx.lineTo(8.00, -12.00);
        ctx.lineTo(9.00, -11.00);
        ctx.lineTo(11.00, -11.00);
        ctx.lineTo(12.00, -12.00);
        ctx.lineTo(12.00, -20.00);
        ctx.lineTo(11.00, -21.00);
        ctx.closePath();
        ctx.moveTo(-2.00, -22.00);
        ctx.lineTo(-1.00, -21.00);
        ctx.lineTo(-1.00, 1.00);
        ctx.lineTo(-2.00, 2.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-7.00, 1.00);
        ctx.lineTo(-7.00, -21.00);
        ctx.lineTo(-8.00, -22.00);
        ctx.closePath();
        ctx.moveTo(-8.00, 2.00);
        ctx.lineTo(-7.00, 1.00);
        ctx.lineTo(-7.00, -21.00);
        ctx.lineTo(-8.00, -22.00);
        ctx.lineTo(-12.00, -22.00);
        ctx.lineTo(-13.00, -21.00);
        ctx.lineTo(-13.00, 1.00);
        ctx.lineTo(-12.00, 2.00);
        ctx.closePath();
        ctx.moveTo(-9.00, -11.00);
        ctx.lineTo(-8.00, -12.00);
        ctx.lineTo(-8.00, -20.00);
        ctx.lineTo(-9.00, -21.00);
        ctx.lineTo(-11.00, -21.00);
        ctx.lineTo(-12.00, -20.00);
        ctx.lineTo(-12.00, -12.00);
        ctx.lineTo(-11.00, -11.00);
        ctx.closePath();
        ctx.moveTo(-9.00, 1.00);
        ctx.lineTo(-8.00, 0.00);
        ctx.lineTo(-8.00, -8.00);
        ctx.lineTo(-9.00, -9.00);
        ctx.lineTo(-11.00, -9.00);
        ctx.lineTo(-12.00, -8.00);
        ctx.lineTo(-12.00, 0.00);
        ctx.lineTo(-11.00, 1.00);
        ctx.closePath();
        ctx.moveTo(-2.00, 3.00);
        ctx.lineTo(-1.00, 4.00);
        ctx.lineTo(-1.00, 26.00);
        ctx.lineTo(-2.00, 27.00);
        ctx.lineTo(-8.00, 27.00);
        ctx.lineTo(-7.00, 26.00);
        ctx.lineTo(-7.00, 4.00);
        ctx.lineTo(-8.00, 3.00);
        ctx.closePath();
        ctx.moveTo(-8.00, 27.00);
        ctx.lineTo(-7.00, 26.00);
        ctx.lineTo(-7.00, 4.00);
        ctx.lineTo(-8.00, 3.00);
        ctx.lineTo(-12.00, 3.00);
        ctx.lineTo(-13.00, 4.00);
        ctx.lineTo(-13.00, 26.00);
        ctx.lineTo(-12.00, 27.00);
        ctx.closePath();
        ctx.moveTo(-9.00, 14.00);
        ctx.lineTo(-8.00, 13.00);
        ctx.lineTo(-8.00, 5.00);
        ctx.lineTo(-9.00, 4.00);
        ctx.lineTo(-11.00, 4.00);
        ctx.lineTo(-12.00, 5.00);
        ctx.lineTo(-12.00, 13.00);
        ctx.lineTo(-11.00, 14.00);
        ctx.closePath();
        ctx.moveTo(-9.00, 26.00);
        ctx.lineTo(-8.00, 25.00);
        ctx.lineTo(-8.00, 17.00);
        ctx.lineTo(-9.00, 16.00);
        ctx.lineTo(-11.00, 16.00);
        ctx.lineTo(-12.00, 17.00);
        ctx.lineTo(-12.00, 25.00);
        ctx.lineTo(-11.00, 26.00);
        ctx.closePath();
        ctx.moveTo(2.00, 27.00);
        ctx.lineTo(1.00, 26.00);
        ctx.lineTo(1.00, 4.00);
        ctx.lineTo(2.00, 3.00);
        ctx.lineTo(8.00, 3.00);
        ctx.lineTo(7.00, 4.00);
        ctx.lineTo(7.00, 26.00);
        ctx.lineTo(8.00, 27.00);
        ctx.closePath();
        ctx.moveTo(8.00, 3.00);
        ctx.lineTo(7.00, 4.00);
        ctx.lineTo(7.00, 26.00);
        ctx.lineTo(8.00, 27.00);
        ctx.lineTo(12.00, 27.00);
        ctx.lineTo(13.00, 26.00);
        ctx.lineTo(13.00, 4.00);
        ctx.lineTo(12.00, 3.00);
        ctx.closePath();
        ctx.moveTo(9.00, 16.00);
        ctx.lineTo(8.00, 17.00);
        ctx.lineTo(8.00, 25.00);
        ctx.lineTo(9.00, 26.00);
        ctx.lineTo(11.00, 26.00);
        ctx.lineTo(12.00, 25.00);
        ctx.lineTo(12.00, 17.00);
        ctx.lineTo(11.00, 16.00);
        ctx.closePath();
        ctx.moveTo(9.00, 4.00);
        ctx.lineTo(8.00, 5.00);
        ctx.lineTo(8.00, 13.00);
        ctx.lineTo(9.00, 14.00);
        ctx.lineTo(11.00, 14.00);
        ctx.lineTo(12.00, 13.00);
        ctx.lineTo(12.00, 5.00);
        ctx.lineTo(11.00, 4.00);
        ctx.closePath();
        ctx.moveTo(-2.00, 28.00);
        ctx.lineTo(-1.00, 29.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.lineTo(-2.00, 52.00);
        ctx.lineTo(-8.00, 52.00);
        ctx.lineTo(-7.00, 51.00);
        ctx.lineTo(-7.00, 29.00);
        ctx.lineTo(-8.00, 28.00);
        ctx.closePath();
        ctx.moveTo(-8.00, 52.00);
        ctx.lineTo(-7.00, 51.00);
        ctx.lineTo(-7.00, 29.00);
        ctx.lineTo(-8.00, 28.00);
        ctx.lineTo(-12.00, 28.00);
        ctx.lineTo(-13.00, 29.00);
        ctx.lineTo(-13.00, 51.00);
        ctx.lineTo(-12.00, 52.00);
        ctx.closePath();
        ctx.moveTo(-9.00, 39.00);
        ctx.lineTo(-8.00, 38.00);
        ctx.lineTo(-8.00, 30.00);
        ctx.lineTo(-9.00, 29.00);
        ctx.lineTo(-11.00, 29.00);
        ctx.lineTo(-12.00, 30.00);
        ctx.lineTo(-12.00, 38.00);
        ctx.lineTo(-11.00, 39.00);
        ctx.closePath();
        ctx.moveTo(-9.00, 51.00);
        ctx.lineTo(-8.00, 50.00);
        ctx.lineTo(-8.00, 42.00);
        ctx.lineTo(-9.00, 41.00);
        ctx.lineTo(-11.00, 41.00);
        ctx.lineTo(-12.00, 42.00);
        ctx.lineTo(-12.00, 50.00);
        ctx.lineTo(-11.00, 51.00);
        ctx.closePath();
        ctx.moveTo(2.00, 52.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(1.00, 29.00);
        ctx.lineTo(2.00, 28.00);
        ctx.lineTo(8.00, 28.00);
        ctx.lineTo(7.00, 29.00);
        ctx.lineTo(7.00, 51.00);
        ctx.lineTo(8.00, 52.00);
        ctx.closePath();
        ctx.moveTo(8.00, 28.00);
        ctx.lineTo(7.00, 29.00);
        ctx.lineTo(7.00, 51.00);
        ctx.lineTo(8.00, 52.00);
        ctx.lineTo(12.00, 52.00);
        ctx.lineTo(13.00, 51.00);
        ctx.lineTo(13.00, 29.00);
        ctx.lineTo(12.00, 28.00);
        ctx.closePath();
        ctx.moveTo(9.00, 41.00);
        ctx.lineTo(8.00, 42.00);
        ctx.lineTo(8.00, 50.00);
        ctx.lineTo(9.00, 51.00);
        ctx.lineTo(11.00, 51.00);
        ctx.lineTo(12.00, 50.00);
        ctx.lineTo(12.00, 42.00);
        ctx.lineTo(11.00, 41.00);
        ctx.closePath();
        ctx.moveTo(9.00, 29.00);
        ctx.lineTo(8.00, 30.00);
        ctx.lineTo(8.00, 38.00);
        ctx.lineTo(9.00, 39.00);
        ctx.lineTo(11.00, 39.00);
        ctx.lineTo(12.00, 38.00);
        ctx.lineTo(12.00, 30.00);
        ctx.lineTo(11.00, 29.00);
        ctx.closePath();
        ctx.moveTo(-3.00, -51.00);
        ctx.lineTo(3.00, -51.00);
        ctx.lineTo(8.00, -47.00);
        ctx.lineTo(2.00, -47.00);
        ctx.lineTo(1.00, -46.00);
        ctx.lineTo(1.00, -24.00);
        ctx.lineTo(2.00, -23.00);
        ctx.lineTo(8.00, -23.00);
        ctx.lineTo(8.00, -22.00);
        ctx.lineTo(2.00, -22.00);
        ctx.lineTo(1.00, -21.00);
        ctx.lineTo(1.00, 1.00);
        ctx.lineTo(2.00, 2.00);
        ctx.lineTo(8.00, 2.00);
        ctx.lineTo(8.00, 3.00);
        ctx.lineTo(2.00, 3.00);
        ctx.lineTo(1.00, 4.00);
        ctx.lineTo(1.00, 26.00);
        ctx.lineTo(2.00, 27.00);
        ctx.lineTo(8.00, 27.00);
        ctx.lineTo(8.00, 28.00);
        ctx.lineTo(2.00, 28.00);
        ctx.lineTo(1.00, 29.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.lineTo(-1.00, 29.00);
        ctx.lineTo(-2.00, 28.00);
        ctx.lineTo(-8.00, 28.00);
        ctx.lineTo(-8.00, 27.00);
        ctx.lineTo(-2.00, 27.00);
        ctx.lineTo(-1.00, 26.00);
        ctx.lineTo(-1.00, 4.00);
        ctx.lineTo(-2.00, 3.00);
        ctx.lineTo(-8.00, 3.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-2.00, 2.00);
        ctx.lineTo(-1.00, 1.00);
        ctx.lineTo(-1.00, -21.00);
        ctx.lineTo(-2.00, -22.00);
        ctx.lineTo(-8.00, -22.00);
        ctx.lineTo(-8.00, -23.00);
        ctx.lineTo(-2.00, -23.00);
        ctx.lineTo(-1.00, -24.00);
        ctx.lineTo(-1.00, -46.00);
        ctx.lineTo(-2.00, -47.00);
        ctx.lineTo(-8.00, -47.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -62.00);
        ctx.lineTo(1.00, -62.00);
        ctx.lineTo(2.00, -58.00);
        ctx.lineTo(2.00, -56.00);
        ctx.lineTo(1.00, -55.00);
        ctx.lineTo(-1.00, -55.00);
        ctx.lineTo(-2.00, -56.00);
        ctx.lineTo(-2.00, -58.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(13.00, 31.00);
        ctx.lineTo(20.00, 43.00);
        ctx.lineTo(20.00, 52.00);
        ctx.lineTo(13.00, 51.00);
        ctx.closePath();
        ctx.moveTo(13.00, -13.00);
        ctx.lineTo(20.00, -5.00);
        ctx.lineTo(20.00, -1.00);
        ctx.lineTo(13.00, -2.00);
        ctx.closePath();
        ctx.moveTo(4.00, -59.00);
        ctx.lineTo(7.00, -56.00);
        ctx.lineTo(7.00, -54.00);
        ctx.lineTo(4.00, -54.00);
        ctx.closePath();
        ctx.moveTo(-4.00, -59.00);
        ctx.lineTo(-7.00, -56.00);
        ctx.lineTo(-7.00, -54.00);
        ctx.lineTo(-4.00, -54.00);
        ctx.closePath();
        ctx.moveTo(-13.00, -13.00);
        ctx.lineTo(-20.00, -5.00);
        ctx.lineTo(-20.00, -1.00);
        ctx.lineTo(-13.00, -2.00);
        ctx.closePath();
        ctx.moveTo(-13.00, 31.00);
        ctx.lineTo(-20.00, 43.00);
        ctx.lineTo(-20.00, 52.00);
        ctx.lineTo(-13.00, 51.00);
        ctx.closePath();
        ctx.moveTo(0.00, -13.00);
        ctx.lineTo(1.00, -1.00);
        ctx.lineTo(-1.00, -1.00);
        ctx.closePath();
        ctx.moveTo(0.00, 29.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawEngines(ctx, camera, scale);
        this.drawTurrets(ctx, camera, scale);

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }


}

export class Arrow extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.5;
        this.thrust = 300;
        this.maxVelocity = 600;
        // Bounding box: width = 30 (from -15 to 15), height = 56 (from -31 to 25)
        this.boundingBox.set(30, 56);

        // Feature points for dynamic elements
        this.featurePoints = {
            engines: [
                { x: -5.00, y: 20.50, radius: 2.00 },
                { x: 5.00, y: 20.50, radius: 2.00 },
                { x: 0.00, y: 20.50, radius: 2.00 },
            ],
            turrets: [
            ]
        };
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);
        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale, scale * this.stretchFactor);



        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-7.00, 8.50);
        ctx.lineTo(-3.00, 8.50);
        ctx.lineTo(-3.00, 20.50);
        ctx.lineTo(-7.00, 20.50);
        ctx.closePath();
        ctx.moveTo(3.00, 8.50);
        ctx.lineTo(7.00, 8.50);
        ctx.lineTo(7.00, 20.50);
        ctx.lineTo(3.00, 20.50);
        ctx.closePath();
        ctx.moveTo(3.00, 8.50);
        ctx.lineTo(3.00, 19.50);
        ctx.lineTo(-3.00, 19.50);
        ctx.lineTo(-3.00, 8.50);
        ctx.lineTo(-3.00, 4.50);
        ctx.lineTo(-2.00, -19.50);
        ctx.lineTo(-1.00, -21.50);
        ctx.lineTo(0.00, -22.50);
        ctx.lineTo(1.00, -21.50);
        ctx.lineTo(2.00, -19.50);
        ctx.lineTo(3.00, 4.50);
        ctx.lineTo(3.00, 8.50);
        ctx.moveTo(-2.00, 8.50);
        ctx.lineTo(2.00, 8.50);
        ctx.lineTo(2.00, 20.50);
        ctx.lineTo(-2.00, 20.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1.00, -11.50);
        ctx.lineTo(1.00, -11.50);
        ctx.lineTo(2.00, -7.50);
        ctx.lineTo(-2.00, -7.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(-2.00, -3.50);
        ctx.lineTo(-5.00, -1.50);
        ctx.lineTo(-5.00, -0.50);
        ctx.lineTo(-2.00, -1.50);
        ctx.closePath();
        ctx.moveTo(2.00, -3.50);
        ctx.lineTo(5.00, -1.50);
        ctx.lineTo(5.00, -0.50);
        ctx.lineTo(2.00, -1.50);
        ctx.closePath();
        ctx.moveTo(7.00, 14.50);
        ctx.lineTo(15.00, 18.50);
        ctx.lineTo(15.00, 21.50);
        ctx.lineTo(15.00, 22.50);
        ctx.lineTo(7.00, 19.50);
        ctx.closePath();
        ctx.moveTo(-7.00, 14.50);
        ctx.lineTo(-15.00, 18.50);
        ctx.lineTo(-15.00, 21.50);
        ctx.lineTo(-15.00, 22.50);
        ctx.lineTo(-7.00, 19.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        this.drawEngines(ctx, camera, scale);
        this.drawTurrets(ctx, camera, scale);

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }


}

// Factory function to create a random ship type
export function createRandomShip(x, y, starSystem) {
    const shipClasses = [Flivver, Shuttle, HeavyShuttle, StarBarge, Freighter, Arrow];
    //const shipClasses = [StarBarge];
    const RandomShipClass = shipClasses[Math.floor(Math.random() * shipClasses.length)];
    return new RandomShipClass(x, y, starSystem);
}