// headsUpDisplay.js

import { Vector2D } from './vector2d.js';
import { Ship } from './ship.js';
import { JumpGate } from './celestialBody.js';
import { AIPilot } from './pilot.js';
import { Asteroid } from './asteroidBelt.js';

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
        this.size = new Vector2D(0, 0);
        this.size.set(width, height);
        this.ringRadius = Math.min(width, height) / 3;        // Ring for planets (light blue)
        this.shipRingRadius = Math.min(width, height) / 5.5;  // Ring for ships/asteroids (grey)
        this.gateRingRadius = Math.min(width, height) / 2.5;  // Ring for jump gates (green)
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
    draw(ctx, camera) {
        const center = camera.getScreenCenter();
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
        ctx.arc(center.x, center.y, this.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Draw ship/asteroid ring (grey)
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.shipRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Draw jump gate ring (green)
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.gateRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Utility to remap and clamp values for opacity calculations
        const remapClamp = (val, inMin, inMax, outMin, outMax) =>
            Math.min(Math.max((outMax - outMin) * (val - inMin) / (inMax - inMin) + outMin, outMin), outMax);
        const maxRadius = 5000; // Maximum distance for arrow visibility

        // Determine the current target
        let target = this.gameManager.playerShip.target;
        if (this.gameManager.cameraTarget instanceof Ship && this.gameManager.targetingSystem.isValidTarget(this.gameManager.cameraTarget)) {
            target = this.gameManager.cameraTarget.target;
        }

        // Draw arrow for target if outside its ring
        if (target && this.gameManager.targetingSystem.isValidTarget(target)) {
            const cameraPos = camera.worldToCamera(target.position);
            const distSquared = cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y;
            const isGate = target instanceof JumpGate;
            const isAsteroid = target instanceof Asteroid;
            const isShip = target instanceof Ship;
            const ringRadius = isGate ? this.gateRingRadius : isAsteroid || isShip ? this.shipRingRadius : this.ringRadius;

            if (distSquared > ringRadius * ringRadius) {
                const angle = Math.atan2(cameraPos.y, cameraPos.x);
                const arrowX = center.x + Math.cos(angle) * ringRadius;
                const arrowY = center.y + Math.sin(angle) * ringRadius;
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
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
        this.gameManager.cameraTarget.starSystem.celestialBodies.forEach(body => {
            const cameraPos = camera.worldToCamera(body.position);
            const distSquared = cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y;
            const screenPos = camera.worldToScreen(body.position);
            const isGate = body instanceof JumpGate;
            const radius = isGate ? this.gateRingRadius : this.ringRadius;

            // Label for bodies inside their ring
            if (distSquared < radius * radius && body.name) {
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'white';
                ctx.font = `${camera.worldToSize(16)}px Arial`;
                ctx.textAlign = 'center';
                const scaledRadius = camera.worldToSize(body.radius);
                ctx.fillText(body.name, screenPos.x, screenPos.y + scaledRadius + camera.worldToSize(20));
                ctx.restore();
            }

            // Arrow for bodies outside their ring but within maxRadius
            if ((distSquared > radius * radius) && (distSquared < maxRadius * maxRadius) && body !== target) {
                const angle = Math.atan2(cameraPos.y, cameraPos.x);
                const arrowX = center.x + Math.cos(angle) * radius;
                const arrowY = center.y + Math.sin(angle) * radius;
                const ringDist = Math.sqrt(distSquared) - radius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
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
        });

        // Draw arrows for ships outside their ring
        this.gameManager.cameraTarget.starSystem.ships.forEach(ship => {
            const cameraPos = camera.worldToCamera(ship.position);
            const distSquared = cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y;
            if ((distSquared > this.shipRingRadius * this.shipRingRadius) && (distSquared < maxRadius * maxRadius) && ship !== target) {
                const angle = Math.atan2(cameraPos.y, cameraPos.x);
                const arrowX = center.x + Math.cos(angle) * this.shipRingRadius;
                const arrowY = center.y + Math.sin(angle) * this.shipRingRadius;
                const ringDist = Math.sqrt(distSquared) - this.shipRingRadius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
                ctx.closePath();
                ctx.fillStyle = ship.pilot instanceof AIPilot ? 'rgba(128, 128, 128, 1)' : 'rgba(255, 255, 255, 1)';
                ctx.fill();
                ctx.restore();
            }
        });

        // Draw rectangle around the target
        if (target && this.gameManager.targetingSystem.isValidTarget(target)) {
            const targetScreenPos = camera.worldToScreen(target.position);
            const size = target instanceof Ship ? 20 : target.radius + 10 || target.size + 10;
            const scaledSize = (camera.worldToSize(size) * 2);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(
                targetScreenPos.x - scaledSize / 2,
                targetScreenPos.y - scaledSize / 2,
                scaledSize,
                scaledSize
            );
            ctx.stroke();
        }

        ctx.restore();
    }
}