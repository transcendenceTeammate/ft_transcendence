import time

class PlayerSession:
    """In-memory player session (replaces the database model)"""
    
    def __init__(self, room_code, player_id, player_number, username=None, connected=True):
        self.room_code = room_code
        self.player_id = player_id
        self.player_number = player_number
        self.username = username or f"Player-{player_number}"
        self.connected = connected
        self.last_active = time.time()
        self.created_at = time.time()
        self.disconnect_time = None
        self.client_sequence = 0
        
    def mark_disconnected(self):
        """Mark the player as disconnected and record the time"""
        self.connected = False
        self.disconnect_time = time.time()
        return self
        
    def mark_connected(self):
        """Mark the player as connected and update activity time"""
        self.connected = True
        self.disconnect_time = None
        self.last_active = time.time()
        return self
        
    def update_activity(self):
        """Update the last activity timestamp"""
        self.last_active = time.time()
        return self
        
    def time_disconnected(self):
        """Get the time (in seconds) since disconnection, or 0 if connected"""
        if self.connected or not self.disconnect_time:
            return 0
        return time.time() - self.disconnect_time
