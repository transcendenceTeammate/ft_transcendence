import AbstractView from "./AbstractView.js";

export default class Game extends AbstractView {
	constructor() {
		super();
		this.setTitle("Game");
	}

	async getHtml() {
		const response = await fetch('/htmls/game.html');
		if (!response.ok) {
			return '<h1>Failed to load the game HTML</h1>';
		}
		return await response.text();
	}

	onLoaded() {
		this.initGame();
		this.gameLoop();
	
		document.getElementById("closeButton").addEventListener("click", () => {
			window.location.href = '/start-game';
		});
	}
	

	initGame() {
		this.canvas = document.getElementById("gameCanvas");
		this.ctx = this.canvas.getContext("2d");
		this.score1 = document.getElementById("player1Score");
		this.score2 = document.getElementById("player2Score");

		this.paddleWidth = 12;
		this.paddleHeight = 120;
		this.player1Y = (this.canvas.height - this.paddleHeight) / 2;
		this.player2Y = (this.canvas.height - this.paddleHeight) / 2;
		this.paddleSpeed = 12;

		this.ballSize = 20;
		this.ballX = this.canvas.width / 2;
		this.ballY = this.canvas.height / 2;
		this.ballSpeedX = 0;
		this.ballSpeedY = 0;

		this.player1Score = 0;
		this.player2Score = 0;
		this.upPressed = false;
		this.downPressed = false;
		this.wPressed = false;
		this.sPressed = false;
		this.paused = true;
		this.lastLoser = null;
		this.gameOver = false;

		window.addEventListener("keydown", (e) => {
			if (this.gameOver) return;
			if (e.key === "ArrowUp") this.upPressed = true;
			if (e.key === "ArrowDown") this.downPressed = true;
			if (e.key === "w") this.wPressed = true;
			if (e.key === "s") this.sPressed = true;
			if (e.key === " " && this.paused) this.resumeBall();
		});

		window.addEventListener("keyup", (e) => {
			if (e.key === "ArrowUp") this.upPressed = false;
			if (e.key === "ArrowDown") this.downPressed = false;
			if (e.key === "w") this.wPressed = false;
			if (e.key === "s") this.sPressed = false;
		});

		document.getElementById("restartButton").addEventListener("click", () => {
			this.resetGame();
		});
		document.getElementById("quitButton").addEventListener("click", () => {
			window.location.href = '/start-game';
		});
	}

	movePaddles() {
		if (this.wPressed && this.player1Y > 0) this.player1Y -= this.paddleSpeed;
		if (this.sPressed && this.player1Y < this.canvas.height - this.paddleHeight) this.player1Y += this.paddleSpeed;
		if (this.upPressed && this.player2Y > 0) this.player2Y -= this.paddleSpeed;
		if (this.downPressed && this.player2Y < this.canvas.height - this.paddleHeight) this.player2Y += this.paddleSpeed;
	}

	moveBall() {
		if (this.paused) return;
	
		this.ballX += this.ballSpeedX;
		this.ballY += this.ballSpeedY;
		if (this.ballY - this.ballSize / 2 <= 0) {
			this.ballY = this.ballSize / 2;
			this.ballSpeedY *= -1;
		}
	
		if (this.ballY + this.ballSize / 2 >= this.canvas.height) {
			this.ballY = this.canvas.height - this.ballSize / 2;
			this.ballSpeedY *= -1;
		}
		
		if (
			(this.ballX <= this.paddleWidth && this.ballY >= this.player1Y && this.ballY <= this.player1Y + this.paddleHeight) ||
			(this.ballX >= this.canvas.width - this.paddleWidth && this.ballY >= this.player2Y && this.ballY <= this.player2Y + this.paddleHeight)
		) {
			let paddleCenter = this.ballY - (this.player1Y + this.paddleHeight / 2);
			let angle = paddleCenter / (this.paddleHeight / 2);
	
			angle = Math.max(-0.75, Math.min(angle, 0.75));

			this.ballSpeedX *= -1;
			this.ballSpeedY = angle * 6;

			let speedIncrease = 1.02;
			this.ballSpeedX *= speedIncrease;
			this.ballSpeedY *= speedIncrease;
	
			if (this.player1Score > this.player2Score + 3) {
				this.ballSpeedX *= 0.98;
				this.ballSpeedY *= 0.98;
			} else if (this.player2Score > this.player1Score + 3) {
				this.ballSpeedX *= 0.98;
				this.ballSpeedY *= 0.98;
			}
		}
	
		if (this.ballX <= 0) {
			this.player2Score++;
			this.lastLoser = 1;
			this.checkForWinner();
			this.resetBall();
		} else if (this.ballX >= this.canvas.width) {
			this.player1Score++;
			this.lastLoser = 2;
			this.checkForWinner();
			this.resetBall();
		}
	
		this.score1.textContent = this.player1Score;
		this.score2.textContent = this.player2Score;
	}
	
	

	adjustBallSpeedAndAngle() {

		const paddle1Center = this.player1Y + this.paddleHeight / 2;
		const paddle2Center = this.player2Y + this.paddleHeight / 2;
		const angle1 = (this.ballY - paddle1Center) / this.paddleHeight * Math.PI / 4;
		const angle2 = (this.ballY - paddle2Center) / this.paddleHeight * Math.PI / 4;

		this.ballSpeedY = (this.ballSpeedY > 0 ? 1 : -1) * (Math.abs(this.ballSpeedY) + 1.5);
		this.ballSpeedX = (this.ballSpeedX > 0 ? 1 : -1) * Math.abs(this.ballSpeedX) + 1;

		if (this.ballX <= this.paddleWidth) {
			this.ballSpeedY += angle1;
		} else if (this.ballX >= this.canvas.width - this.paddleWidth) {
			this.ballSpeedY += angle2;
		}
	}

	checkForWinner() {
		if (this.player1Score >= 10) {
			this.showGameOverPopup("Joueur 1");
			this.gameOver = true;
		} else if (this.player2Score >= 10) {
			this.showGameOverPopup("Joueur 2");
			this.gameOver = true;
		}
	}

	resetBall() {
		this.ballX = this.canvas.width / 2;
		this.ballY = this.canvas.height / 2;
		this.ballSpeedX = 0;
		this.ballSpeedY = 0;
		this.paused = true;
	}

	resumeBall() {
		if (!this.paused) return;
		this.paused = false;
		this.ballSpeedX = this.lastLoser === 1 ? -7 : 7;
		this.ballSpeedY = (Math.random() > 0.5 ? 1 : -1) * 7;
	}

	draw() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.fillStyle = "white";
		this.ctx.fillRect(this.canvas.width / 2 - 2, 0, 4, this.canvas.height);
		this.ctx.fillRect(0, this.player1Y, this.paddleWidth, this.paddleHeight);
		this.ctx.fillRect(this.canvas.width - this.paddleWidth, this.player2Y, this.paddleWidth, this.paddleHeight);
		this.ctx.beginPath();
		this.ctx.arc(this.ballX, this.ballY, this.ballSize / 2, 0, Math.PI * 2);
		this.ctx.fillStyle = "#f39c12";
		this.ctx.fill();
		this.ctx.closePath();
	}

	showGameOverPopup(winner) {
		const popup = document.getElementById("gameOverPopup");
		const message = popup.querySelector("h2");
		message.textContent = `Le gagnant est ${winner}!`;
		popup.style.display = "block";
	}

	resetGame() {
		this.player1Score = 0;
		this.player2Score = 0;
		this.score1.textContent = this.player1Score;
		this.score2.textContent = this.player2Score;
		this.resetBall();
		this.gameOver = false;
		document.getElementById("gameOverPopup").style.display = "none";
	}

	gameLoop() {
		this.movePaddles();
		this.moveBall();
		this.draw();
		requestAnimationFrame(() => this.gameLoop());
	}
}