from typing import Literal

from textual.app import App, ComposeResult, on
from textual.widgets import Input, Header, Footer, Button, Label, Pretty
from textual.screen import ModalScreen, Screen
from rich.panel import Panel
from rich.align import Align
from textual.validation import Function, Number, ValidationResult, Validator

from srcs.data.api import userManager
from srcs.screens.home.HomeScreen import HomeScreen
from srcs.screens.lobby.LobbyScreen import LobbyScreen
from srcs.screens.login.LoginScreen import LoginScreen
from srcs.screens.pong_game.PongGameScreen import PongGameScreen
from srcs.screens.signup.SignupScreen import SignUpScreen


def is_even(value: str) -> bool:
    try:
        return int(value) % 2 == 0
    except ValueError:
        return False

class ProfileScreen(Screen):
    app: "Application"
    BINDINGS = [
        ("escape", "app.switch_mode('home')", "Back to home"),
    ]
    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        yield Label("username: ")
        yield Input(value=userManager.get_username(),)
        yield Button(label="Edit Username", id="editUsernameButton")
        yield Footer()




    @on(Button.Pressed)
    async def button_pressed(self, event: Button.Pressed) -> None:
        pass
        # match event.button.id:
        #     case "loginPageButton":
        #         await self.app.switch_mode("login")
        #     case "signupPageButton":
        #         await self.app.switch_mode("signup")
        
       
        

class MainMenuScreen(Screen):
    app: "Application"
    BINDINGS = [
        ("p", "app.switch_mode('profile')", "Open Profile"),
    ]
    def compose(self) -> ComposeResult:
        yield Header()
        yield Label(f"Welcome, {userManager.get_username()}")
        yield Button(label="Create Game", id="createGameButton")
        yield Button(label="Join Game", id="joinGameButton")
        yield Footer()

    @on(Button.Pressed)
    async def button_pressed(self, event: Button.Pressed) -> None:
        match event.button.id:
            case "loginPageButton":
                await self.app.switch_mode("login")
            case "signupPageButton":
                await self.app.switch_mode("signup")




class Application(App):
    MODES = {
        "home": HomeScreen,
        "login": LoginScreen,
        "signup": SignUpScreen,
        "profile": ProfileScreen,
        "menu": MainMenuScreen,
        "pong": PongGameScreen,
        "lobby": LobbyScreen,
    }

    def __init__(self, config_setting="Default Setting"):
        self.config_setting = config_setting
        super().__init__()

    async def on_mount(self) -> None:
        await self.switch_mode("home")
