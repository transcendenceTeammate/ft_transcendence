from textual.app import App, ComposeResult
from textual.widgets import Static, Digits
from textual import events
from textual.screen import Screen

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



class PongGame:
    """Encapsulates the game state and logic for Pong."""
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height

        # Initialize ball at the center
        self.ball_x = width // 2
        self.ball_y = height // 2
        self.ball_dx = 1
        self.ball_dy = 1

        # Initialize paddle positions (vertical offset)
        self.left_paddle_y = height // 2 - 2
        self.right_paddle_y = height // 2 - 2

        # Initialize scores
        self.left_score = 0
        self.right_score = 0

    def update(self):
        """Update the game state including ball movement and collision logic."""
        self.ball_x += self.ball_dx
        self.ball_y += self.ball_dy

        # Bounce off top and bottom boundaries
        if self.ball_y <= 0 or self.ball_y >= self.height - 1:
            self.ball_dy *= -1

        # Ball reaches the left boundary
        if self.ball_x <= 3:
            if abs(self.ball_y - self.left_paddle_y - 2) <= 2:
                # Paddle hit; reverse ball's horizontal direction
                self.ball_dx = abs(self.ball_dx)
            else:
                # Missed paddle: update score and reset
                self.right_score += 1
                self.reset_ball(direction=1)

        # Ball reaches the right boundary
        elif self.ball_x >= self.width - 4:
            if abs(self.ball_y - self.right_paddle_y - 2) <= 2:
                self.ball_dx = -abs(self.ball_dx)
            else:
                self.left_score += 1
                self.reset_ball(direction=-1)

    def reset_ball(self, direction: int):
        """Reset the ball to the center and set its horizontal direction."""
        self.ball_x = self.width // 2
        self.ball_y = self.height // 2
        self.ball_dx = direction
        self.ball_dy = 1

    def move_paddle(self, side: str, direction: int):
        """Move a paddle on the specified side by adjusting its vertical position."""
        if side == "left":
            self.left_paddle_y = max(0, min(self.height - 5, self.left_paddle_y + direction))
        elif side == "right":
            self.right_paddle_y = max(0, min(self.height - 5, self.right_paddle_y + direction))

    def get_state(self):
        """Return the current state of the game elements."""
        return {
            "ball": (self.ball_x, self.ball_y),
            "left_paddle": self.left_paddle_y,
            "right_paddle": self.right_paddle_y,
            "score": (self.left_score, self.right_score),
        }

class PongGameScreen(Screen):
    BINDINGS = [
        ("escape", "app.switch_mode('home')", "Back to home"),
    ]

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
        height: auto;
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

    def compose(self) -> ComposeResult:
        yield Digits("", id="score")
        yield Static("", id="game-area")

    async def on_mount(self) -> None:
        # Game area layout
        self.game_width = 800
        self.game_height = 600
        game_area = self.query_one("#game-area", Static)
        area_width = game_area.size.width or 80
        area_height = int(area_width * 240 / 800)
        game_area.styles.height = area_height

        # Mount widgets
        self.left_paddle = PaddleWidget("▌", classes="paddle")
        self.right_paddle = PaddleWidget("▐", classes="paddle")
        self.left_paddle.styles.color = "blue"
        self.right_paddle.styles.color = "red"
        self.ball = BallWidget(classes="ball")

        await game_area.mount(self.left_paddle)
        await game_area.mount(self.right_paddle)
        await game_area.mount(self.ball)

        # Online Pong setup
        self.game = OnlinePongService(
            room_code="7UMIEH",
            player_id="23",
            username="asdasd",
            server_url="wss://app.127.0.0.1.nip.io:8443"
        )

        self.game.set_callback("on_update", self.update_from_server)
        self.game.set_callback("on_score", self.update_score)
        self.game.set_callback("on_game_over", self.handle_game_over)
        self.game.connect()

        self.set_interval(0.01, self.refresh_ui)

    def refresh_ui(self):
        """Force UI redraw from last state."""
        self.update_positions()

    def update_from_server(self, state):
        """Callback from server when new game state is available."""
        self.last_state = state
        self.update_score()
        self.update_positions()

    def update_positions(self) -> None:
        """Update paddle and ball positions based on game state."""
        if not hasattr(self, "last_state"):
            return

        state = self.last_state
        game_area = self.query_one("#game-area", Static)
        area_width = game_area.size.width or 80
        area_height = game_area.size.height or 24

        def scale_x(x): return int(x * area_width / self.game_width)
        def scale_y(y): return int(y * area_height / self.game_height)

        # Scale positions
        self.left_paddle.styles.offset = (0, scale_y(state["left_paddle"]))
        self.right_paddle.styles.offset = (area_width - 1, scale_y(state["right_paddle"]))
        self.ball.styles.offset = (scale_x(state["ball"][0]), scale_y(state["ball"][1]))

    def update_score(self, *_):
        """Update the score text."""
        if not hasattr(self, "last_state"):
            return

        score_widget = self.query_one("#score", Digits)
        left, right = self.last_state["score"]
        score_widget.update(f"{left:02} - {right:02}")

    def handle_game_over(self, data):
        self.app.bell()
        self.query_one("#score", Digits).update("GAME OVER")

    async def on_key(self, event: events.Key) -> None:
        """Send paddle movement to server."""
        if not self.game.player_number:
            return

        direction = 0
        if event.key in ("a", "up") and self.game.player_number == 1:
            direction = -10
        elif event.key in ("q", "down") and self.game.player_number == 1:
            direction = 10
        elif event.key == "up" and self.game.player_number == 2:
            direction = -10
        elif event.key == "down" and self.game.player_number == 2:
            direction = 10

        # Send movement only for your paddle
        if direction != 0:
            current_pos = self.last_state["left_paddle"] if self.game.player_number == 1 else self.last_state["right_paddle"]
            new_pos = max(0, min(self.game_height - 120, current_pos + direction))  # prevent out of bounds
            self.game.move_paddle(new_pos)
