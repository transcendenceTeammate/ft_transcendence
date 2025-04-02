"""
ASGI config for project project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')


from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from app.routing import websocket_urlpatterns
from app.middleware.cookie_auth import CookieAuthMiddleware

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": CookieAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
