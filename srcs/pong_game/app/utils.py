import random
import string
import json
import math
import logging
import time
import redis
from django.utils import timezone
from django.conf import settings
from .models import GameState
from .constants import (
    CANVAS_WIDTH, CANVAS_HEIGHT,
    PADDLE_WIDTH, PADDLE_HEIGHT,
    BALL_SIZE, ANGLE_LIMIT,
    SPEED_INCREASE_FACTOR, RUBBER_BAND_FACTOR
)

logger = logging.getLogger(__name__)

# Initialize Redis connection
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True
    )
    redis_client.ping()
    logger.info("Redis connection established")
except Exception as e:
    redis_client = None
    logger.error(f"Redis connection failed: {str(e)}")

def generate_room_code(length=6):
    """Generate a unique room code"""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
        if not GameState.objects.filter(room_code=code).exists():
            return code

def game_state_to_dict(game_state):
    # Add force_reconcile flags to the state dict
    force_reconcile_p1 = getattr(game_state, 'force_reconcile_p1', False)
    force_reconcile_p2 = getattr(game_state, 'force_reconcile_p2', False)
    
    # Basic state dict with standard properties
    state_dict = {
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
        'paddle_height': game_state.paddle_height,
        'paddle_width': game_state.paddle_width,
        'ball_x': game_state.ball_x,
        'ball_y': game_state.ball_y,
        'ball_size': game_state.ball_size,
        'ball_speed_x': game_state.ball_speed_x,
        'ball_speed_y': game_state.ball_speed_y,
        'is_paused': game_state.is_paused,
        'last_loser': game_state.last_loser,
        'winning_score': game_state.winning_score,
        'timestamp': time.time() * 1000,
    }
    
    # Add force_reconcile flag for player 1 (only if they need to reconcile)
    if force_reconcile_p1:
        state_dict['force_reconcile'] = True
    
    # Add force_reconcile flag for player 2 (only if they need to reconcile)
    if force_reconcile_p2 and game_state.player_2_id:
        state_dict['force_reconcile'] = True
    
    return state_dict

def calculate_state_delta(old_state, new_state):
    """
    Calculate the difference between two game states
    Returns only the changed fields
    """
    if not old_state:
        return new_state
        
    delta = {'type': 'game_state_delta', 'timestamp': new_state['timestamp']}
    
    for key, value in new_state.items():
        if key == 'timestamp':
            continue
            
        if key not in old_state or old_state[key] != value:
            delta[key] = value
            
    return delta

def cache_game_state(game_state):
    """
    Store game state in Redis cache with TTL
    """
    if not redis_client:
        return False
        
    try:
        state_dict = game_state_to_dict(game_state)
        state_json = json.dumps(state_dict)
        
        redis_client.set(f"game:{game_state.room_code}", state_json, ex=60)
        return True
    except Exception as e:
        logger.exception(f"Redis caching error: {str(e)}")
        return False

def get_cached_game_state(room_code):
    """
    Retrieve game state from Redis cache
    Returns None if not found or expired
    """
    if not redis_client:
        return None
        
    try:
        state_json = redis_client.get(f"game:{room_code}")
        if not state_json:
            return None
            
        return json.loads(state_json)
    except Exception as e:
        logger.exception(f"Redis retrieval error: {str(e)}")
        return None

def calculate_ball_trajectory(game_state, steps=20):
    """
    Calculate predicted ball trajectory for client-side prediction
    with improved accuracy and paddle collision detection
    """
    if game_state.is_paused:
        return []
    
    x = float(game_state.ball_x)
    y = float(game_state.ball_y)
    dx = float(game_state.ball_speed_x)
    dy = float(game_state.ball_speed_y)
    
    canvas_width = game_state.canvas_width
    canvas_height = game_state.canvas_height
    ball_radius = game_state.ball_size / 2
    paddle_width = game_state.paddle_width
    paddle_height = game_state.paddle_height
    
    player1_paddle_y = game_state.player_1_paddle_y
    player2_paddle_y = game_state.player_2_paddle_y
    
    trajectory = [(x, y)]
    
    try:
        for _ in range(steps):
            x += dx
            y += dy
            
            if y - ball_radius <= 0:
                y = ball_radius
                dy *= -1
            elif y + ball_radius >= canvas_height:
                y = canvas_height - ball_radius
                dy *= -1
            
            if (x - ball_radius <= paddle_width and 
                y >= player1_paddle_y and 
                y <= player1_paddle_y + paddle_height and dx < 0):
                
                paddle_center = player1_paddle_y + paddle_height / 2
                relative_intersect_y = (y - paddle_center) / (paddle_height / 2)
                angle = max(-ANGLE_LIMIT, min(relative_intersect_y, ANGLE_LIMIT))
                
                x = paddle_width + ball_radius
                dx = abs(dx)
                dy = angle * 6
                
                dx *= SPEED_INCREASE_FACTOR
                dy *= SPEED_INCREASE_FACTOR
                
                if game_state.player_1_score > game_state.player_2_score + 3:
                    dx *= RUBBER_BAND_FACTOR
                    dy *= RUBBER_BAND_FACTOR
                
            elif (x + ball_radius >= canvas_width - paddle_width and 
                  y >= player2_paddle_y and 
                  y <= player2_paddle_y + paddle_height and dx > 0):
                
                paddle_center = player2_paddle_y + paddle_height / 2
                relative_intersect_y = (y - paddle_center) / (paddle_height / 2)
                angle = max(-ANGLE_LIMIT, min(relative_intersect_y, ANGLE_LIMIT))
                
                x = canvas_width - paddle_width - ball_radius
                dx = -abs(dx)
                dy = angle * 6
                
                dx *= SPEED_INCREASE_FACTOR
                dy *= SPEED_INCREASE_FACTOR
                
                if game_state.player_2_score > game_state.player_1_score + 3:
                    dx *= RUBBER_BAND_FACTOR
                    dy *= RUBBER_BAND_FACTOR
            
            if x < 0 or x > canvas_width:
                break
            
            trajectory.append((x, y))
    
    except Exception as e:
        logger.error(f"Error calculating ball trajectory: {str(e)}")
    
    return trajectory

def get_estimated_latency(user_id, room_code):
    """
    Get the estimated latency for a user in a room
    Uses Redis to track latency measurements
    """
    if not redis_client:
        return 50
        
    try:
        latency_key = f"latency:{room_code}:{user_id}"
        latency = redis_client.get(latency_key)
        
        if latency:
            return float(latency)
        else:
            return 50
    except Exception:
        return 50

def update_latency_measurement(user_id, room_code, latency_ms):
    """
    Update the latency measurement for a user
    Uses exponential moving average
    """
    if not redis_client:
        return
        
    try:
        latency_key = f"latency:{room_code}:{user_id}"
        current = redis_client.get(latency_key)
        
        if current:
            current = float(current)
            updated = current * 0.8 + latency_ms * 0.2
        else:
            updated = latency_ms
            
        redis_client.set(latency_key, str(updated), ex=120)
    except Exception as e:
        logger.debug(f"Error updating latency: {str(e)}")