/**
 * SimpleWebSocket.js
 * Enhanced WebSocket client for the Pong game with optimized networking.
 * Supports delta updates, latency measurement, and reconnection.
 */

export default class SimpleWebSocket {
    /**
     * Create a new WebSocket client
     * @param {string} url - The WebSocket server URL
     * @param {Function} onMessage - Callback for incoming messages
     * @param {Function} onConnect - Callback when connection is established
     * @param {Function} onDisconnect - Callback when connection is closed
     * @param {Function} onError - Callback for errors
     */
    constructor(url, onMessage, onConnect, onDisconnect, onError) {
        this.url = url;
        this.socket = null;
        this.connected = false;
        
        // Callbacks
        this.onMessage = onMessage || function() {};
        this.onConnect = onConnect || function() {};
        this.onDisconnect = onDisconnect || function() {};
        this.onError = onError || function() {};
        
        // Debug mode (logs to console)
        this.debug = false;
        
        // Reconnection settings
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 2000; // ms
        this.reconnecting = false;
        this.reconnectTimeout = null;
        
        // Message buffering when disconnected
        this.messageQueue = [];
        
        // Sequence tracking for input acknowledgment
        this.sequenceNumber = 0;
        this.lastAcknowledgedSequence = 0;
        
        // Latency measurement
        this.pingInterval = null;
        this.latencyMeasurements = [];
        this.latencyHistory = [];
    }
    
    /**
     * Enable or disable debug mode
     * @param {boolean} enable - Whether to enable debug mode
     */
    setDebug(enable) {
        this.debug = !!enable;
    }
    
    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || 
                            this.socket.readyState === WebSocket.CONNECTING)) {
            if (this.debug) console.log('Already connected or connecting');
            return;
        }
        
        try {
            if (this.debug) console.log(`Connecting to ${this.url}`);
            
            this.socket = new WebSocket(this.url);
            
            this.socket.onopen = (event) => {
                this.connected = true;
                this.reconnectAttempts = 0;
                
                if (this.debug) console.log('WebSocket connected');
                
                // Process any queued messages
                this.processQueue();
                
                // Start ping interval for latency measurement
                this.startPingInterval();
                
                // Call connect callback
                this.onConnect(event);
            };
            
            this.socket.onclose = (event) => {
                this.connected = false;
                if (this.pingInterval) {
                    clearInterval(this.pingInterval);
                    this.pingInterval = null;
                }
                
                if (this.debug) console.log(`WebSocket disconnected: ${event.code}`);
                
                // Call disconnect callback
                this.onDisconnect(event);
                
                // Attempt to reconnect if not explicitly closed and not exceeding max attempts
                if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                }
            };
            
            this.socket.onerror = (error) => {
                if (this.debug) console.error('WebSocket error:', error);
                this.onError(error);
            };
            
            this.socket.onmessage = (event) => {
                if (this.debug) console.log('Message received');
                try {
                    const data = JSON.parse(event.data);
                    
                    // Handle special message types internally
                    if (data.type === 'ping') {
                        // Respond to ping requests immediately
                        this.send('pong', { time: data.time });
                        return;
                    } else if (data.type === 'input_ack' && data.sequence) {
                        // Update last acknowledged sequence
                        this.lastAcknowledgedSequence = Math.max(
                            this.lastAcknowledgedSequence, 
                            data.sequence
                        );
                        
                        // Calculate latency from server timestamp
                        if (data.server_time) {
                            const rtt = Date.now() - data.server_time;
                            this.updateLatencyMeasurement(rtt);
                        }
                    } else if (data.type === 'prediction_ack' && data.sequence) {
                        // Update latency from server timestamp
                        if (data.server_time) {
                            const rtt = Date.now() - data.server_time;
                            this.updateLatencyMeasurement(rtt);
                        }
                    }
                    
                    // Forward all messages to callback
                    this.onMessage(data);
                } catch (e) {
                    if (this.debug) console.error('Error parsing message:', e);
                    this.onError(new Error('Invalid message format'));
                }
            };
        } catch (error) {
            if (this.debug) console.error('Connection error:', error);
            this.onError(error);
        }
    }
    
    /**
     * Attempt to reconnect to the server
     */
    attemptReconnect() {
        if (this.reconnecting) return;
        
        this.reconnecting = true;
        this.reconnectAttempts++;
        
        if (this.debug) {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        }
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnecting = false;
            this.connect();
        }, this.reconnectInterval);
    }
    
    /**
     * Process the message queue after reconnection
     */
    processQueue() {
        if (this.messageQueue.length === 0) return;
        
        if (this.debug) {
            console.log(`Processing ${this.messageQueue.length} queued messages`);
        }
        
        // Process all queued messages
        while (this.messageQueue.length > 0) {
            const [type, data] = this.messageQueue.shift();
            this.send(type, data);
        }
    }
    
    /**
     * Start ping interval for latency measurement
     */
    startPingInterval() {
        // Clear any existing interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        // Start new interval (every 5 seconds)
        this.pingInterval = setInterval(() => {
            // Only send ping if connected
            if (this.isConnected()) {
                // No need to send explicit pings as server now sends them
            }
        }, 5000);
    }
    
    /**
     * Update latency measurement based on round-trip time
     * @param {number} rtt - Round-trip time in milliseconds
     */
    updateLatencyMeasurement(rtt) {
        // Calculate one-way latency (half of RTT)
        const latency = rtt / 2;
        
        // Store measurement in history (keep last 10)
        this.latencyMeasurements.push(latency);
        if (this.latencyMeasurements.length > 10) {
            this.latencyMeasurements.shift();
        }
        
        // Add to longer history for trends (keep last 100)
        this.latencyHistory.push({
            time: Date.now(),
            value: latency
        });
        if (this.latencyHistory.length > 100) {
            this.latencyHistory.shift();
        }
        
        if (this.debug && this.latencyMeasurements.length % 5 === 0) {
            console.log(`Current latency: ${this.getLatency()}ms`);
        }
    }
    
    /**
     * Get the current average latency
     * @returns {number} - Average latency in milliseconds
     */
    getLatency() {
        if (this.latencyMeasurements.length === 0) {
            return 50; // Default estimate
        }
        
        // If we have enough measurements, remove outliers
        if (this.latencyMeasurements.length >= 3) {
            // Sort measurements
            const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);
            
            // Remove highest and lowest values
            const filtered = sorted.slice(1, -1);
            
            // Calculate average
            const sum = filtered.reduce((acc, val) => acc + val, 0);
            return Math.round(sum / filtered.length);
        }
        
        // Simple average for few measurements
        const sum = this.latencyMeasurements.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / this.latencyMeasurements.length);
    }
    
    /**
     * Disconnect from the WebSocket server
     */
    disconnect() {
        // Clear reconnection timeout if active
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        // Clear ping interval if active
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.socket) {
            if (this.debug) console.log('Disconnecting');
            this.socket.close(1000, "Normal closure");
            this.socket = null;
        }
        
        this.connected = false;
        this.reconnecting = false;
    }
    
    /**
     * Send a message to the server
     * @param {string} type - Message type
     * @param {Object} data - Message data
     * @returns {boolean} - Whether the message was sent
     */
    send(type, data = {}) {
        // Add sequence number for messages that need acknowledgment
        if (['key_event', 'paddle_position', 'client_prediction'].includes(type)) {
            this.sequenceNumber++;
            data.sequence = this.sequenceNumber;
        }
        
        // Add timestamp for all messages
        data.client_time = Date.now();
        
        if (!this.isConnected()) {
            // Queue message to send after reconnection
            if (this.debug) console.log(`Queuing message: ${type}`);
            this.messageQueue.push([type, data]);
            return false;
        }
        
        try {
            const message = {
                type: type,
                ...data
            };
            
            this.socket.send(JSON.stringify(message));
            if (this.debug && type !== 'pong') console.log(`Sent message: ${type}`);
            return true;
        } catch (error) {
            if (this.debug) console.error('Error sending message:', error);
            this.onError(error);
            
            // Queue message to try again later
            this.messageQueue.push([type, data]);
            return false;
        }
    }
    
    /**
     * Check if the socket is currently connected
     * @returns {boolean} - Connection status
     */
    isConnected() {
        return this.connected && this.socket && this.socket.readyState === WebSocket.OPEN;
    }
    
    /**
     * Get the current sequence number
     * @returns {number} - Sequence number
     */
    getSequenceNumber() {
        return this.sequenceNumber;
    }
    
    /**
     * Get the last acknowledged sequence number
     * @returns {number} - Last acknowledged sequence number
     */
    getLastAcknowledgedSequence() {
        return this.lastAcknowledgedSequence;
    }
    
    /**
     * Get latency history data for charting
     * @returns {Array} - Array of latency measurements with timestamps
     */
    getLatencyHistory() {
        return this.latencyHistory;
    }
} 