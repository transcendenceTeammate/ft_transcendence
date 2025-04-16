from .auth_service import AuthService
from .game_service import GameService

class ServiceRegistry:
    def __init__(self):
        self.auth = AuthService()
        self.game = GameService(self.auth)
