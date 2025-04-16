from typing import Literal

from textual.app import App, ComposeResult, on
from textual.widgets import Input, Header, Footer, Button, Label, Pretty
from textual.screen import ModalScreen, Screen
from rich.panel import Panel
from rich.align import Align
from textual.validation import Function, Number, ValidationResult, Validator

from srcs.data.api import userManager


class SignUpScreen(Screen):
    app: "Application"  # noqa: F821
    BINDINGS = [
        ("escape", "app.switch_mode('home')", "Back to home"),
    ]

    def compose(self) -> ComposeResult:
        yield Header(name="SignUp")
        yield Input(placeholder="Username", id="usernameInput")
        yield Input(placeholder="Password", id="passwordInput")
        yield Button(label="SignUp", id="signupButton")
        yield Footer()

    @on(Button.Pressed)
    async def submit_handler(self, event: Button.Pressed) -> None:
        username_input = self.query_one("#usernameInput", Input).value
        password_input = self.query_one("#passwordInput", Input).value
        
        try:
            userManager.signup(username_input, password_input)
            self.notify(
                f"Sign-up successful! Welcome, {username_input}!",
                title="Sign-Up Success",
                timeout=5
            )
            await self.app.switch_mode("profile")
        except Exception as e:
            self.notify(
                f"An error occurred: {str(e)}",
                title="Login Error",
                severity="error",
                timeout=5
            )