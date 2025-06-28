// /src/camera/starFieldWorkerWrapper.js

import { StarFieldWorker } from '/src/camera/starFieldWorker.js';

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
        /**
         * @type {StarFieldWorker|null} The StarFieldWorker instance for rendering the starfield.
         * @private
         */
        this.starField = null;

        /**
         * @type {Object.<string, OffscreenCanvas>} Map of canvas names to OffscreenCanvas instances.
         * @private
         */
        this.canvasMap = {};

        /**
         * @type {Object.<string, CanvasRenderingContext2D>} Map of canvas names to 2D rendering contexts.
         * @private
         */
        this.ctxMap = {};

        /**
         * @type {Object.<string, Object>} Map of canvas names to rendering data (e.g., camera parameters).
         * @private
         */
        this.dataMap = {};

        /**
         * @type {Object.<string, Function>} Map of message types to their handler functions.
         * @private
         */
        this.messageHandlers = {
            'init': this.handleInit.bind(this),
            'resize': this.handleResize.bind(this),
            'render': this.handleRender.bind(this),
            'addCanvas': this.handleAddCanvas.bind(this)
        };

        /**
         * @type {Function} Bound render method for the animation loop.
         * @private
         */
        this.render = this.render.bind(this);
        this.render();
        if (new.target === StarFieldWorkerWrapper) Object.seal(this);
    }

    /**
     * Handles incoming messages from the main thread.
     * Dispatches messages to the appropriate handler based on the message type.
     * @param {MessageEvent} message - The message event containing the type and data.
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
     */
    handleResize(data) {
        const name = data.name;
        const canvas = this.canvasMap[name];
        canvas.width = data.width;
        canvas.height = data.height;
    }

    /**
     * Stores rendering data for the specified canvas and triggers rendering.
     * @param {Object} data - Rendering data.
     * @param {string} data.name - The name of the canvas to render to.
     * @param {number} data.cameraPositionX - The world x position of the camera.
     * @param {number} data.cameraPositionY - The world y position of the camera.
     * @param {number} data.cameraZoom - The zoom level of the camera.
     * @param {number} data.fadeout - The alpha level for background fade (1.0 clears to black, < 1.0 leaves trails).
     * @param {number} data.white - The whiteout amount (0.0 = black, 1.0 = full white).
     */
    handleRender(data) {
        const name = data.name;
        const ctx = this.ctxMap[name];
        this.dataMap[name] = data;
        // this.starField.draw(ctx, data.cameraPositionX, data.cameraPositionY, data.cameraZoom, data.fadeout, data.white);
    }

    /**
     * Adds a canvas for rendering the starfield.
     * Stores the OffscreenCanvas and its 2D context in the respective maps.
     * @param {Object} data - Canvas data.
     * @param {string} data.name - The name of the canvas.
     * @param {OffscreenCanvas} data.canvas - The OffscreenCanvas to render to.
     */
    handleAddCanvas(data) {
        const name = data.name;
        const canvas = data.canvas;
        this.canvasMap[name] = canvas;
        this.ctxMap[name] = canvas.getContext('2d', { alpha: false });
    }

    /**
     * Renders the starfield to all canvases with available data.
     * Runs continuously via requestAnimationFrame to handle rendering updates.
     * @private
     */
    render() {
        for (const name in this.canvasMap) {
            if (!name) continue;
            const data = this.dataMap[name];
            if (!data) continue;
            const ctx = this.ctxMap[name];
            if (!ctx) continue;
            this.starField.draw(ctx, data.cameraPositionX, data.cameraPositionY, data.cameraZoom, data.fadeout, data.white);
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