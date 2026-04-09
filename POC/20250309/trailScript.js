const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Moving object properties
const movingObject = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 2,
    speed: 0.5,
    speedTimer: 0,
    maxSpeed: 1,
    color: '#00ff00',
    angle: 0,
    state: 'straight',
    stateTimer: 0,
    stateDuration: 250,
    turnDirection: 1,
    turnRate: 0.05
};

// Trail properties
const trail = {
    points: [],
    startWidth: 2,
    currentLength: 0,
    softMaxLength: 250,
    hardMaxLength: 300,
    erosionSpeed: movingObject.maxSpeed,
    minPointDist: 5,
    maxPointDist: 200,
    lastPosition: null,
    //Allow 2 pixel angle on lateral movement
    lateralThreshold:2
};

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update object position with alternating movement
    updateObjectMovement();

    // Update trail
    updateTrail();

    // Draw trail
    drawTrail();

    // Draw debug points
    drawDebugPoints();

    // Draw moving object
    drawObject();

    requestAnimationFrame(gameLoop);
}

function updateObjectMovement() {
    movingObject.stateTimer++;
    movingObject.speedTimer++;
    movingObject.speed = movingObject.maxSpeed * (Math.abs(Math.cos(movingObject.speedTimer * 0.001)) * 0.9 + 0.1);
    if (movingObject.speed < 0.25) {
        movingObject.speed = 0; // Changed to allow complete stop
    }

    // Switch states when timer exceeds duration
    if (movingObject.stateTimer >= movingObject.stateDuration) {
        movingObject.stateTimer = 0;
        movingObject.state = movingObject.state === 'straight' ? 'curve' : 'straight';

        // Randomly choose turning direction when entering curve mode
        if (movingObject.state === 'curve') {
            movingObject.turnDirection = (Math.random() - 0.5) * 2;
        }
    }

    // Always move forward based on current angle
    movingObject.x += movingObject.speed * Math.cos(movingObject.angle);
    movingObject.y += movingObject.speed * Math.sin(movingObject.angle);

    // Apply turning in curve mode
    if (movingObject.state === 'curve') {
        movingObject.angle += movingObject.turnRate * movingObject.turnDirection;
    }

    // Bounce off walls
    if (movingObject.x < 0 || movingObject.x > canvas.width) {
        movingObject.angle = Math.PI - movingObject.angle;
        movingObject.x = movingObject.x < 0 ? 0 : canvas.width;
    }
    if (movingObject.y < 0 || movingObject.y > canvas.height) {
        movingObject.angle = -movingObject.angle;
        movingObject.y = movingObject.y < 0 ? 0 : canvas.height;
    }
}

function updateTrail() {
    // Erosion logic remains unchanged
    if (trail.currentLength > trail.hardMaxLength) {
        trail.currentLength = trail.hardMaxLength - trail.erosionSpeed;
    } else if (trail.currentLength > trail.softMaxLength) {
        trail.currentLength -= trail.erosionSpeed * 2;
    } else if (trail.currentLength > 0) {
        const erosionFactor = Math.max(0.25, trail.currentLength / trail.softMaxLength);
        trail.currentLength -= trail.erosionSpeed * erosionFactor;
    }
    trail.currentLength = Math.max(0, trail.currentLength);

    const currentPoint = { x: movingObject.x, y: movingObject.y };

    if (trail.points.length < 2) {
        currentPoint.backwards = {
            x: -Math.cos(movingObject.angle),
            y: -Math.sin(movingObject.angle)
        };
        currentPoint.right = {
            x: Math.sin(movingObject.angle),
            y: -Math.cos(movingObject.angle)
        };
        currentPoint.distance = 1;
        addTrailPoint(currentPoint);
        return;
    }

    const firstPoint = trail.points[0];
    const secondPoint = trail.points[1];

    const dx = currentPoint.x - secondPoint.x;
    const dy = currentPoint.y - secondPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let shouldAddPoint = false;

    if (firstPoint.distance > dist + 0.1) {
        shouldAddPoint = true;
    }

    if (dist > trail.maxPointDist) {
        shouldAddPoint = true;
    }

    if (dist > trail.minPointDist && !shouldAddPoint) {
        if (secondPoint.backwards) {
            const forward = { x: dx / dist, y: dy / dist };
            const dot = (-secondPoint.backwards.x * forward.x) + (-secondPoint.backwards.y * forward.y);

            // Calculate minDot based on lateral movement threshold
            let minDot;
            if (dist <= trail.lateralThreshold) {
                minDot = 0; // Allow full movement if very close
            } else {
                const sinTheta = trail.lateralThreshold / dist;
                minDot = Math.sqrt(1 - sinTheta * sinTheta); // cos(θ) = √(1 - sin²(θ))
            }

            if (dot < minDot) {
                shouldAddPoint = true;
            }
        }
    }

    if (shouldAddPoint) {
        const firstDx = currentPoint.x - firstPoint.x;
        const firstDy = currentPoint.y - firstPoint.y;
        currentPoint.distance = Math.sqrt(firstDx * firstDx + firstDy * firstDy);
        trail.currentLength += currentPoint.distance;
        if (currentPoint.distance > 0.1) {
            currentPoint.backwards = { x: -firstDx / currentPoint.distance, y: -firstDy / currentPoint.distance };
        } else {
            currentPoint.backwards = {
                x: firstPoint.backwards?.x ?? -Math.cos(movingObject.angle),
                y: firstPoint.backwards?.y ?? -Math.sin(movingObject.angle)
            };
        }
        currentPoint.right = { x: -currentPoint.backwards.y, y: currentPoint.backwards.x };
        addTrailPoint(currentPoint);
    } else {
        firstPoint.x = currentPoint.x;
        firstPoint.y = currentPoint.y;
        trail.currentLength += Math.abs(dist - firstPoint.distance);
        firstPoint.distance = dist;
        if (dist > 0.1) {
            firstPoint.backwards = { x: -dx / dist, y: -dy / dist };
        } else {
            firstPoint.backwards = { x: -Math.cos(movingObject.angle), y: -Math.sin(movingObject.angle) };
        }
        firstPoint.right = { x: -firstPoint.backwards.y, y: firstPoint.backwards.x };
    }
    trimTrail();
}

function addTrailPoint(pos) {
    const newPoint = { x: pos.x, y: pos.y };
    if (pos.backwards) {
        newPoint.backwards = { x: pos.backwards.x, y: pos.backwards.y };
    }
    if (pos.right) {
        newPoint.right = { x: pos.right.x, y: pos.right.y };
    }
    if (pos.distance) {
        newPoint.distance = pos.distance;
    }
    trail.points.unshift(newPoint);
}

function trimTrail() {
    if (trail.points.length <= 2) return;
    let totalDistance = 0;
    for (let i = 0; i < trail.points.length; i++) {
        totalDistance += trail.points[i].distance || 0;
        if (totalDistance > trail.currentLength) {
            trail.points.length = Math.max(2, Math.min(i + 2, trail.points.length));
            break;
        }
    }
}

// function drawTrailLine() {
//     if (trail.points.length < 2) return;
//     ctx.beginPath();
//     ctx.strokeStyle = "blue";
//     ctx.moveTo(trail.points[0].x, trail.points[0].y);
//     let totalDistance = 0;
//     for (let i = 0; i < trail.points.length; i++) {
//         const thisPoint = trail.points[i];
//         if (!thisPoint.backwards) continue; // Added error checking
//         ctx.lineTo(thisPoint.x, thisPoint.y);

//         if (totalDistance + (thisPoint.distance || 0) > trail.currentLength) {
//             const remainingDistance = trail.currentLength - totalDistance;
//             if (remainingDistance < (thisPoint.distance || 0)) {
//                 const endPointX = thisPoint.x + thisPoint.backwards.x * remainingDistance;
//                 const endPointY = thisPoint.y + thisPoint.backwards.y * remainingDistance;
//                 totalDistance += remainingDistance;
//                 ctx.lineTo(endPointX, endPointY);
//             }
//             break;
//         }
//         totalDistance += thisPoint.distance || 0;
//     }
//     ctx.stroke();
// }

function drawTrail() {
    if (trail.points.length < 2) return;

    let totalDistance = 0;
    const rightPoints = [];
    const leftPoints = [];

    for (let i = 0; i < trail.points.length; i++) {
        const thisPoint = trail.points[i];
        if (!thisPoint.right || !thisPoint.backwards) continue; // Added error checking

        const progress = Math.min(1, totalDistance / trail.currentLength); // Improved progress calculation
        const currentWidth = trail.startWidth * (1 - progress);
        const rightX = thisPoint.x + thisPoint.right.x * currentWidth;
        const rightY = thisPoint.y + thisPoint.right.y * currentWidth;
        const leftX = thisPoint.x - thisPoint.right.x * currentWidth;
        const leftY = thisPoint.y - thisPoint.right.y * currentWidth;
        rightPoints.push({ x: rightX, y: rightY });
        leftPoints.unshift({ x: leftX, y: leftY });

        if (totalDistance + (thisPoint.distance || 0) > trail.currentLength) {
            const remainingDistance = trail.currentLength - totalDistance;
            if (remainingDistance < (thisPoint.distance || 0)) {
                const endPointX = thisPoint.x + thisPoint.backwards.x * remainingDistance;
                const endPointY = thisPoint.y + thisPoint.backwards.y * remainingDistance;
                totalDistance += remainingDistance;
                rightPoints.push({ x: endPointX, y: endPointY });
                // Note: Not adding to leftPoints as it's a single end point
            }
            break;
        }
        totalDistance += thisPoint.distance || 0;
    }
    if (rightPoints.length < 1) {
        return;
    }
    ctx.beginPath();
    ctx.moveTo(rightPoints[0].x, rightPoints[0].y);
    for (let i = 0; i < rightPoints.length; i++) {
        ctx.lineTo(rightPoints[i].x, rightPoints[i].y);
    }
    for (let i = 0; i < leftPoints.length; i++) {
        ctx.lineTo(leftPoints[i].x, leftPoints[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.fill();
}

function drawDebugPoints() {
    ctx.fillStyle = 'red';
    for (const point of trail.points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
        ctx.fill();

        let endPointX = point.x;
        let endPointY = point.y;

        ctx.beginPath();
        ctx.strokeStyle = "#FF0000AA";
        ctx.moveTo(point.x, point.y);
        endPointX = point.x + point.backwards.x * point.distance;
        endPointY = point.y + point.backwards.y * point.distance;
        ctx.lineTo(endPointX, endPointY);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = "green";
        ctx.moveTo(point.x, point.y);
        endPointX = point.x + point.backwards.x * 10;
        endPointY = point.y + point.backwards.y * 10;
        ctx.lineTo(endPointX, endPointY);
        ctx.stroke();
    }
}

function drawObject() {
    ctx.beginPath();
    ctx.arc(movingObject.x, movingObject.y, movingObject.radius, 0, Math.PI * 2);
    ctx.fillStyle = movingObject.color;
    ctx.fill();
}

// Start the game loop
gameLoop();