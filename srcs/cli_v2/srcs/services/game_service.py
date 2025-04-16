# srcs/services/game_service.py

import os
import httpx
from .auth_service import AuthService

BASE_URL = os.getenv("BASE_URL", "https://app.127.0.0.1.nip.io:8443")
VERIFY_HTTP_CERTIFICATE = False

class GameService:
    def __init__(self, auth: AuthService):
        self.auth = auth

    def _get_headers(self):
        headers = {"Content-Type": "application/json"}
        token = self.auth.get_access_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def create_room(self, username: str | None = None):
        async with httpx.AsyncClient(verify=VERIFY_HTTP_CERTIFICATE) as client:
            payload = {}
            if username:
                payload["username"] = username
            response = await client.post(
                f"{BASE_URL}/api/room/create/",
                headers=self._get_headers(),
                json=payload
            )

            
            return response.json()

    async def join_room(self, room_code: str, username: str | None = None):
        async with httpx.AsyncClient(verify=VERIFY_HTTP_CERTIFICATE) as client:
            payload = {"room_code": room_code}
            if username:
                payload["username"] = username
            response = await client.post(
                f"{BASE_URL}/api/room/join/",
                headers=self._get_headers(),
                json=payload
            )
            return response.json()

    async def check_room(self, room_code: str):
        async with httpx.AsyncClient(verify=VERIFY_HTTP_CERTIFICATE) as client:
            response = await client.get(
                f"{BASE_URL}/api/room/check/{room_code}/",
                headers=self._get_headers()
            )
            return response.json()
