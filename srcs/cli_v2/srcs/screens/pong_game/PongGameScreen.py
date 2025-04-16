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
        height: auto;  /* Height adjusts dynamically based on width to preserve aspect ratio */
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
        # Retrieve the game area dimensions
        game_area = self.query_one("#game-area", Static)
        area_width = game_area.size.width or 80
        area_height = int(area_width * 240 / 800)  # Maintain 4:1 aspect ratio
        game_area.styles.height = area_height  # Set the height dynamically

        # Initialize the PongGame logic with the dimensions of the game area
        self.game = PongGame(800, 600)

        # Create paddle and ball widgets
        self.left_paddle = PaddleWidget("▌", classes="paddle")
        self.right_paddle = PaddleWidget("▐", classes="paddle")
        self.left_paddle.styles.color = "blue"
        self.right_paddle.styles.color = "red"
        self.ball = BallWidget(classes="ball")
        await game_area.mount(self.left_paddle)
        await game_area.mount(self.right_paddle)
        await game_area.mount(self.ball)

        # Set an update interval for the game loop
        self.set_interval(0.01, self.update_game)
        self.update_positions()
        self.update_score()

    def update_game(self) -> None:
        """Update game state and refresh display elements."""
        self.game.update()
        self.update_positions()
        self.update_score()

    def update_positions(self) -> None:
        """Update positions of game elements based on the game state."""
        state = self.game.get_state()
        game_area = self.query_one("#game-area", Static)
        area_width = game_area.size.width or 80
        area_height = game_area.size.height or 24

        # Scale the game element positions to maintain the aspect ratio
        self.left_paddle.styles.offset = (0, int(state["left_paddle"] * area_height / self.game.height))
        self.right_paddle.styles.offset = (area_width - 1, int(state["right_paddle"] * area_height / self.game.height))
        self.ball.styles.offset = (
            int(state["ball"][0] * area_width / self.game.width),
            int(state["ball"][1] * area_height / self.game.height),
        )

    def update_score(self) -> None:
        """Update the score display widget."""
        score_widget = self.query_one("#score", Digits)
        left, right = self.game.get_state()["score"]
        score_widget.update(f"{left:02} - {right:02}")

    async def on_key(self, event: events.Key) -> None:
        """Capture key events and move the paddles."""
        if event.key == "a":
            self.game.move_paddle("left", -10)
        elif event.key == "q":
            self.game.move_paddle("left", 10)
        elif event.key == "up":
            self.game.move_paddle("right", -10)
        elif event.key == "down":
            self.game.move_paddle("right", 10)

        self.update_positions()


class PongApp(App):
    """A minimal Textual App to run the Pong game."""
    def on_mount(self) -> None:
        self.push_screen(PongGameScreen())


if __name__ == "__main__":
    PongApp().run()
