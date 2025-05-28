// /src/core/game.js

import { remapClamp } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';
import { Camera, TargetCamera } from '/src/camera/camera.js';
import { Ship } from '/src/ship/ship.js';
import { createRandomShip, Flivver, Shuttle, HeavyShuttle, StarBarge, Freighter, Arrow, Boxwing, Interceptor, Fighter } from '../ship/shipTypes.js';
import { StarField } from '/src/camera/starField.js';
import { HeadsUpDisplay } from '/src/camera/headsUpDisplay.js';
import { PlayerPilot } from '/src/pilot/pilot.js';
import { createGalaxy } from '/src/core/galaxy.js';
import { isValidTarget } from '/src/core/gameObject.js';
import { AIPilot, CivilianAiPilot, PirateAiPilot, OfficerAiPilot } from '/src/pilot/aiPilot.js';
import { WandererJob } from '/src/job/wandererJob.js';
import { MinerJob } from '/src/job/minerJob.js';
import { PirateJob } from '/src/job/pirateJob.js';
import { OfficerJob } from '/src/job/officerJob.js';
//import { wrapCanvasContext } from '/src/core/utils.js';

/**
 * Handles the game loop, rendering, and updates for the game.
 */
class Game {
    /**
     * Creates a new Game instance.
     * @param {GameManager} manager - The game manager providing game state.
     * @param {HTMLCanvasElement} canvas - The main game canvas.
     * @param {HTMLCanvasElement} targetCanvas - The canvas for the target view.
     */
    constructor(manager, canvas, targetCanvas) {
        this.manager = manager;
        this.canvas = canvas;
        //this.ctx = wrapCanvasContext(this.canvas.getContext('2d'));
        this.ctx = this.canvas.getContext('2d');
        this.canvasSize = new Vector2D(0, 0);
        this.targetCanvas = targetCanvas;
        //this.targetCtx = wrapCanvasContext(this.targetCanvas.getContext('2d'));
        this.targetCtx = this.targetCanvas.getContext('2d');
        this.targetCtx.font = 'bolder 16px "Century Gothic Paneuropean", "Century Gothic", "CenturyGothic", "AppleGothic", sans-serif';

        this.targetCamera = manager.targetCamera;

        this.camera = manager.camera;
        this.starField = manager.starField;
        this.hud = manager.hud;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = performance.now();
        this.zoomTextTimer = 0;

        this.resizeCanvas();
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
        ctx.fillStyle = 'rgb(32, 32, 128)';
        ctx.fillRect(barGap, top, barWidth, barHeight);
        //ctx.shadowBlur = 8;
        //ctx.shadowColor = 'rgba(64, 64, 255, 0.75)';
        ctx.fillStyle = 'rgb(64, 64, 255)';
        ctx.fillRect(centerX - width, top, width * 2.0, barHeight);

        top = top - barGap - barHeight;
        width = Math.round(barWidth * hullRatio * 0.5);
        //ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgb(32, 128, 32)';
        ctx.fillRect(barGap, top, barWidth, barHeight);
        //ctx.shadowColor = 'rgba(64, 255, 64, 0.75)';
        //ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgb(64, 255, 64)';
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

        // ctx.save();
        // ctx.fillStyle = 'white';
        // ctx.strokeStyle = 'white';
        // const up = new Vector2D(0, -100);
        // up.addInPlace(this.camera.screenCenter);
        // ctx.beginPath();
        // ctx.moveTo(this.camera.screenCenter.x, this.camera.screenCenter.y);
        // ctx.lineTo(up.x, up.y);
        // ctx.closePath();
        // ctx.stroke();

        // ctx.beginPath();
        // ctx.moveTo(up.x, up.y);
        // ctx.arc(up.x, up.y, 3, 0, TWO_PI);
        // ctx.closePath();
        // ctx.fill();

        // ctx.fillStyle = 'green';
        // ctx.strokeStyle = 'green';
        // up.setFromPolar(100,Math.PI/-2);
        // up.addInPlace(this.camera.screenCenter);
        // ctx.beginPath();
        // ctx.moveTo(this.camera.screenCenter.x, this.camera.screenCenter.y);
        // ctx.lineTo(up.x, up.y);
        // ctx.closePath();
        // ctx.stroke();

        // ctx.beginPath();
        // ctx.moveTo(up.x, up.y);
        // ctx.arc(up.x, up.y, 3, 0, TWO_PI);
        // ctx.closePath();
        // ctx.fill();
        // ctx.restore();
        ctx.restore();

        // if (ctx.getStackSize() !== 0) {
        //     console.warn(`Frame end: Stack size is ${ctx.getStackSize()}`);
        // }
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
        const targetName = target.name || "Unnamed Object";
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
class GameManager {
    /**
     * Creates a new GameManager instance.
     */
    constructor() {
        this.debug = false;
        this.canvas = document.getElementById('gameCanvas');
        this.targetCanvas = document.getElementById('targetCanvas');
        this.keys = {};
        this.lastKeys = {};
        this.isFocused = true;
        this.galaxy = createGalaxy();
        const starSystem = this.galaxy[0];
        const earth = starSystem.planets[5];
        //this.playerShip = createRandomShip(earth.position.x + earth.radius * 1.5, earth.position.y, starSystem);
        this.playerShip = new Interceptor(earth.position.x + earth.radius * 1.5, earth.position.y, starSystem);

        //this.playerShip = new Freighter(earth.position.x + earth.radius * 1.5, earth.position.y, starSystem);

        //this.escort01 = new Interceptor(earth.position.x + earth.radius * 1.0, earth.position.y, starSystem);
        //this.escort01 = new Freighter(earth.position.x + earth.radius * 1.0, earth.position.y, starSystem);
        this.escort01 = new Shuttle(earth.position.x + earth.radius * 1.0, earth.position.y, starSystem);
        const job01 = new WandererJob(this.escort01);
        const pilot01 = new CivilianAiPilot(this.escort01, job01);
        this.escort01.setPilot(pilot01);
        //this.escort01.pilot = new EscortAIPilot(this.escort01, this.playerShip);
        this.escort01.colors.cockpit = this.playerShip.colors.cockpit;
        this.escort01.colors.wings = this.playerShip.colors.wings;
        this.escort01.colors.hull = this.playerShip.colors.hull;
        this.escort01.trail.color = this.playerShip.trail.color;
        starSystem.addGameObject(this.escort01);
        this.playerShip.setTarget(this.escort01);

        // this.escort02 = new Flivver(earth.position.x + 100, earth.position.y, starSystem);
        // this.escort02.pilot = new EscortAIPilot(this.escort02, this.playerShip);
        // this.escort02.colors.cockpit = this.playerShip.colors.cockpit;
        // this.escort02.colors.wings = this.playerShip.colors.wings;
        // this.escort02.colors.hull = this.playerShip.colors.hull;
        // this.escort02.trail.color = this.playerShip.trail.color;
        // starSystem.addGameObject(this.escort02);

        // this.escort02 = new Interceptor(earth.position.x + earth.radius * 1.0, earth.position.y, starSystem);
        // const job02 = new WandererJob(this.escort02);
        // const pilot02 = new CivilianAiPilot(this.escort02, job02);
        // this.escort02.setPilot(pilot02);
        // this.escort02.colors.cockpit = this.playerShip.colors.cockpit;
        // this.escort02.colors.wings = this.playerShip.colors.wings;
        // this.escort02.colors.hull = this.playerShip.colors.hull;
        // this.escort02.trail.color = this.playerShip.trail.color;
        // starSystem.addGameObject(this.escort02);
        //this.playerShip.setTarget(this.escort02);

        this.playerPilot = new PlayerPilot(this.playerShip);
        this.playerShip.pilot = this.playerPilot;
        this.galaxy[0].ships.push(this.playerShip);
        this.camera = new Camera(this.playerShip.starSystem, this.playerShip.position, new Vector2D(window.innerWidth, window.innerHeight), 1);
        this.cameraTarget = this.playerShip;
        this.targetCamera = new TargetCamera(this.playerShip.starSystem, new Vector2D(0, 0), new Vector2D(this.targetCanvas.width, this.targetCanvas.height));
        this.starField = new StarField(20, 1000, 10);
        this.hud = new HeadsUpDisplay(this, window.innerWidth, window.innerHeight);
        this.zoomTextTimer = 0;
        this.lastSpawnTime = performance.now();
        this.spawnInterval = this.randomSpawnInterval();
        this.game = new Game(this, this.canvas, this.targetCanvas);

        // Temporary scratch values to avoid allocations
        this._scratchSpawnPos = new Vector2D(0, 0); // For calculating spawn positions in spawnAIShips

        this.spawnAIShips();
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
        this.spawnAIShipsIfNeeded(currentTime);
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
     * Spawns or despawns AI ships based on system limits and timing.
     * @param {number} currentTime - Current time in milliseconds.
     */
    spawnAIShipsIfNeeded(currentTime) {
        if (currentTime != 0 && (currentTime - this.lastSpawnTime < this.spawnInterval)) return;

        this.galaxy.forEach(system => {
            const aiShipCount = system.ships.length;

            if (aiShipCount < system.maxAIShips) {
                const spawnPlanet = system.getRandomPlanet();
                if (!spawnPlanet) {
                    console.warn('No spawnPlanet found!');
                }

                const aiShip = createRandomShip(spawnPlanet.position.x, spawnPlanet.position.y, system);
                if (aiShip instanceof Boxwing) {
                    aiShip.pilot = new CivilianAiPilot(aiShip, new MinerJob(aiShip, spawnPlanet));
                } else if (aiShip instanceof Flivver || aiShip instanceof Arrow || aiShip instanceof Interceptor || aiShip instanceof Interceptor || aiShip instanceof Fighter) {
                    if (Math.random() < 0.33) {
                        aiShip.pilot = new PirateAiPilot(aiShip, new PirateJob(aiShip));
                        aiShip.colors.wings.set(1, 0, 0, 1);
                    } else if (Math.random() < 0.5) {
                        aiShip.pilot = new OfficerAiPilot(aiShip, new OfficerJob(aiShip));
                        aiShip.colors.wings.set(0, 0, 1, 1);
                    } else {
                        aiShip.pilot = new CivilianAiPilot(aiShip, new WandererJob(aiShip));
                        aiShip.colors.wings.set(0, 1, 0, 1);
                    }
                } else {
                    aiShip.pilot = new CivilianAiPilot(aiShip, new WandererJob(aiShip));
                    aiShip.colors.wings.set(0, 1, 0, 1);
                }

                // if (aiShip instanceof Flivver || aiShip instanceof Arrow || aiShip instanceof Interceptor) {
                //     if (Math.random() > 0.5) {
                //         aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                //     } else {
                //         aiShip.pilot = new InterdictionAIPilot(aiShip, spawnPlanet);
                //     }
                // } else if (aiShip instanceof Boxwing) {
                //     aiShip.pilot = new MiningAIPilot(aiShip, spawnPlanet);
                // }
                // else {
                //    aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                //}

                // if (aiShip instanceof Freighter) {
                //     const escort01 = new Flivver(spawnPlanet.position.x, spawnPlanet.position.y, system);
                //     escort01.pilot = new EscortAIPilot(escort01, aiShip);
                //     escort01.colors.cockpit = aiShip.colors.cockpit;
                //     escort01.colors.wings = aiShip.colors.wings;
                //     escort01.colors.hull = aiShip.colors.hull;
                //     escort01.trail.color = aiShip.trail.color;
                //     escort01.setState('Landed');
                //     escort01.shipScale = 0;
                //     escort01.velocity.set(0, 0);
                //     escort01.landedObject = spawnPlanet;
                //     spawnPlanet.addLandedShip(escort01);
                //     system.addGameObject(escort01);
                // }

                aiShip.setState('Landed');
                aiShip.shipScale = 0;
                aiShip.velocity.set(0, 0);
                aiShip.landedObject = spawnPlanet;
                spawnPlanet.addLandedShip(aiShip);
                system.addGameObject(aiShip);
            } else if (aiShipCount > system.maxAIShips) {
                const excessCount = aiShipCount - system.maxAIShips;
                let despawned = 0;
                const landedShips = [];
                system.planets.forEach(body => {
                    if (body.landedShips && body.landedShips.length > 0) {
                        landedShips.push(...body.landedShips.filter(ship => ship.pilot instanceof AIPilot));
                    }
                });
                while (despawned < excessCount && landedShips.length > 0) {
                    const index = Math.floor(Math.random() * landedShips.length);
                    const shipToDespawn = landedShips[index];
                    shipToDespawn.despawn();
                    despawned++;
                }
            }
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
    spawnAIShips() {
        this.spawnAIShipsIfNeeded(0);
    }

    /**
     * Cycles to the next AI-controlled ship in the current star system.
     */
    cycleNextAIShip() {
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
                this.cycleNextAIShip();
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
window.gameManager = new GameManager();