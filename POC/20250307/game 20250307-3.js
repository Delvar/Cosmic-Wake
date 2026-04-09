class Camera {
    constructor(pos, width, height, zoom = 1) {
        this.pos = new Vector2D(pos.x, pos.y); // World-space center
        this.zoom = zoom;
        this.screenSize = new Vector2D(width, height);
        this.worldSize = new Vector2D(width / zoom, height / zoom);
    }

    update(pos) {
        this.pos.x = pos.x;
        this.pos.y = pos.y;
    }

    resize(width, height) {
        this.screenSize.width = width;
        this.screenSize.height = height;
        this.worldSize.x = width / this.zoom;
        this.worldSize.y = height / this.zoom;
    }

    setZoom(zoom) {
        this.zoom = Math.max(0.5, Math.min(5, zoom));
        this.worldSize.x = this.screenSize.width / this.zoom;
        this.worldSize.y = this.screenSize.height / this.zoom;
    }

    setCenter(x, y) {
        this.pos.x = x;
        this.pos.y = y;
    }

    getScreenCenter() {
        return new Vector2D(this.screenSize.width / 2, this.screenSize.height / 2);
    }

    worldToScreen(pos) {
        const center = this.getScreenCenter();
        const dx = (pos.x - this.pos.x) * this.zoom;
        const dy = (pos.y - this.pos.y) * this.zoom;
        return new Vector2D(center.x + dx, center.y + dy);
    }

    worldToSize(size) {
        return size * this.zoom;
    }

    worldToCamera(pos) {
        const dx = (pos.x - this.pos.x) * this.zoom;
        const dy = (pos.y - this.pos.y) * this.zoom;
        return new Vector2D(dx, dy);
    }

    cameraToScreen(pos) {
        const center = this.getScreenCenter();
        return new Vector2D(center.x + pos.x, center.y + pos.y);
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
    'asteroid': { type: 'asteroid', color: new Colour(0.55, 0.27, 0.07) },
    'jumpgate': { type: 'jumpgate', color: new Colour(0, 1, 0) }
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
        this.pos = new Vector2D(x, y);
    }
}

class StarField {
    constructor(cam, numberOfStars) {
        this.numberOfStars = numberOfStars;
        this.size = new Vector2D(cam.screenSize.width * 2, cam.screenSize.height * 2);
        this.stars = [];
        for (let i = 0; i < this.numberOfStars; i++) {
            const magnitude = Math.pow(Math.random(), 20);
            const size = this.remapRange01(magnitude, 1, 3);
            const depth = this.remapRange01(magnitude, 0.01, 0.9);
            const camX = this.size.width * (Math.random() - 0.5);
            const camY = this.size.height * (Math.random() - 0.5);
            const star = new Star(size, depth, 0, 0);
            this.setStarPositionCameraSpace(cam, star, camX, camY);
            this.stars.push(star);
        }
    }

    getStarPositionCameraSpace(cam, star) {
        const dx = (star.pos.x - cam.pos.x) * star.depth;
        const dy = (star.pos.y - cam.pos.y) * star.depth;
        return new Vector2D(dx, dy);
    }

    setStarPositionCameraSpace(cam, star, camX, camY) {
        const worldX = camX / star.depth + cam.pos.x;
        const worldY = camY / star.depth + cam.pos.y;
        star.pos.x = worldX;
        star.pos.y = worldY;
    }

    resize(width, height) {
        this.size.width = width * 2;
        this.size.height = height * 2;
    }

    remapRange01(numberIn, rangeOutMin, rangeOutMax) {
        return (numberIn * (rangeOutMax - rangeOutMin)) + rangeOutMin;
    }

    randomBetween(rangeOutMin, rangeOutMax) {
        return (Math.random() * (rangeOutMax - rangeOutMin)) + rangeOutMin;
    }

    repositionStar(star, cam, velocity) {
        const absVelocityX = Math.abs(velocity.x);
        const absVelocityY = Math.abs(velocity.y);
        let spawnDirection = 0;
        if (absVelocityX < 0.01 && absVelocityY < 0.01) {
            spawnDirection = Math.round(this.randomBetween(1, 4));
        } else if (absVelocityY < 0.01 || (absVelocityX / absVelocityY) > 2.5) {
            spawnDirection = velocity.x > 0 ? 2 : 4;
        } else if (absVelocityX < 0.01 || (absVelocityY / absVelocityX) > 2.5) {
            spawnDirection = velocity.y > 0 ? 3 : 1;
        } else {
            if (Math.random() > 0.5) {
                spawnDirection = velocity.x > 0 ? 2 : 4;
            } else {
                spawnDirection = velocity.y > 0 ? 3 : 1;
            }
        }

        const visibleLeft = -cam.screenSize.width / 2;
        const visibleRight = cam.screenSize.width / 2;
        const visibleTop = -cam.screenSize.height / 2;
        const visibleBottom = cam.screenSize.height / 2;

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

        this.setStarPositionCameraSpace(cam, star, newX, newY);
        return new Vector2D(newX, newY);
    }

    draw(ctx, cam, velocity) {
        ctx.save();
        ctx.fillStyle = 'white';
        const halfX = this.size.x / 2;
        const halfY = this.size.y / 2;
        this.stars.forEach(star => {
            let camPos = this.getStarPositionCameraSpace(cam, star);
            if (Math.abs(camPos.x) > halfX || Math.abs(camPos.y) > halfY) {
                camPos = this.repositionStar(star, cam, velocity);
            }
            const screenPos = cam.cameraToScreen(camPos);
            if (screenPos.x >= 0 && screenPos.x < cam.screenSize.width && screenPos.y >= 0 && screenPos.y < cam.screenSize.height) {
                ctx.fillRect(screenPos.x, screenPos.y, star.size, star.size);
            }
        });
        ctx.restore();
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
        this.pos = parent
            ? new Vector2D(parent.pos.x + Math.cos(angle) * distance, parent.pos.y + Math.sin(angle) * distance)
            : new Vector2D(Math.cos(angle) * distance, Math.sin(angle) * distance);
    }

    draw(context, cam) {
        context.save();
        const screenPos = cam.worldToScreen(this.pos);
        const screenX = screenPos.x;
        const screenY = screenPos.y;
        const scaledRadius = cam.worldToSize(this.radius);

        const sunAngle = Math.atan2(-this.pos.y, -this.pos.x);
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

        context.restore();
    }
}

class JumpGate extends CelestialBody {
    constructor(lane, sysPos) {
        const dir = new Vector2D(lane.target.pos.x - sysPos.x, lane.target.pos.y - sysPos.y);
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const norm = new Vector2D(dir.x / mag, dir.y / mag);
        const radius = 50;
        const dist = 1000;
        super(dist, radius, celestialTypes['jumpgate'].color, null, Math.atan2(norm.y, norm.x), celestialTypes['jumpgate'], null, `Jump To ${lane.target.name}`);
        this.lane = lane;
    }

    draw(ctx, cam) {
        ctx.save();
        const pos = cam.worldToScreen(this.pos);
        const radius = cam.worldToSize(this.radius);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color.toRGB();
        ctx.lineWidth = cam.worldToSize(5);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }

    isShipOverlapping(shipPos) {
        const dx = this.pos.x - shipPos.x;
        const dy = this.pos.y - shipPos.y;
        const distSquared = dx * dx + dy * dy;
        return distSquared < this.radius * this.radius;
    }
}

class Hyperlane {
    constructor(source, target) {
        this.source = source;
        this.target = target;
        this.distSquared = this.calculateDistSquared();
    }

    calculateDistSquared() {
        const dx = this.target.pos.x - this.source.pos.x;
        const dy = this.target.pos.y - this.source.pos.y;
        return dx * dx + dy * dy;
    }
}

class StarSystem {
    constructor(id, name, pos, bodies = [], ships = []) {
        this.id = id;
        this.name = name;
        this.pos = new Vector2D(pos.x, pos.y);
        this.bodies = bodies;
        this.ships = ships;
        this.hyperlanes = [];
    }

    addHyperlane(targetSystem) {
        const lane = new Hyperlane(this, targetSystem);
        this.hyperlanes.push(lane);
        targetSystem.hyperlanes.push(new Hyperlane(targetSystem, this)); // Reverse lane
    }

    initializeJumpGates() {
        this.hyperlanes.forEach(lane => {
            if (lane.source === this) {
                this.bodies.push(new JumpGate(lane, this.pos));
            }
        });
    }
}

class HeadsUpDisplay {
    constructor(ship, bodies, width, height) {
        this.ship = ship;
        this.bodies = bodies;
        this.size = new Vector2D(width, height);
        this.ringRadius = Math.min(width, height) / 3;
        this.gateRingRadius = Math.min(width, height) / 2.5;
    }

    resize(width, height) {
        this.size.width = width;
        this.size.height = height;
        this.ringRadius = Math.min(width, height) / 3;
        this.gateRingRadius = Math.min(width, height) / 2.5;
    }

    draw(ctx, cam) {
        const center = cam.getScreenCenter();
        ctx.save();

        ctx.beginPath();
        ctx.arc(center.x, center.y, this.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.arc(center.x, center.y, this.gateRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        const remapClamp = (val, inMin, inMax, outMin, outMax) =>
            Math.min(Math.max((outMax - outMin) * (val - inMin) / (inMax - inMin) + outMin, outMin), outMax);
        const maxRadius = 5000;

        this.bodies.forEach(body => {
            const camPos = cam.worldToCamera(body.pos);
            const distSquared = camPos.x * camPos.x + camPos.y * camPos.y;
            const screenPos = cam.worldToScreen(body.pos);
            const isGate = body instanceof JumpGate;
            const radius = isGate ? this.gateRingRadius : this.ringRadius;

            // Name if within ring (Camera Space)
            if (distSquared < radius * radius && body.name) {
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'white';
                ctx.font = `${cam.worldToSize(16)}px Arial`;
                ctx.textAlign = 'center';
                const scaledRadius = cam.worldToSize(body.radius);
                ctx.fillText(body.name, screenPos.x, screenPos.y + scaledRadius + cam.worldToSize(20));
                ctx.restore();
            }

            // Arrow if outside ring and not over maxRadius
            if ((distSquared > radius * radius) && (distSquared < maxRadius * maxRadius)) {
                const angle = Math.atan2(camPos.y, camPos.x);
                const arrowX = center.x + Math.cos(angle) * radius;
                const arrowY = center.y + Math.sin(angle) * radius;
                const color = body.subtype ? body.subtype.color : body.type.color;
                const ringDist = Math.sqrt(distSquared) - radius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.fillStyle = color.toRGB();
                ctx.globalAlpha = opacity;
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(-5, 5);
                ctx.lineTo(-5, -5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        });

        ctx.restore();
    }
}

class Ship {
    constructor(x, y) {
        this.pos = new Vector2D(x, y);
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.rotationSpeed = 0.05;
        this.thrust = 0.1;
        this.maxVelocity = 5;
        this.drag = 0.005;
        this.brakeDrag = 0.01;
        this.hyperdriveReady = true;
        this.hyperdriveCooldown = 5000;
        this.lastJumpTime = 0;
    }

    move(keys, deltaTime) {
        const dt = deltaTime / 16.67;
        if (keys.ArrowLeft) this.angle -= this.rotationSpeed * dt;
        if (keys.ArrowRight) this.angle += this.rotationSpeed * dt;
        this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
        if (keys.ArrowUp) {
            const thrustX = Math.cos(this.angle) * this.thrust * dt;
            const thrustY = Math.sin(this.angle) * this.thrust * dt;
            this.velocity.x += thrustX;
            this.velocity.y += thrustY;
        }
        if (keys.ArrowDown) {
            const drag = this.brakeDrag;
            this.velocity.x -= this.velocity.x * drag * dt;
            this.velocity.y -= this.velocity.y * drag * dt;
            const velAngle = Math.atan2(-this.velocity.y, -this.velocity.x);
            const angleDiff = (velAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle += angleDiff * this.rotationSpeed * dt;
            this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
        } else {
            const drag = this.drag;
            this.velocity.x -= this.velocity.x * drag * dt;
            this.velocity.y -= this.velocity.y * drag * dt;
        }
        const speedSquared = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
        if (speedSquared > this.maxVelocity * this.maxVelocity) {
            const scale = this.maxVelocity / Math.sqrt(speedSquared);
            this.velocity.x *= scale;
            this.velocity.y *= scale;
        }
        this.pos.x += this.velocity.x * dt;
        this.pos.y += this.velocity.y * dt;
    }

    initiateHyperjump(targetSystem, currentTime) {
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) {
            console.log("Hyperdrive not ready!");
            return false;
        }
        this.lastJumpTime = currentTime;
        this.hyperdriveReady = false;
        setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
        return true;
    }

    draw(context, cam) {
        context.save();
        const screenPos = cam.worldToScreen(this.pos);
        context.translate(screenPos.x, screenPos.y);
        context.rotate(this.angle);
        context.fillStyle = 'white';
        context.beginPath();
        const scale = cam.zoom;
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

        this.galaxy = this.initializeGalaxy();
        this.currentSystem = this.galaxy[0];
        const earth = this.currentSystem.bodies[3];
        this.playerShip = new Ship(earth.pos.x + 50, earth.pos.y); // Start near Sol's Earth
        this.currentSystem.ships.push(this.playerShip);
        this.cam = new Camera(this.playerShip.pos, this.canvasSize.width, this.canvasSize.height);
        this.starField = new StarField(this.cam, 1000);
        this.hud = new HeadsUpDisplay(this.playerShip, this.currentSystem.bodies, this.canvasSize.width, this.canvasSize.height);
        this.zoomTextTimer = 0;
        this.lastJumpCheck = 0;
        this.jumpCheckInterval = 100;

        // FPS and frame time tracking
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = performance.now();

        window.addEventListener('resize', () => { this.resizeCanvas(); });
        window.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        window.addEventListener('wheel', (e) => {
            const zoomStep = 0.1;
            this.cam.setZoom(this.cam.zoom + (e.deltaY < 0 ? zoomStep : -zoomStep));
            this.zoomTextTimer = 120;
        });

        this.start();
    }

    initializeGalaxy() {
        const randomAngle = () => Math.random() * Math.PI * 2;

        const sol = new StarSystem("sol", "Sol System", new Vector2D(0, 0), [
            new CelestialBody(0, 100, new Colour(1, 1, 0), null, 0, celestialTypes['star'], null, 'Sun'),
            new CelestialBody(800, 20, new Colour(0.55, 0.27, 0.07), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Iron'], 'Mercury'),
            new CelestialBody(1400, 30, new Colour(1, 0.84, 0), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Venus'),
            new CelestialBody(2000, 34, new Colour(0, 0.72, 0.92), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Earth'),
            new CelestialBody(2800, 24, new Colour(1, 0.27, 0), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Terrestrial'], 'Mars'),
            new CelestialBody(4000, 60, new Colour(0.85, 0.65, 0.13), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Jupiter'),
            new CelestialBody(5600, 50, new Colour(0.96, 0.64, 0.38), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Gas Giant'], 'Saturn'),
            new CelestialBody(7200, 40, new Colour(0.53, 0.81, 0.92), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Uranus'),
            new CelestialBody(8000, 40, new Colour(0, 0, 0.55), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice Giant'], 'Neptune')
        ]);
        const earth = sol.bodies[3];
        sol.bodies.push(
            new CelestialBody(60, 8, new Colour(0.83, 0.83, 0.83), earth, randomAngle(), celestialTypes['satellite'], null, 'Moon')
        );

        const alphaCentauri = new StarSystem("alpha-centauri", "Alpha Centauri", new Vector2D(10000, 5000), [
            new CelestialBody(0, 80, new Colour(1, 0.8, 0), null, 0, celestialTypes['star'], null, 'Alpha Centauri A'),
            new CelestialBody(200, 70, new Colour(0.9, 0.6, 0), null, randomAngle(), celestialTypes['star'], null, 'Alpha Centauri B'),
            new CelestialBody(1000, 25, new Colour(0.6, 0.4, 0.2), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Desert'], 'Procyon'),
            new CelestialBody(1500, 30, new Colour(0.5, 0.7, 0.9), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice'], 'Triton')
        ]);

        const proximaCentauri = new StarSystem("proxima-centauri", "Proxima Centauri", new Vector2D(8000, -2000), [
            new CelestialBody(0, 60, new Colour(0.8, 0.2, 0), null, 0, celestialTypes['star'], null, 'Proxima Centauri'),
            new CelestialBody(500, 15, new Colour(0.4, 0.3, 0.2), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Iron'], 'Proxima b'),
            new CelestialBody(800, 20, new Colour(0.5, 0.4, 0.3), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Desert'], 'Proxima c')
        ]);

        sol.addHyperlane(alphaCentauri);
        sol.addHyperlane(proximaCentauri);
        alphaCentauri.addHyperlane(proximaCentauri);

        sol.initializeJumpGates();
        alphaCentauri.initializeJumpGates();
        proximaCentauri.initializeJumpGates();

        return [sol, alphaCentauri, proximaCentauri];
    }

    resizeCanvas() {
        this.canvasSize.width = window.innerWidth;
        this.canvasSize.height = window.innerHeight;
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;
        this.cam.resize(this.canvasSize.width, this.canvasSize.height);
        this.starField.resize(this.canvasSize.width, this.canvasSize.height);
        this.hud.resize(this.canvasSize.width, this.canvasSize.height);
    }

    start() {
        const gameLoop = (currentTime) => {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            this.update(deltaTime);
            this.render(deltaTime); // Pass deltaTime to render
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    }

    update(deltaTime) {
        this.playerShip.move(this.keys, deltaTime);
        this.cam.update(this.playerShip.pos);
        if (this.zoomTextTimer > 0) {
            this.zoomTextTimer -= deltaTime / 16.67;
        }
        const currentTime = performance.now();
        if (this.keys['j'] && currentTime - this.lastJumpCheck > this.jumpCheckInterval) {
            this.tryHyperjump();
            this.lastJumpCheck = currentTime;
        }

        // Update FPS every second
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
    }

    tryHyperjump() {
        const currentTime = performance.now();
        const gate = this.currentSystem.bodies.find(body =>
            body instanceof JumpGate && body.isShipOverlapping(this.playerShip.pos)
        );
        if (gate && this.playerShip.initiateHyperjump(gate.lane.target, currentTime)) {
            const oldSystem = this.currentSystem;
            this.currentSystem = gate.lane.target;
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.playerShip);
            this.currentSystem.ships.push(this.playerShip);
            const targetGate = this.currentSystem.bodies.find(body =>
                body instanceof JumpGate && body.lane.target === oldSystem
            );
            this.playerShip.pos = targetGate ? new Vector2D(targetGate.pos.x, targetGate.pos.y) : new Vector2D(0, 0);
            this.cam.update(this.playerShip.pos);
            this.hud.bodies = this.currentSystem.bodies;
            console.log(`Jumped to ${this.currentSystem.name}`);
        }
    }

    render(deltaTime) {
        this.context.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.starField.draw(this.context, this.cam, this.playerShip.velocity);
        this.currentSystem.bodies.forEach(body => body.draw(this.context, this.cam));
        this.currentSystem.ships.forEach(ship => ship.draw(this.context, this.cam));
        this.hud.draw(this.context, this.cam);

        // FPS and frame time display
        this.context.save();
        this.context.fillStyle = 'white';
        this.context.font = '16px Arial';
        this.context.textAlign = 'left';
        this.context.fillText(`FPS: ${this.fps}`, 10, 20);

        // Frame time bar (scales 0-50ms to 0-150px)
        const maxFrameTime = 50; // 20fps threshold
        const barWidth = Math.min(deltaTime / maxFrameTime, 1) * 150; // Cap at 150px
        this.context.fillStyle = deltaTime > 33.33 ? 'red' : deltaTime > 16.67 ? 'yellow' : 'green';
        this.context.fillRect(10, 25, barWidth, 10);
        this.context.restore();

        if (this.zoomTextTimer > 0) {
            this.context.save();
            this.context.fillStyle = 'white';
            this.context.font = '20px Arial';
            this.context.textAlign = 'right';
            const zoomPercent = Math.round(this.cam.zoom * 100);
            this.context.fillText(`${zoomPercent}%`, this.canvasSize.width - 10, 30);
            this.context.restore();
        }
    }
}

window.game = new Game();