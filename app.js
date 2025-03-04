const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const score1 = document.getElementById("player1Score");
const score2 = document.getElementById("player2Score");

const paddleWidth = 10, paddleHeight = 100;
let player1Y = (canvas.height - paddleHeight) / 2;
let player2Y = (canvas.height - paddleHeight) / 2;
const paddleSpeed = 10;

const ballSize = 15;
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballSpeedX = 0;
let ballSpeedY = 0;

let player1Score = 0;
let player2Score = 0;
let upPressed = false, downPressed = false;
let wPressed = false, sPressed = false;
let paused = true;
let lastLoser = null;

window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") upPressed = true;
    if (e.key === "ArrowDown") downPressed = true;
    if (e.key === "w") wPressed = true;
    if (e.key === "s") sPressed = true;
    if (e.key === " " && paused) resumeBall();
});

window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp") upPressed = false;
    if (e.key === "ArrowDown") downPressed = false;
    if (e.key === "w") wPressed = false;
    if (e.key === "s") sPressed = false;
});

function movePaddles() {
    if (wPressed && player1Y > 0) player1Y -= paddleSpeed;
    if (sPressed && player1Y < canvas.height - paddleHeight) player1Y += paddleSpeed;
    if (upPressed && player2Y > 0) player2Y -= paddleSpeed;
    if (downPressed && player2Y < canvas.height - paddleHeight) player2Y += paddleSpeed;
}

function moveBall() {
    if (paused) return;
    
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    if (ballY <= 0 || ballY >= canvas.height) {
        ballSpeedY *= -1;
    }

    if (
        (ballX <= paddleWidth && ballY >= player1Y && ballY <= player1Y + paddleHeight) ||
        (ballX >= canvas.width - paddleWidth && ballY >= player2Y && ballY <= player2Y + paddleHeight)
    ) {
        ballSpeedX *= -1;
    }

    if (ballX <= 0) {
        player2Score++;
        lastLoser = 1;
        resetBall();
    } else if (ballX >= canvas.width) {
        player1Score++;
        lastLoser = 2;
        resetBall();
    }

    score1.textContent = player1Score;
    score2.textContent = player2Score;
}

function resetBall() {
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballSpeedX = 0;
    ballSpeedY = 0;
    paused = true;
}

function resumeBall() {
    if (!paused) return;
    paused = false;
    ballSpeedX = lastLoser === 1 ? -7 : 7;
    ballSpeedY = (Math.random() > 0.5 ? 1 : -1) * 7;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "white";
    ctx.fillRect(canvas.width / 2 - 2, 0, 4, canvas.height);
    ctx.fillRect(0, player1Y, paddleWidth, paddleHeight);
    ctx.fillRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight);
    
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
}

function gameLoop() {
    movePaddles();
    moveBall();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
