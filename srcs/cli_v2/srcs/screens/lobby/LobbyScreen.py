from typing import Literal

from textual.app import App, ComposeResult, on
from textual.widgets import Input, Header, Footer, Button, Label, Pretty, LoadingIndicator
from textual.screen import ModalScreen, Screen
from rich.panel import Panel
from rich.align import Align
from textual.validation import Function, Number, ValidationResult, Validator

from srcs.data.api import userManager


class LobbyScreen(Screen):
    app: "Application"  # noqa: F821
    BINDINGS = [
        ("escape", "app.switch_mode('home')", "Back to home"),
    ]
    CSS = """
    LoadingIndicator {
        width: auto;
        height: auto;
    }
    """

    def __init__(self) -> None:
        super().__init__()
        self.room_code = "ABCDEFG"

    def compose(self) -> ComposeResult:
        yield Header(name="Lobby")
        yield Label(f"Room Code: {self.room_code}", id="roomCodeLabel")
        yield Label("Waiting for other players to join...", id="lobbyMessage")
        yield LoadingIndicator()
        yield Button(label="Leave Lobby", id="leaveLobbyButton")
        yield Footer()

    @on(Button.Pressed)
    async def leave_lobby_handler(self, event: Button.Pressed) -> None:
        if event.button.id == "leaveLobbyButton":
            await self.app.switch_mode("home")

