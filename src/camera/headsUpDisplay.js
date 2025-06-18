// /src/camera/headsUpDisplay.js

import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { TWO_PI, remapClamp } from '/src/core/utils.js';
import { GameObject, isValidTarget } from '/src/core/gameObject.js';
import { Colour } from '/src/core/colour.js';
import { AiPilot } from '/src/pilot/aiPilot.js';
import { GameManager } from '/src/core/game.js';
import { Camera } from '/src/camera/camera.js';
import { CelestialBody } from '/src/starSystem/celestialBody.js';
import { FactionRelationship } from '/src/core/faction.js';

/**
 * Manages the Heads-Up Display (HUD) showing rings and indicators for game objects.
 */
export class HeadsUpDisplay {
    /**
     * Creates a new HeadsUpDisplay instance.
     * @param {GameManager} gameManager - The game manager providing access to game state.
     * @param {number} width - Initial width of the HUD in pixels.
     * @param {number} height - Initial height of the HUD in pixels.
     */
    constructor(gameManager, width, height) {
        /** @type {GameManager} The game manager providing access to game state. */
        this.gameManager = gameManager;
        /** @type {Vector2D} The size of the HUD in pixels (width, height). */
        this.size = new Vector2D(width, height);

        /** @type {number} Radius of the jump gate ring in pixels. */
        this.jumpGateRingRadius = 1.0;
        /** @type {Colour} Colour of the jump gate ring. */
        this.jumpGateRingColour = Colour.Purple;

        /** @type {number} Radius of the planet ring in pixels. */
        this.planetRingRadius = 1.0;
        /** @type {Colour} Colour of the planet ring. */
        this.planetRingColour = Colour.Blue;

        /** @type {number} Radius of the asteroid ring in pixels. */
        this.asteroidRingRadius = 1.0;
        /** @type {Colour} Colour of the asteroid ring. */
        this.asteroidRingColour = Colour.Green;

        /** @type {number} Radius of the Allied ship ring in pixels. */
        this.shipAlliedRingRadius = 1.0;
        /** @type {Colour} Colour of the Allied ship ring. */
        this.shipAlliedRingColour = Colour.Allied;

        /** @type {number} Radius of the Neutral ship ring in pixels. */
        this.shipNeutralRingRadius = 1.0;
        /** @type {Colour} Colour of the Neutral ship ring. */
        this.shipNeutralRingColour = Colour.Neutral;

        /** @type {number} Radius of the Hostile ship ring in pixels. */
        this.shipHostileRingRadius = 1.0;
        /** @type {Colour} Colour of the Hostile ship ring. */
        this.shipHostileRingColour = Colour.Hostile;

        /** @type {number} Radius of the Disabled ring in pixels. */
        this.shipDisabledRingRadius = 1.0;
        /** @type {Colour} Colour of the Disabled ring. */
        this.shipDisabledRingColour = Colour.Disabled;

        /** @type {number} Line width for rings in pixels. */
        this.ringLineWidth = 4.0;
        /** @type {number} Spacing between ring lines in pixels. */
        this.ringLineSpace = 12.0;

        /** @type {number} Maximum distance for arrow visibility in pixels. */
        this.maxRadius = 5000.0;

        // Temporary scratch values to avoid allocations
        /** @type {Vector2D} Scratch vector for camera-relative position calculations. */
        this._scratchCameraPos = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for screen position of objects. */
        this._scratchScreenPos = new Vector2D(0.0, 0.0);
        /** @type {Array<Ship>} Scratch buffer to Allied ships. */
        this._scratchAlliedShips = [];
        /** @type {Array<Ship>} Scratch buffer to store Neutral ships. */
        this._scratchNeutralShips = [];
        /** @type {Array<Ship>} Scratch buffer to store Hostile ships. */
        this._scratchHostileShips = [];
        /** @type {Array<Ship>} Scratch buffer to store Disabled ships. */
        this._scratchDisabledShips = [];
        // Call resize to initialize HUD dimensions
        this.resize(width, height);

        if (new.target === HeadsUpDisplay) Object.seal(this);
    }

    /**
     * Resizes the HUD rings based on new screen dimensions.
     * @param {number} width - New screen width in pixels.
     * @param {number} height - New screen height in pixels.
     */
    resize(width, height) {
        this.size.set(width, height);
        this.shipDisabledRingRadius = Math.min(width, height) * 0.2;
        this.shipHostileRingRadius = this.shipDisabledRingRadius + this.ringLineSpace;
        this.shipNeutralRingRadius = this.shipHostileRingRadius + this.ringLineSpace;
        this.shipAlliedRingRadius = this.shipNeutralRingRadius + this.ringLineSpace;

        this.jumpGateRingRadius = Math.min(width, height) * 0.42;
        this.planetRingRadius = this.jumpGateRingRadius - this.ringLineSpace;
        this.asteroidRingRadius = this.planetRingRadius - this.ringLineSpace;
    }

    /**
     * Draws a circle around the targetd ship.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     * @param {GameObject} [target=null] - The target object.
     */
    drawTargetCircle(ctx, camera, target = null) {
        // Draw rectangle around the target
        if (!target) {
            return;
        }

        if (target instanceof Ship && target.state === 'Landed') {
            return;
        }

        if (!camera.isInView(target.position, target.radius)) {
            return;
        }

        camera.worldToScreen(target.position, this._scratchScreenPos);

        ctx.save();
        ctx.beginPath();
        const scale = target instanceof Ship ? target.shipScale : 1.0;
        ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, camera.worldToSize(target.radius * scale) + 5.0, 0.0, TWO_PI);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = Colour.Black.toRGB();
        ctx.stroke();
        ctx.lineWidth = 2.0;
        if (target instanceof Ship) {
            if (target.state === 'Disabled') {
                ctx.strokeStyle = Colour.Disabled.toRGB();
            } else if (target.state === 'Exploding') {
                // Alternate between Grey and Black every 0.5 seconds
                const now = Date.now();
                ctx.strokeStyle = (Math.floor(now / 250) % 2 === 0)
                    ? Colour.Disabled.toRGB()
                    : Colour.Black.toRGB();
            } else {
                switch (this.gameManager.cameraTarget.getRelationship(target)) {
                    case FactionRelationship.Allied:
                        ctx.strokeStyle = Colour.Allied.toRGB();
                        break;
                    case FactionRelationship.Neutral:
                        ctx.strokeStyle = Colour.Neutral.toRGB();
                        break;
                    case FactionRelationship.Hostile:
                        ctx.strokeStyle = Colour.Hostile.toRGB();
                        break;
                }
            }
        } else {
            ctx.strokeStyle = Colour.Neutral.toRGB();
        }

        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draws a navigational ring with arrows and optional name tags for objects in the star system.
     * The ring is centered on the camera's screen center, with arrows indicating objects outside the ring.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context for drawing.
     * @param {Camera} camera - The camera object for world-to-screen coordinate transformations.
     * @param {Colour} ringColour - The color of the ring and arrows.
     * @param {number} ringRadius - The radius of the ring in screen space.
     * @param {GameObject[]} [objects=[]] - Array of game objects (e.g., planets, ships) to draw arrows or names for.
     * @param {GameObject|null} [target=null] - The target object, which gets a larger arrow if outside the ring.
     */
    drawRing(ctx, camera, ringColour, ringRadius, objects = [], target = null) {
        ctx.save();

        //Draw ring outline
        ctx.strokeStyle = Colour.Black.toRGB();
        ctx.lineWidth = this.ringLineWidth + 1.0;

        ctx.beginPath();
        ctx.arc(camera.screenCenter.x, camera.screenCenter.y, ringRadius, 0.0, TWO_PI);
        ctx.stroke();

        //Draw all the arrows
        const colour = ringColour.toRGB();
        ctx.fillStyle = colour;
        ctx.lineWidth = 1.0;

        // Calculate base to align arrow's left/right points with ring's outer edge
        const outerRadius = ringRadius + this.ringLineWidth / 2.0;
        const arrowWidth = 5.0; // Half-width of arrow base
        const base = ringRadius - Math.sqrt(outerRadius * outerRadius - arrowWidth * arrowWidth) + 1.0;

        for (let i = 0.0; i < objects.length; i++) {
            const body = objects[i];
            if (body === this.gameManager.cameraTarget) continue;
            camera.worldToCamera(body.position, this._scratchCameraPos);
            const squareMagnitude = this._scratchCameraPos.squareMagnitude();
            camera.worldToScreen(body.position, this._scratchScreenPos);

            if (squareMagnitude > ringRadius * ringRadius) {
                const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
                const arrowX = camera.screenCenter.x + Math.sin(angle) * ringRadius;
                const arrowY = camera.screenCenter.y - Math.cos(angle) * ringRadius;

                ctx.save();
                ctx.beginPath();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);

                if (body === target) {
                    ctx.moveTo(arrowWidth, base);  // Bottom right
                    ctx.lineTo(0.0, -20.0);            // Tip up
                    ctx.lineTo(-arrowWidth, base); // Bottom left
                } else {
                    const length = remapClamp(squareMagnitude, 0.0, this.maxRadius * this.maxRadius, -10.0, base);
                    ctx.moveTo(arrowWidth, base);  // Bottom right
                    ctx.lineTo(0.0, length);         // Tip up
                    ctx.lineTo(-arrowWidth, base); // Bottom left
                }
                ctx.stroke();
                ctx.fill();
                ctx.restore();
            }
        }

        //draw the ring last to cover any artifacts
        ctx.lineWidth = this.ringLineWidth;
        ctx.beginPath();
        ctx.arc(camera.screenCenter.x, camera.screenCenter.y, ringRadius, 0.0, TWO_PI);
        ctx.strokeStyle = colour;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Draws name tags for objects inside the given ring.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context for drawing.
     * @param {Camera} camera - The camera object for world-to-screen coordinate transformations.
     * @param {number} ringRadius - The radius of the ring in screen space.
     * @param {GameObject[]} [objects=[]] - Array of game objects (e.g., planets, ships) to draw arrows or names for.
     */
    drawNames(ctx, camera, ringRadius, objects = []) {
        ctx.save();
        ctx.fillStyle = Colour.White.toRGB();
        ctx.textAlign = 'center';
        ctx.strokeStyle = Colour.Black.toRGB();
        ctx.lineWidth = 2.0;

        for (let i = 0.0; i < objects.length; i++) {
            const body = objects[i];
            camera.worldToCamera(body.position, this._scratchCameraPos);
            const squareMagnitude = this._scratchCameraPos.squareMagnitude();
            // Label for bodies inside their ring
            if (squareMagnitude < ringRadius * ringRadius) {
                ctx.beginPath();
                camera.worldToScreen(body.position, this._scratchScreenPos);
                const scaledRadius = camera.worldToSize(body.radius);
                ctx.strokeText(body.name, this._scratchScreenPos.x, this._scratchScreenPos.y + scaledRadius + camera.worldToSize(20.0));
                ctx.fillText(body.name, this._scratchScreenPos.x, this._scratchScreenPos.y + scaledRadius + camera.worldToSize(20.0));
            }
        }
        ctx.restore();
    }

    /**
     * Draws HUD elements like rings, arrows, and labels on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     */
    draw(ctx, camera) {
        ctx.save();
        ctx.clearRect(0, 0, this.size.width, this.size.height);
        let autopilotStatus = this.gameManager.cameraTarget?.pilot?.getStatus();

        if (autopilotStatus) {
            ctx.fillStyle = Colour.White.toRGB();
            ctx.strokeStyle = Colour.Black.toRGB();
            ctx.textAlign = "center";
            // Top middle of screen
            ctx.strokeText(autopilotStatus, this.size.width / 2.0, 20.0)
            ctx.fillText(autopilotStatus, this.size.width / 2.0, 20.0);
        }

        // Determine the current target
        let target = null;
        if (
            this.gameManager.cameraTarget &&
            this.gameManager.cameraTarget instanceof Ship &&
            isValidTarget(this.gameManager.cameraTarget, this.gameManager.cameraTarget.target)
        ) {
            target = this.gameManager.cameraTarget.target;
        }
        if (target) {
            this.drawTargetCircle(ctx, camera, target);
        }

        this._scratchAlliedShips.length = 0.0;
        this._scratchNeutralShips.length = 0.0;
        this._scratchHostileShips.length = 0.0;
        this._scratchDisabledShips.length = 0.0;

        if (this.gameManager.cameraTarget && this.gameManager.cameraTarget instanceof Ship) {
            for (let i = 0.0; i < camera.starSystem.ships.length; i++) {
                const ship = camera.starSystem.ships[i];

                if (ship.state !== 'Flying' && ship.state !== 'Disabled') {
                    continue;
                }

                if (ship.state === 'Disabled') {
                    this._scratchDisabledShips.push(ship);
                }

                switch (this.gameManager.cameraTarget.getRelationship(ship)) {
                    case FactionRelationship.Allied:
                        this._scratchAlliedShips.push(ship);
                        break;
                    case FactionRelationship.Neutral:
                        this._scratchNeutralShips.push(ship);
                        break;
                    case FactionRelationship.Hostile:
                        this._scratchHostileShips.push(ship);
                        break;
                }
            }
        } else {
            this._scratchNeutralShips.push(...camera.starSystem.ships);
        }

        // Draw jumpGate
        this.drawRing(ctx, camera, this.jumpGateRingColour, this.jumpGateRingRadius, camera.starSystem.jumpGates, target);
        // Draw planet ring
        this.drawRing(ctx, camera, this.planetRingColour, this.planetRingRadius, camera.starSystem.planets, target);
        // Draw asteroid ring
        this.drawRing(ctx, camera, this.asteroidRingColour, this.asteroidRingRadius, camera.starSystem.asteroids, target);
        // Draw ship rings
        if (this._scratchAlliedShips.length > 0.0) {
            this.drawRing(ctx, camera, this.shipAlliedRingColour, this.shipAlliedRingRadius, this._scratchAlliedShips, target);
        }
        if (this._scratchNeutralShips.length > 0.0) {
            this.drawRing(ctx, camera, this.shipNeutralRingColour, this.shipNeutralRingRadius, this._scratchNeutralShips, target);
        }
        if (this._scratchHostileShips.length > 0.0) {
            this.drawRing(ctx, camera, this.shipHostileRingColour, this.shipHostileRingRadius, this._scratchHostileShips, target);
        }
        if (this._scratchDisabledShips.length > 0.0) {
            this.drawRing(ctx, camera, this.shipDisabledRingColour, this.shipDisabledRingRadius, this._scratchDisabledShips, target);
        }

        // Draw jumpGate names
        this.drawNames(ctx, camera, this.jumpGateRingRadius, camera.starSystem.jumpGates);
        // Draw planet names
        this.drawNames(ctx, camera, this.planetRingRadius, camera.starSystem.planets);

        ctx.restore();
    }
}