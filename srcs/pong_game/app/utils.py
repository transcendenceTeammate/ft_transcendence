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
import requests

logger = logging.getLogger(__name__)

# Try to set up Redis connection
try:
    redis_instance = redis.StrictRedis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=0,
        decode_responses=True
    )
    redis_available = True
except Exception as e:
    redis_available = False
    logger.warning(f"Redis connection failed: {e}")

def generate_room_code(length=6):
    """Generate a unique room code"""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
        if not GameState.objects.filter(room_code=code).exists():
            return code

def game_state_to_dict(game_state):
    """Convert GameState model to dictionary"""
    return {
        'room_code': game_state.room_code,
        'player_1_id': game_state.player_1_id,
        'player_2_id': game_state.player_2_id,
        'player_1_score': game_state.player_1_score,
        'player_2_score': game_state.player_2_score,
        'player_1_paddle_y': game_state.player_1_paddle_y,
        'player_2_paddle_y': game_state.player_2_paddle_y,
        'player_1_moving_up': game_state.player_1_moving_up,
        'player_1_moving_down': game_state.player_1_moving_down,
        'player_2_moving_up': game_state.player_2_moving_up,
        'player_2_moving_down': game_state.player_2_moving_down,
        'ball_x': game_state.ball_x,
        'ball_y': game_state.ball_y,
        'ball_speed_x': game_state.ball_speed_x,
        'ball_speed_y': game_state.ball_speed_y,
        'is_paused': game_state.is_paused,
        'status': game_state.status,
        'canvas_width': game_state.canvas_width,
        'canvas_height': game_state.canvas_height,
        'paddle_width': game_state.paddle_width,
        'paddle_height': game_state.paddle_height,
        'ball_size': game_state.ball_size,
        'timestamp': game_state.updated_at.timestamp() * 1000 if game_state.updated_at else 0
    }

def calculate_state_delta(old_state, new_state):
    """Calculate delta between two states"""
    delta = {}
    
    # We always want the type in the delta
    if 'type' in new_state:
        delta['type'] = new_state['type']
    
    # Compare and include only changed fields
    for key, value in new_state.items():
        if key not in old_state or old_state[key] != value:
            delta[key] = value
    
    return delta

def cache_game_state(game_state):
    """Cache game state in Redis"""
    if not redis_available:
        return False
    
    try:
        state_dict = game_state_to_dict(game_state)
        state_json = json.dumps(state_dict)
        redis_instance.setex(
            f"game_state:{game_state.room_code}",
            60 * 5,  # 5 minutes expiration
            state_json
        )
        return True
    except Exception as e:
        logger.error(f"Redis caching error: {e}")
        return False

def get_cached_game_state(room_code):
    """Get cached game state from Redis"""
    if not redis_available:
        return None
    
    try:
        cached_data = redis_instance.get(f"game_state:{room_code}")
        if cached_data:
            return json.loads(cached_data)
        return None
    except Exception as e:
        logger.error(f"Redis retrieval error: {e}")
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

def create_game_state(room_code):
    """Create a new game state in Redis"""
    if not redis_available:
        return None
    
    try:
        # Default game state
        state = {
            'room_code': room_code,
            'player_1_id': None,
            'player_2_id': None,
            'player_1_score': 0,
            'player_2_score': 0,
            'player_1_paddle_y': 200,
            'player_2_paddle_y': 200,
            'player_1_moving_up': False,
            'player_1_moving_down': False,
            'player_2_moving_up': False,
            'player_2_moving_down': False,
            'ball_x': 400,
            'ball_y': 300,
            'ball_speed_x': 0,
            'ball_speed_y': 0,
            'is_paused': True,
            'status': 'WAITING',
            'canvas_width': 800,
            'canvas_height': 600,
            'paddle_width': 15,
            'paddle_height': 100,
            'ball_size': 20,
            'winning_score': 5,
            'timestamp': time.time() * 1000
        }
        
        save_game_state(state)
        return state
    except Exception as e:
        logger.error(f"Error creating game state: {e}")
        return None

def save_game_state(state):
    """Save game state in Redis"""
    if not redis_available:
        return False
    
    try:
        # Add timestamp to track when the state was last updated
        state['timestamp'] = time.time() * 1000
        state_json = json.dumps(state)
        
        # Set with 30 minute expiration to prevent memory leaks
        redis_instance.setex(
            f"game_state:{state['room_code']}",
            60 * 30,  # 30 minutes
            state_json
        )
        return True
    except Exception as e:
        logger.error(f"Redis save error: {e}")
        return False

def get_game_state(room_code):
    """Get game state from Redis"""
    if not redis_available:
        return None
    
    try:
        cached_data = redis_instance.get(f"game_state:{room_code}")
        if cached_data:
            return json.loads(cached_data)
        return None
    except Exception as e:
        logger.error(f"Redis retrieval error: {e}")
        return None

def update_game_state(room_code, updates):
    """Update specific fields in game state"""
    state = get_game_state(room_code)
    if not state:
        return False
    
    # Update the specified fields
    state.update(updates)
    
    # Save the updated state
    return save_game_state(state)

def delete_game_state(room_code):
    """Delete game state from Redis"""
    if not redis_available:
        return False
    
    try:
        redis_instance.delete(f"game_state:{room_code}")
        return True
    except Exception as e:
        logger.error(f"Redis delete error: {e}")
        return False

def update_player_session(room_code, player_id, data):
    """Update player session in Redis"""
    if not redis_available:
        return False
    
    try:
        key = f"player_session:{room_code}:{player_id}"
        
        # Get existing session if any
        existing = redis_instance.get(key)
        if existing:
            session = json.loads(existing)
            session.update(data)
        else:
            session = data
        
        # Add last active timestamp
        session['last_active'] = time.time()
        
        # Save with 30 minute expiration
        redis_instance.setex(
            key,
            60 * 30,  # 30 minutes
            json.dumps(session)
        )
        return True
    except Exception as e:
        logger.error(f"Session update error: {e}")
        return False

def get_player_session(room_code, player_id):
    """Get player session from Redis"""
    if not redis_available:
        return None
    
    try:
        key = f"player_session:{room_code}:{player_id}"
        data = redis_instance.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.error(f"Session retrieval error: {e}")
        return None

def assign_player_number(room_code, player_id, username):
    """Assign a player number to a player"""
    game_state = get_game_state(room_code)
    if not game_state:
        return None
    
    # Check if player already has a session
    session = get_player_session(room_code, player_id)
    if session:
        # Player reconnecting
        update_player_session(room_code, player_id, {'connected': True})
        return session.get('player_number')
    
    # New player joining
    if not game_state.get('player_1_id'):
        # Assign as player 1
        game_state['player_1_id'] = player_id
        save_game_state(game_state)
        
        update_player_session(room_code, player_id, {
            'player_number': 1,
            'username': username,
            'connected': True
        })
        return 1
    
    elif not game_state.get('player_2_id'):
        # Assign as player 2
        game_state['player_2_id'] = player_id
        save_game_state(game_state)
        
        update_player_session(room_code, player_id, {
            'player_number': 2,
            'username': username,
            'connected': True
        })
        return 2
    
    # Game is full, assign as spectator
    update_player_session(room_code, player_id, {
        'player_number': 0,
        'username': username,
        'connected': True
    })
    return 0

def update_game_physics(room_code):
    """Update game physics and return scorer (if any)"""
    game = get_game_state(room_code)
    if not game or game['is_paused']:
        return 0
    
    # Ball position update
    game['ball_x'] += game['ball_speed_x']
    game['ball_y'] += game['ball_speed_y']
    
    ball_radius = game['ball_size'] / 2
    
    # Wall collisions (top and bottom)
    if game['ball_y'] - ball_radius <= 0 or game['ball_y'] + ball_radius >= game['canvas_height']:
        game['ball_speed_y'] = -game['ball_speed_y']
    
    # Paddle collisions
    # Left paddle (Player 1)
    if (game['ball_x'] - ball_radius <= game['paddle_width'] and 
        game['ball_y'] >= game['player_1_paddle_y'] and 
        game['ball_y'] <= game['player_1_paddle_y'] + game['paddle_height'] and
        game['ball_speed_x'] < 0):
        
        # Calculate angle based on where ball hit the paddle
        relative_intersect_y = (game['player_1_paddle_y'] + (game['paddle_height'] / 2)) - game['ball_y']
        normalized_relative_intersect_y = relative_intersect_y / (game['paddle_height'] / 2)
        bounce_angle = normalized_relative_intersect_y * (5 * 3.14159 / 12)  # Max angle: 75 degrees
        
        # Increase speed slightly with each hit
        speed = (game['ball_speed_x']**2 + game['ball_speed_y']**2)**0.5
        speed *= 1.05
        
        game['ball_speed_x'] = speed * abs(speed) * 0.05 * abs(math.cos(bounce_angle))
        game['ball_speed_y'] = speed * -normalized_relative_intersect_y * 0.05
    
    # Right paddle (Player 2)
    elif (game['ball_x'] + ball_radius >= game['canvas_width'] - game['paddle_width'] and 
          game['ball_y'] >= game['player_2_paddle_y'] and 
          game['ball_y'] <= game['player_2_paddle_y'] + game['paddle_height'] and
          game['ball_speed_x'] > 0):
        
        relative_intersect_y = (game['player_2_paddle_y'] + (game['paddle_height'] / 2)) - game['ball_y']
        normalized_relative_intersect_y = relative_intersect_y / (game['paddle_height'] / 2)
        bounce_angle = normalized_relative_intersect_y * (5 * 3.14159 / 12)
        
        speed = (game['ball_speed_x']**2 + game['ball_speed_y']**2)**0.5
        speed *= 1.05
        
        game['ball_speed_x'] = -speed * abs(speed) * 0.05 * abs(math.cos(bounce_angle))
        game['ball_speed_y'] = speed * -normalized_relative_intersect_y * 0.05
    
    # Goal detection
    scorer = 0
    if game['ball_x'] < 0:
        # Player 2 scores
        game['player_2_score'] += 1
        game['ball_x'] = game['canvas_width'] / 2
        game['ball_y'] = game['canvas_height'] / 2
        game['ball_speed_x'] = 0
        game['ball_speed_y'] = 0
        game['is_paused'] = True
        scorer = 2
    elif game['ball_x'] > game['canvas_width']:
        # Player 1 scores
        game['player_1_score'] += 1
        game['ball_x'] = game['canvas_width'] / 2
        game['ball_y'] = game['canvas_height'] / 2
        game['ball_speed_x'] = 0
        game['ball_speed_y'] = 0
        game['is_paused'] = True
        scorer = 1
    
    save_game_state(game)
    return scorer

def check_for_winner(room_code):
    """Check if there's a winner"""
    game = get_game_state(room_code)
    if not game:
        return 0
    
    if game['player_1_score'] >= game['winning_score']:
        return 1
    elif game['player_2_score'] >= game['winning_score']:
        return 2
    
    return 0

def record_game_history(room_code, api_url=None):
    """Record game history via API"""
    game = get_game_state(room_code)
    if not game or game['status'] != 'FINISHED':
        return False
    
    try:
        # Get access token from player sessions
        p1_session = get_player_session(room_code, game['player_1_id'])
        p2_session = get_player_session(room_code, game['player_2_id'])
        
        if not p1_session or not p2_session:
            logger.error(f"Cannot record game history: missing player session")
            return False
        
        if api_url is None:
            # Default to the standard API URL
            api_url = "https://api.app.10.24.108.2.nip.io:8443/api/game/create/"
        
        # Call the API to record game history
        headers = {'Content-Type': 'application/json'}
        if 'token' in p1_session:
            headers['Authorization'] = f"Bearer {p1_session['token']}"
        
        data = {
            "player_1": game['player_1_id'],
            "player_2": game['player_2_id'],
            "score_1": game['player_1_score'],
            "score_2": game['player_2_score']
        }
        
        response = requests.post(api_url, json=data, headers=headers)
        if response.status_code == 201:
            logger.info(f"Game history recorded for room {room_code}")
            return True
        else:
            logger.error(f"Failed to record game history: {response.status_code} {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error recording game history: {e}")
        return False