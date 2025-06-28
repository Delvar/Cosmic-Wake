// /src/camera/starField.js

import { StarFieldWorker } from '/src/camera/starFieldWorker.js';
import { Camera } from '/src/camera/camera.js';

/**
 * A lightweight proxy for rendering a starfield, delegating to either main-thread or worker-based rendering.
 * Manages canvas contexts and communicates with a Web Worker or a local StarFieldWorker instance to render the starfield.
 * Supports multiple canvases identified by name and handles initialization, rendering, resizing, and cleanup.
 */
export class StarField {
    /**
     * Creates a new StarField instance.
     * @param {number} [starsPerCell=20.0] - Number of stars per grid cell in the starfield.
     * @param {number} [gridSize=1000.0] - Size of each grid cell in world coordinates.
     * @param {number} [coloursPerLayer=10.0] - Number of colors per parallax layer for rendering.
     * @param {boolean} [useWorker=false] - Whether to use a Web Worker for rendering. Falls back to main thread if false or unsupported.
     * @param {number} [layers=5.0] - Number of parallax layers in the starfield.
     */
    constructor(starsPerCell = 20.0, gridSize = 1000.0, coloursPerLayer = 10.0, useWorker = false, layers = 5.0) {
        /** @type {boolean} Whether to use a Web Worker for rendering. */
        this.useWorker = useWorker && typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined';

        /** @type {Object.<string, HTMLCanvasElement>} Map of canvas names to HTML canvas elements (main thread only).*/
        this.canvasMap = {};

        /** @type {Object.<string, OffscreenCanvas>} Map of canvas names to OffscreenCanvas instances (worker mode only). */
        this.offScreenCanvasMap = {};

        /** @type {Object.<string, CanvasRenderingContext2D>} Map of canvas names to 2D rendering contexts. */
        this.ctxMap = {};

        /** @type {Worker|null} The Web Worker instance for rendering, or null if not using a worker. */
        this.worker = null;

        /** @type {StarFieldWorker|null} The StarFieldWorker instance for main-thread rendering, or null if using a worker. */
        this.renderer = null;

        //Start the web worker
        if (this.useWorker) {
            try {
                this.worker = new Worker('/src/camera/starFieldWorkerWrapper.js', { type: 'module' });
                // Send initialization data to worker
                this.worker.postMessage({
                    type: 'init',
                    starsPerCell,
                    gridSize,
                    coloursPerLayer,
                    layers
                });
            } catch (e) {
                console.warn('Module-based worker not supported, falling back to main thread:', e);
                this.useWorker = false;
                this.renderer = new StarFieldWorker(starsPerCell, gridSize, coloursPerLayer, layers);
            }
        } else {
            // Main-thread mode
            this.renderer = new StarFieldWorker(starsPerCell, gridSize, coloursPerLayer, layers);
        }
        if (new.target === StarField) Object.seal(this);
    }

    /**
     * Adds a canvas for rendering the starfield.
     * In worker mode, transfers control to an OffscreenCanvas; in main-thread mode, stores the canvas and its context.
     * @param {string} name - The unique identifier for the canvas.
     * @param {HTMLCanvasElement} canvas - The HTML canvas element to render the starfield to.
     */
    addCanvas(name, canvas) {
        if (this.useWorker) {
            const offscreen = canvas.transferControlToOffscreen()
            this.offScreenCanvasMap[name] = offscreen;
            this.worker.postMessage({
                type: 'addCanvas',
                name: name,
                canvas: offscreen
            }, [offscreen]);
        } else {
            this.canvasMap[name] = canvas;
            this.ctxMap[name] = canvas.getContext('2d', { alpha: false });
        }
    }

    /**
     * Renders the starfield to the specified canvas.
     * In worker mode, sends a render message to the worker; in main-thread mode, delegates to the StarFieldWorker instance.
     * @param {string} name - The name of the canvas to render to.
     * @param {Camera} camera - The camera object with position (Vector2D) and zoom properties.
     * @param {number} fadeout - The alpha level for background fade, where 1.0 clears to black and < 1.0 leaves trails.
     * @param {number} white - The whiteout amount, where 0.0 is black and 1.0 is full white.
     */
    draw(name, camera, fadeout, white) {
        if (this.useWorker) {
            this.worker.postMessage({
                type: 'render',
                name: name,
                cameraPositionX: camera.position.x,
                cameraPositionY: camera.position.y,
                cameraZoom: camera.zoom,
                fadeout: fadeout,
                white: white
            });
        } else {
            const ctx = this.ctxMap[name];
            this.renderer.draw(ctx, camera.position.x, camera.position.y, camera.zoom, fadeout, white);
        }
    }

    /**
     * Resizes the specified canvas to the given dimensions.
     * In worker mode, sends a resize message to the worker; in main-thread mode, updates the canvas directly.
     * @param {string} name - The name of the canvas to resize.
     * @param {number} width - The new width of the canvas in pixels.
     * @param {number} height - The new height of the canvas in pixels.
     */
    resize(name, width, height) {
        if (this.useWorker) {
            this.worker.postMessage({
                type: 'resize',
                name: name,
                width: width,
                height: height
            });
        } else {
            const canvas = this.canvasMap[name];
            canvas.width = width;
            canvas.height = height;
        }
    }

    /**
     * Cleans up resources by terminating the worker (if used) and clearing canvas maps.
     */
    destroy() {
        if (this.useWorker && this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.offScreenCanvasMap = {};
            this.ctxMap = {};
        }
    }
}