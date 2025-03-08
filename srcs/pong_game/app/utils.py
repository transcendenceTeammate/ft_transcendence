import random
import string
import json
from django.utils import timezone
from .models import GameState

def generate_room_code(length=6):
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
        if not GameState.objects.filter(room_code=code).exists():
            return code

def game_state_to_dict(game_state):
    return {
        'room_code': game_state.room_code,
        'status': game_state.status,
        'canvas_width': game_state.canvas_width,
        'canvas_height': game_state.canvas_height,
        'player_1_id': game_state.player_1_id,
        'player_2_id': game_state.player_2_id,
        'player_1_score': game_state.player_1_score,
        'player_2_score': game_state.player_2_score,
        'player_1_paddle_y': game_state.player_1_paddle_y,
        'player_2_paddle_y': game_state.player_2_paddle_y,
        'ball_x': game_state.ball_x,
        'ball_y': game_state.ball_y,
        'ball_size': game_state.ball_size,
        'ball_dx': game_state.ball_dx,
        'ball_dy': game_state.ball_dy,
        'is_paused': game_state.is_paused,
        'timestamp': timezone.now().timestamp(),
    }

def calculate_ball_trajectory(game_state, steps=10):
    if game_state.is_paused:
        return []
    
    x = game_state.ball_x
    y = game_state.ball_y
    dx = game_state.ball_dx
    dy = game_state.ball_dy
    
    canvas_width = game_state.canvas_width
    canvas_height = game_state.canvas_height
    ball_radius = game_state.ball_size // 2
    
    trajectory = [(x, y)]
    
    for _ in range(steps):
        x += dx
        y += dy
        
        if y <= ball_radius or y >= canvas_height - ball_radius:
            dy *= -1
            y = ball_radius if y <= ball_radius else canvas_height - ball_radius
        
        if x <= game_state.paddle_width + ball_radius and y >= game_state.player_1_paddle_y and y <= game_state.player_1_paddle_y + game_state.paddle_height:
            dx = abs(dx)
            x = game_state.paddle_width + ball_radius
        elif x >= canvas_width - game_state.paddle_width - ball_radius and y >= game_state.player_2_paddle_y and y <= game_state.player_2_paddle_y + game_state.paddle_height:
            dx = -abs(dx)
            x = canvas_width - game_state.paddle_width - ball_radius
        
        if x < 0 or x > canvas_width:
            break
        
        trajectory.append((x, y))
    
    return trajectory