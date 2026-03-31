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
import { CargoContainer } from '/src/starSystem/cargoContainer.js';
import { Commodities } from '/src/core/commodity.js';
import { Asteroid } from '/src/starSystem/asteroidBelt.js';

const white = 'white';
const black = 'black';

/**
 * Manages the Heads-Up Display (HUD) showing rings and indicators for game objects.
 */
export class HeadsUpDisplay {
    /**
     * Creates a new HeadsUpDisplay instance.
     * @param {GameManager} gameManager - The game manager providing access to game state.
     * @param {Camera} camera - The camera object for coordinate transformations.
     * @param {boolean} useLayeredRendering - Whether to use layered rendering mode.
     */
    constructor(gameManager, camera, useLayeredRendering) {
        /** @type {GameManager} The game manager providing access to game state. */
        this.gameManager = gameManager;
        /** @type {Vector2D} The size of the HUD in pixels (width, height). */
        this.size = new Vector2D(camera.foregroundCanvas.width, camera.foregroundCanvas.height);
        /** @type {CanvasRenderingContext2D} The foreground context for direct rendering mode. */
        this.foregroundCtx = camera.foregroundCtx;
        /** @type {CanvasRenderingContext2D} The canvas rendering context. */
        this.hudCtx = camera.hudCtx;
        /** @type {CanvasRenderingContext2D} The canvas rendering context for darker outlines. */
        this.hudOutlineCtx = camera.hudOutlineCtx;
        /** @type {Camera} The camera object for coordinate transformations. */
        this.camera = camera;
        /** @type {boolean} Whether to use layered rendering mode. */
        this.useLayeredRendering = useLayeredRendering;
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
        /** @type {boolean} Should we show the navigation rings? */
        this.showNavigationRings = true;
        /** @type {boolean} Should we show the autopilot status? */
        this.showAutopilotStatus = true;
        /** @type {boolean} Should we show the camera target name?*/
        this.showCameraTargetName = false;

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
        this.resize(this.size.width, this.size.height);

        if (new.target === HeadsUpDisplay) Object.seal(this);
    }

    /**
     * Resizes the HUD rings based on new screen dimensions.
     * @param {number} width - New screen width in pixels.
     * @param {number} height - New screen height in pixels.
     */
    resize(width, height) {
        this.size.set(width, height);
        if (this.showNavigationRings) {
            this.shipDisabledRingRadius = Math.min(width, height) * 0.2;
            this.shipHostileRingRadius = this.shipDisabledRingRadius + this.ringLineSpace;
            this.shipNeutralRingRadius = this.shipHostileRingRadius + this.ringLineSpace;
            this.shipAlliedRingRadius = this.shipNeutralRingRadius + this.ringLineSpace;
            this.jumpGateRingRadius = Math.min(width, height) * 0.42;
            this.planetRingRadius = this.jumpGateRingRadius - this.ringLineSpace;
            this.asteroidRingRadius = this.planetRingRadius - this.ringLineSpace;
        }
    }

    /**
     * Helper method to draw HUD text based on rendering mode.
     * Handles outline drawing in direct mode and layered rendering in HUD mode.
     * @param {string} text - Text to draw.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {string} fillColour - Fill color (RGB string).
     * @param {string} textAlign - Text alignment ('left', 'center', 'right').
     */
    drawHudText(text, x, y, fillColour = white, textAlign = 'center') {
        if (this.useLayeredRendering) {
            this.hudCtx.save();
            this.hudOutlineCtx.save();

            this.hudCtx.fillStyle = fillColour;
            this.hudCtx.textAlign = /** @type {CanvasTextAlign} */ (textAlign);
            this.hudCtx.fillText(text, x, y);

            this.hudOutlineCtx.strokeStyle = black;
            this.hudOutlineCtx.fillStyle = white;
            this.hudOutlineCtx.lineWidth = 2.0;
            this.hudOutlineCtx.textAlign = /** @type {CanvasTextAlign} */ (textAlign);
            this.hudOutlineCtx.strokeText(text, x, y);
            this.hudOutlineCtx.fillText(text, x, y);

            this.hudOutlineCtx.restore();
            this.hudCtx.restore();
        } else {
            this.foregroundCtx.save();

            this.foregroundCtx.strokeStyle = black;
            this.foregroundCtx.fillStyle = fillColour;
            this.foregroundCtx.lineWidth = 2.0;
            this.foregroundCtx.textAlign = /** @type {CanvasTextAlign} */ (textAlign);
            this.foregroundCtx.strokeText(text, x, y);
            this.foregroundCtx.fillText(text, x, y);

            this.foregroundCtx.restore();
        }
    }

    /**
     * Draws a circle around the targeted ship.
     * @param {GameObject} [target=null] - The target object.
     */
    drawTargetCircle(target = null) {
        if (!target) {
            return;
        }

        if (target instanceof Ship && target.state === 'Landed') {
            return;
        }

        if (!this.camera.isInView(target.position, target.radius)) {
            return;
        }

        this.camera.worldToScreen(target.position, this._scratchScreenPos);

        const scale = target instanceof Ship ? target.shipScale : 1.0;
        const radius = this.camera.worldToSize(target.radius * scale) + 5.0;

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

        if (this.useLayeredRendering) {
            this.hudCtx.save();
            this.hudOutlineCtx.save();

            this.hudCtx.beginPath();
            this.hudCtx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, 0.0, TWO_PI);
            this.hudCtx.lineWidth = 2.0;
            this.hudCtx.strokeStyle = strokeColour;
            this.hudCtx.stroke();

            this.hudOutlineCtx.beginPath();
            this.hudOutlineCtx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, 0.0, TWO_PI);
            this.hudOutlineCtx.lineWidth = 4.0;
            this.hudOutlineCtx.strokeStyle = black;
            this.hudOutlineCtx.stroke();
            this.hudOutlineCtx.lineWidth = 2.0;
            this.hudOutlineCtx.strokeStyle = white;
            this.hudOutlineCtx.stroke();

            this.hudCtx.restore();
            this.hudOutlineCtx.restore();
        } else {
            this.foregroundCtx.save();

            this.foregroundCtx.beginPath();
            this.foregroundCtx.arc(this._scratchScreenPos.x, this._scratchScreenPos.y, radius, 0.0, TWO_PI);
            this.foregroundCtx.lineWidth = 4.0;
            this.foregroundCtx.strokeStyle = black;
            this.foregroundCtx.stroke();
            this.foregroundCtx.lineWidth = 2.0;
            this.foregroundCtx.strokeStyle = strokeColour;
            this.foregroundCtx.stroke();

            this.foregroundCtx.restore();
        }

    }

    /**
     * Draws a navigational ring with arrows and optional name tags for objects in the star system.
     * @param {Colour} ringColour - The color of the ring and arrows.
     * @param {number} ringRadius - The radius of the ring in screen space.
     * @param {GameObject[]} [objects=[]] - Array of game objects to draw arrows or names for.
     * @param {GameObject|null} [target=null] - The target object, which gets a larger arrow if outside the ring.
     */
    drawRing(ringColour, ringRadius, objects = [], target = null) {
        const colour = ringColour.toRGB();
        const outerRadius = ringRadius + this.ringLineWidth / 2.0;
        const arrowWidth = 5.0;
        const base = ringRadius - Math.sqrt(outerRadius * outerRadius - arrowWidth * arrowWidth) + 1.0;

        // Build ring path
        const ringPath = new Path2D();
        ringPath.arc(this.camera.screenCenter.x, this.camera.screenCenter.y, ringRadius, 0.0, TWO_PI);

        // Build arrows path by accumulating transformed arrow paths
        const arrowsPath = new Path2D();
        for (let i = 0.0; i < objects.length; i++) {
            const body = objects[i];
            if (body === this.gameManager.cameraTarget) continue;
            this.camera.worldToCamera(body.position, this._scratchCameraPos);
            const squareMagnitude = this._scratchCameraPos.squareMagnitude();

            if (squareMagnitude > ringRadius * ringRadius) {
                const angle = Math.atan2(this._scratchCameraPos.x, -this._scratchCameraPos.y);
                const arrowX = this.camera.screenCenter.x + Math.sin(angle) * ringRadius;
                const arrowY = this.camera.screenCenter.y - Math.cos(angle) * ringRadius;

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
        if (this.useLayeredRendering) {
            this.hudOutlineCtx.save();
            this.hudCtx.save();

            // 1. Draw ring black outline
            this.hudOutlineCtx.strokeStyle = black;
            this.hudOutlineCtx.lineWidth = this.ringLineWidth + 2.0;
            this.hudOutlineCtx.stroke(ringPath);

            // 2. Draw arrows black outline
            this.hudOutlineCtx.strokeStyle = black;
            this.hudOutlineCtx.lineWidth = 2.0;
            this.hudOutlineCtx.stroke(arrowsPath);

            // 3. Draw ring white infill
            this.hudOutlineCtx.strokeStyle = white;
            this.hudOutlineCtx.lineWidth = this.ringLineWidth;
            this.hudOutlineCtx.stroke(ringPath);

            // 4. Draw arrows white infill
            this.hudOutlineCtx.fillStyle = white;
            this.hudOutlineCtx.fill(arrowsPath);

            // 5. Draw ring colour
            this.hudCtx.strokeStyle = colour;
            this.hudCtx.lineWidth = this.ringLineWidth;
            this.hudCtx.stroke(ringPath);

            // 6. Draw arrows colour
            this.hudCtx.fillStyle = colour;
            this.hudCtx.lineWidth = 0.0;
            this.hudCtx.fill(arrowsPath);

            this.hudOutlineCtx.restore();
            this.hudCtx.restore();
        } else {
            this.foregroundCtx.save();

            // 1. Draw ring outline
            this.foregroundCtx.strokeStyle = black;
            this.foregroundCtx.lineWidth = this.ringLineWidth + 2.0;
            this.foregroundCtx.stroke(ringPath);

            // 2. Draw arrows outline
            this.foregroundCtx.strokeStyle = black;
            this.foregroundCtx.lineWidth = 2.0;
            this.foregroundCtx.stroke(arrowsPath);

            // 3. Draw ring
            this.foregroundCtx.strokeStyle = colour;
            this.foregroundCtx.lineWidth = this.ringLineWidth;
            this.foregroundCtx.stroke(ringPath);

            // 4. Draw arrows
            this.foregroundCtx.fillStyle = colour;
            this.foregroundCtx.fill(arrowsPath);

            this.foregroundCtx.restore();
        }
    }

    /**
     * Draws name tags for objects inside the given ring.
     * @param {number} ringRadius - The radius of the ring in screen space.
     * @param {GameObject[]} [objects=[]] - Array of game objects to draw names for.
     */
    drawNames(ringRadius, objects = []) {
        for (let i = 0.0; i < objects.length; i++) {
            const body = objects[i];
            this.camera.worldToCamera(body.position, this._scratchCameraPos);
            const squareMagnitude = this._scratchCameraPos.squareMagnitude();
            if (squareMagnitude < ringRadius * ringRadius) {
                this.camera.worldToScreen(body.position, this._scratchScreenPos);
                const scaledRadius = this.camera.worldToSize(body.radius);
                this._scratchScreenPos.y += scaledRadius + this.camera.worldToSize(20.0);
                this.drawHudText(body.name, this._scratchScreenPos.x, this._scratchScreenPos.y, Colour.White.toRGB(), 'center');
            }
        }
    }

    /**
     * Draws the autopilot status text at the top center of the screen.
     */
    drawAutopilotStatus(cameraTarget) {
        const autopilotStatus = cameraTarget?.pilot?.getStatus();
        if (!autopilotStatus) return;

        this.drawHudText(autopilotStatus, this.size.width / 2.0, 20.0, Colour.White.toRGB(), 'center');
    }

    /**
     * Draws the name of the targeted GameObject at the top center of the screen.
     */
    drawCameraTargetName(cameraTarget) {
        let targetName;

        if (cameraTarget instanceof CargoContainer) {
            targetName = `Container of ${Commodities[cameraTarget.commodityType].name}`;
        } else if (cameraTarget instanceof Ship || cameraTarget instanceof CelestialBody || cameraTarget instanceof Asteroid) {
            targetName = cameraTarget.name;
        } else {
            targetName = "Unnamed Object";
        }
        this.drawHudText(targetName, this.size.width / 2.0, 20.0, Colour.White.toRGB(), 'center');
    }

    /**
     * Draws the ship's shield and hull stats as bars at the bottom of the screen.
     * @param {Ship} ship - The ship object to get the stats from.
     */
    drawShipStats(ship) {
        const shieldRatio = remapClamp(ship.shield.strength, 0.0, ship.shield.maxStrength, 0.0, 1.0);
        const hullRatio = remapClamp(ship.hullIntegrity, 0.0, ship.maxHull, 0.0, 1.0);
        const barHeight = 8.0;
        const barGap = 8.0;
        const barWidth = Math.round(this.camera.screenSize.width - barGap * 2.0);
        let top = Math.round(this.camera.screenSize.height - barGap - barHeight);
        let width = Math.round(barWidth * shieldRatio * 0.5);

        // Shield bar
        let shieldFillColor = Colour.Blue;
        if (ship.shield.rapidRechargeEffectTime > 0.0) {
            const now = Date.now();
            shieldFillColor = (Math.floor(now / 100) % 2 === 0) ? Colour.BlueLight : Colour.Blue;
        }
        this.drawBar(barGap, top, barWidth, barHeight, Colour.BlueDark, shieldFillColor, width * 2.0);

        // Hull bar
        top = top - barGap - barHeight;
        width = Math.round(barWidth * hullRatio * 0.5);
        let hullFillColor = Colour.Green;
        if (ship.protectionTime > 0.0) {
            const now = Date.now();
            hullFillColor = (Math.floor(now / 100) % 2 === 0) ? Colour.GreenLight : Colour.Green;
        }
        this.drawBar(barGap, top, barWidth, barHeight, Colour.GreenDark, hullFillColor, width * 2.0);
    }

    /**
     * Draws a bar with background and centred fill.
     * @param {number} x - X position of the bar.
     * @param {number} y - Y position of the bar.
     * @param {number} width - Width of the bar.
     * @param {number} height - Height of the bar.
     * @param {Colour} backgroundColor - Background color of the bar.
     * @param {Colour} fillColor - Fill color of the bar.
     * @param {number} fillWidth - Width of the fill area (centred).
     */
    drawBar(x, y, width, height, backgroundColor, fillColor, fillWidth) {
        const centerX = x + width / 2.0;
        const halfFill = fillWidth / 2.0;

        if (this.useLayeredRendering) {
            this.hudOutlineCtx.save();
            this.hudCtx.save();

            this.hudCtx.fillStyle = backgroundColor.toRGB();
            this.hudCtx.fillRect(x, y, width, height);
            this.hudCtx.fillStyle = fillColor.toRGB();
            this.hudCtx.fillRect(centerX - halfFill, y, fillWidth, height);

            this.hudOutlineCtx.fillStyle = white;
            this.hudOutlineCtx.fillRect(x, y, width, height);
            this.hudOutlineCtx.strokeStyle = black;
            this.hudOutlineCtx.lineWidth = 1.0;
            this.hudOutlineCtx.strokeRect(x - 0.5, y - 0.5, width + 1.0, height + 1.0);

            this.hudOutlineCtx.restore();
            this.hudCtx.restore();
        } else {
            this.foregroundCtx.save();

            this.foregroundCtx.fillStyle = backgroundColor.toRGB();
            this.foregroundCtx.fillRect(x, y, width, height);
            this.foregroundCtx.fillStyle = fillColor.toRGB();
            this.foregroundCtx.fillRect(centerX - halfFill, y, fillWidth, height);

            this.foregroundCtx.strokeStyle = black;
            this.foregroundCtx.lineWidth = 1.0;
            this.foregroundCtx.strokeRect(x - 0.5, y - 0.5, width + 1.0, height + 1.0);
            this.foregroundCtx.restore();
        }
    }

    /**
     * Draws HUD elements like rings, arrows, and labels on the canvas.
     * @param {GameObject|null} cameraTarget - The camera target object.
     */
    draw(cameraTarget = null) {
        if (this.useLayeredRendering) {
            this.hudCtx.clearRect(0, 0, this.size.width, this.size.height);
            this.hudOutlineCtx.clearRect(0, 0, this.size.width, this.size.height);
        }

        if (cameraTarget instanceof Ship) {
            this.drawShipStats(cameraTarget);
        }

        if (cameraTarget) {
            if (!this.camera.starSystem) {
                this.camera.starSystem = cameraTarget.starSystem;
            }
        }

        if (!this.camera.starSystem) {
            return;
        }

        let target = null;
        if (cameraTarget instanceof Ship && isValidTarget(cameraTarget, cameraTarget.target)) {
            target = cameraTarget.target;
        }

        if (this.showNavigationRings) {
            this._scratchAlliedShips.length = 0.0;
            this._scratchNeutralShips.length = 0.0;
            this._scratchHostileShips.length = 0.0;
            this._scratchDisabledShips.length = 0.0;

            if (cameraTarget instanceof Ship) {
                for (let i = 0.0; i < this.camera.starSystem.ships.length; i++) {
                    const ship = this.camera.starSystem.ships[i];

                    if (ship.state !== 'Flying' && ship.state !== 'Disabled') {
                        continue;
                    }

                    if (ship.state === 'Disabled') {
                        this._scratchDisabledShips.push(ship);
                    }

                    switch (cameraTarget.getRelationship(ship)) {
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
                this._scratchNeutralShips.push(...this.camera.starSystem.ships);
            }

            this.drawRing(this.jumpGateRingColour, this.jumpGateRingRadius, this.camera.starSystem.jumpGates, target);
            this.drawRing(this.planetRingColour, this.planetRingRadius, this.camera.starSystem.planets, target);
            this.drawRing(this.asteroidRingColour, this.asteroidRingRadius, this.camera.starSystem.asteroids, target);

            if (this._scratchAlliedShips.length > 0.0) {
                this.drawRing(this.shipAlliedRingColour, this.shipAlliedRingRadius, this._scratchAlliedShips, target);
            }
            if (this._scratchNeutralShips.length > 0.0) {
                this.drawRing(this.shipNeutralRingColour, this.shipNeutralRingRadius, this._scratchNeutralShips, target);
            }
            if (this._scratchHostileShips.length > 0.0) {
                this.drawRing(this.shipHostileRingColour, this.shipHostileRingRadius, this._scratchHostileShips, target);
            }
            if (this._scratchDisabledShips.length > 0.0) {
                this.drawRing(this.shipDisabledRingColour, this.shipDisabledRingRadius, this._scratchDisabledShips, target);
            }

            this.drawNames(this.jumpGateRingRadius, this.camera.starSystem.jumpGates);
            this.drawNames(this.planetRingRadius, this.camera.starSystem.planets);

            if (target) {
                this.drawTargetCircle(target);
            }
        }
        if (this.showAutopilotStatus) {
            this.drawAutopilotStatus(cameraTarget);
        }

        if (this.showCameraTargetName) {
            this.drawCameraTargetName(cameraTarget);
        }
    }
}