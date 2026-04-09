const celestialTypes = {
    'star': { type: 'star', color: '255, 255, 0' },
    'planet': {
        type: 'planet', color: '0, 0, 255', subtypes: {
            'Chthonian': { subtype: 'Chthonian', color: '255, 69, 0' },
            'Carbon': { subtype: 'Carbon', color: '105, 105, 105' },
            'Desert': { subtype: 'Desert', color: '244, 164, 96' },
            'Gas Dwarf': { subtype: 'Gas Dwarf', color: '173, 216, 230' },
            'Gas Giant': { subtype: 'Gas Giant', color: '255, 165, 0' },
            'Helium': { subtype: 'Helium', color: '240, 248, 255' },
            'Hycean': { subtype: 'Hycean', color: '0, 206, 209' },
            'Ice Giant': { subtype: 'Ice Giant', color: '0, 191, 255' },
            'Ice': { subtype: 'Ice', color: '135, 206, 235' },
            'Iron': { subtype: 'Iron', color: '169, 169, 169' },
            'Lava': { subtype: 'Lava', color: '255, 0, 0' },
            'Ocean': { subtype: 'Ocean', color: '0, 105, 148' },
            'Protoplanet': { subtype: 'Protoplanet', color: '139, 136, 120' },
            'Puffy': { subtype: 'Puffy', color: '221, 160, 221' },
            'Super-puff': { subtype: 'Super-puff', color: '238, 130, 238' },
            'Silicate': { subtype: 'Silicate', color: '192, 192, 192' },
            'Terrestrial': { subtype: 'Terrestrial', color: '0, 0, 255' }
        }
    },
    'satellite': { type: 'satellite', color: '128, 128, 128' },
    'comet': { type: 'comet', color: '255, 255, 255' },
    'asteroid': { type: 'asteroid', color: '139, 69, 19' }
};

class Star {
    constructor(size, depth, x, y) {
        this.size = size;
        this.depth = depth;
        this.x = x;
        this.y = y;
    }

    getScreenPosition(cameraX, cameraY) {
        const x = this.x - cameraX * this.depth;
        const y = this.y - cameraY * this.depth;
        return { 'x': x, 'y': y };
    }

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
        const absShipVelocityX = Math.abs(shipVelocityX);
        const absShipVelocityY = Math.abs(shipVelocityY);
        let spawnDirection = 0;
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
            loopLimit--;
        } while (newX < visibleRight && newX > visibleLeft && newY < visibleBottom && newY > visibleTop && loopLimit > 0);

        star.setScreenPosition(cameraX, cameraY, newX, newY);
        return { 'x': newX, 'y': newY };
    }

    draw(context, cameraX, cameraY, shipVelocityX, shipVelocityY) {
        context.save();
        this.stars.forEach(star => {
            let screenPosition = star.getScreenPosition(cameraX, cameraY);
            if (Math.abs(screenPosition.x) > this.width / 2 || Math.abs(screenPosition.y) > this.height / 2) {
                screenPosition = this.repositionStar(star, cameraX, cameraY, shipVelocityX, shipVelocityY);
            }
            context.fillStyle = 'white';
            context.fillRect(screenPosition.x + (context.canvas.width / 2), screenPosition.y + (context.canvas.height / 2), star.size, star.size);
        });
        context.restore();
    }
}

class CelestialBody {
    constructor(distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '') {
        this.distance = distance;
        this.radius = radius;
        this.color = color;
        this.parent = parent;
        this.angle = angle;
        this.type = type;
        this.subtype = subtype;
        this.name = name;
        this.x = parent ? parent.x + Math.cos(angle) * distance : Math.cos(angle) * distance;
        this.y = parent ? parent.y + Math.sin(angle) * distance : Math.sin(angle) * distance;
    }

    draw(context, cameraX, cameraY, shipX, shipY) {
        context.save();
        const screenX = this.x - cameraX;
        const screenY = this.y - cameraY;

        // Calculate direction to Sun (0, 0)
        const sunAngle = Math.atan2(-this.y, -this.x);
        const lightX = screenX + Math.cos(sunAngle) * this.radius * 0.7;
        const lightY = screenY + Math.sin(sunAngle) * this.radius * 0.7;

        // Use RGB color directly
        const baseColor = this.color;

        // Create radial gradient for non-stars
        let fillStyle = `rgb(${baseColor})`;
        if (this.type.type !== 'star') {
            const gradient = context.createRadialGradient(
                lightX, lightY, 0,           // Bright center
                screenX, screenY, this.radius * 3 // Extended dark edge
            );
            gradient.addColorStop(0, `rgb(${baseColor})`); // Fully bright
            gradient.addColorStop(1, `rgb(0, 0, 0)`);      // Fully black
            fillStyle = gradient;
        }

        // Draw body
        context.beginPath();
        context.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        context.fillStyle = fillStyle;
        context.fill();
        context.closePath();

        // Display name if ship is within 500px
        const distanceToShip = Math.sqrt((this.x - shipX) ** 2 + (this.y - shipY) ** 2);
        if (distanceToShip < 500) {
            context.fillStyle = 'white';
            context.font = '16px Arial';
            context.textAlign = 'center';
            context.fillText(this.name, screenX, screenY + this.radius + 20);
        }

        context.restore();
    }
}

class HeadsUpDisplay {
    constructor(ship, celestialBodies, canvasWidth, canvasHeight) {
        this.ship = ship;
        this.celestialBodies = celestialBodies;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.ringRadius = Math.min(canvasWidth, canvasHeight) / 3;
    }

    resize(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.ringRadius = Math.min(canvasWidth, canvasHeight) / 3;
    }

    draw(context, cameraX, cameraY) {
        const centerX = this.canvasWidth / 2;
        const centerY = this.canvasHeight / 2;

        context.save();
        context.beginPath();
        context.arc(centerX, centerY, this.ringRadius, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        context.lineWidth = 2;
        context.stroke();
        context.closePath();

        this.celestialBodies.forEach(body => {
            const dx = body.x - this.ship.x;
            const dy = body.y - this.ship.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const screenX = body.x - cameraX;
            const screenY = body.y - cameraY;

            if (screenX < 0 || screenX > this.canvasWidth || screenY < 0 || screenY > this.canvasHeight) {
                const angle = Math.atan2(dy, dx);
                const arrowX = centerX + Math.cos(angle) * this.ringRadius;
                const arrowY = centerY + Math.sin(angle) * this.ringRadius;

                const color = body.subtype ? body.subtype.color : body.type.color;
                const opacity = Math.max(0.2, 1 - (distance - 1000) / 7000);
                context.fillStyle = `rgba(${color}, ${opacity})`;

                context.save();
                context.translate(arrowX, arrowY);
                context.rotate(angle);
                context.beginPath();
                context.moveTo(10, 0);
                context.lineTo(-5, 5);
                context.lineTo(-5, -5);
                context.closePath();
                context.fill();
                context.restore();
            }
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
        this.keys = {};
        this.lastTime = performance.now();
        this.resizeCanvas();
        this.starField = new StarField(this.canvas.width * 2, this.canvas.height * 2, this.canvas.width, this.canvas.height, 1000);

        const randomAngle = () => Math.random() * Math.PI * 2;
        this.celestialBodies = [
            new CelestialBody(0, 100, '255, 255, 0', null, 0, celestialTypes['star'], null, 'Sun'),
            new CelestialBody(800, 20, '139, 69, 19', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Iron'], 'Mercury'),
            new CelestialBody(1400, 30, '255, 215, 0', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Venus'),
            new CelestialBody(2000, 34, '0, 183, 235', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Earth'),
            new CelestialBody(2800, 24, '255, 69, 0', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Mars'),
            new CelestialBody(4000, 60, '218, 165, 32', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Jupiter'),
            new CelestialBody(5600, 50, '244, 164, 96', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Saturn'),
            new CelestialBody(7200, 40, '135, 206, 235', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Uranus'),
            new CelestialBody(8000, 40, '0, 0, 139', null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Neptune')
        ];

        const earth = this.celestialBodies[3];
        const jupiter = this.celestialBodies[5];

        const saturn = this.celestialBodies[6];
        this.celestialBodies.push(
            new CelestialBody(60, 8, '211, 211, 211', earth, randomAngle(), celestialTypes['satellite'], null, 'Moon'),
            new CelestialBody(120, 12, '192, 192, 192', jupiter, randomAngle(), celestialTypes['satellite'], null, 'Ganymede'),
            new CelestialBody(100, 10, '240, 230, 140', saturn, randomAngle(), celestialTypes['satellite'], null, 'Titan')
        );

        this.ship = new Ship(earth.x + 50, earth.y);
        this.hud = new HeadsUpDisplay(this.ship, this.celestialBodies, this.canvas.width, this.canvas.height);

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
        if (this.hud) {
            this.hud.resize(this.canvas.width, this.canvas.height);
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
        this.celestialBodies.forEach(body => body.draw(this.context, cameraX, cameraY, this.ship.x, this.ship.y));
        this.hud.draw(this.context, cameraX, cameraY);
        this.ship.draw(this.context, cameraX, cameraY);
    }
}

new Game();