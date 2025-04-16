import logging
import random
import string
import time
import redis
import json
import aiohttp
import asyncio
from django.conf import settings
from .state import GameState
from .player import PlayerSession

logger = logging.getLogger(__name__)

try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True
    )
    redis_client.ping()
    REDIS_AVAILABLE = True
    logger.info("Redis connection established")
except Exception as e:
    REDIS_AVAILABLE = False
    logger.error(f"Redis connection failed: {str(e)}")

class GameManager:
    """Manages all game instances in memory"""
    
    _games = {}
    _player_sessions = {}
    _player_to_room = {}
    _cleanup_scheduled = False

    @classmethod
    def generate_room_code(cls, length=6):
        """Generate a unique room code"""
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
            if code not in cls._games:
                return code
    
    @classmethod
    def create_game(cls, room_code=None):
        """Create a new game instance"""
        if not room_code:
            room_code = cls.generate_room_code()
            
        if room_code in cls._games:
            return cls._games[room_code]
            
        game = GameState(room_code)
        cls._games[room_code] = game
        
        if REDIS_AVAILABLE:
            cls.cache_game_state(game)

        if not cls._cleanup_scheduled:
            cls._schedule_cleanup()
            
        return game
    
    @classmethod
    def _schedule_cleanup(cls):
        """Schedule periodic cleanup of finished games"""
        cls._cleanup_scheduled = True
        
        async def cleanup_job():
            while True:
                try:
                    await asyncio.sleep(settings.GAME_CLEANUP_INTERVAL)
                    logger.info("Running periodic game cleanup")
                    
                    rooms = list(cls._games.keys())
                    
                    for room_code in rooms:
                        game = cls._games.get(room_code)
                        if not game:
                            continue
                            
                        if game.status == 'FINISHED' and (time.time() - game.created_at > 3600):
                            logger.info(f"Cleaning up finished game: {room_code}")
                            cls.delete_game(room_code)
                            
                except Exception as e:
                    logger.error(f"Error in cleanup job: {str(e)}")
        
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        loop.create_task(cleanup_job())
    
    @classmethod
    def get_game(cls, room_code):
        """Get a game by room code, first checking Redis then memory"""
        if room_code in cls._games:
            return cls._games[room_code]
            
        if REDIS_AVAILABLE:
            state_json = redis_client.get(f"game:{room_code}")
            if state_json:
                try:
                    state_dict = json.loads(state_json)
                    game = GameState(room_code)
                    
                    for key, value in state_dict.items():
                        if key != 'timestamp' and hasattr(game, key):
                            setattr(game, key, value)
                            
                    cls._games[room_code] = game
                    return game
                except Exception as e:
                    logger.error(f"Error loading game from Redis: {str(e)}")
        
        return None
    
    @classmethod
    def save_game(cls, game):
        """Save game to in-memory storage and Redis cache"""
        cls._games[game.room_code] = game
        
        if REDIS_AVAILABLE:
            cls.cache_game_state(game)
            
        return game
    
    @classmethod
    def delete_game(cls, room_code):
        """Remove a game instance"""
        if room_code in cls._games:
            del cls._games[room_code]
            
        if REDIS_AVAILABLE:
            redis_client.delete(f"game:{room_code}")
            
        keys_to_remove = []
        for key in cls._player_sessions:
            if key[0] == room_code:
                keys_to_remove.append(key)
                
        for key in keys_to_remove:
            if key in cls._player_sessions:
                player_id = key[1]
                if player_id in cls._player_to_room:
                    del cls._player_to_room[player_id]
                del cls._player_sessions[key]
    
    @classmethod
    def cache_game_state(cls, game):
        """Store game state in Redis cache with TTL"""
        if not REDIS_AVAILABLE:
            return False
            
        try:
            state_dict = game.to_dict()
            state_json = json.dumps(state_dict)
            
            redis_client.set(f"game:{game.room_code}", state_json, ex=300)
            return True
        except Exception as e:
            logger.error(f"Redis caching error: {str(e)}")
            return False
    
    @classmethod
    def add_player_session(cls, room_code, player_id, player_number, username):
        """Create or update a player session"""
        session = PlayerSession(
            room_code=room_code,
            player_id=player_id,
            player_number=player_number,
            username=username,
            connected=True
        )
        
        key = (room_code, player_id)
        cls._player_sessions[key] = session
        cls._player_to_room[player_id] = room_code
        
        return session
    
    @classmethod
    def get_player_session(cls, room_code, player_id):
        """Get a player session"""
        key = (room_code, player_id)
        return cls._player_sessions.get(key)
    
    @classmethod
    def update_player_session(cls, room_code, player_id, connected=True):
        """Update a player session's connected status"""
        key = (room_code, player_id)
        if key in cls._player_sessions:
            cls._player_sessions[key].connected = connected
            cls._player_sessions[key].last_active = time.time()
            return cls._player_sessions[key]
        return None
    
    @classmethod
    def assign_player_number(cls, room_code, player_id, username):
        """Assign a player number to a player"""
        game = cls.get_game(room_code)
        if not game:
            return None, username
        
        session = cls.get_player_session(room_code, player_id)
        if session:
            session.connected = True
            session.last_active = time.time()
            return session.player_number, username
        
        if not game.player_1_id:
            game.player_1_id = player_id
            cls.save_game(game)
            
            cls.add_player_session(room_code, player_id, 1, username)
            return 1, username
        
        elif not game.player_2_id:
            game.player_2_id = player_id
            cls.save_game(game)
            
            cls.add_player_session(room_code, player_id, 2, username)
            return 2, username
        
        return None, username
        
    @classmethod
    def calculate_state_delta(cls, old_state, new_state):
        """
        Calculate the difference between two game states
        Returns only the changed fields
        """
        if not old_state:
            return new_state
            
        delta = {'type': 'game_state_delta', 'timestamp': new_state.get('timestamp', time.time() * 1000)}
        
        for key, value in new_state.items():
            if key == 'timestamp':
                continue
                
            if key not in old_state or old_state[key] != value:
                delta[key] = value
                
        return delta
    
    @classmethod
    async def record_game_result(cls, game):
        """Send game result to user_management service"""
        if game.status != 'FINISHED':
            return
            
        try:
            game_data = {
                'room_code': game.room_code,
                'player_1_id': game.player_1_id,
                'player_2_id': game.player_2_id,
                'player_1_score': game.player_1_score,
                'player_2_score': game.player_2_score,
                'winner_id': game.player_1_id if game.player_1_score > game.player_2_score else game.player_2_id,
                'duration': (time.time() - game.created_at),
                'finished_at': time.time()
            }
            
            async with aiohttp.ClientSession() as session:
                url = f"{settings.USER_MANAGEMENT_URL}/api/games/"
                headers = {'Content-Type': 'application/json'}
                
                if hasattr(settings, 'API_KEY') and settings.API_KEY:
                    headers['Authorization'] = f"Api-Key {settings.API_KEY}"
                
                async with session.post(url, json=game_data, headers=headers) as response:
                    if response.status != 201:
                        logger.error(f"Failed to record game result: {await response.text()}")
                    else:
                        logger.info(f"Game result recorded successfully for {game.room_code}")
                        
        except Exception as e:
            logger.error(f"Error recording game result: {str(e)}")
