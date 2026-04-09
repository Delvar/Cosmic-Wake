// /src/camera/starField.js

import { Camera } from '/src/camera/camera.js';
import { remapRange01, remapClamp, SimpleRNG, hash } from '/src/core/utils.js';
import { Vector2D } from '/src/core/vector2d.js';

/**
 * Represents a procedurally generated starfield with parallax effects across multiple layers.
 * Uses off-screen canvases per layer with pixel-aligned shifting for efficient rendering.
 */
export class StarField {
    constructor(starsPerCell = 20, gridSize = 1000, coloursPerLayer = 10) {
        this.starsPerCell = starsPerCell;
        this.gridSize = gridSize;
        this.layers = 5;
        this.parallaxFactors = [0.1, 0.3, 0.5, 0.7, 0.9];
        this.coloursPerLayer = coloursPerLayer;

        this.starCache = new Map();
        this.maxCacheSize = 500;

        // Double buffering for pixel shifts
        this.layerCanvases = new Array(this.layers).fill().map(() => ({
            canvas: document.createElement('canvas'),
            ctx: null,
            bufferCanvas: document.createElement('canvas'),
            bufferCtx: null,
            lastCameraPos: new Vector2D(),
            lastZoom: 0,
            needsRedraw: true
        }));

        this._scratchCellWorldPos = new Vector2D();
        this._scratchScreenCellPos = new Vector2D();
        this._scratchScreenSize = new Vector2D();
        this._scratchHalfScreenSize = new Vector2D();
        this._scratchStarRelPos = new Vector2D();
        this._scratchStarScreenPos = new Vector2D();

        this.starsByColourScratch = new Array(coloursPerLayer).fill().map(() => []);

        this.colourPalettes = this.generateColourPalettes();

        this.lastQuantizedZoom = 0;
        this.zoomStep = 0.1;
        this.debug = false; // Keep enabled
    }

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

    pruneCache() {
        const keys = this.starCache.keys();
        while (this.starCache.size > this.maxCacheSize) {
            const oldestKey = keys.next().value;
            this.starCache.delete(oldestKey);
        }
    }

    initLayerCanvases(camera) {
        const canvasWidth = camera.screenSize.width + this.gridSize / 2;
        const canvasHeight = camera.screenSize.height + this.gridSize / 2;
        this.layerCanvases.forEach(layer => {
            if (layer.canvas.width !== canvasWidth || layer.canvas.height !== canvasHeight) {
                layer.canvas.width = canvasWidth;
                layer.canvas.height = canvasHeight;
                layer.ctx = layer.canvas.getContext('2d');
                layer.bufferCanvas.width = canvasWidth;
                layer.bufferCanvas.height = canvasHeight;
                layer.bufferCtx = layer.bufferCanvas.getContext('2d');
                layer.needsRedraw = true;
            }
        });
    }

    renderLayerToCanvas(layerIdx, layerCtx, camera, parallaxZoom, isGapOnly = false, gapRegion = null) {
        const layerRatio = layerIdx / (this.layers - 1);
        const distanceRatio = 1 - layerRatio;
        const starCount = Math.round(1 + (this.starsPerCell * distanceRatio * distanceRatio));
        const parallaxFactor = this.parallaxFactors[layerIdx];
        const palette = this.colourPalettes[layerIdx];
        const size = 1 + parallaxFactor * 2;
        const halfSize = size / 2;

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

        const starsByColour = this.starsByColourScratch;
        for (let i = 0; i < this.coloursPerLayer; i++) {
            starsByColour[i].length = 0;
        }

        if (isGapOnly && gapRegion) {
            layerCtx.save();
            layerCtx.beginPath();
            layerCtx.rect(gapRegion.x, gapRegion.y, gapRegion.width, gapRegion.height);
            layerCtx.clip();
            if (this.debug) {
                console.log(`Layer ${layerIdx} gap: x=${gapRegion.x}, y=${gapRegion.y}, w=${gapRegion.width}, h=${gapRegion.height}`);
            }
        } else {
            layerCtx.clearRect(0, 0, layerCtx.canvas.width, layerCtx.canvas.height);
        }

        let drawCount = 0;

        for (let i = gridLeft; i < gridRight; i++) {
            for (let j = gridTop; j < gridBottom; j++) {
                const cacheKey = ((i % 1000 + 1000) % 1000) * 1e4 + ((j % 1000 + 1000) % 1000) * 1e1 + layerIdx;
                let starData = this.starCache.get(cacheKey);
                if (!starData) {
                    starData = this.generateStarsForCell(i, j, layerIdx, starCount, palette);
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

                    if (this._scratchStarScreenPos.x >= 0 && this._scratchStarScreenPos.x < layerCtx.canvas.width &&
                        this._scratchStarScreenPos.y >= 0 && this._scratchStarScreenPos.y < layerCtx.canvas.height &&
                        (!isGapOnly || (
                            this._scratchStarScreenPos.x >= gapRegion.x &&
                            this._scratchStarScreenPos.x < gapRegion.x + gapRegion.width &&
                            this._scratchStarScreenPos.y >= gapRegion.y &&
                            this._scratchStarScreenPos.y < gapRegion.y + gapRegion.height
                        ))) {
                        starsByColour[colourIdx].push(this._scratchStarScreenPos.x, this._scratchStarScreenPos.y);
                        drawCount++;
                    }
                }
            }
        }

        for (let c = 0; c < this.coloursPerLayer; c++) {
            const positions = starsByColour[c];
            if (positions.length) {
                layerCtx.fillStyle = palette[c];
                for (let p = 0; p < positions.length; p += 2) {
                    layerCtx.fillRect(positions[p] - halfSize, positions[p + 1] - halfSize, size, size);
                }
            }
        }

        if (this.debug) {
            console.log(`Layer ${layerIdx} ${isGapOnly ? 'gap' : 'full'} draw count: ${drawCount}`);
        }

        if (isGapOnly && gapRegion) {
            layerCtx.restore();
        }
    }

    draw(ctx, camera) {
        ctx.save();
        this.initLayerCanvases(camera);

        const zoomThreshold = 1 - remapClamp(camera.zoom, 0.5, 1, 0.5, 1);
        this._scratchScreenSize.set(camera.screenSize.width, camera.screenSize.height);
        this._scratchHalfScreenSize.set(this._scratchScreenSize).multiplyInPlace(0.5);

        const quantizedZoom = Math.round(camera.zoom / this.zoomStep) * this.zoomStep;
        const zoomChanged = quantizedZoom !== this.lastQuantizedZoom;

        for (let layerIdx = 0; layerIdx < this.layers; layerIdx++) {
            const layer = this.layerCanvases[layerIdx];
            const layerCtx = layer.ctx;
            const bufferCtx = layer.bufferCtx;
            const parallaxFactor = this.parallaxFactors[layerIdx];
            if (zoomThreshold > parallaxFactor) {
                layer.needsRedraw = true;
                continue;
            }

            const parallaxZoom = parallaxFactor * camera.zoom;

            if (zoomChanged || layer.lastZoom !== quantizedZoom) {
                layer.needsRedraw = true;
            }

            if (layer.needsRedraw) {
                layerCtx.globalCompositeOperation = 'source-over';
                this.renderLayerToCanvas(layerIdx, layerCtx, camera, parallaxZoom);
                layer.needsRedraw = false;
                layer.lastCameraPos.set(camera.position);
                layer.lastZoom = quantizedZoom;
                if (this.debug) {
                    console.log(`Layer ${layerIdx} full redraw`);
                }
            } else {
                const deltaX = (camera.position.x - layer.lastCameraPos.x) * parallaxZoom;
                const deltaY = (camera.position.y - layer.lastCameraPos.y) * parallaxZoom; // y-up world

                if (this.debug) {
                    console.log(`Layer ${layerIdx} deltaX=${deltaX}, deltaY=${deltaY}, lastPos=${layer.lastCameraPos.x},${layer.lastCameraPos.y}, currentPos=${camera.position.x},${camera.position.y}`);
                }

                if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
                    const maxDelta = this.gridSize / 4;
                    const clampedDeltaX = Math.max(-maxDelta, Math.min(maxDelta, deltaX));
                    const clampedDeltaY = Math.max(-maxDelta, Math.min(maxDelta, deltaY));
                    const roundedDeltaX = Math.round(clampedDeltaX); // Pixel-align
                    const roundedDeltaY = Math.round(clampedDeltaY);

                    // Shift pixels with copy mode
                    bufferCtx.clearRect(0, 0, layer.bufferCanvas.width, layer.bufferCanvas.height);
                    bufferCtx.globalCompositeOperation = 'copy';
                    bufferCtx.drawImage(layer.canvas, roundedDeltaX, roundedDeltaY);
                    bufferCtx.globalCompositeOperation = 'source-over';

                    // Copy buffer back to main canvas
                    layerCtx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                    layerCtx.globalCompositeOperation = 'copy';
                    layerCtx.drawImage(layer.bufferCanvas, 0, 0);
                    layerCtx.globalCompositeOperation = 'source-over';

                    // Render gaps
                    if (roundedDeltaX > 0) {
                        this.renderLayerToCanvas(layerIdx, layerCtx, camera, parallaxZoom, true, {
                            x: 0, y: 0,
                            width: roundedDeltaX, height: layer.canvas.height
                        });
                    } else if (roundedDeltaX < 0) {
                        this.renderLayerToCanvas(layerIdx, layerCtx, camera, parallaxZoom, true, {
                            x: layer.canvas.width + roundedDeltaX, y: 0,
                            width: -roundedDeltaX, height: layer.canvas.height
                        });
                    }
                    if (roundedDeltaY > 0) {
                        this.renderLayerToCanvas(layerIdx, layerCtx, camera, parallaxZoom, true, {
                            x: 0, y: 0,
                            width: layer.canvas.width, height: roundedDeltaY
                        });
                    } else if (roundedDeltaY < 0) {
                        this.renderLayerToCanvas(layerIdx, layerCtx, camera, parallaxZoom, true, {
                            x: 0, y: layer.canvas.height + roundedDeltaY,
                            width: layer.canvas.width, height: -roundedDeltaY
                        });
                    }

                    layer.lastCameraPos.set(camera.position);
                }
            }

            ctx.drawImage(layer.canvas, 0, 0);
        }

        this.lastQuantizedZoom = quantizedZoom;
        this.pruneCache();
        ctx.restore();
    }
}