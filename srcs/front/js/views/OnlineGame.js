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
        
        // Enhanced message queuing with priorities
        this.highPriorityQueue = [];
        this.normalPriorityQueue = [];
        this.processingQueues = false;
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

                this.processMessageQueues();
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
        const now = Date.now();
        
        // Create the message with proper metadata
        const message = {
            type,
            ...data,
            client_time: now
        };
        
        // Add sequence number to tracking message types
        if (['key_event', 'paddle_position', 'client_prediction'].includes(type)) {
            this.sequenceNumber++;
            message.sequence = this.sequenceNumber;
        }
        
        // Convert to JSON
        const messageJson = JSON.stringify(message);
        
        // Handle immediate sending or queuing based on connection state
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // High priority messages (related to ball collisions) get sent immediately
            const isHighPriority = 
                (type === 'paddle_position' && data.prediction && data.isNearCollision) || 
                type === 'resume_game' || 
                type === 'pause_game';
                
            if (isHighPriority) {
                this.socket.send(messageJson);
                return true;
            }
            
            // Queue in appropriate priority queue
            if (type === 'key_event' || type === 'paddle_position') {
                this.highPriorityQueue.push(messageJson);
            } else {
                this.normalPriorityQueue.push(messageJson);
            }
            
            // Process queues if not already processing
            if (!this.processingQueues) {
                this.processMessageQueues();
            }
            
            return true;
        } else {
            // Store in appropriate queue for later sending
            if (type === 'key_event' || type === 'paddle_position') {
                this.highPriorityQueue.push(messageJson);
            } else {
                this.normalPriorityQueue.push(messageJson);
            }
            return false;
        }
    }
    
    // Process queued messages with prioritization
    processMessageQueues() {
        if (this.processingQueues || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        this.processingQueues = true;
        
        // Process high priority queue first
        while (this.highPriorityQueue.length > 0) {
            const message = this.highPriorityQueue.shift();
            this.socket.send(message);
        }
        
        // Then process normal priority queue
        while (this.normalPriorityQueue.length > 0) {
            const message = this.normalPriorityQueue.shift();
            this.socket.send(message);
        }
        
        this.processingQueues = false;
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

        // Input tracking with enhanced sequencing
        this._inputSequence = 0;
        this._pendingInputs = [];
        this._lastAcknowledgedSequence = 0;
        this.upPressed = false;
        this.downPressed = false;

        // State buffer for interpolation
        this.stateBuffer = [];
        this.stateBufferSize = 60; // Store 1 second of states at 60Hz
        this.renderDelay = 150; // Increased from 100ms to 150ms for smoother interpolation during network jitter

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
        
        // Create an input with sequence number and timestamp
        this._inputSequence++;
        
        // Get current paddle position for prediction verification
        const paddleY = this.playerNumber === 1 ? 
            this.simulationState.player1Y : 
            this.simulationState.player2Y;
        
        const input = {
            type: 'key_event',
            key,
            is_down: isDown,
            player_number: this.playerNumber,
            sequence: this._inputSequence,
            timestamp: Date.now(),
            prediction: {
                paddleY: paddleY
            }
        };
        
        // Apply input locally for immediate feedback
        this.applyInput(input);
        
        // Save pending input for reconciliation
        this._pendingInputs.push(input);
        
        // Send to server with all metadata
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

    // Enhanced handler for input acknowledgments
    handleInputAck(data) {
        // Update the last acknowledged sequence
        if (data.sequence) {
            this._lastAcknowledgedSequence = Math.max(this._lastAcknowledgedSequence, data.sequence);
            
            // Remove acknowledged inputs from pending list
            this._pendingInputs = this._pendingInputs.filter(input => 
                input.sequence > this._lastAcknowledgedSequence);
            
            // If the server includes corrected position, use it for enhanced reconciliation
            if (data.corrected_position !== undefined && this.playerNumber) {
                const serverPos = data.corrected_position;
                const playerPaddleY = this.playerNumber === 1 ? 
                    this.simulationState.player1Y : this.simulationState.player2Y;
                
                // Only apply correction if significant difference exists
                if (Math.abs(serverPos - playerPaddleY) > 5) {
                    // Blend between current position and server position
                    if (this.playerNumber === 1) {
                        this.simulationState.player1Y = (0.3 * serverPos) + (0.7 * playerPaddleY);
                    } else {
                        this.simulationState.player2Y = (0.3 * serverPos) + (0.7 * playerPaddleY);
                    }
                }
            }
        }
    }

    // Enhanced game state handling to support input reconciliation
    handleGameState(data) {
        const now = Date.now();
        
        // Check for processed input acknowledgments in the game state
        if (data.processed_inputs && data.processed_inputs[this.playerId]) {
            const lastProcessedSequence = data.processed_inputs[this.playerId];
            
            // Update acknowledged sequence and remove processed inputs
            this._lastAcknowledgedSequence = Math.max(this._lastAcknowledgedSequence, lastProcessedSequence);
            this._pendingInputs = this._pendingInputs.filter(input => 
                input.sequence > this._lastAcknowledgedSequence);
        }
        
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
        
        // Re-apply any pending inputs that weren't processed by server yet
        this.reapplyPendingInputs();
        
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
            lastUpdateTime: Date.now(),
            player1MovingUp: data.player_1_moving_up,
            player1MovingDown: data.player_1_moving_down,
            player2MovingUp: data.player_2_moving_up,
            player2MovingDown: data.player_2_moving_down
        };
        
        // Always update ball position and speed (server authority)
        this.simulationState.ballX = serverState.ballX;
        this.simulationState.ballY = serverState.ballY;
        this.simulationState.ballSpeedX = serverState.ballSpeedX;
        this.simulationState.ballSpeedY = serverState.ballSpeedY;
        
        // Store our current paddle position before updates for comparison
        const myOldPaddleY = this.playerNumber === 1 ? 
            this.simulationState.player1Y : 
            this.simulationState.player2Y;
            
        // For the opponent paddle, use server position directly
        if (this.playerNumber === 1) {
            // We control player 1, update player 2 (opponent) from server
            this.simulationState.player2Y = serverState.player2Y;
            
            // For our own paddle, use smart reconciliation - BUT ONLY IF THERE'S A SIGNIFICANT DIFFERENCE
            // AND we're not actively pressing keys
            const serverDiff = Math.abs(serverState.player1Y - this.simulationState.player1Y);
            
            // If the difference is large and we're not actively pressing keys, reconcile position
            if (serverDiff > 20 && !this.upPressed && !this.downPressed) {
                console.log(`Large position difference detected (${serverDiff.toFixed(2)}px), reconciling to server position`);
                this.reconcilePlayerPaddle(data);
            } else {
                // Log that we're preserving local position due to active input
                if (serverDiff > 5 && (this.upPressed || this.downPressed)) {
                    console.log(`Preserving local position despite server difference of ${serverDiff.toFixed(2)}px due to active input`);
                }
            }
        } else if (this.playerNumber === 2) {
            // We control player 2, update player 1 (opponent) from server
            this.simulationState.player1Y = serverState.player1Y;
            
            // For our own paddle, use smart reconciliation - BUT ONLY IF THERE'S A SIGNIFICANT DIFFERENCE
            // AND we're not actively pressing keys
            const serverDiff = Math.abs(serverState.player2Y - this.simulationState.player2Y);
            
            // If the difference is large and we're not actively pressing keys, reconcile position
            if (serverDiff > 20 && !this.upPressed && !this.downPressed) {
                console.log(`Large position difference detected (${serverDiff.toFixed(2)}px), reconciling to server position`);
                this.reconcilePlayerPaddle(data);
            } else {
                // Log that we're preserving local position due to active input
                if (serverDiff > 5 && (this.upPressed || this.downPressed)) {
                    console.log(`Preserving local position despite server difference of ${serverDiff.toFixed(2)}px due to active input`);
                }
            }
        } else {
            // Spectator mode, update both paddles from server
            this.simulationState.player1Y = serverState.player1Y;
            this.simulationState.player2Y = serverState.player2Y;
        }
        
        // Log our paddle position after updates
        const myNewPaddleY = this.playerNumber === 1 ? 
            this.simulationState.player1Y : 
            this.simulationState.player2Y;
            
        if (Math.abs(myOldPaddleY - myNewPaddleY) > 1) {
            console.log(`My paddle position: ${myOldPaddleY.toFixed(2)} -> ${myNewPaddleY.toFixed(2)}`);
        }
        
        // Re-apply pending inputs after server updates
        this.reapplyPendingInputs();
    }
    
    reconcilePlayerPaddle(serverState) {
        if (!this.playerNumber) return;
        
        // Compare server position with our predicted position
        if (this.playerNumber === 1) {
            const serverPos = serverState.player_1_paddle_y;
            const clientPos = this.simulationState.player1Y;
            const diff = serverPos - clientPos;
            
            // Determine if a ball collision is imminent (ball approaching paddle)
            const isNearCollision = this.isCollisionImminent(1);
            
            // If difference is significant, reconcile
            if (Math.abs(diff) > 3) {
                // Use a stronger correction factor when collision is imminent
                const correctionFactor = isNearCollision ? 0.7 : 0.3;
                
                // Correct position with appropriate weight toward server
                this.simulationState.player1Y = clientPos + diff * correctionFactor;
                
                // Reapply pending inputs
                this._pendingInputs.forEach(input => {
                    this.applyInput(input);
                });
            }
        } else if (this.playerNumber === 2) {
            const serverPos = serverState.player_2_paddle_y;
            const clientPos = this.simulationState.player2Y;
            const diff = serverPos - clientPos;
            
            // Determine if a ball collision is imminent (ball approaching paddle)
            const isNearCollision = this.isCollisionImminent(2);
            
            if (Math.abs(diff) > 3) {
                // Use a stronger correction factor when collision is imminent
                const correctionFactor = isNearCollision ? 0.7 : 0.3;
                
                this.simulationState.player2Y = clientPos + diff * correctionFactor;
                
                this._pendingInputs.forEach(input => {
                    this.applyInput(input);
                });
            }
        }
    }

    // New helper method to determine if ball is about to collide with paddle
    isCollisionImminent(playerNumber) {
        // Ball position and velocity
        const ballX = this.simulationState.ballX;
        const ballY = this.simulationState.ballY;
        const ballSpeedX = this.simulationState.ballSpeedX;
        const ballRadius = this.ballSize / 2;
        
        // Check if ball is moving toward the paddle
        const movingTowardPaddle = (playerNumber === 1 && ballSpeedX < 0) || 
                                   (playerNumber === 2 && ballSpeedX > 0);
        
        if (!movingTowardPaddle) return false;
        
        // Paddle properties
        const paddleWidth = this.paddleWidth;
        const paddleY = playerNumber === 1 ? 
                        this.simulationState.player1Y : 
                        this.simulationState.player2Y;
        const paddleHeight = this.paddleHeight;
        
        // Calculate distance to paddle
        const distanceToPaddle = playerNumber === 1 ? 
                                ballX - (paddleWidth + ballRadius) : 
                                (this.canvas.width - paddleWidth - ballRadius) - ballX;
        
        // Check if ball is close to paddle horizontally (within ~3 frames of collision at current speed)
        const isCloseHorizontally = distanceToPaddle <= Math.abs(ballSpeedX) * 3 && distanceToPaddle >= 0;
        
        // Check if ball is at a height that could potentially hit the paddle
        const canHitVertically = ballY + ballRadius >= paddleY && 
                                ballY - ballRadius <= paddleY + paddleHeight;
        
        // Calculate if the ball will hit within the next few frames
        return isCloseHorizontally && canHitVertically;
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

    // New method to reapply pending inputs after server update
    reapplyPendingInputs() {
        if (!this.playerNumber || this._pendingInputs.length === 0) return;
        
        // Sort inputs by sequence to apply in correct order
        const sortedInputs = [...this._pendingInputs].sort((a, b) => a.sequence - b.sequence);
        
        for (const input of sortedInputs) {
            // Only apply if it's a key event or paddle position update
            if (input.type === 'key_event') {
                this.applyInput(input);
            } else if (input.type === 'paddle_position') {
                if (this.playerNumber === 1) {
                    this.simulationState.player1Y = input.position;
                } else if (this.playerNumber === 2) {
                    this.simulationState.player2Y = input.position;
                }
            }
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
        
        // Fixed physics timestep (1/60 second)
        const physicsStep = 1/60;
        
        // Run simulation steps
        while (this.accumulator >= physicsStep) {
            this.updateSimulation(physicsStep);
            this.accumulator -= physicsStep;
        }
        
        // Interpolate game state for rendering
        this.interpolateState();
        
        // Debug: Display network status and input state
        if (this._debugCounter === undefined) {
            this._debugCounter = 0;
        }
        
        this._debugCounter++;
        if (this._debugCounter % 60 === 0) {  // Log every 60 frames (about 1 second)
            console.log(`Input state: upPressed=${this.upPressed}, downPressed=${this.downPressed}`);
            if (this.playerNumber === 1) {
                console.log(`Player 1 paddle position: ${this.simulationState.player1Y.toFixed(2)}`);
            } else if (this.playerNumber === 2) {
                console.log(`Player 2 paddle position: ${this.simulationState.player2Y.toFixed(2)}`);
            }
        }
        
        // Render the game
        this.render();
    }

    updateSimulation(deltaTime) {
        // Only update our own paddle based on input
        if (this.playerNumber) {
            const paddleSpeed = this.paddleSpeed * deltaTime;
            
            // Store previous position for comparison
            const prevPosition = this.playerNumber === 1 ? 
                this.simulationState.player1Y : this.simulationState.player2Y;
            
            // Apply input-based movement
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
            
            // Get current position after input
            const currPosition = this.playerNumber === 1 ? 
                this.simulationState.player1Y : this.simulationState.player2Y;
            
            // Debug logging
            if (Math.abs(prevPosition - currPosition) > 0.1) {
                console.log(`Local paddle moved: ${prevPosition.toFixed(2)} -> ${currPosition.toFixed(2)}`);
            }
            
            // Always send paddle updates when keys are pressed, not just when position changed
            // This ensures the server knows our current input state
            if (Math.abs(prevPosition - currPosition) > 0.1 || this.upPressed || this.downPressed) {
                this.sendPaddlePosition();
            }
        }
    }
    
    // Send paddle position and input state to server
    sendPaddlePosition() {
        if (!this.socket || !this.playerNumber) return;
        
        const now = Date.now();
        // Rate limit to avoid flooding the server
        if (now - (this.lastPaddleUpdate || 0) < 33) return; // ~30 Hz updates
        
        const position = this.playerNumber === 1 ? 
            this.simulationState.player1Y : this.simulationState.player2Y;
        
        // Check if ball collision is imminent
        const isNearCollision = this.isCollisionImminent(this.playerNumber);
        
        // Include movement flags in the update to ensure server has current state
        this.socket.send('paddle_position', {
            player_number: this.playerNumber,
            position: position,
            sequence: this._inputSequence, // Include the latest input sequence
            moving_up: this.upPressed,
            moving_down: this.downPressed,
            isNearCollision: isNearCollision
        });
        
        console.log(`Sent paddle position: ${position.toFixed(2)}, movingUp: ${this.upPressed}, movingDown: ${this.downPressed}, nearCollision: ${isNearCollision}`);
        
        this.lastPaddleUpdate = now;
        this._lastSentPosition = position;
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
        
        // Check if ball is near collision for potential extrapolation
        const isNearPaddle1 = this.isCollisionImminent(1);
        const isNearPaddle2 = this.isCollisionImminent(2);
        const isNearCollision = isNearPaddle1 || isNearPaddle2;
        
        // Interpolate paddle positions
        this.renderState.player1Y = this.lerp(beforeState.player1Y, afterState.player1Y, t);
        this.renderState.player2Y = this.lerp(beforeState.player2Y, afterState.player2Y, t);
        
        // Ball position - either interpolate or extrapolate based on collision proximity
        if (isNearCollision && !this.paused && (this.simulationState.ballSpeedX !== 0 || this.simulationState.ballSpeedY !== 0)) {
            // Use extrapolation based on current velocity for smoother collision visuals
            const extrapolationTime = 16; // Look 16ms into the future
            const ballX = this.simulationState.ballX;
            const ballY = this.simulationState.ballY;
            const ballSpeedX = this.simulationState.ballSpeedX;
            const ballSpeedY = this.simulationState.ballSpeedY;
            
            this.renderState.ballX = ballX + ballSpeedX * (extrapolationTime / 1000);
            this.renderState.ballY = ballY + ballSpeedY * (extrapolationTime / 1000);
        } else {
            // Normal interpolation for non-collision scenarios
            this.renderState.ballX = this.lerp(beforeState.ballX, afterState.ballX, t);
            this.renderState.ballY = this.lerp(beforeState.ballY, afterState.ballY, t);
        }
        
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
}