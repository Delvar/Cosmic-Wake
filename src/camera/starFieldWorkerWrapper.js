// /src/camera/starFieldWorkerWrapper.js

import { StarFieldWorker } from '/src/camera/starFieldWorker.js';

/**
 * Internal data structure used by StarField to cache per-canvas render parameters
 * and avoid redundant work (dirty-flag optimisation).
 * @typedef {Object} StarFieldData
 * @property {boolean} dirty
 * @property {number} cameraPositionX
 * @property {number} cameraPositionY
 * @property {number} cameraZoom
 * @property {number} fadeout
 * @property {number} white
 * @property {string} name
 */

/**
 * A lightweight proxy for rendering a starfield within a Web Worker.
 * Manages canvas contexts and delegates rendering tasks to a StarFieldWorker instance.
 * Handles initialization, canvas management, resizing, and rendering via message events.
 */
class StarFieldWorkerWrapper {
    /**
     * Creates a new StarFieldWorkerWrapper instance.
     * Initializes properties, sets up message handlers, and starts the rendering loop.
     */
    constructor() {
        /** @type {StarFieldWorker|null} The StarFieldWorker instance for rendering the starfield. */
        this.starField = null;

        /** @type {Object.<string, OffscreenCanvas>} Map of canvas names to OffscreenCanvas instances. */
        this.canvasMap = {};

        /** @type {Object.<string, OffscreenCanvasRenderingContext2D>} Map of canvas names to 2D rendering contexts. */
        this.ctxMap = {};

        /** @type {Object.<string, StarFieldData>} Map of canvas names to rendering data (e.g., camera parameters). */
        this.dataMap = {};

        /** @type {Object.<string, Function>} Map of message types to their handler functions. */
        this.messageHandlers = {
            'init': this.handleInit.bind(this),
            'resize': this.handleResize.bind(this),
            'render': this.handleRender.bind(this),
            'addCanvas': this.handleAddCanvas.bind(this)
        };

        /** @type {Function} Bound render method for the animation loop. */
        this.render = this.render.bind(this);
        this.render();
        if (new.target === StarFieldWorkerWrapper) Object.seal(this);
    }

    /**
     * Handles incoming messages from the main thread.
     * Dispatches messages to the appropriate handler based on the message type.
     * @param {MessageEvent} message - The message event containing the type and data.
     * @returns {void}
     */
    onmessage(message) {
        const { type, ...data } = message.data;
        // Call the appropriate message handler
        const handler = this.messageHandlers[type];
        if (handler) {
            handler(data);
        } else {
            console.warn(`No handler for message type: ${type}`);
        }
    }

    /**
     * Initializes the StarFieldWorker with provided parameters.
     * Sends a 'ready' message to the main thread upon completion.
     * @param {Object} data - Initialization data.
     * @param {number} data.starsPerCell - Number of stars per grid cell.
     * @param {number} data.gridSize - Size of each grid cell in world coordinates.
     * @param {number} data.coloursPerLayer - Number of colors per parallax layer.
     * @param {number} data.layers - Number of parallax layers in the starfield.
     * @returns {void}
     */
    handleInit(data) {
        this.starField = new StarFieldWorker(data.starsPerCell, data.gridSize, data.coloursPerLayer, data.layers);
        self.postMessage({ type: 'ready' });
    }

    /**
     * Resizes the specified canvas to the given dimensions.
     * @param {Object} data - Resize data.
     * @param {string} data.name - The name of the canvas to resize.
     * @param {number} data.width - The new width of the canvas in pixels.
     * @param {number} data.height - The new height of the canvas in pixels.
     * @returns {void}
     */
    handleResize(data) {
        const name = data.name;
        const canvas = this.canvasMap[name];
        canvas.width = data.width;
        canvas.height = data.height;
        const oldData = this.dataMap[name] || {};
        oldData.dirty = true;
    }

    /**
     * Stores rendering data for the specified canvas and triggers rendering.
     * @param {StarFieldData} data - Rendering data.
     * @returns {void}
     */
    handleRender(data) {
        const name = data.name;
        this.dataMap[name] = data;
    }

    /**
     * Adds a canvas for rendering the starfield.
     * Stores the OffscreenCanvas and its 2D context in the respective maps.
     * @param {Object} data - Canvas data.
     * @param {string} data.name - The name of the canvas.
     * @param {OffscreenCanvas} data.canvas - The OffscreenCanvas to render to.
     * @returns {void}
     */
    handleAddCanvas(data) {
        const name = data.name;
        const canvas = data.canvas;
        this.canvasMap[name] = canvas;
        //this.ctxMap[name] = (canvas.getContext('2d', { alpha: false }));

        /** @type {OffscreenCanvasRenderingContext2D|null} */
        const context = /** @type {OffscreenCanvasRenderingContext2D|null} */ canvas.getContext('2d', { alpha: false });
        if (context === null) throw new Error('Failed to acquire OffscreenCanvasRenderingContext2D from canvas');
        /** @type {CanvasRenderingContext2D} The 2D rendering context for the main canvas. */
        this.ctxMap[name] = context;
    }

    /**
     * Renders the starfield to all canvases with available data.
     * Runs continuously via requestAnimationFrame to handle rendering updates.
     * @private
     * @returns {void}
     */
    render() {
        for (const name in this.canvasMap) {
            if (!name) continue;
            const data = this.dataMap[name];
            if (!data) continue;
            if (!data.dirty) continue;
            const ctx = this.ctxMap[name];
            if (!ctx) continue;
            if (this.starField) {
                this.starField.draw(ctx, data.cameraPositionX, data.cameraPositionY, data.cameraZoom, data.fadeout, data.white);
            }
            data.dirty = false;
        }
        requestAnimationFrame(this.render);
    }
}

/**
 * The singleton instance of StarFieldWorkerWrapper for handling Web Worker messages.
 * @type {StarFieldWorkerWrapper}
 */
const starFieldWorkerWrapper = new StarFieldWorkerWrapper();
self.onmessage = starFieldWorkerWrapper.onmessage.bind(starFieldWorkerWrapper);