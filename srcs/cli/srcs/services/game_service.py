import os
import httpx
from .auth_service import AuthService




class GameService:
    def __init__(self, app , auth: AuthService):

        self.auth = auth
        self.app = app

    def _get_headers(self):
        headers = {"Content-Type": "application/json"}
        token = self.auth.get_access_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def create_room(self, username: str | None = None):
        async with httpx.AsyncClient(verify=self.app.config.verify_cert) as client:
            payload = {}
            if username:
                payload["username"] = username
            response = await client.post(
                f"{self.app.config.matchmaking_url}/api/room/create/",
                headers=self._get_headers(),
                json=payload
            )

            
            return response.json()

    async def join_room(self, room_code: str, username: str | None = None):
        async with httpx.AsyncClient(verify=self.app.config.verify_cert) as client:
            payload = {"room_code": room_code}
            if username:
                payload["username"] = username
            response = await client.post(
                f"{self.app.config.matchmaking_url}/api/room/join/",
                headers=self._get_headers(),
                json=payload
            )
            return response.json()

    async def check_room(self, room_code: str):
        async with httpx.AsyncClient(verify=self.app.config.verify_cert) as client:
            response = await client.get(
                f"{self.app.config.matchmaking_url}/api/room/check/{room_code}/",
                headers=self._get_headers()
            )
            return response.json()
