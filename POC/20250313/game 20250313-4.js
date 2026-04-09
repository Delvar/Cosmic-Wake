class GameObject {
    constructor(pos, system) {
        this.pos = new Vector2D(pos.x, pos.y);
        this.system = system;
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
    constructor(system, innerRadius, outerRadius, backgroundCount, interactiveCount) {
        this.system = system;
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

    update(dt) {
        this.backgroundAsteroids.forEach(asteroid => {
            asteroid.angle += asteroid.orbitSpeed * dt;
            asteroid.spin += asteroid.spinSpeed * dt;
            asteroid.angle %= Math.PI * 2;
            asteroid.spin %= Math.PI * 2;
        });
        this.interactiveAsteroids.forEach(asteroid => asteroid.update(dt));
    }

    draw(ctx, cam) {
        ctx.save();
        // const center = cam.worldToScreen(new Vector2D(0, 0));
        // ctx.beginPath();
        // ctx.arc(center.x, center.y, this.innerRadius * cam.zoom, 0, Math.PI * 2);
        // ctx.arc(center.x, center.y, this.outerRadius * cam.zoom, 0, Math.PI * 2, true);
        // ctx.closePath();
        // ctx.fillStyle = 'rgba(139, 69, 19, 0.2)';
        // ctx.fill();

        ctx.fillStyle = 'rgb(100, 100, 100)';
        ctx.strokeStyle = 'rgb(50, 50, 50)';
        ctx.lineWidth = 1;
        this.backgroundAsteroids.forEach(asteroid => {
            const x = Math.cos(asteroid.angle) * asteroid.radius;
            const y = Math.sin(asteroid.angle) * asteroid.radius;
            const screenPos = cam.worldToScreen(new Vector2D(x, y));
            const scaledSize = cam.worldToSize(asteroid.size); // Scale size with zoom
            if (cam.isInView(x, y, asteroid.size)) {
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

        this.interactiveAsteroids.forEach(asteroid => asteroid.draw(ctx, cam));
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
        super(new Vector2D(Math.cos(angle) * radius, Math.sin(angle) * radius), belt.system);
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

    update(dt) {
        this.orbitAngle += this.orbitSpeed * dt;
        this.spin += this.spinSpeed * dt;
        this.pos.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.pos.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.orbitAngle %= Math.PI * 2;
        this.spin %= Math.PI * 2;
    }

    draw(ctx, cam) {
        const screenPos = cam.worldToScreen(this.pos);
        const scaledSize = cam.worldToSize(this.size); // Scale size with zoom
        if (cam.isInView(this.pos.x, this.pos.y, this.size)) {
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
        // Erosion
        if (isNaN(this.currentLength)) {
            this.currentLength = 0;
            //console.log('currentLength is NaN');
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

    isInView(x, y, size) {
        const screenPos = this.worldToScreen(new Vector2D(x, y));
        const buffer = size * this.zoom * 2;
        return (
            screenPos.x + buffer > 0 &&
            screenPos.x - buffer < this.screenSize.width && // Fixed from this.width
            screenPos.y + buffer > 0 &&
            screenPos.y - buffer < this.screenSize.height // Fixed from this.height
        );
    }
}

class TargetCamera extends Camera {
    constructor(pos, width, height) {
        super(pos, width, height, 1); // Default zoom
    }

    updateTarget(target) {
        this.pos.x = target.pos.x;
        this.pos.y = target.pos.y;

        // Dynamic zoom based on target size
        const size = target instanceof Ship ? 20 : target.radius || target.size || 10; // Default 10 if undefined
        const buffer = size * 2; // Show 2x size as surrounding area
        const targetWorldSize = buffer * 2; // Diameter including buffer
        const viewSize = Math.min(this.screenSize.width, this.screenSize.height);
        this.zoom = viewSize / targetWorldSize;
        this.zoom = Math.max(0.5, Math.min(this.zoom, 5)); // Clamp between 0.5 and 5
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

class CelestialBody extends GameObject {
    constructor(distance, radius, color, parent = null, angle = 0, type = celestialTypes['planet'], subtype = null, name = '') {
        super(parent ? new Vector2D(parent.pos.x + Math.cos(angle) * distance, parent.pos.y + Math.sin(angle) * distance) : new Vector2D(Math.cos(angle) * distance, Math.sin(angle) * distance), null);
        this.distance = distance;
        this.radius = radius;
        this.color = color;
        this.parent = parent;
        this.angle = angle;
        this.type = type;
        this.subtype = subtype;
        this.name = name;
    }

    draw(context, cam) {
        const screenPos = cam.worldToScreen(this.pos);
        const screenX = screenPos.x;
        const screenY = screenPos.y;
        const scaledRadius = cam.worldToSize(this.radius);

        // Skip if coordinates or size are non-finite
        if (!isFinite(screenX) || !isFinite(screenY) || !isFinite(scaledRadius) || scaledRadius <= 0) {
            return;
        }

        context.save();

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

class JumpGate extends GameObject {
    constructor(lane, sysPos) {
        const dir = new Vector2D(lane.target.pos.x - sysPos.x, lane.target.pos.y - sysPos.y);
        const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const norm = new Vector2D(dir.x / mag, dir.y / mag);
        const radius = 50;
        const dist = 1000;
        super(new Vector2D(Math.cos(Math.atan2(norm.y, norm.x)) * dist, Math.sin(Math.atan2(norm.y, norm.x)) * dist), null);
        this.lane = lane;
        this.radius = radius;
        this.color = celestialTypes['jumpgate'].color;
        this.type = celestialTypes['jumpgate'];
        this.name = `Jump To ${lane.target.name}`;
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
    constructor(id, name, pos, bodies) {
        this.id = id;
        this.name = name;
        this.pos = pos;
        this.bodies = bodies;
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
    constructor(game, width, height) {
        this.game = game;
        this.size = new Vector2D(width, height);
        this.ringRadius = Math.min(width, height) / 3; // Planet ring (unchanged)
        this.shipRingRadius = Math.min(width, height) / 5.5; // Ship ring (reduced from /2.75 to /5.5)
        this.gateRingRadius = Math.min(width, height) / 2.5; // Gate ring (unchanged)
    }

    resize(width, height) {
        this.size.width = width;
        this.size.height = height;
        this.ringRadius = Math.min(width, height) / 3; // Planet ring (unchanged)
        this.shipRingRadius = Math.min(width, height) / 5.5; // Ship ring (reduced from /2.75 to /5.5)
        this.gateRingRadius = Math.min(width, height) / 2.5; // Gate ring (unchanged)
    }

    draw(ctx, cam) {
        const center = cam.getScreenCenter();
        ctx.save();

        // Planet ring
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Ship ring
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.shipRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Gate ring
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.gateRingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        const remapClamp = (val, inMin, inMax, outMin, outMax) =>
            Math.min(Math.max((outMax - outMin) * (val - inMin) / (inMax - inMin) + outMin, outMin), outMax);
        const maxRadius = 5000;

        // Draw target arrow (double length, no fade, correct ring, base on ring)
        let target = this.game.playerShip.target;
        if (this.game.camTarget instanceof Ship && this.isValidTarget(this.game.camTarget)) {
            target = this.game.camTarget.target;
        }
        if (target && this.isValidTarget(target)) {
            const camPos = cam.worldToCamera(target.pos);
            const distSquared = camPos.x * camPos.x + camPos.y * camPos.y;
            const isGate = target instanceof JumpGate;
            const isAsteroid = target instanceof Asteroid;
            const isShip = target instanceof Ship;
            const ringRadius = isGate ? this.gateRingRadius : isAsteroid || isShip ? this.shipRingRadius : this.ringRadius;

            if (distSquared > ringRadius * ringRadius) {
                const angle = Math.atan2(camPos.y, camPos.x);
                const arrowX = center.x + Math.cos(angle) * ringRadius;
                const arrowY = center.y + Math.sin(angle) * ringRadius;
                const color = target instanceof Asteroid ? new Colour(100 / 255, 100 / 255, 100 / 255)
                    : target instanceof Ship ? target.color
                        : target.subtype ? target.subtype.color : target.type.color || new Colour(1, 1, 1);
                ctx.fillStyle = color.toRGB();
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        // Planets (exclude target from regular arrows)
        this.game.camTarget.system.bodies.forEach(body => {
            const camPos = cam.worldToCamera(body.pos);
            const distSquared = camPos.x * camPos.x + camPos.y * camPos.y;
            const screenPos = cam.worldToScreen(body.pos);
            const isGate = body instanceof JumpGate;
            const radius = isGate ? this.gateRingRadius : this.ringRadius;

            if (distSquared < radius * radius && body.name) {
                ctx.save();
                ctx.fillStyle = 'white';
                ctx.font = `${cam.worldToSize(16)}px Arial`;
                ctx.textAlign = 'center';
                const scaledRadius = cam.worldToSize(body.radius);
                ctx.fillText(body.name, screenPos.x, screenPos.y + scaledRadius + cam.worldToSize(20));
                ctx.restore();
            }

            if ((distSquared > radius * radius) && (distSquared < maxRadius * maxRadius) && body !== target) {
                const angle = Math.atan2(camPos.y, camPos.x);
                const arrowX = center.x + Math.cos(angle) * radius;
                const arrowY = center.y + Math.sin(angle) * radius;
                const color = body.subtype ? body.subtype.color : body.type.color;
                const ringDist = Math.sqrt(distSquared) - radius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.fillStyle = color.toRGB();
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        });

        // Ships (exclude target from regular arrows)
        this.game.camTarget.system.ships.forEach(ship => {
            const camPos = cam.worldToCamera(ship.pos);
            const distSquared = camPos.x * camPos.x + camPos.y * camPos.y;
            if ((distSquared > this.shipRingRadius * this.shipRingRadius) && (distSquared < maxRadius * maxRadius) && ship !== target) {
                const angle = Math.atan2(camPos.y, camPos.x);
                const arrowX = center.x + Math.cos(angle) * this.shipRingRadius;
                const arrowY = center.y + Math.sin(angle) * this.shipRingRadius;
                const ringDist = Math.sqrt(distSquared) - this.shipRingRadius;
                const opacity = remapClamp(ringDist, maxRadius, 0, 0.2, 1);
                ctx.fillStyle = ship.pilot instanceof AIPilot ? 'rgba(128, 128, 128, 1)' : 'rgba(255, 255, 255, 1)';
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(0, 5);
                ctx.lineTo(0, -5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        });

        // Draw square around target
        if (target && this.isValidTarget(target)) {
            const targetScreenPos = cam.worldToScreen(target.pos);
            const size = target instanceof Ship ? 20 : target.radius || target.size;
            const scaledSize = cam.worldToSize(size) * 2;
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
        if (target.isDespawned()) return false; // Check despawned first
        if (target instanceof Ship) {
            return this.game.galaxy.some(system => system.ships.includes(target));
        }
        if (target instanceof CelestialBody || target instanceof JumpGate) {
            return this.game.galaxy.some(system => system.bodies.includes(target));
        }
        if (target instanceof Asteroid) {
            return this.game.galaxy.some(system => system.asteroidBelt && system.asteroidBelt.interactiveAsteroids.includes(target));
        }
        return false;
    }
}

class Ship extends GameObject {
    constructor(x, y, system, color = new Colour(1, 1, 1), trailColor = new Colour(1, 1, 1, 0.5)) {
        super(new Vector2D(x, y), system);
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

    update(dt) {
        const angleDiff = (this.targetAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
        this.angle += Math.min(Math.max(angleDiff, -this.rotationSpeed * dt), this.rotationSpeed * dt);
        this.angle = ((this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;

        if (this.isThrusting) {
            const thrustX = Math.cos(this.angle) * this.thrust * dt;
            const thrustY = Math.sin(this.angle) * this.thrust * dt;
            this.velocity.x += thrustX;
            this.velocity.y += thrustY;
        } else if (this.isBraking) {
            const drag = this.brakeDrag;
            this.velocity.x -= this.velocity.x * drag * dt;
            this.velocity.y -= this.velocity.y * drag * dt;
            const velAngle = Math.atan2(-this.velocity.y, -this.velocity.x);
            const brakeAngleDiff = (velAngle - this.angle + Math.PI) % (2 * Math.PI) - Math.PI;
            this.angle += brakeAngleDiff * this.rotationSpeed * dt;
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

        this.trail.update(dt);
    }

    initiateHyperjump(targetSystem, currentTime) {
        if (!this.hyperdriveReady || currentTime - this.lastJumpTime < this.hyperdriveCooldown) {
            //console.log("Hyperdrive not ready!");
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
        this.velocity = new Vector2D(0, 0);
        this.angle = 0;
        this.targetAngle = 0;
        this.trail.points = [];
        //console.log(`Ship jumped from ${oldSystem.name} to ${targetSystem.name}`);
        setTimeout(() => { this.hyperdriveReady = true; }, this.hyperdriveCooldown);
        return true;
    }

    draw(ctx, cam) {
        ctx.save();
        this.trail.draw(ctx, cam); // Draw trail first
        const screenPos = cam.worldToScreen(this.pos);
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.angle);

        // Draw ship body
        ctx.fillStyle = this.color.toRGB();
        ctx.beginPath();
        const scale = cam.zoom;
        ctx.moveTo(15 * scale, 0);
        ctx.lineTo(-10 * scale, 10 * scale);
        ctx.lineTo(-10 * scale, -10 * scale);
        ctx.closePath();
        ctx.fill();

        // Draw thrust indicator (yellow triangle) if thrusting
        if (this.isThrusting) {
            ctx.fillStyle = new Colour(1, 1, 0).toRGB(); // Yellow
            ctx.beginPath();
            ctx.moveTo(-15 * scale, 0); // Tip at back of ship
            ctx.lineTo(-10 * scale, 5 * scale);
            ctx.lineTo(-10 * scale, -5 * scale);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // Draw debug line to target
        // if (this.target) {
        //     const targetScreenPos = cam.worldToScreen(this.target.pos);
        //     ctx.save();
        //     ctx.beginPath();
        //     ctx.moveTo(screenPos.x, screenPos.y);
        //     ctx.lineTo(targetScreenPos.x, targetScreenPos.y);
        //     ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Red debug line
        //     ctx.lineWidth = 1;
        //     ctx.stroke();
        //     ctx.restore();
        // }
    }
}
class Pilot {
    constructor(ship) {
        this.ship = ship;
    }

    // Abstract method to update pilot state and control the ship
    update(dt, game) {
        throw new Error("update() must be implemented by subclass");
    }

    // Abstract method to initiate hyperjump (if applicable)
    tryHyperjump(game) {
        throw new Error("tryHyperjump() must be implemented by subclass");
    }
}
class PlayerPilot extends Pilot {
    constructor(ship, keys) {
        super(ship);
        this.keys = keys;
    }

    update(dt, game) {
        // Handle rotation
        let targetAngle = this.ship.angle; // Default to current angle
        if (this.keys.ArrowLeft) {
            targetAngle -= this.ship.rotationSpeed * dt;
        } else if (this.keys.ArrowRight) {
            targetAngle += this.ship.rotationSpeed * dt;
        }
        //console.log(targetAngle, this.ship.angle, this.ship.targetAngle, this.ship.rotationSpeed * dt);
        this.ship.setTargetAngle(targetAngle);

        // Handle thrust and braking
        this.ship.applyThrust(this.keys.ArrowUp);
        this.ship.applyBrakes(this.keys.ArrowDown);
    }

    tryHyperjump(game) {
        const currentTime = performance.now();
        const gate = this.ship.system.bodies.find(body =>
            body instanceof JumpGate && body.isShipOverlapping(this.ship.pos)
        );
        if (gate && this.ship.initiateHyperjump(gate.lane.target, currentTime)) {
            const oldSystem = gate.lane.source;
            oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.ship);
            gate.lane.target.ships.push(this.ship);
            //console.log(`Jumped to ${this.ship.system.name}`);
            game.spawnAIShips();
            return true;
        }
        return false;
    }
}

class AIPilot extends Pilot {
    constructor(ship, spawnPlanet) {
        super(ship);
        this.spawnPlanet = spawnPlanet;
        this.targetPlanet = this.pickDestination(ship.system, spawnPlanet);
        this.state = 'flying';
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

    update(dt, game) {
        const relativePosition = new Vector2D(this.targetPlanet.pos.x - this.ship.pos.x, this.targetPlanet.pos.y - this.ship.pos.y);
        const distance = Math.sqrt(relativePosition.x * relativePosition.x + relativePosition.y * relativePosition.y);
        const speed = Math.sqrt(this.ship.velocity.x * this.ship.velocity.x + this.ship.velocity.y * this.ship.velocity.y);

        this.ship.setTarget(this.targetPlanet);

        if (distance < this.targetPlanet.radius && speed < 0.5) {
            this.spawnPlanet = this.targetPlanet;
            if (this.targetPlanet instanceof JumpGate) {
                const currentTime = performance.now();
                const oldSystem = this.ship.system;
                if (this.ship.initiateHyperjump(this.targetPlanet.lane.target, currentTime)) {
                    oldSystem.ships = oldSystem.ships.filter(ship => ship !== this.ship);
                    this.targetPlanet.lane.target.ships.push(this.ship);
                    this.targetPlanet = this.pickDestination(this.ship.system, this.spawnPlanet);
                    this.ship.setTarget(this.targetPlanet);
                    return;
                }
            } else {
                const excess = this.ship.system.ships.length - this.ship.system.maxAIShips;
                if (excess > 0) {
                    const despawnChance = Math.min(1, excess * 0.1);
                    if (Math.random() < despawnChance) {
                        this.ship.system.ships = this.ship.system.ships.filter(ship => ship !== this.ship);
                        this.ship.clearTarget();
                        // Reset camTarget if this ship was being followed
                        if (game.camTarget === this.ship) {
                            game.camTarget = game.playerShip;
                        }
                        return;
                    }
                }
                this.targetPlanet = this.pickDestination(this.ship.system, this.spawnPlanet);
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
            if ((stopDistance > distance + this.targetPlanet.radius) && (Math.abs(angleDiff) < Math.PI * 0.1)) { // Relaxed from 0.01 to 0.1
                thrusting = true;
            }
        } else if (this.state === 'flying') {
            if (Math.abs(angleDiff) < Math.PI * 0.75) { // Relaxed from 0.5 to 0.75
                thrusting = true;
            }
        }

        this.ship.applyThrust(thrusting);
        this.ship.applyBrakes(false);
    }

    tryHyperjump(game) {
        // AI handles hyperjump in update() when reaching a jump gate
        return false;
    }
}

class Game {
    constructor() {

        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasSize = new Vector2D(window.innerWidth, window.innerHeight);
        this.canvas.width = this.canvasSize.width;
        this.canvas.height = this.canvasSize.height;

        // Initialize target canvas
        this.targetCanvas = document.getElementById('targetCanvas');
        this.targetCtx = this.targetCanvas.getContext('2d');
        // Set canvas size to match CSS
        this.targetCanvas.width = this.targetCanvas.offsetWidth;
        this.targetCanvas.height = this.targetCanvas.offsetHeight;
        this.targetCamera = new TargetCamera(new Vector2D(0, 0), this.targetCanvas.width, this.targetCanvas.height);

        this.keys = {};
        this.lastTime = performance.now();

        this.isFocused = true;
        this.galaxy = this.initializeGalaxy();
        const earth = this.galaxy[0].bodies[3];
        this.playerShip = new Ship(earth.pos.x + 50, earth.pos.y, this.galaxy[0]);
        this.playerPilot = new PlayerPilot(this.playerShip, this.keys);
        this.playerShip.pilot = this.playerPilot;
        this.galaxy[0].ships.push(this.playerShip);
        this.cam = new Camera(this.playerShip.pos, this.canvasSize.width, this.canvasSize.height);
        this.camTarget = this.playerShip;
        this.starField = new StarField(this.cam, 1000);
        this.hud = new HeadsUpDisplay(this, this.canvasSize.width, this.canvasSize.height);
        this.zoomTextTimer = 0;
        this.lastJumpCheck = 0;
        this.jumpCheckInterval = 100;
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = performance.now();
        this.lastSpawnTime = performance.now();
        this.spawnInterval = this.randomSpawnInterval();

        this.spawnAIShips();

        // Optional: Draggable support
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

        // this.targetCanvas.addEventListener('resize', () => {
        //     this.targetCamera.screenSize.width = this.targetCanvas.offsetWidth;
        //     this.targetCamera.screenSize.height = this.targetCanvas.offsetHeight;
        // });

        // Add ResizeObserver for target canvas
        const resizeObserver = new ResizeObserver(() => {
            this.targetCanvas.width = this.targetCanvas.offsetWidth;
            this.targetCanvas.height = this.targetCanvas.offsetHeight;
            this.targetCamera.screenSize.width = this.targetCanvas.width;
            this.targetCamera.screenSize.height = this.targetCanvas.height;
        });
        resizeObserver.observe(this.targetCanvas);

        window.addEventListener('resize', () => { this.resizeCanvas(); });
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
                this.camTarget = this.playerShip;
            }
            if (e.key === 't') {
                e.preventDefault();
                if (e.shiftKey) { // Use e.shiftKey instead of this.keys['Shift']
                    this.cyclePreviousTarget();
                } else {
                    this.cycleNextTarget();
                }
            }
        });
        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        window.addEventListener('wheel', (e) => {
            const zoomStep = 0.1;
            this.cam.setZoom(this.cam.zoom + (e.deltaY < 0 ? zoomStep : -zoomStep));
            this.zoomTextTimer = 120;
        });
        this.start();
    }

    getTargetableObjects() {
        const system = this.playerShip.system;
        const planets = system.bodies.filter(body => !(body instanceof JumpGate) && !body.isDespawned());
        const gates = system.bodies.filter(body => body instanceof JumpGate && !body.isDespawned());
        const ships = system.ships.filter(ship => ship !== this.playerShip && !ship.isDespawned());
        const asteroids = system.asteroidBelt ? system.asteroidBelt.interactiveAsteroids.filter(a => !a.isDespawned()) : [];
        return [...planets, ...gates, ...ships, ...asteroids];
    }

    cycleNextTarget() {
        const targets = this.getTargetableObjects();
        if (targets.length === 0) {
            this.playerShip.clearTarget();
            return;
        }
        const currentIndex = targets.indexOf(this.playerShip.target);
        const nextIndex = (currentIndex + 1) % targets.length;
        this.playerShip.setTarget(targets[nextIndex]);
    }

    cyclePreviousTarget() {
        const targets = this.getTargetableObjects();
        if (targets.length === 0) {
            this.playerShip.clearTarget();
            return;
        }
        const currentIndex = targets.indexOf(this.playerShip.target);
        const prevIndex = (currentIndex - 1 + targets.length) % targets.length;
        this.playerShip.setTarget(targets[prevIndex]);
    }

    cycleNextAsteroid() {
        const asteroids = this.camTarget.system.asteroidBelt ? this.camTarget.system.asteroidBelt.interactiveAsteroids : [];
        if (asteroids.length === 0) return;

        // Check if current target is an asteroid
        const currentIndex = asteroids.indexOf(this.camTarget);
        const nextIndex = (currentIndex + 1) % asteroids.length;
        this.camTarget = asteroids[nextIndex];
    }

    randomSpawnInterval() {
        return 2000 + Math.random() * 8000;
    }

    spawnAIShips() {
        this.galaxy.forEach(system => {
            while (system.ships.length < 10) {
                const spawnPlanet = system.bodies[Math.floor(Math.random() * system.bodies.length)];
                const angle = Math.random() * Math.PI * 2;
                const aiShip = new Ship(
                    spawnPlanet.pos.x + Math.cos(angle) * 50,
                    spawnPlanet.pos.y + Math.sin(angle) * 50,
                    system,
                    new Colour(0.5, 0.5, 0.5), // 'gray' (RGB: 128, 128, 128)
                    new Colour(0.5, 0.5, 0.5, 0.5) // 'rgba(128, 128, 128, 0.5)'
                );
                aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                system.ships.push(aiShip);
            }
        });
    }

    cycleNextAIShip() {
        const aiShips = this.camTarget.system.ships.filter(ship => ship.pilot instanceof AIPilot);
        if (aiShips.length === 0) return;
        const currentIndex = this.camTarget.pilot instanceof AIPilot ? aiShips.indexOf(this.camTarget) : -1;
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
        sol.asteroidBelt = new AsteroidBelt(sol, 3000, 3800, 750, 10); // Moved beyond Mars

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

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.hud.resize(this.canvas.width, this.canvas.height);
        this.cam.screenSize.width = this.canvas.width;
        this.cam.screenSize.height = this.canvas.height;
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
        const MAX_DT = 100;
        if (dt > MAX_DT) dt = MAX_DT;
        dt = dt / 16.67; // Normalize once here

        this.galaxy.forEach(system => {
            system.ships.forEach(ship => {
                if (ship.pilot) ship.pilot.update(dt, this);
                ship.update(dt);
            });
            if (system.asteroidBelt) system.asteroidBelt.update(dt);
        });

        this.cam.update(this.camTarget.pos);
        if (this.zoomTextTimer > 0) {
            this.zoomTextTimer -= dt;
        }
        const currentTime = performance.now();
        if (this.keys['j'] && currentTime - this.lastJumpCheck > this.jumpCheckInterval) {
            this.playerPilot.tryHyperjump(this);
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
                    const spawnChance = Math.min(1, deficit * 0.05);
                    if (Math.random() < spawnChance) {
                        const spawnPlanet = system.bodies[Math.floor(Math.random() * system.bodies.length)];
                        const angle = Math.random() * Math.PI * 2;
                        const aiShip = new Ship(
                            spawnPlanet.pos.x + Math.cos(angle) * 50,
                            spawnPlanet.pos.y + Math.sin(angle) * 50,
                            system,
                            new Colour(0.5, 0.5, 0.5),
                            new Colour(0.5, 0.5, 0.5, 0.5)
                        );
                        aiShip.pilot = new AIPilot(aiShip, spawnPlanet);
                        system.ships.push(aiShip);
                    }
                }
            });
            this.lastSpawnTime = currentTime;
            this.spawnInterval = this.randomSpawnInterval();
        }

        if (this.camTarget instanceof Ship && this.camTarget.target) {
            this.targetCamera.updateTarget(this.camTarget.target);
        }

        this.cam.update(this.camTarget.pos);
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
            //console.log(`Jumped to ${this.playerShip.system.name}`);
            this.spawnAIShips();
        }
    }

    render(dt) {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.starField.draw(this.ctx, this.cam, this.playerShip.velocity);
        if (this.camTarget.system.asteroidBelt) {
            this.camTarget.system.asteroidBelt.draw(this.ctx, this.cam);
        }
        this.camTarget.system.bodies.forEach(body => body.draw(this.ctx, this.cam));
        this.camTarget.system.ships.forEach(ship => ship.draw(this.ctx, this.cam));
        this.hud.draw(this.ctx, this.cam);
        this.renderTargetView();

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

    renderTargetView() {
        let target = this.camTarget instanceof Ship ? this.camTarget.target : null;

        // Clear canvas
        this.targetCtx.fillStyle = 'black';
        this.targetCtx.fillRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);

        if (!target || !this.hud.isValidTarget(target)) {
            this.targetCanvas.style.display = 'none';
            return;
        }

        this.targetCanvas.style.display = 'block';
        this.starField.draw(this.targetCtx, this.targetCamera, new Vector2D(0, 0));
        if (this.camTarget.system.asteroidBelt) {
            this.camTarget.system.asteroidBelt.draw(this.targetCtx, this.targetCamera);
        }
        this.camTarget.system.bodies.forEach(body => body.draw(this.targetCtx, this.targetCamera));
        this.camTarget.system.ships.forEach(ship => ship.draw(this.targetCtx, this.targetCamera));
    }

}

window.game = new Game();