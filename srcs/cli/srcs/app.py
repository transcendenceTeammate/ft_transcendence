from textual.app import App


from textual.app import App, ComposeResult, on
from textual.widgets import Input, Header, Footer, Button, Label, Pretty
from textual.screen import ModalScreen, Screen

from srcs.game import PongGameScreen
from srcs.services.services_registry import ServiceRegistry


from srcs.config import Config


class LobbyScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Header()
        yield Label("Waiting for opponent...", id="lobbyMessage")
        yield Label(f"Room Code: {self.app.room_code}", id="roomCodeLabel")
        yield Footer()

    def on_mount(self):
        self.polling_task = self.set_interval(2.0, self.poll_room)

    async def poll_room(self):
        result = await self.app.services.game.check_room(self.app.room_code)
        if result.get("player_count") == 2:
            self.polling_task.stop()
            pongGameScreen = PongGameScreen()
            self.app.switch_screen(pongGameScreen)
           


class StartGameScreen(Screen):
    
    def compose(self) -> ComposeResult:
        yield Header()
        yield Button("Create Room", id="createButton")
        yield Input(placeholder="Enter Room Code", id="roomCodeInput")
        yield Button("Join Room", id="joinButton")
        yield Footer()

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        username = self.app.services.auth.get_username()
        room_code = self.query_one("#roomCodeInput", Input).value.strip().upper()

        if event.button.id == "createButton":
            result = await self.app.services.game.create_room(username=username)
            if result.get("success"):
                self.open_lobby(result["room_code"], result["player_id"], username)
        
        elif event.button.id == "joinButton":
            if room_code:
                result = await self.app.services.game.join_room(room_code, username=username)
                if result.get("success"):
                    self.open_lobby(result["room_code"], result["player_id"], username)
                    
    def open_lobby(self, room_code, player_id, username):
        self.app.room_code = room_code
        self.app.player_id = player_id
        self.app.username = username
        lobbyScreen = LobbyScreen()
        self.app.push_screen(lobbyScreen)



class LoginScreen(Screen):
    app: "Application"

    BINDINGS = [
        ("escape", "app.pop_screen()", "Back to home"),
    ]

    def compose(self) -> ComposeResult:
        yield Header(name="Login")
        yield Input(placeholder="Username", id="usernameInput")
        yield Input(placeholder="Password", password=True, id="passwordInput")
        yield Button(label="Login", id="loginButton")
        yield Footer()


    @on(Button.Pressed)
    async def submit_handler(self, event: Button.Pressed) -> None:
        username = self.query_one("#usernameInput", Input).value.strip()
        password = self.query_one("#passwordInput", Input).value.strip()

        if not username or not password:
            self.notify("Please enter both username and password.", severity="warning")
            return
        try:
            await self.app.services.auth.login(username, password)
            startGameScreen = StartGameScreen()
            self.app.switch_screen(startGameScreen)
            self.notify(
                f"Welcome back, {username}!",
                title="Login Success",
                timeout=3
            )
        except Exception as e:
            self.notify(
                f"Login failed: {str(e)}",
                title="Login Error",
                severity="error",
                timeout=4
            )



class SignupScreen(Screen):
    app: "Application"

    BINDINGS = [
        ("escape", "app.pop_screen()", "Back to home"),
    ]

    def compose(self) -> ComposeResult:
        yield Header(name="Signup")
        yield Input(placeholder="Username", id="usernameInput")
        yield Input(placeholder="Password", password=True, id="passwordInput")
        yield Button(label="Signup", id="signupButton")
        yield Footer()


    @on(Button.Pressed)
    async def submit_handler(self, event: Button.Pressed) -> None:
        username = self.query_one("#usernameInput", Input).value.strip()
        password = self.query_one("#passwordInput", Input).value.strip()

        if not username or not password:
            self.notify("Please enter both username and password.", severity="warning")
            return
        try:
            await self.app.services.auth.signup(username, password)
            startGameScreen = StartGameScreen()
            self.app.switch_screen(startGameScreen)
            self.notify(
                f"Welcome, {username}!",
                title="Signup Success",
                timeout=3
            )
        except Exception as e:
            self.notify(
                f"Signup failed: {str(e)}",
                title="Signup Error",
                severity="error",
                timeout=4
            )


class ConnectionScreen(Screen):
    app: "Application"
    BINDINGS = [
    ]
    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        yield Button(label="Login", id="loginPageButton")
        yield Button(label="SignUp", id="signupPageButton")
        yield Footer()

    @on(Button.Pressed)
    def button_pressed(self, event: Button.Pressed) -> None:
        match event.button.id:
            case "loginPageButton":
                loginScreen = LoginScreen()
                self.app.push_screen(loginScreen)
            case "signupPageButton":
                signupScreen = SignupScreen()
                self.app.push_screen(signupScreen)



class Application(App):

    def __init__(self, config: Config):
        self.services = ServiceRegistry(self)
        self.room_code = None
        self.player_id = None
        self.username = None
        self.config = config

        super().__init__()

    SCREENS = {
        "connection": ConnectionScreen,
    }

    def on_mount(self) -> None:
        self.push_screen("connection")

