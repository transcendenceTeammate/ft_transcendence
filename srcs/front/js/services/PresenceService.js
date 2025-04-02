import { Stream } from "../core/Stream.js";
import CONFIG from "../config.js";

// function initializeChatSocket() {
//     const chatSocket = new WebSocket("wss://api.app.localhost:8443/ws/chat/");

//     chatSocket.onopen = function() {
//         console.log('WebSocket connection established.');
//         const message = {
//             'message': 'Hello, world!'
//         };
//         chatSocket.send(JSON.stringify(message));
//     };

//     chatSocket.onmessage = function(event) {
//         const message = JSON.parse(event.data);
//         console.log('Received message:', message);
//     };
// }

// initializeChatSocket();

// window.takeMeThere = function (url) {
//     history.pushState(null, null, url);
//     router();
// }




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
    PRESENCE_UPDATE: 'presence_update',
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

    static presenceUpdate(status) {
        return {
            eventType: SendEventType.PRESENCE_UPDATE,
            eventData: { status: status },
        };
    }
}




export class PresenceService
{

    constructor()
    {
        this._baseUrl = `${CONFIG.API_URL}`;
        this._connectionStatus = Stream.withDefault(ConnectionStatus.DISCONNECTED);
        this._presenceStatus = Stream.withDefault(PresenceStatus.OFFLINE);
        this._webSocket = new WebSocket(this._baseUrl.replace(/^http/, "ws") + "/ws/presence");
        this._webSocket.onopen = this._onWsOpen.bind(this);
        this._webSocket.onclose = this._onWsClose.bind(this);
        this._webSocket.onerror = this._onWsError.bind(this);
        this._webSocket.onmessage = this._onWsMessage.bind(this);
    }

 

    onConnected()
    {
        this.setPresenceStatus(PresenceStatus.ONLINE);
    }

    disconnect()
    {
        this.setPresenceStatus(PresenceStatus.OFFLINE);
        if (this._webSocket.readyState === WebSocket.OPEN || this._webSocket.readyState === WebSocket.CONNECTING) {
            this._webSocket.close(1000, "Normal closure");
        }
    }

    setPresenceStatus(status)
    {
        this._sendPresenceStatus(status);
        this._presenceStatus.value = status;
    }

    _sendPresenceStatus(status)
    {
        this._sendMessage(SendEventFactory.presenceUpdate(PresenceStatus.ONLINE));
    }

    _sendPongResponse()
    {
        this._sendMessage(SendEventFactory.pong());
    }

    
    _sendMessage(event)
    {
        if (this._webSocket.readyState === WebSocket.OPEN) {
            this._webSocket.send(JSON.stringify(event));
        } else {
            console.error("WebSocket is not open. Unable to send message:", event);
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

    

}