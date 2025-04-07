// game.js

import { Vector2D } from './vector2d.js';
import { Colour } from './colour.js';
import { Camera, TargetCamera } from './camera.js';
import { createRandomShip, Ship, Flivver, Shuttle, HeavyShuttle, StarBarge, Freighter, Arrow, Boxwing, Interceptor } from './ship.js';
import { JumpGate } from './celestialBody.js';
import { StarField } from './starField.js';
import { HeadsUpDisplay } from './headsUpDisplay.js';
import { PlayerPilot, AIPilot, InterdictionAIPilot, EscortAIPilot, MiningAIPilot } from './pilot.js';
import { createGalaxy } from './galaxy.js';
import { TWO_PI } from './utils.js';
import { isValidTarget } from './gameObject.js';

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
        this.ctx = this.canvas.getContext('2d');
        this.canvasSize = new Vector2D(window.innerWidth, window.innerHeight);
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;

        this.targetCanvas = targetCanvas;
        this.targetCtx = this.targetCanvas.getContext('2d');
        this.targetCamera = manager.targetCamera;

        this.camera = manager.camera;
        this.starField = manager.starField;
        this.hud = manager.hud;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = performance.now();
        this.zoomTextTimer = 0;
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
    }

    /**
     * Starts the game loop, which continuously updates and renders the game.
     */
    start() {
        const gameLoop = (currentTime) => {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            this.update(deltaTime);
            this.render(deltaTime);
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
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
        this.camera.update(this.manager.cameraTarget.position);

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
     * Renders the game state to the canvas.
     * @param {number} deltaTime - Time elapsed since the last render in milliseconds.
     */
    render(deltaTime) {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.starField.draw(this.ctx, this.camera);
        const starSystem = this.manager.cameraTarget.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(this.ctx, this.camera);
        starSystem.celestialBodies.forEach(body => body.draw(this.ctx, this.camera));
        starSystem.ships.forEach(ship => ship.draw(this.ctx, this.camera));
        this.hud.draw(this.ctx, this.camera);
        this.renderTargetView();

        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);

        const maxFrameTime = 50;
        const barWidth = Math.min(deltaTime / maxFrameTime, 1) * 150;
        this.ctx.fillStyle = deltaTime > 33.33 ? 'red' : deltaTime > 16.67 ? 'yellow' : 'green';
        this.ctx.fillRect(10, 25, barWidth, 10);
        this.ctx.restore();

        if (this.manager.zoomTextTimer > 0) {
            this.ctx.save();
            this.ctx.fillStyle = 'white';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'right';
            const zoomPercent = Math.round(this.camera.zoom * 100);
            this.ctx.fillText(`${zoomPercent}%`, this.canvasSize.width - 10, 30);
            this.ctx.restore();
        }
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

        this.targetCtx.fillStyle = 'black';
        this.targetCtx.fillRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
        this.starField.draw(this.targetCtx, this.targetCamera);
        const starSystem = this.manager.cameraTarget.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(this.targetCtx, this.targetCamera);
        starSystem.celestialBodies.forEach(body => body.draw(this.targetCtx, this.targetCamera));
        starSystem.ships.forEach(ship => ship.draw(this.targetCtx, this.targetCamera));

        const targetName = target.name || "Unnamed Object";
        this.targetCtx.fillStyle = "white";
        this.targetCtx.font = "16px Arial";
        this.targetCtx.textAlign = "center";
        this.targetCtx.fillText(targetName, this.targetCanvas.width / 2, 20);
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
        const earth = starSystem.celestialBodies[3];
        this.playerShip = createRandomShip(earth.position.x + 50, earth.position.y, starSystem);

        // this.escort01 = new Flivver(earth.position.x - 50, earth.position.y, starSystem);
        // this.escort01.pilot = new EscortAIPilot(this.escort01, this.playerShip);
        // this.escort01.colors.cockpit = this.playerShip.colors.cockpit;
        // this.escort01.colors.wings = this.playerShip.colors.wings;
        // this.escort01.colors.hull = this.playerShip.colors.hull;
        // this.escort01.trail.color = this.playerShip.trail.color;
        // starSystem.addGameObject(this.escort01);

        // this.escort02 = new Flivver(earth.position.x + 100, earth.position.y, starSystem);
        // this.escort02.pilot = new EscortAIPilot(this.escort02, this.playerShip);
        // this.escort02.colors.cockpit = this.playerShip.colors.cockpit;
        // this.escort02.colors.wings = this.playerShip.colors.wings;
        // this.escort02.colors.hull = this.playerShip.colors.hull;
        // this.escort02.trail.color = this.playerShip.trail.color;
        // starSystem.addGameObject(this.escort02);

        this.playerPilot = new PlayerPilot(this.playerShip);
        this.playerShip.pilot = this.playerPilot;
        this.galaxy[0].ships.push(this.playerShip);
        this.camera = new Camera(this.playerShip.position, new Vector2D(window.innerWidth, window.innerHeight), 1);
        this.cameraTarget = this.playerShip;
        this.targetCamera = new TargetCamera(new Vector2D(0, 0), new Vector2D(this.targetCanvas.width, this.targetCanvas.height));
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
                const spawnPlanet = system.celestialBodies.find(body =>
                    !(body instanceof JumpGate || body.type.type == 'star')
                );
                if (!spawnPlanet) {
                    console.warn('No spawnPlanet found!');
                }
                if (!(spawnPlanet instanceof JumpGate)) {
                    const aiShip = createRandomShip(spawnPlanet.position.x, spawnPlanet.position.y, system);
                    if (aiShip instanceof Flivver || aiShip instanceof Arrow || aiShip instanceof Interceptor) {
                        if (Math.random() > 0.5) {
                            aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                        } else {
                            aiShip.pilot = new InterdictionAIPilot(aiShip, spawnPlanet);
                        }
                    } else if (aiShip instanceof Boxwing) {
                        aiShip.pilot = new MiningAIPilot(aiShip, spawnPlanet);
                    }
                    else {
                        aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                    }

                    if (aiShip instanceof Freighter) {
                        const escort01 = new Flivver(spawnPlanet.position.x, spawnPlanet.position.y, system);
                        escort01.pilot = new EscortAIPilot(escort01, aiShip);
                        escort01.colors.cockpit = aiShip.colors.cockpit;
                        escort01.colors.wings = aiShip.colors.wings;
                        escort01.colors.hull = aiShip.colors.hull;
                        escort01.trail.color = aiShip.trail.color;
                        system.addGameObject(escort01);
                    }

                    aiShip.setState('Landed');
                    aiShip.shipScale = 0;
                    aiShip.velocity.set(0, 0);
                    aiShip.landedPlanet = spawnPlanet;
                    spawnPlanet.addLandedShip(aiShip);
                    system.addGameObject(aiShip);
                }
            } else if (aiShipCount > system.maxAIShips) {
                const excessCount = aiShipCount - system.maxAIShips;
                let despawned = 0;
                const landedShips = [];
                system.celestialBodies.forEach(body => {
                    if (body.landedShips && body.landedShips.length > 0) {
                        landedShips.push(...body.landedShips.filter(ship => ship.pilot instanceof AIPilot));
                    }
                });
                while (despawned < excessCount && landedShips.length > 0) {
                    const index = Math.floor(Math.random() * landedShips.length);
                    const shipToDespawn = landedShips[index];
                    if (shipToDespawn === this.cameraTarget) {
                        this.cameraTarget = this.playerShip;
                    }
                    shipToDespawn.despawn();
                    despawned++;
                }
            }
        });

        this.lastSpawnTime = currentTime;
        this.spawnInterval = this.randomSpawnInterval();
    }

    /**
     * Cycles to the next asteroid in the current star system's asteroid belt.
     */
    cycleNextAsteroid() {
        if (this.cameraTarget) {
            this.cameraTarget.debug = false;
        }
        const asteroids = this.cameraTarget.starSystem.asteroidBelt ? this.cameraTarget.starSystem.asteroidBelt.interactiveAsteroids : [];
        if (asteroids.length === 0) return;
        const currentIndex = asteroids.indexOf(this.cameraTarget);
        const nextIndex = (currentIndex + 1) % asteroids.length;
        this.cameraTarget = asteroids[nextIndex];
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
        // this.galaxy.forEach(starSystem => {
        //     while (starSystem.ships.length < 10) {
        //         const spawnPlanet = starSystem.celestialBodies[Math.floor(Math.random() * starSystem.celestialBodies.length)];
        //         const angle = Math.random() * TWO_PI;
        //         // Use scratch vector for spawn position
        //         this._scratchSpawnPos.set(
        //             spawnPlanet.position.x + Math.sin(angle) * 50,
        //             spawnPlanet.position.y - Math.cos(angle) * 50
        //         );
        //         // const aiShip = new Ship(
        //         //     this._scratchSpawnPos.x,
        //         //     this._scratchSpawnPos.y,
        //         //     starSystem,
        //         //     new Colour(0.5, 0.5, 0.5),
        //         //     new Colour(0.5, 0.5, 0.5, 0.5)
        //         // );
        //         const aiShip = createRandomShip(this._scratchSpawnPos.x, this._scratchSpawnPos.y, starSystem, new Colour(1, 1, 1, 0.5));
        //         aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
        //         starSystem.ships.push(aiShip);
        //     }
        // });
    }

    /**
     * Cycles to the next AI-controlled ship in the current star system.
     */
    cycleNextAIShip() {
        if (this.cameraTarget) {
            this.cameraTarget.debug = false;
        }
        const ships = this.cameraTarget.starSystem.ships;
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
            if (e.key === 'w') {
                e.preventDefault();
                this.cycleNextAsteroid();
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