import httpx
import os
import json

USER_MGMT_URL = os.getenv("USER_MGMT_URL", "https://api.app.127.0.0.1.nip.io:8443")

class AuthenticationError(Exception):
    pass


class AuthService:
    def __init__(self):
        self.client = httpx.Client(verify=False)

    def _post(self, endpoint, data):
        try:
            print(f"{USER_MGMT_URL}{endpoint}")

            response = self.client.post(
                f"{USER_MGMT_URL}{endpoint}",
                json=data,
                headers={
                    "Content-Type": "application/json",
                    "Host": "api.app.127.0.0.1.nip.io:8443"
                },
                timeout=5,
            )
            try:
                response_data = response.json()
            except json.JSONDecodeError:
                raise AuthenticationError(f"Server response: {response.text}")

            if response.status_code == 200:
                access_token = response.cookies.get('access_token')
                if not access_token:
                    raise AuthenticationError("No access token in cookies")
                return {
                    'username': data['username'],
                    'access_token': access_token,
                    'client': self.client,
                    **response_data
                }
            else:
                raise AuthenticationError(f"{response_data['error']}")
        except httpx.RequestError as e:
            raise AuthenticationError(f"Connection error: {str(e)}")

    def login(self, username, password):
        return self._post("/api/auth/login/", {"username": username, "password": password})

    def signup(self, username, password):
        return self._post("/api/auth/signup/", {"username": username, "password": password})


class UserManager:
    def __init__(self):
        self.auth_service = AuthService()
        self.username = None

    def login(self, username, password):
        self.auth_service.login(username, password)
        self.username = username

    def signup(self, username, password):
        self.auth_service.signup(username, password)
        self.username = username

    def is_authenticated(self):
        return self.username is not None

    def get_username(self):
        return self.username

    def logout(self):
        self.username = None


userManager = UserManager()
