# srcs/pong_game/app/models.py

from django.db import models
from django.utils import timezone
import random
import math
from .constants import (
    CANVAS_WIDTH, CANVAS_HEIGHT,
    PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED,
    BALL_SIZE, BALL_INITIAL_SPEED_X, BALL_INITIAL_SPEED_Y,
    SPEED_INCREASE_FACTOR, RUBBER_BAND_FACTOR, ANGLE_LIMIT,
    WINNING_SCORE
)

class GameState(models.Model):
    STATUS_CHOICES = [
        ('WAITING', 'En attente de joueurs'),
        ('ONGOING', 'Partie en cours'),
        ('FINISHED', 'Partie terminée'),
    ]
    
    room_code = models.CharField(max_length=6, unique=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='WAITING')
    created_at = models.DateTimeField(auto_now_add=True)
    is_paused = models.BooleanField(default=True)
    
    player_1_id = models.CharField(max_length=50, null=True, blank=True)
    player_2_id = models.CharField(max_length=50, null=True, blank=True)
    
    player_1_score = models.IntegerField(default=0)
    player_2_score = models.IntegerField(default=0)
    
    canvas_width = models.IntegerField(default=CANVAS_WIDTH)
    canvas_height = models.IntegerField(default=CANVAS_HEIGHT)
    
    player_1_paddle_y = models.IntegerField(default=(CANVAS_HEIGHT - PADDLE_HEIGHT) // 2)
    player_2_paddle_y = models.IntegerField(default=(CANVAS_HEIGHT - PADDLE_HEIGHT) // 2)
    paddle_height = models.IntegerField(default=PADDLE_HEIGHT)
    paddle_width = models.IntegerField(default=PADDLE_WIDTH)
    paddle_speed = models.IntegerField(default=PADDLE_SPEED)
    
    player_1_moving_up = models.BooleanField(default=False)
    player_1_moving_down = models.BooleanField(default=False)
    player_2_moving_up = models.BooleanField(default=False)
    player_2_moving_down = models.BooleanField(default=False)
    
    ball_x = models.FloatField(default=CANVAS_WIDTH / 2)
    ball_y = models.FloatField(default=CANVAS_HEIGHT / 2)
    ball_size = models.IntegerField(default=BALL_SIZE)
    ball_speed_x = models.FloatField(default=0)
    ball_speed_y = models.FloatField(default=0)
    last_loser = models.IntegerField(null=True, blank=True)
    
    winning_score = models.IntegerField(default=WINNING_SCORE)
    
    last_update = models.FloatField(default=0)
    
    def __str__(self):
        p1 = self.player_1_id if self.player_1_id else "Player 1"
        p2 = self.player_2_id if self.player_2_id else "Player 2"
        return f"{p1} vs {p2} ({self.room_code})"
    
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
        
        print(f"Ball resumed with speeds: ({self.ball_speed_x}, {self.ball_speed_y})")
        return self.ball_speed_x, self.ball_speed_y
    
    def update_game_state(self):
        """Update game state for one frame"""
        if self.is_paused:
            return 0
        
        if self.player_1_moving_up and self.player_1_paddle_y > 0:
            self.player_1_paddle_y -= self.paddle_speed
            
        if self.player_1_moving_down and self.player_1_paddle_y < self.canvas_height - self.paddle_height:
            self.player_1_paddle_y += self.paddle_speed
            
        if self.player_2_moving_up and self.player_2_paddle_y > 0:
            self.player_2_paddle_y -= self.paddle_speed
            
        if self.player_2_moving_down and self.player_2_paddle_y < self.canvas_height - self.paddle_height:
            self.player_2_paddle_y += self.paddle_speed
        
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
            angle = relative_intersect_y / (self.paddle_height / 2)
            angle = max(-ANGLE_LIMIT, min(angle, ANGLE_LIMIT))
            
            self.ball_speed_x *= -1
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
            angle = relative_intersect_y / (self.paddle_height / 2)
            angle = max(-ANGLE_LIMIT, min(angle, ANGLE_LIMIT))
            
            self.ball_speed_x *= -1
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
            return 2  # Player 2 scored
            
        elif self.ball_x + ball_radius >= self.canvas_width:
            self.player_1_score += 1
            self.last_loser = 2
            self.reset_ball()
            return 1  # Player 1 scored
        
        self.last_update = timezone.now().timestamp() * 1000
        
        return 0  # No goal
    
    def check_for_winner(self):
        """Check if a player has won the game"""
        if self.player_1_score >= self.winning_score:
            self.status = 'FINISHED'
            return 1
        elif self.player_2_score >= self.winning_score:
            self.status = 'FINISHED'
            return 2
        return 0
    

class PlayerSession(models.Model):
    """
    Represents a player's session in a game.
    Used to track players across connections and handle reconnections.
    """
    room_code = models.CharField(max_length=6)
    player_id = models.CharField(max_length=50)
    player_number = models.IntegerField()
    username = models.CharField(max_length=100, null=True, blank=True)
    connected = models.BooleanField(default=True)
    last_active = models.DateTimeField(auto_now=True)
    
    client_sequence = models.IntegerField(default=0)
    last_acknowledged_sequence = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ('room_code', 'player_id')
    
    def __str__(self):
        return f"Player {self.player_number} ({self.username}) in room {self.room_code}"