from django.db import models

class GameState(models.Model):
    room_code = models.CharField(max_length=6, unique=True)
    player_1_id = models.CharField(max_length=100, null=True)
    player_2_id = models.CharField(max_length=100, null=True)
    
    player_1_score = models.IntegerField(default=0)
    player_2_score = models.IntegerField(default=0)
    player_1_paddle_y = models.IntegerField(default=250)
    player_2_paddle_y = models.IntegerField(default=250)
    
    ball_x = models.IntegerField(default=400)
    ball_y = models.IntegerField(default=300)
    ball_dx = models.IntegerField(default=5)
    ball_dy = models.IntegerField(default=5)
    
    canvas_width = models.IntegerField(default=800)
    canvas_height = models.IntegerField(default=600)
    
    is_paused = models.BooleanField(default=True)
    
    player_1_moving_up = models.BooleanField(default=False)
    player_1_moving_down = models.BooleanField(default=False)
    player_2_moving_up = models.BooleanField(default=False)
    player_2_moving_down = models.BooleanField(default=False)
    
    def reset_ball(self):
        self.ball_x = self.canvas_width // 2
        self.ball_y = self.canvas_height // 2
        self.ball_dx = 5
        self.ball_dy = 5