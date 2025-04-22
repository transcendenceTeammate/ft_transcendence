
from rest_framework.permissions import BasePermission
import os

class HasValidApiKey(BasePermission):
    def has_permission(self, request, view):
        api_key = request.headers.get('Authorization')

        if not api_key:
            return False

        expected_api_key = os.getenv('INTERNAL_API_TOKEN')
        if api_key != f"ApiKey {expected_api_key}":
            return False

        return True
