import AbstractView from "./AbstractView.js";
import Game from "./Game.js";
import GameConstants from "../core/GameConstants.js";

// Simplified WebSocket class with essential reconnection features
class SimpleWebSocket {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: 1000,
            maxReconnectAttempts: 5,
            debug: false,
            ...options
        };

        this.socket = null;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.eventHandlers = {};
        this.messageQueue = [];
        this.connected = false;
        this.avgLatency = 50;
    }

    connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        this.log('Connecting to', this.url);

        try {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = (event) => {
                this.log('Connection established');
                this.isConnecting = false;
                this.connected = true;
                this.reconnectAttempts = 0;
                this.emit('connect', event);
                this.processQueue();
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Simple ping handling
                    if (data.type === 'ping') {
                        this.socket.send(JSON.stringify({
                            type: 'pong',
                            time: data.time,
                            timestamp: Date.now()
                        }));
                        return;
                    }

                    if (data.type) {
                        this.emit(data.type, data);
                    }
                } catch (error) {
                    this.log('Error parsing message:', error);
                }
            };

            this.socket.onclose = (event) => {
                this.log('Connection closed', event.code, event.reason);
                this.isConnecting = false;
                this.connected = false;
                this.emit('disconnect', event);

                if (!event.wasClean && this.reconnectAttempts < this.options.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
                    setTimeout(() => this.connect(), this.options.reconnectInterval);
                }
            };

            this.socket.onerror = (error) => {
                this.log('Connection error:', error);
                this.isConnecting = false;
                this.emit('error', error);
            };

        } catch (error) {
            this.log('Failed to create WebSocket:', error);
            this.isConnecting = false;
            this.emit('error', error);

            // Try to reconnect
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.options.reconnectInterval);
        }
    }

    send(type, data = {}) {
        const message = JSON.stringify({
            type,
            ...data,
            timestamp: Date.now()
        });

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(message);
            return true;
        } else {
            this.log('Socket not ready, queuing message:', type);
            this.messageQueue.push(message);
            return false;
        }
    }

    processQueue() {
        if (this.messageQueue.length === 0) return;
        this.log(`Processing queued messages (${this.messageQueue.length})`);

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(message);
            } else {
                this.messageQueue.unshift(message);
                break;
            }
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close(1000, "Normal closure");
        }
    }

    getLatency() {
        return this.avgLatency;
    }

    on(event, callback) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(callback);
    }

    off(event, callback) {
        if (!this.eventHandlers[event]) return;

        if (callback) {
            this.eventHandlers[event] = this.eventHandlers[event].filter(cb => cb !== callback);
        } else {
            delete this.eventHandlers[event];
        }
    }

    emit(event, data) {
        if (!this.eventHandlers[event]) return;

        for (const callback of this.eventHandlers[event]) {
            callback(data);
        }
    }

    log(...args) {
        if (this.options.debug) {
            console.log('[WebSocket]', ...args);
        }
    }
}

export default class OnlineGame extends Game {
    constructor() {
        super();
        this.setTitle("Online Pong");

        const urlParams = new URLSearchParams(window.location.search);
        this.roomCode = urlParams.get('room');

        if (!this.roomCode) {
            console.error("No room code provided");
            window.location.href = '/start-game';
            return;
        }

        this.playerNumber = parseInt(localStorage.getItem('current_player_number') || '0', 10);
        this.playerId = localStorage.getItem('current_player_id');
        this.username = localStorage.getItem('current_username');

        this.socket = null;
        this.serverState = null;

        // Timing variables for fixed timestep loop
        this.lastFrameTime = 0;
        this.fixedDeltaTime = 1000 / 60; // 60 FPS target
        this.accumulator = 0;

        // Game state tracking
        this._lastSentPosition = null;
        this._lastStatusUpdate = 0;
        this._lastDebugUpdate = 0;
        this._lastMessageTime = 0;
        this.lastPaddleUpdate = 0;

        // Position update rate (reduced from 16ms to 50ms = 20 updates/sec)
        this.paddleUpdateRate = 50;

        this.networkStatus = {
            connected: false
        };

        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' && this.paused && this.playerNumber) {
                this.resumeGame();
            }
        });

        this.cleanupModals();

        this.paddleWidth = GameConstants.PADDLE_WIDTH;
        this.paddleHeight = GameConstants.PADDLE_HEIGHT;
        this.paddleSpeed = GameConstants.PADDLE_SPEED;
        this.ballSize = GameConstants.BALL_SIZE;
    }

    cleanupModals() {
        document.querySelectorAll('.modal-backdrop').forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    async getHtml() {
        const response = await fetch('/htmls/game.html');
        if (!response.ok) {
            return '<h1>Failed to load the game HTML</h1>';
        }

        let html = await response.text();

        html = html.replace(
            '<div id="scoreContainer">',
            `<div id="networkStatus" class="network-status">
                <div id="connectionIndicator" class="indicator disconnected"></div>
                <span id="pingDisplay">--</span>
            </div>
            <div id="debugOverlay" class="debug-overlay">
                <div id="debugInfo"></div>
            </div>
            <div id="scoreContainer">`
        );

        html += `
        <style>
            .network-status {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: monospace;
                font-size: 12px;
                z-index: 100;
            }

            .indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                transition: background-color 0.3s;
            }

            .connected { background-color: #2ecc71; }
            .connecting { background-color: #f39c12; }
            .disconnected { background-color: #e74c3c; }

            .debug-overlay {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                z-index: 100;
                display: none;
            }
        </style>
        `;

        return html;
    }

    async onLoaded() {
        this.initGame();

        this.initializeSocket();

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F10') {
                const debugOverlay = document.getElementById('debugOverlay');
                if (debugOverlay) {
                    debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none';
                }
            }
        });

        this.gameLoop = this.gameLoop.bind(this);

        requestAnimationFrame(this.gameLoop);
    }

    initGame() {
        this.canvas = document.getElementById("gameCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.score1 = document.getElementById("player1Score");
        this.score2 = document.getElementById("player2Score");

        this.paddleWidth = GameConstants.PADDLE_WIDTH;
        this.paddleHeight = GameConstants.PADDLE_HEIGHT;
        this.player1Y = (this.canvas.height - this.paddleHeight) / 2;
        this.player2Y = (this.canvas.height - this.paddleHeight) / 2;

        this.paddleSpeed = GameConstants.PADDLE_SPEED * 1.2;

        this.opponentPaddleTarget = this.playerNumber === 1 ? this.player2Y : this.player1Y;
        this.opponentPaddleCurrent = this.opponentPaddleTarget;
        this.interpolationSpeed = 0.3;

        this.ballSize = GameConstants.BALL_SIZE;
        this.ballX = this.canvas.width / 2;
        this.ballY = this.canvas.height / 2;
        this.ballSpeedX = 0;
        this.ballSpeedY = 0;

        this.player1Score = 0;
        this.player2Score = 0;
        this.upPressed = false;
        this.downPressed = false;
        this.paused = true;
        this.lastLoser = null;
        this.gameOver = false;

        this.lastPaddleUpdate = 0;
    }

    initializeSocket() {
        const token = this.getAuthToken();

        let wsUrl = `wss://app.10.24.1.5.nip.io:8443/ws/game/${this.roomCode}/`;
        if (token) {
            wsUrl += `?token=${encodeURIComponent(token)}`;
        }

        this.socket = new SimpleWebSocket(wsUrl, {
            reconnectInterval: 1000,
            maxReconnectAttempts: 5,
            debug: true // Enable debugging
        });

        this.socket.on('connect', this.handleConnect.bind(this));
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
        this.socket.on('error', this.handleError.bind(this));

        this.socket.on('game_state', this.handleGameState.bind(this));
        this.socket.on('game_state_delta', this.handleGameStateDelta.bind(this));
        this.socket.on('player_joined', this.handlePlayerJoined.bind(this));
        this.socket.on('player_left', this.handlePlayerLeft.bind(this));
        this.socket.on('goal_scored', this.handleGoalScored.bind(this));
        this.socket.on('game_over', this.handleGameOver.bind(this));
        this.socket.on('game_paused', this.handleGamePaused.bind(this));
        this.socket.on('game_resumed', this.handleGameResumed.bind(this));

        this.socket.connect();

        this.setupNetworkedInput();
    }

    getAuthToken() {
        function getCookie(name) {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? match[2] : null;
        }

        return getCookie('access_token') || localStorage.getItem('access_token') || null;
    }

    setupNetworkedInput() {
        window.removeEventListener('keydown', this._keyDownHandler);
        window.removeEventListener('keyup', this._keyUpHandler);

        this._keyDownHandler = (e) => {
            if (!this.playerNumber) return;

            let keyChanged = false;

            if (this.playerNumber === 1 || this.playerNumber === 2) {
                if (e.key === "w" || e.key === "ArrowUp") {
                    if (!this.upPressed) {
                        this.upPressed = true;
                        keyChanged = true;
                        this.sendInput("up", true);
                    }
                }
                if (e.key === "s" || e.key === "ArrowDown") {
                    if (!this.downPressed) {
                        this.downPressed = true;
                        keyChanged = true;
                        this.sendInput("down", true);
                    }
                }
            }
        };

        this._keyUpHandler = (e) => {
            if (!this.playerNumber) return;

            let keyChanged = false;

            if (this.playerNumber === 1 || this.playerNumber === 2) {
                if (e.key === "w" || e.key === "ArrowUp") {
                    if (this.upPressed) {
                        this.upPressed = false;
                        keyChanged = true;
                        this.sendInput("up", false);
                    }
                }
                if (e.key === "s" || e.key === "ArrowDown") {
                    if (this.downPressed) {
                        this.downPressed = false;
                        keyChanged = true;
                        this.sendInput("down", false);
                    }
                }
            }
        };

        window.addEventListener('keydown', this._keyDownHandler);
        window.addEventListener('keyup', this._keyUpHandler);
    }

    sendInput(key, isDown) {
        if (!this.socket || !this.playerNumber) return;

        const input = {
            key,
            is_down: isDown,
            player_number: this.playerNumber
        };

        this.socket.send('key_event', input);
    }

    gameLoop(timestamp) {
        if (this.gameOver) return;

        // Calculate time since last frame
        const currentTime = timestamp || performance.now();
        let deltaTime = this.lastFrameTime ? currentTime - this.lastFrameTime : this.fixedDeltaTime;
        this.lastFrameTime = currentTime;

        // Cap delta time to prevent spiraling with large gaps
        if (deltaTime > 100) deltaTime = 100;

        // Fixed time step accumulation
        this.accumulator += deltaTime;

        // Process input immediately for responsiveness
        this.processPlayerInput(deltaTime / 1000);

        // Update with fixed time steps
        while (this.accumulator >= this.fixedDeltaTime) {
            this.update(this.fixedDeltaTime / 1000);
            this.accumulator -= this.fixedDeltaTime;
        }

        // Render at display refresh rate
        this.draw();

        // Update network status (rate limited)
        const now = currentTime;
        if (now - this._lastStatusUpdate > 500) {
            this.updateConnectionStatus();
            this._lastStatusUpdate = now;

            // Update debug info if overlay is visible
            const debugOverlay = document.getElementById('debugOverlay');
            if (debugOverlay && debugOverlay.style.display === 'block') {
                this.updateDebugInfo();
            }
        }

        // Continue loop
        requestAnimationFrame(this.gameLoop);
    }

    processPlayerInput(deltaTime) {
        if (!this.playerNumber || this.paused) return;

        // Calculate paddle movement speed adjusted for frame rate
        const actualPaddleSpeed = this.paddleSpeed * deltaTime * 60;

        // Update local paddle position based on input
        if (this.playerNumber === 1) {
            if (this.upPressed) {
                this.player1Y = Math.max(0, this.player1Y - actualPaddleSpeed);
            }
            if (this.downPressed) {
                this.player1Y = Math.min(this.canvas.height - this.paddleHeight, this.player1Y + actualPaddleSpeed);
            }
        } else if (this.playerNumber === 2) {
            if (this.upPressed) {
                this.player2Y = Math.max(0, this.player2Y - actualPaddleSpeed);
            }
            if (this.downPressed) {
                this.player2Y = Math.min(this.canvas.height - this.paddleHeight, this.player2Y + actualPaddleSpeed);
            }
        }
    }

    update(deltaTime) {
        // Interpolate opponent paddle position
        this.interpolateOpponentPaddle();

        // Send paddle position updates (rate limited)
        const now = Date.now();
        if (now - this.lastPaddleUpdate > this.paddleUpdateRate) {
            this.sendPaddlePosition();
            this.lastPaddleUpdate = now;
        }
    }

    interpolateOpponentPaddle() {
        if (!this.serverState) return;

        // Simple interpolation factor (lower = smoother but more lag)
        const factor = 0.15;

        if (this.playerNumber === 1) {
            // Player 1's opponent is Player 2
            const targetY = this.serverState.player_2_paddle_y;
            const diff = targetY - this.player2Y;
            if (Math.abs(diff) > 0.1) {
                this.player2Y += diff * factor;
            }
        } else if (this.playerNumber === 2) {
            // Player 2's opponent is Player 1
            const targetY = this.serverState.player_1_paddle_y;
            const diff = targetY - this.player1Y;
            if (Math.abs(diff) > 0.1) {
                this.player1Y += diff * factor;
            }
        } else {
            // Spectator mode - interpolate both paddles
            const target1Y = this.serverState.player_1_paddle_y;
            const target2Y = this.serverState.player_2_paddle_y;

            this.player1Y += (target1Y - this.player1Y) * factor;
            this.player2Y += (target2Y - this.player2Y) * factor;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.canvas.width / 2 - 2, 0, 4, this.canvas.height);

        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, this.player1Y, this.paddleWidth, this.paddleHeight);
        this.ctx.fillRect(this.canvas.width - this.paddleWidth, this.player2Y, this.paddleWidth, this.paddleHeight);

        this.ctx.beginPath();
        this.ctx.arc(this.ballX, this.ballY, this.ballSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = "#f39c12";
        this.ctx.fill();
        this.ctx.closePath();
    }

    handleGameState(data) {
        // Store the full server state
        this.serverState = { ...data };

        // Update scores
        this.player1Score = data.player_1_score;
        this.player2Score = data.player_2_score;
        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;

        // Use server's ball position directly (no prediction)
        this.ballX = data.ball_x;
        this.ballY = data.ball_y;
        this.ballSpeedX = data.ball_speed_x;
        this.ballSpeedY = data.ball_speed_y;

        // Update game state
        this.paused = data.is_paused;
        this.lastLoser = data.last_loser;

        // Apply gentle server correction for local paddle if needed
        if (this.playerNumber === 1) {
            const serverY = data.player_1_paddle_y;
            if (Math.abs(this.player1Y - serverY) > 20) {
                // Apply a gentle correction (80% local, 20% server)
                this.player1Y = this.player1Y * 0.8 + serverY * 0.2;
            }
        } else if (this.playerNumber === 2) {
            const serverY = data.player_2_paddle_y;
            if (Math.abs(this.player2Y - serverY) > 20) {
                // Apply a gentle correction (80% local, 20% server)
                this.player2Y = this.player2Y * 0.8 + serverY * 0.2;
            }
        } else {
            // Spectator mode - use server positions directly
            this.player1Y = data.player_1_paddle_y;
            this.player2Y = data.player_2_paddle_y;
        }
    }

    flashBall(count = 3, delay = 200) {
        if (!this.ctx) return;

        const flashOnce = () => {
            const originalFillStyle = this.ctx.fillStyle;
            this.ctx.fillStyle = "#ffcc00";
            this.ctx.beginPath();
            this.ctx.arc(this.ballX, this.ballY, this.ballSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.closePath();
            this.ctx.fillStyle = originalFillStyle;
        };

        flashOnce();

        for (let i = 1; i < count; i++) {
            setTimeout(flashOnce, i * delay);
        }
    }

    handleGameResumed(data) {
        this.paused = false;

        if (data.ball_speed_x !== undefined) {
            this.ballSpeedX = data.ball_speed_x;
        }

        if (data.ball_speed_y !== undefined) {
            this.ballSpeedY = data.ball_speed_y;
        }

        this.showMessage(`Game resumed by Player ${data.player_number}`);

        this.flashBall();
    }

    handleConnect() {
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) {
            indicator.classList.remove('disconnected', 'connecting');
            indicator.classList.add('connected');
        }

        this.networkStatus.connected = true;

        this.showMessage(`Connected! You are Player ${this.playerNumber}`);

        this.socket.send('join_game', {
            player_id: this.playerId,
            username: this.username
        });
    }

    handleDisconnect() {
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) {
            indicator.classList.remove('connected', 'connecting');
            indicator.classList.add('disconnected');
        }

        this.networkStatus.connected = false;

        this.showMessage("Connection lost. Attempting to reconnect...");
    }

    handleError(error) {
        this.showMessage("Connection error. Please try refreshing the page.");
    }

    handleGameStateDelta(data) {
        if (!this.serverState) {
            return;
        }

        // Apply delta changes to stored server state
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'type' && key !== 'timestamp' && key !== 'is_full_state') {
                this.serverState[key] = value;
            }
        });

        // Process updated state
        this.handleGameState(this.serverState);
    }

    handlePlayerJoined(data) {
        this.showMessage(`${data.username || 'Player ' + data.player_number} joined the game`);
    }

    handlePlayerLeft(data) {
        this.showMessage(`${data.username || 'Player ' + data.player_number} left the game`);
    }

    handleGoalScored(data) {
        this.player1Score = data.player_1_score;
        this.player2Score = data.player_2_score;
        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;

        this.lastLoser = data.scorer === 1 ? 2 : 1;

        const scorer = data.scorer === 1 ? "Player 1" : "Player 2";
        this.showMessage(`Goal! ${scorer} scored`);

        if (this.playerNumber === this.lastLoser) {
            this.showMessage("Press SPACE to start the ball", 5000);
        }
    }

    handleGameOver(data) {
        this.gameOver = true;
        const winner = data.winner === 1 ? "Player 1" : "Player 2";

        this.showMessage(`Game Over! ${winner} wins!`, 10000);

        // Show game over screen and redirect after a delay
        setTimeout(() => {
            if (this.playerNumber) {
                window.location.href = '/game-results?room=' + this.roomCode;
            }
        }, 5000);
    }

    handleGamePaused(data) {
        this.paused = true;

        this.showMessage(`Game paused by Player ${data.player_number}`);
    }

    pauseGame() {
        if (this.socket && this.playerNumber) {
            this.socket.send('pause_game', {
                player_number: this.playerNumber
            });
        }
    }

    resumeGame() {
        if (this.socket && this.playerNumber) {
            if (this.playerNumber !== this.lastLoser && this.player1Score + this.player2Score > 0) {
                this.showMessage("Wait for the other player to start the ball");
                return;
            }

            const initialSpeedX = this.lastLoser === 1 ?
                -GameConstants.BALL_INITIAL_SPEED_X :
                GameConstants.BALL_INITIAL_SPEED_X;

            const initialSpeedY = (Math.random() > 0.5 ? 1 : -1) *
                GameConstants.BALL_INITIAL_SPEED_Y;

            this.socket.send('resume_game', {
                player_number: this.playerNumber,
                ball_speed_x: initialSpeedX,
                ball_speed_y: initialSpeedY
            });

            this.showMessage(`Starting the ball...`);

            this.flashBall();
        }
    }

    sendPaddlePosition() {
        if (!this.socket || !this.playerNumber) return;

        const position = this.playerNumber === 1 ? this.player1Y : this.player2Y;

        // Only send if position has changed significantly
        if (this._lastSentPosition !== null &&
            Math.abs(this._lastSentPosition - position) <= 2) {
            return;
        }

        this._lastSentPosition = position;

        this.socket.send('paddle_position', {
            player_number: this.playerNumber,
            position: position
        });
    }

    showMessage(message, duration = 3000) {
        const now = Date.now();
        if (this._lastMessageTime && now - this._lastMessageTime < 500) {
            return;
        }
        this._lastMessageTime = now;

        let messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'messageContainer';
            messageContainer.style.position = 'absolute';
            messageContainer.style.bottom = '20px';
            messageContainer.style.left = '50%';
            messageContainer.style.transform = 'translateX(-50%)';
            messageContainer.style.zIndex = '1000';
            document.body.appendChild(messageContainer);
        }

        while (messageContainer.children.length >= 3) {
            messageContainer.removeChild(messageContainer.firstChild);
        }

        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        messageElement.style.color = 'white';
        messageElement.style.padding = '8px 16px';
        messageElement.style.borderRadius = '4px';
        messageElement.style.marginBottom = '8px';
        messageElement.style.transition = 'opacity 0.5s';
        messageElement.style.opacity = '0';

        messageContainer.appendChild(messageElement);

        setTimeout(() => {
            messageElement.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageContainer.removeChild(messageElement);
                }
            }, 500);
        }, duration);
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connectionIndicator');
        const pingDisplay = document.getElementById('pingDisplay');

        if (!indicator || !pingDisplay) return;

        // Update connection indicator
        if (this.socket && this.socket.connected) {
            indicator.classList.remove('disconnected', 'connecting');
            indicator.classList.add('connected');
            pingDisplay.textContent = "Connected";
        } else {
            indicator.classList.remove('connected', 'connecting');
            indicator.classList.add('disconnected');
            pingDisplay.textContent = "Disconnected";
        }
    }

    updateDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        if (!debugInfo) return;

        // Show simplified debug info
        const info = {
            'Player': this.playerNumber || 'Spectator',
            'Connected': this.socket?.connected ? 'Yes' : 'No',
            'Ball Position': `(${Math.round(this.ballX)}, ${Math.round(this.ballY)})`,
            'Ball Speed': `(${Math.round(this.ballSpeedX)}, ${Math.round(this.ballSpeedY)})`,
            'P1 Position': Math.round(this.player1Y),
            'P2 Position': Math.round(this.player2Y),
            'Game Paused': this.paused ? 'Yes' : 'No',
            'Update Rate': `${this.paddleUpdateRate}ms`
        };

        let html = '';
        for (const [key, value] of Object.entries(info)) {
            html += `<div><strong>${key}:</strong> ${value}</div>`;
        }

        debugInfo.innerHTML = html;
    }
}