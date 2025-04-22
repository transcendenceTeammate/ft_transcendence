from .auth_service import AuthService
from .game_service import GameService

class ServiceRegistry:
    def __init__(self, app):
        self.auth = AuthService(app)
        self.game = GameService(app, self.auth)
