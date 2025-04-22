import time
import random
import logging
from ..constants import (
    CANVAS_WIDTH, CANVAS_HEIGHT,
    PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED,
    BALL_SIZE, BALL_INITIAL_SPEED_X, BALL_INITIAL_SPEED_Y,
    SPEED_INCREASE_FACTOR, RUBBER_BAND_FACTOR, ANGLE_LIMIT,
    WINNING_SCORE
)

logger = logging.getLogger(__name__)

class GameState:
    """In-memory game state that replaces the database model"""
    
    def __init__(self, room_code):
        self.room_code = room_code
        self.status = 'WAITING'
        self.created_at = time.time()
        self.is_paused = True
        
        self.player_1_id = None
        self.player_2_id = None
        
        self.player_1_username = None
        self.player_2_username = None
        
        self.player_1_score = 0
        self.player_2_score = 0
        
        self.canvas_width = CANVAS_WIDTH
        self.canvas_height = CANVAS_HEIGHT
        
        self.player_1_paddle_y = (CANVAS_HEIGHT - PADDLE_HEIGHT) // 2
        self.player_2_paddle_y = (CANVAS_HEIGHT - PADDLE_HEIGHT) // 2
        self.paddle_height = PADDLE_HEIGHT
        self.paddle_width = PADDLE_WIDTH
        self.paddle_speed = PADDLE_SPEED
        
        self.player_1_moving_up = False
        self.player_1_moving_down = False
        self.player_2_moving_up = False
        self.player_2_moving_down = False
        
        self.ball_x = CANVAS_WIDTH / 2
        self.ball_y = CANVAS_HEIGHT / 2
        self.ball_size = BALL_SIZE
        self.ball_speed_x = 0
        self.ball_speed_y = 0
        self.last_loser = None
        
        self.winning_score = WINNING_SCORE
        
        self.last_update = time.time() * 1000
    
    def reset_ball(self):
        """Reset ball to center"""
        self.ball_x = self.canvas_width / 2
        self.ball_y = self.canvas_height / 2
        self.ball_speed_x = 0
        self.ball_speed_y = 0
        self.is_paused = True
    
    def resume_ball(self):
        """Start the ball with initial velocity"""
        if not self.is_paused:
            return
            
        self.is_paused = False
        self.ball_speed_x = -BALL_INITIAL_SPEED_X if self.last_loser == 1 else BALL_INITIAL_SPEED_X
        self.ball_speed_y = (1 if random.random() > 0.5 else -1) * BALL_INITIAL_SPEED_Y
        
        logger.info(f"Ball resumed with speeds: ({self.ball_speed_x}, {self.ball_speed_y})")
        return self.ball_speed_x, self.ball_speed_y
    
    def update(self):
        """Update game state for one frame"""
        if self.is_paused:
            return 0
        
        self.ball_x += self.ball_speed_x
        self.ball_y += self.ball_speed_y
        
        ball_radius = self.ball_size / 2
        
        if self.ball_y - ball_radius <= 0:
            self.ball_y = ball_radius
            self.ball_speed_y *= -1
        elif self.ball_y + ball_radius >= self.canvas_height:
            self.ball_y = self.canvas_height - ball_radius
            self.ball_speed_y *= -1
        
        if (self.ball_x - ball_radius <= self.paddle_width and 
            self.ball_y >= self.player_1_paddle_y and 
            self.ball_y <= self.player_1_paddle_y + self.paddle_height):
            
            paddle_center = self.player_1_paddle_y + self.paddle_height / 2
            relative_intersect_y = self.ball_y - paddle_center
            normalized_intersect = relative_intersect_y / (self.paddle_height / 2)
            angle = normalized_intersect * ANGLE_LIMIT
            
            self.ball_x = self.paddle_width + ball_radius
            self.ball_speed_x = abs(self.ball_speed_x)
            self.ball_speed_y = angle * 6
            
            self.ball_speed_x *= SPEED_INCREASE_FACTOR
            self.ball_speed_y *= SPEED_INCREASE_FACTOR
            
            if self.player_1_score > self.player_2_score + 3:
                self.ball_speed_x *= RUBBER_BAND_FACTOR
                self.ball_speed_y *= RUBBER_BAND_FACTOR
        
        elif (self.ball_x + ball_radius >= self.canvas_width - self.paddle_width and 
              self.ball_y >= self.player_2_paddle_y and 
              self.ball_y <= self.player_2_paddle_y + self.paddle_height):
            
            paddle_center = self.player_2_paddle_y + self.paddle_height / 2
            relative_intersect_y = self.ball_y - paddle_center
            normalized_intersect = relative_intersect_y / (self.paddle_height / 2)
            angle = normalized_intersect * ANGLE_LIMIT
            
            self.ball_x = self.canvas_width - self.paddle_width - ball_radius
            self.ball_speed_x = -abs(self.ball_speed_x)
            self.ball_speed_y = angle * 6
            
            self.ball_speed_x *= SPEED_INCREASE_FACTOR
            self.ball_speed_y *= SPEED_INCREASE_FACTOR
            
            if self.player_2_score > self.player_1_score + 3:
                self.ball_speed_x *= RUBBER_BAND_FACTOR
                self.ball_speed_y *= RUBBER_BAND_FACTOR
        
        if self.ball_x - ball_radius <= 0:
            self.player_2_score += 1
            self.last_loser = 1
            self.reset_ball()
            return 2
            
        elif self.ball_x + ball_radius >= self.canvas_width:
            self.player_1_score += 1
            self.last_loser = 2
            self.reset_ball()
            return 1
        
        self.last_update = time.time() * 1000
        
        return 0
    
    def check_for_winner(self):
        """Check if a player has won the game"""
        if self.player_1_score >= self.winning_score:
            self.status = 'FINISHED'
            return 1
        elif self.player_2_score >= self.winning_score:
            self.status = 'FINISHED'
            return 2
        return 0
        
    def to_dict(self):
        """Convert game state to dictionary"""
        return {
            'room_code': self.room_code,
            'status': self.status,
            'player_1_id': self.player_1_id,
            'player_2_id': self.player_2_id,
            'player_1_username': self.player_1_username,
            'player_2_username': self.player_2_username,
            'player_1_score': self.player_1_score,
            'player_2_score': self.player_2_score,
            'player_1_paddle_y': self.player_1_paddle_y,
            'player_2_paddle_y': self.player_2_paddle_y,
            'paddle_height': self.paddle_height,
            'paddle_width': self.paddle_width,
            'ball_x': self.ball_x,
            'ball_y': self.ball_y,
            'ball_size': self.ball_size,
            'ball_speed_x': self.ball_speed_x,
            'ball_speed_y': self.ball_speed_y,
            'is_paused': self.is_paused,
            'last_loser': self.last_loser,
            'winning_score': self.winning_score,
            'timestamp': time.time() * 1000,
        }
