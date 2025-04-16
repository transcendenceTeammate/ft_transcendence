from typing import Literal

from textual.app import App, ComposeResult, on
from textual.widgets import Input, Header, Footer, Button, Label, Pretty
from textual.screen import ModalScreen, Screen
from rich.panel import Panel
from rich.align import Align
from textual.validation import Function, Number, ValidationResult, Validator


class StartGameScreen(Screen):
    app: "Application"
    BINDINGS = [
    ]
    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        yield Button(label="Create Room", id="createButton")
        yield Button(label="Join Room", id="joinButton")
        yield Footer()

    @on(Button.Pressed)
    async def button_pressed(self, event: Button.Pressed) -> None:
        match event.button.id:
            case "createButton":
                pass
                # await self.app.switch_mode("login")
            case "joinButton":
                # await self.app.switch_mode("signup")
                pass
