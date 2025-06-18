// /src/core/game.js

import { remapClamp } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Camera, TargetCamera } from '/src/camera/camera.js';
import { Ship } from '/src/ship/ship.js';
import { createRandomShip, createRandomFastShip, Flivver, Shuttle, HeavyShuttle, StarBarge, Freighter, Arrow, Boxwing, Interceptor, Fighter } from '/src/ship/shipTypes.js';
import { StarField } from '/src/camera/starField.js';
import { HeadsUpDisplay } from '/src/camera/headsUpDisplay.js';
import { PlayerPilot } from '/src/pilot/pilot.js';
import { createGalaxy } from '/src/core/galaxy.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { AiPilot, CivilianAiPilot, PirateAiPilot, OfficerAiPilot } from '/src/pilot/aiPilot.js';
import { WandererJob } from '/src/job/wandererJob.js';
import { MinerJob } from '/src/job/minerJob.js';
import { PirateJob } from '/src/job/pirateJob.js';
import { OfficerJob } from '/src/job/officerJob.js';
import { CelestialBody, Planet } from '/src/starSystem/celestialBody.js';
import { StarSystem } from '/src/starSystem/starSystem.js';
import { EscortJob } from '/src/job/escortJob.js';
import { FactionManager, FactionRelationship } from './faction.js';
import { Colour } from '/src/core/colour.js';
//import { wrapCanvasContext } from '/src/core/utils.js';

/**
 * Handles the game loop, rendering, and updates for the game.
 */
export class Game {
    /**
     * Creates a new Game instance.
     * @param {GameManager} manager - The game manager providing game state.
     */
    constructor(manager) {
        /** @type {GameManager} The game manager providing access to game state. */
        this.manager = manager;
        /** @type {TargetCamera} The camera for the target view, managed by the game manager. */
        this.targetCamera = manager.targetCamera;
        /** @type {Camera} The main camera for the game, managed by the game manager. */
        this.mainCamera = manager.mainCamera;
        /** @type {StarField} The starfield for rendering background stars, managed by the game manager. */
        this.starField = manager.starField;
        /** @type {HeadsUpDisplay} The HUD for displaying game information, managed by the game manager. */
        this.hud = manager.hud;
        /** @type {number} The timestamp of the last frame, used for timing calculations. */
        this.lastTime = performance.now();
        /** @type {number} The number of frames rendered since the last FPS update. */
        this.frameCount = 0.0;
        /** @type {number} The calculated frames per second (FPS) for the game. */
        this.fps = 0.0;
        /** @type {number} The timestamp of the last FPS update. */
        this.lastFpsUpdate = performance.now();
        /** @type {number} Target frame rate for game logic. */
        this.targetFps = 60.0;
        /** @type {number} Approximately 0.01667 seconds (16.67 ms) */
        this.fixedDeltaTime = 1 / this.targetFps;
        /** @type {number} Accumulator to track elapsed time (in seconds) */
        this.timeAccumulator = 0.0;
        /** @type {number} Timer for controlling zoom text display duration. */
        this.zoomTextTimer = 0.0;
        /** @type {Function} The bound game loop function for rendering and updating the game. */
        this.gameLoop = this.gameLoop.bind(this);
        // Initialize canvas size
        this.resizeMainCamera();
        this.resizeTargetCamera();
        //this.targetCamera.resize(200.0, 200.0);
        if (new.target === Game) Object.seal(this);
    }

    /**
     * Resizes the main camera and its canvas and updates related components when the window size changes.
     */
    resizeMainCamera() {
        this.mainCamera.resize(window.innerWidth, window.innerHeight);
        this.hud.resize(window.innerWidth, window.innerHeight);
    }

    /**
     * Resizes the main camera and its canvas and updates related components when the window size changes.
     */
    resizeTargetCamera() {
        const parent = this.targetCamera.foregroundCanvas.parentElement;
        this.targetCamera.resize(parent.clientWidth, parent.clientHeight);
    }

    /**
     * The main game loop
     * @param {number} currentTime - The current time from requestAnimationFrame.
     */
    gameLoop(currentTime) {
        // Initialize lastTime if not set
        if (!this.lastTime) {
            this.lastTime = currentTime;
        }

        const deltaTime = (currentTime - this.lastTime) / 1000.0;
        this.lastTime = currentTime;
        let renderStarfield = false;

        // Clamp deltaTime to prevent large jumps
        const maxDeltaTime = 0.1;
        this.timeAccumulator += Math.min(deltaTime, maxDeltaTime);

        // Update game logic and render starfield at fixed 60 FPS
        while (this.timeAccumulator >= this.fixedDeltaTime) {
            this.update(this.fixedDeltaTime);
            renderStarfield = true;
            this.timeAccumulator -= this.fixedDeltaTime;
        }

        let fadeout = 1.0;
        if (this.manager.cameraTarget instanceof Ship && (
            this.manager.cameraTarget.state === 'JumpingOut' ||
            this.manager.cameraTarget.state === 'JumpingIn'
        )) {
            const ship = this.manager.cameraTarget;
            if (ship.state === 'JumpingOut') {
                fadeout = remapClamp(ship.animationTime, 0.0, ship.animationJumpingDuration, 1.0, 0.5) ** 2.0;
            } else if (ship.state === 'JumpingIn') {
                fadeout = remapClamp(ship.animationTime, 0.0, ship.animationJumpingDuration, 0.5, 1.0) ** 2.0;
            }
            fadeout *= (deltaTime * 50.0);
            renderStarfield = true;
        }

        if (renderStarfield) {
            // Render starfield to background canvas
            if (this.starField && this.mainCamera.backgroundCtx) {

                // Draw starfield for main camera
                this.starField.draw(this.mainCamera.backgroundCtx, this.mainCamera, fadeout);

                // Draw starfield for target camera (if visible)
                if (this.targetCamera && this.targetCamera.foregroundCanvas.parentElement.style.display !== 'none') {
                    this.starField.draw(this.targetCamera.backgroundCtx, this.targetCamera, 1.0);
                }
            }
        }

        // Render game to foreground canvas at variable frame rate
        this.render(deltaTime);

        requestAnimationFrame(this.gameLoop);
    }

    /**
     * Starts the game loop, which continuously updates and renders the game.
     */
    start() {
        requestAnimationFrame(this.gameLoop);
    }

    /**
     * Updates the game state based on the elapsed time.
     * @param {number} deltaTime - Time elapsed since the last update in milliseconds.
     */
    update(deltaTime) {
        if (!this.manager.isFocused) return;

        this.manager.update(deltaTime);
        if (this.manager.cameraTarget && !this.manager.cameraTarget.despawned) {
            this.mainCamera.update(this.manager.cameraTarget.starSystem, this.manager.cameraTarget.position);
        }

        if (this.manager.zoomTextTimer > 0.0) {
            this.manager.zoomTextTimer -= deltaTime;
        }

        if (this.manager.cameraTarget instanceof Ship && this.manager.cameraTarget.target) {
            this.targetCamera.updateTarget(this.manager.cameraTarget.target);
        }
    }

    /**
     * Draws the ships Shields and Hull to the screen
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object for world-to-screen conversion.
     * @param {Ship} ship - The ship object to get the stats from.
     */
    drawShipStats(ctx, camera, ship) {
        ctx.save();
        const shieldRatio = remapClamp(ship.shield.strength, 0.0, ship.shield.maxStrength, 0.0, 1.0);
        const hullRatio = remapClamp(ship.hullIntegrity, 0.0, ship.maxHull, 0.0, 1.0);
        const centerX = camera.screenCenter.x;
        const barHeight = 8.0;
        const barGap = 8.0;
        const barWidth = camera.screenSize.width - barGap * 2.0;
        let top = camera.screenSize.height - barGap - barHeight;
        let width = Math.round(barWidth * shieldRatio * 0.5);
        //ctx.shadowBlur =  0.0;
        ctx.fillStyle = Colour.BlueDark.toRGB();
        ctx.fillRect(barGap, top, barWidth, barHeight);
        //ctx.shadowBlur =  8.0;
        //ctx.shadowColor = 'rgba(64,  64.0,  255.0, 0.75)';
        if (ship.shield.rapidRechargeEffectTime > 0.0) {
            const now = Date.now();
            ctx.fillStyle = (Math.floor(now / 100) % 2 === 0)
                ? Colour.BlueLight.toRGB()
                : Colour.Blue.toRGB();
        } else {
            ctx.fillStyle = Colour.Blue.toRGB();
        }
        ctx.fillRect(centerX - width, top, width * 2.0, barHeight);

        top = top - barGap - barHeight;
        width = Math.round(barWidth * hullRatio * 0.5);
        //ctx.shadowBlur =  0.0;
        ctx.fillStyle = Colour.GreenDark.toRGB();
        ctx.fillRect(barGap, top, barWidth, barHeight);
        //ctx.shadowColor = 'rgba(64,  255.0,  64.0, 0.75)';
        //ctx.shadowBlur =  8.0;
        if (ship.protectionTime > 0.0) {
            const now = Date.now();
            ctx.fillStyle = (Math.floor(now / 100) % 2 === 0)
                ? Colour.GreenLight.toRGB()
                : Colour.Green.toRGB();
        } else {
            ctx.fillStyle = Colour.Green.toRGB();
        }
        ctx.fillRect(centerX - width, top, width * 2.0, barHeight);
        ctx.restore();
    }

    /**
     * Renders the game state to the canvas.
     * @param {number} deltaTime - Time elapsed since the last render in seconds.
     */
    render(deltaTime) {

        const currentTime = performance.now();
        if (currentTime - this.lastFpsUpdate >= 1000.0) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0.0;
            this.lastFpsUpdate = currentTime;
        }
        this.frameCount++;

        const camera = this.mainCamera;
        const ctx = camera.foregroundCtx;

        ctx.save();
        ctx.clearRect(0.0, 0.0, camera.screenSize.width, camera.screenSize.height);

        const cameraTarget = this.manager.cameraTarget;
        if (!cameraTarget || cameraTarget.despawned) {
            this.manager.cameraTarget = null;
        }

        const starSystem = camera.starSystem;
        if (!starSystem) {
            //throw new Error('No starSystem on this.camera');
            return;
        }
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(ctx, this.mainCamera);
        for (let i = 0.0; i < starSystem.stars.length; i++) {
            starSystem.stars[i].draw(ctx, camera);
        }
        for (let i = 0.0; i < starSystem.planets.length; i++) {
            starSystem.planets[i].draw(ctx, camera);
        }
        for (let i = 0.0; i < starSystem.jumpGates.length; i++) {
            starSystem.jumpGates[i].draw(ctx, camera);
        }
        for (let i = 0.0; i < starSystem.ships.length; i++) {
            starSystem.ships[i].draw(ctx, camera);
        }
        starSystem.projectileManager.draw(ctx, camera);
        starSystem.particleManager.draw(ctx, camera);

        ctx.save();
        ctx.fillStyle = Colour.White.toRGB();
        ctx.strokeStyle = Colour.Black.toRGB();
        ctx.textAlign = 'left';
        ctx.strokeText(`FPS: ${this.fps}`, 20.0, 20.0);
        ctx.fillText(`FPS: ${this.fps}`, 20.0, 20.0);
        // 144 FPS = 0.00694 s
        // 120 FPS = 0.00833 s
        // 72 FPS =  0.01389 s
        // 60 FPS =  0.01667 s
        // 36 FPS =  0.02778 s
        // 30 FPS =  0.03333 s
        const maxFrameTime = 0.03333;
        const barWidth = Math.min(deltaTime / maxFrameTime, 1.0) * 150.0;
        ctx.fillStyle =
            deltaTime > 0.03333 ? Colour.RedDark.toRGB() :
                deltaTime > 0.02778 ? Colour.Red.toRGB() :
                    deltaTime > 0.01667 ? Colour.RedLight.toRGB() :
                        deltaTime > 0.01389 ? Colour.Yellow.toRGB() :
                            deltaTime > 0.00833 ? Colour.Orange.toRGB() :
                                Colour.Green.toRGB();
        ctx.fillRect(10, 25.0, barWidth, 10.0);
        ctx.restore();

        if (this.manager.zoomTextTimer > 0.0) {
            ctx.save();
            ctx.fillStyle = Colour.White.toRGB();
            ctx.textAlign = 'right';
            const zoomPercent = Math.round(camera.zoom * 100.0);
            ctx.strokeText(`${zoomPercent}%`, camera.screenSize.width - 20.0, 20.0);
            ctx.fillText(`${zoomPercent}%`, camera.screenSize.width - 20.0, 20.0);
            ctx.restore();
        }

        this.hud.draw(camera.hudCtx, camera);
        if (cameraTarget && cameraTarget instanceof Ship && !cameraTarget.despawned && (cameraTarget.state === 'Flying' || cameraTarget.state === 'Disabled')) {
            this.drawShipStats(camera.hudCtx, camera, cameraTarget);
        }
        this.renderTargetView();

        ctx.restore();
    }

    /**
     * Renders the target view in the target canvas if a valid target is selected.
     */
    renderTargetView() {
        //Ensure target is valid, if not hide the window
        let target = null;
        if (
            this.manager.cameraTarget &&
            this.manager.cameraTarget instanceof Ship &&
            isValidTarget(this.manager.cameraTarget, this.manager.cameraTarget.target)) {
            target = this.manager.cameraTarget.target;
        };

        const camera = this.targetCamera;
        const ctx = camera.foregroundCtx;
        const parent = camera.foregroundCanvas.parentElement;

        if (!target) {
            if (parent.style.display !== 'none') {
                parent.style.display = 'none';
            }
            return;
        } else {
            if (parent.style.display !== 'block') {
                parent.style.display = 'block';
            }
        }

        if (this.manager.cameraTarget.target instanceof Ship) {
            switch (this.manager.cameraTarget.getRelationship(this.manager.cameraTarget.target)) {
                case FactionRelationship.Allied:
                    parent.style.outlineColor = Colour.Allied.toRGB();
                    break;
                case FactionRelationship.Neutral:
                    parent.style.outlineColor = Colour.Neutral.toRGB();
                    break;
                case FactionRelationship.Hostile:
                    parent.style.outlineColor = Colour.Hostile.toRGB();
                    break;
            }
        } else {
            parent.style.outlineColor = Colour.Neutral.toRGB();
        }

        ctx.clearRect(0.0, 0.0, camera.screenSize.width, camera.screenSize.height);

        const starSystem = target.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(ctx, this.targetCamera);
        for (let i = 0.0; i < starSystem.stars.length; i++) {
            starSystem.stars[i].draw(ctx, camera);
        }
        for (let i = 0.0; i < starSystem.planets.length; i++) {
            starSystem.planets[i].draw(ctx, camera);
        }
        for (let i = 0.0; i < starSystem.jumpGates.length; i++) {
            starSystem.jumpGates[i].draw(ctx, camera);
        }
        for (let i = 0.0; i < starSystem.ships.length; i++) {
            starSystem.ships[i].draw(ctx, camera);
        }
        starSystem.projectileManager.draw(ctx, camera);
        starSystem.particleManager.draw(ctx, camera);
        const targetName = (target instanceof Ship || target instanceof CelestialBody) ? target.name : "Unnamed Object";
        ctx.fillStyle = Colour.White.toRGB();
        ctx.strokeStyle = Colour.Black.toRGB();
        ctx.textAlign = "center";
        ctx.strokeText(targetName, camera.screenCenter.width, 20.0);
        ctx.fillText(targetName, camera.screenCenter.width, 20.0);

        if (target && target instanceof Ship && !target.despawned && (target.state === 'Flying' || target.state === 'Disabled')) {
            this.drawShipStats(camera.hudCtx, camera, target);
        }
    }
}

/**
 * Manages the overall game state, including initialization, event handling, and updates.
 */
export class GameManager {
    /**
     * Creates a new GameManager instance.
     */
    constructor() {
        /** @type {boolean} Enables or disables debug mode for the game. */
        this.debug = false;

        const mainCameraForegroundCanvas = document.getElementById('mainCameraForeground');
        const mainCameraBackgroundCanvas = document.getElementById('mainCameraBackground');
        const mainCameraHudCanvas = document.getElementById('mainCameraHud');
        const targetCameraForegroundCanvas = document.getElementById('targetCameraForeground');
        const targetCameraBackgroundCanvas = document.getElementById('targetCameraBackground');
        const targetCameraHudCanvas = document.getElementById('targetCameraHud');

        /** @type {Camera} The main camera tracking the player's ship. */
        this.mainCamera = new Camera(mainCameraForegroundCanvas, mainCameraBackgroundCanvas, mainCameraHudCanvas, 1.0);
        /** @type {TargetCamera} The camera for the target view, rendering a secondary perspective. */
        this.targetCamera = new TargetCamera(targetCameraForegroundCanvas, targetCameraBackgroundCanvas, targetCameraHudCanvas, 1.0);
        /** @type {Ship} The current target for the camera, typically the player's ship. */
        this.cameraTarget = null;

        /** @type {Object.<string, boolean>} Tracks the current state of keyboard inputs. */
        this.keys = {};
        /** @type {Object.<string, boolean>} Tracks the previous state of keyboard inputs for detecting changes. */
        this.lastKeys = {};
        /** @type {boolean} Indicates whether the game window is currently focused. */
        this.isFocused = true;
        /** @type {Array.<StarSystem>} The galaxy containing star systems for the game. */
        this.galaxy = createGalaxy();
        // The planet to spawn the player at
        const spawnPlanet = this.galaxy[0].planets[2];
        /** @type {FactionManager} The faction manager instance. */
        this.factionManager = new FactionManager();
        this.initializeFactions();
        /** @type {Ship} The player's ship, positioned relative to a planet. */
        this.playerShip = new Interceptor(spawnPlanet.position.x + spawnPlanet.radius * 1.5, spawnPlanet.position.y, this.galaxy[0], this.factionManager.getFaction('Player'));
        /** @type {PlayerPilot} The pilot controlling the player's ship. */
        this.playerPilot = new PlayerPilot(this.playerShip);
        this.cameraTarget = this.playerShip;
        /** @type {StarField} The starfield for rendering background stars. */
        this.starField = new StarField(20, 1000.0, 5.0);
        /** @type {HeadsUpDisplay} The HUD for displaying game information. */
        this.hud = new HeadsUpDisplay(this, window.innerWidth, window.innerHeight);
        /** @type {number} Timer for controlling zoom text display duration. */
        this.zoomTextTimer = 0.0;
        /** @type {number} Timestamp of the last AI ship spawn. */
        this.lastSpawnTime = performance.now();
        /** @type {number} Interval between AI ship spawns, randomized for variety. */
        this.spawnInterval = this.randomSpawnInterval();
        /** @type {Game} The game instance managing rendering and updates. */
        this.game = new Game(this);

        // Temporary scratch values to avoid allocations
        /** @type {Vector2D} Scratch vector for calculating spawn positions in spawnAiShips. */
        this._scratchSpawnPos = new Vector2D(0.0, 0.0);

        // Initialize escort ship with AI pilot and matching colors
        const escort01 = new Interceptor(spawnPlanet.position.x - spawnPlanet.radius * 1.0, spawnPlanet.position.y, this.galaxy[0], this.playerShip.faction);
        const pilot01 = new OfficerAiPilot(escort01, new EscortJob(escort01, this.playerShip));
        escort01.setPilot(pilot01);
        escort01.colors.cockpit = this.playerShip.colors.cockpit;
        escort01.colors.wings = this.playerShip.colors.wings;
        escort01.colors.hull = this.playerShip.colors.hull;
        escort01.trail.color = this.playerShip.trail.color;
        this.galaxy[0].addGameObject(escort01);
        this.playerShip.setTarget(escort01);
        this.playerShip.turretMode = 'Target-only';

        // Set player pilot
        this.playerShip.pilot = this.playerPilot;
        this.galaxy[0].ships.push(this.playerShip);

        // Initialize game systems
        this.spawnAiShips();
        this.setupEventListeners();
        this.game.start();
        if (new.target === GameManager) Object.seal(this);
    }

    /**
     * Updates the game state, including ships and asteroid belts, and handles AI spawning.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        const currentTime = performance.now();
        this.updateGalaxy(deltaTime);
        this.spawnAiShipsIfNeeded(currentTime);
    }

    /**
     * Updates all ships and asteroids in the galaxy.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    updateGalaxy(deltaTime) {
        for (let galaxyIndex = 0.0, galaxyLength = this.galaxy.length; galaxyIndex < galaxyLength; ++galaxyIndex) {
            const starSystem = this.galaxy[galaxyIndex];
            for (let shipIndex = 0.0, shipLength = starSystem.ships.length; shipIndex < shipLength; ++shipIndex) {
                const ship = starSystem.ships[shipIndex];
                if (!ship) {
                    continue;
                }
                if (ship.pilot) {
                    ship.pilot.update(deltaTime, this);
                }
                ship.update(deltaTime);
            }
            if (starSystem.asteroidBelt) {
                starSystem.asteroidBelt.update(deltaTime);
            }
            starSystem.projectileManager.update(deltaTime);
            starSystem.particleManager.update(deltaTime);
        }
        Object.assign(this.lastKeys, this.keys);
    }

    /**
     * initialises the factions and faction relationships
     */
    initializeFactions() {
        this.factionManager.addFaction('Player');
        this.factionManager.addFaction('Civilian');
        this.factionManager.addFaction('Officer');
        this.factionManager.addFaction('Pirate');

        this.factionManager.setRelationship('Player', 'Civilian', FactionRelationship.Neutral);
        this.factionManager.setRelationship('Player', 'Officer', FactionRelationship.Neutral);
        this.factionManager.setRelationship('Player', 'Pirate', FactionRelationship.Hostile);
        this.factionManager.setRelationship('Player', 'Player', FactionRelationship.Allied);

        this.factionManager.setRelationship('Civilian', 'Officer', FactionRelationship.Allied);
        this.factionManager.setRelationship('Civilian', 'Pirate', FactionRelationship.Hostile);
        this.factionManager.setRelationship('Civilian', 'Civilian', FactionRelationship.Allied);

        this.factionManager.setRelationship('Officer', 'Pirate', FactionRelationship.Hostile);
        this.factionManager.setRelationship('Officer', 'Officer', FactionRelationship.Allied);
    }

    /**
     * Spawns or despawns AI ships based on system limits and timing.
     * @param {number} currentTime - Current time in milliseconds.
     */
    spawnAiShipsIfNeeded(currentTime) {
        if (currentTime != 0.0 && (currentTime - this.lastSpawnTime < this.spawnInterval)) return;

        this.galaxy.forEach(system => {
            let systemShipsLength = system.ships.length;
            let aiCount = 0.0;
            let civilianCount = 0.0;
            let pirateCount = 0.0;
            let officerCount = 0.0;

            const civilianFaction = this.factionManager.getFaction('Civilian');
            const pirateFaction = this.factionManager.getFaction('Pirate');
            const officerFaction = this.factionManager.getFaction('Officer');

            for (let i = 0.0; i < systemShipsLength; i++) {
                const ship = system.ships[i];
                if (ship.pilot instanceof AiPilot) {
                    aiCount++;
                    if (ship.faction === civilianFaction) {
                        civilianCount++;
                    } else if (ship.faction === pirateFaction) {
                        pirateCount++;
                    } else if (ship.faction === officerFaction) {
                        officerCount++;
                    }
                }
            }

            //Despawn landed ships if there are too many in the system
            if (aiCount > system.maxAiShips) {
                let excessCount = aiCount - system.maxAiShips;
                for (let i = 0.0; i < systemShipsLength && excessCount > 0.0; i++) {
                    const ship = system.ships[i];
                    if (ship.pilot instanceof AiPilot && ship.state === 'Landed' && ship.landedObject instanceof Planet) {
                        let despawn = false;
                        if (ship.faction === civilianFaction) {
                            civilianCount--;
                            despawn = true;
                        } else if (ship.faction === pirateFaction) {
                            pirateCount--;
                            despawn = true;
                        } else if (ship.faction === officerFaction) {
                            if (officerCount > 1.0) {
                                officerCount--;
                                despawn = true;
                            }
                        }
                        if (despawn) {
                            ship.despawn();
                            aiCount--;
                            systemShipsLength--;
                            excessCount--;
                            i--;
                        }
                    }
                }
            }

            do {
                if (aiCount < system.maxAiShips) {
                    let aiShip = null;
                    const spawnPlanet = system.getRandomPlanet();
                    if (!spawnPlanet) {
                        console.warn('spawnAiShipsIfNeeded: No spawnPlanet found!');
                        return;
                    }
                    if (officerCount < 4.0) {
                        //spawn officer
                        //aiShip = createRandomFastShip(spawnPlanet.position.x, spawnPlanet.position.y, system, officerFaction);
                        aiShip = new Fighter(spawnPlanet.position.x, spawnPlanet.position.y, system, officerFaction);
                        aiShip.pilot = new OfficerAiPilot(aiShip, new OfficerJob(aiShip, null, false));
                        aiShip.colors.wings = Colour.BlueDark;
                        aiShip.colors.hull = Colour.WhiteLight;
                        officerCount++;
                    } else if (pirateCount < 4.0 && Math.random() < 0.25) {
                        //spawn pirate
                        aiShip = createRandomFastShip(spawnPlanet.position.x, spawnPlanet.position.y, system, pirateFaction);
                        aiShip.pilot = new PirateAiPilot(aiShip, new PirateJob(aiShip, null, true));
                        aiShip.colors.wings = Colour.RedDark;
                        aiShip.colors.hull = Colour.GreyDark;
                        pirateCount++;
                    } else {
                        //spawn civilian
                        aiShip = createRandomShip(spawnPlanet.position.x, spawnPlanet.position.y, system, civilianFaction);
                        if (aiShip instanceof Boxwing) {
                            aiShip.pilot = new CivilianAiPilot(aiShip, new MinerJob(aiShip));
                        } else {
                            aiShip.pilot = new CivilianAiPilot(aiShip, new WandererJob(aiShip));
                        }
                        //aiShip.colors.wings.set(0.0,  1.0,  0.0,  1.0);
                        civilianCount++;
                    }
                    aiShip.trail.color = aiShip.colors.wings.toRGBA(0.5);
                    aiShip.setState('Landed');
                    aiShip.shipScale = 0.0;
                    aiShip.velocity.set(0.0, 0.0);
                    aiShip.landedObject = spawnPlanet;
                    spawnPlanet.addLandedShip(aiShip);
                    system.addGameObject(aiShip);

                    //spawn escorts
                    if (aiShip instanceof Freighter || aiShip instanceof StarBarge) {
                        const escortCount = Math.round(Math.random() * (aiShip instanceof Freighter ? 4 : 2.0));
                        for (let i = 0.0; i < escortCount; i++) {
                            const escort = new Fighter(spawnPlanet.position.x, spawnPlanet.position.y, system, aiShip.faction);
                            const pilot = new OfficerAiPilot(escort, new EscortJob(escort, aiShip));
                            escort.setPilot(pilot);
                            escort.colors.cockpit = aiShip.colors.cockpit;
                            escort.colors.wings = aiShip.colors.wings;
                            escort.colors.hull = aiShip.colors.hull;
                            escort.trail.color = aiShip.trail.color;
                            escort.setState('Landed');
                            escort.shipScale = 0.0;
                            escort.velocity.set(0.0, 0.0);
                            escort.landedObject = spawnPlanet;
                            spawnPlanet.addLandedShip(escort);
                            system.addGameObject(escort);
                            if (escort.faction === civilianFaction) {
                                civilianCount++;
                            } else if (escort.faction === pirateFaction) {
                                pirateCount++;
                            } else if (escort.faction === officerFaction) {
                                officerCount++;
                            }
                            aiCount++;
                        }
                    }
                }
            } while (system.ships.length < system.maxAiShips * 0.5);
        });

        this.lastSpawnTime = currentTime;
        this.spawnInterval = this.randomSpawnInterval();
    }

    /**
     * Generates a random interval for spawning AI ships.
     * @returns {number} A random interval in milliseconds between 2000 and 10000.
     */
    randomSpawnInterval() {
        return 2000 + Math.random() * 8000.0;
    }

    /**
     * Spawns initial AI ships in each star system up to a limit of 10.
     */
    spawnAiShips() {
        this.spawnAiShipsIfNeeded(0);
    }

    /**
     * Cycles to the next AI-controlled ship in the current star system.
     */
    cycleNextAiShip() {
        if (this.cameraTarget) {
            this.cameraTarget.debug = false;
        }
        const ships = this.mainCamera.starSystem.ships;
        if (ships.length === 0.0) return;
        const currentIndex = ships.indexOf(this.cameraTarget);
        const nextIndex = (currentIndex + 1.0) % ships.length;
        this.cameraTarget = ships[nextIndex];
        this.cameraTarget.debug = this.debug;
    }

    /**
     * Sets up event listeners for user input and window events.
     */
    setupEventListeners() {
        let offsetX, offsetY;

        const parent = this.targetCamera.foregroundCanvas.parentElement;
        parent.addEventListener('dragstart', (e) => {
            offsetX = e.offsetX;
            offsetY = e.offsetY;
        });

        parent.addEventListener('drag', (e) => {
            if (e.clientX > 0.0 && e.clientY > 0.0) {
                parent.style.left = `${e.clientX - offsetX}px`;
                parent.style.top = `${e.clientY - offsetY}px`;
            }
        });

        // Set up ResizeObserver to call resizeTargetCamera on size change
        const resizeObserver = new ResizeObserver(() => {
            this.game.resizeTargetCamera();
        });

        // Start observing
        resizeObserver.observe(parent);

        window.addEventListener('resize', () => { this.game.resizeMainCamera() });

        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === 'Tab') {
                e.preventDefault();
                this.cycleNextAiShip();
            }
            if (e.key === 'q') {
                if (this.cameraTarget) {
                    this.cameraTarget.debug = false;
                }
                this.cameraTarget = this.playerShip;
            }
            if (e.key === 'd' || e.key === 'D') {
                this.debug = !this.debug;
                if (this.cameraTarget) {
                    this.cameraTarget.debug = this.debug;
                }
                if (this.mainCamera) {
                    this.mainCamera.debug = this.debug;
                }
                console.log("DEBUG: ", this.debug);
            }

            if (e.key === '=' || e.key === '+') {
                this.mainCamera.setZoom(this.mainCamera.zoom + 0.1);
                this.zoomTextTimer = 120.0;
            }

            if (e.key === '-' || e.key === '_') {
                this.mainCamera.setZoom(this.mainCamera.zoom - 0.1);
                this.zoomTextTimer = 120.0;
            }

        });

        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });

        window.addEventListener('wheel', (e) => {
            const zoomStep = 0.1;
            this.mainCamera.setZoom(this.mainCamera.zoom + (e.deltaY < 0.0 ? zoomStep : -zoomStep));
            this.zoomTextTimer = 120.0;
        });

        // Handle resizing via corner handles
        const handles = parent.querySelectorAll('.resize-handle');
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startRight, startTop, corner;

        handles.forEach((handle) => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent drag interference
                isResizing = true;
                corner = handle.classList[1]; // e.g., 'top-left'
                startX = e.clientX;
                startY = e.clientY;
                const rect = parent.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                startRight = window.innerWidth - (rect.right - 2.0); // Account for 2px border
                startTop = rect.top - 2.0;
            });
        });

        // Inside initTargetCameraEvents, replace the mousemove handler
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const minWidth = 100.0; // Match CSS min-width
            const minHeight = 100.0; // Match CSS min-height
            let newWidth, newHeight, newRight, newTop;

            // Calculate mouse movement (positive deltaX when dragging left)
            const deltaX = startX - e.clientX; // Left drag = positive
            const deltaY = startY - e.clientY; // Up drag = positive

            if (corner === 'top-left') {
                // Resize left: Increase/decrease width, keep right fixed
                newWidth = Math.max(minWidth, startWidth + deltaX);
                newRight = startRight; // Right edge stays fixed
                // Resize up: Increase/decrease height, adjust top
                newHeight = Math.max(minHeight, startHeight + deltaY);
                newTop = startTop - deltaY;
            } else if (corner === 'top-right') {
                // Resize right: Increase/decrease width, adjust right
                newWidth = Math.max(minWidth, startWidth - deltaX);
                newRight = startRight + deltaX;
                // Resize up: Increase/decrease height, adjust top
                newHeight = Math.max(minHeight, startHeight + deltaY);
                newTop = startTop - deltaY;
            } else if (corner === 'bottom-left') {
                // Resize left: Increase/decrease width, keep right fixed
                newWidth = Math.max(minWidth, startWidth + deltaX);
                newRight = startRight;
                // Resize down: Increase/decrease height, keep top fixed
                newHeight = Math.max(minHeight, startHeight - deltaY);
                newTop = startTop;
            } else if (corner === 'bottom-right') {
                // Resize right: Increase/decrease width, adjust right
                newWidth = Math.max(minWidth, startWidth - deltaX);
                newRight = startRight + deltaX;
                // Resize down: Increase/decrease height, keep top fixed
                newHeight = Math.max(minHeight, startHeight - deltaY);
                newTop = startTop;
            }

            // Update div styles
            parent.style.width = `${newWidth}px`;
            parent.style.height = `${newHeight}px`;
            parent.style.right = `${newRight}px`;
            parent.style.top = `${newTop}px`;
            parent.style.left = ''; // Clear conflicting style

        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }
}

// Initialize the game manager and expose it to the window object
// @ts-ignore
window.gameManager = new GameManager();