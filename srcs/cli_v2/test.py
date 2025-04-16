from textual.app import App, ComposeResult
from textual.widgets import Static, Digits
from textual.reactive import reactive
from textual import events

# ----------------------------------------------------------------
# Paddle and Ball widget definitions
# ----------------------------------------------------------------

class PaddleWidget(Static):
    """A widget that represents a paddle.
    The paddle is rendered as a fixed 5‑line block of the paddle character.
    The widget will be absolutely positioned by updating its 'offset' style.
    """
    def __init__(self, paddle_char: str, **kwargs) -> None:
        # The content is fixed (5 lines of the paddle character)
        content = "\n".join([paddle_char] * 5)
        super().__init__(content, **kwargs)


class BallWidget(Static):
    """A widget that represents the ball.
    It simply renders the ball character and is absolutely positioned.
    """
    def __init__(self, **kwargs) -> None:
        super().__init__("◉", **kwargs)

# ----------------------------------------------------------------
# The main App
# ----------------------------------------------------------------

class Pong(App):
    CSS = """
    Screen {
        background: black;
    }

    #score {
        dock: top;
        color: white;
        text-align: center;
    }

    #game-area {
        position: relative;
        width: 100%;
        height: 100%;
        border: round grey;        
    }

    .paddle, .ball {
        position: absolute;
    }
    .paddle {
        width: 3;
        height: 5;
    }
    .ball {
        width: 1;
        height: 1;
    }
    """

    # Game state (all reactive so that changes automatically trigger a refresh).
    ball_x: float = reactive(10)
    ball_y: float = reactive(10)
    ball_dx: float = 1            # Horizontal velocity.
    ball_dy: float = reactive(1)  # Vertical velocity.

    # Paddle vertical positions (these indicate the top offset for each paddle)
    left_paddle_y: int = reactive(5)
    right_paddle_y: int = reactive(5)

    # Scores.
    left_score: int = reactive(0)
    right_score: int = reactive(0)

    def compose(self) -> ComposeResult:
        # The score widget at the top.
        # yield Static("", id="score")
        yield Digits("", id="score")
        # The game area: our container for the ball and paddle widgets.
        yield Static("", id="game-area")

    async def on_mount(self) -> None:
        # Mount the paddle and ball widgets inside the game-area.
        game_area = self.query_one("#game-area", Static)
        self.left_paddle = PaddleWidget("▌", classes="paddle")
        self.right_paddle = PaddleWidget("▐", classes="paddle")
        self.left_paddle.styles.color = "blue"
        self.right_paddle.styles.color = "red"
        self.ball = BallWidget(classes="ball")
        # Mount children inside the game area.
        await game_area.mount(self.left_paddle)
        await game_area.mount(self.right_paddle)
        await game_area.mount(self.ball)

        # Schedule the game update loop.
        self.set_interval(0.01, self.update_game)
        self.update_positions()
        self.update_score()

    def update_game(self) -> None:
        # Get the game area dimensions.
        area = self.query_one("#game-area", Static)
        area_width = area.size.width or 80  # fallback if not set
        area_height = area.size.height or 24

        # Update the ball's position.
        self.ball_x += self.ball_dx
        self.ball_y += self.ball_dy

        # Bounce off the top and bottom boundaries.
        if self.ball_y <= 0 or self.ball_y >= area_height - 1:
            self.ball_dy *= -1

        # Collision with the left wall.
        # Left paddle width is 3.
        if self.ball_x <= 3:
            if abs(self.ball_y - self.left_paddle_y - 2) <= 2:
                self.ball_dx = abs(self.ball_dx)
            else:
                self.right_score += 1
                self.ball_x = area_width // 2
                self.ball_y = area_height // 2
                self.ball_dx = 1

        # Collision with the right wall.
        # Assuming the right paddle is 3 columns wide.
        if self.ball_x >= area_width - 4:
            if abs(self.ball_y - self.right_paddle_y - 2) <= 2:
                self.ball_dx = -abs(self.ball_dx)
            else:
                self.left_score += 1
                self.ball_x = area_width // 2
                self.ball_y = area_height // 2
                self.ball_dx = -1

        self.update_positions()
        self.update_score()

    def update_positions(self) -> None:
        # Update widget positions using the parent's size.
        game_area = self.query_one("#game-area", Static)
        area_width = game_area.size.width or 80
        area_height = game_area.size.height or 24

        # Update the left paddle position. Always at left=0.
        self.left_paddle.styles.offset = (0, self.left_paddle_y)
        # Update the right paddle position. Place it at (area_width - paddle_width, right_paddle_y).
        # Paddle width is 3.
        self.right_paddle.styles.offset = (area_width - 1, self.right_paddle_y)
        # Update the ball position.
        self.ball.styles.offset = (self.ball_x, self.ball_y)

    def update_score(self) -> None:
        score_widget = self.query_one("#score", Digits)
        score_widget.update(f"{self.left_score:02} - {self.right_score:02}")

    async def on_key(self, event: events.Key) -> None:
        game_area = self.query_one("#game-area", Static)
        area_height = game_area.size.height or 24

        # Use W/S keys for the left paddle.
        if event.key == "a":
            self.left_paddle_y = max(0, self.left_paddle_y - 1)
        elif event.key == "q":
            # Subtract paddle height (5) to keep it in bounds.
            self.left_paddle_y = min(area_height - 5, self.left_paddle_y + 1)

        # Use Up/Down arrow keys for the right paddle.
        elif event.key == "up":
            self.right_paddle_y = max(0, self.right_paddle_y - 1)
        elif event.key == "down":
            self.right_paddle_y = min(area_height - 5, self.right_paddle_y + 1)

        self.update_positions()

if __name__ == "__main__":
    Pong().run()
