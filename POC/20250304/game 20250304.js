class Star {
    constructor(size, depth, x, y) {
        this.size = size;
        this.depth = depth;
        this.x = x;
        this.y = y;
    }

    //Take the world space and move to camera space
    getScreenPosition(cameraX, cameraY) {
        const x = this.x - cameraX * this.depth;
        const y = this.y - cameraY * this.depth;
        return { 'x': x, 'y': y };
    }

    //Take camera space and move back to world space
    setScreenPosition(cameraX, cameraY, x, y) {
        this.x = x + (cameraX * this.depth);
        this.y = y + (cameraY * this.depth);
    }
}

class StarField {
    constructor(width, height, visibleWidth, visibleHeight, numberOfStars) {
        this.numberOfStars = numberOfStars;
        this.width = width;
        this.height = height;
        this.visibleWidth = visibleWidth;
        this.visibleHeight = visibleHeight;
        this.stars = [];
        for (let i = 0; i < this.numberOfStars; i++) {
            const magnitude = Math.pow(Math.random(), 20);
            const size = magnitude * 2 + 1;
            const depth = this.remapRange01(magnitude, 0.01, 0.9);
            const x = this.width * (Math.random() - 0.5);
            const y = this.height * (Math.random() - 0.5);
            this.stars.push(new Star(size, depth, x, y));
        }
    }

    resize(width, height, visibleWidth, visibleHeight) {
        this.width = width;
        this.height = height;
        this.visibleWidth = visibleWidth;
        this.visibleHeight = visibleHeight;
    }

    remapRange01(numberIn, rangeOutMin, rangeOutMax) {
        return (numberIn * (rangeOutMax - rangeOutMin)) + rangeOutMin;
    }

    randomBetween(rangeOutMin, rangeOutMax) {
        return (Math.random() * (rangeOutMax - rangeOutMin)) + rangeOutMin;
    }

    repositionStar(star, cameraX, cameraY, shipVelocityX, shipVelocityY) {
        //Which side do we spawn the stars on?
        //First we check if both the x any velocity is very small or 0, if so we spawn in all directions
        //then we check teh relative X and Y velocities, if one is large than the other we spawn the stars only on the side they are moving towards
        //if the X and Y velocity are proportionally equal then we pick a random side
        const absShipVelocityX = Math.abs(shipVelocityX);
        const absShipVelocityY = Math.abs(shipVelocityY);
        //case 0: full screen, case 1: top, case 2: right, case 3: bottom, case 4: left
        let spawnDirection = 0;
        //If not moving, pick a random side
        if (absShipVelocityX < 0.01 && absShipVelocityY < 0.01) {
            spawnDirection = Math.round(this.randomBetween(1, 4));
        } else if (absShipVelocityY < 0.01 || (absShipVelocityX / absShipVelocityY) > 2.5) {
            spawnDirection = shipVelocityX > 0 ? 2 : 4;
        } else if (absShipVelocityX < 0.01 || (absShipVelocityY / absShipVelocityX) > 2.5) {
            spawnDirection = shipVelocityY > 0 ? 3 : 1;
        } else {
            if (Math.random() > 0.5) {
                spawnDirection = shipVelocityX > 0 ? 2 : 4;
            } else {
                spawnDirection = shipVelocityY > 0 ? 3 : 1;
            }
        }

        const visibleLeft = this.visibleWidth * -0.5;
        const visibleRight = this.visibleWidth * 0.5;
        const visibleTop = this.visibleHeight * -0.5;
        const visibleBottom = this.visibleHeight * 0.5;

        const maxLeft = this.width * -0.5;
        const maxRight = this.width * 0.5;
        const maxTop = this.height * -0.5;
        const maxBottom = this.height * 0.5;

        let newX = 0;
        let newY = 0;

        let loopLimit = 10;
        do {
            switch (spawnDirection) {
                case 1:
                    newX = this.randomBetween(maxLeft, maxRight);
                    newY = this.randomBetween(maxTop, visibleTop);
                    break;
                case 2:
                    newX = this.randomBetween(visibleRight, maxRight);
                    newY = this.randomBetween(maxTop, maxBottom);
                    break;
                case 3:
                    newX = this.randomBetween(maxLeft, maxRight);
                    newY = this.randomBetween(visibleBottom, maxBottom);
                    break;
                case 4:
                    newX = this.randomBetween(maxLeft, visibleLeft);
                    newY = this.randomBetween(maxTop, maxBottom);
                    break;
                default:
                    newX = this.randomBetween(maxLeft, maxRight);
                    newY = this.randomBetween(maxTop, maxBottom);
            }
            // infinite loop breaker
            loopLimit--;
        } while (newX < visibleRight && newX > visibleLeft && newY < visibleBottom && newY > visibleTop && loopLimit > 0);

        star.setScreenPosition(cameraX, cameraY, newX, newY);
        return { 'x': newX, 'y': newY };
    }

    draw(context, cameraX, cameraY, shipVelocityX, shipVelocityY) {
        console.log("draw");
        context.save();
        this.stars.forEach(star => {
            let screenPosition = star.getScreenPosition(cameraX, cameraY);
            // Check if star is out of bounds and reposition it
            if (Math.abs(screenPosition.x) > this.width / 2 || Math.abs(screenPosition.y) > this.height / 2) {
                screenPosition = this.repositionStar(star, cameraX, cameraY, shipVelocityX, shipVelocityY);
            }
            context.fillStyle = 'white';
            context.fillRect(screenPosition.x + (context.canvas.width / 2), screenPosition.y + (context.canvas.height / 2), star.size, star.size);
        });
        context.restore();
    }
}

class Ship {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 0;
        this.maxSpeed = 5;
        this.angle = 0;
        this.rotationSpeed = 0.05;
        this.acceleration = 0.1;
        this.friction = 0.5;
        this.velocityX = 0;
        this.velocityY = 0;
    }

    move(keys, deltaTime) {
        const dt = deltaTime / 16.67;
        if (keys.ArrowLeft) this.angle -= this.rotationSpeed * dt;
        if (keys.ArrowRight) this.angle += this.rotationSpeed * dt;
        if (keys.ArrowUp) this.speed = Math.min(this.speed + this.acceleration * dt, this.maxSpeed);
        if (keys.ArrowDown) this.speed = Math.max(this.speed - this.acceleration * dt, 0);

        if (!keys.ArrowUp && !keys.ArrowDown) {
            this.speed = Math.max(this.speed - this.friction * dt, 0);
        }

        this.velocityX = Math.cos(this.angle) * this.speed;
        this.velocityY = Math.sin(this.angle) * this.speed;
        this.x += this.velocityX * dt;
        this.y += this.velocityY * dt;
    }

    draw(context, cameraX, cameraY) {
        context.save();
        context.translate(this.x - cameraX, this.y - cameraY);
        context.rotate(this.angle);
        context.fillStyle = 'white';
        context.beginPath();
        context.moveTo(15, 0);
        context.lineTo(-10, 10);
        context.lineTo(-10, -10);
        context.closePath();
        context.fill();
        context.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.context = this.canvas.getContext('2d');
        this.ship = new Ship(0, 0);
        this.keys = {};
        this.lastTime = performance.now();
        this.resizeCanvas();
        this.starField = new StarField(this.canvas.width * 2, this.canvas.height * 2, this.canvas.width, this.canvas.height, 1000);

        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);

        this.start();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.starField) {
            this.starField.resize(this.canvas.width * 2, this.canvas.height * 2, this.canvas.width, this.canvas.height);
        }
    }

    start() {
        const gameLoop = (currentTime) => {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            this.update(deltaTime);
            this.render();
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    }

    update(deltaTime) {
        this.ship.move(this.keys, deltaTime);
    }

    render() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cameraX = this.ship.x - this.canvas.width / 2;
        const cameraY = this.ship.y - this.canvas.height / 2;
        this.starField.draw(this.context, cameraX, cameraY, this.ship.velocityX, this.ship.velocityY);
        this.ship.draw(this.context, cameraX, cameraY);
    }
}

new Game();
