from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async

@database_sync_to_async
def get_user_from_cookie(scope):
    try:
        from django.contrib.auth.models import AnonymousUser
        from rest_framework_simplejwt.authentication import JWTAuthentication

        headers = dict(scope.get("headers", []))
        cookies = {}

        cookie_header = headers.get(b'cookie', b'').decode()
        for chunk in cookie_header.split(";"):
            if "=" in chunk:
                k, v = chunk.strip().split("=", 1)
                cookies[k] = v

        token = cookies.get("access_token")
        if not token:
            return AnonymousUser()

        validated = JWTAuthentication().get_validated_token(token)
        return JWTAuthentication().get_user(validated)

    except Exception:
        from django.contrib.auth.models import AnonymousUser
        return AnonymousUser()

class CookieAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope["user"] = await get_user_from_cookie(scope)
        return await super().__call__(scope, receive, send)
