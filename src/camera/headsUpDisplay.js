// /src/camera/headsUpDisplay.js

import { Vector2D } from '/src/core/vector2d.js';
import { Ship } from '/src/ship/ship.js';
import { TWO_PI, remapClamp } from '/src/core/utils.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { Colour } from '/src/core/colour.js';
import { AIPilot } from '/src/pilot/aiPilot.js';

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
        this.gameManager = gameManager;
        this.size = new Vector2D(width, height);

        this.shipRingRadius = 1;
        this.asteroidRingRadius = 1;
        this.planetRingRadius = 1;
        this.jumpGateRingRadius = 1;

        this.maxRadius = 5000; // Maximum distance for arrow visibility
        this.resize(width, height);

        // Temporary scratch values to avoid allocations
        this._scratchCenter = new Vector2D(0, 0); // For screen center in draw
        this._scratchCameraPos = new Vector2D(0, 0); // For camera-relative position
        this._scratchScreenPos = new Vector2D(0, 0); // For screen position of objects
        // Additional scratch vectors for bounding box corners
        this._scratchCorner1 = new Vector2D(0, 0);
        this._scratchCorner2 = new Vector2D(0, 0);
        this._scratchCorner3 = new Vector2D(0, 0);
        this._scratchCorner4 = new Vector2D(0, 0);
    }

    /**
     * Resizes the HUD rings based on new screen dimensions.
     * @param {number} width - New screen width in pixels.
     * @param {number} height - New screen height in pixels.
     */
    resize(width, height) {
        this.size.set(width, height);
        this.shipRingRadius = Math.min(width, height) * 0.2;
        this.asteroidRingRadius = Math.min(width, height) * 0.42;
        this.planetRingRadius = Math.min(width, height) * 0.44;
        this.jumpGateRingRadius = Math.min(width, height) * 0.46;
    }

    /**
     * Draws HUD elements like rings, arrows, and labels on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     * @param {GameObject} [target=null] - The target object.
     */
    drawTargetRectangle(ctx, camera, target = null) {
        // Draw rectangle around the target
        if (!target) {
            return;
        }
        camera.worldToScreen(target.position, this._scratchScreenPos);

        if (target instanceof Ship) {
            // Compute the rotated bounding box corners in world space
            // Apply shipScale but ignore stretchFactor
            const halfWidth = (target.boundingBox.x * target.shipScale) / 2;
            const halfHeight = (target.boundingBox.y * target.shipScale) / 2;
            const cosAngle = Math.cos(target.angle);
            const sinAngle = Math.sin(target.angle);

            // Define the four corners of the bounding box in local space (before rotation)
            // Corner 1: Top-left
            this._scratchCorner1.set(-halfWidth, -halfHeight);
            // Corner 2: Top-right
            this._scratchCorner2.set(halfWidth, -halfHeight);
            // Corner 3: Bottom-right
            this._scratchCorner3.set(halfWidth, halfHeight);
            // Corner 4: Bottom-left
            this._scratchCorner4.set(-halfWidth, halfHeight);

            // Rotate each corner around the ship's center (which is at target.position)
            const rotatePoint = (point) => {
                const x = point.x * cosAngle - point.y * sinAngle;
                const y = point.x * sinAngle + point.y * cosAngle;
                point.set(x, y).addInPlace(target.position);
            };
            rotatePoint(this._scratchCorner1);
            rotatePoint(this._scratchCorner2);
            rotatePoint(this._scratchCorner3);
            rotatePoint(this._scratchCorner4);

            // Convert corners to screen space
            camera.worldToScreen(this._scratchCorner1, this._scratchCorner1);
            camera.worldToScreen(this._scratchCorner2, this._scratchCorner2);
            camera.worldToScreen(this._scratchCorner3, this._scratchCorner3);
            camera.worldToScreen(this._scratchCorner4, this._scratchCorner4);

            // Compute the axis-aligned bounding box (AABB) in screen space
            const minX = Math.min(
                this._scratchCorner1.x,
                this._scratchCorner2.x,
                this._scratchCorner3.x,
                this._scratchCorner4.x
            );
            const maxX = Math.max(
                this._scratchCorner1.x,
                this._scratchCorner2.x,
                this._scratchCorner3.x,
                this._scratchCorner4.x
            );
            const minY = Math.min(
                this._scratchCorner1.y,
                this._scratchCorner2.y,
                this._scratchCorner3.y,
                this._scratchCorner4.y
            );
            const maxY = Math.max(
                this._scratchCorner1.y,
                this._scratchCorner2.y,
                this._scratchCorner3.y,
                this._scratchCorner4.y
            );

            // Draw the AABB as the yellow rectangle
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const padding = 5; // Pixels of padding in screen space
            ctx.rect(
                minX - padding,
                minY - padding,
                (maxX - minX) + 2 * padding,
                (maxY - minY) + 2 * padding
            );
            ctx.stroke();
        } else {
            // For non-ships, use radius or size with padding, as before
            const size = target.radius + 10 || target.size + 10 || 20;
            const scaledSize = camera.worldToSize(size);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(
                this._scratchScreenPos.x - scaledSize,
                this._scratchScreenPos.y - scaledSize,
                scaledSize * 2,
                scaledSize * 2
            );
            ctx.stroke();
        }
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
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.33;

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
                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = 'white';
                    //ctx.font = `${camera.worldToSize(16)}px Arial`;
                    ctx.textAlign = 'center';
                    const scaledRadius = camera.worldToSize(body.radius);
                    ctx.fillText(body.name, this._scratchScreenPos.x, this._scratchScreenPos.y + scaledRadius + camera.worldToSize(20));
                    ctx.restore();
                }
            } else {
                const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
                const arrowX = this._scratchCenter.x + Math.sin(angle) * ringRadius;
                const arrowY = this._scratchCenter.y - Math.cos(angle) * ringRadius;

                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = colour;
                ctx.fillStyle = colour;
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                if (body === target) {
                    ctx.globalAlpha = 1;
                    ctx.moveTo(0, -20);  // Tip up
                    ctx.lineTo(5, 0);    // Bottom right
                    ctx.lineTo(-5, 0);   // Bottom left
                } else {
                    const opacity = remapClamp(squareMagnitude, this.maxRadius * this.maxRadius, 0, 0.1, 1);
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
        this._scratchCenter.set(camera.screenCenter); // Use scratch for center
        ctx.save();

        // Draw autopilot status at top middle if the camera's target ship has an active autopilot
        let autopilotStatus;
        if (this.gameManager.cameraTarget?.pilot instanceof AIPilot) {
            autopilotStatus = this.gameManager.cameraTarget?.pilot?.getStatus();
        } else {
            autopilotStatus = this.gameManager.cameraTarget?.pilot?.autopilot?.getStatus();
        }
        if (autopilotStatus) {
            ctx.fillStyle = "white";
            //ctx.font = "16px Arial";
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

        // Draw ship ring (white)
        this.drawRing(ctx, camera, new Colour(1.0, 1.0, 1.0), this.shipRingRadius, false, camera.starSystem.ships, target);
        // Draw asteroid ring (grey)
        this.drawRing(ctx, camera, new Colour(0.5, 0.5, 0.5), this.asteroidRingRadius, false, camera.starSystem.asteroids, target);
        // Draw planet ring (cyan)
        this.drawRing(ctx, camera, new Colour(0.0, 1.0, 1.0), this.planetRingRadius, true, camera.starSystem.planets, target);
        // Draw jumpGate ring (green)
        this.drawRing(ctx, camera, new Colour(0.0, 1.0, 0.0), this.jumpGateRingRadius, true, camera.starSystem.jumpGates, target);

        this.drawTargetRectangle(ctx, camera, target);
        ctx.restore();
    }
}