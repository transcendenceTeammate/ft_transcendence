from django.db import models
from django.utils import timezone
import random

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
    
    canvas_width = models.IntegerField(default=800)
    canvas_height = models.IntegerField(default=600)
    
    player_1_paddle_y = models.IntegerField(default=250)
    player_2_paddle_y = models.IntegerField(default=250)
    paddle_height = models.IntegerField(default=100)
    paddle_width = models.IntegerField(default=10)
    
    player_1_moving_up = models.BooleanField(default=False)
    player_1_moving_down = models.BooleanField(default=False)
    player_2_moving_up = models.BooleanField(default=False)
    player_2_moving_down = models.BooleanField(default=False)
    
    ball_x = models.IntegerField(default=400)
    ball_y = models.IntegerField(default=300)
    ball_size = models.IntegerField(default=15)
    ball_dx = models.IntegerField(default=5)
    ball_dy = models.IntegerField(default=5)
    
    def __str__(self):
        p1 = self.player_1_id if self.player_1_id else "Joueur 1"
        p2 = self.player_2_id if self.player_2_id else "Joueur 2"
        return f"{p1} vs {p2} ({self.room_code})"
    
    def reset_ball(self):
        self.ball_x = self.canvas_width // 2
        self.ball_y = self.canvas_height // 2
        self.ball_dx = 0
        self.ball_dy = 0
        self.is_paused = True
    
    def start_ball(self, direction=1):
        self.is_paused = False
        self.ball_dx = 5 * direction
        self.ball_dy = 5 if bool(direction % 2) else -5  # Direction Y alternée
    
    def update_game_state(self):
        if self.is_paused:
            return
        
        paddle_speed = 10
        if self.player_1_moving_up:
            self.player_1_paddle_y = max(0, self.player_1_paddle_y - paddle_speed)
        if self.player_1_moving_down:
            self.player_1_paddle_y = min(self.canvas_height - self.paddle_height, self.player_1_paddle_y + paddle_speed)
        if self.player_2_moving_up:
            self.player_2_paddle_y = max(0, self.player_2_paddle_y - paddle_speed)
        if self.player_2_moving_down:
            self.player_2_paddle_y = min(self.canvas_height - self.paddle_height, self.player_2_paddle_y + paddle_speed)
        
        self.ball_x += self.ball_dx
        self.ball_y += self.ball_dy
        
        if self.ball_y <= 0 or self.ball_y >= self.canvas_height:
            self.ball_dy *= -1
        
        ball_radius = self.ball_size // 2
        
        if (self.ball_x - ball_radius <= self.paddle_width and 
            self.ball_y >= self.player_1_paddle_y and 
            self.ball_y <= self.player_1_paddle_y + self.paddle_height):
            
            self.ball_dx = abs(self.ball_dx)
            
            relative_intersect_y = (self.player_1_paddle_y + (self.paddle_height / 2)) - self.ball_y
            normalized_relative_intersect_y = relative_intersect_y / (self.paddle_height / 2)
            
            self.ball_dy = -7 * normalized_relative_intersect_y

        elif (self.ball_x + ball_radius >= self.canvas_width - self.paddle_width and 
              self.ball_y >= self.player_2_paddle_y and 
              self.ball_y <= self.player_2_paddle_y + self.paddle_height):
            
            self.ball_dx = -abs(self.ball_dx)
            
            relative_intersect_y = (self.player_2_paddle_y + (self.paddle_height / 2)) - self.ball_y
            normalized_relative_intersect_y = relative_intersect_y / (self.paddle_height / 2)
            
            self.ball_dy = -7 * normalized_relative_intersect_y
        
        if self.ball_x < 0:
            self.player_2_score += 1
            self.reset_ball()
            return 2
                
        elif self.ball_x > self.canvas_width:
            self.player_1_score += 1
            self.reset_ball()
            return 1
            
        return 0