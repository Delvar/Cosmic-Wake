// starField.js

import { remapRange01, remapClamp } from './utils.js';
import { Vector2D } from './vector2d.js';

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
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

/**
 * Represents a procedurally generated starfield with parallax effects across multiple layers.
 * Uses a fixed color palette per layer for efficient batch rendering.
 */
export class StarField {
    constructor(starsPerCell = 10, gridSize = 100, colorsPerLayer = 10) {
        this.starsPerCell = starsPerCell;
        this.gridSize = gridSize;
        this.layers = 5;
        this.parallaxFactors = [0.1, 0.3, 0.5, 0.7, 0.9];
        this.colorsPerLayer = colorsPerLayer;
        this.starCache = new Map();

        // Reusable Vector2D instances
        this.cellWorldPos = new Vector2D();
        this.screenCellPos = new Vector2D();
        this.starScreenPos = new Vector2D();
        this.screenSize = new Vector2D();
        this.halfScreenSize = new Vector2D();
        this.starRelPosition = new Vector2D();

        // Pre-generate color palettes for each layer
        this.colorPalettes = this.generateColorPalettes();
    }

    /**
     * Generates color palettes for each layer based on depth.
     * @returns {Array<Array<string>>} Array of color palettes, one per layer.
     */
    generateColorPalettes() {
        const palettes = [];
        for (let layer = 0; layer < this.layers; layer++) {
            const layerRatio = layer / (this.layers - 1); // 0 (far) to 1 (near)
            const distanceRatio = 1 - layerRatio; // 1 (far) to 0 (near)
            const palette = [];
            for (let c = 0; c < this.colorsPerLayer; c++) {
                const hue = Math.floor(Math.random() * 360); // Random hue (0-360)
                const minSaturation = remapRange01(distanceRatio, 0, 30); // Far: 0%, Near: 30%
                const maxSaturation = remapRange01(distanceRatio, 10, 50); // Far: 10%, Near: 50%
                const saturation = Math.floor(minSaturation + Math.random() * (maxSaturation - minSaturation));
                const minLightness = remapRange01(distanceRatio, 80, 20); // Far: 80%, Near: 20%
                const maxLightness = remapRange01(distanceRatio, 100, 60); // Far: 100%, Near: 60%
                const lightness = Math.floor(minLightness + Math.random() * (maxLightness - minLightness));
                palette.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
            }
            palettes.push(palette);
        }
        return palettes;
    }

    /**
     * Generates stars for a specific grid cell and layer, assigning colors from the layer's palette.
     */
    generateStarsForCell(i, j, layer, starCount, palette) {
        const seed = hash(i, j, layer);
        const rng = new SimpleRNG(seed);
        const stars = [];
        for (let k = 0; k < starCount; k++) {
            const relX = rng.next(); // Relative x (0-1 within cell)
            const relY = rng.next(); // Relative y (0-1 within cell)
            const colorIndex = Math.floor(rng.next() * palette.length);
            const color = palette[colorIndex];
            stars.push({ relX, relY, color });
        }
        return stars;
    }

    /**
     * Renders the starfield to the canvas, batching stars by color.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Camera} camera - The camera object with position (Vector2D) and screenSize (width/height).
     */
    draw(ctx, camera) {
        ctx.save();
        const zoomThreshold = 1 - remapClamp(camera.zoom, 0.5, 1, 0.5, 1);
        this.screenSize.set(camera.screenSize.width, camera.screenSize.height);
        this.halfScreenSize.set(this.screenSize).multiplyInPlace(0.5);

        for (let layer = 0; layer < this.layers; layer++) {
            const parallaxFactor = this.parallaxFactors[layer];
            if (zoomThreshold > parallaxFactor) continue; // Skip layers too far for current zoom

            const parallaxZoom = parallaxFactor * camera.zoom;
            const size = 1 + parallaxFactor * 2; // Star size based on layer depth
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

            // Group stars by color
            const starsByColor = new Map();
            const palette = this.colorPalettes[layer];

            for (let i = gridLeft; i < gridRight; i++) {
                for (let j = gridTop; j < gridBottom; j++) {
                    const cacheKey = `${i}-${j}-${layer}`;
                    let stars = this.starCache.get(cacheKey);
                    if (!stars) {
                        stars = this.generateStarsForCell(i, j, layer, starCount, palette);
                        this.starCache.set(cacheKey, stars);
                    }

                    // Compute screen position of cell
                    this.cellWorldPos.set(i * this.gridSize, j * this.gridSize);
                    this.screenCellPos.set(this.cellWorldPos)
                        .subtractInPlace(camera.position)
                        .multiplyInPlace(parallaxZoom)
                        .addInPlace(this.halfScreenSize);

                    for (const star of stars) {
                        this.starRelPosition.set(star.relX * cellScreenWidth, star.relY * cellScreenHeight);
                        this.starScreenPos.set(this.screenCellPos).addInPlace(this.starRelPosition);
                        if (this.starScreenPos.x >= 0 && this.starScreenPos.x < this.screenSize.x &&
                            this.starScreenPos.y >= 0 && this.starScreenPos.y < this.screenSize.y) {
                            const color = star.color;
                            if (!starsByColor.has(color)) starsByColor.set(color, []);
                            starsByColor.get(color).push(this.starScreenPos.clone());
                        }
                    }
                }
            }

            // Render each color group in one pass
            for (const [color, positions] of starsByColor) {
                ctx.fillStyle = color;
                for (const pos of positions) {
                    if (size > 2) {
                        ctx.beginPath();
                        ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
                    }
                }
            }
        }
        ctx.restore();
    }
}