
import asyncio
from textual.screen import Screen
from textual.app import ComposeResult
from textual.widgets import Static
from textual.widgets._digits import Digits
from textual.containers import Container
from textual import events


class PaddleWidget(Static):
    """A widget that represents a paddle.
    
    The paddle is rendered as a fixed block of the paddle character with a configurable size.
    The widget is positioned absolutely by updating its 'offset' style.
    """
    def __init__(self, paddle_char: str, size: int = 5, **kwargs) -> None:
        content = "\n".join([paddle_char] * size)
        super().__init__(content, **kwargs)


class BallWidget(Static):
    """A widget that represents the ball.
    
    It simply renders the ball character and is absolutely positioned.
    """
    def __init__(self, **kwargs) -> None:
        super().__init__("◉", **kwargs)



class PaddleKeyHandler:
    def __init__(self, delay_ms=400):
        self._delay = delay_ms / 1000
        self._pressed_keys: dict[str, float] = {}  # tracks active keys

    def key_pressed(self, key: str):
        now = time.monotonic()
        self._pressed_keys[key] = now

    def release_expired_keys(self):
        now = time.monotonic()
        keys_to_release = []
        for key, pressed_time in self._pressed_keys.items():
            if now - pressed_time >= self._delay:
                keys_to_release.append(key)

        for key in keys_to_release:
            del self._pressed_keys[key]

    def is_key_pressed(self, key: str) -> bool:
        return key in self._pressed_keys


class PongGameScreen(Screen):
    CSS = """
    Screen { background: black; }
    #score { dock: top; color: white; text-align: center; }
    #game-wrapper {
    align-horizontal: center;
    content-align: center middle;
    height: auto;
    }
    #game-area { position: relative; width: 50%; border: round grey; }
    .paddle, .ball { position: absolute; }
    .paddle { width: 3; height: 5; }
    .ball { width: 1; height: 1; }
    """

    def compose(self):
        yield Digits("", id="score")
        with Container(id="game-wrapper"):
            yield Static("", id="game-area")

    async def on_mount(self):
        area = self.query_one("#game-area", Static)
        area_width = area.size.width or 80
        area_height = int(area_width * 240 / 800)
        area.styles.height = area_height

        self.game = OnlinePongService(
            room_code=self.app.room_code,
            player_id=self.app.player_id,
            username=self.app.username,
            server_url=self.app.config.ws_url,
            token=self.app.services.auth.get_access_token()
        )
        self.game.connect()

        self.left_paddle = PaddleWidget("▌", classes="paddle")
        self.right_paddle = PaddleWidget("▐", classes="paddle")
        self.ball = BallWidget(classes="ball")

        await area.mount(self.left_paddle)
        await area.mount(self.right_paddle)
        await area.mount(self.ball)

        self.key_handler = PaddleKeyHandler()
        self.update_time = self.set_interval(0.01, self.update_game)

    def update_game(self):
        self.key_handler.release_expired_keys()

        active_keys = list(self.key_handler._pressed_keys.keys())
        direction_map = {
            "a": -1, "q": 1,
            "up": -1, "down": 1
        }

        # Move paddle continuously based on currently "pressed" keys
        for key in active_keys:
            if key in direction_map:
                direction = direction_map[key]
                self.game.move_paddle(direction * 10)  # Adjust movement scalar as needed


        state = self.game.get_game_state()
        if state["status"] == "FINISHED":
            self.handle_game_over(state)
            return
        area = self.query_one("#game-area", Static)
        w, h = area.size.width or 80, area.size.height or 24

        self.left_paddle.styles.offset = (0, int(state["left_paddle"] * h / 600))
        self.right_paddle.styles.offset = (w - 1, int(state["right_paddle"] * h / 600))
        self.ball.styles.offset = (
            int(float(state["ball"][0]) * float(w) / 800.0),
            int(float(state["ball"][1]) * float(h) / 600.0),
        )

        self.query_one("#score", Digits).update(f"{state['score'][0]:02} - {state['score'][1]:02}")

    async def on_key(self, event: events.Key):
        key = event.key
        direction_map = {
            "a": -1, "q": 1,
            "up": -1, "down": 1
        }

        if key == "space":
            self.game.resume_game()

        # if key in direction_map:
        #     direction = direction_map[key]
            # self.game.move_paddle(direction * 25)
        if key in ["a", "q", "up", "down"]:
            
            self.key_handler.key_pressed(key)

    def handle_game_over(self, data):
        self.update_time.stop()
        self.app.room_code = None
        self.app.player_id = None
        self.app.username = None
        self.app.pop_screen()




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
        self.player_number = None
        self.sequence = 0

        self.callbacks = {
            "on_update": None,
            "on_score": None,
            "on_game_over": None
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

