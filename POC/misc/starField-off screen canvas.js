// starField.js


import { Camera } from '/src/camera/camera.js';
import { remapClamp, remapRange01 } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';

/**
 * Generates a hash value from grid coordinates and layer index for consistent RNG seeding.
 * @param {number} i - The x-index of the grid cell.
 * @param {number} j - The y-index of the grid cell.
 * @param {number} layer - The layer index (0 to 4).
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
 * Uses off-screen canvases for each cached cell to optimize performance.
 * @class
 */
export class StarField {
    /**
     * Creates a new StarField instance.
     * @param {number} [starsPerCell=10] - Base number of stars per grid cell.
     * @param {number} [gridSize=100] - Size of each grid cell in world-space units (pixels).
     */
    constructor(starsPerCell = 10, gridSize = 100) {
        /** @type {number} Base number of stars per grid cell */
        this.starsPerCell = starsPerCell;
        /** @type {number} Cell size in world-space units (pixels) */
        this.gridSize = gridSize;
        /** @type {number} Total number of parallax layers */
        this.layers = 5;
        /** @type {number[]} Parallax factors for each layer, from farthest (0.1) to closest (0.9) */
        this.parallaxFactors = [0.1, 0.3, 0.5, 0.7, 0.9];
        /** @type {boolean} Toggle to draw debug grid lines */
        this.debug = false;

        // Reusable Vector2D instances to reduce garbage collection
        /** @type {Vector2D} World position of the current cell */
        this.cellWorldPos = new Vector2D();
        /** @type {Vector2D} Screen position of the current cell */
        this.screenCellPos = new Vector2D();
        /** @type {Vector2D} Screen dimensions (width, height) */
        this.screenSize = new Vector2D();

        // Cache for off-screen canvases
        /** @type {Map<string, {canvas: HTMLCanvasElement, lastAccessed: number}>} */
        this.cellCanvasCache = new Map();
        /** @type {number} Time in milliseconds before cache entries expire */
        this.cacheExpiration = 5000; // 5 seconds
        /** @type {number} Timestamp of the last cache cleanup */
        this.lastCacheClean = Date.now();
    }

    /**
     * Generates and renders stars for a specific grid cell and layer onto an off-screen canvas.
     * @param {number} i - The x-index of the grid cell.
     * @param {number} j - The y-index of the grid cell.
     * @param {number} layer - The layer index.
     * @param {number} starCount - Number of stars to generate.
     * @param {number} distanceRatio - Ratio used for star color properties (1 = farthest, 0 = closest).
     * @param {number} parallaxFactor - The parallax factor for the layer.
     * @returns {HTMLCanvasElement} The off-screen canvas with rendered stars.
     */
    generateCellCanvas(i, j, layer, starCount, distanceRatio, parallaxFactor) {
        const seed = hash(i, j, layer);
        const rng = new SimpleRNG(seed);

        // Create off-screen canvas with size based on gridSize and parallaxFactor at zoom 1
        const canvasSize = Math.ceil(this.gridSize * parallaxFactor);
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');

        // Generate and render stars
        for (let k = 0; k < starCount; k++) {
            const relX = rng.next(); // Relative X position (0 to 1)
            const relY = rng.next(); // Relative Y position (0 to 1)
            const hue = Math.floor(rng.next() * 360); // Random hue (0-360)

            // Saturation: Higher for distant stars, lower for close stars
            const minSaturation = remapRange01(distanceRatio, 0, 30);
            const maxSaturation = remapRange01(distanceRatio, 10, 50);
            const saturation = Math.floor(remapRange01(rng.next(), minSaturation, maxSaturation));

            // Lightness: Brighter for close stars, dimmer for distant stars
            const minLightness = remapRange01(distanceRatio, 80, 20);
            const maxLightness = remapRange01(distanceRatio, 100, 60);
            const lightness = Math.floor(remapRange01(rng.next(), minLightness, maxLightness));

            // Define star color using HSL
            const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

            // Calculate star position on the canvas
            const starX = relX * this.gridSize * parallaxFactor;
            const starY = relY * this.gridSize * parallaxFactor;

            // Star size (constant in screen space in the original design)
            const size = 1 + parallaxFactor * 2;

            // Draw the star
            ctx.fillStyle = color;
            if (size > 2) {
                ctx.beginPath();
                ctx.arc(starX, starY, size / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(starX - size / 2, starY - size / 2, size, size);
            }
        }

        return canvas;
    }

    /**
     * Cleans up the cell canvas cache by removing entries that haven't been accessed recently.
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, entry] of this.cellCanvasCache) {
            if (now - entry.lastAccessed > this.cacheExpiration) {
                this.cellCanvasCache.delete(key);
            }
        }
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

            // Optimization: Skip distant layers when zoomed out
            if (zoomThreshold > parallaxFactor) {
                continue;
            }

            const parallaxZoom = parallaxFactor * camera.zoom;  // Combined zoom and parallax effect
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

            // Iterate over visible grid cells
            for (let i = gridLeft; i < gridRight; i++) {
                for (let j = gridTop; j < gridBottom; j++) {
                    const cacheKey = `${i}-${j}-${layer}`;
                    let cacheEntry = this.cellCanvasCache.get(cacheKey);

                    if (!cacheEntry) {
                        // Generate and cache the off-screen canvas for this cell
                        const canvas = this.generateCellCanvas(i, j, layer, starCount, distanceRatio, parallaxFactor);
                        cacheEntry = { canvas, lastAccessed: Date.now() };
                        this.cellCanvasCache.set(cacheKey, cacheEntry);
                    } else {
                        // Update last accessed time
                        cacheEntry.lastAccessed = Date.now();
                    }

                    // Calculate the screen position of the cell
                    this.cellWorldPos.set(i * this.gridSize, j * this.gridSize);
                    this.screenCellPos.set(this.cellWorldPos)
                        .subtractInPlace(camera.position)
                        .multiplyInPlace(parallaxZoom);
                    this.screenCellPos.x += this.screenSize.x * 0.5;
                    this.screenCellPos.y += this.screenSize.y * 0.5;

                    // Draw the pre-rendered canvas onto the main canvas, scaled by camera.zoom
                    const canvasWidth = cacheEntry.canvas.width * camera.zoom;
                    const canvasHeight = cacheEntry.canvas.height * camera.zoom;
                    ctx.drawImage(cacheEntry.canvas, this.screenCellPos.x, this.screenCellPos.y, canvasWidth, canvasHeight);

                    // Optional debug visualization: draw grid lines
                    if (this.debug) {
                        ctx.strokeStyle = "green"; // Horizontal line
                        ctx.beginPath();
                        ctx.moveTo(this.screenCellPos.x, this.screenCellPos.y);
                        ctx.lineTo(this.screenCellPos.x + canvasWidth, this.screenCellPos.y);
                        ctx.stroke();

                        ctx.strokeStyle = "red"; // Vertical line
                        ctx.beginPath();
                        ctx.moveTo(this.screenCellPos.x, this.screenCellPos.y);
                        ctx.lineTo(this.screenCellPos.x, this.screenCellPos.y + canvasHeight);
                        ctx.stroke();
                    }
                }
            }
        }

        // Clean up the cache periodically (every 10 seconds)
        if (Date.now() - this.lastCacheClean > 10000) {
            this.cleanCache();
            this.lastCacheClean = Date.now();
        }

        ctx.restore();
    }
}