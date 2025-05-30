// /src/camera/headsUpDisplay.js

import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { TWO_PI, remapClamp } from '/src/core/utils.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { Colour } from '/src/core/colour.js';
import { AiPilot } from '/src/pilot/aiPilot.js';

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
        this.jumpGateRingRadius = 1;
        /** @type {Colour} Colour of the jump gate ring. */
        this.jumpGateRingColour = new Colour(0.25, 0.25, 1.0);

        /** @type {number} Radius of the planet ring in pixels. */
        this.planetRingRadius = 1;
        /** @type {Colour} Colour of the planet ring. */
        this.planetRingColour = new Colour(0.25, 1.0, 1.25);

        /** @type {number} Radius of the asteroid ring in pixels. */
        this.asteroidRingRadius = 1;
        /** @type {Colour} Colour of the asteroid ring. */
        this.asteroidRingColour = new Colour(0.25, 1.0, 0.25);

        /** @type {number} Radius of the ship ring in pixels. */
        this.shipRingRadius = 1;
        /** @type {Colour} Colour of the ship ring. */
        this.shipRingColour = new Colour(1.0, 1.0, 0.25);

        /** @type {number} Radius of the threat ring in pixels. */
        this.threatRingRadius = 1;
        /** @type {Colour} Colour of the threat ring. */
        this.threatRingColour = new Colour(1.0, 0.25, 0.25);

        /** @type {number} Line width for rings in pixels. */
        this.ringLineWidth = 4;
        /** @type {number} Spacing between ring lines in pixels. */
        this.ringLineSpace = 12;

        /** @type {number} Maximum distance for arrow visibility in pixels. */
        this.maxRadius = 5000;

        // Temporary scratch values to avoid allocations
        /** @type {Vector2D} Scratch vector for camera-relative position calculations. */
        this._scratchCameraPos = new Vector2D(0, 0);
        /** @type {Vector2D} Scratch vector for screen position of objects. */
        this._scratchScreenPos = new Vector2D(0, 0);
        /** @type {Array<Ship>} Scratch buffer to store threats. */
        this._scratchThreats = [];
        /** @type {Array<Ship>} Scratch buffer to store flying ships. */
        this._scratchShips = [];

        // Call resize to initialize HUD dimensions
        this.resize(width, height);
    }

    /**
     * Resizes the HUD rings based on new screen dimensions.
     * @param {number} width - New screen width in pixels.
     * @param {number} height - New screen height in pixels.
     */
    resize(width, height) {
        this.size.set(width, height);
        this.threatRingRadius = Math.min(width, height) * 0.2;
        this.shipRingRadius = this.threatRingRadius + this.ringLineSpace;
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
        ctx.strokeStyle = 'rgb(255, 255, 64)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const scale = target instanceof Ship ? target.shipScale : 1.0;
        ctx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, camera.worldToSize(target.radius * scale) * 1.1, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draws a ring with arrows and optional name tags
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     * @param {Colour} ringColour - The colour of the ring
     * @param {Number} ringRadius - The radius in screen space for the ring
     * @param {Boolean} [showNames = true] - Show object names
     * @param {GameObject} target - The target gets a bigger arrow
     */
    drawRing(ctx, camera, ringColour, ringRadius, showNames = true, objects, target) {
        ctx.save();
        const colour = ringColour.toRGB();
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        ctx.lineWidth = this.ringLineWidth;

        ctx.beginPath();
        ctx.arc(camera.screenCenter.x, camera.screenCenter.y, ringRadius, 0, TWO_PI);
        ctx.closePath();
        ctx.stroke();

        for (let i = 0; i < objects.length; i++) {
            const body = objects[i];
            if (body === this.gameManager.cameraTarget) continue;
            camera.worldToCamera(body.position, this._scratchCameraPos);
            const squareMagnitude = this._scratchCameraPos.squareMagnitude();
            camera.worldToScreen(body.position, this._scratchScreenPos);

            // Label for bodies inside their ring
            if (squareMagnitude < ringRadius * ringRadius) {
                if (body.name && showNames) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.fillStyle = 'white';
                    ctx.textAlign = 'center';
                    const scaledRadius = camera.worldToSize(body.radius);
                    ctx.fillText(body.name, this._scratchScreenPos.x, this._scratchScreenPos.y + scaledRadius + camera.worldToSize(20));
                    ctx.restore();
                }
            } else {
                const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
                const arrowX = camera.screenCenter.x + Math.sin(angle) * ringRadius;
                const arrowY = camera.screenCenter.y - Math.cos(angle) * ringRadius;

                ctx.save();
                ctx.beginPath();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                if (body === target) {
                    ctx.globalAlpha = 1;
                    ctx.moveTo(0, -20);  // Tip up
                    ctx.lineTo(5, 0);    // Bottom right
                    ctx.lineTo(-5, 0);   // Bottom left
                } else {
                    const opacity = remapClamp(squareMagnitude, 0, this.maxRadius * this.maxRadius, 1.0, 0.0);
                    ctx.globalAlpha = opacity;
                    ctx.moveTo(0, -10);  // Tip up
                    ctx.lineTo(5, 0);    // Bottom right
                    ctx.lineTo(-5, 0);   // Bottom left
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
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

        // Draw autopilot status at top middle if the camera's target ship has an active autopilot
        let autopilotStatus;
        if (this.gameManager.cameraTarget?.pilot instanceof AiPilot) {
            autopilotStatus = this.gameManager.cameraTarget?.pilot?.getStatus();
        } else {
            autopilotStatus = this.gameManager.cameraTarget?.pilot?.autopilot?.getStatus();
        }
        if (autopilotStatus) {
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText(autopilotStatus, this.size.width / 2, 20); // Top middle of screen
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

        this._scratchThreats.length = 0;
        this._scratchShips.length = 0;
        for (let i = 0; i < camera.starSystem.ships.length; i++) {
            const ship = camera.starSystem.ships[i];
            if (ship.target === this.gameManager.cameraTarget) {
                this._scratchThreats.push(ship);
            }
            if (ship.state === 'Flying') {
                this._scratchShips.push(ship);
            }
        }

        // Draw jumpGate
        this.drawRing(ctx, camera, this.jumpGateRingColour, this.jumpGateRingRadius, true, camera.starSystem.jumpGates, target);
        // Draw planet ring
        this.drawRing(ctx, camera, this.planetRingColour, this.planetRingRadius, true, camera.starSystem.planets, target);
        // Draw asteroid ring
        this.drawRing(ctx, camera, this.asteroidRingColour, this.asteroidRingRadius, false, camera.starSystem.asteroids, target);
        // Draw ship ring
        this.drawRing(ctx, camera, this.shipRingColour, this.shipRingRadius, false, this._scratchShips, target);
        if (this._scratchThreats.length > 0) {
            // Draw threat ring
            this.drawRing(ctx, camera, this.threatRingColour, this.threatRingRadius, false, this._scratchThreats, target);
        }

        this.drawTargetCircle(ctx, camera, target);
        ctx.restore();
    }
}