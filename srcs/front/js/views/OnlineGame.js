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

        // Network state management
        this.socket = null;
        this.lastReceivedState = null;
        this.networkStatus = {
            connected: false,
            latency: 50, // Default assumption
            packetLoss: 0,
        };

        // Input tracking
        this._inputSequence = 0;
        this._pendingInputs = [];
        this.upPressed = false;
        this.downPressed = false;

        // State buffer for interpolation
        this.stateBuffer = [];
        this.stateBufferSize = 60; // Store 1 second of states at 60Hz
        this.renderDelay = 100; // Render 100ms behind server time for smoother interpolation

        // Game state
        this.paused = true;
        this.gameOver = false;
        this.player1Score = 0;
        this.player2Score = 0;
        this.lastLoser = null;

        // Fixed timestep physics
        this.simulationRate = 1/60; // 60Hz simulation
        this.accumulator = 0;
        this.lastFrameTime = 0;
        
        // Simulation state (authoritative from server)
        this.simulationState = {
            player1Y: 0,
            player2Y: 0,
            ballX: 0,
            ballY: 0,
            ballSpeedX: 0,
            ballSpeedY: 0,
            lastUpdateTime: 0
        };
        
        // Render state (interpolated for smooth display)
        this.renderState = {
            player1Y: 0,
            player2Y: 0,
            ballX: 0,
            ballY: 0
        };

        // Add event listeners
        window.addEventListener('keydown', this._handleKeyDown.bind(this));
        window.addEventListener('keyup', this._handleKeyUp.bind(this));

        this.cleanupModals();
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
        this.paddleSpeed = GameConstants.PADDLE_SPEED * 1.2;
        this.ballSize = GameConstants.BALL_SIZE;
        
        // Initialize simulation and render states
        const centerY = (this.canvas.height - this.paddleHeight) / 2;
        const centerX = this.canvas.width / 2;
        
        this.simulationState = {
            player1Y: centerY,
            player2Y: centerY,
            ballX: centerX,
            ballY: centerY,
            ballSpeedX: 0,
            ballSpeedY: 0,
            lastUpdateTime: Date.now()
        };
        
        this.renderState = {
            player1Y: centerY,
            player2Y: centerY,
            ballX: centerX,
            ballY: centerY
        };
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
        this.socket.on('input_ack', this.handleInputAck.bind(this));

        this.socket.connect();
    }

    getAuthToken() {
        function getCookie(name) {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? match[2] : null;
        }

        return getCookie('access_token') || localStorage.getItem('access_token') || null;
    }

    // Input handling with sequence numbers
    _handleKeyDown(e) {
        if (!this.playerNumber || this.gameOver) return;
        
        if (e.key === "w" || e.key === "ArrowUp") {
            if (!this.upPressed) {
                this.upPressed = true;
                this.sendInput("up", true);
            }
        }
        
        if (e.key === "s" || e.key === "ArrowDown") {
            if (!this.downPressed) {
                this.downPressed = true;
                this.sendInput("down", true);
            }
        }
        
        if (e.key === " " && this.paused && this.playerNumber) {
            this.resumeGame();
        }
    }

    _handleKeyUp(e) {
        if (!this.playerNumber || this.gameOver) return;
        
        if (e.key === "w" || e.key === "ArrowUp") {
            if (this.upPressed) {
                this.upPressed = false;
                this.sendInput("up", false);
            }
        }
        
        if (e.key === "s" || e.key === "ArrowDown") {
            if (this.downPressed) {
                this.downPressed = false;
                this.sendInput("down", false);
            }
        }
    }

    sendInput(key, isDown) {
        if (!this.socket || !this.playerNumber) return;
        
        // Create an input with sequence number
        this._inputSequence++;
        const input = {
            key,
            is_down: isDown,
            player_number: this.playerNumber,
            sequence: this._inputSequence
        };
        
        // Apply input locally for immediate feedback
        this.applyInput(input);
        
        // Save pending input for reconciliation
        this._pendingInputs.push(input);
        
        // Send to server
        this.socket.send('key_event', input);
    }
    
    applyInput(input) {
        if (input.player_number !== this.playerNumber) return;
        
        // Only apply our own inputs
        if (input.key === "up") {
            if (this.playerNumber === 1) {
                // Store the input state
                if (input.is_down) {
                    this.upPressed = true;
                } else {
                    this.upPressed = false;
                }
            } else if (this.playerNumber === 2) {
                if (input.is_down) {
                    this.upPressed = true;
                } else {
                    this.upPressed = false;
                }
            }
        } else if (input.key === "down") {
            if (this.playerNumber === 1) {
                if (input.is_down) {
                    this.downPressed = true;
                } else {
                    this.downPressed = false;
                }
            } else if (this.playerNumber === 2) {
                if (input.is_down) {
                    this.downPressed = true;
                } else {
                    this.downPressed = false;
                }
            }
        }
    }

    // Handler for server acknowledgment of inputs
    handleInputAck(data) {
        if (data.sequence) {
            // Remove acknowledged inputs from pending list
            this._pendingInputs = this._pendingInputs.filter(input => 
                input.sequence > data.sequence);
        }
    }

    // Main game loop with fixed physics timestep
    gameLoop(timestamp) {
        requestAnimationFrame(this.gameLoop);
        
        if (this.gameOver) return;
        
        const now = timestamp || performance.now();
        const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016;
        this.lastFrameTime = now;
        
        // Cap delta time to avoid spiral of death during lag
        const cappedDelta = Math.min(deltaTime, 0.1);
        
        // Accumulate time for fixed timestep physics
        this.accumulator += cappedDelta;
        
        // Run simulation steps
        while (this.accumulator >= this.simulationRate) {
            this.updateSimulation(this.simulationRate);
            this.accumulator -= this.simulationRate;
        }
        
        // Interpolate game state for rendering
        this.interpolateState();
        
        // Render the game
        this.render();
    }
    
    updateSimulation(deltaTime) {
        // Only update our own paddle based on input
        if (this.playerNumber) {
            const paddleSpeed = this.paddleSpeed * deltaTime;
            
            if (this.playerNumber === 1) {
                if (this.upPressed) {
                    this.simulationState.player1Y = Math.max(0, this.simulationState.player1Y - paddleSpeed);
                }
                if (this.downPressed) {
                    this.simulationState.player1Y = Math.min(
                        this.canvas.height - this.paddleHeight, 
                        this.simulationState.player1Y + paddleSpeed
                    );
                }
            } else if (this.playerNumber === 2) {
                if (this.upPressed) {
                    this.simulationState.player2Y = Math.max(0, this.simulationState.player2Y - paddleSpeed);
                }
                if (this.downPressed) {
                    this.simulationState.player2Y = Math.min(
                        this.canvas.height - this.paddleHeight, 
                        this.simulationState.player2Y + paddleSpeed
                    );
                }
            }
            
            // Send paddle position updates to server at appropriate rate
            this.sendPaddlePosition();
        }
    }
    
    interpolateState() {
        // If buffer is empty, return
        if (this.stateBuffer.length < 2) return;
        
        // Calculate render time (current time minus renderDelay)
        const renderTime = Date.now() - this.renderDelay;
        
        // Find the two states to interpolate between
        let beforeState = this.stateBuffer[0];
        let afterState = this.stateBuffer[1];
        
        // Find the two states that surround our render time
        for (let i = 0; i < this.stateBuffer.length - 1; i++) {
            if (this.stateBuffer[i].timestamp <= renderTime && 
                this.stateBuffer[i + 1].timestamp >= renderTime) {
                beforeState = this.stateBuffer[i];
                afterState = this.stateBuffer[i + 1];
                break;
            }
        }
        
        // If render time is beyond the newest state, use the most recent state
        if (renderTime > afterState.timestamp) {
            this.renderState = { ...afterState };
            return;
        }
        
        // If render time is before the oldest state, use the oldest state
        if (renderTime < beforeState.timestamp) {
            this.renderState = { ...beforeState };
            return;
        }
        
        // Calculate interpolation factor
        const t = (renderTime - beforeState.timestamp) / 
                 (afterState.timestamp - beforeState.timestamp);
        
        // Interpolate all entity positions
        this.renderState = {
            player1Y: this.lerp(beforeState.player1Y, afterState.player1Y, t),
            player2Y: this.lerp(beforeState.player2Y, afterState.player2Y, t),
            ballX: this.lerp(beforeState.ballX, afterState.ballX, t),
            ballY: this.lerp(beforeState.ballY, afterState.ballY, t)
        };
        
        // For the local player's paddle, use the simulation state directly for responsiveness
        if (this.playerNumber === 1) {
            this.renderState.player1Y = this.simulationState.player1Y;
        } else if (this.playerNumber === 2) {
            this.renderState.player2Y = this.simulationState.player2Y;
        }
    }
    
    lerp(start, end, t) {
        return start + (end - start) * Math.min(Math.max(t, 0), 1);
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw center line
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.canvas.width / 2 - 2, 0, 4, this.canvas.height);
        
        // Draw paddles
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, this.renderState.player1Y, this.paddleWidth, this.paddleHeight);
        this.ctx.fillRect(
            this.canvas.width - this.paddleWidth, 
            this.renderState.player2Y, 
            this.paddleWidth, 
            this.paddleHeight
        );
        
        // Draw ball
        this.ctx.beginPath();
        this.ctx.arc(
            this.renderState.ballX, 
            this.renderState.ballY, 
            this.ballSize / 2, 
            0, 
            Math.PI * 2
        );
        this.ctx.fillStyle = "#f39c12";
        this.ctx.fill();
        this.ctx.closePath();
    }
    
    sendPaddlePosition() {
        if (!this.socket || !this.playerNumber) return;
        
        const now = Date.now();
        // Rate limit to avoid flooding the server
        if (now - this.lastPaddleUpdate < 33) return; // ~30 Hz updates
        
        const position = this.playerNumber === 1 ? 
            this.simulationState.player1Y : this.simulationState.player2Y;
        
        // Only send if position has changed significantly
        if (this._lastSentPosition !== undefined && 
            Math.abs(this._lastSentPosition - position) < 1) {
            return;
        }
        
        this._lastSentPosition = position;
        this.lastPaddleUpdate = now;
        
        this.socket.send('paddle_position', {
            player_number: this.playerNumber,
            position: position,
            sequence: this._inputSequence // Include the latest input sequence
        });
    }

    // Server state handling
    handleGameState(data) {
        const now = Date.now();
        
        // Store the full state
        this.lastReceivedState = { ...data };
        
        // Update player number if provided by server
        if (data.player_number && data.player_number !== this.playerNumber) {
            console.log(`Server assigned player number ${data.player_number} (was ${this.playerNumber})`);
            this.playerNumber = data.player_number;
            localStorage.setItem('current_player_number', this.playerNumber.toString());
            this.showMessage(`You are Player ${this.playerNumber}`);
        }
        
        // Update game state
        this.player1Score = data.player_1_score;
        this.player2Score = data.player_2_score;
        this.paused = data.is_paused;
        
        // Create a new state for the buffer
        const newState = {
            timestamp: now,
            player1Y: data.player_1_paddle_y,
            player2Y: data.player_2_paddle_y,
            ballX: data.ball_x,
            ballY: data.ball_y,
            ballSpeedX: data.ball_speed_x,
            ballSpeedY: data.ball_speed_y
        };
        
        // Add to the buffer
        this.addStateToBuffer(newState);
        
        // Update the simulation state with authoritative server data
        this.updateSimulationFromServer(data);
        
        // Update score display
        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;
    }
    
    handleGameStateDelta(data) {
        if (!this.lastReceivedState) return;
        
        // Apply delta to last received state
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'type' && key !== 'timestamp' && key !== 'sequence') {
                this.lastReceivedState[key] = value;
            }
        });
        
        // Process the updated state
        this.handleGameState(this.lastReceivedState);
    }
    
    addStateToBuffer(state) {
        // Add to buffer
        this.stateBuffer.push(state);
        
        // Sort by timestamp
        this.stateBuffer.sort((a, b) => a.timestamp - b.timestamp);
        
        // Keep buffer size limited
        while (this.stateBuffer.length > this.stateBufferSize) {
            this.stateBuffer.shift();
        }
        
        // Update the ball speed in simulation state
        this.simulationState.ballSpeedX = state.ballSpeedX;
        this.simulationState.ballSpeedY = state.ballSpeedY;
    }
    
    updateSimulationFromServer(data) {
        // Update authoritative state from server
        const serverState = {
            player1Y: data.player_1_paddle_y,
            player2Y: data.player_2_paddle_y,
            ballX: data.ball_x,
            ballY: data.ball_y,
            ballSpeedX: data.ball_speed_x,
            ballSpeedY: data.ball_speed_y,
            lastUpdateTime: Date.now()
        };
        
        // Update opponent paddle immediately
        if (this.playerNumber === 1) {
            // We control player 1, so update player 2 from server
            this.simulationState.player2Y = serverState.player2Y;
        } else if (this.playerNumber === 2) {
            // We control player 2, so update player 1 from server
            this.simulationState.player1Y = serverState.player1Y;
        } else {
            // Spectator mode, update both paddles
            this.simulationState.player1Y = serverState.player1Y;
            this.simulationState.player2Y = serverState.player2Y;
        }
        
        // Always update ball from server (it's authoritative)
        this.simulationState.ballX = serverState.ballX;
        this.simulationState.ballY = serverState.ballY;
        this.simulationState.ballSpeedX = serverState.ballSpeedX;
        this.simulationState.ballSpeedY = serverState.ballSpeedY;
        
        // Reconcile player paddle if needed
        this.reconcilePlayerPaddle(data);
    }
    
    reconcilePlayerPaddle(serverState) {
        if (!this.playerNumber) return;
        
        // Compare server position with our predicted position
        if (this.playerNumber === 1) {
            const serverPos = serverState.player_1_paddle_y;
            const clientPos = this.simulationState.player1Y;
            const diff = serverPos - clientPos;
            
            // If difference is significant, reconcile
            if (Math.abs(diff) > 3) {
                // Correct position with small bias toward server
                this.simulationState.player1Y = clientPos + diff * 0.3;
                
                // Reapply pending inputs
                this._pendingInputs.forEach(input => {
                    this.applyInput(input);
                });
            }
        } else if (this.playerNumber === 2) {
            const serverPos = serverState.player_2_paddle_y;
            const clientPos = this.simulationState.player2Y;
            const diff = serverPos - clientPos;
            
            if (Math.abs(diff) > 3) {
                this.simulationState.player2Y = clientPos + diff * 0.3;
                
                this._pendingInputs.forEach(input => {
                    this.applyInput(input);
                });
            }
        }
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

    handleGameResumed(data) {
        this.paused = false;

        if (data.ball_speed_x !== undefined) {
            this.simulationState.ballSpeedX = data.ball_speed_x;
        }

        if (data.ball_speed_y !== undefined) {
            this.simulationState.ballSpeedY = data.ball_speed_y;
        }

        this.showMessage(`Game resumed by Player ${data.player_number}`);

        this.flashBall();
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

    flashBall(count = 3, delay = 200) {
        if (!this.ctx) return;

        const flashOnce = () => {
            const originalFillStyle = this.ctx.fillStyle;
            this.ctx.fillStyle = "#ffcc00";
            this.ctx.beginPath();
            this.ctx.arc(this.renderState.ballX, this.renderState.ballY, this.ballSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.closePath();
            this.ctx.fillStyle = originalFillStyle;
        };

        flashOnce();

        for (let i = 1; i < count; i++) {
            setTimeout(flashOnce, i * delay);
        }
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

    showGameOverPopup(winner) {
        // Existing implementation
    }
}