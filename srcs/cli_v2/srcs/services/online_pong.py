
import json
import threading
import websocket
import time
import ssl

VERIFY_HTTP_CERTIFICATE = False

class OnlinePongService:
    def __init__(self, room_code, player_id, username, server_url, token):
        self.room_code = room_code
        self.player_id = player_id
        self.username = username
        self.server_url = server_url
        self.token = token

        self.ws = None
        self.connected = False
        self.last_state = {
            "ball_x": 0,
            "ball_y": 0,
            "player_1_paddle_y": 0,
            "player_2_paddle_y": 0,
            "player_1_score": 0,
            "player_2_score": 0,
            "status": "WAITING",
            "is_paused": False
        }
        self.is_you = False
        self.player_number = None
        self.sequence = 0

        self.callbacks = {
            "on_update": None,  # Callback to update the game (UI, etc)
            "on_score": None,   # Callback for scoring events
            "on_game_over": None  # Callback when game ends
        }

        print("Init Pong Online Service")

    def connect(self):
        print("Connect Pong Online Service")
        url = f"{self.server_url}/ws/game/{self.room_code}/?token=${self.token}"
        self.ws = websocket.WebSocketApp(
            url,
            on_message=self.on_message,
            on_open=self.on_open,
            on_close=self.on_close,
            on_error=self.on_error
        )
        if VERIFY_HTTP_CERTIFICATE:
            threading.Thread(target=self.ws.run_forever, daemon=True).start()
        else:
            threading.Thread(target=self.ws.run_forever, kwargs={"sslopt": {"cert_reqs": ssl.CERT_NONE}}, daemon=True).start()

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
            # self.ws.close()
            self.last_state["status"] = "FINISHED"
            self.ws.close()
            if self.callbacks["on_game_over"]:
                self.callbacks["on_game_over"](data)

        elif event_type == "error":
            print(f"[WS] Error message: {data.get('message')}")

    def send(self, payload):
        if self.ws and self.connected:
            self.ws.send(json.dumps(payload))

    def send_keypress(self, key, is_pressed):
        {"type":"key_event","key":key,"is_down": is_pressed,"player_number":self.player_number,"timestamp":int(time.time() * 1000)}

    def move_paddle(self, position_delta):
        if self.player_number:
            self.sequence += 1
            key = "player_1_paddle_y" if self.player_number == 1 else "player_2_paddle_y"
            current_position = self.last_state[key]

            
            paddle_height = 120
            game_height = 600

            new_position = max(0, min(game_height - paddle_height, current_position + position_delta))
            self.last_state[key] = new_position

            self.send({
                "type": "paddle_position",
                "player_number": self.player_number,
                "position": new_position,
                "sequence": self.sequence,
                "timestamp": int(time.time() * 1000)
            })
            
    def resume_game(self):
        if self.ws and self.player_number and self.last_state.get("is_paused"):
            last_loser = self.last_state.get("last_loser")
            player_1_score = self.last_state.get("player_1_score", 0)
            player_2_score = self.last_state.get("player_2_score", 0)

            if self.player_number != last_loser and (player_1_score + player_2_score > 0):
                return

            initial_speed_x = -7 if last_loser == 1 else 7
            initial_speed_y = (1 if time.time() % 2 > 1 else -1) * 5

            self.send({
                "type": "resume_game",
                "player_number": self.player_number,
                "ball_speed_x": initial_speed_x,
                "ball_speed_y": initial_speed_y,
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

