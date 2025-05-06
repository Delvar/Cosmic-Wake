// shipTypes.js

import { Ship } from './ship.js';

export class Flivver extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 2.5;
        this.thrust = 800;
        this.maxVelocity = 700;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 2280.0 (from 570.0 to 2850.0), height = 1920.0 (from 480.0 to 2400.0)
        this.boundingBox.set(38.00, 32.00);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 14.00, radius: 2.00 },
                { x: 6.00, y: 14.00, radius: 1.00 },
                { x: -6.00, y: 14.00, radius: 1.00 },
            ],
            turrets: [
            ],
            fixedWeapons: [
                { x: 2.00, y: -15.00, radius: 2.00 },
                { x: -2.00, y: -15.00, radius: 2.00 },
            ],
            lights: [
                { x: 18.00, y: 15.00, radius: 1.00 },
                { x: -18.00, y: 15.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-1.00, 4.00);
        ctx.lineTo(1.00, 4.00);
        ctx.lineTo(2.00, 7.00);
        ctx.lineTo(2.00, 8.00);
        ctx.lineTo(1.00, 9.00);
        ctx.lineTo(-1.00, 9.00);
        ctx.lineTo(-2.00, 8.00);
        ctx.lineTo(-2.00, 7.00);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(3.00, -6.00);
        ctx.lineTo(4.00, -5.00);
        ctx.lineTo(5.00, 7.00);
        ctx.lineTo(5.00, 10.00);
        ctx.lineTo(4.00, 12.00);
        ctx.lineTo(3.00, 10.00);
        ctx.lineTo(3.00, 7.00);
        ctx.closePath();
        ctx.moveTo(-3.00, -6.00);
        ctx.lineTo(-3.00, 7.00);
        ctx.lineTo(-3.00, 10.00);
        ctx.lineTo(-4.00, 12.00);
        ctx.lineTo(-5.00, 10.00);
        ctx.lineTo(-5.00, 7.00);
        ctx.lineTo(-4.00, -5.00);
        ctx.closePath();
        ctx.moveTo(2.00, -15.00);
        ctx.lineTo(8.00, 5.00);
        ctx.lineTo(8.00, 13.00);
        ctx.lineTo(4.00, 13.00);
        ctx.lineTo(4.00, 12.00);
        ctx.lineTo(5.00, 10.00);
        ctx.lineTo(4.00, -5.00);
        ctx.lineTo(2.00, -7.00);
        ctx.closePath();
        ctx.moveTo(0.00, 1.00);
        ctx.lineTo(2.00, 3.00);
        ctx.lineTo(3.00, 7.00);
        ctx.lineTo(3.00, 10.00);
        ctx.lineTo(2.00, 12.00);
        ctx.lineTo(-2.00, 12.00);
        ctx.lineTo(-3.00, 10.00);
        ctx.lineTo(-3.00, 7.00);
        ctx.lineTo(-2.00, 3.00);
        ctx.closePath();
        ctx.moveTo(-2.00, -15.00);
        ctx.lineTo(-2.00, -7.00);
        ctx.lineTo(-4.00, -5.00);
        ctx.lineTo(-5.00, 10.00);
        ctx.lineTo(-4.00, 12.00);
        ctx.lineTo(-4.00, 13.00);
        ctx.lineTo(-8.00, 13.00);
        ctx.lineTo(-8.00, 5.00);
        ctx.closePath();
        ctx.moveTo(4.00, 13.00);
        ctx.lineTo(8.00, 13.00);
        ctx.lineTo(7.00, 14.00);
        ctx.lineTo(5.00, 14.00);
        ctx.closePath();
        ctx.moveTo(-2.00, 12.00);
        ctx.lineTo(2.00, 12.00);
        ctx.lineTo(2.00, 14.00);
        ctx.lineTo(-2.00, 14.00);
        ctx.closePath();
        ctx.moveTo(-8.00, 13.00);
        ctx.lineTo(-4.00, 13.00);
        ctx.lineTo(-5.00, 14.00);
        ctx.lineTo(-7.00, 14.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(8.00, 5.00);
        ctx.lineTo(18.00, 13.00);
        ctx.lineTo(18.00, 15.00);
        ctx.lineTo(8.00, 13.00);
        ctx.closePath();
        ctx.moveTo(-8.00, 5.00);
        ctx.lineTo(-8.00, 13.00);
        ctx.lineTo(-18.00, 15.00);
        ctx.lineTo(-18.00, 13.00);
        ctx.closePath();
        ctx.moveTo(4.00, 5.00);
        ctx.lineTo(6.00, 10.00);
        ctx.lineTo(6.00, 12.00);
        ctx.lineTo(4.00, 10.00);
        ctx.closePath();
        ctx.moveTo(-4.00, 5.00);
        ctx.lineTo(-4.00, 10.00);
        ctx.lineTo(-6.00, 12.00);
        ctx.lineTo(-6.00, 10.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class Shuttle extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 1.2;
        this.thrust = 200;
        this.maxVelocity = 400;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 1080.0 (from 270.0 to 1350.0), height = 1740.0 (from 435.0 to 2175.0)
        this.boundingBox.set(18.00, 29.00);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 2.00, y: 13.50, radius: 1.00 },
                { x: -2.00, y: 13.50, radius: 1.00 },
            ],
            turrets: [
            ],
            fixedWeapons: [
                { x: 0.00, y: -12.50, radius: 2.00 },
            ],
            lights: [
                { x: 8.00, y: 11.50, radius: 1.00 },
                { x: -8.00, y: 11.50, radius: 1.00 },
                { x: 4.00, y: -6.50, radius: 1.00 },
                { x: -4.00, y: -6.50, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-1.00, -10.50);
        ctx.lineTo(1.00, -10.50);
        ctx.lineTo(2.00, -6.50);
        ctx.lineTo(-2.00, -6.50);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, 12.50);
        ctx.lineTo(4.00, 12.50);
        ctx.lineTo(3.00, 13.50);
        ctx.lineTo(1.00, 13.50);
        ctx.closePath();
        ctx.moveTo(-4.00, 12.50);
        ctx.lineTo(0.00, 12.50);
        ctx.lineTo(-1.00, 13.50);
        ctx.lineTo(-3.00, 13.50);
        ctx.closePath();
        ctx.moveTo(2.00, -4.50);
        ctx.lineTo(5.00, -3.50);
        ctx.lineTo(6.00, 2.50);
        ctx.lineTo(6.00, 11.50);
        ctx.lineTo(4.00, 12.50);
        ctx.lineTo(-4.00, 12.50);
        ctx.lineTo(-6.00, 11.50);
        ctx.lineTo(-6.00, 2.50);
        ctx.lineTo(-5.00, -3.50);
        ctx.lineTo(-2.00, -4.50);
        ctx.closePath();
        ctx.moveTo(0.00, -12.50);
        ctx.lineTo(2.00, -11.50);
        ctx.lineTo(3.00, -9.50);
        ctx.lineTo(3.00, -5.50);
        ctx.lineTo(2.00, -4.50);
        ctx.lineTo(-2.00, -4.50);
        ctx.lineTo(-3.00, -5.50);
        ctx.lineTo(-3.00, -9.50);
        ctx.lineTo(-2.00, -11.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(3.00, -9.50);
        ctx.lineTo(4.00, -7.50);
        ctx.lineTo(4.00, -6.50);
        ctx.lineTo(3.00, -7.50);
        ctx.closePath();
        ctx.moveTo(-3.00, -9.50);
        ctx.lineTo(-3.00, -7.50);
        ctx.lineTo(-4.00, -6.50);
        ctx.lineTo(-4.00, -7.50);
        ctx.closePath();
        ctx.moveTo(6.00, 2.50);
        ctx.lineTo(8.00, 6.50);
        ctx.lineTo(8.00, 11.50);
        ctx.lineTo(6.00, 11.50);
        ctx.closePath();
        ctx.moveTo(-6.00, 2.50);
        ctx.lineTo(-6.00, 11.50);
        ctx.lineTo(-8.00, 11.50);
        ctx.lineTo(-8.00, 6.50);
        ctx.closePath();
        ctx.moveTo(0.00, 2.50);
        ctx.lineTo(1.00, 11.50);
        ctx.lineTo(-1.00, 11.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class HeavyShuttle extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 1.1;
        this.thrust = 150;
        this.maxVelocity = 350;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 1200.0 (from 300.0 to 1500.0), height = 2160.0 (from 540.0 to 2700.0)
        this.boundingBox.set(20.00, 36.00);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 2.00, y: 17.00, radius: 1.00 },
                { x: -2.00, y: 17.00, radius: 1.00 },
            ],
            turrets: [
            ],
            fixedWeapons: [
                { x: 0.00, y: -16.00, radius: 2.00 },
            ],
            lights: [
                { x: 8.00, y: 15.00, radius: 1.00 },
                { x: -8.00, y: 15.00, radius: 1.00 },
                { x: 5.00, y: -6.00, radius: 1.00 },
                { x: -5.00, y: -6.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-1.00, -14.00);
        ctx.lineTo(1.00, -14.00);
        ctx.lineTo(2.00, -10.00);
        ctx.lineTo(2.00, -8.00);
        ctx.lineTo(1.00, -7.00);
        ctx.lineTo(-1.00, -7.00);
        ctx.lineTo(-2.00, -8.00);
        ctx.lineTo(-2.00, -10.00);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, 16.00);
        ctx.lineTo(4.00, 16.00);
        ctx.lineTo(3.00, 17.00);
        ctx.lineTo(1.00, 17.00);
        ctx.closePath();
        ctx.moveTo(-4.00, 16.00);
        ctx.lineTo(0.00, 16.00);
        ctx.lineTo(-1.00, 17.00);
        ctx.lineTo(-3.00, 17.00);
        ctx.closePath();
        ctx.moveTo(-3.00, -4.00);
        ctx.lineTo(3.00, -4.00);
        ctx.lineTo(5.00, -3.00);
        ctx.lineTo(6.00, 0.00);
        ctx.lineTo(6.00, 3.00);
        ctx.lineTo(6.00, 14.00);
        ctx.lineTo(4.00, 16.00);
        ctx.lineTo(0.00, 16.00);
        ctx.lineTo(-4.00, 16.00);
        ctx.lineTo(-6.00, 14.00);
        ctx.lineTo(-6.00, 3.00);
        ctx.lineTo(-6.00, 0.00);
        ctx.lineTo(-5.00, -3.00);
        ctx.closePath();
        ctx.moveTo(0.00, -16.00);
        ctx.lineTo(3.00, -15.00);
        ctx.lineTo(4.00, -11.00);
        ctx.lineTo(4.00, -7.00);
        ctx.lineTo(4.00, -5.00);
        ctx.lineTo(3.00, -4.00);
        ctx.lineTo(-3.00, -4.00);
        ctx.lineTo(-4.00, -5.00);
        ctx.lineTo(-4.00, -7.00);
        ctx.lineTo(-4.00, -11.00);
        ctx.lineTo(-3.00, -15.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(4.00, -11.00);
        ctx.lineTo(5.00, -9.00);
        ctx.lineTo(5.00, -6.00);
        ctx.lineTo(4.00, -7.00);
        ctx.closePath();
        ctx.moveTo(-4.00, -11.00);
        ctx.lineTo(-4.00, -7.00);
        ctx.lineTo(-5.00, -6.00);
        ctx.lineTo(-5.00, -9.00);
        ctx.closePath();
        ctx.moveTo(6.00, 3.00);
        ctx.lineTo(8.00, 7.00);
        ctx.lineTo(8.00, 15.00);
        ctx.lineTo(6.00, 14.00);
        ctx.closePath();
        ctx.moveTo(-6.00, 3.00);
        ctx.lineTo(-6.00, 14.00);
        ctx.lineTo(-8.00, 15.00);
        ctx.lineTo(-8.00, 7.00);
        ctx.closePath();
        ctx.moveTo(0.00, 3.00);
        ctx.lineTo(1.00, 15.00);
        ctx.lineTo(-1.00, 15.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class StarBarge extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.5;
        this.thrust = 25;
        this.maxVelocity = 100;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 2040.0 (from 510.0 to 2550.0), height = 2640.0 (from 660.0 to 3300.0)
        this.boundingBox.set(34.00, 44.00);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 20.00, radius: 2.00 },
            ],
            turrets: [
                { x: 0.00, y: -1.00, radius: 3.00 },
            ],
            fixedWeapons: [
                //{ x: 0.00, y: -20.00, radius: 2.00 },
            ],
            lights: [
                { x: -16.00, y: 15.00, radius: 1.00 },
                { x: 16.00, y: 15.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-1.00, -18.00);
        ctx.lineTo(1.00, -18.00);
        ctx.lineTo(2.00, -14.00);
        ctx.lineTo(2.00, -12.00);
        ctx.lineTo(1.00, -11.00);
        ctx.lineTo(-1.00, -11.00);
        ctx.lineTo(-2.00, -12.00);
        ctx.lineTo(-2.00, -14.00);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-3.00, -9.00);
        ctx.lineTo(3.00, -9.00);
        ctx.lineTo(8.00, -7.00);
        ctx.lineTo(2.00, -7.00);
        ctx.lineTo(1.00, -6.00);
        ctx.lineTo(1.00, 16.00);
        ctx.lineTo(2.00, 17.00);
        ctx.lineTo(8.00, 17.00);
        ctx.lineTo(3.00, 19.00);
        ctx.lineTo(-3.00, 19.00);
        ctx.lineTo(-8.00, 17.00);
        ctx.lineTo(-2.00, 17.00);
        ctx.lineTo(-1.00, 16.00);
        ctx.lineTo(-1.00, -6.00);
        ctx.lineTo(-2.00, -7.00);
        ctx.lineTo(-8.00, -7.00);
        ctx.closePath();
        ctx.moveTo(0.00, -20.00);
        ctx.lineTo(3.00, -19.00);
        ctx.lineTo(4.00, -15.00);
        ctx.lineTo(4.00, -10.00);
        ctx.lineTo(3.00, -9.00);
        ctx.lineTo(-3.00, -9.00);
        ctx.lineTo(-4.00, -10.00);
        ctx.lineTo(-4.00, -15.00);
        ctx.lineTo(-3.00, -19.00);
        ctx.closePath();
        ctx.moveTo(2.00, -7.00);
        ctx.lineTo(8.00, -7.00);
        ctx.lineTo(7.00, -6.00);
        ctx.lineTo(7.00, 16.00);
        ctx.lineTo(8.00, 17.00);
        ctx.lineTo(2.00, 17.00);
        ctx.lineTo(1.00, 16.00);
        ctx.lineTo(1.00, -6.00);
        ctx.closePath();
        ctx.moveTo(8.00, -7.00);
        ctx.lineTo(12.00, -7.00);
        ctx.lineTo(13.00, -6.00);
        ctx.lineTo(13.00, 16.00);
        ctx.lineTo(12.00, 17.00);
        ctx.lineTo(8.00, 17.00);
        ctx.lineTo(7.00, 16.00);
        ctx.lineTo(7.00, -6.00);
        ctx.closePath();
        ctx.moveTo(9.00, -6.00);
        ctx.lineTo(11.00, -6.00);
        ctx.lineTo(12.00, -5.00);
        ctx.lineTo(12.00, 3.00);
        ctx.lineTo(11.00, 4.00);
        ctx.lineTo(9.00, 4.00);
        ctx.lineTo(8.00, 3.00);
        ctx.lineTo(8.00, -5.00);
        ctx.closePath();
        ctx.moveTo(9.00, 6.00);
        ctx.lineTo(11.00, 6.00);
        ctx.lineTo(12.00, 7.00);
        ctx.lineTo(12.00, 15.00);
        ctx.lineTo(11.00, 16.00);
        ctx.lineTo(9.00, 16.00);
        ctx.lineTo(8.00, 15.00);
        ctx.lineTo(8.00, 7.00);
        ctx.closePath();
        ctx.moveTo(-3.00, 19.00);
        ctx.lineTo(3.00, 19.00);
        ctx.lineTo(2.00, 20.00);
        ctx.lineTo(-2.00, 20.00);
        ctx.closePath();
        ctx.moveTo(-12.00, -7.00);
        ctx.lineTo(-8.00, -7.00);
        ctx.lineTo(-7.00, -6.00);
        ctx.lineTo(-7.00, 16.00);
        ctx.lineTo(-8.00, 17.00);
        ctx.lineTo(-12.00, 17.00);
        ctx.lineTo(-13.00, 16.00);
        ctx.lineTo(-13.00, -6.00);
        ctx.closePath();
        ctx.moveTo(-11.00, -6.00);
        ctx.lineTo(-9.00, -6.00);
        ctx.lineTo(-8.00, -5.00);
        ctx.lineTo(-8.00, 3.00);
        ctx.lineTo(-9.00, 4.00);
        ctx.lineTo(-11.00, 4.00);
        ctx.lineTo(-12.00, 3.00);
        ctx.lineTo(-12.00, -5.00);
        ctx.closePath();
        ctx.moveTo(-11.00, 6.00);
        ctx.lineTo(-9.00, 6.00);
        ctx.lineTo(-8.00, 7.00);
        ctx.lineTo(-8.00, 15.00);
        ctx.lineTo(-9.00, 16.00);
        ctx.lineTo(-11.00, 16.00);
        ctx.lineTo(-12.00, 15.00);
        ctx.lineTo(-12.00, 7.00);
        ctx.closePath();
        ctx.moveTo(-8.00, -7.00);
        ctx.lineTo(-2.00, -7.00);
        ctx.lineTo(-1.00, -6.00);
        ctx.lineTo(-1.00, 16.00);
        ctx.lineTo(-2.00, 17.00);
        ctx.lineTo(-8.00, 17.00);
        ctx.lineTo(-7.00, 16.00);
        ctx.lineTo(-7.00, -6.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(13.00, 3.00);
        ctx.lineTo(16.00, 9.00);
        ctx.lineTo(16.00, 15.00);
        ctx.lineTo(13.00, 14.00);
        ctx.closePath();
        ctx.moveTo(0.00, 6.00);
        ctx.lineTo(1.00, 18.00);
        ctx.lineTo(-1.00, 18.00);
        ctx.closePath();
        ctx.moveTo(-13.00, 3.00);
        ctx.lineTo(-13.00, 14.00);
        ctx.lineTo(-16.00, 15.00);
        ctx.lineTo(-16.00, 9.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class Freighter extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.25;
        this.thrust = 25;
        this.maxVelocity = 100;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 2520.0 (from 630.0 to 3150.0), height = 7680.0 (from 1920.0 to 9600.0)
        this.boundingBox.set(42.00, 128.00);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 6.00, y: 62.00, radius: 2.00 },
                { x: -6.00, y: 62.00, radius: 2.00 },
            ],
            turrets: [
                { x: 0.00, y: -35.00, radius: 3.00 },
                { x: 0.00, y: 15.00, radius: 3.00 },
            ],
            fixedWeapons: [
            ],
            lights: [
                { x: 7.00, y: -54.00, radius: 1.00 },
                { x: -7.00, y: -54.00, radius: 1.00 },
                { x: 20.00, y: -1.00, radius: 1.00 },
                { x: -20.00, y: -1.00, radius: 1.00 },
                { x: 20.00, y: 52.00, radius: 1.00 },
                { x: -20.00, y: 52.00, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-1.00, -62.00);
        ctx.lineTo(1.00, -62.00);
        ctx.lineTo(2.00, -58.00);
        ctx.lineTo(2.00, -56.00);
        ctx.lineTo(1.00, -55.00);
        ctx.lineTo(-1.00, -55.00);
        ctx.lineTo(-2.00, -56.00);
        ctx.lineTo(-2.00, -58.00);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-3.00, -51.00);
        ctx.lineTo(3.00, -51.00);
        ctx.lineTo(8.00, -47.00);
        ctx.lineTo(2.00, -47.00);
        ctx.lineTo(1.00, -46.00);
        ctx.lineTo(1.00, -24.00);
        ctx.lineTo(2.00, -23.00);
        ctx.lineTo(8.00, -23.00);
        ctx.lineTo(8.00, -22.00);
        ctx.lineTo(2.00, -22.00);
        ctx.lineTo(1.00, -21.00);
        ctx.lineTo(1.00, 1.00);
        ctx.lineTo(2.00, 2.00);
        ctx.lineTo(8.00, 2.00);
        ctx.lineTo(8.00, 3.00);
        ctx.lineTo(2.00, 3.00);
        ctx.lineTo(1.00, 4.00);
        ctx.lineTo(1.00, 26.00);
        ctx.lineTo(2.00, 27.00);
        ctx.lineTo(8.00, 27.00);
        ctx.lineTo(8.00, 28.00);
        ctx.lineTo(2.00, 28.00);
        ctx.lineTo(1.00, 29.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(0.00, 50.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.lineTo(-1.00, 29.00);
        ctx.lineTo(-2.00, 28.00);
        ctx.lineTo(-8.00, 28.00);
        ctx.lineTo(-8.00, 27.00);
        ctx.lineTo(-2.00, 27.00);
        ctx.lineTo(-1.00, 26.00);
        ctx.lineTo(-1.00, 4.00);
        ctx.lineTo(-2.00, 3.00);
        ctx.lineTo(-8.00, 3.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-2.00, 2.00);
        ctx.lineTo(-1.00, 1.00);
        ctx.lineTo(-1.00, -21.00);
        ctx.lineTo(-2.00, -22.00);
        ctx.lineTo(-8.00, -22.00);
        ctx.lineTo(-8.00, -23.00);
        ctx.lineTo(-2.00, -23.00);
        ctx.lineTo(-1.00, -24.00);
        ctx.lineTo(-1.00, -46.00);
        ctx.lineTo(-2.00, -47.00);
        ctx.lineTo(-8.00, -47.00);
        ctx.closePath();
        ctx.moveTo(1.00, 57.00);
        ctx.lineTo(11.00, 55.00);
        ctx.lineTo(10.00, 60.00);
        ctx.lineTo(8.00, 62.00);
        ctx.lineTo(4.00, 62.00);
        ctx.lineTo(2.00, 60.00);
        ctx.closePath();
        ctx.moveTo(-11.00, 55.00);
        ctx.lineTo(-1.00, 57.00);
        ctx.lineTo(-2.00, 60.00);
        ctx.lineTo(-4.00, 62.00);
        ctx.lineTo(-8.00, 62.00);
        ctx.lineTo(-10.00, 60.00);
        ctx.closePath();
        ctx.moveTo(-12.00, 52.00);
        ctx.lineTo(-2.00, 52.00);
        ctx.lineTo(0.00, 50.00);
        ctx.lineTo(2.00, 52.00);
        ctx.lineTo(12.00, 52.00);
        ctx.lineTo(11.00, 55.00);
        ctx.lineTo(1.00, 57.00);
        ctx.lineTo(-1.00, 57.00);
        ctx.lineTo(-11.00, 55.00);
        ctx.closePath();
        ctx.moveTo(0.00, -64.00);
        ctx.lineTo(3.00, -63.00);
        ctx.lineTo(4.00, -59.00);
        ctx.lineTo(4.00, -54.00);
        ctx.lineTo(4.00, -52.00);
        ctx.lineTo(3.00, -51.00);
        ctx.lineTo(-3.00, -51.00);
        ctx.lineTo(-4.00, -52.00);
        ctx.lineTo(-4.00, -54.00);
        ctx.lineTo(-4.00, -59.00);
        ctx.lineTo(-3.00, -63.00);
        ctx.closePath();
        ctx.moveTo(8.00, -47.00);
        ctx.lineTo(12.00, -47.00);
        ctx.lineTo(13.00, -46.00);
        ctx.lineTo(13.00, -24.00);
        ctx.lineTo(12.00, -23.00);
        ctx.lineTo(8.00, -23.00);
        ctx.lineTo(7.00, -24.00);
        ctx.lineTo(7.00, -46.00);
        ctx.closePath();
        ctx.moveTo(2.00, -47.00);
        ctx.lineTo(8.00, -47.00);
        ctx.lineTo(7.00, -46.00);
        ctx.lineTo(7.00, -24.00);
        ctx.lineTo(8.00, -23.00);
        ctx.lineTo(2.00, -23.00);
        ctx.lineTo(1.00, -24.00);
        ctx.lineTo(1.00, -46.00);
        ctx.closePath();
        ctx.moveTo(8.00, -22.00);
        ctx.lineTo(12.00, -22.00);
        ctx.lineTo(13.00, -21.00);
        ctx.lineTo(13.00, 1.00);
        ctx.lineTo(12.00, 2.00);
        ctx.lineTo(8.00, 2.00);
        ctx.lineTo(7.00, 1.00);
        ctx.lineTo(7.00, -21.00);
        ctx.closePath();
        ctx.moveTo(2.00, -22.00);
        ctx.lineTo(8.00, -22.00);
        ctx.lineTo(7.00, -21.00);
        ctx.lineTo(7.00, 1.00);
        ctx.lineTo(8.00, 2.00);
        ctx.lineTo(2.00, 2.00);
        ctx.lineTo(1.00, 1.00);
        ctx.lineTo(1.00, -21.00);
        ctx.closePath();
        ctx.moveTo(8.00, 3.00);
        ctx.lineTo(12.00, 3.00);
        ctx.lineTo(13.00, 4.00);
        ctx.lineTo(13.00, 26.00);
        ctx.lineTo(12.00, 27.00);
        ctx.lineTo(8.00, 27.00);
        ctx.lineTo(7.00, 26.00);
        ctx.lineTo(7.00, 4.00);
        ctx.closePath();
        ctx.moveTo(2.00, 3.00);
        ctx.lineTo(8.00, 3.00);
        ctx.lineTo(7.00, 4.00);
        ctx.lineTo(7.00, 26.00);
        ctx.lineTo(8.00, 27.00);
        ctx.lineTo(2.00, 27.00);
        ctx.lineTo(1.00, 26.00);
        ctx.lineTo(1.00, 4.00);
        ctx.closePath();
        ctx.moveTo(8.00, 28.00);
        ctx.lineTo(12.00, 28.00);
        ctx.lineTo(13.00, 29.00);
        ctx.lineTo(13.00, 51.00);
        ctx.lineTo(12.00, 52.00);
        ctx.lineTo(8.00, 52.00);
        ctx.lineTo(7.00, 51.00);
        ctx.lineTo(7.00, 29.00);
        ctx.closePath();
        ctx.moveTo(2.00, 28.00);
        ctx.lineTo(8.00, 28.00);
        ctx.lineTo(7.00, 29.00);
        ctx.lineTo(7.00, 51.00);
        ctx.lineTo(8.00, 52.00);
        ctx.lineTo(2.00, 52.00);
        ctx.lineTo(1.00, 51.00);
        ctx.lineTo(1.00, 29.00);
        ctx.closePath();
        ctx.moveTo(-12.00, 28.00);
        ctx.lineTo(-8.00, 28.00);
        ctx.lineTo(-7.00, 29.00);
        ctx.lineTo(-7.00, 51.00);
        ctx.lineTo(-8.00, 52.00);
        ctx.lineTo(-12.00, 52.00);
        ctx.lineTo(-13.00, 51.00);
        ctx.lineTo(-13.00, 29.00);
        ctx.closePath();
        ctx.moveTo(-8.00, 28.00);
        ctx.lineTo(-2.00, 28.00);
        ctx.lineTo(-1.00, 29.00);
        ctx.lineTo(-1.00, 51.00);
        ctx.lineTo(-2.00, 52.00);
        ctx.lineTo(-8.00, 52.00);
        ctx.lineTo(-7.00, 51.00);
        ctx.lineTo(-7.00, 29.00);
        ctx.closePath();
        ctx.moveTo(-12.00, 3.00);
        ctx.lineTo(-8.00, 3.00);
        ctx.lineTo(-7.00, 4.00);
        ctx.lineTo(-7.00, 26.00);
        ctx.lineTo(-8.00, 27.00);
        ctx.lineTo(-12.00, 27.00);
        ctx.lineTo(-13.00, 26.00);
        ctx.lineTo(-13.00, 4.00);
        ctx.closePath();
        ctx.moveTo(-8.00, 3.00);
        ctx.lineTo(-2.00, 3.00);
        ctx.lineTo(-1.00, 4.00);
        ctx.lineTo(-1.00, 26.00);
        ctx.lineTo(-2.00, 27.00);
        ctx.lineTo(-8.00, 27.00);
        ctx.lineTo(-7.00, 26.00);
        ctx.lineTo(-7.00, 4.00);
        ctx.closePath();
        ctx.moveTo(-12.00, -22.00);
        ctx.lineTo(-8.00, -22.00);
        ctx.lineTo(-7.00, -21.00);
        ctx.lineTo(-7.00, 1.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-12.00, 2.00);
        ctx.lineTo(-13.00, 1.00);
        ctx.lineTo(-13.00, -21.00);
        ctx.closePath();
        ctx.moveTo(-8.00, -22.00);
        ctx.lineTo(-2.00, -22.00);
        ctx.lineTo(-1.00, -21.00);
        ctx.lineTo(-1.00, 1.00);
        ctx.lineTo(-2.00, 2.00);
        ctx.lineTo(-8.00, 2.00);
        ctx.lineTo(-7.00, 1.00);
        ctx.lineTo(-7.00, -21.00);
        ctx.closePath();
        ctx.moveTo(-12.00, -47.00);
        ctx.lineTo(-8.00, -47.00);
        ctx.lineTo(-7.00, -46.00);
        ctx.lineTo(-7.00, -24.00);
        ctx.lineTo(-8.00, -23.00);
        ctx.lineTo(-12.00, -23.00);
        ctx.lineTo(-13.00, -24.00);
        ctx.lineTo(-13.00, -46.00);
        ctx.closePath();
        ctx.moveTo(-8.00, -47.00);
        ctx.lineTo(-2.00, -47.00);
        ctx.lineTo(-1.00, -46.00);
        ctx.lineTo(-1.00, -24.00);
        ctx.lineTo(-2.00, -23.00);
        ctx.lineTo(-8.00, -23.00);
        ctx.lineTo(-7.00, -24.00);
        ctx.lineTo(-7.00, -46.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(4.00, -59.00);
        ctx.lineTo(7.00, -56.00);
        ctx.lineTo(7.00, -54.00);
        ctx.lineTo(4.00, -54.00);
        ctx.closePath();
        ctx.moveTo(-4.00, -59.00);
        ctx.lineTo(-4.00, -54.00);
        ctx.lineTo(-7.00, -54.00);
        ctx.lineTo(-7.00, -56.00);
        ctx.closePath();
        ctx.moveTo(13.00, -13.00);
        ctx.lineTo(20.00, -5.00);
        ctx.lineTo(20.00, -1.00);
        ctx.lineTo(13.00, -2.00);
        ctx.closePath();
        ctx.moveTo(-13.00, -13.00);
        ctx.lineTo(-13.00, -2.00);
        ctx.lineTo(-20.00, -1.00);
        ctx.lineTo(-20.00, -5.00);
        ctx.closePath();
        ctx.moveTo(0.00, -13.00);
        ctx.lineTo(1.00, -1.00);
        ctx.lineTo(-1.00, -1.00);
        ctx.closePath();
        ctx.moveTo(13.00, 31.00);
        ctx.lineTo(20.00, 43.00);
        ctx.lineTo(20.00, 52.00);
        ctx.lineTo(13.00, 51.00);
        ctx.closePath();
        ctx.moveTo(-13.00, 31.00);
        ctx.lineTo(-13.00, 51.00);
        ctx.lineTo(-20.00, 52.00);
        ctx.lineTo(-20.00, 43.00);
        ctx.closePath();
        ctx.moveTo(0.00, 29.00);
        ctx.lineTo(1.00, 52.00);
        ctx.lineTo(-1.00, 52.00);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.beginPath();
        ctx.moveTo(9.00, -46.00);
        ctx.lineTo(11.00, -46.00);
        ctx.lineTo(12.00, -45.00);
        ctx.lineTo(12.00, -37.00);
        ctx.lineTo(11.00, -36.00);
        ctx.lineTo(9.00, -36.00);
        ctx.lineTo(8.00, -37.00);
        ctx.lineTo(8.00, -45.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(9.00, -34.00);
        ctx.lineTo(11.00, -34.00);
        ctx.lineTo(12.00, -33.00);
        ctx.lineTo(12.00, -25.00);
        ctx.lineTo(11.00, -24.00);
        ctx.lineTo(9.00, -24.00);
        ctx.lineTo(8.00, -25.00);
        ctx.lineTo(8.00, -33.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(11.00, -21.00);
        ctx.lineTo(12.00, -20.00);
        ctx.lineTo(12.00, -12.00);
        ctx.lineTo(11.00, -11.00);
        ctx.lineTo(9.00, -11.00);
        ctx.lineTo(8.00, -12.00);
        ctx.lineTo(8.00, -20.00);
        ctx.lineTo(9.00, -21.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(11.00, -9.00);
        ctx.lineTo(12.00, -8.00);
        ctx.lineTo(12.00, 0.00);
        ctx.lineTo(11.00, 1.00);
        ctx.lineTo(9.00, 1.00);
        ctx.lineTo(8.00, 0.00);
        ctx.lineTo(8.00, -8.00);
        ctx.lineTo(9.00, -9.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(11.00, 4.00);
        ctx.lineTo(12.00, 5.00);
        ctx.lineTo(12.00, 13.00);
        ctx.lineTo(11.00, 14.00);
        ctx.lineTo(9.00, 14.00);
        ctx.lineTo(8.00, 13.00);
        ctx.lineTo(8.00, 5.00);
        ctx.lineTo(9.00, 4.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(11.00, 16.00);
        ctx.lineTo(12.00, 17.00);
        ctx.lineTo(12.00, 25.00);
        ctx.lineTo(11.00, 26.00);
        ctx.lineTo(9.00, 26.00);
        ctx.lineTo(8.00, 25.00);
        ctx.lineTo(8.00, 17.00);
        ctx.lineTo(9.00, 16.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(11.00, 29.00);
        ctx.lineTo(12.00, 30.00);
        ctx.lineTo(12.00, 38.00);
        ctx.lineTo(11.00, 39.00);
        ctx.lineTo(9.00, 39.00);
        ctx.lineTo(8.00, 38.00);
        ctx.lineTo(8.00, 30.00);
        ctx.lineTo(9.00, 29.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(11.00, 41.00);
        ctx.lineTo(12.00, 42.00);
        ctx.lineTo(12.00, 50.00);
        ctx.lineTo(11.00, 51.00);
        ctx.lineTo(9.00, 51.00);
        ctx.lineTo(8.00, 50.00);
        ctx.lineTo(8.00, 42.00);
        ctx.lineTo(9.00, 41.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, 41.00);
        ctx.lineTo(-8.00, 42.00);
        ctx.lineTo(-8.00, 50.00);
        ctx.lineTo(-9.00, 51.00);
        ctx.lineTo(-11.00, 51.00);
        ctx.lineTo(-12.00, 50.00);
        ctx.lineTo(-12.00, 42.00);
        ctx.lineTo(-11.00, 41.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, 29.00);
        ctx.lineTo(-8.00, 30.00);
        ctx.lineTo(-8.00, 38.00);
        ctx.lineTo(-9.00, 39.00);
        ctx.lineTo(-11.00, 39.00);
        ctx.lineTo(-12.00, 38.00);
        ctx.lineTo(-12.00, 30.00);
        ctx.lineTo(-11.00, 29.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, 16.00);
        ctx.lineTo(-8.00, 17.00);
        ctx.lineTo(-8.00, 25.00);
        ctx.lineTo(-9.00, 26.00);
        ctx.lineTo(-11.00, 26.00);
        ctx.lineTo(-12.00, 25.00);
        ctx.lineTo(-12.00, 17.00);
        ctx.lineTo(-11.00, 16.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, 4.00);
        ctx.lineTo(-8.00, 5.00);
        ctx.lineTo(-8.00, 13.00);
        ctx.lineTo(-9.00, 14.00);
        ctx.lineTo(-11.00, 14.00);
        ctx.lineTo(-12.00, 13.00);
        ctx.lineTo(-12.00, 5.00);
        ctx.lineTo(-11.00, 4.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, -9.00);
        ctx.lineTo(-8.00, -8.00);
        ctx.lineTo(-8.00, 0.00);
        ctx.lineTo(-9.00, 1.00);
        ctx.lineTo(-11.00, 1.00);
        ctx.lineTo(-12.00, 0.00);
        ctx.lineTo(-12.00, -8.00);
        ctx.lineTo(-11.00, -9.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, -21.00);
        ctx.lineTo(-8.00, -20.00);
        ctx.lineTo(-8.00, -12.00);
        ctx.lineTo(-9.00, -11.00);
        ctx.lineTo(-11.00, -11.00);
        ctx.lineTo(-12.00, -12.00);
        ctx.lineTo(-12.00, -20.00);
        ctx.lineTo(-11.00, -21.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, -34.00);
        ctx.lineTo(-8.00, -33.00);
        ctx.lineTo(-8.00, -25.00);
        ctx.lineTo(-9.00, -24.00);
        ctx.lineTo(-11.00, -24.00);
        ctx.lineTo(-12.00, -25.00);
        ctx.lineTo(-12.00, -33.00);
        ctx.lineTo(-11.00, -34.00);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-9.00, -46.00);
        ctx.lineTo(-8.00, -45.00);
        ctx.lineTo(-8.00, -37.00);
        ctx.lineTo(-9.00, -36.00);
        ctx.lineTo(-11.00, -36.00);
        ctx.lineTo(-12.00, -37.00);
        ctx.lineTo(-12.00, -45.00);
        ctx.lineTo(-11.00, -46.00);
        ctx.closePath();
        ctx.stroke();
    }
}

export class Arrow extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.5;
        this.thrust = 300;
        this.maxVelocity = 600;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 2040.0 (from 510.0 to 2550.0), height = 2940.0 (from 735.0 to 3675.0)
        this.boundingBox.set(34.00, 49.00);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 20.50, radius: 2.00 },
                { x: 5.00, y: 20.50, radius: 2.00 },
                { x: -5.00, y: 20.50, radius: 2.00 },
            ],
            turrets: [
            ],
            fixedWeapons: [
                { x: 0.00, y: -22.50, radius: 2.00 },
            ],
            lights: [
                { x: 15.00, y: 22.50, radius: 1.00 },
                { x: -15.00, y: 22.50, radius: 1.00 },
                { x: 5.00, y: -0.50, radius: 1.00 },
                { x: -5.00, y: -0.50, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-1.00, -11.50);
        ctx.lineTo(1.00, -11.50);
        ctx.lineTo(2.00, -7.50);
        ctx.lineTo(-2.00, -7.50);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(3.00, 9.50);
        ctx.lineTo(4.00, 8.50);
        ctx.lineTo(6.00, 8.50);
        ctx.lineTo(7.00, 9.50);
        ctx.lineTo(7.00, 20.50);
        ctx.lineTo(3.00, 20.50);
        ctx.closePath();
        ctx.moveTo(-2.00, 9.50);
        ctx.lineTo(-1.00, 8.50);
        ctx.lineTo(1.00, 8.50);
        ctx.lineTo(2.00, 9.50);
        ctx.lineTo(2.00, 20.50);
        ctx.lineTo(-2.00, 20.50);
        ctx.closePath();
        ctx.moveTo(-4.00, 8.50);
        ctx.lineTo(-3.00, 9.50);
        ctx.lineTo(-3.00, 20.50);
        ctx.lineTo(-7.00, 20.50);
        ctx.lineTo(-7.00, 9.50);
        ctx.lineTo(-6.00, 8.50);
        ctx.closePath();
        ctx.moveTo(0.00, -22.50);
        ctx.lineTo(1.00, -21.50);
        ctx.lineTo(2.00, -19.50);
        ctx.lineTo(3.00, 8.50);
        ctx.lineTo(3.00, 19.50);
        ctx.lineTo(2.00, 19.50);
        ctx.lineTo(2.00, 9.50);
        ctx.lineTo(1.00, 8.50);
        ctx.lineTo(-1.00, 8.50);
        ctx.lineTo(-2.00, 9.50);
        ctx.lineTo(-2.00, 19.50);
        ctx.lineTo(-3.00, 19.50);
        ctx.lineTo(-3.00, 9.50);
        ctx.lineTo(-2.00, -19.50);
        ctx.lineTo(-1.00, -21.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(2.00, -3.50);
        ctx.lineTo(5.00, -1.50);
        ctx.lineTo(5.00, -0.50);
        ctx.lineTo(2.00, -1.50);
        ctx.closePath();
        ctx.moveTo(-2.00, -3.50);
        ctx.lineTo(-2.00, -1.50);
        ctx.lineTo(-5.00, -0.50);
        ctx.lineTo(-5.00, -1.50);
        ctx.closePath();
        ctx.moveTo(7.00, 14.50);
        ctx.lineTo(15.00, 19.50);
        ctx.lineTo(15.00, 22.50);
        ctx.lineTo(7.00, 19.50);
        ctx.closePath();
        ctx.moveTo(-7.00, 14.50);
        ctx.lineTo(-7.00, 19.50);
        ctx.lineTo(-15.00, 22.50);
        ctx.lineTo(-15.00, 19.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

export class Boxwing extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 0.25;
        this.thrust = 25;
        this.maxVelocity = 100;
        this.setupTrail();
    }

    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 1080.0 (from 270.0 to 1350.0), height = 1170.0 (from 292.5 to 1462.5)
        this.boundingBox.set(18.00, 19.50);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 8.00, y: -1.75, radius: 0.75 },
                { x: 6.00, y: 9.25, radius: 0.50 },
                { x: -6.00, y: 9.25, radius: 0.50 },
                { x: -8.00, y: -1.75, radius: 0.75 },
            ],
            turrets: [
            ],
            fixedWeapons: [
                { x: 0.00, y: -7.75, radius: 2.00 },
            ],
            lights: [
                { x: 8.00, y: -5.75, radius: 1.00 },
                { x: -8.00, y: -5.75, radius: 1.00 },
                { x: -6.00, y: 5.25, radius: 1.00 },
                { x: 6.00, y: 5.25, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-3.00, -5.75);
        ctx.lineTo(-2.00, -4.75);
        ctx.lineTo(-2.00, -3.75);
        ctx.lineTo(-3.00, -3.75);
        ctx.closePath();
        ctx.moveTo(-3.00, -6.75);
        ctx.lineTo(3.00, -6.75);
        ctx.lineTo(2.00, -5.75);
        ctx.lineTo(-2.00, -5.75);
        ctx.closePath();
        ctx.moveTo(3.00, -5.75);
        ctx.lineTo(3.00, -3.75);
        ctx.lineTo(2.00, -3.75);
        ctx.lineTo(2.00, -4.75);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-3.00, -7.75);
        ctx.lineTo(3.00, -7.75);
        ctx.lineTo(4.00, -6.75);
        ctx.lineTo(4.00, 8.25);
        ctx.lineTo(-4.00, 8.25);
        ctx.lineTo(-4.00, -6.75);
        ctx.closePath();
        ctx.moveTo(-3.00, 8.25);
        ctx.lineTo(3.00, 8.25);
        ctx.lineTo(2.00, 9.25);
        ctx.lineTo(-2.00, 9.25);
        ctx.closePath();
        ctx.moveTo(-8.00, -5.75);
        ctx.lineTo(-7.00, -4.75);
        ctx.lineTo(-7.00, -1.75);
        ctx.lineTo(-9.00, -1.75);
        ctx.lineTo(-9.00, -4.75);
        ctx.closePath();
        ctx.moveTo(8.00, -5.75);
        ctx.lineTo(9.00, -4.75);
        ctx.lineTo(9.00, -1.75);
        ctx.lineTo(7.00, -1.75);
        ctx.lineTo(7.00, -4.75);
        ctx.closePath();
        ctx.moveTo(6.00, 5.25);
        ctx.lineTo(7.00, 6.25);
        ctx.lineTo(7.00, 9.25);
        ctx.lineTo(5.00, 9.25);
        ctx.lineTo(5.00, 6.25);
        ctx.closePath();
        ctx.moveTo(-6.00, 5.25);
        ctx.lineTo(-5.00, 6.25);
        ctx.lineTo(-5.00, 9.25);
        ctx.lineTo(-7.00, 9.25);
        ctx.lineTo(-7.00, 6.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(4.00, -2.75);
        ctx.lineTo(7.00, -4.75);
        ctx.lineTo(7.00, -2.75);
        ctx.lineTo(4.00, -0.75);
        ctx.closePath();
        ctx.moveTo(4.00, 5.25);
        ctx.lineTo(5.00, 6.25);
        ctx.lineTo(5.00, 8.25);
        ctx.lineTo(4.00, 7.25);
        ctx.closePath();
        ctx.moveTo(-4.00, 5.25);
        ctx.lineTo(-4.00, 7.25);
        ctx.lineTo(-5.00, 8.25);
        ctx.lineTo(-5.00, 6.25);
        ctx.closePath();
        ctx.moveTo(-7.00, -4.75);
        ctx.lineTo(-4.00, -2.75);
        ctx.lineTo(-4.00, -0.75);
        ctx.lineTo(-7.00, -2.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.beginPath();
        ctx.moveTo(-1.00, -2.75);
        ctx.lineTo(1.00, -2.75);
        ctx.lineTo(2.00, -1.75);
        ctx.lineTo(2.00, 6.25);
        ctx.lineTo(1.00, 7.25);
        ctx.lineTo(-1.00, 7.25);
        ctx.lineTo(-2.00, 6.25);
        ctx.lineTo(-2.00, -1.75);
        ctx.closePath();
        ctx.stroke();

    }
}

export class Interceptor extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 2;
        this.thrust = 1000;
        this.maxVelocity = 1000;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 1920.0 (from 480.0 to 2400.0), height = 3300.0 (from 825.0 to 4125.0)
        this.boundingBox.set(32.00, 55.00);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: 0.00, y: 23.50, radius: 3.00 },
                { x: 7.00, y: 20.50, radius: 1.00 },
                { x: -7.00, y: 20.50, radius: 1.00 },
            ],
            turrets: [
            ],
            fixedWeapons: [
                { x: -5.00, y: -14.50, radius: 2.00 },
                { x: 5.00, y: -14.50, radius: 2.00 },
            ],
            lights: [
                { x: 14.00, y: 14.50, radius: 1.00 },
                { x: -14.00, y: 14.50, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-1.00, 16.50);
        ctx.lineTo(1.00, 16.50);
        ctx.lineTo(2.00, 19.50);
        ctx.lineTo(2.00, 20.50);
        ctx.lineTo(1.00, 21.50);
        ctx.lineTo(-1.00, 21.50);
        ctx.lineTo(-2.00, 20.50);
        ctx.lineTo(-2.00, 19.50);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(0.00, -27.50);
        ctx.lineTo(2.00, -24.50);
        ctx.lineTo(3.00, 7.50);
        ctx.lineTo(5.00, 11.50);
        ctx.lineTo(5.00, 19.50);
        ctx.lineTo(3.00, 23.50);
        ctx.lineTo(1.00, 24.50);
        ctx.lineTo(0.00, 27.50);
        ctx.lineTo(-1.00, 24.50);
        ctx.lineTo(-3.00, 23.50);
        ctx.lineTo(-5.00, 19.50);
        ctx.lineTo(-5.00, 11.50);
        ctx.lineTo(-3.00, 7.50);
        ctx.lineTo(-2.00, -24.50);
        ctx.closePath();
        ctx.moveTo(5.00, 19.50);
        ctx.lineTo(9.00, 19.50);
        ctx.lineTo(8.00, 20.50);
        ctx.lineTo(6.00, 20.50);
        ctx.closePath();
        ctx.moveTo(-9.00, 19.50);
        ctx.lineTo(-5.00, 19.50);
        ctx.lineTo(-6.00, 20.50);
        ctx.lineTo(-8.00, 20.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(2.00, -24.50);
        ctx.lineTo(14.00, 14.50);
        ctx.lineTo(12.00, 19.50);
        ctx.lineTo(5.00, 19.50);
        ctx.lineTo(5.00, 11.50);
        ctx.lineTo(3.00, 7.50);
        ctx.closePath();
        ctx.moveTo(-2.00, -24.50);
        ctx.lineTo(-3.00, 7.50);
        ctx.lineTo(-5.00, 11.50);
        ctx.lineTo(-5.00, 19.50);
        ctx.lineTo(-12.00, 19.50);
        ctx.lineTo(-14.00, 14.50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.beginPath();
        ctx.moveTo(0.00, -24.50);
        ctx.lineTo(1.00, 7.50);
        ctx.lineTo(3.00, 11.50);
        ctx.lineTo(3.00, 18.50);
        ctx.lineTo(1.00, 13.50);
        ctx.lineTo(-1.00, 13.50);
        ctx.lineTo(-3.00, 18.50);
        ctx.lineTo(-3.00, 11.50);
        ctx.lineTo(-1.00, 7.50);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4.00, -12.50);
        ctx.lineTo(9.00, 11.50);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4.00, -12.50);
        ctx.lineTo(-9.00, 11.50);
        ctx.stroke();

    }
}

export class Fighter extends Ship {
    constructor(x, y, starSystem) {
        super(x, y, starSystem);
        this.rotationSpeed = Math.PI * 2.5;
        this.thrust = 800;
        this.maxVelocity = 700;
        this.setupTrail();
    }
    /**
     * Sets up the bounding box
     */
    setupBoundingBox() {
        // Bounding box: width = 1170.0 (from 292.5 to 1462.5), height = 1755.0 (from 438.8 to 2193.8)
        this.boundingBox.set(19.50, 29.25);
        this.radius = this.boundingBox.magnitude() * 0.5;
    }

    /**
     * Sets up the engine, turret, fixed weapon, and light positions
     */
    setupFeaturePoints() {
        this.featurePoints = {
            engines: [
                { x: -4.00, y: 13.38, radius: 1.25 },
                { x: 4.00, y: 13.38, radius: 1.25 },
            ],
            turrets: [
            ],
            fixedWeapons: [
                { x: 2.00, y: -12.63, radius: 2.00 },
                { x: -2.00, y: -12.63, radius: 2.00 },
            ],
            lights: [
                { x: -8.75, y: 8.38, radius: 1.00 },
                { x: -4.00, y: -6.63, radius: 1.00 },
                { x: 4.00, y: -6.63, radius: 1.00 },
                { x: 8.75, y: 8.38, radius: 1.00 },
            ]
        };
    }

    /**
     * Configures the path for the windows in the ctx, to be used in drawWindows
     * @param {CanvasRenderingContext2D} ctx - The 2D rendering context.
     * @param {Camera} camera - The camera object.
     */
    getWindowPath(ctx, camera) {
        // Draw the cockpit
        ctx.beginPath();
        ctx.moveTo(-0.50, -0.63);
        ctx.lineTo(0.50, -0.63);
        ctx.lineTo(1.50, 2.38);
        ctx.lineTo(1.50, 3.38);
        ctx.lineTo(0.50, 4.38);
        ctx.lineTo(-0.50, 4.38);
        ctx.lineTo(-1.50, 3.38);
        ctx.lineTo(-1.50, 2.38);
        ctx.closePath();
    }

    /**
     * Draws the ship's hull, wings, and detail lines
     */
    drawShip(ctx, camera) {
        // Set default stroke style and line width
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 0.1;

        // Draw the hull
        ctx.fillStyle = this.colors.hull.toRGB();
        ctx.beginPath();
        ctx.moveTo(-0.50, -12.63);
        ctx.lineTo(0.50, -12.63);
        ctx.lineTo(1.50, -10.63);
        ctx.lineTo(3.25, 1.38);
        ctx.lineTo(4.25, 3.38);
        ctx.lineTo(2.75, 3.38);
        ctx.lineTo(2.50, 4.38);
        ctx.lineTo(1.50, 5.38);
        ctx.lineTo(2.00, 6.13);
        ctx.lineTo(1.50, 11.38);
        ctx.lineTo(1.25, 14.38);
        ctx.lineTo(-1.25, 14.38);
        ctx.lineTo(-1.50, 11.38);
        ctx.lineTo(-2.00, 6.13);
        ctx.lineTo(-1.50, 5.38);
        ctx.lineTo(-2.50, 4.38);
        ctx.lineTo(-2.75, 3.38);
        ctx.lineTo(-4.25, 3.38);
        ctx.lineTo(-3.25, 1.38);
        ctx.lineTo(-1.50, -10.63);
        ctx.closePath();
        ctx.moveTo(-5.25, 3.38);
        ctx.lineTo(-2.75, 3.38);
        ctx.lineTo(-2.50, 4.38);
        ctx.lineTo(-1.50, 5.38);
        ctx.lineTo(-2.00, 6.13);
        ctx.lineTo(-1.50, 11.38);
        ctx.lineTo(-2.50, 12.38);
        ctx.lineTo(-2.75, 13.38);
        ctx.lineTo(-5.25, 13.38);
        ctx.lineTo(-5.50, 12.38);
        ctx.lineTo(-6.50, 11.38);
        ctx.lineTo(-6.50, 5.38);
        ctx.lineTo(-5.50, 4.38);
        ctx.closePath();
        ctx.moveTo(1.50, -10.63);
        ctx.lineTo(1.50, -11.63);
        ctx.lineTo(2.50, -11.63);
        ctx.lineTo(2.50, -8.63);
        ctx.lineTo(1.75, -7.88);
        ctx.closePath();
        ctx.moveTo(-2.50, -11.63);
        ctx.lineTo(-1.50, -11.63);
        ctx.lineTo(-1.50, -10.63);
        ctx.lineTo(-1.75, -7.88);
        ctx.lineTo(-2.50, -8.63);
        ctx.closePath();
        ctx.moveTo(-2.25, -11.63);
        ctx.lineTo(-2.25, -12.63);
        ctx.lineTo(-1.75, -12.63);
        ctx.lineTo(-1.75, -11.63);
        ctx.closePath();
        ctx.moveTo(1.75, -11.63);
        ctx.lineTo(1.75, -12.63);
        ctx.lineTo(2.25, -12.63);
        ctx.lineTo(2.25, -11.63);
        ctx.closePath();
        ctx.moveTo(5.25, 3.38);
        ctx.lineTo(2.75, 3.38);
        ctx.lineTo(2.50, 4.38);
        ctx.lineTo(1.50, 5.38);
        ctx.lineTo(2.00, 6.13);
        ctx.lineTo(1.50, 11.38);
        ctx.lineTo(2.50, 12.38);
        ctx.lineTo(2.75, 13.38);
        ctx.lineTo(5.25, 13.38);
        ctx.lineTo(5.50, 12.38);
        ctx.lineTo(6.50, 11.38);
        ctx.lineTo(6.50, 5.38);
        ctx.lineTo(5.50, 4.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw the wings and fins
        ctx.fillStyle = this.colors.wings.toRGB();
        ctx.beginPath();
        ctx.moveTo(3.00, -12.88);
        ctx.lineTo(3.75, -10.88);
        ctx.lineTo(4.00, -9.88);
        ctx.lineTo(4.25, -4.63);
        ctx.lineTo(4.00, -3.63);
        ctx.lineTo(3.50, -1.63);
        ctx.lineTo(3.50, -3.63);
        ctx.lineTo(3.00, -5.63);
        ctx.lineTo(2.00, -6.13);
        ctx.lineTo(1.75, -7.38);
        ctx.lineTo(2.75, -8.38);
        ctx.lineTo(3.25, -10.88);
        ctx.closePath();
        ctx.moveTo(-3.00, -12.88);
        ctx.lineTo(-3.75, -10.88);
        ctx.lineTo(-4.00, -9.88);
        ctx.lineTo(-4.25, -4.63);
        ctx.lineTo(-4.00, -3.63);
        ctx.lineTo(-3.50, -1.63);
        ctx.lineTo(-3.50, -3.63);
        ctx.lineTo(-3.00, -5.63);
        ctx.lineTo(-2.00, -6.13);
        ctx.lineTo(-1.75, -7.38);
        ctx.lineTo(-2.75, -8.38);
        ctx.lineTo(-3.25, -10.88);
        ctx.closePath();
        ctx.moveTo(-7.50, 4.38);
        ctx.lineTo(-8.50, 6.38);
        ctx.lineTo(-8.75, 7.38);
        ctx.lineTo(-8.75, 9.63);
        ctx.lineTo(-8.50, 10.38);
        ctx.lineTo(-7.50, 12.38);
        ctx.lineTo(-7.50, 11.38);
        ctx.lineTo(-5.50, 9.38);
        ctx.lineTo(-5.50, 7.38);
        ctx.lineTo(-7.50, 5.38);
        ctx.closePath();
        ctx.moveTo(7.50, 4.38);
        ctx.lineTo(8.50, 6.38);
        ctx.lineTo(8.75, 7.38);
        ctx.lineTo(8.75, 9.63);
        ctx.lineTo(8.50, 10.38);
        ctx.lineTo(7.50, 12.38);
        ctx.lineTo(7.50, 11.38);
        ctx.lineTo(5.50, 9.38);
        ctx.lineTo(5.50, 7.38);
        ctx.lineTo(7.50, 5.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw detail lines
        ctx.beginPath();
        ctx.moveTo(-0.50, -9.63);
        ctx.lineTo(0.50, -9.63);
        ctx.lineTo(1.50, -1.63);
        ctx.lineTo(-1.50, -1.63);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(5.50, 10.38);
        ctx.lineTo(4.50, 11.38);
        ctx.lineTo(3.50, 11.38);
        ctx.lineTo(2.50, 10.38);
        ctx.lineTo(2.50, 6.38);
        ctx.lineTo(3.50, 5.38);
        ctx.lineTo(4.50, 5.38);
        ctx.lineTo(5.50, 6.38);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-2.50, 10.38);
        ctx.lineTo(-3.50, 11.38);
        ctx.lineTo(-4.50, 11.38);
        ctx.lineTo(-5.50, 10.38);
        ctx.lineTo(-5.50, 6.38);
        ctx.lineTo(-4.50, 5.38);
        ctx.lineTo(-3.50, 5.38);
        ctx.lineTo(-2.50, 6.38);
        ctx.closePath();
        ctx.stroke();

    }
}

// Factory function to create a random ship type
export function createRandomShip(x, y, starSystem) {
    const shipClasses = [Flivver, Shuttle, HeavyShuttle, StarBarge, Freighter, Arrow, Boxwing, Interceptor, Fighter];
    const RandomShipClass = shipClasses[Math.floor(Math.random() * shipClasses.length)];
    return new RandomShipClass(x, y, starSystem);
}