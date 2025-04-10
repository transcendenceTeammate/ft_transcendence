import AbstractView from "./AbstractView.js";
import Game from "./Game.js";
import GameConstants from "../core/GameConstants.js";

class EnhancedWebSocket {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: 1000,
            maxReconnectAttempts: 5,
            ...options
        };

        this.socket = null;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.eventHandlers = {};
        this.lastConnectionState = WebSocket.CLOSED;
        this.messageQueue = [];
        this.sequenceNumber = 0;
        this.lastAcknowledgedSequence = 0;
        
        // Latency tracking
        this.latencyHistory = [];
        this.currentLatency = 50; // Default 50ms latency assumption
        this.latencyWindowSize = 20; // Track last 20 messages
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
                this.messageQueue.unshift(message);
                break;
            }
        }
    }

    handleIncomingMessage(event) {
        try {
            const data = JSON.parse(event.data);

            // Track latency if server sends back client_time
            if (data.client_time) {
                const roundTripTime = Date.now() - data.client_time;
                this.trackLatency(roundTripTime);
            }

            if (data.type === 'input_ack' && data.sequence) {
                this.lastAcknowledgedSequence = Math.max(this.lastAcknowledgedSequence, data.sequence);
                return;
            }

            if (data.type === 'prediction_ack' && data.sequence) {
                this.emit('prediction_ack', data);
                return;
            }

            if (data.type) {
                this.emit(data.type, data);
            }

        } catch (error) {
            // Error handling silently
        }
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

    // New method to track and calculate latency
    trackLatency(roundTripTime) {
        // We estimate one-way latency as half of round trip
        const latency = Math.max(5, roundTripTime / 2);
        
        this.latencyHistory.push(latency);
        
        // Keep history size limited
        if (this.latencyHistory.length > this.latencyWindowSize) {
            this.latencyHistory.shift();
        }
        
        // Calculate weighted average (recent values count more)
        let sum = 0;
        let weights = 0;
        
        for (let i = 0; i < this.latencyHistory.length; i++) {
            const weight = i + 1; // More recent values get higher weights
            sum += this.latencyHistory[i] * weight;
            weights += weight;
        }
        
        this.currentLatency = sum / weights;
        
        // Emit latency update event
        this.emit('latency_update', this.currentLatency);
    }
    
    // Method to get current latency
    getLatency() {
        return this.currentLatency;
    }
}

export default class OnlineGame extends Game {
    constructor() {
        super();
        this.setTitle("Online Pong");

        const urlParams = new URLSearchParams(window.location.search);
        this.roomCode = urlParams.get('room');

        if (!this.roomCode) {
            window.location.href = '/start-game';
            return;
        }

        // Get player information from localStorage
        this.playerNumber = parseInt(localStorage.getItem('current_player_number') || '0', 10);
        this.playerId = localStorage.getItem('current_player_id');
        this.username = localStorage.getItem('current_username');

        // Physics accumulator for fixed timestep
        this.accumulator = 0;
        this.physicsStep = 1/120; // 120 Hz physics
        
        // State management for smooth transitions
        this.stateBuffer = [];
        this.maxBufferSize = 10;
        this.stateBufferTime = 100; // ms to buffer states
        
        // Visual object states (for rendering)
        this.visualState = {
            player1Y: 0,
            player2Y: 0,
            ballX: 0,
            ballY: 0
        };
        
        // Target states (where objects are moving toward)
        this.targetState = {
            player1Y: 0,
            player2Y: 0,
            ballX: 0,
            ballY: 0
        };

        // Validate player information
        if (!this.playerId) {
            console.error("Missing player ID, generating a temporary one");
            this.playerId = `guest-${Math.floor(Math.random() * 9000) + 1000}`;
            localStorage.setItem('current_player_id', this.playerId);
        }

        if (!this.username) {
            console.error("Missing username, generating a temporary one");
            this.username = `Guest-${Math.floor(Math.random() * 9000) + 1000}`;
            localStorage.setItem('current_username', this.username);
        }

        // The server will assign/verify the correct player number
        console.log(`Starting game with: Player ${this.playerNumber}, ID: ${this.playerId}, Room: ${this.roomCode}`);

        this.socket = null;
        this.lastReceivedState = null;
        this.predictionEnabled = true;
        this.reconciliationEnabled = true;

        this.pendingInputs = [];

        this._lastSentPosition = null;
        this._lastMessageTime = 0;
        this.lastPaddleUpdate = 0;

        this.networkStatus = {
            connected: false,
            latency: 50 // Default assumption
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
        return html;
    }

    async onLoaded() {
        this.initGame();
        this.initializeSocket();
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

        let wsUrl = `wss://app.10.24.108.2.nip.io:8443/ws/game/${this.roomCode}/`;
        if (token) {
            wsUrl += `?token=${encodeURIComponent(token)}`;
        }

        this.socket = new EnhancedWebSocket(wsUrl, {
            reconnectInterval: 1000,
            maxReconnectAttempts: 5
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
        this.socket.on('latency_update', this.handleLatencyUpdate.bind(this));

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
        // Schedule next frame immediately
        requestAnimationFrame(this.gameLoop);

        if (this.gameOver) return;

        const now = timestamp || performance.now();
        const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016; // Convert to seconds
        this.lastFrameTime = now;

        // Cap delta time to avoid spiral of death during lag spikes
        const cappedDelta = Math.min(deltaTime, 0.1); // Max 100ms
        
        // Accumulate time since last frame
        this.accumulator += cappedDelta;
        
        // Run multiple physics updates if needed (fixed timestep)
        while (this.accumulator >= this.physicsStep) {
            this.updatePhysics(this.physicsStep);
            this.accumulator -= this.physicsStep;
        }
        
        // Update visual states for smooth rendering
        this.updateVisualStates(cappedDelta);
        
        // Draw with the visual states
        this.draw();
    }

    // Update draw method to use visual states
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.canvas.width / 2 - 2, 0, 4, this.canvas.height);

        // Draw paddles using visual state
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, this.visualState.player1Y, this.paddleWidth, this.paddleHeight);
        this.ctx.fillRect(this.canvas.width - this.paddleWidth, this.visualState.player2Y, this.paddleWidth, this.paddleHeight);

        // Draw ball using visual state
        this.ctx.beginPath();
        this.ctx.arc(this.visualState.ballX, this.visualState.ballY, this.ballSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = "#f39c12";
        this.ctx.fill();
        this.ctx.closePath();
    }

    // Update physics method to handle player input
    updatePhysics(fixedDelta) {
        // Process player input to move their paddle
        this.processPlayerInput(fixedDelta);
        
        // Update paddle target positions based on player input
        if (this.playerNumber === 1) {
            this.targetState.player1Y = this.player1Y;
        } else if (this.playerNumber === 2) {
            this.targetState.player2Y = this.player2Y;
        }
        
        // Send paddle updates to server at appropriate intervals
        this.updateWithPrediction(fixedDelta);
    }

    // Simplify processPlayerInput to only handle direct input
    processPlayerInput(deltaTime) {
        if (!this.playerNumber) return;
        
        const actualPaddleSpeed = this.paddleSpeed * deltaTime * 60;
        
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

    // We no longer need the original interpolateOpponentPaddle as it's handled by the state system
    // Simplify updateWithPrediction to just send updates
    updateWithPrediction(deltaTime) {
        if (this.predictionEnabled && this.playerNumber) {
            const now = Date.now();
            if (now - this.lastPaddleUpdate > this.minPaddleUpdateInterval || 16) {
                this.sendPaddlePosition();
                this.lastPaddleUpdate = now;
            }
        }
    }

    // We also no longer need the original reconcilePlayerPaddle, as reconciliation is now
    // handled by the state management system with gradual transitions.

    handleGameState(data) {
        this.lastReceivedState = { ...data };

        // Update player number if provided by server
        if (data.player_number && data.player_number !== this.playerNumber) {
            console.log(`Server assigned player number ${data.player_number} (was ${this.playerNumber})`);
            this.playerNumber = data.player_number;
            localStorage.setItem('current_player_number', this.playerNumber.toString());
            this.showMessage(`You are Player ${this.playerNumber}`);
        }

        this.player1Score = data.player_1_score;
        this.player2Score = data.player_2_score;
        
        // Buffer the state for smooth transitions
        this.addStateToBuffer({
            timestamp: Date.now(),
            player1Y: data.player_1_paddle_y,
            player2Y: data.player_2_paddle_y,
            ballX: data.ball_x,
            ballY: data.ball_y,
            ballSpeedX: data.ball_speed_x,
            ballSpeedY: data.ball_speed_y
        });

        // Immediately update score display
        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;
        
        // Update game state
        this.ballSpeedX = data.ball_speed_x;
        this.ballSpeedY = data.ball_speed_y;
        this.paused = data.is_paused;
    }

    // New method to add state to buffer
    addStateToBuffer(state) {
        // Add new state to buffer
        this.stateBuffer.push(state);
        
        // Keep buffer size limited
        while (this.stateBuffer.length > this.maxBufferSize) {
            this.stateBuffer.shift();
        }
        
        // Update target state immediately
        this.targetState = { ...state };
        
        // Initialize visual state if it's empty
        if (this.visualState.player1Y === 0 && this.visualState.player2Y === 0) {
            this.visualState = { ...state };
        }
        
        // For player's own paddle, update immediately if local player
        if (this.playerNumber === 1) {
            // Only affect our own paddle
            this.player1Y = state.player1Y;
        } else if (this.playerNumber === 2) {
            // Only affect our own paddle
            this.player2Y = state.player2Y;
        }
    }

    // Update visual states from buffer in the game loop
    updateVisualStates(deltaTime) {
        // If no state in buffer, nothing to do
        if (this.stateBuffer.length === 0) return;
        
        // Calculate interpolation factors for different objects
        const paddleFactor = Math.min(1.0, deltaTime * 12); // Smooth paddle movement
        const ballFactor = this.calculateBallFactor(deltaTime);
        
        // Update visual positions with smooth interpolation
        // Paddle positions - gentle easing
        this.visualState.player1Y = this.lerpWithEasing(
            this.visualState.player1Y, 
            this.targetState.player1Y, 
            this.playerNumber === 1 ? 1.0 : paddleFactor
        );
        this.visualState.player2Y = this.lerpWithEasing(
            this.visualState.player2Y, 
            this.targetState.player2Y, 
            this.playerNumber === 2 ? 1.0 : paddleFactor
        );
        
        // Ball position - predictive interpolation
        if (!this.paused && (this.ballSpeedX !== 0 || this.ballSpeedY !== 0)) {
            // Predict where ball should be based on last known position and velocity
            const predictedBallX = this.targetState.ballX + this.ballSpeedX * (deltaTime * 60);
            const predictedBallY = this.targetState.ballY + this.ballSpeedY * (deltaTime * 60);
            
            // Blend server position with prediction
            this.visualState.ballX = this.lerp(this.visualState.ballX, predictedBallX, ballFactor);
            this.visualState.ballY = this.lerp(this.visualState.ballY, predictedBallY, ballFactor);
        } else {
            // If ball isn't moving, just interpolate to exact position
            this.visualState.ballX = this.lerp(this.visualState.ballX, this.targetState.ballX, ballFactor);
            this.visualState.ballY = this.lerp(this.visualState.ballY, this.targetState.ballY, ballFactor);
        }
        
        // Update actual positions for collision detection
        // We only use visual positions for rendering, not physics
        this.ballX = this.targetState.ballX;
        this.ballY = this.targetState.ballY;
        
        // Don't update player paddles here - they're controlled by input
        // or by the interpolation system for opponent paddles
    }

    // Utility to calculate appropriate ball factor based on game state
    calculateBallFactor(deltaTime) {
        // Base factor - faster than paddle for responsive ball movement
        let factor = Math.min(1.0, deltaTime * 15);
        
        // Adjust based on distance (further = faster)
        const ballDistance = Math.sqrt(
            Math.pow(this.visualState.ballX - this.targetState.ballX, 2) +
            Math.pow(this.visualState.ballY - this.targetState.ballY, 2)
        );
        
        // If ball is far from target, increase catch-up speed
        if (ballDistance > 20) {
            factor = Math.min(1.0, factor * (ballDistance / 20));
        }
        
        // If ball just changed direction, faster correction
        if (Math.sign(this.visualState.ballX - this.targetState.ballX) !== 
            Math.sign(this.ballSpeedX)) {
            factor = Math.min(1.0, factor * 2);
        }
        
        return factor;
    }

    // Linear interpolation utility
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    // Cubic easing interpolation
    lerpWithEasing(start, end, factor) {
        // Apply cubic easing function
        const easeInOutCubic = (t) => {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };
        
        // Apply easing to factor
        const easedFactor = easeInOutCubic(Math.min(1.0, Math.max(0, factor)));
        return start + (end - start) * easedFactor;
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
        this.networkStatus.connected = true;
        
        // Send join game immediately after connection
        this.socket.send('join_game', {
            player_id: this.playerId,
            username: this.username
        });
        
        this.showMessage(`Connected to room ${this.roomCode}`);
    }

    handleDisconnect() {
        this.networkStatus.connected = false;
        this.showMessage("Connection lost. Attempting to reconnect...");
    }

    handleError(error) {
        this.showMessage("Connection error. Please try refreshing the page.");
    }

    handleGameStateDelta(data) {
        if (!this.lastReceivedState) {
            return;
        }

        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'type' && key !== 'timestamp' && key !== 'sequence') {
                this.lastReceivedState[key] = value;
            }
        });

        this.handleGameState(this.lastReceivedState);
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
        this.showGameOverPopup(data.winner === 1 ? "Player 1" : "Player 2");
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

        const now = Date.now();
        const position = this.playerNumber === 1 ? this.player1Y : this.player2Y;
        
        // Use adaptive update interval based on network quality
        const updateInterval = this.minPaddleUpdateInterval || 16;
        
        if (now - this.lastPaddleUpdate < updateInterval) return;
        
        // Optimize: skip small movements based on latency
        // Higher latency = require more significant movement to send updates
        const minMovementThreshold = Math.max(0.5, Math.min(3, this.networkStatus.latency / 50));
        
        // Handle the case where _lastSentPosition might be null/undefined
        if (this._lastSentPosition !== null && this._lastSentPosition !== undefined) {
            if (Math.abs(this._lastSentPosition - position) <= minMovementThreshold) return;
        }
        
        this._lastSentPosition = position;
        this.lastPaddleUpdate = now;
        
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

    // New handler for latency updates
    handleLatencyUpdate(latency) {
        this.networkStatus.latency = latency;
        
        // Adjust game parameters based on latency
        this.adaptToNetworkConditions();
    }
    
    // New method to adjust game settings based on network conditions
    adaptToNetworkConditions() {
        const latency = this.networkStatus.latency;
        
        // Connection quality categories
        if (latency < 50) { // Excellent connection
            this.interpolationSpeed = 0.4;
            this.minPaddleUpdateInterval = 16; // ~60 fps
        } else if (latency < 100) { // Good connection
            this.interpolationSpeed = 0.3;
            this.minPaddleUpdateInterval = 25; // ~40 fps
        } else if (latency < 200) { // Average connection
            this.interpolationSpeed = 0.25;
            this.minPaddleUpdateInterval = 33; // ~30 fps
        } else { // Poor connection
            this.interpolationSpeed = 0.2;
            this.minPaddleUpdateInterval = 50; // ~20 fps
        }
    }
}