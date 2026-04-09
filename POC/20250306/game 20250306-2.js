class Camera {
    constructor(targetPosition, screenWidth, screenHeight, zoom = 1) {
        this.position = new Vector2D(targetPosition.x, targetPosition.y); // World-space center
        this.zoom = zoom; // 1 = 100%, 0.5 = 50% (larger), 5 = 500% (smaller)
        this.screenSize = new Vector2D(screenWidth, screenHeight);
        this.worldSize = new Vector2D(screenWidth / zoom, screenHeight / zoom);
    }

    update(targetPosition) {
        this.position.x = targetPosition.x; // Directly set to center
        this.position.y = targetPosition.y;
    }

    resize(screenWidth, screenHeight) {
        this.screenSize.width = screenWidth;
        this.screenSize.height = screenHeight;
        this.worldSize.x = screenWidth / this.zoom;
        this.worldSize.y = screenHeight / this.zoom;
    }

    setZoom(newZoom) {
        this.zoom = Math.max(0.5, Math.min(5, newZoom));
        this.worldSize.x = this.screenSize.width / this.zoom;
        this.worldSize.y = this.screenSize.height / this.zoom;
    }

    setCenterWorld(x, y) {
        this.position.x = x;
        this.position.y = y;
    }

    getCenterScreen() {
        return new Vector2D(
            this.screenSize.width / 2,
            this.screenSize.height / 2
        );
    }

    worldToScreen(worldPos) {
        const centerScreen = this.getCenterScreen();
        const dx = (worldPos.x - this.position.x) * this.zoom;
        const dy = (worldPos.y - this.position.y) * this.zoom;
        return new Vector2D(
            centerScreen.x + dx,
            centerScreen.y + dy
        );
    }

    worldSizeToScreen(worldSize) {
        return worldSize * this.zoom;
    }
}

class Colour {
    constructor(r, g, b, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    toRGB() {
        const r = Math.round(this.r * 255);
        const g = Math.round(this.g * 255);
        const b = Math.round(this.b * 255);
        return `rgb(${r}, ${g}, ${b})`;
    }

    toRGBA() {
        const r = Math.round(this.r * 255);
        const g = Math.round(this.g * 255);
        const b = Math.round(this.b * 255);
        return `rgba(${r}, ${g}, ${b}, ${this.a})`;
    }

    toHex() {
        const toHex = (value) => {
            const hex = Math.round(value * 255).toString(16).padStart(2, '0');
            return hex.length === 2 ? hex : '00';
        };
        return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}`;
    }

    toHexAlpha() {
        const toHex = (value) => {
            const hex = Math.round(value * 255).toString(16).padStart(2, '0');
            return hex.length === 2 ? hex : '00';
        };
        return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}${toHex(this.a)}`;
    }
}

const celestialTypes = {
    'star': { type: 'star', color: new Colour(1, 1, 0) },
    'planet': {
        type: 'planet', color: new Colour(0, 0, 1), subtypes: {
            'Chthonian': { subtype: 'Chthonian', color: new Colour(1, 0.27, 0) },
            'Carbon': { subtype: 'Carbon', color: new Colour(0.41, 0.41, 0.41) },
            'Desert': { subtype: 'Desert', color: new Colour(0.96, 0.64, 0.38) },
            'Gas Dwarf': { subtype: 'Gas Dwarf', color: new Colour(0.68, 0.85, 0.90) },
            'Gas Giant': { subtype: 'Gas Giant', color: new Colour(1, 0.65, 0) },
            'Helium': { subtype: 'Helium', color: new Colour(0.94, 0.97, 1) },
            'Hycean': { subtype: 'Hycean', color: new Colour(0, 0.81, 0.82) },
            'Ice Giant': { subtype: 'Ice Giant', color: new Colour(0, 0.75, 1) },
            'Ice': { subtype: 'Ice', color: new Colour(0.53, 0.81, 0.92) },
            'Iron': { subtype: 'Iron', color: new Colour(0.66, 0.66, 0.66) },
            'Lava': { subtype: 'Lava', color: new Colour(1, 0, 0) },
            'Ocean': { subtype: 'Ocean', color: new Colour(0, 0.41, 0.58) },
            'Protoplanet': { subtype: 'Protoplanet', color: new Colour(0.55, 0.53, 0.47) },
            'Puffy': { subtype: 'Puffy', color: new Colour(0.87, 0.63, 0.87) },
            'Super-puff': { subtype: 'Super-puff', color: new Colour(0.93, 0.51, 0.93) },
            'Silicate': { subtype: 'Silicate', color: new Colour(0.75, 0.75, 0.75) },
            'Terrestrial': { subtype: 'Terrestrial', color: new Colour(0, 0, 1) }
        }
    },
    'satellite': { type: 'satellite', color: new Colour(0.5, 0.5, 0.5) },
    'comet': { type: 'comet', color: new Colour(1, 1, 1) },
    'asteroid': { type: 'asteroid', color: new Colour(0.55, 0.27, 0.07) }
};

class Vector2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    get width() { return this.x; }
    set width(value) { this.x = value; }

    get height() { return this.y; }
    set height(value) { this.y = value; }
}

class Star {
    constructor(size, depth, x, y) {
        this.size = size;
        this.depth = depth;
        this.position = new Vector2D(x, y);
    }
}

class StarField {
    constructor(camera, numberOfStars) {
        this.numberOfStars = numberOfStars;
        this.size = new Vector2D(camera.screenSize.width * 2, camera.screenSize.height * 2);
        this.visibleSize = new Vector2D(camera.screenSize.width, camera.screenSize.height);
        this.stars = [];
        for (let i = 0; i < this.numberOfStars; i++) {
            const magnitude = Math.pow(Math.random(), 20);
            const size = this.remapRange01(magnitude, 1, 3);
            const depth = this.remapRange01(magnitude, 0.01, 0.9);
            const cameraX = this.size.width * (Math.random() - 0.5);
            const cameraY = this.size.height * (Math.random() - 0.5);
            const star = new Star(size, depth, 0, 0);
            this.setStarPositionCameraSpace(camera, star, cameraX, cameraY);
            this.stars.push(star);
        }
    }

    getStarPositionCameraSpace(camera, star) {
        const dx = (star.position.x - camera.position.x) * star.depth;
        const dy = (star.position.y - camera.position.y) * star.depth;
        const cameraPos = new Vector2D(dx, dy);
        return cameraPos;
    }

    setStarPositionCameraSpace(camera, star, cameraX, cameraY) {
        const worldX = cameraX / star.depth + camera.position.x;
        const worldY = cameraY / star.depth + camera.position.y;
        star.position.x = worldX;
        star.position.y = worldY;
    }

    resize(width, height, visibleWidth, visibleHeight) {
        this.size.width = width;
        this.size.height = height;
        this.visibleSize.width = visibleWidth;
        this.visibleSize.height = visibleHeight;
    }

    remapRange01(numberIn, rangeOutMin, rangeOutMax) {
        return (numberIn * (rangeOutMax - rangeOutMin)) + rangeOutMin;
    }

    randomBetween(rangeOutMin, rangeOutMax) {
        return (Math.random() * (rangeOutMax - rangeOutMin)) + rangeOutMin;
    }

    repositionStar(star, camera, shipVelocity) {
        const absShipVelocityX = Math.abs(shipVelocity.x);
        const absShipVelocityY = Math.abs(shipVelocity.y);
        let spawnDirection = 0;
        if (absShipVelocityX < 0.01 && absShipVelocityY < 0.01) {
            spawnDirection = Math.round(this.randomBetween(1, 4));
        } else if (absShipVelocityY < 0.01 || (absShipVelocityX / absShipVelocityY) > 2.5) {
            spawnDirection = shipVelocity.x > 0 ? 2 : 4;
        } else if (absShipVelocityX < 0.01 || (absShipVelocityY / absShipVelocityX) > 2.5) {
            spawnDirection = shipVelocity.y > 0 ? 3 : 1;
        } else {
            if (Math.random() > 0.5) {
                spawnDirection = shipVelocity.x > 0 ? 2 : 4;
            } else {
                spawnDirection = shipVelocity.y > 0 ? 3 : 1;
            }
        }

        const visibleLeft = -this.visibleSize.width / 2;
        const visibleRight = this.visibleSize.width / 2;
        const visibleTop = -this.visibleSize.height / 2;
        const visibleBottom = this.visibleSize.height / 2;

        const maxLeft = -this.size.width / 2;
        const maxRight = this.size.width / 2;
        const maxTop = -this.size.height / 2;
        const maxBottom = this.size.height / 2;

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

        this.setStarPositionCameraSpace(camera, star, newX, newY);
        return new Vector2D(newX, newY);
    }

    draw(context, camera, shipVelocity) {
        context.save();
        context.fillStyle = 'white';
        const centerScreen = camera.getCenterScreen();
        const halfSizeX = this.size.x / 2;
        const halfSizeY = this.size.y / 2;
        this.stars.forEach(star => {
            let cameraPosition = this.getStarPositionCameraSpace(camera, star);
            if (Math.abs(cameraPosition.x) > halfSizeX || Math.abs(cameraPosition.y) > halfSizeY) {
                cameraPosition = this.repositionStar(star, camera, shipVelocity);
            }
            const screenX = cameraPosition.x + centerScreen.x;
            const screenY = cameraPosition.y + centerScreen.y;
            if (screenX >= 0 && screenX < camera.screenSize.width && screenY >= 0 && screenY < camera.screenSize.height) {
                context.fillRect(screenX, screenY, star.size, star.size);
            }
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
        this.position = parent
            ? new Vector2D(parent.position.x + Math.cos(angle) * distance, parent.position.y + Math.sin(angle) * distance)
            : new Vector2D(Math.cos(angle) * distance, Math.sin(angle) * distance);
    }

    draw(context, camera, shipPosition) {
        context.save();
        const screenPos = camera.worldToScreen(this.position);
        const screenX = screenPos.x;
        const screenY = screenPos.y;
        const scaledRadius = camera.worldSizeToScreen(this.radius);

        const sunAngle = Math.atan2(-this.position.y, -this.position.x);
        const lightX = screenX + Math.cos(sunAngle) * scaledRadius * 0.7;
        const lightY = screenY + Math.sin(sunAngle) * scaledRadius * 0.7;

        let fillStyle = this.color.toRGB();
        if (this.type.type !== 'star') {
            const gradient = context.createRadialGradient(
                lightX, lightY, 0,
                screenX, screenY, scaledRadius * 3
            );
            gradient.addColorStop(0, this.color.toRGB());
            gradient.addColorStop(1, 'rgb(0, 0, 0)');
            fillStyle = gradient;
        }

        context.beginPath();
        context.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
        context.fillStyle = fillStyle;
        context.fill();
        context.closePath();

        const distanceToShip = Math.sqrt((this.position.x - shipPosition.x) ** 2 + (this.position.y - shipPosition.y) ** 2);
        if (distanceToShip < 500) {
            context.fillStyle = 'white';
            context.font = `${camera.worldSizeToScreen(16)}px Arial`;
            context.textAlign = 'center';
            context.fillText(this.name, screenX, screenY + scaledRadius + camera.worldSizeToScreen(20));
        }

        context.restore();
    }
}

class HeadsUpDisplay {
    constructor(ship, celestialBodies, canvasWidth, canvasHeight) {
        this.ship = ship;
        this.celestialBodies = celestialBodies;
        this.size = new Vector2D(canvasWidth, canvasHeight);
        this.ringRadius = Math.min(canvasWidth, canvasHeight) / 3;
    }

    resize(canvasWidth, canvasHeight) {
        this.size.width = canvasWidth;
        this.size.height = canvasHeight;
        this.ringRadius = Math.min(this.size.width, this.size.height) / 3;
    }

    draw(context, camera) {
        const center = camera.getCenterScreen();
        const centerX = center.x;
        const centerY = center.y;

        context.save();
        context.beginPath();
        context.arc(centerX, centerY, this.ringRadius, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        context.lineWidth = 2;
        context.stroke();
        context.closePath();

        this.celestialBodies.forEach(body => {
            const dx = body.position.x - this.ship.position.x;
            const dy = body.position.y - this.ship.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const screenPos = camera.worldToScreen(body.position);
            const screenX = screenPos.x;
            const screenY = screenPos.y;

            if (screenX < 0 || screenX > camera.screenSize.width || screenY < 0 || screenY > camera.screenSize.height) {
                const angle = Math.atan2(dy, dx);
                const arrowX = centerX + Math.cos(angle) * this.ringRadius;
                const arrowY = centerY + Math.sin(angle) * this.ringRadius;

                const color = body.subtype ? body.subtype.color : body.type.color;
                const opacity = Math.max(0.2, 1 - (distance - 1000) / 7000);
                context.fillStyle = color.toRGB(); // Base color without alpha
                context.globalAlpha = opacity; // Set opacity for this arrow

                context.save();
                context.translate(arrowX, arrowY);
                context.rotate(angle);
                context.beginPath();
                context.moveTo(10, 0);
                context.lineTo(-5, 5);
                context.lineTo(-5, -5);
                context.closePath();
                context.fill();
                context.restore(); // Resets globalAlpha to 1.0
            }
        });

        context.restore(); // Resets any outer state
    }
}

class Ship {
    constructor(x, y) {
        this.position = new Vector2D(x, y);
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.rotationSpeed = 0.05;
        this.thrust = 0.1;
        this.maxVelocity = 5;
        this.drag = 0.005;
        this.brakeDrag = 0.01;
    }

    move(keys, deltaTime) {
        const dt = deltaTime / 16.67;

        // Rotation
        if (keys.ArrowLeft) {
            this.angle -= this.rotationSpeed * dt;
        }
        if (keys.ArrowRight) {
            this.angle += this.rotationSpeed * dt;
        }

        // Wrap angle between -π and +π
        this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;

        // Thrust (Up arrow)
        if (keys.ArrowUp) {
            const thrustX = Math.cos(this.angle) * this.thrust * dt;
            const thrustY = Math.sin(this.angle) * this.thrust * dt;
            this.velocity.x += thrustX;
            this.velocity.y += thrustY;
        }

        // Brake and rotate (Down arrow)
        if (keys.ArrowDown) {
            const currentDrag = this.brakeDrag;
            this.velocity.x -= this.velocity.x * currentDrag * dt;
            this.velocity.y -= this.velocity.y * currentDrag * dt;

            const velocityAngle = Math.atan2(-this.velocity.y, -this.velocity.x);
            const angleDiff = (velocityAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle += angleDiff * this.rotationSpeed * dt;
            // Wrap again after Down adjustment
            this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
        } else {
            const currentDrag = this.drag;
            this.velocity.x -= this.velocity.x * currentDrag * dt;
            this.velocity.y -= this.velocity.y * currentDrag * dt;
        }

        // Cap velocity magnitude
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        if (speed > this.maxVelocity) {
            const scale = this.maxVelocity / speed;
            this.velocity.x *= scale;
            this.velocity.y *= scale;
        }

        // Update position
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
    }

    draw(context, camera) {
        context.save();
        const screenPos = camera.worldToScreen(this.position);
        context.translate(screenPos.x, screenPos.y);
        context.rotate(this.angle);
        context.fillStyle = 'white';
        context.beginPath();
        const scale = camera.zoom;
        context.moveTo(15 * scale, 0);
        context.lineTo(-10 * scale, 10 * scale);
        context.lineTo(-10 * scale, -10 * scale);
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
        this.canvasSize = new Vector2D(window.innerWidth, window.innerHeight);
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;

        const randomAngle = () => Math.random() * Math.PI * 2;
        this.celestialBodies = [
            new CelestialBody(0, 100, new Colour(1, 1, 0), null, 0, celestialTypes['star'], null, 'Sun'),
            new CelestialBody(800, 20, new Colour(0.55, 0.27, 0.07), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Iron'], 'Mercury'),
            new CelestialBody(1400, 30, new Colour(1, 0.84, 0), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Venus'),
            new CelestialBody(2000, 34, new Colour(0, 0.72, 0.92), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Earth'),
            new CelestialBody(2800, 24, new Colour(1, 0.27, 0), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Mars'),
            new CelestialBody(4000, 60, new Colour(0.85, 0.65, 0.13), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Jupiter'),
            new CelestialBody(5600, 50, new Colour(0.96, 0.64, 0.38), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Saturn'),
            new CelestialBody(7200, 40, new Colour(0.53, 0.81, 0.92), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Uranus'),
            new CelestialBody(8000, 40, new Colour(0, 0, 0.55), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Neptune')
        ];
        const earth = this.celestialBodies[3];
        const jupiter = this.celestialBodies[5];
        const saturn = this.celestialBodies[6];
        this.celestialBodies.push(
            new CelestialBody(60, 8, new Colour(0.83, 0.83, 0.83), earth, randomAngle(), celestialTypes['satellite'], null, 'Moon'),
            new CelestialBody(120, 12, new Colour(0.75, 0.75, 0.75), jupiter, randomAngle(), celestialTypes['satellite'], null, 'Ganymede'),
            new CelestialBody(100, 10, new Colour(0.94, 0.90, 0.55), saturn, randomAngle(), celestialTypes['satellite'], null, 'Titan')
        );

        this.ship = new Ship(earth.position.x + 50, earth.position.y);
        this.camera = new Camera(this.ship.position, this.canvasSize.width, this.canvasSize.height);
        this.starField = new StarField(this.camera, 1000);
        this.hud = new HeadsUpDisplay(this.ship, this.celestialBodies, this.canvasSize.width, this.canvasSize.height);
        this.zoomTextTimer = 0;

        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
        window.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        window.addEventListener('wheel', (e) => {
            const zoomStep = 0.1;
            this.camera.setZoom(this.camera.zoom + (e.deltaY < 0 ? zoomStep : -zoomStep));
            this.zoomTextTimer = 120;
        });

        this.start();
    }

    resizeCanvas() {
        this.canvasSize.width = window.innerWidth;
        this.canvasSize.height = window.innerHeight;
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;
        this.camera.resize(this.canvasSize.width, this.canvasSize.height);
        this.starField.resize(this.canvasSize.width * 2, this.canvasSize.height * 2, this.canvasSize.width, this.canvasSize.height);
        this.hud.resize(this.canvasSize.width, this.canvasSize.height);
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
        this.camera.update(this.ship.position);
        if (this.zoomTextTimer > 0) {
            this.zoomTextTimer -= deltaTime / 16.67;
        }
    }

    render() {
        this.context.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.starField.draw(this.context, this.camera, this.ship.velocity);
        this.celestialBodies.forEach(body => body.draw(this.context, this.camera, this.ship.position));
        this.hud.draw(this.context, this.camera);
        this.ship.draw(this.context, this.camera);

        if (this.zoomTextTimer > 0) {
            this.context.save();
            this.context.fillStyle = 'white';
            this.context.font = '20px Arial';
            this.context.textAlign = 'right';
            const zoomPercent = Math.round(this.camera.zoom * 100);
            this.context.fillText(`${zoomPercent}%`, this.canvasSize.width - 10, 30);
            this.context.restore();
        }
    }
}
new Game();
