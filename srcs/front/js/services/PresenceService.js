import { Stream } from "../core/Stream.js";
import CONFIG from "../config.js";
import { AuthProvider, AuthConnectionStatus } from "../data/providers/AuthProvider.js";



const ConnectionStatus = Object.freeze({
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
});

const PresenceStatus = Object.freeze({
    ONLINE: 'online',
    OFFLINE: 'offline',
});

const SendEventType = Object.freeze({
    PONG: 'pong',
});

const ReceiveEventType = Object.freeze({
    PING: 'ping',
});


class SendEventFactory {
    static pong() {
        return {
            eventType: SendEventType.PONG,
            eventData: {},
        };
    }
}

export class PresenceService
{
    static _instance = null;

    constructor()
    {
        this._baseUrl = `${CONFIG.API_URL}`;
        this._connectionStatus = Stream.withDefault(ConnectionStatus.DISCONNECTED);
        this._webSocket = null;
        AuthProvider.getInstance().authConnectionStatusStream.listen((status) => {
            switch (status) {
                case AuthConnectionStatus.CONNECTED:
                    this.connect();
                    break;
                case AuthConnectionStatus.DISCONNECTING:
                    this.disconnect();
                    break;
                default:
                    this.disconnect();
            }
        });
    }


    connect()
    {
        this._connectionStatus = Stream.withDefault(ConnectionStatus.CONNECTING);
        this._webSocket = new WebSocket(this._baseUrl.replace(/^http/, "ws") + "/ws/presence");
        this._webSocket.onopen = this._onWsOpen.bind(this);
        this._webSocket.onclose = this._onWsClose.bind(this);
        this._webSocket.onerror = this._onWsError.bind(this);
        this._webSocket.onmessage = this._onWsMessage.bind(this);
    }
 

    onConnected()
    {
        this._connectionStatus.value = ConnectionStatus.CONNECTED;
    }

    disconnect()
    {
        this._connectionStatus.value = ConnectionStatus.DISCONNECTED;
        if (this._webSocket?.readyState === WebSocket.OPEN || this._webSocket?.readyState === WebSocket.CONNECTING) {
            this._webSocket.close(1000, "Normal closure");
        }
    }


    _sendPongResponse()
    {
        this._sendMessage(SendEventFactory.pong());
    }

    
    _sendMessage(event)
    {
        if (this._webSocket?.readyState === WebSocket.OPEN) {
            this._webSocket.send(JSON.stringify(event));
        } else {
            console.warn("WebSocket is not open. Unable to send message:", event);
        }
    }

    _handleMessage(event) {
        const message = JSON.parse(event.data);
        console.debug(message);

        switch (message.eventType) {
            case ReceiveEventType.PING:
                this._sendPongResponse();
                break;
            default:
                console.warn("Unknown event type received:", message.eventType);
        }
    }



    // _WebSocket callbacks

    _onWsOpen()
    {
        this._connectionStatus.value = ConnectionStatus.CONNECTED;

    }

    _onWsClose()
    {
        this._connectionStatus.value = ConnectionStatus.DISCONNECTED;
        
    }

    _onWsError()
    {
        this._connectionStatus.value = ConnectionStatus.DISCONNECTED;
        
    }

    _onWsMessage(message)
    {
        this._handleMessage(message);
    }

	static getInstance() {
		if (PresenceService._instance == null) {
			PresenceService._instance = new PresenceService();
		}
		return PresenceService._instance;
	}

}