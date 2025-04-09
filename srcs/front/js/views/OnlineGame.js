import AbstractView from "./AbstractView.js";
import Game from "./Game.js";
import GameConstants from "../core/GameConstants.js";

class WebSocket {
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
        this.avgLatency = 50;
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

            if (data.type === 'ping') {
                this.send('pong', { time: data.time });
                return;
            }

            if (data.type === 'input_ack' && data.sequence) {
                const rtt = Date.now() - data.server_time;
                this.updateLatencyMeasurement(rtt);
                this.lastAcknowledgedSequence = Math.max(this.lastAcknowledgedSequence, data.sequence);
                return;
            }

            if (data.type === 'prediction_ack' && data.sequence) {
                const rtt = Date.now() - data.server_time;
                this.updateLatencyMeasurement(rtt);
                this.emit('prediction_ack', data);
                return;
            }

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
        const latency = rtt / 2;

        this.latencyMeasurements.push(latency);
        if (this.latencyMeasurements.length > 10) {
            this.latencyMeasurements.shift();
        }

        if (this.latencyMeasurements.length > 3) {
            const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);
            const withoutExtremes = sorted.slice(1, -1);
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
        this.lastReceivedState = null;
        this.predictionEnabled = true;
        this.reconciliationEnabled = true;

        this.pendingInputs = [];

        this._lastSentPosition = null;
        this._lastStatusUpdate = 0;
        this._lastDebugUpdate = 0;
        this._lastMessageTime = 0;
        this.lastPaddleUpdate = 0;

        this.networkStatus = {
            connected: false,
            latency: 0
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

        this.gameLoop = this.GameLoop.bind(this);

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

        this.socket = new WebSocket(wsUrl, {
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

    GameLoop(timestamp) {
        requestAnimationFrame(this.gameLoop);

        if (this.gameOver) return;

        const now = timestamp || performance.now();
        const deltaTime = this.lastFrameTime ? (now - this.lastFrameTime) / 1000 : 0.016; // Convert to seconds
        this.lastFrameTime = now;

        const cappedDelta = Math.min(deltaTime, 0.1); // Max 100ms

        this.processPlayerInput(cappedDelta);
        this.updateWithPrediction(cappedDelta);
        this.draw();

        if (!this._lastStatusUpdate || now - this._lastStatusUpdate > 500) {
            this.updateConnectionStatus();
            this._lastStatusUpdate = now;
        }

        const debugOverlay = document.getElementById('debugOverlay');
        if (debugOverlay && debugOverlay.style.display === 'block') {
            if (!this._lastDebugUpdate || now - this._lastDebugUpdate > 500) {
                this.updateDebugInfo();
                this._lastDebugUpdate = now;
            }
        }
    }

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
    updateWithPrediction(deltaTime) {
        if (this.predictionEnabled && this.playerNumber) {

            this.interpolateOpponentPaddle(deltaTime);

            const now = Date.now();
            if (now - this.lastPaddleUpdate > 16) {
                this.sendPaddlePosition();
                this.lastPaddleUpdate = now;
            }
        }
    }

    interpolateOpponentPaddle(deltaTime) {
        const factor = 0.35 * (deltaTime * 60);
    
        if (this.playerNumber === 1) {
            const diff = this.opponentPaddleTarget - this.player2Y;
            if (Math.abs(diff) > 0.1) {
                this.player2Y += diff * factor;
            }
        } else if (this.playerNumber === 2) {
            const diff = this.opponentPaddleTarget - this.player1Y;
            if (Math.abs(diff) > 0.1) {
                this.player1Y += diff * factor;
            }
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
        this.lastReceivedState = { ...data };

        this.player1Score = data.player_1_score;
        this.player2Score = data.player_2_score;

        if (this.playerNumber === 1) {
            this.opponentPaddleTarget = data.player_2_paddle_y;
        } else if (this.playerNumber === 2) {
            this.opponentPaddleTarget = data.player_1_paddle_y;
        } else {
            this.player1Y = data.player_1_paddle_y;
            this.player2Y = data.player_2_paddle_y;
        }

        this.ballX = data.ball_x;
        this.ballY = data.ball_y;
        this.ballSpeedX = data.ball_speed_x;
        this.ballSpeedY = data.ball_speed_y;
        this.paused = data.is_paused;

        this.score1.textContent = this.player1Score;
        this.score2.textContent = this.player2Score;

        if (this.reconciliationEnabled && this.playerNumber) {
            if (this.playerNumber === 1) {
                this.reconcilePlayerPaddle(data.player_1_paddle_y, 1);
            } else if (this.playerNumber === 2) {
                this.reconcilePlayerPaddle(data.player_2_paddle_y, 2);
            }
        }
    }

    reconcilePlayerPaddle(serverPaddleY, playerNum) {
        const clientPaddleY = playerNum === 1 ? this.player1Y : this.player2Y;

        if (Math.abs(serverPaddleY - clientPaddleY) > 10) {
            if (playerNum === 1) {
                this.player1Y = serverPaddleY * 0.1 + clientPaddleY * 0.9;
            } else {
                this.player2Y = serverPaddleY * 0.1 + clientPaddleY * 0.9;
            }
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

        const position = this.playerNumber === 1 ? this.player1Y : this.player2Y;

        if (Math.abs(this._lastSentPosition - position) <= 1) return;
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

        if (this.networkStatus.connected) {
            indicator.classList.remove('disconnected', 'connecting');
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected', 'connecting');
            indicator.classList.add('disconnected');
        }

        if (this.socket) {
            const latency = Math.round(this.socket.getLatency() || 0);
            pingDisplay.textContent = `${latency}ms`;

            if (latency < 50) {
                pingDisplay.style.color = '#2ecc71';
            } else if (latency < 100) {
                pingDisplay.style.color = '#f39c12';
            } else {
                pingDisplay.style.color = '#e74c3c';
            }
        }
    }

    updateDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        if (!debugInfo) return;

        const info = {
            'Player': this.playerNumber || 'Spectator',
            'Connected': this.networkStatus.connected ? 'Yes' : 'No',
            'Ping': `${Math.round(this.socket?.getLatency() || 0)} ms`,
            'Ball Speed': `${Math.round(this.ballSpeedX)}, ${Math.round(this.ballSpeedY)}`
        };

        let html = '';
        for (const [key, value] of Object.entries(info)) {
            html += `<div><strong>${key}:</strong> ${value}</div>`;
        }

        debugInfo.innerHTML = html;
    }
}