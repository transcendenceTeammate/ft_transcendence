import AbstractView from "./AbstractView.js";
import Game from "./Game.js";
import GameConstants from "../core/GameConstants.js";

/**
 * Enhanced WebSocket client with reconnection and event handling
 */
class EnhancedWebSocket {
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
        this.lastConnectionState = WebSocket.CLOSED;
        this.latencyMeasurements = [];
        this.lastPingSent = 0;
        this.avgLatency = 50; // Default 50ms until we measure
        this.messageQueue = [];
        this.sequenceNumber = 0;
        this.lastAcknowledgedSequence = 0;
    }

    connect() {
        if (this.isConnecting) return;

        this.isConnecting = true;

        try {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = (event) => {
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.emit('connect', event);

                // Send any queued messages
                this.processQueue();
            };

            this.socket.onmessage = (event) => {
                this.handleIncomingMessage(event);
            };

            this.socket.onclose = (event) => {
                this.isConnecting = false;

                if (this.lastConnectionState === WebSocket.OPEN) {
                    this.emit('disconnect', event);
                }

                this.lastConnectionState = this.socket.readyState;

                // Attempt to reconnect if not explicitly closed by user
                if (!event.wasClean && this.reconnectAttempts < this.options.maxReconnectAttempts) {
                    this.attemptReconnect();
                }
            };

            this.socket.onerror = (error) => {
                this.isConnecting = false;
                this.emit('error', error);
            };

            this.lastConnectionState = WebSocket.CONNECTING;

        } catch (error) {
            this.isConnecting = false;
            this.emit('error', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        this.reconnectAttempts++;

        setTimeout(() => {
            this.connect();
        }, this.options.reconnectInterval);
    }

    disconnect() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close(1000, "Normal closure");
        }
    }

    send(type, data = {}) {
        // Generate a new sequence number for messages that need acknowledgment
        if (['key_event', 'paddle_position', 'client_prediction'].includes(type)) {
            this.sequenceNumber++;
            data.sequence = this.sequenceNumber;
        }

        const message = JSON.stringify({
            type,
            ...data,
            client_time: Date.now()
        });

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(message);
            return true;
        } else {
            // Queue message to send when connection is established
            this.messageQueue.push(message);
            return false;
        }
    }

    processQueue() {
        if (this.messageQueue.length === 0) return;

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(message);
            } else {
                // Re-queue message if socket is not open
                this.messageQueue.unshift(message);
                break;
            }
        }
    }

    handleIncomingMessage(event) {
        try {
            const data = JSON.parse(event.data);

            // Handle ping/pong for latency measurement
            if (data.type === 'ping') {
                // Immediately send pong back to server with the same timestamp
                this.send('pong', { time: data.time });
                return;
            }

            // Handle input acknowledgments for latency compensation
            if (data.type === 'input_ack' && data.sequence) {
                const rtt = Date.now() - data.server_time;
                this.updateLatencyMeasurement(rtt);
                this.lastAcknowledgedSequence = Math.max(this.lastAcknowledgedSequence, data.sequence);
                return;
            }

            // Handle prediction acknowledgments
            if (data.type === 'prediction_ack' && data.sequence) {
                const rtt = Date.now() - data.server_time;
                this.updateLatencyMeasurement(rtt);
                this.emit('prediction_ack', data);
                return;
            }

            // Emit event based on message type
            if (data.type) {
                this.emit(data.type, data);
            }

        } catch (error) {
            if (this.options.debug) {
                console.log('Error parsing WebSocket message:', error);
            }
        }
    }

    updateLatencyMeasurement(rtt) {
        // Calculate one-way latency (half of RTT)
        const latency = rtt / 2;

        // Keep last 10 measurements
        this.latencyMeasurements.push(latency);
        if (this.latencyMeasurements.length > 10) {
            this.latencyMeasurements.shift();
        }

        // Calculate average latency (removing outliers)
        if (this.latencyMeasurements.length > 3) {
            const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);
            const withoutExtremes = sorted.slice(1, -1); // Remove highest and lowest
            this.avgLatency = withoutExtremes.reduce((sum, val) => sum + val, 0) / withoutExtremes.length;
        } else {
            this.avgLatency = this.latencyMeasurements.reduce((sum, val) => sum + val, 0) / this.latencyMeasurements.length;
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

/**
 * Online Pong Game with prediction and reconciliation
 */
export default class OnlineGame extends Game {
    constructor() {
        super();
        this.setTitle("Online Pong");

        // Get room code from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.roomCode = urlParams.get('room');

        if (!this.roomCode) {
            console.error("No room code provided");
            window.location.href = '/start-game';
            return;
        }

        // Player info
        this.playerNumber = parseInt(localStorage.getItem('current_player_number') || '0', 10);
        this.playerId = localStorage.getItem('current_player_id');
        this.username = localStorage.getItem('current_username');

        // Networking
        this.socket = null;
        this.lastReceivedState = null;
        this.predictionEnabled = true;
        this.reconciliationEnabled = true;

        // Input tracking (simplify to reduce overhead)
        this.pendingInputs = [];

        // Performance optimizations
        this._lastSentPosition = null;
        this._lastStatusUpdate = 0;
        this._lastDebugUpdate = 0;
        this._lastMessageTime = 0;
        this.lastPaddleUpdate = 0;

        // Network status display
        this.networkStatus = {
            connected: false,
            latency: 0
        };

        // Add space bar handler to resume the ball (only when paused)
        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' && this.paused && this.playerNumber) {
                // Send resume message directly to the server
                this.resumeGame();
            }
        });

        // Clean up any modals from previous screens
        this.cleanupModals();

        // Use constants from shared file
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
        // Load the game HTML template
        const response = await fetch('/htmls/game.html');
        if (!response.ok) {
            return '<h1>Failed to load the game HTML</h1>';
        }

        // Add simple network status and debug overlay
        let html = await response.text();

        // Insert network status indicator
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

        // Add CSS for network status and debug overlay
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
        // Initialize base game components from Game.js
        this.initGame();

        // Initialize WebSocket connection
        this.initializeSocket();

        // Set F10 key to toggle debug overlay
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F10') {
                const debugOverlay = document.getElementById('debugOverlay');
                if (debugOverlay) {
                    debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none';
                }
            }
        });

        // Override the game loop with enhanced prediction
        this.gameLoop = this.enhancedGameLoop.bind(this);

        // Start the game loop
        requestAnimationFrame(this.gameLoop);
    }

    initGame() {
        // Initialize game canvas and score display
        this.canvas = document.getElementById("gameCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.score1 = document.getElementById("player1Score");
        this.score2 = document.getElementById("player2Score");

        // Initialize game with constants from the shared file
        this.paddleWidth = GameConstants.PADDLE_WIDTH;
        this.paddleHeight = GameConstants.PADDLE_HEIGHT;
        this.player1Y = (this.canvas.height - this.paddleHeight) / 2;
        this.player2Y = (this.canvas.height - this.paddleHeight) / 2;

        // Use a slightly faster paddle speed for more responsive controls
        this.paddleSpeed = GameConstants.PADDLE_SPEED * 1.2;

        // Add interpolation properties for opponent paddle
        this.opponentPaddleTarget = this.playerNumber === 1 ? this.player2Y : this.player1Y;
        this.opponentPaddleCurrent = this.opponentPaddleTarget;
        this.interpolationSpeed = 0.3; // Adjust for smoother/faster interpolation

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

        // Network stats
        this.lastPaddleUpdate = 0;
    }

    initializeSocket() {
        // Get authentication token
        const token = this.getAuthToken();

        // Create WebSocket URL with room code and token (if available)
        let wsUrl = `wss://app.10.24.108.2.nip.io:8443/ws/game/${this.roomCode}/`;
        if (token) {
            wsUrl += `?token=${encodeURIComponent(token)}`;
        }

        // Initialize enhanced WebSocket with reconnection
        this.socket = new EnhancedWebSocket(wsUrl, {
            reconnectInterval: 2000,
            maxReconnectAttempts: 5
        });

        // Handle WebSocket events
        this.socket.on('connect', this.handleConnect.bind(this));
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
        this.socket.on('error', this.handleError.bind(this));

        // Game state events
        this.socket.on('game_state', this.handleGameState.bind(this));
        this.socket.on('game_state_delta', this.handleGameStateDelta.bind(this));
        this.socket.on('player_joined', this.handlePlayerJoined.bind(this));
        this.socket.on('player_left', this.handlePlayerLeft.bind(this));
        this.socket.on('goal_scored', this.handleGoalScored.bind(this));
        this.socket.on('game_over', this.handleGameOver.bind(this));
        this.socket.on('game_paused', this.handleGamePaused.bind(this));
        this.socket.on('game_resumed', this.handleGameResumed.bind(this));

        // Connect to server
        this.socket.connect();

        // Remove Game.js keyboard listeners and add our networked ones
        this.setupNetworkedInput();
    }

    getAuthToken() {
        // Try to get token from cookies first
        function getCookie(name) {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? match[2] : null;
        }

        // Try cookie first, then localStorage
        return getCookie('access_token') || localStorage.getItem('access_token') || null;
    }

    setupNetworkedInput() {
        // Remove default keyboard listeners from Game.js
        window.removeEventListener('keydown', this._keyDownHandler);
        window.removeEventListener('keyup', this._keyUpHandler);

        // Create new handlers that send input to server with priority on local movement
        this._keyDownHandler = (e) => {
            // Only handle input if we're an actual player (not spectator)
            if (!this.playerNumber) return;

            let keyChanged = false;

            // Handle player controls with immediate local updates
            if (this.playerNumber === 1 || this.playerNumber === 2) {
                if (e.key === "w" || e.key === "ArrowUp") {
                    // Only update and send if state changed
                    if (!this.upPressed) {
                        this.upPressed = true;
                        keyChanged = true;
                        this.sendInput("up", true);
                    }
                }
                if (e.key === "s" || e.key === "ArrowDown") {
                    // Only update and send if state changed
                    if (!this.downPressed) {
                        this.downPressed = true;
                        keyChanged = true;
                        this.sendInput("down", true);
                    }
                }
            }
        };

        this._keyUpHandler = (e) => {
            // Only handle input if we're an actual player (not spectator)
            if (!this.playerNumber) return;

            let keyChanged = false;

            // Handle player controls with immediate local updates
            if (this.playerNumber === 1 || this.playerNumber === 2) {
                if (e.key === "w" || e.key === "ArrowUp") {
                    // Only update and send if state changed
                    if (this.upPressed) {
                        this.upPressed = false;
                        keyChanged = true;
                        this.sendInput("up", false);
                    }
                }
                if (e.key === "s" || e.key === "ArrowDown") {
                    // Only update and send if state changed
                    if (this.downPressed) {
                        this.downPressed = false;
                        keyChanged = true;
                        this.sendInput("down", false);
                    }
                }
            }
        };

        // Add our optimized input handlers
        window.addEventListener('keydown', this._keyDownHandler);
        window.addEventListener('keyup', this._keyUpHandler);
    }

    sendInput(key, isDown) {
        if (!this.socket || !this.playerNumber) return;

        // Create input object (minimal)
        const input = {
            key,
            is_down: isDown,
            player_number: this.playerNumber
        };

        // Send to server right away - no need to store pending inputs
        // when we prioritize local movement first
        this.socket.send('key_event', input);
    }

    enhancedGameLoop(timestamp) {
        // Call the next frame
        requestAnimationFrame(this.gameLoop);

        // Skip if game is over
        if (this.gameOver) return;

        // Calculate delta time with a fixed step for consistent physics
        const now = timestamp || performance.now();
        const deltaTime = 1 / 60; // Fixed 60fps timestep for smoother movement
        this.lastFrameTime = now;

        // Process inputs first to ensure responsive controls
        this.processPlayerInput(deltaTime);

        // Then handle game state updates
        this.updateWithPrediction(deltaTime);

        // Draw the current game state
        this.draw();

        // Update connection status indicator (only every 500ms)
        if (!this._lastStatusUpdate || now - this._lastStatusUpdate > 500) {
            this.updateConnectionStatus();
            this._lastStatusUpdate = now;
        }

        // Update debug info if overlay is visible (only every 500ms)
        const debugOverlay = document.getElementById('debugOverlay');
        if (debugOverlay && debugOverlay.style.display === 'block') {
            if (!this._lastDebugUpdate || now - this._lastDebugUpdate > 500) {
                this.updateDebugInfo();
                this._lastDebugUpdate = now;
            }
        }
    }

    // New method to prioritize input processing
    processPlayerInput(deltaTime) {
        if (!this.playerNumber) return;

        const actualPaddleSpeed = this.paddleSpeed * (deltaTime * 60);

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

    updateWithPrediction(deltaTime) {
        // Only predict if enabled and we're a player (not spectator)
        if (this.predictionEnabled && this.playerNumber) {
            // Movement is now handled in processPlayerInput
            // This ensures inputs are processed immediately

            // Interpolate opponent paddle movement for smoothness
            this.interpolateOpponentPaddle(deltaTime);

            // Only send paddle position updates at a controlled rate (10 updates/sec)
            const now = Date.now();
            if (now - this.lastPaddleUpdate > 16) {
                this.sendPaddlePosition();
                this.lastPaddleUpdate = now;
            }
        }
    }

    // Improve the interpolation method for smoother movement
    interpolateOpponentPaddle(deltaTime) {
        // Increase the interpolation factor for smoother opponent movement
        const factor = 0.35; // Higher value = smoother, more responsive opponent paddle

        if (this.playerNumber === 1) {
            // We control player 1, interpolate player 2
            const diff = this.opponentPaddleTarget - this.player2Y;
            if (Math.abs(diff) > 0.1) {
                this.player2Y += diff * factor;
            }
        } else if (this.playerNumber === 2) {
            // We control player 2, interpolate player 1
            const diff = this.opponentPaddleTarget - this.player1Y;
            if (Math.abs(diff) > 0.1) {
                this.player1Y += diff * factor;
            }
        }
    }

    // Override draw to show network status
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw middle line
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.canvas.width / 2 - 2, 0, 4, this.canvas.height);

        // Draw paddles
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, this.player1Y, this.paddleWidth, this.paddleHeight);
        this.ctx.fillRect(this.canvas.width - this.paddleWidth, this.player2Y, this.paddleWidth, this.paddleHeight);

        // Draw ball
        this.ctx.beginPath();
        this.ctx.arc(this.ballX, this.ballY, this.ballSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = "#f39c12";
        this.ctx.fill();
        this.ctx.closePath();
    }

    // Handle game state from server - ball is fully server authoritative
    handleGameState(data) {
        // Store last received state for reconciliation
        this.lastReceivedState = { ...data };

        // Update game state from server - always trust server for ball position
        this.player1Score = data.player_1_score;
        this.player2Score = data.player_2_score;

        // Update paddle positions with interpolation for opponent
        if (this.playerNumber === 1) {
            // We're player 1, so player 2 is the opponent
            this.opponentPaddleTarget = data.player_2_paddle_y;
        } else if (this.playerNumber === 2) {
            // We're player 2, so player 1 is the opponent
            this.opponentPaddleTarget = data.player_1_paddle_y;
        } else {
            // Spectator - trust server for both paddles
            this.player1Y = data.player_1_paddle_y;
            this.player2Y = data.player_2_paddle_y;
        }

        // Always trust server for ball position
        this.ballX = data.ball_x;
        this.ballY = data.ball_y;
        this.ballSpeedX = data.ball_speed_x;
        this.ballSpeedY = data.ball_speed_y;
        this.paused = data.is_paused;

        // Update score display
        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;

        // Perform reconciliation if enabled
        if (this.reconciliationEnabled && this.playerNumber) {
            // Only reconcile our own paddle
            if (this.playerNumber === 1) {
                this.reconcilePlayerPaddle(data.player_1_paddle_y, 1);
            } else if (this.playerNumber === 2) {
                this.reconcilePlayerPaddle(data.player_2_paddle_y, 2);
            }
        }
    }

    // Simplify reconciliation to focus only on large discrepancies
    reconcilePlayerPaddle(serverPaddleY, playerNum) {
        const clientPaddleY = playerNum === 1 ? this.player1Y : this.player2Y;

        // Only reconcile for large discrepancies (10+ pixels)
        if (Math.abs(serverPaddleY - clientPaddleY) > 10) {
            // Very gentle blend that favors client position (90%) over server position (10%)
            if (playerNum === 1) {
                this.player1Y = serverPaddleY * 0.1 + clientPaddleY * 0.9;
            } else {
                this.player2Y = serverPaddleY * 0.1 + clientPaddleY * 0.9;
            }
        }
    }

    // Centralize ball flashing as a standalone method
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

        // Flash immediately once
        flashOnce();

        // Schedule additional flashes
        for (let i = 1; i < count; i++) {
            setTimeout(flashOnce, i * delay);
        }
    }

    // Update handleGameResumed to use the centralized method
    handleGameResumed(data) {
        this.paused = false;

        // Always trust server for ball velocity
        if (data.ball_speed_x !== undefined) {
            this.ballSpeedX = data.ball_speed_x;
        }

        if (data.ball_speed_y !== undefined) {
            this.ballSpeedY = data.ball_speed_y;
        }

        // Show notification
        this.showMessage(`Game resumed by Player ${data.player_number}`);

        // Flash ball
        this.flashBall();
    }

    // WebSocket event handlers
    handleConnect() {
        // Update connection indicator
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) {
            indicator.classList.remove('disconnected', 'connecting');
            indicator.classList.add('connected');
        }

        this.networkStatus.connected = true;

        // Show connection message
        this.showMessage(`Connected! You are Player ${this.playerNumber}`);

        // Send join game message with player info
        this.socket.send('join_game', {
            player_id: this.playerId,
            username: this.username
        });
    }

    handleDisconnect() {
        // Update connection indicator
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) {
            indicator.classList.remove('connected', 'connecting');
            indicator.classList.add('disconnected');
        }

        this.networkStatus.connected = false;

        // Show reconnection message
        this.showMessage("Connection lost. Attempting to reconnect...");
    }

    handleError(error) {
        // Show error message
        this.showMessage("Connection error. Please try refreshing the page.");
    }

    handleGameStateDelta(data) {
        // Only apply delta if we have a previous state
        if (!this.lastReceivedState) {
            return;
        }

        // Apply delta to last state
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'type' && key !== 'timestamp' && key !== 'sequence') {
                this.lastReceivedState[key] = value;
            }
        });

        // Handle as if it was a full state update
        this.handleGameState(this.lastReceivedState);
    }

    handlePlayerJoined(data) {
        // Show notification
        this.showMessage(`${data.username || 'Player ' + data.player_number} joined the game`);
    }

    handlePlayerLeft(data) {
        // Show notification
        this.showMessage(`${data.username || 'Player ' + data.player_number} left the game`);
    }

    handleGoalScored(data) {
        // Update scores
        this.player1Score = data.player_1_score;
        this.player2Score = data.player_2_score;
        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;

        // Set last loser (who should start next)
        this.lastLoser = data.scorer === 1 ? 2 : 1;

        // Show notification
        const scorer = data.scorer === 1 ? "Player 1" : "Player 2";
        this.showMessage(`Goal! ${scorer} scored`);

        // If we're the player who should restart, show a message
        if (this.playerNumber === this.lastLoser) {
            this.showMessage("Press SPACE to start the ball", 5000);
        }
    }

    handleGameOver(data) {
        // Update state
        this.gameOver = true;

        // Show game over popup
        this.showGameOverPopup(data.winner === 1 ? "Player 1" : "Player 2");
    }

    handleGamePaused(data) {
        this.paused = true;

        // Show notification
        this.showMessage(`Game paused by Player ${data.player_number}`);
    }

    pauseGame() {
        if (this.socket && this.playerNumber) {
            this.socket.send('pause_game', {
                player_number: this.playerNumber
            });
        }
    }

    // Update resumeGame to use the centralized method
    resumeGame() {
        if (this.socket && this.playerNumber) {
            // Only the correct player can resume
            if (this.playerNumber !== this.lastLoser && this.player1Score + this.player2Score > 0) {
                // Not your turn to start
                this.showMessage("Wait for the other player to start the ball");
                return;
            }

            // Calculate initial ball speeds based on constants and who lost
            const initialSpeedX = this.lastLoser === 1 ?
                -GameConstants.BALL_INITIAL_SPEED_X :
                GameConstants.BALL_INITIAL_SPEED_X;

            const initialSpeedY = (Math.random() > 0.5 ? 1 : -1) *
                GameConstants.BALL_INITIAL_SPEED_Y;

            // Send resume message with ball speeds
            this.socket.send('resume_game', {
                player_number: this.playerNumber,
                ball_speed_x: initialSpeedX,
                ball_speed_y: initialSpeedY
            });

            // Show visual feedback
            this.showMessage(`Starting the ball...`);

            // Flash ball
            this.flashBall();
        }
    }

    // Optimize paddle position updates to reduce network traffic
    sendPaddlePosition() {
        if (!this.socket || !this.playerNumber) return;

        const position = this.playerNumber === 1 ? this.player1Y : this.player2Y;

        // Only send if we have moved since last time
        if (this._lastSentPosition === position) return;
        this._lastSentPosition = position;

        this.socket.send('paddle_position', {
            player_number: this.playerNumber,
            position: position
        });
    }

    showMessage(message, duration = 3000) {
        // Add throttling to avoid too many messages
        const now = Date.now();
        if (this._lastMessageTime && now - this._lastMessageTime < 500) {
            return; // Don't show messages too quickly
        }
        this._lastMessageTime = now;

        // Create or get message container
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

        // Limit number of messages to 3 at a time
        while (messageContainer.children.length >= 3) {
            messageContainer.removeChild(messageContainer.firstChild);
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        messageElement.style.color = 'white';
        messageElement.style.padding = '8px 16px';
        messageElement.style.borderRadius = '4px';
        messageElement.style.marginBottom = '8px';
        messageElement.style.transition = 'opacity 0.5s';
        messageElement.style.opacity = '0';

        // Add to container
        messageContainer.appendChild(messageElement);

        // Fade in
        setTimeout(() => {
            messageElement.style.opacity = '1';
        }, 10);

        // Remove after duration
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
        if (this.networkStatus.connected) {
            indicator.classList.remove('disconnected', 'connecting');
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected', 'connecting');
            indicator.classList.add('disconnected');
        }

        // Update ping display
        if (this.socket) {
            const latency = Math.round(this.socket.getLatency() || 0);
            pingDisplay.textContent = `${latency}ms`;

            // Set color based on latency
            if (latency < 50) {
                pingDisplay.style.color = '#2ecc71'; // Green
            } else if (latency < 100) {
                pingDisplay.style.color = '#f39c12'; // Orange
            } else {
                pingDisplay.style.color = '#e74c3c'; // Red
            }
        }
    }

    updateDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        if (!debugInfo) return;

        // Simple debug info with essential information
        const info = {
            'Player': this.playerNumber || 'Spectator',
            'Connected': this.networkStatus.connected ? 'Yes' : 'No',
            'Ping': `${Math.round(this.socket?.getLatency() || 0)} ms`,
            'Ball Speed': `${Math.round(this.ballSpeedX)}, ${Math.round(this.ballSpeedY)}`
        };

        // Format debug info as HTML
        let html = '';
        for (const [key, value] of Object.entries(info)) {
            html += `<div><strong>${key}:</strong> ${value}</div>`;
        }

        // Update debug info
        debugInfo.innerHTML = html;
    }
}