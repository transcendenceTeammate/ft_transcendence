
import json
import threading
import websocket
import time


class OnlinePongService:
    def __init__(self, room_code, player_id, username, server_url):
        self.room_code = room_code
        self.player_id = player_id
        self.username = username
        self.server_url = server_url

        self.ws = None
        self.connected = False
        self.last_state = {}
        self.is_you = False
        self.player_number = None
        self.sequence = 0

        self.callbacks = {
            "on_update": None,  # Callback to update the game (UI, etc)
            "on_score": None,   # Callback for scoring events
            "on_game_over": None  # Callback when game ends
        }

    def connect(self):
        url = f"{self.server_url}/ws/game/{self.room_code}/?token="
        self.ws = websocket.WebSocketApp(
            url,
            on_message=self.on_message,
            on_open=self.on_open,
            on_close=self.on_close,
            on_error=self.on_error
        )
        threading.Thread(target=self.ws.run_forever, daemon=True).start()

    def on_open(self, ws):
        print("[WS] Connected")
        self.connected = True
        self.send({
            "type": "join_game",
            "player_id": self.player_id,
            "username": self.username,
            "timestamp": int(time.time() * 1000)
        })

    def on_close(self, ws, code, msg):
        print(f"[WS] Disconnected: {code} {msg}")
        self.connected = False

    def on_error(self, ws, error):
        print(f"[WS] Error: {error}")

    def on_message(self, ws, message):
        data = json.loads(message)
        event_type = data.get("type")

        if event_type in ("game_state", "game_state_delta"):
            self.last_state.update(data)
            if self.callbacks["on_update"]:
                self.callbacks["on_update"](self.get_game_state())

        elif event_type == "player_joined":
            if data.get("is_you"):
                self.player_number = data["player_number"]
                print(f"[WS] You joined as player {self.player_number}")

        elif event_type == "goal_scored":
            if self.callbacks["on_score"]:
                self.callbacks["on_score"](data)

        elif event_type == "game_over":
            if self.callbacks["on_game_over"]:
                self.callbacks["on_game_over"](data)

        elif event_type == "error":
            print(f"[WS] Error message: {data.get('message')}")

    def send(self, payload):
        if self.ws and self.connected:
            self.ws.send(json.dumps(payload))

    def move_paddle(self, position):
        """Send your paddle position to the server."""
        if self.player_number:
            self.sequence += 1
            self.send({
                "type": "paddle_position",
                "player_number": self.player_number,
                "position": position,
                "sequence": self.sequence,
                "timestamp": int(time.time() * 1000)
            })

    def get_game_state(self):
        """Returns current snapshot of the game."""
        return {
            "ball": (
                self.last_state.get("ball_x"),
                self.last_state.get("ball_y")
            ),
            "left_paddle": self.last_state.get("player_1_paddle_y"),
            "right_paddle": self.last_state.get("player_2_paddle_y"),
            "score": (
                self.last_state.get("player_1_score"),
                self.last_state.get("player_2_score")
            ),
            "status": self.last_state.get("status"),
            "paused": self.last_state.get("is_paused"),
            "player_number": self.player_number,
        }

    def set_callback(self, event, func):
        """Register UI/game logic callbacks: 'on_update', 'on_score', 'on_game_over'"""
        if event in self.callbacks:
            self.callbacks[event] = func

