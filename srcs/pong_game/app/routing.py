from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import re_path
from .consumers import GameConsumer

# Routes WebSocket pour le jeu
websocket_urlpatterns = [
    # Route pour les parties de jeu
    re_path(r'ws/game/(?P<room_code>\w+)/$', GameConsumer.as_asgi()),
]

# Configuration du routeur de protocole pour Channels
application = ProtocolTypeRouter({
    # Routeur pour les WebSockets
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})