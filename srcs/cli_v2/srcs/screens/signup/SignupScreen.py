
from typing import Literal

from textual.app import App, ComposeResult, on
from textual.widgets import Input, Header, Footer, Button, Label, Pretty
from textual.screen import ModalScreen, Screen
from rich.panel import Panel
from rich.align import Align
from textual.validation import Function, Number, ValidationResult, Validator


class SignUpScreen(Screen):
    app: "Application"  # Type hint for your main app

    BINDINGS = [
        ("escape", "app.switch_mode('home')", "Back to home"),
    ]

    def compose(self) -> ComposeResult:
        yield Header(name="SignUp")
        yield Input(placeholder="Username", id="usernameInput")
        yield Input(placeholder="Password", password=True, id="passwordInput")
        yield Button(label="SignUp", id="loginButton")
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

            self.notify(
                f"Welcome back, {username}!",
                title="SignUp Success",
                timeout=3
            )

            await self.app.switch_mode("start-screen")  # Change this to whatever your post-login screen is
        except Exception as e:
            self.notify(
                f"SignUp failed: {str(e)}",
                title="SignUp Error",
                severity="error",
                timeout=4
            )
