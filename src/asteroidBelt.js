// asteroidBelt.js

import { Vector2D } from './vector2d.js';
import { remapRange01 } from './utils.js';
import { GameObject } from './gameObject.js';

/**
 * Manages a collection of asteroids forming a belt in a star system.
 */
export class AsteroidBelt {
    /**
     * Creates a new AsteroidBelt instance.
     * @param {StarSystem} starSystem - The star system containing this belt.
     * @param {number} innerRadius - Inner radius of the asteroid belt in world units.
     * @param {number} outerRadius - Outer radius of the asteroid belt in world units.
     * @param {number} backgroundCount - Number of background (non-interactive) asteroids.
     * @param {number} interactiveCount - Number of interactive asteroids.
     */
    constructor(starSystem, innerRadius, outerRadius, backgroundCount, interactiveCount) {
        this.starSystem = starSystem;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.backgroundCount = backgroundCount;
        this.interactiveCount = interactiveCount;
        this.backgroundAsteroids = [];
        this.interactiveAsteroids = [];
    }

    /**
     * Initializes the belt by creating background and interactive asteroids.
     */
    initialize() {
        // Generate background asteroids
        for (let i = 0; i < this.backgroundCount; i++) {
            const radius = remapRange01(Math.random(), this.innerRadius, this.outerRadius);
            const angle = remapRange01(Math.random(), 0, Math.PI * 2);
            const size = remapRange01(Math.random(), 2, 20);
            const spinSpeed = remapRange01(Math.random(), Math.PI * -2.0, Math.PI * 2.0);
            const orbitSpeed = remapRange01(Math.random(), Math.PI * 0.001, Math.PI * 0.006);
            this.backgroundAsteroids.push({
                radius: radius,
                angle: angle,
                size: size,
                spin: 0,
                spinSpeed: spinSpeed,
                orbitSpeed: orbitSpeed,
                shape: this.generateShape(5 + Math.floor(Math.random() * 4))
            });
        }
        // Generate interactive asteroids
        for (let i = 0; i < this.interactiveCount; i++) {
            this.interactiveAsteroids.push(new Asteroid(this));
        }
    }

    /**
     * Generates a random polygonal shape for an asteroid.
     * @param {number} sides - Number of sides for the shape.
     * @returns {Array<{x: number, y: number}>} Array of points defining the shape in local coordinates.
     */
    generateShape(sides) {
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const r = 0.5 + Math.random() * 0.5;
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
        return points;
    }

    /**
     * Updates the positions and spins of all asteroids in the belt.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        this.backgroundAsteroids.forEach(asteroid => {
            asteroid.angle += asteroid.orbitSpeed * deltaTime;
            asteroid.spin += asteroid.spinSpeed * deltaTime;
            asteroid.angle %= Math.PI * 2;
            asteroid.spin %= Math.PI * 2;
        });
        this.interactiveAsteroids.forEach(asteroid => asteroid.update(deltaTime));
    }

    /**
     * Draws all asteroids in the belt on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     */
    draw(ctx, camera) {
        ctx.save();
        ctx.fillStyle = 'rgb(100, 100, 100)';
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 1;
        const worldPos = new Vector2D(0, 0);
        this.backgroundAsteroids.forEach(asteroid => {
            // Use set to avoid new Vector2D allocation
            worldPos.set(Math.cos(asteroid.angle) * asteroid.radius, Math.sin(asteroid.angle) * asteroid.radius);
            if (camera.isInView(worldPos, asteroid.size)) {
                const screenPos = camera.worldToScreen(worldPos);
                const scaledSize = camera.worldToSize(asteroid.size);
                ctx.save();
                ctx.translate(screenPos.x, screenPos.y);
                ctx.rotate(asteroid.spin);
                ctx.beginPath();
                ctx.moveTo(asteroid.shape[0].x * scaledSize, asteroid.shape[0].y * scaledSize);
                for (let i = 1; i < asteroid.shape.length; i++) {
                    ctx.lineTo(asteroid.shape[i].x * scaledSize, asteroid.shape[i].y * scaledSize);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
                ctx.restore();
            }
        });

        this.interactiveAsteroids.forEach(asteroid => asteroid.draw(ctx, camera));
        ctx.restore();
    }
}

/**
 * Represents an individual interactive asteroid within a belt.
 * @extends GameObject
 */
export class Asteroid extends GameObject {
    /**
     * Creates a new Asteroid instance.
     * @param {AsteroidBelt} belt - The asteroid belt this asteroid belongs to.
     */
    constructor(belt) {
        const radius = remapRange01(Math.random(), belt.innerRadius, belt.outerRadius);
        const angle = remapRange01(Math.random(), 0, Math.PI * 2);
        super(new Vector2D(0, 0), belt.starSystem); // Initial position set below
        this.belt = belt;
        this.size = remapRange01(Math.random(), 15, 30);
        this.spin = 0;
        this.spinSpeed = remapRange01(Math.random(), Math.PI * -2.0, Math.PI * 2.0);
        this.orbitSpeed = remapRange01(Math.random(), Math.PI * 0.002, Math.PI * 0.006);
        this.orbitRadius = radius;
        this.orbitAngle = angle;
        this.shape = this.generateShape(6 + Math.floor(Math.random() * 4));
        // Set initial position using in-place method
        this.position.set(Math.cos(this.orbitAngle) * this.orbitRadius, Math.sin(this.orbitAngle) * this.orbitRadius);
    }

    /**
     * Generates a random polygonal shape for the asteroid.
     * @param {number} sides - Number of sides for the shape.
     * @returns {Array<{x: number, y: number}>} Array of points defining the shape in local coordinates.
     */
    generateShape(sides) {
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const r = 0.6 + Math.random() * 0.4;
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
        return points;
    }

    /**
     * Updates the asteroid's position and spin based on its orbit.
     * @param {number} deltaTime - Time elapsed since the last update in seconds.
     */
    update(deltaTime) {
        this.orbitAngle += this.orbitSpeed * deltaTime;
        this.spin += this.spinSpeed * deltaTime;
        // Update position using set to avoid allocation
        this.position.set(
            Math.cos(this.orbitAngle) * this.orbitRadius,
            Math.sin(this.orbitAngle) * this.orbitRadius
        );
        this.orbitAngle %= Math.PI * 2;
        this.spin %= Math.PI * 2;
    }

    /**
     * Draws the asteroid on the canvas if in view.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object for coordinate transformations.
     */
    draw(ctx, camera) {
        const screenPos = camera.worldToScreen(this.position);
        const scaledSize = camera.worldToSize(this.size);

        if (camera.isInView(this.position, this.size)) {
            ctx.save();
            ctx.translate(screenPos.x, screenPos.y);
            ctx.rotate(this.spin);
            ctx.fillStyle = 'rgb(100, 100, 100)';
            ctx.strokeStyle = 'rgb(50, 50, 50)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.shape[0].x * scaledSize, this.shape[0].y * scaledSize);
            for (let i = 1; i < this.shape.length; i++) {
                ctx.lineTo(this.shape[i].x * scaledSize, this.shape[i].y * scaledSize);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            ctx.restore();
        }
    }
}