import json
import asyncio
from enum import Enum
from channels.generic.websocket import AsyncWebsocketConsumer

from app.presence_registry import presenceService

PING_INTERVAL = 4

class SendEventType(Enum):
    PING = "ping"

class ReceiveEventType(Enum):
    PONG = "pong"

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

        # set_user_status(self.user_id, PresenceStatus.ONLINE.value)
        self.connection_id = presenceService.register_connection(self.user_id)
        self.ping_task = asyncio.create_task(self.ping_loop())


    async def disconnect(self, close_code):
        self.alive = False
        presenceService.remove_connection(self.user_id, self.connection_id)

    async def receive(self, text_data):
        data = json.loads(text_data)
        event = data.get("eventType")
        payload = data.get("eventData", {})

        if event == ReceiveEventType.PONG.value:
            presenceService.ping_connection(self.user_id, self.connection_id)

    async def ping_loop(self):
        while self.alive and presenceService.is_connection_valid(self.user_id, self.connection_id):
            await self.send(json.dumps(SendEventFactory.ping()))
            await asyncio.sleep(PING_INTERVAL)
