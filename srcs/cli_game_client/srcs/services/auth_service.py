# srcs/services/auth_service.py

import os
import httpx
import json


class AuthenticationError(Exception):
    pass

class AuthService:
    def __init__(self, app):
        self.access_token = None
        self.username = None
        self.app = app

    async def _post(self, endpoint: str, data: dict) -> dict:
        url = f"{self.app.config.matchmaking_url}{endpoint}"
        async with httpx.AsyncClient(verify=self.app.config.verify_cert) as client:
            response = await client.post(
                url,
                json=data,
                headers={"Content-Type": "application/json"},
                timeout=5.0,
            )

            try:
                response_data = response.json()
            except json.JSONDecodeError:
                raise AuthenticationError(f"Invalid response from server: {response.text}")

            if response.status_code == 200:
                token = response.cookies.get("access_token")
                if not token:
                    raise AuthenticationError("Missing access token in response")
                self.access_token = token
                self.username = data.get("username")
                return response_data
            else:
                raise AuthenticationError(response_data.get("error", "Unknown error"))

    async def login(self, username: str, password: str):
        return await self._post("/api/auth/login/", {"username": username, "password": password})

    async def signup(self, username: str, password: str):
        return await self._post("/api/auth/signup/", {"username": username, "password": password})

    def get_access_token(self) -> str | None:
        return self.access_token

    def get_username(self) -> str | None:
        return self.username

    def is_authenticated(self) -> bool:
        return self.access_token is not None

    def logout(self):
        self.access_token = None
        self.username = None
