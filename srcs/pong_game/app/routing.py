from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path
from .consumers import GameConsumer

websocket_urlpatterns = [
    re_path(r'ws/game/(?P<room_code>\w+)/$', GameConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'websocket': URLRouter(websocket_urlpatterns),
})