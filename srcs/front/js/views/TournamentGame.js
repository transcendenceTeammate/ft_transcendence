import AbstractView from "./AbstractView.js";

export default class TournamentGame extends AbstractView {
    constructor() {
        super();
        this.setTitle("TournamentGame");
        this.players = JSON.parse(localStorage.getItem('players')) || [];
        this.currentMatch = 0;
        this.results = [];
        this.matchWinners = [];
		this.isTournament8Players = this.players.length === 8;
        this.totalMatches = this.isTournament8Players ? 7 : 3;
    }

    async getHtml() {
        const response = await fetch('/htmls/tournament-game.html');
        if (!response.ok) {
            return '<h1>Failed to load the TournamentGame HTML</h1>';
        }
        return await response.text();
    }

    onLoaded() {
        this.initGame();
        this.gameLoop();
        console.log("Players in the game: ", this.players);
        this.displayPlayers();

        document.getElementById("closeButton").addEventListener("click", () => {
            window.location.href = '/';
        });

        document.getElementById("nextButton").addEventListener("click", () => {
            this.nextMatch();
        });

        document.getElementById("quitButton").addEventListener("click", () => {
            window.location.href = '/';
        });
    }

    displayPlayers() {
		const player1Display = document.getElementById("player1Label");
		const player2Display = document.getElementById("player2Label");
	
		if (this.isTournament8Players) {
			if (this.currentMatch < 4) {
				player1Display.textContent = `${this.players[2 * this.currentMatch]}`;
				player2Display.textContent = `${this.players[2 * this.currentMatch + 1]}`;
			} else if (this.currentMatch === 4) {
				player1Display.textContent = `${this.matchWinners[0]}`;
				player2Display.textContent = `${this.matchWinners[1]}`;
			} else if (this.currentMatch === 5) {
				player1Display.textContent = `${this.matchWinners[2]}`;
				player2Display.textContent = `${this.matchWinners[3]}`;
			} else if (this.currentMatch === 6) {
				player1Display.textContent = `${this.matchWinners[4]}`; 
				player2Display.textContent = `${this.matchWinners[5]}`;
			}
		} else {
			if (this.currentMatch === 0) {
				player1Display.textContent = `${this.players[0]}`;
				player2Display.textContent = `${this.players[1]}`;
			} else if (this.currentMatch === 1) {
				player1Display.textContent = `${this.players[2]}`;
				player2Display.textContent = `${this.players[3]}`;
			} else if (this.currentMatch === 2) {
				player1Display.textContent = `${this.matchWinners[0]}`;
				player2Display.textContent = `${this.matchWinners[1]}`;
			}
		}
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

        window.addEventListener("keydown", (e) => {
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
        if (this.ballY <= 0 || this.ballY >= this.canvas.height) {
            this.ballSpeedY *= -1;
        }
        if (
            (this.ballX <= this.paddleWidth && this.ballY >= this.player1Y && this.ballY <= this.player1Y + this.paddleHeight) ||
            (this.ballX >= this.canvas.width - this.paddleWidth && this.ballY >= this.player2Y && this.ballY <= this.player2Y + this.paddleHeight)
        ) {
            this.ballSpeedX *= -1;
            if (this.ballY < this.player1Y || this.ballY < this.player2Y) {
                this.ballSpeedY = Math.abs(this.ballSpeedY);
            }
            else if (this.ballY > this.player1Y + this.paddleHeight || this.ballY > this.player2Y + this.paddleHeight) {
                this.ballSpeedY = -Math.abs(this.ballSpeedY);
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

	checkForWinner() {
		let winner;
	
		if (this.player1Score >= 10) {
			if (this.isTournament8Players) {
				// Premier tour : match 0-3
				winner = this.currentMatch < 4
					? this.players[2 * this.currentMatch] 
					: (this.currentMatch === 4
						? this.matchWinners[0]  // match 4
						: (this.currentMatch === 5
							? this.matchWinners[1]  // match 5
							: this.matchWinners[4]));  // match 6
			} else {
				winner = this.currentMatch === 0
					? this.players[0]
					: (this.currentMatch === 1
						? this.players[2]
						: this.matchWinners[0]);
			}
			this.matchWinners.push(winner);
		} else if (this.player2Score >= 10) {
			if (this.isTournament8Players) {
				// Premier tour : match 0-3
				winner = this.currentMatch < 4
					? this.players[2 * this.currentMatch + 1]
					: (this.currentMatch === 4
						? this.matchWinners[1]  // match 4
						: (this.currentMatch === 5
							? this.matchWinners[2]  // match 5
							: this.matchWinners[5]));  // match 6
			} else {
				winner = this.currentMatch === 0
					? this.players[1]
					: (this.currentMatch === 1
						? this.players[3]
						: this.matchWinners[1]);
			}
			this.matchWinners.push(winner);
		}
	
		if (winner) {
			this.showGameOverPopup(winner);
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
        message.textContent = `The winner is ${winner} !`;
        popup.style.display = "block";
    }

    nextMatch() {
        if (this.isTournament8Players) {
            if (this.currentMatch < 6) {
                this.currentMatch++;
                this.displayPlayers();
                this.resetGame();
            } else {
                this.showTournamentEndPopup();
            }
        } else {
            if (this.currentMatch === 0) {
				this.currentMatch++;
				this.displayPlayers();
				this.resetGame();
			} else if (this.currentMatch === 1) {
				this.currentMatch++;
				this.displayPlayers();
				this.resetGame();
			} else if (this.currentMatch === 2) {
				this.showTournamentEndPopup();
			}
        }
    }
	
	showTournamentEndPopup() {
		const popup = document.getElementById("gameOverPopup");
		const message = popup.querySelector("h2");
		const grandWinner = this.matchWinners[this.matchWinners.length - 1];
		message.textContent = `THE TOURNAMENT IS OVER The big winner is : ${grandWinner} !`;
		popup.style.display = "block";

		const nextButton = document.getElementById("nextButton");
		nextButton.style.display = "none";
	}	

    resetGame() {
        this.player1Score = 0;
        this.player2Score = 0;
        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;
        this.resetBall();
        document.getElementById("gameOverPopup").style.display = "none";
    }

    gameLoop() {
        this.movePaddles();
        this.moveBall();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}
