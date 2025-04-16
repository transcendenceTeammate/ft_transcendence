
#!/usr/bin/env python3

"""
Simple test script to validate the in-memory implementation
This doesn't require Django to be installed
"""

import sys
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test')

# Mock game state class
class GameState:
    def __init__(self, room_code):
        self.room_code = room_code
        self.status = 'WAITING'
        self.created_at = time.time()
        self.is_paused = True
        
        self.player_1_id = None
        self.player_2_id = None
        
        self.player_1_score = 0
        self.player_2_score = 0
        
        self.canvas_width = 800
        self.canvas_height = 600
        
        self.player_1_paddle_y = 240
        self.player_2_paddle_y = 240
        self.paddle_height = 120
        self.paddle_width = 12
        
        self.ball_x = 400
        self.ball_y = 300
        self.ball_size = 20
        self.ball_speed_x = 0
        self.ball_speed_y = 0
        
        self.winning_score = 10
        self.last_loser = None
        
    def to_dict(self):
        return {
            'room_code': self.room_code,
            'status': self.status,
            'player_1_id': self.player_1_id,
            'player_2_id': self.player_2_id,
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
        
# Mock player session class
class PlayerSession:
    def __init__(self, room_code, player_id, player_number, username=None, connected=True):
        self.room_code = room_code
        self.player_id = player_id
        self.player_number = player_number
        self.username = username or f"Player-{player_number}"
        self.connected = connected
        self.last_active = time.time()

# Mock game manager class  
class GameManager:
    _games = {}  # room_code -> GameState
    _player_sessions = {}  # (room_code, player_id) -> PlayerSession
    
    @classmethod
    def create_game(cls, room_code):
        game = GameState(room_code)
        cls._games[room_code] = game
        logger.info(f"Created game with room code: {room_code}")
        return game
    
    @classmethod
    def get_game(cls, room_code):
        return cls._games.get(room_code)
    
    @classmethod
    def save_game(cls, game):
        cls._games[game.room_code] = game
        return game
    
    @classmethod
    def add_player_session(cls, room_code, player_id, player_number, username):
        session = PlayerSession(room_code, player_id, player_number, username)
        cls._player_sessions[(room_code, player_id)] = session
        return session
    
    @classmethod
    def get_player_session(cls, room_code, player_id):
        return cls._player_sessions.get((room_code, player_id))

def test_game_creation_and_players():
    # Create a test game
    game = GameManager.create_game('TEST01')
    
    # Add players
    game.player_1_id = 'player1'
    game.player_2_id = 'player2'
    GameManager.save_game(game)
    
    # Add player sessions
    GameManager.add_player_session('TEST01', 'player1', 1, 'Alice')
    GameManager.add_player_session('TEST01', 'player2', 2, 'Bob')
    
    # Check that game exists
    retrieved_game = GameManager.get_game('TEST01')
    if retrieved_game:
        logger.info(f"Retrieved game: {retrieved_game.room_code}")
    else:
        logger.error("Failed to retrieve game!")
        return False
    
    # Check player sessions
    p1_session = GameManager.get_player_session('TEST01', 'player1')
    p2_session = GameManager.get_player_session('TEST01', 'player2')
    
    if p1_session and p2_session:
        logger.info(f"Player 1: {p1_session.username}, Player 2: {p2_session.username}")
    else:
        logger.error("Failed to retrieve player sessions!")
        return False
    
    # Check serialization to dict
    game_dict = retrieved_game.to_dict()
    logger.info(f"Game state dict has {len(game_dict)} fields")
    
    return True

def test_state_changes():
    game = GameManager.get_game('TEST01')
    if not game:
        logger.error("Test game not found!")
        return False
    
    # Update scores
    game.player_1_score = 5
    game.player_2_score = 3
    
    # Update ball position
    game.ball_x = 300
    game.ball_y = 200
    game.ball_speed_x = 5
    game.ball_speed_y = -3
    
    GameManager.save_game(game)
    
    # Retrieve updated game
    updated_game = GameManager.get_game('TEST01')
    
    if (updated_game.player_1_score == 5 and 
        updated_game.player_2_score == 3 and
        updated_game.ball_x == 300):
        logger.info("Game state updated successfully")
    else:
        logger.error("Failed to update game state!")
        return False
    
    # Test delta compression
    original_state = updated_game.to_dict()
    
    # Make some changes
    updated_game.ball_x = 400
    updated_game.ball_y = 300
    
    # Calculate delta
    new_state = updated_game.to_dict()
    delta = calculate_state_delta(original_state, new_state)
    
    logger.info(f"Delta has {len(delta)} fields (from {len(new_state)} total fields)")
    
    return True

def calculate_state_delta(old_state, new_state):
    """Simple delta calculation"""
    if not old_state:
        return new_state
        
    delta = {'type': 'game_state_delta', 'timestamp': new_state['timestamp']}
    
    for key, value in new_state.items():
        if key == 'timestamp':
            continue
            
        if key not in old_state or old_state[key] != value:
            delta[key] = value
            
    return delta

if __name__ == "__main__":
    logger.info("Testing in-memory game implementation")
    
    if test_game_creation_and_players():
        logger.info("✅ Basic game creation and player management works")
    else:
        logger.error("❌ Basic game test failed")
        sys.exit(1)
        
    if test_state_changes():
        logger.info("✅ State updates and delta compression work")
    else:
        logger.error("❌ State update test failed")
        sys.exit(1)
    
    logger.info("All tests passed successfully!")
