class GameObject {
    constructor(position, starSystem) {
        this.position = new Vector2D(position.x, position.y);
        this.starSystem = starSystem;
        this.despawned = false;
    }

    despawn() {
        this.despawned = true;
    }

    isDespawned() {
        return this.despawned;
    }
}

class AsteroidBelt {
    constructor(starSystem, innerRadius, outerRadius, backgroundCount, interactiveCount) {
        this.starSystem = starSystem;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.backgroundCount = backgroundCount;
        this.interactiveCount = interactiveCount;
        this.backgroundAsteroids = [];
        this.interactiveAsteroids = [];
    }

    initialize() {
        const remapRange01 = (numberIn, rangeOutMin, rangeOutMax) => {
            return (numberIn * (rangeOutMax - rangeOutMin)) + rangeOutMin;
        };
        for (let i = 0; i < this.backgroundCount; i++) {
            const radius = remapRange01(Math.random(), this.innerRadius, this.outerRadius);
            const angle = remapRange01(Math.random(), 0, Math.PI * 2);
            const size = remapRange01(Math.random(), 2, 20);
            const spinSpeed = remapRange01(Math.random(), -0.1, 0.1);
            const orbitSpeed = remapRange01(Math.random(), 0.00005, 0.0004);
            this.backgroundAsteroids.push({
                radius,
                angle,
                size,
                spin: 0,
                spinSpeed,
                orbitSpeed,
                shape: this.generateShape(5 + Math.floor(Math.random() * 4))
            });
        }
        for (let i = 0; i < this.interactiveCount; i++) {
            this.interactiveAsteroids.push(new Asteroid(this));
        }
    }

    generateShape(sides) {
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const r = 0.5 + Math.random() * 0.5;
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
        return points;
    }

    update(deltaTime) {
        this.backgroundAsteroids.forEach(asteroid => {
            asteroid.angle += asteroid.orbitSpeed * deltaTime;
            asteroid.spin += asteroid.spinSpeed * deltaTime;
            asteroid.angle %= Math.PI * 2;
            asteroid.spin %= Math.PI * 2;
        });
        this.interactiveAsteroids.forEach(asteroid => asteroid.update(deltaTime));
    }

    draw(ctx, camera) {
        ctx.save();
        ctx.fillStyle = 'rgb(100, 100, 100)';
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 1;
        this.backgroundAsteroids.forEach(asteroid => {
            const x = Math.cos(asteroid.angle) * asteroid.radius;
            const y = Math.sin(asteroid.angle) * asteroid.radius;
            const screenPos = camera.worldToScreen(new Vector2D(x, y));
            const scaledSize = camera.worldToSize(asteroid.size);
            if (camera.isInView(x, y, asteroid.size)) {
                ctx.save();
                ctx.translate(screenPos.x, screenPos.y);
                ctx.rotate(asteroid.spin);
                ctx.beginPath();
                ctx.moveTo(asteroid.shape[0].x * scaledSize, asteroid.shape[0].y * scaledSize);
                for (let i = 1; i < asteroid.shape.length; i++) {
                    ctx.lineTo(asteroid.shape[i].x * scaledSize, asteroid.shape[i].y * scaledSize);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
                ctx.restore();
            }
        });

        this.interactiveAsteroids.forEach(asteroid => asteroid.draw(ctx, camera));
        ctx.restore();
    }
}

class Asteroid extends GameObject {
    constructor(belt) {
        const remapRange01 = (numberIn, rangeOutMin, rangeOutMax) => {
            return (numberIn * (rangeOutMax - rangeOutMin)) + rangeOutMin;
        };
        const radius = remapRange01(Math.random(), belt.innerRadius, belt.outerRadius);
        const angle = remapRange01(Math.random(), 0, Math.PI * 2);
        super(new Vector2D(Math.cos(angle) * radius, Math.sin(angle) * radius), belt.starSystem);
        this.belt = belt;
        this.size = remapRange01(Math.random(), 15, 30);
        this.spin = 0;
        this.spinSpeed = remapRange01(Math.random(), -0.1, 0.1);
        this.orbitSpeed = remapRange01(Math.random(), 0.00005, 0.0004);
        this.orbitRadius = radius;
        this.orbitAngle = angle;
        this.shape = this.generateShape(6 + Math.floor(Math.random() * 4));
    }

    generateShape(sides) {
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const r = 0.6 + Math.random() * 0.4;
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
        return points;
    }

    update(deltaTime) {
        this.orbitAngle += this.orbitSpeed * deltaTime;
        this.spin += this.spinSpeed * deltaTime;
        this.position.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.position.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.orbitAngle %= Math.PI * 2;
        this.spin %= Math.PI * 2;
    }

    draw(ctx, camera) {
        const screenPos = camera.worldToScreen(this.position);
        const scaledSize = camera.worldToSize(this.size);
        if (camera.isInView(this.position.x, this.position.y, this.size)) {
            ctx.save();
            ctx.translate(screenPos.x, screenPos.y);
            ctx.rotate(this.spin);
            ctx.fillStyle = 'rgb(100, 100, 100)';
            ctx.strokeStyle = 'rgb(50, 50, 50)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.shape[0].x * scaledSize, this.shape[0].y * scaledSize);
            for (let i = 1; i < this.shape.length; i++) {
                ctx.lineTo(this.shape[i].x * scaledSize, this.shape[i].y * scaledSize);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            ctx.restore();
        }
    }
}

class Trail {
    constructor(parent, maxLength = 250, startWidth = 2, color = 'rgba(255, 255, 255, 0.5)') {
        this.parent = parent;
        this.points = [];
        this.startWidth = startWidth;
        this.currentLength = 0;
        this.softMaxLength = maxLength;
        this.hardMaxLength = maxLength * 1.2;
        this.erosionSpeed = parent.maxVelocity * 0.5;
        this.minPointDist = 5;
        this.maxPointDist = 200;
        this.lateralThreshold = 2;
        this.color = color;
    }

    update(deltaTime) {
        if (isNaN(this.currentLength)) {
            this.currentLength = 0;
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

        const currentPoint = { x: this.parent.position.x, y: this.parent.position.y };

        if (this.points.length < 2) {
            currentPoint.backwards = {
                x: -Math.cos(this.parent.angle),
                y: -Math.sin(this.parent.angle)
            };
            currentPoint.right = {
                x: Math.sin(this.parent.angle),
                y: -Math.cos(this.parent.angle)
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
            currentPoint.distance = Math.sqrt(firstDx * firstDx + firstDy * firstDy) || 0;
            this.currentLength += currentPoint.distance;
            if (currentPoint.distance > 0.1) {
                currentPoint.backwards = { x: -firstDx / currentPoint.distance, y: -firstDy / currentPoint.distance };
            } else {
                currentPoint.backwards = {
                    x: firstPoint.backwards?.x ?? -Math.cos(this.parent.angle),
                    y: firstPoint.backwards?.y ?? -Math.sin(this.parent.angle)
                };
            }
            currentPoint.right = { x: -currentPoint.backwards.y, y: currentPoint.backwards.x };
            this.addPoint(currentPoint);
        } else {
            firstPoint.x = currentPoint.x;
            firstPoint.y = currentPoint.y;
            this.currentLength += Math.abs(dist - (firstPoint.distance || 0));
            firstPoint.distance = dist;
            if (dist > 0.1) {
                firstPoint.backwards = { x: -dx / dist, y: -dy / dist };
            } else {
                firstPoint.backwards = { x: -Math.cos(this.parent.angle), y: -Math.sin(this.parent.angle) };
            }
            firstPoint.right = { x: -firstPoint.backwards.y, y: firstPoint.backwards.x };
        }
        this.trim();
    }

    addPoint(position) {
        const newPoint = { x: position.x, y: position.y };
        if (position.backwards) newPoint.backwards = { x: position.backwards.x, y: position.backwards.y };
        if (position.right) newPoint.right = { x: position.right.x, y: position.right.y };
        if (position.distance) newPoint.distance = position.distance;
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

    draw(ctx, camera) {
        if (this.points.length < 2) return;

        let totalDistance = 0;
        const rightPoints = [];
        const leftPoints = [];

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            if (!point.right || !point.backwards) continue;

            const screenPos = camera.worldToScreen(point);
            const progress = Math.min(1, totalDistance / this.currentLength);
            const currentWidth = camera.worldToSize(this.startWidth) * (1 - progress);
            const rightX = screenPos.x + point.right.x * currentWidth;
            const rightY = screenPos.y + point.right.y * currentWidth;
            const leftX = screenPos.x - point.right.x * currentWidth;
            const leftY = screenPos.y - point.right.y * currentWidth;
            rightPoints.push({ x: rightX, y: rightY });
            leftPoints.unshift({ x: leftX, y: leftY });

            if (totalDistance + (point.distance || 0) > this.currentLength) {
                const remainingDistance = this.currentLength - totalDistance;
                if (remainingDistance < (point.distance || 0)) {
                    const endPoint = camera.worldToScreen({
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

        this.renderDebug(ctx, camera);
    }

    renderDebug(ctx, camera) {
        // ctx.fillStyle = 'red';
        // ctx.strokeStyle = 'green';
        // for (const point of this.points) {
        //     const screenPos = camera.worldToScreen(point);
        //     ctx.beginPath();
        //     ctx.arc(screenPos.x, screenPos.y, 2, 0, Math.PI * 2);
        //     ctx.fill();

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
    constructor(position, width, height, zoom = 1) {
        this.position = new Vector2D(position.x, position.y);
        this.zoom = zoom;
        this.screenSize = new Vector2D(width, height);
        this.worldSize = new Vector2D(width / zoom, height / zoom);
    }

    update(position) {
        this.position.x = position.x;
        this.position.y = position.y;
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
        this.position.x = x;
        this.position.y = y;
    }

    getScreenCenter() {
        return new Vector2D(this.screenSize.width / 2, this.screenSize.height / 2);
    }

    worldToScreen(position) {
        const center = this.getScreenCenter();
        const dx = (position.x - this.position.x) * this.zoom;
        const dy = (position.y - this.position.y) * this.zoom;
        return new Vector2D(center.x + dx, center.y + dy);
    }

    worldToSize(size) {
        return size * this.zoom;
    }

    worldToCamera(position) {
        const dx = (position.x - this.position.x) * this.zoom;
        const dy = (position.y - this.position.y) * this.zoom;
        return new Vector2D(dx, dy);
    }

    cameraToScreen(position) {
        const center = this.getScreenCenter();
        return new Vector2D(center.x + position.x, center.y + position.y);
    }

    isInView(x, y, size) {
        const screenPos = this.worldToScreen(new Vector2D(x, y));
        const buffer = size * this.zoom * 2;
        return (
            screenPos.x + buffer > 0 &&
            screenPos.x - buffer < this.screenSize.width &&
            screenPos.y + buffer > 0 &&
            screenPos.y - buffer < this.screenSize.height
        );
    }
}

class TargetCamera extends Camera {
    constructor(position, width, height) {
        super(position, width, height, 1);
    }

    updateTarget(target) {
        if (!target) return;
        this.position.x = target.position.x;
        this.position.y = target.position.y;

        const size = target instanceof Ship ? 20 : target.radius || target.size || 10;
        const buffer = size * 2;
        const targetWorldSize = buffer * 2;
        const viewSize = Math.min(this.screenSize.width, this.screenSize.height);
        this.zoom = viewSize / targetWorldSize;
        this.zoom = Math.max(0.5, Math.min(this.zoom, 5));
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
        this.position = new Vector2D(x, y);
    }
}

class StarField {
    constructor(camera, starCount) {
        this.starCount = starCount;
        this.size = new Vector2D(camera.screenSize.width * 2, camera.screenSize.height * 2);
        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
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
        return new Vector2D(dx, dy);
    }

    setStarPositionCameraSpace(camera, star, cameraX, cameraY) {
        const worldX = cameraX / star.depth + camera.position.x;
        const worldY = cameraY / star.depth + camera.position.y;
        star.position.x = worldX;
        star.position.y = worldY;
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

    repositionStar(star, camera, velocity) {
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

        const visibleLeft = -camera.screenSize.width / 2;
        const visibleRight = camera.screenSize.width / 2;
        const visibleTop = -camera.screenSize.height / 2;
        const visibleBottom = camera.screenSize.height / 2;

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

    draw(ctx, camera, velocity) {
        ctx.save();
        ctx.fillStyle = 'white';
        const halfX = this.size.x / 2;
        const halfY = this.size.y / 2;
        this.stars.forEach(star => {
            let cameraPos = this.getStarPositionCameraSpace(camera, star);
            if (Math.abs(cameraPos.x) > halfX || Math.abs(cameraPos.y) > halfY) {
                cameraPos = this.repositionStar(star, camera, velocity);
            }
            const screenPos = camera.cameraToScreen(cameraPos);
            if (screenPos.x >= 0 && screenPos.x < camera.screenSize.width && screenPos.y >= 0 && screenPos.y < camera.screenSize.height) {
                ctx.fillRect(screenPos.x, screenPos.y, star.size, star.size);
            }
        });
        ctx.restore();
    }
}

class CelestialBody extends GameObject {
    constructor(distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '') {
        super(parent ? new Vector2D(parent.position.x + Math.cos(angle) * distance, parent.position.y + Math.sin(angle) * distance) : new Vector2D(Math.cos(angle) * distance, Math.sin(angle) * distance), null);
        this.distance = distance;
        this.radius = radius;
        this.color = color;
        this.parent = parent;
        this.angle = angle;
        this.type = type;
        this.subtype = subtype;
        this.name = name;
    }

    draw(ctx, camera) {
        ctx.save();
        const screenPos = camera.worldToScreen(this.position);
        const screenX = screenPos.x;
        const screenY = screenPos.y;
        const scaledRadius = camera.worldToSize(this.radius);

        if (!isFinite(screenX) || !isFinite(screenY) || !isFinite(scaledRadius) || scaledRadius <= 0) {
            ctx.restore();
            return;
        }

        const sunAngle = Math.atan2(-this.position.y, -this.position.x);
        const lightX = screenX + Math.cos(sunAngle) * scaledRadius * 0.7;
        const lightY = screenY + Math.sin(sunAngle) * scaledRadius * 0.7;

        let fillStyle = this.color.toRGB();
        if (this.type.type !== 'star') {
            const gradient = ctx.createRadialGradient(
                lightX, lightY, 0,
                screenX, screenY, scaledRadius * 3
            );
            gradient.addColorStop(0, this.color.toRGB());
            gradient.addColorStop(1, 'rgb(0, 0, 0)');
            fillStyle = gradient;
        }

        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.closePath();

        ctx.restore();
    }
}

class JumpGate extends CelestialBody {
    constructor(lane, sysPosition) {
        const dir = new Vector2D(lane.target.position.x - sysPosition.x, lane.target.position.y - sysPosition.y);
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const norm = new Vector2D(dir.x / mag, dir.y / mag);
        const radius = 50;
        const dist = 1000;
        const angle = Math.atan2(norm.y, norm.x);
        super(dist, radius, celestialTypes['jumpgate'].color, null, angle, celestialTypes['jumpgate'], null, `Jump To ${lane.target.name}`);
        this.lane = lane;
        this.starSystem = lane.source; // Explicitly set starSystem since no parent
    }

    draw(ctx, camera) {
        ctx.save();
        const screenPos = camera.worldToScreen(this.position);
        const radius = camera.worldToSize(this.radius);
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color.toRGB();
        ctx.lineWidth = camera.worldToSize(5);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
    }

    overlapsShip(shipPosition) {
        const dx = this.position.x - shipPosition.x;
        const dy = this.position.y - shipPosition.y;
        return (dx * dx + dy * dy) < (this.radius * this.radius);
    }
}

class Hyperlane {
    constructor(source, target) {
        this.source = source;
        this.target = target;
        this.distSquared = this.calculateDistSquared();
    }

    calculateDistSquared() {
        const dx = this.target.position.x - this.source.position.x;
        const dy = this.target.position.y - this.source.position.y;
        return dx * dx + dy * dy;
    }
}

class StarSystem {
    constructor(id, name, position, celestialBodies) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.celestialBodies = celestialBodies;
        this.ships = [];
        this.maxAIShips = 10;
        this.hyperlanes = [];
        this.asteroidBelt = null;
    }

    initialize() {
        if (this.asteroidBelt) {
            this.asteroidBelt.initialize();
        }
        this.initializeJumpGates();
    }

    addHyperlane(targetSystem) {
        const lane = new Hyperlane(this, targetSystem);
        this.hyperlanes.push(lane);
        targetSystem.hyperlanes.push(new Hyperlane(targetSystem, this));
    }

    initializeJumpGates() {
        this.hyperlanes.forEach(lane => {
            if (lane.source === this) {
                this.celestialBodies.push(new JumpGate(lane, this.position));
            }
        });
    }
}

class HeadsUpDisplay {
    constructor(game, width, height) {
        this.game = game;
        this.size = new Vector2D(width, height);
        this.ringRadius = Math.min(width, height) / 3;         // Planets (light blue)
        this.shipRingRadius = Math.min(width, height) / 5.5;   // Ships/Asteroids (grey)
        this.gateRingRadius = Math.min(width, height) / 2.5;   // Jump gates (green)
    }

    resize(width, height) {
        this.size.width = width;
        this.size.height = height;
        this.ringRadius = Math.min(width, height) / 3;
        this.shipRingRadius = Math.min(width, height) / 5.5;
        this.gateRingRadius = Math.min(width, height) / 2.5;
    }

    draw(ctx, camera) {
        const center = camera.getScreenCenter();
        ctx.save();

        // Planet ring (light blue)
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Ship/Asteroid ring (grey)
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.shipRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Jump gate ring (green)
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.gateRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        const remapClamp = (val, inMin, inMax, outMin, outMax) =>
            Math.min(Math.max((outMax - outMin) * (val - inMin) / (inMax - inMin) + outMin, outMin), outMax);
        const maxRadius = 5000;

        let target = this.game.playerShip.target;
        if (this.game.cameraTarget instanceof Ship && this.isValidTarget(this.game.cameraTarget)) {
            target = this.game.cameraTarget.target;
        }
        if (target && this.isValidTarget(target)) {
            const cameraPos = camera.worldToCamera(target.position);
            const distSquared = cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y;
            const isGate = target instanceof JumpGate;
            const isAsteroid = target instanceof Asteroid;
            const isShip = target instanceof Ship;
            const ringRadius = isGate ? this.gateRingRadius : isAsteroid || isShip ? this.shipRingRadius : this.ringRadius;

            if (distSquared > ringRadius * ringRadius) {
                const angle = Math.atan2(cameraPos.y, cameraPos.x);
                const arrowX = center.x + Math.cos(angle) * ringRadius;
                const arrowY = center.y + Math.sin(angle) * ringRadius;
                ctx.save();
                ctx.globalAlpha = 1; // Moved after save
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
                ctx.closePath();
                if (isGate) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 1)'; // Green for jump gates
                } else if (isAsteroid || isShip) {
                    ctx.fillStyle = target === this.game.playerShip ? 'rgba(255, 255, 255, 1)' : 'rgba(128, 128, 128, 1)'; // Grey for ships/asteroids, white for player
                } else if (target.type.type === 'star') {
                    ctx.fillStyle = 'rgba(255, 255, 0, 1)'; // Yellow for stars
                } else {
                    ctx.fillStyle = 'rgba(0, 255, 255, 1)'; // Light blue for planets
                }
                ctx.fill();
                ctx.restore();
            }
        }

        this.game.cameraTarget.starSystem.celestialBodies.forEach(body => {
            const cameraPos = camera.worldToCamera(body.position);
            const distSquared = cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y;
            const screenPos = camera.worldToScreen(body.position);
            const isGate = body instanceof JumpGate;
            const radius = isGate ? this.gateRingRadius : this.ringRadius;

            if (distSquared < radius * radius && body.name) {
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'white';
                ctx.font = `${camera.worldToSize(16)}px Arial`;
                ctx.textAlign = 'center';
                const scaledRadius = camera.worldToSize(body.radius);
                ctx.fillText(body.name, screenPos.x, screenPos.y + scaledRadius + camera.worldToSize(20));
                ctx.restore();
            }

            if ((distSquared > radius * radius) && (distSquared < maxRadius * maxRadius) && body !== target) {
                const angle = Math.atan2(cameraPos.y, cameraPos.x);
                const arrowX = center.x + Math.cos(angle) * radius;
                const arrowY = center.y + Math.sin(angle) * radius;
                const ringDist = Math.sqrt(distSquared) - radius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.globalAlpha = opacity; // Moved after save
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
                ctx.closePath();
                if (isGate) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 1)'; // Green for jump gates
                } else if (body.type.type === 'star') {
                    ctx.fillStyle = 'rgba(255, 255, 0, 1)'; // Yellow for stars
                } else {
                    ctx.fillStyle = 'rgba(0, 255, 255, 1)'; // Light blue for planets
                }
                ctx.fill();
                ctx.restore();
            }
        });

        this.game.cameraTarget.starSystem.ships.forEach(ship => {
            const cameraPos = camera.worldToCamera(ship.position);
            const distSquared = cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y;
            if ((distSquared > this.shipRingRadius * this.shipRingRadius) && (distSquared < maxRadius * maxRadius) && ship !== target) {
                const angle = Math.atan2(cameraPos.y, cameraPos.x);
                const arrowX = center.x + Math.cos(angle) * this.shipRingRadius;
                const arrowY = center.y + Math.sin(angle) * this.shipRingRadius;
                const ringDist = Math.sqrt(distSquared) - this.shipRingRadius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.globalAlpha = opacity; // Moved after save
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
                ctx.closePath();
                ctx.fillStyle = ship.pilot instanceof AIPilot ? 'rgba(128, 128, 128, 1)' : 'rgba(255, 255, 255, 1)'; // Grey for AI, white for player
                ctx.fill();
                ctx.restore();
            }
        });

        if (target && this.isValidTarget(target)) {
            const targetScreenPos = camera.worldToScreen(target.position);
            const size = target instanceof Ship ? 20 : target.radius || target.size;
            const scaledSize = camera.worldToSize(size) * 2;
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(
                targetScreenPos.x - scaledSize / 2,
                targetScreenPos.y - scaledSize / 2,
                scaledSize,
                scaledSize
            );
            ctx.stroke();
        }

        ctx.restore();
    }

    isValidTarget(target) {
        if (target.isDespawned()) return false;
        if (target instanceof Ship) {
            return this.game.galaxy.some(starSystem => starSystem.ships.includes(target));
        }
        if (target instanceof CelestialBody || target instanceof JumpGate) {
            return this.game.galaxy.some(starSystem => starSystem.celestialBodies.includes(target));
        }
        if (target instanceof Asteroid) {
            return this.game.galaxy.some(starSystem => starSystem.asteroidBelt && starSystem.asteroidBelt.interactiveAsteroids.includes(target));
        }
        return false;
    }
}

class Ship extends GameObject {
    constructor(x, y, starSystem, color = new Colour(1, 1, 1), trailColor = new Colour(1, 1, 1, 0.5)) {
        super(new Vector2D(x, y), starSystem);
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.targetAngle = 0;
        this.rotationSpeed = 0.05;
        this.thrust = 0.01;
        this.maxVelocity = 2;
        this.drag = 0.002;
        this.brakeDrag = 0.005;
        this.isThrusting = false;
        this.isBraking = false;
        this.hyperdriveReady = true;
        this.hyperdriveCooldown = 5000;
        this.lastJumpTime = 0;
        this.trail = new Trail(this, 250, 2, trailColor.toRGBA());
        this.color = color;
        this.target = null;
    }

    setTarget(target) {
        this.target = target;
    }

    clearTarget() {
        this.target = null;
    }

    setTargetAngle(angle) {
        this.targetAngle = angle;
    }

    applyThrust(thrusting) {
        this.isThrusting = thrusting;
    }

    applyBrakes(braking) {
        this.isBraking = braking;
    }

    update(deltaTime) {
        const angleDiff = (this.targetAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * deltaTime), this.rotationSpeed * deltaTime);
        this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;

        if (this.isThrusting) {
            const thrustX = Math.cos(this.angle) * this.thrust * deltaTime;
            const thrustY = Math.sin(this.angle) * this.thrust * deltaTime;
            this.velocity.x += thrustX;
            this.velocity.y += thrustY;
        } else if (this.isBraking) {
            const drag = this.brakeDrag;
            this.velocity.x -= this.velocity.x * drag * deltaTime;
            this.velocity.y -= this.velocity.y * drag * deltaTime;
            const velAngle = Math.atan2(-this.velocity.y, -this.velocity.x);
            const brakeAngleDiff = (velAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle += brakeAngleDiff * this.rotationSpeed * deltaTime;
            this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
        } else {
            const drag = this.drag;
            this.velocity.x -= this.velocity.x * drag * deltaTime;
            this.velocity.y -= this.velocity.y * drag * deltaTime;
        }

        const speedSquared = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
        if (speedSquared > this.maxVelocity * this.maxVelocity) {
            const scale = this.maxVelocity / Math.sqrt(speedSquared);
            this.velocity.x *= scale;
            this.velocity.y *= scale;
        }

        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;

        this.trail.update(deltaTime);
    }

    initiateHyperjump(targetSystem, currentTime) {
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) {
            return false;
        }
        this.lastJumpTime = currentTime;
        this.hyperdriveReady = false;
        const oldSystem = this.starSystem;
        this.starSystem = targetSystem;
        const targetGate = targetSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.lane.target === oldSystem
        );
        this.position = targetGate ? new Vector2D(targetGate.position.x, targetGate.position.y) : new Vector2D(0, 0);
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.targetAngle = 0;
        this.trail.points = [];
        setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
        return true;
    }

    draw(ctx, camera) {
        ctx.save();
        this.trail.draw(ctx, camera);
        const screenPos = camera.worldToScreen(this.position);
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color.toRGB();
        ctx.beginPath();
        const scale = camera.zoom;
        ctx.moveTo(15 * scale, 0);
        ctx.lineTo(-10 * scale, 10 * scale);
        ctx.lineTo(-10 * scale, -10 * scale);
        ctx.closePath();
        ctx.fill();

        if (this.isThrusting) {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB();
            ctx.beginPath();
            ctx.moveTo(-15 * scale, 0);
            ctx.lineTo(-10 * scale, 5 * scale);
            ctx.lineTo(-10 * scale, -5 * scale);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

class Pilot {
    constructor(ship) {
        this.ship = ship;
    }

    update(deltaTime, game) {
        throw new Error("update() must be implemented by subclass");
    }

    tryHyperjump(game) {
        throw new Error("tryHyperjump() must be implemented by subclass");
    }
}

class PlayerPilot extends Pilot {
    constructor(ship, keys) {
        super(ship);
        this.keys = keys;
    }

    update(deltaTime, game) {
        let targetAngle = this.ship.angle;
        if (this.keys.ArrowLeft) {
            targetAngle -= this.ship.rotationSpeed * deltaTime;
        } else if (this.keys.ArrowRight) {
            targetAngle += this.ship.rotationSpeed * deltaTime;
        }
        this.ship.setTargetAngle(targetAngle);

        this.ship.applyThrust(this.keys.ArrowUp);
        this.ship.applyBrakes(this.keys.ArrowDown);
    }

    tryHyperjump(game) {
        const currentTime = performance.now();
        const gate = this.ship.starSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.overlapsShip(this.ship.position)
        );
        if (gate && this.ship.initiateHyperjump(gate.lane.target, currentTime)) {
            const oldSystem = gate.lane.source;
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.ship);
            gate.lane.target.ships.push(this.ship);
            return true;
        }
        return false;
    }
}

class AIPilot extends Pilot {
    constructor(ship, spawnPlanet) {
        super(ship);
        this.spawnPlanet = spawnPlanet;
        this.targetPlanet = this.pickDestination(ship.starSystem, spawnPlanet);
        this.state = 'flying';
    }

    pickDestination(starSystem, excludeBody) {
        const destinations = starSystem.celestialBodies.filter(body =>
            body !== excludeBody && body.type.type !== 'star'
        );
        if (Math.random() < 0.33) {
            const gates = destinations.filter(body => body instanceof JumpGate);
            return gates.length > 0 ? gates[Math.floor(Math.random() * gates.length)] :
                destinations[Math.floor(Math.random() * destinations.length)];
        }
        const nonGates = destinations.filter(body => !(body instanceof JumpGate));
        return nonGates.length > 0 ? nonGates[Math.floor(Math.random() * nonGates.length)] :
            destinations[Math.floor(Math.random() * destinations.length)];
    }

    update(deltaTime, game) {
        const relativePosition = new Vector2D(this.targetPlanet.position.x - this.ship.position.x, this.targetPlanet.position.y - this.ship.position.y);
        const distance = Math.sqrt(relativePosition.x * relativePosition.x + relativePosition.y * relativePosition.y);
        const speed = Math.sqrt(this.ship.velocity.x * this.ship.velocity.x + this.ship.velocity.y * this.ship.velocity.y);

        this.ship.setTarget(this.targetPlanet);

        if (distance < this.targetPlanet.radius && speed < 0.5) {
            this.spawnPlanet = this.targetPlanet;
            if (this.targetPlanet instanceof JumpGate) {
                const currentTime = performance.now();
                const oldSystem = this.ship.starSystem;
                if (this.ship.initiateHyperjump(this.targetPlanet.lane.target, currentTime)) {
                    oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.ship);
                    this.targetPlanet.lane.target.ships.push(this.ship);
                    this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                    this.ship.setTarget(this.targetPlanet);
                    return;
                }
            } else {
                const excess = this.ship.starSystem.ships.length - this.ship.starSystem.maxAIShips;
                if (excess > 0) {
                    const despawnChance = Math.min(1, excess * 0.1);
                    if (Math.random() < despawnChance) {
                        this.ship.starSystem.ships = this.ship.starSystem.ships.filter(ship => ship !== this.ship);
                        this.ship.clearTarget();
                        if (game.cameraTarget === this.ship) {
                            game.cameraTarget = game.playerShip;
                        }
                        return;
                    }
                }
                this.targetPlanet = this.pickDestination(this.ship.starSystem, this.spawnPlanet);
                this.ship.setTarget(this.targetPlanet);
            }
            return;
        }

        const timeToTurn = Math.PI / this.ship.rotationSpeed;
        const stopDistance = (timeToTurn * speed) + (speed / this.ship.thrust);

        let relativeDirection, velocityDirection;
        if (distance > 0) {
            relativeDirection = new Vector2D(relativePosition.x / distance, relativePosition.y / distance);
        } else {
            relativeDirection = new Vector2D(1, 0);
        }
        if (speed > 0) {
            velocityDirection = new Vector2D(this.ship.velocity.x / speed, this.ship.velocity.y / speed);
        } else {
            velocityDirection = relativeDirection;
        }

        const dot = relativeDirection.x * velocityDirection.x + relativeDirection.y * velocityDirection.y;

        if (stopDistance * 1.5 > distance && dot > 0.5) {
            if (this.state !== 'landing') this.state = 'landing';
        } else {
            if (this.state !== 'flying') this.state = 'flying';
        }

        const velToward = dot * speed;
        const velTowardVec = new Vector2D(relativeDirection.x * velToward, relativeDirection.y * velToward);
        const velPerp = new Vector2D(this.ship.velocity.x - velTowardVec.x, this.ship.velocity.y - velTowardVec.y);

        let thrustVec;
        if (this.state === 'flying') {
            thrustVec = new Vector2D(relativePosition.x - velPerp.x, relativePosition.y - velPerp.y);
        } else if (this.state === 'landing') {
            thrustVec = new Vector2D(-velocityDirection.x, -velocityDirection.y);
        }
        const thrustAngle = Math.atan2(thrustVec.y, thrustVec.x);

        this.ship.setTargetAngle(thrustAngle);

        const angleDiff = (thrustAngle - this.ship.angle + Math.PI) % (2 * Math.PI) - Math.PI;

        let thrusting = false;
        if (this.state === 'landing') {
            if ((stopDistance > distance + this.targetPlanet.radius) && (Math.abs(angleDiff) < Math.PI * 0.1)) {
                thrusting = true;
            }
        } else if (this.state === 'flying') {
            if (Math.abs(angleDiff) < Math.PI * 0.75) {
                thrusting = true;
            }
        }

        this.ship.applyThrust(thrusting);
        this.ship.applyBrakes(false);
    }

    tryHyperjump(game) {
        return false;
    }
}

class Game {
    constructor(manager, canvas, targetCanvas) {
        this.manager = manager;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.canvasSize = new Vector2D(window.innerWidth, window.innerHeight);
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;

        this.targetCanvas = targetCanvas;
        this.targetCtx = this.targetCanvas.getContext('2d');
        this.targetCanvas.width = this.targetCanvas.offsetWidth;
        this.targetCanvas.height = this.targetCanvas.offsetHeight;
        this.targetCamera = manager.targetCamera;

        this.camera = manager.camera;
        this.starField = manager.starField;
        this.hud = manager.hud;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = performance.now();
        this.zoomTextTimer = 0;
    }

    resizeCanvas() {
        this.canvasSize.width = window.innerWidth;
        this.canvasSize.height = window.innerHeight;
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;
        this.camera.resize(this.canvasSize.width, this.canvasSize.height);
        this.starField.resize(this.canvasSize.width, this.canvasSize.height);
        this.hud.resize(this.canvasSize.width, this.canvasSize.height);
    }

    start() {
        const gameLoop = (currentTime) => {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            this.update(deltaTime);
            this.render(deltaTime);
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    }

    update(deltaTime) {
        if (!this.manager.isFocused) return;
        const MAX_DELTA = 100;
        if (deltaTime > MAX_DELTA) deltaTime = MAX_DELTA;
        deltaTime = deltaTime / 16.67;

        this.manager.update(deltaTime);
        this.camera.update(this.manager.cameraTarget.position);
        if (this.manager.zoomTextTimer > 0) {
            this.manager.zoomTextTimer -= deltaTime;
        }
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
        if (this.manager.cameraTarget instanceof Ship && this.manager.cameraTarget.target) {
            this.targetCamera.updateTarget(this.manager.cameraTarget.target);
        }
    }

    render(deltaTime) {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.starField.draw(this.ctx, this.camera, this.manager.playerShip.velocity);
        const starSystem = this.manager.cameraTarget.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(this.ctx, this.camera);
        starSystem.celestialBodies.forEach(body => body.draw(this.ctx, this.camera));
        starSystem.ships.forEach(ship => ship.draw(this.ctx, this.camera));
        this.hud.draw(this.ctx, this.camera);
        this.renderTargetView();

        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);

        const maxFrameTime = 50;
        const barWidth = Math.min(deltaTime / maxFrameTime, 1) * 150;
        this.ctx.fillStyle = deltaTime > 33.33 ? 'red' : deltaTime > 16.67 ? 'yellow' : 'green';
        this.ctx.fillRect(10, 25, barWidth, 10);
        this.ctx.restore();

        if (this.manager.zoomTextTimer > 0) {
            this.ctx.save();
            this.ctx.fillStyle = 'white';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'right';
            const zoomPercent = Math.round(this.camera.zoom * 100);
            this.ctx.fillText(`${zoomPercent}%`, this.canvasSize.width - 10, 30);
            this.ctx.restore();
        }
    }

    renderTargetView() {
        let target = this.manager.cameraTarget instanceof Ship ? this.manager.cameraTarget.target : null;
        this.targetCtx.fillStyle = 'black';
        this.targetCtx.fillRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
        if (!target || !this.hud.isValidTarget(target)) {
            this.targetCanvas.style.display = 'none';
            return;
        }
        this.targetCanvas.style.display = 'block';
        this.starField.draw(this.targetCtx, this.targetCamera, new Vector2D(0, 0));
        const starSystem = this.manager.cameraTarget.starSystem;
        if (starSystem.asteroidBelt) starSystem.asteroidBelt.draw(this.targetCtx, this.targetCamera);
        starSystem.celestialBodies.forEach(body => body.draw(this.targetCtx, this.targetCamera));
        starSystem.ships.forEach(ship => ship.draw(this.targetCtx, this.targetCamera));
    }
}

class GameManager {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.targetCanvas = document.getElementById('targetCanvas');

        this.keys = {};
        this.isFocused = true;
        this.galaxy = this.createGalaxy();
        const earth = this.galaxy[0].celestialBodies[3];
        this.playerShip = new Ship(earth.position.x + 50, earth.position.y, this.galaxy[0]);
        this.playerPilot = new PlayerPilot(this.playerShip, this.keys);
        this.playerShip.pilot = this.playerPilot;
        this.galaxy[0].ships.push(this.playerShip);
        this.camera = new Camera(this.playerShip.position, window.innerWidth, window.innerHeight);
        this.cameraTarget = this.playerShip;
        this.targetCamera = new TargetCamera(new Vector2D(0, 0), this.targetCanvas.offsetWidth, this.targetCanvas.offsetHeight);
        this.starField = new StarField(this.camera, 1000);
        this.hud = new HeadsUpDisplay(this, window.innerWidth, window.innerHeight);
        this.zoomTextTimer = 0;
        this.lastJumpCheck = 0;
        this.jumpCheckInterval = 100;
        this.lastSpawnTime = performance.now();
        this.spawnInterval = this.randomSpawnInterval();

        this.game = new Game(this, this.canvas, this.targetCanvas); // Pass canvas references

        this.spawnAIShips();
        this.setupEventListeners();
        this.game.start();
    }

    update(deltaTime) {
        this.galaxy.forEach(starSystem => {
            starSystem.ships.forEach(ship => {
                if (ship.pilot) ship.pilot.update(deltaTime, this);
                ship.update(deltaTime);
            });
            if (starSystem.asteroidBelt) starSystem.asteroidBelt.update(deltaTime);
        });

        const currentTime = performance.now();
        if (this.keys['j'] && currentTime - this.lastJumpCheck > this.jumpCheckInterval) {
            this.playerPilot.tryHyperjump(this);
            this.lastJumpCheck = currentTime;
        }
        if (currentTime - this.lastSpawnTime > this.spawnInterval) {
            this.galaxy.forEach(starSystem => {
                const deficit = starSystem.maxAIShips - starSystem.ships.length;
                if (deficit > 0) {
                    const spawnChance = Math.min(1, deficit * 0.05);
                    if (Math.random() < spawnChance) {
                        const spawnPlanet = starSystem.celestialBodies[Math.floor(Math.random() * starSystem.celestialBodies.length)];
                        const angle = Math.random() * Math.PI * 2;
                        const aiShip = new Ship(
                            spawnPlanet.position.x + Math.cos(angle) * 50,
                            spawnPlanet.position.y + Math.sin(angle) * 50,
                            starSystem,
                            new Colour(0.5, 0.5, 0.5),
                            new Colour(0.5, 0.5, 0.5, 0.5)
                        );
                        aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                        starSystem.ships.push(aiShip);
                    }
                }
            });
            this.lastSpawnTime = currentTime;
            this.spawnInterval = this.randomSpawnInterval();
        }
    }

    listTargetableObjects() {
        const starSystem = this.playerShip.starSystem;
        const planets = starSystem.celestialBodies.filter(body => !(body instanceof JumpGate) && !body.isDespawned());
        const gates = starSystem.celestialBodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        const ships = starSystem.ships.filter(ship => ship !== this.playerShip && !ship.isDespawned());
        const asteroids = starSystem.asteroidBelt ? starSystem.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        return [...planets, ...gates, ...ships, ...asteroids];
    }

    cycleNextTarget() {
        const targets = this.listTargetableObjects();
        if (targets.length === 0) {
            this.playerShip.clearTarget();
            return;
        }
        const currentIndex = targets.indexOf(this.playerShip.target);
        const nextIndex = (currentIndex + 1) % targets.length;
        this.playerShip.setTarget(targets[nextIndex]);
    }

    cyclePreviousTarget() {
        const targets = this.listTargetableObjects();
        if (targets.length === 0) {
            this.playerShip.clearTarget();
            return;
        }
        const currentIndex = targets.indexOf(this.playerShip.target);
        const prevIndex = (currentIndex - 1 + targets.length) % targets.length;
        this.playerShip.setTarget(targets[prevIndex]);
    }

    cycleNextAsteroid() {
        const asteroids = this.cameraTarget.starSystem.asteroidBelt ? this.cameraTarget.starSystem.asteroidBelt.interactiveAsteroids : [];
        if (asteroids.length === 0) return;
        const currentIndex = asteroids.indexOf(this.cameraTarget);
        const nextIndex = (currentIndex + 1) % asteroids.length;
        this.cameraTarget = asteroids[nextIndex];
    }

    randomSpawnInterval() {
        return 2000 + Math.random() * 8000;
    }

    spawnAIShips() {
        this.galaxy.forEach(starSystem => {
            while (starSystem.ships.length < 10) {
                const spawnPlanet = starSystem.celestialBodies[Math.floor(Math.random() * starSystem.celestialBodies.length)];
                const angle = Math.random() * Math.PI * 2;
                const aiShip = new Ship(
                    spawnPlanet.position.x + Math.cos(angle) * 50,
                    spawnPlanet.position.y + Math.sin(angle) * 50,
                    starSystem,
                    new Colour(0.5, 0.5, 0.5),
                    new Colour(0.5, 0.5, 0.5, 0.5)
                );
                aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                starSystem.ships.push(aiShip);
            }
        });
    }

    cycleNextAIShip() {
        const aiShips = this.cameraTarget.starSystem.ships.filter(ship => ship.pilot instanceof AIPilot);
        if (aiShips.length === 0) return;
        const currentIndex = this.cameraTarget.pilot instanceof AIPilot ? aiShips.indexOf(this.cameraTarget) : -1;
        const nextIndex = (currentIndex + 1) % aiShips.length;
        this.cameraTarget = aiShips[nextIndex];
    }

    createGalaxy() {
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
        const earth = sol.celestialBodies[3];
        sol.celestialBodies.push(
            new CelestialBody(60, 8, new Colour(0.83, 0.83, 0.83), earth, randomAngle(), celestialTypes['satellite'], null, 'Moon')
        );
        sol.asteroidBelt = new AsteroidBelt(sol, 3000, 3800, 750, 10);

        const alphaCentauri = new StarSystem("alpha-centauri", "Alpha Centauri", new Vector2D(10000, 5000), [
            new CelestialBody(0, 80, new Colour(1, 0.8, 0), null, 0, celestialTypes['star'], null, 'Alpha Centauri A'),
            new CelestialBody(200, 70, new Colour(0.9, 0.6, 0), null, randomAngle(), celestialTypes['star'], null, 'Alpha Centauri B'),
            new CelestialBody(1000, 25, new Colour(0.6, 0.4, 0.2), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Desert'], 'Procyon'),
            new CelestialBody(1500, 30, new Colour(0.5, 0.7, 0.9), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Ice'], 'Triton')
        ]);
        alphaCentauri.asteroidBelt = new AsteroidBelt(alphaCentauri, 1800, 2200, 500, 8);

        const proximaCentauri = new StarSystem("proxima-centauri", "Proxima Centauri", new Vector2D(8000, -2000), [
            new CelestialBody(0, 60, new Colour(0.8, 0.2, 0), null, 0, celestialTypes['star'], null, 'Proxima Centauri'),
            new CelestialBody(500, 15, new Colour(0.4, 0.3, 0.2), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Iron'], 'Proxima b'),
            new CelestialBody(800, 20, new Colour(0.5, 0.4, 0.3), null, randomAngle(), celestialTypes['planet'], celestialTypes['planet'].subtypes['Desert'], 'Proxima c')
        ]);
        proximaCentauri.asteroidBelt = null;

        sol.addHyperlane(alphaCentauri);
        sol.addHyperlane(proximaCentauri);
        alphaCentauri.addHyperlane(proximaCentauri);

        sol.initialize();
        alphaCentauri.initialize();
        proximaCentauri.initialize();

        return [sol, alphaCentauri, proximaCentauri];
    }

    setupEventListeners() {
        let offsetX, offsetY;
        this.targetCanvas.addEventListener('dragstart', (e) => {
            offsetX = e.offsetX;
            offsetY = e.offsetY;
        });
        this.targetCanvas.addEventListener('drag', (e) => {
            if (e.clientX > 0 && e.clientY > 0) {
                this.targetCanvas.style.left = `${e.clientX - offsetX}px`;
                this.targetCanvas.style.top = `${e.clientY - offsetY}px`;
            }
        });

        const resizeObserver = new ResizeObserver(() => {
            this.targetCanvas.width = this.targetCanvas.offsetWidth;
            this.targetCanvas.height = this.targetCanvas.offsetHeight;
            this.targetCamera.screenSize.width = this.targetCanvas.width;
            this.targetCamera.screenSize.height = this.targetCanvas.height;
        });
        resizeObserver.observe(this.targetCanvas);

        window.addEventListener('resize', () => { this.game.resizeCanvas(); });
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === 'Tab') {
                e.preventDefault();
                this.cycleNextAIShip();
            }
            if (e.key === 'w') {
                e.preventDefault();
                this.cycleNextAsteroid();
            }
            if (e.key === 'q') {
                this.cameraTarget = this.playerShip;
            }
            if (e.key === 't') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.cyclePreviousTarget();
                } else {
                    this.cycleNextTarget();
                }
            }
        });
        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        window.addEventListener('wheel', (e) => {
            const zoomStep = 0.1;
            this.camera.setZoom(this.camera.zoom + (e.deltaY < 0 ? zoomStep : -zoomStep));
            this.zoomTextTimer = 120;
        });
    }

    tryHyperjump() {
        const currentTime = performance.now();
        const gate = this.cameraTarget.starSystem.celestialBodies.find(body =>
            body instanceof JumpGate && body.overlapsShip(this.playerShip.position)
        );
        if (gate && this.playerShip.initiateHyperjump(gate.lane.target, currentTime)) {
            const oldSystem = gate.lane.source;
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.playerShip);
            gate.lane.target.ships.push(this.playerShip);
            this.camera.update(this.playerShip.position);
            this.spawnAIShips();
        }
    }
}

window.gameManager = new GameManager();