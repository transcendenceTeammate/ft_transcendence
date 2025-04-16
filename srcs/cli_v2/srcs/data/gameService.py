

class GameService:
    def __init__(self):
        self.room_code = ""
        self.players = []

    def create_room(self, room_name):
        # Logic to create a game room
        print(f"Room '{room_name}' created successfully.")
        return {"room_name": room_name, "players": []}

    def join_room(self, room_name, player_name):
        # Logic to join a game room
        print(f"Player '{player_name}' joined room '{room_name}'.")
        return {"room_name": room_name, "player_name": player_name}
    




# join_room

# player_joinned / openent_joined

# start_game



