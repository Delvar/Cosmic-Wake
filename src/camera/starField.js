// /src/camera/starField.js

import { TWO_PI, remapRange01, remapClamp, SimpleRNG, hash } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';

/**
 * Represents a procedurally generated starfield with parallax effects across multiple layers.
 * Uses a fixed colour palette per layer for efficient batch rendering.
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

        /** @type {Map} Cache storing star data for grid cells to improve performance. */
        this.starCache = new Map();
        /** @type {number} Maximum number of cells to cache (~30 KB with 20 stars/cell). */
        this.maxCacheSize = 500;

        /** @type {Array<Array>} Scratch array for grouping stars by color during rendering. */
        this.starsByColourScratch = new Array(coloursPerLayer);
        for (let i = 0; i < coloursPerLayer; i++) {
            this.starsByColourScratch[i] = []; // Pre-allocate inner arrays
        }

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
     * Generates stars for a specific grid cell and layer using a single Uint8Array.
     * @param {number} i - The x-index of the grid cell.
     * @param {number} j - The y-index of the grid cell.
     * @param {number} layer - The layer index (0 to 4).
     * @param {number} starCount - Number of stars in the cell.
     * @param {Array<string>} palette - The layer's colour palette.
     * @returns {Uint8Array} Star data: [relX, relY, colourIdx, ...]
     */
    generateStarsForCell(i, j, layer, starCount, palette) {
        const seed = hash(i, j, layer);
        const rng = new SimpleRNG(seed);
        const starData = new Uint8Array(starCount * 3);

        for (let k = 0; k < starCount; k++) {
            const baseIdx = k * 3;
            starData[baseIdx] = Math.floor(rng.next() * 256);
            starData[baseIdx + 1] = Math.floor(rng.next() * 256);
            starData[baseIdx + 2] = Math.floor(rng.next() * palette.length);
        }

        return starData;
    }

    /**
     * Expands the positionPool if it’s too small to hold all visible stars.
     * @param {number} requiredStars - Number of stars needed.
     */
    expandPositionPool(requiredStars) {
        const currentCapacity = this.positionPool.length / 2; // Current max stars
        if (requiredStars <= currentCapacity) return;

        const newCapacity = Math.max(requiredStars, currentCapacity + 100); // Expand to requiredStars or current + 100
        const newPool = new Float32Array(newCapacity * 2);
        newPool.set(this.positionPool); // Copy existing data
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
     * Renders the starfield to the canvas, batching stars by colour.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object with position (Vector2D) and screenSize (width/height).
     */
    draw(ctx, camera) {
        ctx.save();

        const zoomThreshold = 1 - remapClamp(camera.zoom, 0.5, 1, 0.5, 1);
        this._scratchScreenSize.set(camera.screenSize.width, camera.screenSize.height);
        this._scratchHalfScreenSize.set(this._scratchScreenSize).multiplyInPlace(0.5);

        this.positionIndex = 0;

        for (let layer = 0; layer < this.layers; layer++) {
            const parallaxFactor = this.parallaxFactors[layer];
            if (zoomThreshold > parallaxFactor) continue;

            const starsByColour = this.starsByColourScratch;
            for (let i = 0; i < this.coloursPerLayer; i++) {
                starsByColour[i].length = 0;
            }

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

            const cellScreenWidth = this.gridSize * parallaxZoom;
            const cellScreenHeight = this.gridSize * parallaxZoom;

            const palette = this.colourPalettes[layer];

            for (let i = gridLeft; i < gridRight; i++) {
                for (let j = gridTop; j < gridBottom; j++) {
                    const cacheKey = ((i % 1000 + 1000) % 1000) * 1e4 + ((j % 1000 + 1000) % 1000) * 1e1 + layer;
                    let starData = this.starCache.get(cacheKey);
                    if (!starData) {
                        starData = this.generateStarsForCell(i, j, layer, starCount, palette);
                        this.starCache.set(cacheKey, starData);
                    }

                    this._scratchCellWorldPos.set(i * this.gridSize, j * this.gridSize);
                    this._scratchScreenCellPos.set(this._scratchCellWorldPos)
                        .subtractInPlace(camera.position)
                        .multiplyInPlace(parallaxZoom)
                        .addInPlace(this._scratchHalfScreenSize);

                    for (let k = 0; k < starCount; k++) {
                        const baseIdx = k * 3;
                        const relX = starData[baseIdx] / 255;
                        const relY = starData[baseIdx + 1] / 255;
                        const colourIdx = starData[baseIdx + 2];

                        this._scratchStarRelPos.set(relX * cellScreenWidth, relY * cellScreenHeight);
                        this._scratchStarScreenPos.set(this._scratchScreenCellPos).addInPlace(this._scratchStarRelPos);

                        if (this._scratchStarScreenPos.x >= 0 && this._scratchStarScreenPos.x < this._scratchScreenSize.x &&
                            this._scratchStarScreenPos.y >= 0 && this._scratchStarScreenPos.y < this._scratchScreenSize.y) {
                            if (this.positionIndex >= this.positionPool.length / 2) {
                                this.expandPositionPool(this.positionIndex + 1);
                            }
                            const posIdx = this.positionIndex * 2;
                            this.positionPool[posIdx] = this._scratchStarScreenPos.x;
                            this.positionPool[posIdx + 1] = this._scratchStarScreenPos.y;
                            starsByColour[colourIdx].push(posIdx);
                            this.positionIndex++;
                        }
                    }
                }
            }

            const size = 1 + parallaxFactor * 2;
            const halfSize = size / 2;
            if (size > 2) {
                for (let colourIdx = 0; colourIdx < palette.length; colourIdx++) {
                    const positions = starsByColour[colourIdx];
                    if (positions.length) {
                        ctx.fillStyle = palette[colourIdx];
                        ctx.beginPath();
                        for (const posIdx of positions) {
                            const x = this.positionPool[posIdx];
                            const y = this.positionPool[posIdx + 1];
                            ctx.arc(x, y, halfSize, 0, TWO_PI);
                            ctx.moveTo(x, y);
                        }
                        ctx.fill();
                    }
                }
            } else {
                for (let colourIdx = 0; colourIdx < palette.length; colourIdx++) {
                    const positions = starsByColour[colourIdx];
                    if (positions.length) {
                        ctx.fillStyle = palette[colourIdx];
                        for (const posIdx of positions) {
                            const x = this.positionPool[posIdx];
                            const y = this.positionPool[posIdx + 1];
                            ctx.fillRect(x - halfSize, y - halfSize, size, size);
                        }
                    }
                }
            }
        }
        this.pruneCache();
        ctx.restore();
    }
}