// game.js

// Import necessary modules for game functionality
import { Vector2D } from './vector2d.js'; // Provides 2D vector operations
import { Colour } from './colour.js'; // Handles color representations
import { Camera, TargetCamera } from './camera.js'; // Manages camera views
import { Ship } from './ship.js'; // Represents player and AI ships
import { CelestialBody, JumpGate } from './celestialBody.js'; // Defines celestial objects
import { StarField } from './starField.js'; // Generates starfield background
import { Asteroid } from './asteroidBelt.js'; // Handles asteroid belts and individual asteroids
import { HeadsUpDisplay } from './headsUpDisplay.js'; // Displays HUD elements
import { PlayerPilot, AIPilot } from './pilot.js'; // Controls ship behavior for players and AI
import { createGalaxy } from './galaxy.js';
//import { GameObject } from './gameObject.js'

/**
 * Manages the targeting system for selecting game objects like planets, ships, and asteroids.
 */
class TargetingSystem {
    /**
     * Creates a new TargetingSystem instance.
     * @param {GameManager} gameManager - The game manager providing access to game state.
     */
    constructor(gameManager) {
        this.gameManager = gameManager;
    }

    /**
     * Checks if a target is still valid (not despawned and exists in the galaxy).
     * @param {GameObject} target - The target game object to validate.
     * @returns {boolean} True if the target is valid, false otherwise.
     */
    isValidTarget(target) {
        if (target.isDespawned()) return false;
        if (target instanceof Ship) {
            return this.gameManager.galaxy.some(starSystem => starSystem.ships.includes(target));
        }
        if (target instanceof CelestialBody || target instanceof JumpGate) {
            return this.gameManager.galaxy.some(starSystem => starSystem.celestialBodies.includes(target));
        }
        if (target instanceof Asteroid) {
            return this.gameManager.galaxy.some(starSystem => starSystem.asteroidBelt && starSystem.asteroidBelt.interactiveAsteroids.includes(target));
        }
        return false;
    }
}

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
        this.targetCanvas.width = this.targetCanvas.offsetWidth;
        this.targetCanvas.height = this.targetCanvas.offsetHeight;
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
        this.canvasSize.width = window.innerWidth;
        this.canvasSize.height = window.innerHeight;
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
        if (!this.manager.isFocused) return; // Skip update if game window is not focused
        const MAX_DELTA = 100;
        if (deltaTime > MAX_DELTA) deltaTime = MAX_DELTA; // Cap deltaTime to prevent large jumps
        deltaTime = deltaTime / 1000; // Convert milliseconds to seconds

        this.manager.update(deltaTime);
        this.camera.update(this.manager.cameraTarget.position);

        // Validate the camera target's target if it's a ship
        if (this.manager.cameraTarget instanceof Ship && this.manager.cameraTarget.target) {
            const target = this.manager.cameraTarget.target;
            if (target.isDespawned() || this.manager.cameraTarget.starSystem !== target.starSystem) {
                this.manager.cameraTarget.clearTarget();
                console.log("force clear target");
            } else if (this.manager.targetingSystem.isValidTarget(target) && this.targetCanvas.style.display === 'none') {
                this.targetCanvas.style.display = 'block'; // Show target window if hidden and target is valid
                console.log("force display of target window");
            }
        }

        if (this.manager.zoomTextTimer > 0) {
            this.manager.zoomTextTimer -= deltaTime; // Decrease zoom text display timer
        }
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate)); // Calculate FPS
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
        if (this.manager.cameraTarget instanceof Ship && this.manager.cameraTarget.target) {
            this.targetCamera.updateTarget(this.manager.cameraTarget.target); // Update target camera position
        }
    }

    /**
     * Renders the game state to the canvas.
     * @param {number} deltaTime - Time elapsed since the last render in milliseconds.
     */
    render(deltaTime) {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); // Clear canvas with black background
        this.starField.draw(this.ctx, this.camera, this.manager.playerShip.velocity);
        const starSystem = this.manager.cameraTarget.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(this.ctx, this.camera);
        starSystem.celestialBodies.forEach(body => body.draw(this.ctx, this.camera));
        starSystem.ships.forEach(ship => ship.draw(this.ctx, this.camera));
        this.hud.draw(this.ctx, this.camera);
        this.renderTargetView();

        // Draw FPS and frame time bar
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);

        const maxFrameTime = 50;
        const barWidth = Math.min(deltaTime / maxFrameTime, 1) * 150;
        this.ctx.fillStyle = deltaTime > 33.33 ? 'red' : deltaTime > 16.67 ? 'yellow' : 'green'; // Color based on frame time
        this.ctx.fillRect(10, 25, barWidth, 10);
        this.ctx.restore();

        // Draw zoom percentage if timer is active
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
        let target = this.manager.cameraTarget instanceof Ship ? this.manager.cameraTarget.target : null;
        this.targetCtx.fillStyle = 'black';
        this.targetCtx.fillRect(0, 0, this.targetCanvas.width, this.targetCanvas.height); // Clear target canvas
        if (!target || !this.manager.targetingSystem.isValidTarget(target)) {
            this.targetCanvas.style.display = 'none'; // Hide target canvas if no valid target
            return;
        }
        this.targetCanvas.style.display = 'block'; // Show target canvas
        this.starField.draw(this.targetCtx, this.targetCamera, new Vector2D(0, 0));
        const starSystem = this.manager.cameraTarget.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(this.targetCtx, this.targetCamera);
        starSystem.celestialBodies.forEach(body => body.draw(this.targetCtx, this.targetCamera));
        starSystem.ships.forEach(ship => ship.draw(this.targetCtx, this.targetCamera));
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
        this.isFocused = true; // Tracks if the game window is focused
        this.galaxy = createGalaxy(); // Initializes the galaxy with star systems
        const earth = this.galaxy[0].celestialBodies[5];
        this.playerShip = new Ship(earth.position.x + 50, earth.position.y, this.galaxy[0]);
        this.playerPilot = new PlayerPilot(this.playerShip);
        this.playerShip.pilot = this.playerPilot;
        this.galaxy[0].ships.push(this.playerShip);
        this.camera = new Camera(this.playerShip.position, new Vector2D(window.innerWidth, window.innerHeight));
        this.cameraTarget = this.playerShip;
        this.targetCamera = new TargetCamera(new Vector2D(0, 0), new Vector2D(this.targetCanvas.offsetWidth, this.targetCanvas.offsetHeight));
        this.starField = new StarField(20, 1000);
        this.hud = new HeadsUpDisplay(this, window.innerWidth, window.innerHeight);
        this.zoomTextTimer = 0;
        this.lastSpawnTime = performance.now();
        this.spawnInterval = this.randomSpawnInterval();

        this.game = new Game(this, this.canvas, this.targetCanvas);
        this.targetingSystem = new TargetingSystem(this);

        this.spawnAIShips();
        this.setupEventListeners();

        this.game.start();
    }

    /**
     * Updates the game state, including ships and asteroid belts, and handles AI spawning and hyperjump attempts.
     * @param {number} deltaTime - Time elapsed since the last update in normalized units (60 FPS base).
     */
    update(deltaTime) {
        const currentTime = performance.now();
        this.updateShips(deltaTime);
        this.updateAsteroidBelts(deltaTime);
        this.spawnAIShipsIfNeeded(currentTime);
    }

    updateShips(deltaTime) {
        this.galaxy.forEach(starSystem => {
            starSystem.ships.forEach(ship => {
                if (ship.pilot) ship.pilot.update(deltaTime, this);
                ship.update(deltaTime);
            });
        });

        // Update lastKeys at the end of the frame
        Object.assign(this.lastKeys, this.keys);
    }

    updateAsteroidBelts(deltaTime) {
        this.galaxy.forEach(starSystem => {
            if (starSystem.asteroidBelt) starSystem.asteroidBelt.update(deltaTime);
        });
    }

    // Class: GameManager
    // Method: spawnAIShipsIfNeeded
    spawnAIShipsIfNeeded(currentTime) {
        if (currentTime - this.lastSpawnTime < this.spawnInterval) return;

        this.galaxy.forEach(system => {
            const aiShipCount = system.ships.filter(ship => ship.pilot instanceof AIPilot).length;

            // Spawn ships if below maxAIShips
            if (aiShipCount < system.maxAIShips) {
                const spawnPlanet = system.celestialBodies.find(body =>
                    !(body instanceof JumpGate) && body.landedShips // Ensure it can hold landed ships
                ) || system.celestialBodies[Math.floor(Math.random() * system.celestialBodies.length)];
                if (!(spawnPlanet instanceof JumpGate)) {
                    const aiShip = new Ship(spawnPlanet.position.x, spawnPlanet.position.y, system);
                    aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                    aiShip.setState('Landed'); // Start in Landed state
                    aiShip.shipScale = 0; // Invisible until takeoff
                    aiShip.velocity = new Vector2D(0, 0); // No initial velocity
                    aiShip.landedPlanet = spawnPlanet; // Set as landed planet
                    spawnPlanet.addLandedShip(aiShip); // Add to planet's landed list
                    system.ships.push(aiShip);
                }
            }
            // Despawn excess landed ships if above maxAIShips
            else if (aiShipCount > system.maxAIShips) {
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
                    shipToDespawn.despawn();
                    shipToDespawn.landedPlanet.removeLandedShip(shipToDespawn);
                    system.ships = system.ships.filter(ship => ship !== shipToDespawn);
                    landedShips.splice(index, 1);
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
        this.galaxy.forEach(starSystem => {
            while (starSystem.ships.length < 10) {
                const spawnPlanet = starSystem.celestialBodies[Math.floor(Math.random() * starSystem.celestialBodies.length)];
                const angle = Math.random() * Math.PI * 2;
                const aiShip = new Ship(
                    spawnPlanet.position.x + Math.cos(angle) * 50,
                    spawnPlanet.position.y + Math.sin(angle) * 50,
                    starSystem,
                    new Colour(0.5, 0.5, 0.5),
                    new Colour(0.5, 0.5, 0.5, 0.5)
                );
                aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                starSystem.ships.push(aiShip);
            }
        });
    }

    /**
     * Cycles to the next AI-controlled ship in the current star system.
     */
    cycleNextAIShip() {
        if (this.cameraTarget) {
            this.cameraTarget.debug = false;
        }
        const aiShips = this.cameraTarget.starSystem.ships.filter(ship => ship.pilot instanceof AIPilot);
        if (aiShips.length === 0) return;
        const currentIndex = this.cameraTarget.pilot instanceof AIPilot ? aiShips.indexOf(this.cameraTarget) : -1;
        const nextIndex = (currentIndex + 1) % aiShips.length;
        this.cameraTarget = aiShips[nextIndex];
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

        const resizeObserver = new ResizeObserver(() => {
            this.targetCanvas.width = this.targetCanvas.offsetWidth;
            this.targetCanvas.height = this.targetCanvas.offsetHeight;
            this.targetCamera.screenSize.width = this.targetCanvas.width;
            this.targetCamera.screenSize.height = this.targetCanvas.height;
        });
        resizeObserver.observe(this.targetCanvas);

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
                this.debug = !(this.debug);
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