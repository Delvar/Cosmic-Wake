class Trail {
    constructor(owner, maxLength = 250, startWidth = 2, color = 'rgba(255, 255, 255, 0.5)') {
        this.owner = owner;
        this.points = [];
        this.startWidth = startWidth;
        this.currentLength = 0;
        this.softMaxLength = maxLength;
        this.hardMaxLength = maxLength * 1.2;
        this.erosionSpeed = owner.maxVelocity * 0.5;
        this.minPointDist = 5;
        this.maxPointDist = 200;
        this.lateralThreshold = 2;
        this.color = color;
    }

    update(dt) {
        dt = dt / 16.67;

        // Erosion
        if (isNaN(this.currentLength)) {
            this.currentLength = 0;
            console.log('currentLength is NaN');
        }
        if (this.currentLength > this.hardMaxLength) {
            this.currentLength = this.hardMaxLength - this.erosionSpeed;
        } else if (this.currentLength > this.softMaxLength) {
            this.currentLength -= this.erosionSpeed * 2;
        } else if (this.currentLength > 0) {
            const erosionFactor = Math.max(0.25, this.currentLength / this.softMaxLength);
            this.currentLength -= this.erosionSpeed * erosionFactor;
        }
        this.currentLength = Math.max(0, this.currentLength);

        const currentPoint = { x: this.owner.pos.x, y: this.owner.pos.y };

        if (this.points.length < 2) {
            currentPoint.backwards = {
                x: -Math.cos(this.owner.angle),
                y: -Math.sin(this.owner.angle)
            };
            currentPoint.right = {
                x: Math.sin(this.owner.angle),
                y: -Math.cos(this.owner.angle)
            };
            currentPoint.distance = 1;
            this.addPoint(currentPoint);
            return;
        }

        const firstPoint = this.points[0];
        const secondPoint = this.points[1];

        const dx = currentPoint.x - secondPoint.x;
        const dy = currentPoint.y - secondPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let shouldAddPoint = false;

        if (firstPoint.distance > dist + 0.1) {
            shouldAddPoint = true;
        }
        if (dist > this.maxPointDist) {
            shouldAddPoint = true;
        }
        if (dist > this.minPointDist && !shouldAddPoint) {
            if (secondPoint.backwards) {
                const forward = { x: dx / dist, y: dy / dist };
                const dot = (-secondPoint.backwards.x * forward.x) + (-secondPoint.backwards.y * forward.y);
                let minDot = dist <= this.lateralThreshold ? 0 : Math.sqrt(1 - (this.lateralThreshold / dist) ** 2);
                if (dot < minDot) {
                    shouldAddPoint = true;
                }
            }
        }

        if (shouldAddPoint) {
            const firstDx = currentPoint.x - firstPoint.x;
            const firstDy = currentPoint.y - firstPoint.y;
            currentPoint.distance = Math.sqrt(firstDx * firstDx + firstDy * firstDy) || 0; // Default to 0
            this.currentLength += currentPoint.distance;
            if (currentPoint.distance > 0.1) {
                currentPoint.backwards = { x: -firstDx / currentPoint.distance, y: -firstDy / currentPoint.distance };
            } else {
                currentPoint.backwards = {
                    x: firstPoint.backwards?.x ?? -Math.cos(this.owner.angle),
                    y: firstPoint.backwards?.y ?? -Math.sin(this.owner.angle)
                };
            }
            currentPoint.right = { x: -currentPoint.backwards.y, y: currentPoint.backwards.x };
            this.addPoint(currentPoint);
        } else {
            firstPoint.x = currentPoint.x;
            firstPoint.y = currentPoint.y;
            this.currentLength += Math.abs(dist - (firstPoint.distance || 0)); // Default to 0
            firstPoint.distance = dist;
            if (dist > 0.1) {
                firstPoint.backwards = { x: -dx / dist, y: -dy / dist };
            } else {
                firstPoint.backwards = { x: -Math.cos(this.owner.angle), y: -Math.sin(this.owner.angle) };
            }
            firstPoint.right = { x: -firstPoint.backwards.y, y: firstPoint.backwards.x };
        }
        this.trim();
    }

    addPoint(pos) {
        const newPoint = { x: pos.x, y: pos.y };
        if (pos.backwards) newPoint.backwards = { x: pos.backwards.x, y: pos.backwards.y };
        if (pos.right) newPoint.right = { x: pos.right.x, y: pos.right.y };
        if (pos.distance) newPoint.distance = pos.distance;
        this.points.unshift(newPoint);
    }

    trim() {
        if (this.points.length <= 2) return;
        let totalDistance = 0;
        for (let i = 0; i < this.points.length; i++) {
            totalDistance += this.points[i].distance || 0;
            if (totalDistance > this.currentLength) {
                this.points.length = Math.max(2, Math.min(i + 2, this.points.length));
                break;
            }
        }
    }

    draw(ctx, cam) {
        if (this.points.length < 2) return;

        let totalDistance = 0;
        const rightPoints = [];
        const leftPoints = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            if (!point.right || !point.backwards) continue;

            const screenPos = cam.worldToScreen(point);
            const progress = Math.min(1, totalDistance / this.currentLength);
            const currentWidth = cam.worldToSize(this.startWidth) * (1 - progress);
            const rightX = screenPos.x + point.right.x * currentWidth;
            const rightY = screenPos.y + point.right.y * currentWidth;
            const leftX = screenPos.x - point.right.x * currentWidth;
            const leftY = screenPos.y - point.right.y * currentWidth;
            rightPoints.push({ x: rightX, y: rightY });
            leftPoints.unshift({ x: leftX, y: leftY });

            if (totalDistance + (point.distance || 0) > this.currentLength) {
                const remainingDistance = this.currentLength - totalDistance;
                if (remainingDistance < (point.distance || 0)) {
                    const endPoint = cam.worldToScreen({
                        x: point.x + point.backwards.x * remainingDistance,
                        y: point.y + point.backwards.y * remainingDistance
                    });
                    totalDistance += remainingDistance;
                    rightPoints.push(endPoint);
                }
                break;
            }
            totalDistance += point.distance || 0;
        }

        if (rightPoints.length < 1) return;

        ctx.beginPath();
        ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
        for (let i = 0; i < rightPoints.length; i++) {
            ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
        }
        for (let i = 0; i < leftPoints.length; i++) {
            ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        this.drawDebug(ctx, cam);
    }

    drawDebug(ctx, cam) {
        // ctx.fillStyle = 'red';
        // ctx.strokeStyle = 'green';
        // for (const point of this.points) {
        //     const screenPos = cam.worldToScreen(point);
        //     // Red dot at point
        //     ctx.beginPath();
        //     ctx.arc(screenPos.x, screenPos.y, 2, 0, Math.PI * 2);
        //     ctx.fill();

        //     // Green line for backwards vector (10 units long)
        //     if (point.backwards) {
        //         const endX = screenPos.x + point.backwards.x * 10;
        //         const endY = screenPos.y + point.backwards.y * 10;
        //         ctx.beginPath();
        //         ctx.moveTo(screenPos.x, screenPos.y);
        //         ctx.lineTo(endX, endY);
        //         ctx.stroke();
        //     }
        // }
    }
}

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
        this.maxAIShips = this.bodies.length * 2; // 2 ships per body
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
    constructor(game, width, height) { // Take game instead of ship
        this.game = game;
        this.size = new Vector2D(width, height);
        this.ringRadius = Math.min(width, height) / 3;
        this.shipRingRadius = Math.min(width, height) / 2.75;
        this.gateRingRadius = Math.min(width, height) / 2.5;
    }

    resize(width, height) {
        this.size.width = width;
        this.size.height = height;
        this.ringRadius = Math.min(width, height) / 3;
        this.shipRingRadius = Math.min(width, height) / 2.75;
        this.gateRingRadius = Math.min(width, height) / 2.5;
    }

    draw(ctx, cam) {
        const center = cam.getScreenCenter();
        ctx.save();

        // Rings unchanged...
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.arc(center.x, center.y, this.shipRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
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

        // Planets from game.camTarget.system.bodies
        this.game.camTarget.system.bodies.forEach(body => {
            const camPos = cam.worldToCamera(body.pos);
            const distSquared = camPos.x * camPos.x + camPos.y * camPos.y;
            const screenPos = cam.worldToScreen(body.pos);
            const isGate = body instanceof JumpGate;
            const radius = isGate ? this.gateRingRadius : this.ringRadius;

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

        // Ships from game.camTarget.system.ships
        this.game.camTarget.system.ships.forEach(ship => {
            const camPos = cam.worldToCamera(ship.pos);
            const distSquared = camPos.x * camPos.x + camPos.y * camPos.y;
            if ((distSquared > this.shipRingRadius * this.shipRingRadius) && (distSquared < maxRadius * maxRadius)) {
                const angle = Math.atan2(camPos.y, camPos.x);
                const arrowX = center.x + Math.cos(angle) * this.shipRingRadius;
                const arrowY = center.y + Math.sin(angle) * this.shipRingRadius;
                const ringDist = Math.sqrt(distSquared) - this.shipRingRadius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.fillStyle = ship instanceof AIShip ? 'rgba(128, 128, 128, 1)' : 'rgba(255, 255, 255, 1)';
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
    constructor(x, y, system) {
        this.pos = new Vector2D(x, y);
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.rotationSpeed = 0.05;
        this.thrust = 0.1;
        this.maxVelocity = 5;
        this.drag = 0.002;
        this.brakeDrag = 0.01;
        this.hyperdriveReady = true;
        this.hyperdriveCooldown = 5000;
        this.lastJumpTime = 0;
        this.trail = new Trail(this, 250, 2, 'rgba(255, 255, 255, 0.5)');
        this.system = system; // New
    }

    move(keys, dt) {
        dt = dt / 16.67;
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
        this.trail.update(dt); // Update trail
    }

    initiateHyperjump(targetSystem, currentTime) {
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) {
            console.log("Hyperdrive not ready!");
            return false;
        }
        this.lastJumpTime = currentTime;
        this.hyperdriveReady = false;
        const oldSystem = this.system;
        this.system = targetSystem;
        const targetGate = targetSystem.bodies.find(body =>
            body instanceof JumpGate && body.lane.target === oldSystem
        );
        this.pos = targetGate ? new Vector2D(targetGate.pos.x, targetGate.pos.y) : new Vector2D(0, 0);
        this.trail.points = [];
        setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
        return true;
    }



    draw(ctx, cam) {
        ctx.save();
        this.trail.draw(ctx, cam); // Draw trail first
        const screenPos = cam.worldToScreen(this.pos);
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        const scale = cam.zoom;
        ctx.moveTo(15 * scale, 0);
        ctx.lineTo(-10 * scale, 10 * scale);
        ctx.lineTo(-10 * scale, -10 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class AIShip extends Ship {
    constructor(system) {
        const spawnPlanet = system.bodies[Math.floor(Math.random() * system.bodies.length)];
        const angle = Math.random() * Math.PI * 2;
        super(spawnPlanet.pos.x + Math.cos(angle) * 50, spawnPlanet.pos.y + Math.sin(angle) * 50, system);
        this.spawnPlanet = spawnPlanet;
        this.targetPlanet = this.pickDestination(system, spawnPlanet); // Exclude spawn
        this.state = 'flying';
        this.trail = new Trail(this, 250, 2, 'rgba(128, 128, 128, 0.5)');
    }

    pickDestination(system, excludeBody) {
        const destinations = system.bodies.filter(body =>
            body !== excludeBody && body.type.type !== 'star'
        );
        if (Math.random() < 0.33) { // 33% chance for gate
            const gates = destinations.filter(body => body instanceof JumpGate);
            return gates.length > 0 ? gates[Math.floor(Math.random() * gates.length)] :
                destinations[Math.floor(Math.random() * destinations.length)];
        }
        const nonGates = destinations.filter(body => !(body instanceof JumpGate));
        return nonGates.length > 0 ? nonGates[Math.floor(Math.random() * nonGates.length)] :
            destinations[Math.floor(Math.random() * destinations.length)];
    }

    update(dt, system, game) {
        dt = dt / 16.67;
        const relativePosition = new Vector2D(this.targetPlanet.pos.x - this.pos.x, this.targetPlanet.pos.y - this.pos.y);
        const distance = Math.sqrt(relativePosition.x * relativePosition.x + relativePosition.y * relativePosition.y);
        const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);

        if (distance < this.targetPlanet.radius && speed < 0.5) {
            console.log('Reroute', this);
            this.spawnPlanet = this.targetPlanet;
            if (this.targetPlanet instanceof JumpGate) {
                const currentTime = performance.now();
                if (this.initiateHyperjump(this.targetPlanet.lane.target, currentTime)) {
                    const oldSystem = system;
                    oldSystem.ships = oldSystem.ships.filter(ship => ship !== this);
                    this.targetPlanet.lane.target.ships.push(this);
                    console.log(`Jumped to ${this.system.name}`);
                    this.targetPlanet = this.pickDestination(this.system, this.spawnPlanet);
                }
            } else {
                // Despawn check
                const excess = this.system.ships.length - this.system.maxAIShips;
                if (excess > 0) {
                    const despawnChance = Math.min(1, excess * 0.1); // 10% per excess ship, capped at 100%
                    if (Math.random() < despawnChance) {
                        console.log(`Despawned in ${this.system.name} (excess: ${excess})`);
                        this.system.ships = this.system.ships.filter(ship => ship !== this);
                        return;
                    }
                }
                this.targetPlanet = this.pickDestination(this.system, this.spawnPlanet);
            }
            return;
        }

        const timeToTurn = Math.PI / this.rotationSpeed;
        const stopDistance = (timeToTurn * speed) + (speed / this.thrust);

        let relativeDirection, velocityDirection;
        if (distance > 0) {
            relativeDirection = new Vector2D(relativePosition.x / distance, relativePosition.y / distance);
        } else {
            relativeDirection = new Vector2D(1, 0);
        }
        if (speed > 0) {
            velocityDirection = new Vector2D(this.velocity.x / speed, this.velocity.y / speed);
        } else {
            velocityDirection = relativeDirection;
        }

        const dot = relativeDirection.x * velocityDirection.x + relativeDirection.y * velocityDirection.y;

        if (stopDistance * 1.5 > distance && dot > 0.5) {
            if (this.state != 'landing') this.state = 'landing';
        } else {
            if (this.state != 'flying') this.state = 'flying';
        }

        const velToward = dot * speed;
        const velTowardVec = new Vector2D(relativeDirection.x * velToward, relativeDirection.y * velToward);
        const velPerp = new Vector2D(this.velocity.x - velTowardVec.x, this.velocity.y - velTowardVec.y);

        let thrustVec;
        if (this.state == 'flying') {
            thrustVec = new Vector2D(relativePosition.x - velPerp.x, relativePosition.y - velPerp.y);
        } else if (this.state == 'landing') {
            thrustVec = new Vector2D(-velocityDirection.x, -velocityDirection.y);
        }
        const thrustAngle = Math.atan2(thrustVec.y, thrustVec.x);

        const angleDiff = (thrustAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * dt), this.rotationSpeed * dt);

        let thrusting = false;
        if (this.state == 'landing') {
            if ((stopDistance > distance + this.targetPlanet.radius) && (Math.abs(angleDiff) < Math.PI * 0.01)) {
                thrusting = true;
            }
        } else if (this.state == 'flying') {
            if (Math.abs(angleDiff) < Math.PI * ((distance < 100) ? 0.01 : 0.5)) {
                thrusting = true;
            }
        }

        if (thrusting) {
            this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
            const thrustX = Math.cos(this.angle) * this.thrust * dt;
            const thrustY = Math.sin(this.angle) * this.thrust * dt;
            this.velocity.x += thrustX;
            this.velocity.y += thrustY;
        }

        this.velocity.x -= this.velocity.x * this.drag;
        this.velocity.y -= this.velocity.y * this.drag;

        this.pos.x += this.velocity.x * dt;
        this.pos.y += this.velocity.y * dt;

        const speedSquared = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
        if (speedSquared > this.maxVelocity * this.maxVelocity) {
            const scale = this.maxVelocity / Math.sqrt(speedSquared);
            this.velocity.x *= scale;
            this.velocity.y *= scale;
        }

        this.trail.update(dt);
    }

    draw(ctx, cam) {
        ctx.save();
        this.trail.draw(ctx, cam); // Draw trail first
        const screenPos = cam.worldToScreen(this.pos);
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'gray';
        ctx.beginPath();
        const scale = cam.zoom;
        ctx.moveTo(15 * scale, 0);
        ctx.lineTo(-10 * scale, 10 * scale);
        ctx.lineTo(-10 * scale, -10 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.keys = {};
        this.lastTime = performance.now();
        this.canvasSize = new Vector2D(window.innerWidth, window.innerHeight);
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;
        this.isFocused = true;
        this.galaxy = this.initializeGalaxy();
        const earth = this.galaxy[0].bodies[3];
        this.playerShip = new Ship(earth.pos.x + 50, earth.pos.y, this.galaxy[0]);
        this.galaxy[0].ships.push(this.playerShip);
        this.cam = new Camera(this.playerShip.pos, this.canvasSize.width, this.canvasSize.height);
        this.camTarget = this.playerShip;
        this.starField = new StarField(this.cam, 1000);
        this.hud = new HeadsUpDisplay(this, this.canvasSize.width, this.canvasSize.height); // Pass this (Game)
        this.zoomTextTimer = 0;
        this.lastJumpCheck = 0;
        this.jumpCheckInterval = 100;
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = performance.now();
        this.lastSpawnTime = performance.now();
        this.spawnInterval = this.randomSpawnInterval();

        this.spawnAIShips();

        window.addEventListener('resize', () => { this.resizeCanvas(); });
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === 'Tab') {
                e.preventDefault(); // Stop browser tabbing
                this.cycleNextAIShip();
            }
            if (e.key === 'q') this.camTarget = this.playerShip;
        });
        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        window.addEventListener('wheel', (e) => {
            const zoomStep = 0.1;
            this.cam.setZoom(this.cam.zoom + (e.deltaY < 0 ? zoomStep : -zoomStep));
            this.zoomTextTimer = 120;
        });
        //window.addEventListener('blur', () => { this.isFocused = false; });
        //window.addEventListener('focus', () => { this.isFocused = true; });
        this.start();
    }


    randomSpawnInterval() {
        return 2000 + Math.random() * 8000;
    }

    spawnAIShips() {
        this.galaxy.forEach(system => {
            while (system.ships.length < 10) {
                system.ships.push(new AIShip(system));
            }
        });
    }

    cycleNextAIShip() {
        const aiShips = this.camTarget.system.ships.filter(ship => ship instanceof AIShip);
        if (aiShips.length === 0) return;
        const currentIndex = this.camTarget instanceof AIShip ? aiShips.indexOf(this.camTarget) : -1;
        const nextIndex = (currentIndex + 1) % aiShips.length;
        this.camTarget = aiShips[nextIndex];
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
            const dt = currentTime - this.lastTime;
            this.lastTime = currentTime;
            this.update(dt);
            this.render(dt);
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    }

    update(dt) {
        if (!this.isFocused) return;
        const MAX_DT = 100; // Cap delta time at 100 milliseconds
        if (dt > MAX_DT) {
            dt = MAX_DT; // If dt is too large, limit it to MAX_DT
        }
        this.playerShip.move(this.keys, dt);

        this.galaxy.forEach(system => {
            system.ships.forEach(ship => {
                if (ship instanceof AIShip) ship.update(dt, system, this);
            });
        });

        this.cam.update(this.camTarget.pos);
        if (this.zoomTextTimer > 0) {
            this.zoomTextTimer -= dt / 16.67;
        }
        const currentTime = performance.now();
        if (this.keys['j'] && currentTime - this.lastJumpCheck > this.jumpCheckInterval) {
            this.tryHyperjump();
            this.lastJumpCheck = currentTime;
        }
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
        if (currentTime - this.lastSpawnTime > this.spawnInterval) {
            this.galaxy.forEach(system => {
                const deficit = system.maxAIShips - system.ships.length;
                if (deficit > 0) {
                    const spawnChance = Math.min(1, deficit * 0.05); // 5% per missing ship, capped at 100%
                    if (Math.random() < spawnChance) {
                        system.ships.push(new AIShip(system));
                        console.log(`Spawned in ${system.name} (deficit: ${deficit})`);
                    }
                }
            });
            this.lastSpawnTime = currentTime;
            this.spawnInterval = this.randomSpawnInterval();
        }
    }

    tryHyperjump() {
        const currentTime = performance.now();
        const gate = this.camTarget.system.bodies.find(body =>
            body instanceof JumpGate && body.isShipOverlapping(this.playerShip.pos)
        );
        if (gate && this.playerShip.initiateHyperjump(gate.lane.target, currentTime)) {
            const oldSystem = gate.lane.source; // Use gate’s source for clarity
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.playerShip);
            gate.lane.target.ships.push(this.playerShip);
            this.cam.update(this.playerShip.pos);
            console.log(`Jumped to ${this.playerShip.system.name}`);
            this.spawnAIShips();
        }
    }

    render(dt) {
        this.ctx.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
        this.starField.draw(this.ctx, this.cam, this.playerShip.velocity);
        this.camTarget.system.bodies.forEach(body => body.draw(this.ctx, this.cam));
        this.camTarget.system.ships.forEach(ship => ship.draw(this.ctx, this.cam));
        this.hud.draw(this.ctx, this.cam);
        // FPS and frame time display
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);

        // Frame time bar (scales 0-50ms to 0-150px)
        const maxFrameTime = 50; // 20fps threshold
        const barWidth = Math.min(dt / maxFrameTime, 1) * 150; // Cap at 150px
        this.ctx.fillStyle = dt > 33.33 ? 'red' : dt > 16.67 ? 'yellow' : 'green';
        this.ctx.fillRect(10, 25, barWidth, 10);
        this.ctx.restore();

        if (this.zoomTextTimer > 0) {
            this.ctx.save();
            this.ctx.fillStyle = 'white';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'right';
            const zoomPercent = Math.round(this.cam.zoom * 100);
            this.ctx.fillText(`${zoomPercent}%`, this.canvasSize.width - 10, 30);
            this.ctx.restore();
        }
    }
}

window.game = new Game();