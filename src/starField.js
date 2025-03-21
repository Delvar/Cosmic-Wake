// starField.js
import { remapRange01, remapClamp } from './utils.js';
import { Vector2D } from './vector2d.js';

/**
 * Generates a hash value from grid coordinates and layer index for consistent RNG seeding.
 * @param {number} i - The x-index of the grid cell.
 * @param {number} j - The y-index of the grid cell.
 * @param {number} layer - The layer index (0 to 7).
 * @returns {number} A unique hash value.
 */
function hash(i, j, layer) {
    return i * 73856093 + j * 19349663 + layer * 83492791;
}

/**
 * A simple seeded random number generator for consistent star properties across frames.
 */
class SimpleRNG {
    /**
     * Initializes the RNG with a seed value.
     * @param {number} seed - The seed value for randomization.
     */
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    /**
     * Generates the next random number between 0 and 1.
     * @returns {number} A random value between 0 and 1.
     */
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

/**
 * Represents a procedurally generated starfield with parallax effects across multiple layers.
 * Stars are rendered directly in screen space, with properties varying by layer distance.
 * Uses Vector2D for position calculations to optimize performance.
 * @class
 */
export class StarField {
    /**
     * Creates a new StarField instance.
     * @param {number} [starsPerCell=10] - Base number of stars per grid cell.
     * @param {number} [gridSize=100] - Size of each grid cell in world-space units (pixels).
     */
    constructor(starsPerCell = 10, gridSize = 100) {
        this.starsPerCell = starsPerCell; // Base number of stars per grid cell
        this.gridSize = gridSize;         // Cell size in world-space units (pixels)
        this.layers = 5;                  // Total number of parallax layers
        // Parallax factors for each layer, from farthest (0.1) to closest (0.9)
        this.parallaxFactors = [0.1, 0.3, 0.5, 0.7, 0.9];
        this.debug = false;               // Toggle to draw debug grid lines

        // Reusable Vector2D instances to reduce garbage collection
        this.cellWorldPos = new Vector2D();
        this.screenCellPos = new Vector2D();
        this.starScreenPos = new Vector2D();
        this.screenSize = new Vector2D(); // For camera.screenSize
    }

    /**
     * Renders the starfield to the canvas, applying parallax and zoom effects.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object defining the view, with position (Vector2D) and screenSize (object with width/height).
     */
    draw(ctx, camera) {
        ctx.save();
        const zoomThreshold = 1 - remapClamp(camera.zoom, 0.5, 1, 0.5, 1);

        // Set screenSize once per frame
        this.screenSize.set(camera.screenSize.width, camera.screenSize.height);

        // Iterate over each layer (0 = farthest, 4 = closest)
        for (let layer = 0; layer < this.layers; layer++) {
            const parallaxFactor = this.parallaxFactors[layer]; // Parallax factor for this layer

            // Optimization: Skip distant layers (0.1, 0.3) when zoomed out
            if (zoomThreshold > parallaxFactor) {
                continue;
            }

            const parallaxZoom = parallaxFactor * camera.zoom;  // Combined zoom and parallax effect
            const size = 1 + parallaxFactor * 2;                // Star size scales with proximity
            // layerRatio: 0 (farthest) to 1 (closest)
            const layerRatio = layer / (this.layers - 1);
            // distanceRatio: 1 (farthest) to 0 (closest), used for star count and color
            const distanceRatio = 1 - layerRatio;
            // Fewer stars in closer layers, more in farther ones
            const starCount = Math.round(1 + (this.starsPerCell * distanceRatio * distanceRatio));

            // Calculate world-space area visible to the camera for this layer
            const visibleWidth = camera.screenSize.width / parallaxZoom;
            const visibleHeight = camera.screenSize.height / parallaxZoom;
            const visibleLeft = camera.position.x - visibleWidth / 2;
            const visibleRight = camera.position.x + visibleWidth / 2;
            const visibleTop = camera.position.y - visibleHeight / 2;
            const visibleBottom = camera.position.y + visibleHeight / 2;

            // Determine grid cells overlapping the visible area
            const gridLeft = Math.floor(visibleLeft / this.gridSize);
            const gridRight = Math.ceil(visibleRight / this.gridSize);
            const gridTop = Math.floor(visibleTop / this.gridSize);
            const gridBottom = Math.ceil(visibleBottom / this.gridSize);

            // Cell size in screen space, constant within the layer
            const cellScreenWidth = this.gridSize * parallaxZoom;
            const cellScreenHeight = this.gridSize * parallaxZoom;

            // Iterate over visible grid cells
            for (let i = gridLeft; i < gridRight; i++) {
                for (let j = gridTop; j < gridBottom; j++) {
                    // Convert cell world-space position to screen space using Vector2D
                    this.cellWorldPos.set(i * this.gridSize, j * this.gridSize);
                    this.screenCellPos.set(this.cellWorldPos)
                        .subtractInPlace(camera.position)
                        .multiplyInPlace(parallaxZoom)
                        .addInPlace(this.screenSize.multiply(0.5));

                    // Optional debug visualization: draw grid lines
                    if (this.debug) {
                        ctx.strokeStyle = "green"; // Horizontal line
                        ctx.beginPath();
                        ctx.moveTo(this.screenCellPos.x, this.screenCellPos.y);
                        ctx.lineTo(this.screenCellPos.x + cellScreenWidth, this.screenCellPos.y);
                        ctx.stroke();

                        ctx.strokeStyle = "red"; // Vertical line
                        ctx.beginPath();
                        ctx.moveTo(this.screenCellPos.x, this.screenCellPos.y);
                        ctx.lineTo(this.screenCellPos.x, this.screenCellPos.y + cellScreenHeight);
                        ctx.stroke();
                    }

                    // Seed RNG with cell and layer info for consistent star placement
                    const seed = hash(i, j, layer);
                    const rng = new SimpleRNG(seed);

                    // Generate and draw stars for this cell
                    for (let k = 0; k < starCount; k++) {
                        // Generate star properties upfront for consistency
                        const relX = rng.next(); // Relative X position (0 to 1)
                        const relY = rng.next(); // Relative Y position (0 to 1)
                        const hue = Math.floor(rng.next() * 360); // Random hue (0-360)

                        // Saturation: Higher for distant stars (more colorful), lower for close stars (more white)
                        const minSaturation = remapRange01(distanceRatio, 0, 30); // 0 (near) to 30 (far)
                        const maxSaturation = remapRange01(distanceRatio, 10, 50); // 10 (near) to 50 (far)
                        const saturation = Math.floor(remapRange01(rng.next(), minSaturation, maxSaturation));

                        // Lightness: Brighter for close stars, dimmer for distant stars
                        const minLightness = remapRange01(distanceRatio, 80, 20); // 80 (near) to 20 (far)
                        const maxLightness = remapRange01(distanceRatio, 100, 60); // 100 (near) to 60 (far)
                        const lightness = Math.floor(remapRange01(rng.next(), minLightness, maxLightness));

                        // Define star color using HSL
                        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

                        // Calculate star position in screen space using Vector2D
                        this.starScreenPos.set(this.screenCellPos)
                            .addInPlace(new Vector2D(relX * cellScreenWidth, relY * cellScreenHeight));

                        // Draw only if the star is within screen bounds
                        if (this.starScreenPos.x >= 0 && this.starScreenPos.x < this.screenSize.x &&
                            this.starScreenPos.y >= 0 && this.starScreenPos.y < this.screenSize.y) {
                            ctx.fillStyle = color;
                            ctx.fillRect(this.starScreenPos.x, this.starScreenPos.y, size, size);
                        }
                    }
                }
            }
        }
        ctx.restore();
    }
}