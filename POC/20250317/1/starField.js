// starField.js

import { Vector2D } from './vector2d.js';
import { remapRange01, randomBetween } from './utils.js';

/**
 * Represents a single star in the star field.
 */
export class Star {
    /**
     * Creates a new Star instance.
     * @param {number} size - The size of the star.
     * @param {number} depth - The depth of the star, affecting its movement with the camera.
     * @param {number} x - The initial x-coordinate of the star.
     * @param {number} y - The initial y-coordinate of the star.
     */
    constructor(size, depth, x, y) {
        this.size = size;
        this.depth = depth;
        this.position = new Vector2D(x, y);
    }
}

/**
 * Represents a field of stars that move relative to the camera, creating a parallax effect.
 */
export class StarField {
    /**
     * Creates a new StarField instance.
     * @param {Camera} camera - The camera object, providing screen size and position.
     * @param {number} starCount - The number of stars to generate in the field.
     */
    constructor(camera, starCount) {
        this.starCount = starCount;
        // Set the star field size to twice the camera's screen dimensions
        this.size = new Vector2D(camera.screenSize.width * 2, camera.screenSize.height * 2);
        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
            // Generate a magnitude value, heavily biased towards smaller numbers
            const magnitude = Math.pow(Math.random(), 20);
            // Map magnitude to a star size between 1 and 3
            const size = remapRange01(magnitude, 1, 3);
            // Map magnitude to a depth value between 0.01 and 0.9
            const depth = remapRange01(magnitude, 0.01, 0.9);
            // Randomly position the star within the star field area, offset from center
            const cameraX = this.size.width * (Math.random() - 0.5);
            const cameraY = this.size.height * (Math.random() - 0.5);
            // Create a star with initial position (0, 0), to be set later
            const star = new Star(size, depth, 0, 0);
            // Position the star in world space based on camera space coordinates
            this.setStarPositionCameraSpace(camera, star, cameraX, cameraY);
            this.stars.push(star);
        }
    }

    /**
     * Calculates the star's position in camera space based on its world position and depth.
     * @param {Camera} camera - The camera object with position data.
     * @param {Star} star - The star whose position is being calculated.
     * @returns {Vector2D} The star's position in camera space.
     */
    getStarPositionCameraSpace(camera, star) {
        const dx = (star.position.x - camera.position.x) * star.depth;
        const dy = (star.position.y - camera.position.y) * star.depth;
        return new Vector2D(dx, dy);
    }

    /**
     * Sets the star's world position based on its camera space coordinates.
     * @param {Camera} camera - The camera object with position data.
     * @param {Star} star - The star to position.
     * @param {number} cameraX - The x-coordinate in camera space.
     * @param {number} cameraY - The y-coordinate in camera space.
     */
    setStarPositionCameraSpace(camera, star, cameraX, cameraY) {
        const worldX = cameraX / star.depth + camera.position.x;
        const worldY = cameraY / star.depth + camera.position.y;
        star.position.x = worldX;
        star.position.y = worldY;
    }

    /**
     * Updates the star field size based on new screen dimensions.
     * @param {number} width - The new screen width.
     * @param {number} height - The new screen height.
     */
    resize(width, height) {
        this.size.width = width * 2;
        this.size.height = height * 2;
    }

    /**
     * Repositions a star outside the visible area based on camera velocity.
     * @param {Star} star - The star to reposition.
     * @param {Camera} camera - The camera object with screen size and position.
     * @param {Vector2D} velocity - The camera's velocity.
     * @returns {Vector2D} The new camera space position of the star.
     */
    repositionStar(star, camera, velocity) {
        const absVelocityX = Math.abs(velocity.x);
        const absVelocityY = Math.abs(velocity.y);
        let spawnDirection = 0;
        // Determine spawn direction based on camera velocity
        if (absVelocityX < 0.01 && absVelocityY < 0.01) {
            spawnDirection = Math.round(randomBetween(1, 4)); // Random direction if stationary
        } else if (absVelocityY < 0.01 || (absVelocityX / absVelocityY) > 2.5) {
            spawnDirection = velocity.x > 0 ? 2 : 4; // Right or left if mostly horizontal
        } else if (absVelocityX < 0.01 || (absVelocityY / absVelocityX) > 2.5) {
            spawnDirection = velocity.y > 0 ? 3 : 1; // Bottom or top if mostly vertical
        } else {
            // Mixed velocity: randomly choose between horizontal or vertical
            if (Math.random() > 0.5) {
                spawnDirection = velocity.x > 0 ? 2 : 4;
            } else {
                spawnDirection = velocity.y > 0 ? 3 : 1;
            }
        }

        // Define visible and maximum boundaries
        const visibleLeft = -camera.screenSize.width / 2;
        const visibleRight = camera.screenSize.width / 2;
        const visibleTop = -camera.screenSize.height / 2;
        const visibleBottom = camera.screenSize.height / 2;

        const maxLeft = -this.size.width / 2;
        const maxRight = this.size.width / 2;
        const maxTop = -this.size.height / 2;
        const maxBottom = this.size.height / 2;

        let newX = 0;
        let newY = 0;

        // Ensure the star spawns outside the visible area, with a loop limit to prevent infinite loops
        let loopLimit = 10;
        do {
            switch (spawnDirection) {
                case 1: // Top
                    newX = randomBetween(maxLeft, maxRight);
                    newY = randomBetween(maxTop, visibleTop);
                    break;
                case 2: // Right
                    newX = randomBetween(visibleRight, maxRight);
                    newY = randomBetween(maxTop, maxBottom);
                    break;
                case 3: // Bottom
                    newX = randomBetween(maxLeft, maxRight);
                    newY = randomBetween(visibleBottom, maxBottom);
                    break;
                case 4: // Left
                    newX = randomBetween(maxLeft, visibleLeft);
                    newY = randomBetween(maxTop, maxBottom);
                    break;
                default: // Fallback random position
                    newX = randomBetween(maxLeft, maxRight);
                    newY = randomBetween(maxTop, maxBottom);
            }
            loopLimit--;
        } while (newX < visibleRight && newX > visibleLeft && newY < visibleBottom && newY > visibleTop && loopLimit > 0);

        // Set the star's new position in world space
        this.setStarPositionCameraSpace(camera, star, newX, newY);
        return new Vector2D(newX, newY);
    }

    /**
     * Renders the star field on the canvas, repositioning stars that move out of bounds.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object with position and screen conversion methods.
     * @param {Vector2D} velocity - The camera's velocity.
     */
    draw(ctx, camera, velocity) {
        ctx.save();
        ctx.fillStyle = 'white';
        const halfSize = this.size.divide(2);

        this.stars.forEach(star => {
            let cameraPos = this.getStarPositionCameraSpace(camera, star);
            // Reposition star if it moves beyond the star field boundaries
            if (Math.abs(cameraPos.x) > halfSize.width || Math.abs(cameraPos.y) > halfSize.height) {
                cameraPos = this.repositionStar(star, camera, velocity);
            }
            // Convert camera space to screen coordinates
            const screenPos = camera.cameraToScreen(cameraPos);
            // Draw the star if it's within the screen bounds
            if (screenPos.x >= 0 && screenPos.x < camera.screenSize.width && screenPos.y >= 0 && screenPos.y < camera.screenSize.height) {
                ctx.fillRect(screenPos.x, screenPos.y, star.size, star.size);
            }
        });
        ctx.restore();
    }
}