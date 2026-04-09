// /src/camera/starField.js

import { Camera } from '/src/camera/camera.js';
import { remapRange01, remapClamp, SimpleRNG, hash } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';

/**
 * Represents a procedurally generated starfield with parallax effects across multiple layers.
 * Uses Path2D to batch stars by color per cell for efficient rendering.
 */
export class StarField {
    /**
     * Creates a new StarField instance.
     * @param {number} [starsPerCell=20] - Number of stars per grid cell.
     * @param {number} [gridSize=1000] - Size of each grid cell in world coordinates.
     * @param {number} [coloursPerLayer=10] - Number of colors per layer for rendering.
     */
    constructor(starsPerCell = 20, gridSize = 1000, coloursPerLayer = 10) {
        /** @type {number} Number of stars per grid cell. */
        this.starsPerCell = starsPerCell;
        /** @type {number} Size of each grid cell in world coordinates. */
        this.gridSize = gridSize;
        /** @type {number} Number of parallax layers in the starfield. */
        this.layers = 5;
        /** @type {number[]} Array of parallax factors for each layer (affects scrolling speed). */
        this.parallaxFactors = [0.1, 0.3, 0.5, 0.7, 0.9];
        /** @type {number} Number of colors per layer for rendering. */
        this.coloursPerLayer = coloursPerLayer;

        /** @type {Map} Cache storing star data and Path2D objects for grid cells. */
        this.starCache = new Map();
        /** @type {number} Maximum number of cells to cache (~30 KB data + Path2D per cell). */
        this.maxCacheSize = 500;

        /** @type {number} Initial number of visible stars for position buffer allocation. */
        this.initialVisibleStars = 2500;
        /** @type {Float32Array} Buffer storing star positions [x1, y1, x2, y2, ...]. */
        this.positionPool = new Float32Array(this.initialVisibleStars * 2);
        /** @type {number} Current index in the position pool for adding new stars. */
        this.positionIndex = 0;

        // Reusable Vector2D instances for coordinate transformations
        /** @type {Vector2D} Scratch vector for the world position of a grid cell. */
        this._scratchCellWorldPos = new Vector2D();
        /** @type {Vector2D} Scratch vector for the screen position of a grid cell. */
        this._scratchScreenCellPos = new Vector2D();
        /** @type {Vector2D} Scratch vector for the screen position of an individual star. */
        this._scratchStarScreenPos = new Vector2D();
        /** @type {Vector2D} Scratch vector for the full screen dimensions. */
        this._scratchScreenSize = new Vector2D();
        /** @type {Vector2D} Scratch vector for half the screen dimensions for centering. */
        this._scratchHalfScreenSize = new Vector2D();
        /** @type {Vector2D} Scratch vector for the relative position of a star within a cell. */
        this._scratchStarRelPos = new Vector2D();

        /** @type {Array<Array<string>>} Pre-generated color palettes for each layer, containing HSL color strings. */
        this.colourPalettes = this.generateColourPalettes();

        /** @type {number} Last zoom level used for path generation (quantized). */
        this.lastQuantizedZoom = 0;
        /** @type {number} Zoom quantization step (e.g., 0.1 for 0.5, 0.6, etc.). */
        this.zoomStep = 0.1;
    }

    /**
     * Generates colour palettes for each layer based on depth.
     * @returns {Array<Array<string>>} Array of colour palettes, one per layer.
     */
    generateColourPalettes() {
        const palettes = [];
        for (let layer = 0; layer < this.layers; layer++) {
            const layerRatio = layer / (this.layers - 1);
            const distanceRatio = 1 - layerRatio;
            const palette = [];
            for (let c = 0; c < this.coloursPerLayer; c++) {
                const hue = Math.floor(Math.random() * 360);
                const minSaturation = remapRange01(distanceRatio, 0, 30);
                const maxSaturation = remapRange01(distanceRatio, 10, 50);
                const saturation = Math.floor(minSaturation + Math.random() * (maxSaturation - minSaturation));
                const minLightness = remapRange01(distanceRatio, 80, 20);
                const maxLightness = remapRange01(distanceRatio, 100, 60);
                const lightness = Math.floor(minLightness + Math.random() * (maxLightness - minLightness));
                palette.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
            }
            palettes.push(palette);
        }
        return palettes;
    }

    /**
     * Generates stars and Path2D objects for a specific grid cell and layer.
     * @param {number} i - The x-index of the grid cell.
     * @param {number} j - The y-index of the grid cell.
     * @param {number} layer - The layer index (0 to 4).
     * @param {number} starCount - Number of stars in the cell.
     * @param {Array<string>} palette - The layer's colour palette.
     * @param {number} parallaxZoom - The parallax-adjusted zoom level for path generation.
     * @returns {Object} Contains starData (Uint8Array) and paths (Array<Path2D>).
     */
    generateStarsForCell(i, j, layer, starCount, palette, parallaxZoom) {
        const seed = hash(i, j, layer);
        const rng = new SimpleRNG(seed);
        const starData = new Uint8Array(starCount * 3);
        const paths = new Array(this.coloursPerLayer).fill().map(() => new Path2D());

        const parallaxFactor = this.parallaxFactors[layer];
        const size = 1 + parallaxFactor * 2;
        const halfSize = size / 2;
        const cellScreenWidth = this.gridSize * parallaxZoom;
        const cellScreenHeight = this.gridSize * parallaxZoom;

        for (let k = 0; k < starCount; k++) {
            const baseIdx = k * 3;
            const relX = rng.next();
            const relY = rng.next();
            const colourIdx = Math.floor(rng.next() * palette.length);

            starData[baseIdx] = Math.floor(relX * 256);
            starData[baseIdx + 1] = Math.floor(relY * 256);
            starData[baseIdx + 2] = colourIdx;

            // Add star to Path2D for its color (relative to cell origin)
            const x = relX * cellScreenWidth - halfSize;
            const y = relY * cellScreenHeight - halfSize;
            paths[colourIdx].rect(x, y, size, size);
        }

        return { starData, paths };
    }

    /**
     * Expands the positionPool if it’s too small to hold all visible stars.
     * @param {number} requiredStars - Number of stars needed.
     */
    expandPositionPool(requiredStars) {
        const currentCapacity = this.positionPool.length / 2;
        if (requiredStars <= currentCapacity) return;

        const newCapacity = Math.max(requiredStars, currentCapacity + 100);
        const newPool = new Float32Array(newCapacity * 2);
        newPool.set(this.positionPool);
        this.positionPool = newPool;
    }

    /**
     * Prunes the starCache to keep it under maxCacheSize by removing the oldest entries.
     */
    pruneCache() {
        const keys = this.starCache.keys();
        while (this.starCache.size > this.maxCacheSize) {
            const oldestKey = keys.next().value;
            this.starCache.delete(oldestKey);
        }
    }

    /**
     * Renders the starfield to the canvas using cached Path2D objects per cell.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object with position (Vector2D) and screenSize (width/height).
     */
    draw(ctx, camera) {
        ctx.save();

        const zoomThreshold = 1 - remapClamp(camera.zoom, 0.5, 1, 0.5, 1);
        this._scratchScreenSize.set(camera.screenSize.width, camera.screenSize.height);
        this._scratchHalfScreenSize.set(this._scratchScreenSize).multiplyInPlace(0.5);

        // Quantize zoom to reduce path regeneration
        const quantizedZoom = Math.round(camera.zoom / this.zoomStep) * this.zoomStep;
        const zoomChanged = quantizedZoom !== this.lastQuantizedZoom;

        for (let layer = 0; layer < this.layers; layer++) {
            const parallaxFactor = this.parallaxFactors[layer];
            if (zoomThreshold > parallaxFactor) continue;

            const parallaxZoom = parallaxFactor * camera.zoom;
            const layerRatio = layer / (this.layers - 1);
            const distanceRatio = 1 - layerRatio;
            const starCount = Math.round(1 + (this.starsPerCell * distanceRatio * distanceRatio));

            // Calculate visible grid bounds
            const visibleWidth = camera.screenSize.width / parallaxZoom;
            const visibleHeight = camera.screenSize.height / parallaxZoom;
            const visibleLeft = camera.position.x - visibleWidth / 2;
            const visibleRight = camera.position.x + visibleWidth / 2;
            const visibleTop = camera.position.y - visibleHeight / 2;
            const visibleBottom = camera.position.y + visibleHeight / 2;

            const gridLeft = Math.floor(visibleLeft / this.gridSize);
            const gridRight = Math.ceil(visibleRight / this.gridSize);
            const gridTop = Math.floor(visibleTop / this.gridSize);
            const gridBottom = Math.ceil(visibleBottom / this.gridSize);

            const palette = this.colourPalettes[layer];

            // Render each visible cell
            for (let i = gridLeft; i < gridRight; i++) {
                for (let j = gridTop; j < gridBottom; j++) {
                    const cacheKey = ((i % 1000 + 1000) % 1000) * 1e4 + ((j % 1000 + 1000) % 1000) * 1e1 + layer + `_z${quantizedZoom}`;
                    let cellData = this.starCache.get(cacheKey);
                    if (!cellData || zoomChanged) {
                        cellData = this.generateStarsForCell(i, j, layer, starCount, palette, parallaxZoom);
                        this.starCache.set(cacheKey, cellData);
                    }

                    // Calculate cell screen position
                    this._scratchCellWorldPos.set(i * this.gridSize, j * this.gridSize);
                    this._scratchScreenCellPos.set(this._scratchCellWorldPos)
                        .subtractInPlace(camera.position)
                        .multiplyInPlace(parallaxZoom)
                        .addInPlace(this._scratchHalfScreenSize);

                    // Render paths for each color
                    ctx.save();
                    ctx.translate(this._scratchScreenCellPos.x, this._scratchScreenCellPos.y);
                    for (let colourIdx = 0; colourIdx < this.coloursPerLayer; colourIdx++) {
                        const path = cellData.paths[colourIdx];
                        if (path) { // Path may be empty if no stars of this color
                            ctx.fillStyle = palette[colourIdx];
                            ctx.fill(path);
                        }
                    }
                    ctx.restore();
                }
            }
        }

        this.lastQuantizedZoom = quantizedZoom;
        this.pruneCache();
        ctx.restore();
    }
}