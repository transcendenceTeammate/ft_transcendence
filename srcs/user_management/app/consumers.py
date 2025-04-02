import json
import asyncio
from enum import Enum
from channels.generic.websocket import AsyncWebsocketConsumer

from app.presence_registry import set_user_status, update_ping, get_user_status

class PresenceStatus(Enum):
    ONLINE = "online"
    OFFLINE = "offline"

class SendEventType(Enum):
    PING = "ping"

class ReceiveEventType(Enum):
    PONG = "pong"
    PRESENCE_UPDATE = "presence_update"

class SendEventFactory:
    @staticmethod
    def ping():
        return {
            "eventType": SendEventType.PING.value,
            "eventData": {},
        }

class PresenceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        await self.accept()
        self.user_id = self.user.id
        self.alive = True

        set_user_status(self.user_id, PresenceStatus.ONLINE.value)
        self.ping_task = asyncio.create_task(self.ping_loop())


    async def disconnect(self, close_code):
        self.alive = False

    async def receive(self, text_data):
        data = json.loads(text_data)
        event = data.get("eventType")
        payload = data.get("eventData", {})

        if event == ReceiveEventType.PONG.value:
            update_ping(self.user_id)

        elif event == ReceiveEventType.PRESENCE_UPDATE.value:
            new_status = payload.get("status", PresenceStatus.ONLINE.value)
            set_user_status(self.user_id, new_status)

    async def ping_loop(self):
        while self.alive and get_user_status(self.user_id) != PresenceStatus.OFFLINE.value:
            
            await self.send(json.dumps(SendEventFactory.ping()))
            await asyncio.sleep(4)
