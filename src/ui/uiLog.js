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
     * @param {string} message - The message text to log.
     */
    log(message) {
        const line = document.createElement('div');
        line.className = 'log-line in';
        line.textContent = message;
        line.timestamp = Date.now();
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
    }

    /**
     * Checks the age of log lines and applies fade-out animations or removes old lines.
     * Called periodically by the interval timer.
     */
    _checkAges() {
        const now = Date.now();
        for (let i = 0; i < this.inner.children.length; i++) {
            const child = this.inner.children[i];
            const age = now - child.timestamp;
            if (age > 1000 && child.classList.contains('in')) {
                child.classList.remove('in');
            }
            if (age > this.maxAge && !child.classList.contains('out')) {
                child.classList.add('out');
            }
            if (age > (this.maxAge + 1000) && child.classList.contains('out')) {
                child.parentElement.removeChild(child);
                i--;
            }
        }
    }
}