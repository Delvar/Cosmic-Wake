// /src/camera/starFieldWorker.js

import { remapRange01, remapClamp, SimpleRNG, hash } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';

/**
 * Core starfield logic for rendering in main thread or worker.
 */
export class StarFieldWorker {
    /**
    * Creates a new StarField instance.
    * @param {number} [starsPerCell=20.0] - Number of stars per grid cell.
    * @param {number} [gridSize=1000.0] - Size of each grid cell in world coordinates.
    * @param {number} [coloursPerLayer=10.0] - Number of colors per layer for rendering.
    * @param {number} [layers=5.0] - Number of parallax layers in the starfield.
    */
    constructor(starsPerCell = 20.0, gridSize = 1000.0, coloursPerLayer = 10.0, layers = 5.0) {
        /** @type {number} Number of stars per grid cell. */
        this.starsPerCell = starsPerCell;
        /** @type {number} Size of each grid cell in world coordinates. */
        this.gridSize = gridSize;
        /** @type {number} Number of parallax layers in the starfield. */
        this.layers = Math.max(1, Math.floor(layers));
        /** @type {number[]} Array of parallax factors for each layer (affects scrolling speed). */
        this.parallaxFactors = this.generateParallaxFactors(this.layers);
        /** @type {number} Number of colors per layer for rendering. */
        this.coloursPerLayer = coloursPerLayer;
        /** @type {boolean} Whether to round star positions to whole numbers, to speed up rendering. */
        this.rounding = false;

        /** @type {Map} Cache storing star data for grid cells to improve performance. */
        this.starCache = new Map();
        /** @type {number} Maximum number of cells to cache (~30 KB with 20 stars/cell). */
        this.maxCacheSize = 500.0;

        /** @type {Array<Array>} Scratch array for grouping stars by color during rendering. */
        this.starsByColourScratch = new Array(coloursPerLayer);
        for (let i = 0.0; i < coloursPerLayer; i++) {
            this.starsByColourScratch[i] = []; // Pre-allocate inner arrays
        }

        /** @type {number} Initial number of visible stars for position buffer allocation. */
        this.initialVisibleStars = 2500.0;
        /** @type {Float32Array} Buffer storing star positions [x1, y1, x2, y2, ...]. */
        this.positionPool = new Float32Array(this.initialVisibleStars * 2.0);
        /** @type {number} Current index in the position pool for adding new stars. */
        this.positionIndex = 0.0;

        // Reusable Vector2D instances for coordinate transformations
        /** @type {Vector2D} Scratch vector for the world position of a grid cell. */
        this._scratchCellWorldPos = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for the screen position of a grid cell. */
        this._scratchScreenCellPos = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for the screen position of an individual star. */
        this._scratchStarScreenPos = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for the full screen dimensions. */
        this._scratchScreenSize = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for half the screen dimensions for centering. */
        this._scratchHalfScreenSize = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Scratch vector for the relative position of a star within a cell. */
        this._scratchStarRelPos = new Vector2D(0.0, 0.0);

        /** @type {Array<Array<string>>} Pre-generated color palettes for each layer, containing HSL color strings. */
        this.colourPalettes = this.generateColourPalettes();

        if (new.target === StarFieldWorker) Object.seal(this);
    }

    /**
     * Generates parallax factors linearly distributed from 0.1 to 0.9.
     * @param {number} layers - Number of layers.
     * @returns {number[]} Array of parallax factors.
     */
    generateParallaxFactors(layers) {
        const factors = [];
        for (let i = 0; i < layers; i++) {
            const t = layers > 1 ? i / (layers - 1) : 0;
            const factor = remapClamp(i, 0, layers - 1, 0.1, 0.9);
            factors.push(factor);
        }
        return factors;
    }

    /**
      * Generates colour palettes for each layer based on depth.
      * @returns {Array<Array<string>>} Array of colour palettes, one per layer.
      */
    generateColourPalettes() {
        const palettes = [];
        for (let layer = 0.0; layer < this.layers; layer++) {
            const layerRatio = layer / (this.layers - 1.0);
            const distanceRatio = 1 - layerRatio;
            const palette = [];
            for (let c = 0.0; c < this.coloursPerLayer; c++) {
                const hue = Math.floor(Math.random() * 360.0);
                const minSaturation = remapRange01(distanceRatio, 0.0, 30.0);
                const maxSaturation = remapRange01(distanceRatio, 10.0, 50.0);
                const saturation = Math.floor(minSaturation + Math.random() * (maxSaturation - minSaturation));
                const minLightness = remapRange01(distanceRatio, 80.0, 20.0);
                const maxLightness = remapRange01(distanceRatio, 100.0, 60.0);
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
     * @param {number} layer - The layer index (0 to  4.0).
     * @param {number} starCount - Number of stars in the cell.
     * @param {Array<string>} palette - The layer's colour palette.
     * @returns {Uint8Array} Star data: [relX, relY, colourIdx, ...]
     */
    generateStarsForCell(i, j, layer, starCount, palette) {
        const seed = hash(i, j, layer);
        const rng = new SimpleRNG(seed);
        const starData = new Uint8Array(starCount * 3.0);

        for (let k = 0.0; k < starCount; k++) {
            const baseIdx = k * 3.0;
            starData[baseIdx] = Math.floor(rng.next() * 256.0);
            starData[baseIdx + 1.0] = Math.floor(rng.next() * 256.0);
            starData[baseIdx + 2.0] = Math.floor(rng.next() * palette.length);
        }

        return starData;
    }

    /**
     * Expands the positionPool if it’s too small to hold all visible stars.
     * @param {number} requiredStars - Number of stars needed.
     */
    expandPositionPool(requiredStars) {
        const currentCapacity = this.positionPool.length / 2.0; // Current max stars
        if (requiredStars <= currentCapacity) return;

        const newCapacity = Math.max(requiredStars, currentCapacity + 100.0); // Expand to requiredStars or current + 100
        const newPool = new Float32Array(newCapacity * 2.0);
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
     * @param {number} cameraPostionX - The world x position of the camera.
     * @param {number} cameraPostionY - The world y position of the camera.
     * @param {number} cameraZoom - The zoom of the camera.
     * @param {number} fadeout - the alpha level of the blank out, 1.0 clear to black, < 1.0 leaves trails
     * @param {number} white - the whiteout amount, 0.0 = black, 1.0 = full white
     */
    draw(ctx, cameraPostionX, cameraPostionY, cameraZoom, fadeout, white) {
        // const seconds = new Date().getSeconds();
        // const colours = ['red', 'green', 'blue'];
        // const colour = colours[seconds % colours.length];
        const screenWidth = ctx.canvas.width;
        const screenHeight = ctx.canvas.height;
        ctx.save();
        white = Math.round(white * 255.0);
        ctx.fillStyle = `rgba(${white},  ${white},  ${white}, ${fadeout})`;
        //ctx.fillStyle = colour;
        ctx.fillRect(0.0, 0.0, screenWidth, screenHeight);

        if (fadeout < 0.25) {
            ctx.globalCompositeOperation = 'screen';
        }

        this._scratchScreenSize.set(screenWidth, screenHeight);
        this._scratchHalfScreenSize.set(this._scratchScreenSize).multiplyInPlace(0.5);

        ctx.fillStyle = 'red';
        ctx.fillRect(this._scratchHalfScreenSize.x - 2.5, this._scratchHalfScreenSize.y - 2.5, 5.0, 5.0);
        ctx.fillStyle = 'green';
        ctx.fillRect(this._scratchScreenSize.x - 5.0, this._scratchScreenSize.y - 5.0, 5.0, 5.0);
        ctx.fillStyle = 'blue';
        ctx.fillRect(0.0, 0.0, 5.0, 5.0);

        this.positionIndex = 0.0;

        const layerFrom = Math.round(remapClamp(cameraZoom, 0.5, 1.0, this.layers - 3.0, 0.0));
        const layerTo = Math.max(layerFrom, (fadeout < 0.27 ? 3.0 : this.layers));

        for (let layer = layerFrom; layer < layerTo; layer++) {
            const parallaxFactor = this.parallaxFactors[layer];
            const starsByColour = this.starsByColourScratch;
            for (let i = 0.0; i < this.coloursPerLayer; i++) {
                starsByColour[i].length = 0.0;
            }

            const parallaxZoom = parallaxFactor * cameraZoom;
            const layerRatio = layer / (this.layers - 1.0);
            const distanceRatio = 1 - layerRatio;
            const starCount = Math.round(1 + (this.starsPerCell * distanceRatio * distanceRatio));

            // Calculate visible grid bounds
            const visibleWidth = screenWidth / parallaxZoom;
            const visibleHeight = screenHeight / parallaxZoom;
            const visibleLeft = cameraPostionX - visibleWidth / 2.0;
            const visibleRight = cameraPostionX + visibleWidth / 2.0;
            const visibleTop = cameraPostionY - visibleHeight / 2.0;
            const visibleBottom = cameraPostionY + visibleHeight / 2.0;

            const gridLeft = Math.floor(visibleLeft / this.gridSize);
            const gridRight = Math.ceil(visibleRight / this.gridSize);
            const gridTop = Math.floor(visibleTop / this.gridSize);
            const gridBottom = Math.ceil(visibleBottom / this.gridSize);

            const cellScreenWidth = this.gridSize * parallaxZoom;
            const cellScreenHeight = this.gridSize * parallaxZoom;

            const palette = this.colourPalettes[layer];

            for (let i = gridLeft; i < gridRight; i++) {
                for (let j = gridTop; j < gridBottom; j++) {

                    const cacheKey = ((i % 1000.0 + 1000.0) % 1000.0) * 1e4 + ((j % 1000.0 + 1000.0) % 1000.0) * 1e1 + layer;
                    let starData = this.starCache.get(cacheKey);
                    if (!starData) {
                        starData = this.generateStarsForCell(i, j, layer, starCount, palette);
                        this.starCache.set(cacheKey, starData);
                    }

                    this._scratchCellWorldPos.set(i * this.gridSize, j * this.gridSize);
                    this._scratchScreenCellPos.set(this._scratchCellWorldPos);
                    this._scratchScreenCellPos.x -= cameraPostionX;
                    this._scratchScreenCellPos.y -= cameraPostionY;
                    this._scratchScreenCellPos.multiplyInPlace(parallaxZoom).addInPlace(this._scratchHalfScreenSize);

                    for (let k = 0.0; k < starCount; k++) {
                        const baseIdx = k * 3.0;
                        const relX = starData[baseIdx] / 255.0;
                        const relY = starData[baseIdx + 1.0] / 255.0;
                        const colourIdx = starData[baseIdx + 2];

                        this._scratchStarRelPos.set(relX * cellScreenWidth, relY * cellScreenHeight);
                        this._scratchStarScreenPos.set(this._scratchScreenCellPos).addInPlace(this._scratchStarRelPos);

                        if (this._scratchStarScreenPos.x >= 0.0 && this._scratchStarScreenPos.x < this._scratchScreenSize.x &&
                            this._scratchStarScreenPos.y >= 0.0 && this._scratchStarScreenPos.y < this._scratchScreenSize.y) {
                            if (this.positionIndex >= this.positionPool.length / 2.0) {
                                this.expandPositionPool(this.positionIndex + 1.0);
                            }
                            const posIdx = this.positionIndex * 2.0;
                            this.positionPool[posIdx] = this._scratchStarScreenPos.x;
                            this.positionPool[posIdx + 1.0] = this._scratchStarScreenPos.y;
                            starsByColour[colourIdx].push(posIdx);
                            this.positionIndex++;
                        }
                    }
                }
            }

            const size = remapClamp(layer, 0.0, this.layers - 1.0, 1.0, 3.0);
            const halfSize = size / 2.0;
            for (let colourIdx = 0.0; colourIdx < palette.length; colourIdx++) {
                const positions = starsByColour[colourIdx];
                if (positions.length) {
                    ctx.fillStyle = palette[colourIdx];
                    for (const posIdx of positions) {
                        const x = this.positionPool[posIdx];
                        const y = this.positionPool[posIdx + 1];
                        if (this.rounding) {
                            ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
                        } else {
                            ctx.fillRect(x - halfSize, y - halfSize, size, size);
                        }
                    }
                }
            }
        }
        this.pruneCache();
        ctx.restore();
    }

    destroy() {
        // No-op for main thread
    }
}