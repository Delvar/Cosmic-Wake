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
     * Helper method to draw a stroke-filled arc based on rendering mode.
     * @param {CanvasRenderingContext2D} ctx - The primary canvas context.
     * @param {CanvasRenderingContext2D} outlineCtx - The outline canvas context.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     * @param {number} x - Center X coordinate.
     * @param {number} y - Center Y coordinate.
     * @param {number} radius - Radius of the arc.
     * @param {string} fillColour - Fill color (RGB string).
     * @param {string} strokeColour - Stroke color (RGB string).
     * @param {number} lineWidth - Line width in pixels.
     */
    drawArc(ctx, outlineCtx, useLayeredRendering, x, y, radius, fillColour, strokeColour, lineWidth) {
        if (useLayeredRendering) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0.0, TWO_PI);
            ctx.strokeStyle = strokeColour;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        } else {
            // Draw to foreground canvas directly with outline
            ctx.beginPath();
            ctx.arc(x, y, radius, 0.0, TWO_PI);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = lineWidth + 2.0;
            ctx.stroke();
            ctx.strokeStyle = strokeColour;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    /**
     * Helper method to draw text based on rendering mode.
     * @param {CanvasRenderingContext2D} ctx - The primary canvas context.
     * @param {CanvasRenderingContext2D} outlineCtx - The outline canvas context.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     * @param {string} text - Text to draw.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {string} fillColour - Fill color (RGB string).
     */
    drawText(ctx, outlineCtx, useLayeredRendering, text, x, y, fillColour = 'white') {
        const black = 'black';
        if (useLayeredRendering) {
            ctx.fillStyle = fillColour;
            ctx.fillText(text, x, y);
        } else {
            // Draw directly to foreground canvas with outline
            ctx.strokeStyle = black;
            ctx.lineWidth = 2.0;
            ctx.strokeText(text, x, y);
            ctx.fillStyle = fillColour;
            ctx.fillText(text, x, y);
        }
    }

    /**
     * Helper method to draw HUD text based on rendering mode.
     * Handles outline drawing in direct mode and layered rendering in HUD mode.
     * @param {CanvasRenderingContext2D} foregroundCtx - The foreground context.
     * @param {CanvasRenderingContext2D} hudCtx - The HUD context.
     * @param {CanvasRenderingContext2D} hudOutlineCtx - The HUD outline context.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     * @param {string} text - Text to draw.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {string} fillColour - Fill color (RGB string).
     * @param {string} textAlign - Text alignment ('left', 'center', 'right').
     */
    drawHudText(foregroundCtx, hudCtx, hudOutlineCtx, useLayeredRendering, text, x, y, fillColour = 'white', textAlign = 'center') {
        if (useLayeredRendering) {
            hudOutlineCtx.save();
            hudOutlineCtx.strokeStyle = 'black';
            hudOutlineCtx.lineWidth = 2.0;
            hudOutlineCtx.textAlign = textAlign;
            hudOutlineCtx.strokeText(text, x, y);
            hudOutlineCtx.restore();

            hudCtx.save();
            hudCtx.fillStyle = fillColour;
            hudCtx.textAlign = textAlign;
            hudCtx.fillText(text, x, y);
            hudCtx.restore();
        } else {
            foregroundCtx.save();
            foregroundCtx.strokeStyle = 'black';
            foregroundCtx.lineWidth = 2.0;
            foregroundCtx.textAlign = textAlign;
            foregroundCtx.strokeText(text, x, y);
            foregroundCtx.fillStyle = fillColour;
            foregroundCtx.fillText(text, x, y);
            foregroundCtx.restore();
        }
    }

    /**
     * Draws a circle around the targeted ship.
     * @param {CanvasRenderingContext2D} foregroundCtx - The foreground context.
     * @param {CanvasRenderingContext2D} hudCtx - The canvas rendering context.
     * @param {CanvasRenderingContext2D} hudOutlineCtx - The canvas rendering context for darker outlines.
     * @param {Camera} camera - The camera object for coordinate transformations.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     * @param {GameObject} [target=null] - The target object.
     */
    drawTargetCircle(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, target = null) {
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

        const scale = target instanceof Ship ? target.shipScale : 1.0;
        const radius = camera.worldToSize(target.radius * scale) + 5.0;

        let strokeColour = Colour.Neutral.toRGB();
        if (target instanceof Ship) {
            if (target.state === 'Disabled') {
                strokeColour = Colour.Disabled.toRGB();
            } else if (target.state === 'Exploding') {
                const now = Date.now();
                strokeColour = (Math.floor(now / 250) % 2 === 0)
                    ? Colour.Disabled.toRGB()
                    : Colour.Black.toRGB();
            } else {
                switch (this.gameManager.cameraTarget.getRelationship(target)) {
                    case FactionRelationship.Allied:
                        strokeColour = Colour.Allied.toRGB();
                        break;
                    case FactionRelationship.Neutral:
                        strokeColour = Colour.Neutral.toRGB();
                        break;
                    case FactionRelationship.Hostile:
                        strokeColour = Colour.Hostile.toRGB();
                        break;
                }
            }
        }

        if (useLayeredRendering) {
            hudCtx.save();
            hudOutlineCtx.save();

            hudCtx.beginPath();
            hudCtx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, 0.0, TWO_PI);
            hudCtx.lineWidth = 2.0;
            hudCtx.strokeStyle = strokeColour;
            hudCtx.stroke();

            hudOutlineCtx.beginPath();
            hudOutlineCtx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, 0.0, TWO_PI);
            hudOutlineCtx.lineWidth = 4.0;
            hudOutlineCtx.strokeStyle = Colour.Black.toRGB();
            hudOutlineCtx.stroke();
            hudOutlineCtx.lineWidth = 2.0;
            hudOutlineCtx.strokeStyle = Colour.White.toRGB();
            hudOutlineCtx.stroke();

            hudCtx.restore();
            hudOutlineCtx.restore();
        } else {
            foregroundCtx.save();
            foregroundCtx.beginPath();
            foregroundCtx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, 0.0, TWO_PI);
            foregroundCtx.lineWidth = 4.0;
            foregroundCtx.strokeStyle = Colour.Black.toRGB();
            foregroundCtx.stroke();
            foregroundCtx.lineWidth = 2.0;
            foregroundCtx.strokeStyle = strokeColour;
            foregroundCtx.stroke();
            foregroundCtx.restore();
        }

    }

    /**
     * Draws a navigational ring with arrows and optional name tags for objects in the star system.
     * @param {CanvasRenderingContext2D} foregroundCtx - The foreground context.
     * @param {CanvasRenderingContext2D} hudCtx - The HUD context.
     * @param {CanvasRenderingContext2D} hudOutlineCtx - The HUD outline context.
     * @param {Camera} camera - The camera object for world-to-screen coordinate transformations.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     * @param {Colour} ringColour - The color of the ring and arrows.
     * @param {number} ringRadius - The radius of the ring in screen space.
     * @param {GameObject[]} [objects=[]] - Array of game objects to draw arrows or names for.
     * @param {GameObject|null} [target=null] - The target object, which gets a larger arrow if outside the ring.
     */
    drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, ringColour, ringRadius, objects = [], target = null) {
        const white = 'white';
        const black = 'black';
        const colour = ringColour.toRGB();
        const outerRadius = ringRadius + this.ringLineWidth / 2.0;
        const arrowWidth = 5.0;
        const base = ringRadius - Math.sqrt(outerRadius * outerRadius - arrowWidth * arrowWidth) + 1.0;

        // Build ring path
        const ringPath = new Path2D();
        ringPath.arc(camera.screenCenter.x, camera.screenCenter.y, ringRadius, 0.0, TWO_PI);

        // Build arrows path by accumulating transformed arrow paths
        const arrowsPath = new Path2D();
        for (let i = 0.0; i < objects.length; i++) {
            const body = objects[i];
            if (body === this.gameManager.cameraTarget) continue;
            camera.worldToCamera(body.position, this._scratchCameraPos);
            const squareMagnitude = this._scratchCameraPos.squareMagnitude();

            if (squareMagnitude > ringRadius * ringRadius) {
                const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
                const arrowX = camera.screenCenter.x + Math.sin(angle) * ringRadius;
                const arrowY = camera.screenCenter.y - Math.cos(angle) * ringRadius;

                // Create arrow in local coordinates
                const arrowPath = new Path2D();
                arrowPath.moveTo(arrowWidth, base);

                if (body === target) {
                    arrowPath.lineTo(0.0, -20.0);
                } else {
                    const length = remapClamp(squareMagnitude, 0.0, this.maxRadius * this.maxRadius, -10.0, base);
                    arrowPath.lineTo(0.0, length);
                }
                arrowPath.lineTo(-arrowWidth, base);
                arrowPath.closePath();

                // Create transformation matrix for this arrow
                const transform = new DOMMatrix();
                transform.translateSelf(arrowX, arrowY);
                transform.rotateSelf(angle * 180 / Math.PI);

                // Add transformed arrow to main arrows path
                arrowsPath.addPath(arrowPath, transform);
            }
        }

        // Draw paths in order: outline first, then main shapes
        if (useLayeredRendering) {
            hudOutlineCtx.save();
            hudCtx.save();

            // 1. Draw ring black outline
            hudOutlineCtx.strokeStyle = black;
            hudOutlineCtx.lineWidth = this.ringLineWidth + 2.0;
            hudOutlineCtx.stroke(ringPath);

            // 2. Draw arrows black outline
            hudOutlineCtx.strokeStyle = black;
            hudOutlineCtx.lineWidth = 2.0;
            hudOutlineCtx.stroke(arrowsPath);

            // 3. Draw ring white infill
            hudOutlineCtx.strokeStyle = white;
            hudOutlineCtx.lineWidth = this.ringLineWidth;
            hudOutlineCtx.stroke(ringPath);

            // 4. Draw arrows white infill
            hudOutlineCtx.fillStyle = white;
            hudOutlineCtx.fill(arrowsPath);

            // 5. Draw ring colour
            hudCtx.strokeStyle = colour;
            hudCtx.lineWidth = this.ringLineWidth;
            hudCtx.stroke(ringPath);

            // 6. Draw arrows colour
            hudCtx.fillStyle = colour;
            hudCtx.lineWidth = 0.0;
            hudCtx.fill(arrowsPath);

            hudOutlineCtx.restore();
            hudCtx.restore();
        } else {
            foregroundCtx.save();

            // 1. Draw ring outline
            foregroundCtx.strokeStyle = black;
            foregroundCtx.lineWidth = this.ringLineWidth + 2.0;
            foregroundCtx.stroke(ringPath);

            // 2. Draw arrows outline
            foregroundCtx.strokeStyle = black;
            foregroundCtx.lineWidth = 2.0;
            foregroundCtx.stroke(arrowsPath);

            // 3. Draw ring
            foregroundCtx.strokeStyle = colour;
            foregroundCtx.lineWidth = this.ringLineWidth;
            foregroundCtx.stroke(ringPath);

            // 4. Draw arrows
            foregroundCtx.fillStyle = colour;
            foregroundCtx.fill(arrowsPath);

            foregroundCtx.restore();
        }
    }

    /**
     * Draws name tags for objects inside the given ring.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context for drawing.
     * @param {CanvasRenderingContext2D} outlineCtx - The canvas rendering context for darker outlines.
     * @param {Camera} camera - The camera object for world-to-screen coordinate transformations.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     * @param {number} ringRadius - The radius of the ring in screen space.
     * @param {GameObject[]} [objects=[]] - Array of game objects to draw names for.
     */
    drawNames(ctx, outlineCtx, camera, useLayeredRendering, ringRadius, objects = []) {
        ctx.save();
        ctx.fillStyle = Colour.White.toRGB();
        ctx.textAlign = 'center';

        if (useLayeredRendering) {
            ctx.strokeStyle = Colour.Black.toRGB();
            ctx.lineWidth = 2.0;
        } else {
            ctx.strokeStyle = Colour.Black.toRGB();
            ctx.lineWidth = 2.0;
        }

        for (let i = 0.0; i < objects.length; i++) {
            const body = objects[i];
            camera.worldToCamera(body.position, this._scratchCameraPos);
            const squareMagnitude = this._scratchCameraPos.squareMagnitude();
            if (squareMagnitude < ringRadius * ringRadius) {
                ctx.beginPath();
                camera.worldToScreen(body.position, this._scratchScreenPos);
                const scaledRadius = camera.worldToSize(body.radius);
                const textY = this._scratchScreenPos.y + scaledRadius + camera.worldToSize(20.0);
                ctx.strokeText(body.name, this._scratchScreenPos.x, textY);
                ctx.fillText(body.name, this._scratchScreenPos.x, textY);
            }
        }
        ctx.restore();
    }

    /**
     * Draws the autopilot status text at the top center of the screen.
     * @param {CanvasRenderingContext2D} foregroundCtx - The foreground context.
     * @param {CanvasRenderingContext2D} hudCtx - The HUD context.
     * @param {CanvasRenderingContext2D} hudOutlineCtx - The HUD outline context.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     */
    drawAutopilotStatus(foregroundCtx, hudCtx, hudOutlineCtx, useLayeredRendering) {
        const autopilotStatus = this.gameManager.cameraTarget?.pilot?.getStatus();
        if (!autopilotStatus) return;

        this.drawHudText(foregroundCtx, hudCtx, hudOutlineCtx, useLayeredRendering, autopilotStatus, this.size.width / 2.0, 20.0, Colour.White.toRGB(), 'center');
    }

    /**
     * Draws HUD elements like rings, arrows, and labels on the canvas.
     * @param {CanvasRenderingContext2D} foregroundCtx - The foreground context for direct rendering mode.
     * @param {CanvasRenderingContext2D} hudCtx - The canvas rendering context.
     * @param {CanvasRenderingContext2D} hudOutlineCtx - The canvas rendering context for darker outlines.
     * @param {Camera} camera - The camera object for coordinate transformations.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     */
    draw(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering = true) {
        if (useLayeredRendering) {
            hudCtx.clearRect(0, 0, this.size.width, this.size.height);
            hudOutlineCtx.clearRect(0, 0, this.size.width, this.size.height);
        }

        this.drawAutopilotStatus(foregroundCtx, hudCtx, hudOutlineCtx, useLayeredRendering);

        let target = null;
        if (
            this.gameManager.cameraTarget &&
            this.gameManager.cameraTarget instanceof Ship &&
            isValidTarget(this.gameManager.cameraTarget, this.gameManager.cameraTarget.target)
        ) {
            target = this.gameManager.cameraTarget.target;
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

        this.drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.jumpGateRingColour, this.jumpGateRingRadius, camera.starSystem.jumpGates, target);
        this.drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.planetRingColour, this.planetRingRadius, camera.starSystem.planets, target);
        this.drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.asteroidRingColour, this.asteroidRingRadius, camera.starSystem.asteroids, target);

        if (this._scratchAlliedShips.length > 0.0) {
            this.drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.shipAlliedRingColour, this.shipAlliedRingRadius, this._scratchAlliedShips, target);
        }
        if (this._scratchNeutralShips.length > 0.0) {
            this.drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.shipNeutralRingColour, this.shipNeutralRingRadius, this._scratchNeutralShips, target);
        }
        if (this._scratchHostileShips.length > 0.0) {
            this.drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.shipHostileRingColour, this.shipHostileRingRadius, this._scratchHostileShips, target);
        }
        if (this._scratchDisabledShips.length > 0.0) {
            this.drawRing(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.shipDisabledRingColour, this.shipDisabledRingRadius, this._scratchDisabledShips, target);
        }

        this.drawNames(hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.jumpGateRingRadius, camera.starSystem.jumpGates);
        this.drawNames(hudCtx, hudOutlineCtx, camera, useLayeredRendering, this.planetRingRadius, camera.starSystem.planets);

        if (target) {
            this.drawTargetCircle(foregroundCtx, hudCtx, hudOutlineCtx, camera, useLayeredRendering, target);
        }
    }
}