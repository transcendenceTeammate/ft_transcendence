import AbstractView from "./AbstractView.js";
import Game from "./Game.js";
import GameConstants from "../core/GameConstants.js";
import { RouterService } from "../services/router/RouterService.js";
import CONFIG from "../config.js";


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
            RouterService.getInstance().navigateTo(`/start-game`);
            return;
        }

        this.playerNumber = parseInt(localStorage.getItem('current_player_number') || '0', 10);
        this.playerId = localStorage.getItem('current_player_id');
        this.username = localStorage.getItem('current_username');

        this.socket = null;
        this.serverState = null;

        this.lastFrameTime = 0;
        this.fixedDeltaTime = 1000 / 60;
        this.accumulator = 0;

        this._lastSentPosition = null;
        this._lastStatusUpdate = 0;
        this._lastDebugUpdate = 0;
        this._lastMessageTime = 0;
        this.lastPaddleUpdate = 0;

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
        
        // Let's log the HTML to see what we're working with
        console.log("Game HTML content:", html.substring(0, 500) + "...");

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
                display: block;
            }

            .key-indicator {
                display: inline-block;
                width: 20px;
                height: 20px;
                margin: 0 5px;
                border-radius: 3px;
                background-color: #333;
                text-align: center;
                line-height: 20px;
            }

            .key-active {
                background-color: #2ecc71;
                color: black;
                font-weight: bold;
            }
        </style>
        `;

        return html;
    }

    async onLoaded() {
        this.initGame();

        this.initializeSocket();

        // Set up the close button handler with multiple approaches for reliability
        const closeButton = document.getElementById('closeButton');
        if (closeButton) {
            console.log("Found close button, attaching event listener");
            
            // Remove any existing event listeners
            closeButton.replaceWith(closeButton.cloneNode(true));
            
            // Get the fresh reference
            const refreshedCloseButton = document.getElementById('closeButton');
            
            // Make the button more visible for debugging
            refreshedCloseButton.style.cursor = 'pointer';
            refreshedCloseButton.style.zIndex = '9999';
            
            // Use multiple event types for better reliability
            const handleCloseClick = () => {
                console.log("Close button clicked");
                
                // Close socket connections
                if (this.socket) {
                    this.socket.disconnect();
                }
                
                // Clean up any modals that might be open
                this.cleanupModals();
                
                // Try navigation via the router service first
                try {
                    RouterService.getInstance().navigateTo('/start-game');
                } catch (error) {
                    console.error("Router navigation failed, using direct navigation", error);
                    // Fallback to direct navigation
                    window.location.href = '/start-game';
                }
            };
            
            refreshedCloseButton.addEventListener('click', handleCloseClick);
            refreshedCloseButton.addEventListener('mouseup', handleCloseClick);
            
            // Add touchend event for mobile support
            refreshedCloseButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleCloseClick();
            });
        } else {
            console.error("Close button not found");
            
            // Create a fallback close button if the original isn't found
            const fallbackButton = document.createElement('div');
            fallbackButton.id = 'fallbackCloseButton';
            fallbackButton.innerHTML = '&times;';
            fallbackButton.style.position = 'absolute';
            fallbackButton.style.top = '10px';
            fallbackButton.style.right = '10px';
            fallbackButton.style.fontSize = '30px';
            fallbackButton.style.color = 'white';
            fallbackButton.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            fallbackButton.style.width = '40px';
            fallbackButton.style.height = '40px';
            fallbackButton.style.borderRadius = '50%';
            fallbackButton.style.display = 'flex';
            fallbackButton.style.justifyContent = 'center';
            fallbackButton.style.alignItems = 'center';
            fallbackButton.style.cursor = 'pointer';
            fallbackButton.style.zIndex = '10000';
            
            fallbackButton.addEventListener('click', () => {
                console.log("Fallback close button clicked");
                if (this.socket) this.socket.disconnect();
                this.cleanupModals();
                window.location.href = '/start-game';
            });
            
            document.body.appendChild(fallbackButton);
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F10') {
                const debugOverlay = document.getElementById('debugOverlay');
                if (debugOverlay) {
                    debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none';
                }
            }
            
            // Add Escape key as an alternative way to exit the game
            if (e.key === 'Escape') {
                console.log("Escape key pressed, exiting game");
                if (this.socket) this.socket.disconnect();
                this.cleanupModals();
                window.location.href = '/start-game';
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

        let wsUrl = `${CONFIG.BASE_URL.replace(/^http/, "ws")}/ws/game/${this.roomCode}/`;
        if (token) {
            wsUrl += `?token=${encodeURIComponent(token)}`;
        }

        this.socket = new SimpleWebSocket(wsUrl, {
            reconnectInterval: 1000,
            maxReconnectAttempts: 5,
            debug: true
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
        if (this._keyDownHandler) {
            window.removeEventListener('keydown', this._keyDownHandler);
        }
        if (this._keyUpHandler) {
            window.removeEventListener('keyup', this._keyUpHandler);
        }

        this._keyDownHandler = (e) => {
            if (!this.playerNumber) return;

            if (e.key === "w" || e.key === "ArrowUp") {
                if (!this.upPressed) {
                    this.upPressed = true;
                    this.sendInput("up", true);
                    console.log("UP key pressed");
                }
            }
            if (e.key === "s" || e.key === "ArrowDown") {
                if (!this.downPressed) {
                    this.downPressed = true;
                    this.sendInput("down", true);
                    console.log("DOWN key pressed");
                }
            }
        };

        this._keyUpHandler = (e) => {
            if (!this.playerNumber) return;

            if (e.key === "w" || e.key === "ArrowUp") {
                if (this.upPressed) {
                    this.upPressed = false;
                    this.sendInput("up", false);
                    console.log("UP key released");
                }
            }
            if (e.key === "s" || e.key === "ArrowDown") {
                if (this.downPressed) {
                    this.downPressed = false;
                    this.sendInput("down", false);
                    console.log("DOWN key released");
                }
            }
        };

        window.addEventListener('keydown', this._keyDownHandler);
        window.addEventListener('keyup', this._keyUpHandler);

        console.log("Input handlers set up for player", this.playerNumber);
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
        if (!this.playerNumber) return;

        // Always allow paddle movement, even when game is paused
        // This allows players to position themselves while waiting for the ball to start

        // Calculate paddle movement speed adjusted for frame rate
        const actualPaddleSpeed = this.paddleSpeed * deltaTime * 60;

        // Debug input state
        if (this.upPressed || this.downPressed) {
            console.log("Processing input - Up:", this.upPressed, "Down:", this.downPressed);
        }

        // Update local paddle position based on input
        if (this.playerNumber === 1) {
            if (this.upPressed) {
                this.player1Y = Math.max(0, this.player1Y - actualPaddleSpeed);
                console.log("Moving P1 paddle up, new position:", this.player1Y);
            }
            if (this.downPressed) {
                this.player1Y = Math.min(this.canvas.height - this.paddleHeight, this.player1Y + actualPaddleSpeed);
                console.log("Moving P1 paddle down, new position:", this.player1Y);
            }
        } else if (this.playerNumber === 2) {
            if (this.upPressed) {
                this.player2Y = Math.max(0, this.player2Y - actualPaddleSpeed);
                console.log("Moving P2 paddle up, new position:", this.player2Y);
            }
            if (this.downPressed) {
                this.player2Y = Math.min(this.canvas.height - this.paddleHeight, this.player2Y + actualPaddleSpeed);
                console.log("Moving P2 paddle down, new position:", this.player2Y);
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

        // Update player labels with usernames if available
        if (data.player_1_username && document.getElementById('player1Label')) {
            document.getElementById('player1Label').textContent = data.player_1_username;
            
            // Store player 1 username for later use
            this.player1Username = data.player_1_username;
        }
        
        if (data.player_2_username && document.getElementById('player2Label')) {
            document.getElementById('player2Label').textContent = data.player_2_username;
            
            // Store player 2 username for later use
            this.player2Username = data.player_2_username;
        }

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

        // Make sure we have the username from localStorage
        if (!this.username || this.username === "undefined" || this.username === "null") {
            // Try to get it from sessionStorage or other source if available
            this.username = localStorage.getItem('username') || 
                           sessionStorage.getItem('username') || 
                           `Player ${this.playerNumber || "Unknown"}`;
            
            console.log("Retrieved username from storage:", this.username);
        }

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
        const username = data.username || 'Player ' + data.player_number;
        this.showMessage(`${username} joined the game`);
        
        // Update player labels with username
        if (data.player_number === 1 && document.getElementById('player1Label')) {
            document.getElementById('player1Label').textContent = username;
            this.player1Username = username;
        } else if (data.player_number === 2 && document.getElementById('player2Label')) {
            document.getElementById('player2Label').textContent = username;
            this.player2Username = username;
        }
        
        // If this is you, update your username
        if (data.is_you && this.playerNumber === data.player_number) {
            this.username = username;
        }
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

        // Use username if available, otherwise use default "Player X"
        const scorerUsername = data.scorer === 1 ? 
            (this.player1Username || "Player 1") : 
            (this.player2Username || "Player 2");
            
        this.showMessage(`Goal! ${scorerUsername} scored`);

        if (this.playerNumber === this.lastLoser) {
            this.showMessage("Press SPACE to start the ball", 5000);
        }
    }

    handleGameOver(data) {
        this.gameOver = true;
        const winner = data.winner === 1 ? "Player 1" : "Player 2";
        const winnerScore = data.winner === 1 ? data.player_1_score : data.player_2_score;
        const loserScore = data.winner === 1 ? data.player_2_score : data.player_1_score;
        const isWinner = (this.playerNumber === data.winner);

        this.showMessage(`Game Over! ${winner} wins!`, 3000);

        this.showGameRecap(winner, winnerScore, loserScore, isWinner);
    }

    showGameRecap(winner, winnerScore, loserScore, isWinner) {
        const existingModal = document.getElementById('gameRecapModal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        const recapModal = document.createElement('div');
        recapModal.id = 'gameRecapModal';
        recapModal.classList.add('game-recap-modal');

        const resultMessage = isWinner ?
            'Congratulations! You won!' :
            'Game over! Better luck next time!';
            
        const winnerName = winner === "Player 1" ? (this.player1Username || "Player 1") : 
                                                 (this.player2Username || "Player 2");

        recapModal.innerHTML = `
            <div class="game-recap-content">
                <h2 class="game-recap-title">${resultMessage}</h2>
                <div class="game-recap-score">
                    <div class="score-display">
                        <span class="score-label">Final Score</span>
                        <div class="score-numbers">
                            <span class="score-value">${winnerScore}</span>
                            <span class="score-divider">-</span>
                            <span class="score-value">${loserScore}</span>
                        </div>
                        <span class="winner-name">${winnerName} wins!</span>
                    </div>
                </div>
                <div class="game-recap-buttons">
                    <button id="quitButton" class="recap-button quit-button">Return to Menu</button>
                </div>
            </div>
        `;

        // Add styles to the modal
        const styles = document.createElement('style');
        styles.textContent = `
            .game-recap-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                animation: fadeIn 0.3s ease-out;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .game-recap-title {
                color: ${isWinner ? '#4caf50' : '#e74c3c'};
                margin-top: 0;
                font-size: 28px;
                margin-bottom: 20px;
            }
            
            .game-recap-content {
                position: relative;
                background-color: #222;
                border-radius: 8px;
                padding: 30px;
                width: 80%;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                border: 2px solid #444;
            }

            .game-recap-score {
                background-color: #333;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
            }

            .score-label {
                display: block;
                color: #ccc;
                font-size: 16px;
                margin-bottom: 10px;
            }

            .score-numbers {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 10px;
            }

            .score-value {
                font-size: 48px;
                font-weight: bold;
                color: white;
            }

            .score-divider {
                font-size: 36px;
                margin: 0 15px;
                color: #666;
            }

            .winner-name {
                display: block;
                color: ${isWinner ? '#4caf50' : '#e74c3c'};
                font-size: 20px;
                font-weight: bold;
                margin-top: 10px;
            }

            .game-recap-buttons {
                display: flex;
                justify-content: center;
                margin-top: 20px;
            }

            .recap-button {
                padding: 15px 30px;
                border: none;
                border-radius: 4px;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
                background-color: #e74c3c;
                color: white;
                width: 100%;
                max-width: 250px;
                position: relative;
                z-index: 10000;
            }

            .quit-button:hover {
                background-color: #c0392b;
            }
        `;

        // Add the modal and styles to the document
        document.head.appendChild(styles);
        document.body.appendChild(recapModal);

        // Add event listener to quit button - using addEventListener instead of onclick
        const quitButton = document.getElementById('quitButton');
        if (quitButton) {
            quitButton.addEventListener('click', () => {
                console.log("Return to menu button clicked");
                
                try {
                    // Force cleanup of the modal
                    const modalEl = document.getElementById('gameRecapModal');
                    if (modalEl) {
                        document.body.removeChild(modalEl);
                    }
                    
                    // Clean up any other modal artifacts
                    document.querySelectorAll('.modal-backdrop').forEach(el => {
                        if (el.parentNode) el.parentNode.removeChild(el);
                    });
                    
                    // Reset body styles
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                    
                    // First try RouterService, then direct navigation as fallback
                    try {
                        RouterService.getInstance().navigateTo('/start-game');
                    } catch (error) {
                        console.error("RouterService navigation failed, using direct navigation", error);
                        window.location.href = '/start-game';
                    }
                } catch (error) {
                    console.error("Error in quit button handler:", error);
                    // Final fallback navigation
                    window.location.replace('/start-game');
                }
            });
        } else {
            console.error("Quit button not found in the DOM");
        }
    }

    // These functions have been replaced by inline code in showGameRecap

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
            pingDisplay.textContent = `P${this.playerNumber || "S"} Connected`;
            pingDisplay.style.color = '#2ecc71'; // Green
        } else {
            indicator.classList.remove('connected', 'connecting');
            indicator.classList.add('disconnected');
            pingDisplay.textContent = "Disconnected";
            pingDisplay.style.color = '#e74c3c'; // Red
        }

        // Add player number and input state to debug info
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            const upState = this.upPressed ? "YES" : "no";
            const downState = this.downPressed ? "YES" : "no";
            const inputStateDiv = document.createElement('div');
            inputStateDiv.innerHTML = `<strong>Input:</strong> UP=${upState}, DOWN=${downState}`;

            // Replace if exists, otherwise append
            const existingInputState = debugInfo.querySelector('[data-info="input-state"]');
            if (existingInputState) {
                existingInputState.replaceWith(inputStateDiv);
            } else {
                inputStateDiv.setAttribute('data-info', 'input-state');
                debugInfo.appendChild(inputStateDiv);
            }
        }
    }

    updateDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        if (!debugInfo) return;

        // Create a more detailed debug display
        debugInfo.innerHTML = `
            <div><strong>Player:</strong> ${this.playerNumber || 'Spectator'}</div>
            <div><strong>Connected:</strong> ${this.socket?.connected ? 'Yes' : 'No'}</div>
            <div><strong>Game Paused:</strong> ${this.paused ? 'Yes' : 'No'}</div>
            <div class="control-status">
                <strong>Controls:</strong>
                <span class="key-indicator ${this.upPressed ? 'key-active' : ''}">↑</span>
                <span class="key-indicator ${this.downPressed ? 'key-active' : ''}">↓</span>
            </div>
            <div><strong>P1 Position:</strong> ${Math.round(this.player1Y)}</div>
            <div><strong>P2 Position:</strong> ${Math.round(this.player2Y)}</div>
            <div><strong>Ball:</strong> (${Math.round(this.ballX)}, ${Math.round(this.ballY)})</div>
            <div><strong>Ball Speed:</strong> (${Math.round(this.ballSpeedX)}, ${Math.round(this.ballSpeedY)})</div>
            <div><strong>Update Rate:</strong> ${this.paddleUpdateRate}ms</div>
        `;

        // Add key press event monitor
        if (!this._debugKeyMonitor) {
            this._debugKeyMonitor = true;

            // Show key presses in console
            window.addEventListener('keydown', (e) => {
                if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    console.log(`Key pressed: ${e.key}`);
                }
            });
        }
    }
}