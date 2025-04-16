from typing import Literal

from textual.app import App, ComposeResult, on
from textual.widgets import Input, Header, Footer, Button, Label, Pretty, Digits, Static
from textual.screen import ModalScreen, Screen
from rich.panel import Panel
from rich.align import Align
from textual.validation import Function, Number, ValidationResult, Validator
from textual import events


from srcs.services.services_registry import ServiceRegistry
from srcs.screens.home.HomeScreen import HomeScreen
# from srcs.screens.lobby.LobbyScreen import LobbyScreen
# from srcs.screens.login.LoginScreen import LoginScreen
# from srcs.screens.pong_game.PongGameScreen import PongGameScreen
from srcs.screens.signup.SignupScreen import SignUpScreen
from srcs.screens.login.LoginScreen import LoginScreen
# from srcs.screens.signup.SignupScreen import SignUpScreen
from srcs.screens.start_game.StartGameScreen import StartGameScreen




from srcs.services.game_service import GameService
from srcs.services.online_pong import OnlinePongService
# from srcs.widgets.paddle import PaddleWidget
# from srcs.widgets.ball import BallWidget



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



class StartGameScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Input(placeholder="Enter your username", id="usernameInput")
        yield Button("Create Room", id="createButton")
        yield Input(placeholder="Enter Room Code", id="roomCodeInput")
        yield Button("Join Room", id="joinButton")
        yield Footer()

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        username = self.query_one("#usernameInput", Input).value or "Guest"
        room_code = self.query_one("#roomCodeInput", Input).value.strip().upper()

        if event.button.id == "createButton":
            result = await self.app.services.game.create_room(username=username)
            if result.get("success"):
                self.app.room_code = result["room_code"]
                self.app.player_id = result["player_id"]
                self.app.username = username
                await self.app.push_screen(LobbyScreen())

        elif event.button.id == "joinButton":
            if room_code:
                result = await self.app.services.game.join_room(room_code, username=username)
                if result.get("success"):
                    self.app.room_code = result["room_code"]
                    self.app.player_id = result["player_id"]
                    self.app.username = username
                    await self.app.push_screen(LobbyScreen())


class LobbyScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Label("Waiting for opponent...", id="lobbyMessage")
        yield Label(f"Room Code: {self.app.room_code}", id="roomCodeLabel")
        yield Button("Leave Lobby", id="leaveButton")
        yield Footer()

    async def on_mount(self):
        self.set_interval(2.0, self.poll_room)

    async def poll_room(self):
        result = await self.app.services.game.check_room(self.app.room_code)
        if result.get("player_count") == 2:
            await self.app.push_screen(PongGameScreen())

    async def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "leaveButton":
            await self.app.pop_screen()


class PongGameScreen(Screen):
    CSS = """
    Screen { background: black; }
    #score { dock: top; color: white; text-align: center; }
    #game-area { position: relative; width: 100%; border: round grey; }
    .paddle, .ball { position: absolute; }
    .paddle { width: 3; height: 5; }
    .ball { width: 1; height: 1; }
    """

    def compose(self) -> ComposeResult:
        yield Digits("", id="score")
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
            server_url=self.app.ws_url
        )
        await self.game.connect()

        self.left_paddle = PaddleWidget("▌", classes="paddle")
        self.right_paddle = PaddleWidget("▐", classes="paddle")
        self.ball = BallWidget(classes="ball")

        await area.mount(self.left_paddle)
        await area.mount(self.right_paddle)
        await area.mount(self.ball)

        self.set_interval(0.01, self.update_game)

    def update_game(self):
        state = self.game.get_state()
        area = self.query_one("#game-area", Static)
        w, h = area.size.width or 80, area.size.height or 24

        self.left_paddle.styles.offset = (0, int(state["left_paddle"] * h / 600))
        self.right_paddle.styles.offset = (w - 1, int(state["right_paddle"] * h / 600))
        self.ball.styles.offset = (
            int(state["ball"][0] * w / 800),
            int(state["ball"][1] * h / 600),
        )

        self.query_one("#score", Digits).update(f"{state['score'][0]:02} - {state['score'][1]:02}")

    async def on_key(self, event: events.Key):
        key = event.key
        if key in ["a", "q"]:
            direction = -10 if key == "a" else 10
            await self.game.move_paddle("left", direction)
        elif key in ["up", "down"]:
            direction = -10 if key == "up" else 10
            await self.game.move_paddle("right", direction)



class Application(App):
    MODES = {
        "home": HomeScreen,
        "login": LoginScreen,
        "signup": SignUpScreen,
        # "profile": ProfileScreen,
        # "menu": MainMenuScreen,
        "pong": PongGameScreen,
        "lobby": LobbyScreen,
        "start-screen": StartGameScreen,
    }

    def __init__(self, config_setting="Default Setting"):
        self.config_setting = config_setting
        self.services = ServiceRegistry()
        self.room_code = None
        self.player_id = None
        self.username = None
        self.ws_url = "ws://localhost:8000"
        super().__init__()

    async def on_mount(self) -> None:
        await self.switch_mode("login")

