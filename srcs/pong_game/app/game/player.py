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
        self.client_sequence = 0
