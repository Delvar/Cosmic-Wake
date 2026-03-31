// /src/ui/uiLog.js

/**
 * Manages an in-game log display with automatic message fading and line limits.
 * Handles adding new log entries, removing old ones, and animating their appearance/disappearance.
 */
export class UiLog {
    /**
     * Creates a new UiLog instance.
     * @param {HTMLElement} inner - The HTML element to append log lines to.
     */
    constructor(inner) {
        /** @type {HTMLElement} The container element for log lines. */
        this.inner = inner;
        /** @type {number} Maximum number of log lines to display. */
        this.maxLines = 15;
        /** @type {number} Maximum age of log lines in milliseconds before fading out. */
        this.maxAge = 10000;
        /** @type {number} Interval ID for the age checking timer. */
        this.interval = setInterval(() => this._checkAges(), 100);

        /* Testing by adding log entries on the fly */
        // const sampleMsgs = ["Health Potion +2", "Sword upgraded", "+85 Gold", "Goblin defeated", "Mana Crystal acquired", "Rare herb found", "Level Up!", "Critical strike", "Boots of Speed", "Enemy stunned"];
        // let count = 1;
        // document.getElementById('add-btn').onclick = () => {
        //     const text = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        //     this.log(text + ` #${count++}`);
        // };
        // let text = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        // this.log(text + ` #${count++}`);
        // text = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        // this.log(text + ` #${count++}`);
        // text = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        // this.log(text + ` #${count++}`);
        // text = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        // this.log(text + ` #${count++}`);
    }

    /**
     * Adds a new message to the log, managing line limits and animations.
     * @param {...any} messages - Values to log (same as console.log).
     */
    log(...messages) {
        // Concatenate all arguments into a single string (same behaviour as console.log)
        const text = messages.map(arg =>
            (arg === null || arg === undefined) ? String(arg) : arg.toString()
        ).join(' ');

        const line = document.createElement('div');
        line.className = 'log-line in';
        line.textContent = text;
        line.dataset.timestamp = Date.now().toString();
        this.inner.appendChild(line);
        if (this.inner.children.length >= this.maxLines) {
            let linesToRemove = this.inner.children.length - this.maxLines;
            for (let i = 0; i < linesToRemove; i++) {
                this.inner.children[0].remove();
            }
            const top = this.inner.children[0];
            if (!top.classList.contains('out')) {
                top.classList.add('out');
            }
        }
        console.log(text);
    }

    /**
     * Checks the age of log lines and applies fade-out animations or removes old lines.
     * Called periodically by the interval timer.
     */
    _checkAges() {
        const now = Date.now();

        for (let i = this.inner.children.length - 1; i >= 0; i--) {
            /** @type {HTMLDivElement} */
            const child = /** @type {HTMLDivElement} */ (this.inner.children[i]);

            const timestamp = parseInt(child.dataset.timestamp, 10);
            const age = now - timestamp;

            if (age > 1000 && child.classList.contains('in')) {
                child.classList.remove('in');
            }
            if (age > this.maxAge && !child.classList.contains('out')) {
                child.classList.add('out');
            }
            if (age > (this.maxAge + 1000) && child.classList.contains('out')) {
                child.parentElement.removeChild(child);
            }
        }
    }
}