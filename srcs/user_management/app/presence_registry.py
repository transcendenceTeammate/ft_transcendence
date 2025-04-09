from datetime import datetime, timedelta
import logging

EXPIRATION_THRESHOLD = timedelta(seconds=10)


class PresenceService:
    def __init__(self):
        self.connection_store = {}

    def _get_current_time(self):
        return datetime.now()

    def register_connection(self, userId):
        userConnections = self.connection_store.setdefault(userId, {}).setdefault("connections", {})
        connectionId = len(userConnections) + 1
        userConnections[connectionId] = {"last_seen": self._get_current_time()}
        return connectionId

    def ping_connection(self, userId, connectionId):
        userConnections = self.connection_store.setdefault(userId, {}).setdefault("connections", {})
        userConnections[connectionId] = {"last_seen": self._get_current_time()}

    def is_connection_valid(self, userId, connectionId):
        user = self.connection_store.get(userId)
        if not user or "connections" not in user:
            return False

        connection = user["connections"].get(connectionId)
        if not connection:
            return False

        now = self._get_current_time()
        return now - connection["last_seen"] <= EXPIRATION_THRESHOLD

    def is_user_connected(self, userId):
        user = self.connection_store.get(userId)
        if not user:
            return False

        now = self._get_current_time()
        for connection in user.get("connections", {}).values():
            if now - connection["last_seen"] <= EXPIRATION_THRESHOLD:
                return True
        return False
    
    def remove_connection(self, userId, connectionId):
        user = self.connection_store.get(userId)
        if user and "connections" in user:
            user["connections"].pop(connectionId, None)
            if not user["connections"]:
                self.connection_store.pop(userId, None)
    



presenceService = PresenceService()


