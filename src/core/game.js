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
     * @param {HTMLCanvasElement} canvas - The main game canvas.
     * @param {HTMLCanvasElement} targetCanvas - The canvas for the target view.
     */
    constructor(manager, canvas, targetCanvas) {
        /** @type {GameManager} The game manager providing access to game state. */
        this.manager = manager;
        /** @type {HTMLCanvasElement} The main game canvas for rendering. */
        this.canvas = canvas;
        /** @type {CanvasRenderingContext2D} The 2D rendering context for the main canvas. */
        this.ctx = this.canvas.getContext('2d');
        /** @type {Vector2D} The size of the main canvas in pixels. */
        this.canvasSize = new Vector2D(0, 0);
        /** @type {HTMLCanvasElement} The canvas for rendering the target view. */
        this.targetCanvas = targetCanvas;
        /** @type {CanvasRenderingContext2D} The 2D rendering context for the target canvas. */
        this.targetCtx = this.targetCanvas.getContext('2d');
        this.targetCtx.font = 'bolder 16px "Century Gothic Paneuropean", "Century Gothic", "CenturyGothic", "AppleGothic", sans-serif';

        /** @type {TargetCamera} The camera for the target view, managed by the game manager. */
        this.targetCamera = manager.targetCamera;
        /** @type {Camera} The main camera for the game, managed by the game manager. */
        this.camera = manager.camera;
        /** @type {StarField} The starfield for rendering background stars, managed by the game manager. */
        this.starField = manager.starField;
        /** @type {HeadsUpDisplay} The HUD for displaying game information, managed by the game manager. */
        this.hud = manager.hud;
        /** @type {number} The timestamp of the last frame, used for timing calculations. */
        this.lastTime = performance.now();
        /** @type {number} The number of frames rendered since the last FPS update. */
        this.frameCount = 0;
        /** @type {number} The calculated frames per second (FPS) for the game. */
        this.fps = 0;
        /** @type {number} The timestamp of the last FPS update. */
        this.lastFpsUpdate = performance.now();
        /** @type {number} Timer for controlling zoom text display duration. */
        this.zoomTextTimer = 0;

        // Initialize canvas size
        this.resizeCanvas();
        /** @type {Function} The bound game loop function for rendering and updating the game. */
        this.gameLoop = this.gameLoop.bind(this);
    }

    /**
     * Resizes the canvas and updates related components when the window size changes.
     */
    resizeCanvas() {
        this.canvasSize.set(window.innerWidth, window.innerHeight);
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;
        this.camera.resize(this.canvasSize.width, this.canvasSize.height);
        this.hud.resize(this.canvasSize.width, this.canvasSize.height);
        this.ctx.font = 'bolder 16px "Century Gothic Paneuropean", "Century Gothic", "CenturyGothic", "AppleGothic", sans-serif';
    }

    /**
     * The main game loop
     * @param {number} currentTime - The current time from requestAnimationFrame.
     */
    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastTime);
        this.lastTime = currentTime;
        this.update(deltaTime);
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
        const MAX_DELTA = 100;
        if (deltaTime > MAX_DELTA) deltaTime = MAX_DELTA;
        deltaTime = deltaTime / 1000;

        this.manager.update(deltaTime);
        if (this.manager.cameraTarget && !this.manager.cameraTarget.despawned) {
            this.camera.update(this.manager.cameraTarget.starSystem, this.manager.cameraTarget.position);
        }

        if (this.manager.zoomTextTimer > 0) {
            this.manager.zoomTextTimer -= deltaTime;
        }
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
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
        const shieldRatio = remapClamp(ship.shield.strength, 0, ship.shield.maxStrength, 0, 1);
        const hullRatio = remapClamp(ship.hullIntegrity, 0, ship.maxHull, 0, 1);
        const centerX = camera.screenCenter.x;
        const barHeight = 8;
        const barGap = 8;
        const barWidth = camera.screenSize.width - barGap * 2.0;
        let top = camera.screenSize.height - barGap - barHeight;
        let width = Math.round(barWidth * shieldRatio * 0.5);
        //ctx.shadowBlur = 0;
        ctx.fillStyle = Colour.BlueDark.toRGB();
        ctx.fillRect(barGap, top, barWidth, barHeight);
        //ctx.shadowBlur = 8;
        //ctx.shadowColor = 'rgba(64, 64, 255, 0.75)';
        ctx.fillStyle = Colour.Blue.toRGB();
        ctx.fillRect(centerX - width, top, width * 2.0, barHeight);

        top = top - barGap - barHeight;
        width = Math.round(barWidth * hullRatio * 0.5);
        //ctx.shadowBlur = 0;
        ctx.fillStyle = Colour.GreenDark.toRGB();
        ctx.fillRect(barGap, top, barWidth, barHeight);
        //ctx.shadowColor = 'rgba(64, 255, 64, 0.75)';
        //ctx.shadowBlur = 8;
        ctx.fillStyle = Colour.Green.toRGB();
        ctx.fillRect(centerX - width, top, width * 2.0, barHeight);
        ctx.restore();
    }

    /**
     * Renders the game state to the canvas.
     * @param {number} deltaTime - Time elapsed since the last render in milliseconds.
     */
    render(deltaTime) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.starField.draw(ctx, this.camera);
        const cameraTarget = this.manager.cameraTarget;
        if (!cameraTarget || cameraTarget.despawned) {
            this.manager.cameraTarget = null;
        }
        const starSystem = this.camera.starSystem;
        if (!starSystem) {
            console.log(this.camera);
            throw new Error('No starSystem on this.camera');
        }
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(ctx, this.camera);
        for (let i = 0; i < starSystem.stars.length; i++) {
            starSystem.stars[i].draw(ctx, this.camera);
        }
        for (let i = 0; i < starSystem.planets.length; i++) {
            starSystem.planets[i].draw(ctx, this.camera);
        }
        for (let i = 0; i < starSystem.jumpGates.length; i++) {
            starSystem.jumpGates[i].draw(ctx, this.camera);
        }
        for (let i = 0; i < starSystem.ships.length; i++) {
            starSystem.ships[i].draw(ctx, this.camera);
        }
        starSystem.projectileManager.draw(ctx, this.camera);
        starSystem.particleManager.draw(ctx, this.camera);
        this.hud.draw(ctx, this.camera);
        this.renderTargetView();

        ctx.save();
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.fillText(`FPS: ${this.fps}`, 10, 20);

        const maxFrameTime = 50;
        const barWidth = Math.min(deltaTime / maxFrameTime, 1) * 150;
        ctx.fillStyle = deltaTime > 33.33 ? 'red' : deltaTime > 16.67 ? 'yellow' : 'green';
        ctx.fillRect(10, 25, barWidth, 10);
        ctx.restore();

        if (this.manager.zoomTextTimer > 0) {
            ctx.save();
            ctx.fillStyle = 'white';
            //ctx.font = '20px Arial';
            ctx.textAlign = 'right';
            const zoomPercent = Math.round(this.camera.zoom * 100);
            ctx.fillText(`${zoomPercent}%`, this.canvasSize.width - 10, 30);
            ctx.restore();
        }

        if (cameraTarget && cameraTarget instanceof Ship && !cameraTarget.despawned && (cameraTarget.state === 'Flying' || cameraTarget.state === 'Disabled')) {
            this.drawShipStats(ctx, this.camera, cameraTarget);
        }
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

        if (!target) {
            if (this.targetCanvas.style.display !== 'none') {
                this.targetCanvas.style.display = 'none';
            }
            return;
        } else {
            if (this.targetCanvas.style.display !== 'block') {
                this.targetCanvas.style.display = 'block';
            }
        }

        if (this.manager.cameraTarget.target instanceof Ship) {
            switch (this.manager.cameraTarget.faction.getRelationship(this.manager.cameraTarget.target.faction)) {
                case FactionRelationship.Allied:
                    this.targetCanvas.style.borderColor = Colour.Allied.toRGB();
                    break;
                case FactionRelationship.Neutral:
                    this.targetCanvas.style.borderColor = Colour.Neutral.toRGB();
                    break;
                case FactionRelationship.Hostile:
                    this.targetCanvas.style.borderColor = Colour.Hostile.toRGB();
                    break;
            }
        } else {
            this.targetCanvas.style.borderColor = Colour.Neutral.toRGB();
        }

        const ctx = this.targetCtx;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
        this.starField.draw(ctx, this.targetCamera);

        const starSystem = target.starSystem; //this.manager.cameraTarget.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(ctx, this.targetCamera);
        for (let i = 0; i < starSystem.stars.length; i++) {
            starSystem.stars[i].draw(ctx, this.targetCamera);
        }
        for (let i = 0; i < starSystem.planets.length; i++) {
            starSystem.planets[i].draw(ctx, this.targetCamera);
        }
        for (let i = 0; i < starSystem.jumpGates.length; i++) {
            starSystem.jumpGates[i].draw(ctx, this.targetCamera);
        }
        for (let i = 0; i < starSystem.ships.length; i++) {
            starSystem.ships[i].draw(ctx, this.targetCamera);
        }
        starSystem.projectileManager.draw(ctx, this.targetCamera);
        starSystem.particleManager.draw(ctx, this.targetCamera);
        const targetName = (target instanceof Ship || target instanceof CelestialBody) ? target.name : "Unnamed Object";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(targetName, this.targetCanvas.width / 2, 20);

        if (target && target instanceof Ship && !target.despawned && (target.state === 'Flying' || target.state === 'Disabled')) {
            this.drawShipStats(ctx, this.targetCamera, target);
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
        /** @type {HTMLCanvasElement} The main game canvas for rendering. */
        // @ts-ignore
        this.canvas = document.getElementById('gameCanvas');
        /** @type {HTMLCanvasElement} The canvas for rendering the target view. */
        // @ts-ignore
        this.targetCanvas = document.getElementById('targetCanvas');
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
        /** @type {Camera} The main camera tracking the player's ship. */
        this.camera = new Camera(this.playerShip.starSystem, this.playerShip.position, new Vector2D(window.innerWidth, window.innerHeight), 1);
        /** @type {Ship} The current target for the camera, typically the player's ship. */
        this.cameraTarget = this.playerShip;
        /** @type {TargetCamera} The camera for the target view, rendering a secondary perspective. */
        this.targetCamera = new TargetCamera(this.playerShip.starSystem, new Vector2D(0, 0), new Vector2D(this.targetCanvas.width, this.targetCanvas.height));
        /** @type {StarField} The starfield for rendering background stars. */
        this.starField = new StarField(20, 1000, 10);
        /** @type {HeadsUpDisplay} The HUD for displaying game information. */
        this.hud = new HeadsUpDisplay(this, window.innerWidth, window.innerHeight);
        /** @type {number} Timer for controlling zoom text display duration. */
        this.zoomTextTimer = 0;
        /** @type {number} Timestamp of the last AI ship spawn. */
        this.lastSpawnTime = performance.now();
        /** @type {number} Interval between AI ship spawns, randomized for variety. */
        this.spawnInterval = this.randomSpawnInterval();
        /** @type {Game} The game instance managing rendering and updates. */
        this.game = new Game(this, this.canvas, this.targetCanvas);

        // Temporary scratch values to avoid allocations
        /** @type {Vector2D} Scratch vector for calculating spawn positions in spawnAiShips. */
        this._scratchSpawnPos = new Vector2D(0, 0);

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

        // const pirate01 = new Fighter(spawnPlanet.position.x + spawnPlanet.radius * 50.0, spawnPlanet.position.y, this.galaxy[0]);
        // const pilot02 = new PirateAiPilot(pirate01, new PirateJob(pirate01));
        // pirate01.setPilot(pilot02);
        // this.galaxy[0].addGameObject(pirate01);
        //pilot02.threat = this.playerShip;
        //this.playerShip.lastAttacker = pirate01;
        //this.cameraTarget = escort01;
        //escort01.debug = true;

        // Set player pilot
        this.playerShip.pilot = this.playerPilot;
        this.galaxy[0].ships.push(this.playerShip);

        // Initialize game systems
        this.spawnAiShips();
        this.setupEventListeners();
        this.game.start();
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
        for (let galaxyIndex = 0, galaxyLength = this.galaxy.length; galaxyIndex < galaxyLength; ++galaxyIndex) {
            const starSystem = this.galaxy[galaxyIndex];
            for (let shipIndex = 0, shipLength = starSystem.ships.length; shipIndex < shipLength; ++shipIndex) {
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
        if (currentTime != 0 && (currentTime - this.lastSpawnTime < this.spawnInterval)) return;

        this.galaxy.forEach(system => {
            let systemShipsLength = system.ships.length;
            let aiCount = 0;
            let civilianCount = 0;
            let pirateCount = 0;
            let officerCount = 0;

            const civilianFaction = this.factionManager.getFaction('Civilian');
            const pirateFaction = this.factionManager.getFaction('Pirate');
            const officerFaction = this.factionManager.getFaction('Officer');

            for (let i = 0; i < systemShipsLength; i++) {
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
                for (let i = 0; i < systemShipsLength && excessCount > 0; i++) {
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
                            if (officerCount > 1) {
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
                    if (officerCount < 1) {
                        //spawn officer
                        aiShip = createRandomFastShip(spawnPlanet.position.x, spawnPlanet.position.y, system, officerFaction);
                        aiShip.pilot = new OfficerAiPilot(aiShip, new OfficerJob(aiShip));
                        aiShip.colors.wings.set(0.25, 0.25, 0.9, 1);
                        aiShip.colors.hull.set(0.9, 0.9, 0.9, 1);
                        officerCount++;
                    } else if (pirateCount < 4 && Math.random() < 0.25) {
                        //spawn pirate
                        aiShip = createRandomFastShip(spawnPlanet.position.x, spawnPlanet.position.y, system, pirateFaction);
                        aiShip.pilot = new PirateAiPilot(aiShip, new PirateJob(aiShip));
                        aiShip.colors.wings.set(0.9, 0, 0, 1);
                        pirateCount++;
                    } else {
                        //spawn civilian
                        aiShip = createRandomShip(spawnPlanet.position.x, spawnPlanet.position.y, system, civilianFaction);
                        if (aiShip instanceof Boxwing) {
                            aiShip.pilot = new CivilianAiPilot(aiShip, new MinerJob(aiShip));
                        } else {
                            aiShip.pilot = new CivilianAiPilot(aiShip, new WandererJob(aiShip));
                        }
                        //aiShip.colors.wings.set(0, 1, 0, 1);
                        civilianCount++;
                    }
                    aiShip.trail.color = aiShip.colors.wings.toRGBA(0.5);
                    aiShip.setState('Landed');
                    aiShip.shipScale = 0;
                    aiShip.velocity.set(0, 0);
                    aiShip.landedObject = spawnPlanet;
                    spawnPlanet.addLandedShip(aiShip);
                    system.addGameObject(aiShip);

                    //spawn escorts
                    if (aiShip instanceof Freighter || aiShip instanceof StarBarge) {
                        const escortCount = Math.round(Math.random() * (aiShip instanceof Freighter ? 4 : 2));
                        for (let i = 0; i < escortCount; i++) {
                            const escort = new Fighter(spawnPlanet.position.x, spawnPlanet.position.y, system, aiShip.faction);
                            const pilot = new OfficerAiPilot(escort, new EscortJob(escort, aiShip));
                            escort.setPilot(pilot);
                            escort.colors.cockpit = aiShip.colors.cockpit;
                            escort.colors.wings = aiShip.colors.wings;
                            escort.colors.hull = aiShip.colors.hull;
                            escort.trail.color = aiShip.trail.color;
                            escort.setState('Landed');
                            escort.shipScale = 0;
                            escort.velocity.set(0, 0);
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
        return 2000 + Math.random() * 8000;
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
        const ships = this.camera.starSystem.ships;
        if (ships.length === 0) return;
        const currentIndex = ships.indexOf(this.cameraTarget);
        const nextIndex = (currentIndex + 1) % ships.length;
        this.cameraTarget = ships[nextIndex];
        this.cameraTarget.debug = this.debug;
    }

    /**
     * Sets up event listeners for user input and window events.
     */
    setupEventListeners() {
        let offsetX, offsetY;

        this.targetCanvas.addEventListener('dragstart', (e) => {
            offsetX = e.offsetX;
            offsetY = e.offsetY;
        });

        this.targetCanvas.addEventListener('drag', (e) => {
            if (e.clientX > 0 && e.clientY > 0) {
                this.targetCanvas.style.left = `${e.clientX - offsetX}px`;
                this.targetCanvas.style.top = `${e.clientY - offsetY}px`;
            }
        });

        window.addEventListener('resize', () => { this.game.resizeCanvas(); });

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
                if (this.camera) {
                    this.camera.debug = this.debug;
                }
                console.log("DEBUG: ", this.debug);
            }

            if (e.key === '=' || e.key === '+') {
                this.camera.setZoom(this.camera.zoom + 0.1);
                this.zoomTextTimer = 120;
            }

            if (e.key === '-' || e.key === '_') {
                this.camera.setZoom(this.camera.zoom - 0.1);
                this.zoomTextTimer = 120;
            }

        });

        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });

        window.addEventListener('wheel', (e) => {
            const zoomStep = 0.1;
            this.camera.setZoom(this.camera.zoom + (e.deltaY < 0 ? zoomStep : -zoomStep));
            this.zoomTextTimer = 120;
        });
    }
}

// Initialize the game manager and expose it to the window object
// @ts-ignore
window.gameManager = new GameManager();