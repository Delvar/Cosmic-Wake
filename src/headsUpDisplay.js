// headsUpDisplay.js

import { Vector2D } from './vector2d.js';
import { Ship } from './ship.js';
import { JumpGate } from './celestialBody.js';
import { AIPilot } from './pilot.js';
import { Asteroid } from './asteroidBelt.js';
import { TWO_PI, remapClamp } from './utils.js';
import { isValidTarget } from './gameObject.js';

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
        this.ringRadius = Math.min(width, height) / 3;        // Ring for planets (light blue)
        this.shipRingRadius = Math.min(width, height) / 5.5;  // Ring for ships/asteroids (grey)
        this.gateRingRadius = Math.min(width, height) / 2.5;  // Ring for jump gates (green)
        this.maxRadius = 5000; // Maximum distance for arrow visibility

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
        this.ringRadius = Math.min(width, height) / 3;
        this.shipRingRadius = Math.min(width, height) / 5.5;
        this.gateRingRadius = Math.min(width, height) / 2.5;
    }

    /**
     * Draws HUD elements like rings, arrows, and labels on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     */
    drawLabelsAndArrows(ctx, camera, body, target) {
        camera.worldToCamera(body.position, this._scratchCameraPos);
        const distSquared = this._scratchCameraPos.x * this._scratchCameraPos.x + this._scratchCameraPos.y * this._scratchCameraPos.y;
        camera.worldToScreen(body.position, this._scratchScreenPos);
        const isGate = body instanceof JumpGate;
        const radius = isGate ? this.gateRingRadius : this.ringRadius;

        // Label for bodies inside their ring (unchanged)
        if (distSquared < radius * radius && body.name) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'white';
            ctx.font = `${camera.worldToSize(16)}px Arial`;
            ctx.textAlign = 'center';
            const scaledRadius = camera.worldToSize(body.radius);
            ctx.fillText(body.name, this._scratchScreenPos.x, this._scratchScreenPos.y + scaledRadius + camera.worldToSize(20));
            ctx.restore();
        }

        // Arrow for bodies outside their ring but within maxRadius
        if ((distSquared > radius * radius) && (distSquared < this.maxRadius * this.maxRadius) && body !== target) {
            const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
            const arrowX = this._scratchCenter.x + Math.sin(angle) * radius;
            const arrowY = this._scratchCenter.y - Math.cos(angle) * radius;
            const ringDist = Math.sqrt(distSquared) - radius;
            const opacity = remapClamp(ringDist, this.maxRadius, 0, 0.2, 1);
            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(angle);
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.moveTo(0, -10);  // Tip up
            ctx.lineTo(5, 0);    // Bottom right
            ctx.lineTo(-5, 0);   // Bottom left
            ctx.closePath();
            if (isGate) {
                ctx.fillStyle = 'rgba(0, 255, 0, 1)';
            } else if (body.type.type === 'star') {
                ctx.fillStyle = 'rgba(255, 255, 0, 1)';
            } else {
                ctx.fillStyle = 'rgba(0, 255, 255, 1)';
            }
            ctx.fill();
            ctx.restore();
        }
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
        const autopilotStatus = this.gameManager.cameraTarget?.pilot?.autopilot?.getStatus();
        if (autopilotStatus) {
            ctx.fillStyle = "white";
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.fillText(autopilotStatus, this.size.width / 2, 20); // Top middle of screen
        }

        // Draw planet ring (light blue)
        ctx.beginPath();
        ctx.arc(this._scratchCenter.x, this._scratchCenter.y, this.ringRadius, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Draw ship/asteroid ring (grey)
        ctx.beginPath();
        ctx.arc(this._scratchCenter.x, this._scratchCenter.y, this.shipRingRadius, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Draw jump gate ring (green)
        ctx.beginPath();
        ctx.arc(this._scratchCenter.x, this._scratchCenter.y, this.gateRingRadius, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Determine the current target
        let target = null;
        if (
            this.gameManager.cameraTarget &&
            this.gameManager.cameraTarget instanceof Ship &&
            isValidTarget(this.gameManager.cameraTarget, this.gameManager.cameraTarget.target)
        ) {
            target = this.gameManager.cameraTarget.target;
        }

        // Draw arrow for target if outside its ring
        if (target) {
            camera.worldToCamera(target.position, this._scratchCameraPos);
            const distSquared = this._scratchCameraPos.x * this._scratchCameraPos.x + this._scratchCameraPos.y * this._scratchCameraPos.y;
            const isGate = target instanceof JumpGate;
            const isAsteroid = target instanceof Asteroid;
            const isShip = target instanceof Ship;
            const ringRadius = isGate ? this.gateRingRadius : isAsteroid || isShip ? this.shipRingRadius : this.ringRadius;

            if (distSquared > ringRadius * ringRadius) {
                const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
                const arrowX = this._scratchCenter.x + Math.sin(angle) * ringRadius;
                const arrowY = this._scratchCenter.y - Math.cos(angle) * ringRadius;
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, -20);  // Tip pointing up
                ctx.lineTo(5, 0);    // Bottom right
                ctx.lineTo(-5, 0);   // Bottom left
                ctx.closePath();
                // Color based on target type
                if (isGate) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 1)';
                } else if (isAsteroid || isShip) {
                    ctx.fillStyle = target === this.gameManager.playerShip ? 'rgba(255, 255, 255, 1)' : 'rgba(128, 128, 128, 1)';
                } else if (target.type.type === 'star') {
                    ctx.fillStyle = 'rgba(255, 255, 0, 1)';
                } else {
                    ctx.fillStyle = 'rgba(0, 255, 255, 1)';
                }
                ctx.fill();
                ctx.restore();
            }
        }

        // Draw labels and arrows for celestial bodies
        for (let i = 0; i < this.gameManager.cameraTarget.starSystem.planets; i++) {
            this.drawLabelsAndArrows(ctx, camera, this.gameManager.cameraTarget.starSystem.planets[i], target);
        }
        for (let i = 0; i < this.gameManager.cameraTarget.starSystem.jumpGates; i++) {
            this.drawLabelsAndArrows(ctx, camera, this.gameManager.cameraTarget.starSystem.jumpGates[i], target);
        }
        for (let i = 0; i < this.gameManager.cameraTarget.starSystem.stars; i++) {
            this.drawLabelsAndArrows(ctx, camera, this.gameManager.cameraTarget.starSystem.stars[i], target);
        }

        // Draw arrows for ships outside their ring
        for (let i = 0; i < this.gameManager.cameraTarget.starSystem.ships; i++) {
            const ship = this.gameManager.cameraTarget.starSystem.ships[i];
            camera.worldToCamera(ship.position, this._scratchCameraPos);
            const distSquared = this._scratchCameraPos.x * this._scratchCameraPos.x + this._scratchCameraPos.y * this._scratchCameraPos.y;
            if ((distSquared > this.shipRingRadius * this.shipRingRadius) && (distSquared < this.maxRadius * maxRadius) && ship !== target) {
                const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
                const arrowX = this._scratchCenter.x + Math.sin(angle) * this.shipRingRadius;
                const arrowY = this._scratchCenter.y - Math.cos(angle) * this.shipRingRadius;
                const ringDist = Math.sqrt(distSquared) - this.shipRingRadius;
                const opacity = remapClamp(ringDist, this.maxRadius, 0, 0.2, 1);
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.moveTo(0, -10);  // Tip up
                ctx.lineTo(5, 0);    // Bottom right
                ctx.lineTo(-5, 0);   // Bottom left
                ctx.closePath();
                ctx.fillStyle = ship.pilot instanceof AIPilot ? 'rgba(128, 128, 128, 1)' : 'rgba(255, 255, 255, 1)';
                ctx.fill();
                ctx.restore();
            }
        }

        // Draw rectangle around the target
        if (target) {
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

        ctx.restore();
    }
}