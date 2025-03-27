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

    constructor(x, y, starSystem, trailColor = new Colour(1, 1, 1, 0.5)) {
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
        this.trail = new Trail(this, 250, 2, trailColor.toRGBA());

        // Generate random colors for cockpit, wings, and hull
        this.colors = {
            cockpit: this.generateRandomBlue(),
            wings: this.generateRandomColor(),
            hull: this.generateRandomGrey()
        };

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
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) return false;
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
        ctx.scale(scale * this.stretchFactor, scale);

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
        ctx.rotate(this.angle);
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
        ctx.arc(this._scratchStoppingPoint.x, this._scratchStoppingPoint.y, 5 * scale, 0, TWO_PI);
        ctx.fill();

        if (this.target) {
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
            ctx.strokeStyle = 'purple';
            ctx.beginPath();
            ctx.moveTo(this._scratchScreenPos.x, this._scratchScreenPos.y);
            ctx.lineTo(this._scratchRadialIn.x, this._scratchRadialIn.y);
            ctx.stroke();
        }
    }
}

export class Shuttle extends Ship {
    constructor(x, y, starSystem, trailColor = new Colour(1, 1, 1, 0.5)) {
        super(x, y, starSystem, trailColor);
        // Flight dynamics for Shuttle: balanced
        this.rotationSpeed = Math.PI * 1.2; // Slightly better turning
        this.thrust = 200; // Lower thrust
        this.maxVelocity = 400; // Lower max speed
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);

        const scale = camera.zoom * this.shipScale;
        ctx.scale(scale * this.stretchFactor, scale);

        // Draw the hull (rectangular body)
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.rect(-15, -10, 30, 20); // Rectangular hull
        ctx.fill();

        // Draw the cockpit (small rectangle at the front)
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.rect(10, -5, 5, 10); // Small cockpit at the front
        ctx.fill();

        // Draw the wings (small stubs on the sides)
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.rect(-20, -5, 5, 10); // Left wing
        ctx.rect(15, -5, 5, 10); // Right wing
        ctx.fill();

        // Draw thrust effect if thrusting
        if ((this.isThrusting && this.state === 'Flying') || this.state === 'Landing' || this.state === 'TakingOff') {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(-20, 5);
            ctx.lineTo(-20, -5);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }
}

export class Arrow extends Ship {
    constructor(x, y, starSystem, trailColor = new Colour(1, 1, 1, 0.5)) {
        super(x, y, starSystem, trailColor);
        // Flight dynamics for Arrow: faster but less maneuverable
        this.rotationSpeed = Math.PI * 0.8; // Lower turning speed
        this.thrust = 300; // Higher thrust
        this.maxVelocity = 600; // Higher max speed
    }

    draw(ctx, camera) {
        if (this.state === 'Landed') return;

        ctx.save();
        this.trail.draw(ctx, camera);
        camera.worldToScreen(this.position, this._scratchScreenPos);
        ctx.translate(this._scratchScreenPos.x, this._scratchScreenPos.y);
        ctx.rotate(this.angle);

        const scale = camera.zoom * this.shipScale; // 1 canvas unit = 1 grid unit
        ctx.scale(scale * this.stretchFactor, scale);

        // Draw the hull
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        // Main hull
        ctx.moveTo(3, 0);
        ctx.lineTo(3, 11);
        ctx.lineTo(-3, 11);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-2, -28);
        ctx.lineTo(-1, -30);
        ctx.lineTo(0, -31);
        ctx.lineTo(1, -30);
        ctx.lineTo(2, -28);
        ctx.lineTo(3, -4);
        ctx.lineTo(3, 0);
        ctx.closePath();
        // Left hull extension
        ctx.moveTo(-7, 0);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-3, 12);
        ctx.lineTo(-7, 12);
        ctx.closePath();
        // Right hull extension
        ctx.moveTo(3, 0);
        ctx.lineTo(7, 0);
        ctx.lineTo(7, 12);
        ctx.lineTo(3, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the cockpit
        ctx.fillStyle = this.colors.cockpit.toRGB();
        ctx.beginPath();
        ctx.moveTo(-1, -20);
        ctx.lineTo(1, -20);
        ctx.lineTo(2, -16);
        ctx.lineTo(-2, -16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the small wings
        ctx.fillStyle = this.colors.wings.toRGB();
        // Left small wing
        ctx.beginPath();
        ctx.moveTo(-2, -12);
        ctx.lineTo(-5, -10);
        ctx.lineTo(-5, -9);
        ctx.lineTo(-2, -10);
        ctx.closePath();
        // Right small wing
        ctx.moveTo(2, -12);
        ctx.lineTo(5, -10);
        ctx.lineTo(5, -9);
        ctx.lineTo(2, -10);
        ctx.closePath();
        ctx.fill();

        // Draw the large wings
        // Left large wing
        ctx.moveTo(-7, 6);
        ctx.lineTo(-15, 10);
        ctx.lineTo(-15, 13);
        ctx.lineTo(-15, 14);
        ctx.lineTo(-7, 11);
        ctx.closePath();
        // Right large wing
        ctx.moveTo(7, 6);
        ctx.lineTo(15, 10);
        ctx.lineTo(15, 13);
        ctx.lineTo(15, 14);
        ctx.lineTo(7, 11);

        // Vertical large wing
        ctx.moveTo(-0.5, 6);
        ctx.lineTo(0.5, 6);
        ctx.lineTo(0.5, 14);
        ctx.lineTo(-0.5, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw thrust effect if applicable
        if ((this.isThrusting && this.state === 'Flying') || this.state === 'Landing' || this.state === 'TakingOff') {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            // Left thrust (tail of left hull extension)
            ctx.beginPath();
            ctx.moveTo(-7, 12);
            ctx.lineTo(-5, 25);
            ctx.lineTo(-3, 12);
            ctx.closePath();
            ctx.fill();
            // Right thrust (tail of right hull extension)
            ctx.beginPath();
            ctx.moveTo(3, 12);
            ctx.lineTo(5, 25);
            ctx.lineTo(7, 12);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // Draw debug information if enabled
        this.drawDebug(ctx, camera, scale);
    }
}

// Factory function to create a random ship type
export function createRandomShip(x, y, starSystem, trailColor = new Colour(1, 1, 1, 0.5)) {
    const shipClasses = [Shuttle, Arrow];
    const RandomShipClass = shipClasses[Math.floor(Math.random() * shipClasses.length)];
    return new RandomShipClass(x, y, starSystem, trailColor);
}