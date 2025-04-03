import json
import asyncio
import logging
import random
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import GameState, PlayerSession
from .utils import (
    cache_game_state, get_cached_game_state, 
    calculate_state_delta, game_state_to_dict,
    get_estimated_latency, update_latency_measurement
)
from .constants import SERVER_UPDATE_RATE
import jwt
from django.conf import settings

logger = logging.getLogger(__name__)

class GameConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for the Pong game.
    """
    
    async def connect(self):
        """Handle new WebSocket connection"""
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group_name = f'game_{self.room_code}'
        
        self.player_number = None
        self.player_id = None
        self.username = None
        
        self.game_loop_task = None
        self.last_sent_state = None
        self.client_sequence = 0
        self.server_sequence = 0
        self.ping_task = None
        
        self.token = self.get_token_from_scope()
        
        logger.info(f"WebSocket connection attempt to room {self.room_code}")
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        game = await self.get_game_state()
        if game:
            await self.send_full_game_state(game)
            
            self.ping_task = asyncio.create_task(self.ping_loop())
        else:
            await self.send_error("Game room not found")
            await self.close()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        logger.info(f"WebSocket disconnection from room {self.room_code} with code {close_code}")
        
        if self.game_loop_task:
            self.game_loop_task.cancel()
            try:
                await self.game_loop_task
            except asyncio.CancelledError:
                pass
        
        if self.ping_task:
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass
        
        if self.player_number:
            await self.update_player_session(connected=False)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'player_left',
                    'player_number': self.player_number,
                    'player_id': self.player_id,
                    'username': self.username
                }
            )
            
            game = await self.get_game_state()
            if game and game.status == 'ONGOING' and not game.is_paused:
                game.is_paused = True
                await self.save_game_state(game)
        
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            logger.debug(f"Received message of type {message_type}")
            
            if message_type == 'join_game':
                await self.handle_join_game(data)
            elif message_type == 'key_event':
                await self.handle_key_event(data)
            elif message_type == 'paddle_position':
                await self.handle_paddle_position(data)
            elif message_type == 'pause_game':
                await self.handle_pause_game(data)
            elif message_type == 'resume_game':
                await self.handle_resume_game(data)
            elif message_type == 'pong':
                await self.handle_pong(data)
            elif message_type == 'client_prediction':
                await self.handle_client_prediction(data)
            else:
                await self.send_error(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.exception("Error in receive")
            await self.send_error(f"Server error: {str(e)}")
    
    def get_token_from_scope(self):
        """Extract token from query string or cookies"""
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        cookies = self.scope.get('cookies', {})
        
        if 'token=' in query_string:
            token = query_string.split('token=')[1].split('&')[0]
            return token
        
        return cookies.get('access_token')
    
    async def authenticate_user(self):
        """Authenticate user with JWT token"""
        if not self.token:
            logger.warning("Authentication attempted with no token")
            return None
        
        try:
            payload = jwt.decode(
                self.token,
                settings.SECRET_KEY, 
                algorithms=["HS256"]
            )
            
            user_id = payload.get('user_id')
            username = payload.get('username')
            
            if not user_id:
                logger.warning("Token missing user_id")
                return None
            
            logger.info(f"Authentication successful for user {user_id}")
            return {
                'user_id': user_id,
                'username': username or f"Player-{user_id}"
            }
            
        except jwt.PyJWTError as e:
            logger.error(f"JWT authentication failed: {str(e)}")
            return None
    
    async def handle_client_prediction(self, data):
        """Handle client-side prediction data and acknowledge"""
        if not self.player_number:
            return
            
        sequence = data.get('sequence')
        if sequence:
            await self.update_client_sequence(sequence)
            
            await self.send(text_data=json.dumps({
                'type': 'prediction_ack',
                'sequence': sequence,
                'server_time': time.time() * 1000,
            }))
    
    @database_sync_to_async
    def update_client_sequence(self, sequence):
        """Update player session with client sequence"""
        try:
            session = PlayerSession.objects.get(
                room_code=self.room_code,
                player_id=self.player_id
            )
            session.client_sequence = sequence
            session.save(update_fields=['client_sequence'])
        except PlayerSession.DoesNotExist:
            pass
    
    async def get_game_state(self):
        """
        Get game state, trying Redis cache first then falling back to database
        """
        cached_state = get_cached_game_state(self.room_code)
        if cached_state:
            return await self.dict_to_game_state(cached_state)
        
        return await self.get_game_state_from_db()
    
    @database_sync_to_async
    def get_game_state_from_db(self):
        """Get game state from database"""
        try:
            game = GameState.objects.get(room_code=self.room_code)
            cache_game_state(game)
            return game
        except GameState.DoesNotExist:
            return None
    
    @database_sync_to_async
    def dict_to_game_state(self, state_dict):
        """Convert a dictionary to GameState object"""
        try:
            game = GameState.objects.get(room_code=state_dict['room_code'])
            
            for key, value in state_dict.items():
                if key != 'timestamp' and hasattr(game, key):
                    setattr(game, key, value)
                    
            return game
        except GameState.DoesNotExist:
            return None
    
    async def save_game_state(self, game):
        """Save game state to database and cache"""
        game = await self.save_game_state_to_db(game)
        
        cache_game_state(game)
        
        return game
    
    @database_sync_to_async
    def save_game_state_to_db(self, game):
        """Save game state to database"""
        game.save()
        return game
    
    @database_sync_to_async
    def update_player_session(self, connected=True):
        """Update player session"""
        if not self.player_id or not self.player_number:
            return
        
        session, created = PlayerSession.objects.get_or_create(
            room_code=self.room_code,
            player_id=self.player_id,
            defaults={
                'player_number': self.player_number,
                'username': self.username,
                'connected': connected,
                'client_sequence': self.client_sequence,
                'last_acknowledged_sequence': 0
            }
        )
                
        if not created:
            session.connected = connected
            session.save(update_fields=['connected', 'last_active'])
        
        return session
    
    @database_sync_to_async
    def assign_player_number(self, player_id, username):
        """Assign a player number to a player"""
        game = GameState.objects.get(room_code=self.room_code)
                    
        try:
            session = PlayerSession.objects.get(
                room_code=self.room_code,
                player_id=player_id
            )
            
            session.connected = True
            session.save(update_fields=['connected', 'last_active'])
            
            self.client_sequence = session.client_sequence
                            
            return session.player_number, username
        
        except PlayerSession.DoesNotExist:
            if not game.player_1_id:
                game.player_1_id = player_id
                game.save(update_fields=['player_1_id'])
                
                PlayerSession.objects.create(
                    room_code=self.room_code,
                    player_id=player_id,
                    player_number=1,
                    username=username,
                    connected=True,
                    client_sequence=0,
                    last_acknowledged_sequence=0
                )
                
                return 1, username
            
            elif not game.player_2_id:
                game.player_2_id = player_id
                game.save(update_fields=['player_2_id'])
                
                PlayerSession.objects.create(
                    room_code=self.room_code,
                    player_id=player_id,
                    player_number=2,
                    username=username,
                    connected=True,
                    client_sequence=0,
                    last_acknowledged_sequence=0
                )
                
                return 2, username
            
            else:
                return None, username
    
    async def handle_join_game(self, data):
        """Handle player joining the game"""
        player_id = data.get('player_id') 
        username = data.get('username')
        
        logger.info(f"Join game request from {player_id or 'unknown'} ({username or 'unnamed'})")
        
        if not player_id:
            user_info = await self.authenticate_user()
            if user_info:
                player_id = user_info['user_id']
                username = user_info['username']
                logger.info(f"Authenticated as user {player_id}")
            else:
                player_id = f"guest-{random.randint(1000, 9999)}"
                username = f"Guest-{random.randint(1000, 9999)}"
                logger.info(f"Created guest user {player_id}")
        
        self.player_id = player_id
        self.username = username
        
        game = await self.get_game_state()
        if not game:
            logger.info(f"Creating new game for room {self.room_code}")
            game = await self.create_game_state()
        
        self.player_number, self.username = await self.assign_player_number(player_id, username)
        logger.info(f"Assigned player number {self.player_number} to {self.player_id}")
        
        await self.update_player_session(connected=True)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'player_joined',
                'player_number': self.player_number,
                'player_id': self.player_id,
                'username': self.username
            }
        )
        
        await self.send_full_game_state(game)
        
        if (game.player_1_id and game.player_2_id and 
            game.status != 'FINISHED' and not self.game_loop_task):
            
            game.status = 'ONGOING'
            await self.save_game_state(game)
            
            logger.info(f"Starting game loop for room {self.room_code}")
            self.game_loop_task = asyncio.create_task(self.game_loop())

    async def handle_key_event(self, data):
        """Handle keyboard input from clients"""
        if not self.player_number:
            return
        
        key = data.get('key', '').lower()
        is_down = data.get('is_down', False)
        player_number = data.get('player_number')
        sequence = data.get('sequence', 0)
        
        if player_number != self.player_number:
            return
        
        game = await self.get_game_state()
        if not game:
            return
        
        if self.player_number == 1:
            if key in ('w', 'arrowup'):
                game.player_1_moving_up = is_down
            elif key in ('s', 'arrowdown'):
                game.player_1_moving_down = is_down
        elif self.player_number == 2:
            if key in ('w', 'arrowup'):
                game.player_2_moving_up = is_down
            elif key in ('s', 'arrowdown'):
                game.player_2_moving_down = is_down
        
        await self.save_game_state(game)
        
        if sequence > 0:
            await self.send(text_data=json.dumps({
                'type': 'input_ack', 
                'sequence': sequence,
                'server_time': time.time() * 1000  # In milliseconds
            }))
        
    async def handle_paddle_position(self, data):
        """
        Handle paddle position updates from clients with client authority
        """
        if not self.player_number:
            return
        
        player_number = data.get('player_number')
        position = data.get('position')
        sequence = data.get('sequence', 0)
        authoritative = data.get('authoritative', False)
        
        # Basic validation - player can only update their own paddle
        if player_number != self.player_number:
            return
        
        game = await self.get_game_state()
        if not game:
            return
        
        # Validate the position is within bounds
        if position < 0:
            position = 0
        elif position > game.canvas_height - game.paddle_height:
            position = game.canvas_height - game.paddle_height
        
        # Ball collision check for server authority
        force_reconcile = False
        ball_radius = game.ball_size / 2
        
        # Check if paddle is involved in ball collision
        # - For player 1 (left paddle)
        if (player_number == 1 and 
            game.ball_x - ball_radius <= game.paddle_width + 5 and 
            game.ball_x > 0 and game.ball_speed_x < 0):
            
            # We're near a potential ball collision - server needs authority
            force_reconcile = True
        
        # - For player 2 (right paddle)
        elif (player_number == 2 and 
            game.ball_x + ball_radius >= game.canvas_width - game.paddle_width - 5 and 
            game.ball_x < game.canvas_width and game.ball_speed_x > 0):
            
            # We're near a potential ball collision - server needs authority  
            force_reconcile = True
        
        # Update the game state with the validated client position
        if player_number == 1:
            # Only update if position passed validation
            game.player_1_paddle_y = position
            game.force_reconcile_p1 = force_reconcile
        elif player_number == 2:
            # Only update if position passed validation
            game.player_2_paddle_y = position
            game.force_reconcile_p2 = force_reconcile
        
        await self.save_game_state(game)
        
        # Always send acknowledgment to client
        if sequence > 0:
            await self.send(text_data=json.dumps({
                'type': 'input_ack', 
                'sequence': sequence,
                'server_time': time.time() * 1000,  # In milliseconds
                'position': position, # Send back validated position
                'force_reconcile': force_reconcile # Let client know if we need server authority
            }))

    async def handle_pause_game(self, data):
        """Handle game pause request"""
        if not self.player_number:
            return
            
        game = await self.get_game_state()
        if not game:
            return
        
        game.is_paused = True
        await self.save_game_state(game)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_paused',
                'player_number': self.player_number
            }
        )

    async def handle_resume_game(self, data):
        """Handle game resume request"""
        if not self.player_number:
            return
        
        game = await self.get_game_state()
        if not game:
            return
        
        ball_speed_x = data.get('ball_speed_x', None)
        ball_speed_y = data.get('ball_speed_y', None)
        
        game.is_paused = False
        
        if ball_speed_x is not None and ball_speed_y is not None:
            game.ball_speed_x = ball_speed_x
            game.ball_speed_y = ball_speed_y
            logger.info(f"Setting ball speeds from client: ({ball_speed_x}, {ball_speed_y})")
        elif game.ball_speed_x == 0 and game.ball_speed_y == 0:
            game.resume_ball()
            logger.info(f"Ball resumed with game method: ({game.ball_speed_x}, {game.ball_speed_y})")
        
        await self.save_game_state(game)
        
        logger.info(f"Game resumed by player {self.player_number} with ball speeds: ({game.ball_speed_x}, {game.ball_speed_y})")
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_resumed',
                'player_number': self.player_number,
                'ball_speed_x': game.ball_speed_x,
                'ball_speed_y': game.ball_speed_y
            }
        )
    
    async def handle_pong(self, data):
        """Handle pong response for latency measurement"""
        try:
            now = time.time() * 1000  # Current time in ms
            sent_time = data.get('time', 0)
            
            if sent_time > 0:
                rtt = now - sent_time
                
                if self.player_id:
                    update_latency_measurement(
                        self.player_id,
                        self.room_code,
                        rtt
                    )
        except Exception as e:
            logger.debug(f"Error processing pong: {str(e)}")
    
    async def ping_loop(self):
        """Periodically send ping to measure latency"""
        try:
            while True:
                await self.send(text_data=json.dumps({
                    'type': 'ping',
                    'time': time.time() * 1000
                }))
                
                await asyncio.sleep(5)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.exception(f"Error in ping loop: {str(e)}")
    
    async def game_loop(self):
        """Main game loop with optimized networking"""
        try:
            frame_duration = 1 / SERVER_UPDATE_RATE
            
            while True:
                loop_start = time.time()
                
                game = await self.get_game_state()
                if not game or game.status == 'FINISHED':
                    break
                
                changed = False
                if not game.is_paused:
                    scorer = game.update_game_state()
                    changed = True
                    
                    if scorer > 0:
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'goal_scored',
                                'scorer': scorer,
                                'player_1_score': game.player_1_score,
                                'player_2_score': game.player_2_score,
                                'timestamp': time.time() * 1000
                            }
                        )
                    
                    winner = game.check_for_winner()
                    if winner > 0:
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'game_over',
                                'winner': winner,
                                'player_1_score': game.player_1_score,
                                'player_2_score': game.player_2_score,
                                'timestamp': time.time() * 1000
                            }
                        )
                        break
                
                if changed:
                    await self.save_game_state(game)
                
                new_state = game_state_to_dict(game)
                
                if self.last_sent_state:
                    delta = calculate_state_delta(self.last_sent_state, new_state)
                    
                    if len(delta) > 2:
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'game_state_update',
                                'delta': delta,
                                'sequence': self.server_sequence
                            }
                        )
                        self.server_sequence += 1
                        self.last_sent_state = new_state
                else:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'game_state_update',
                            'delta': new_state,
                            'sequence': self.server_sequence,
                            'is_full_state': True
                        }
                    )
                    self.server_sequence += 1
                    self.last_sent_state = new_state
                
                elapsed = time.time() - loop_start
                
                sleep_time = max(0, frame_duration - elapsed)
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.exception("Error in game loop")

    async def send_full_game_state(self, game):
        """Send full game state to the client"""
        state_dict = game_state_to_dict(game)
        self.last_sent_state = state_dict
        
        await self.send(text_data=json.dumps({
            'type': 'game_state',
            'is_full_state': True,
            'sequence': self.server_sequence,
            **state_dict
        }))
        self.server_sequence += 1

    async def send_error(self, message):
        """Send error message to the client"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))
    
    async def game_state_update(self, event):
        """Handle game state update from channel layer"""
        delta = event['delta']
        sequence = event['sequence']
        is_full_state = event.get('is_full_state', False)
        
        if 'type' not in delta:
            delta['type'] = 'game_state_delta'
            
        delta['sequence'] = sequence
        delta['is_full_state'] = is_full_state
        
        await self.send(text_data=json.dumps(delta))
    
    async def player_joined(self, event):
        """Handle player_joined message from channel layer"""
        is_you = self.player_id == event['player_id']
        
        await self.send(text_data=json.dumps({
            'type': 'player_joined',
            'player_number': event['player_number'],
            'player_id': event['player_id'],
            'username': event['username'],
            'is_you': is_you,
            'timestamp': time.time() * 1000
        }))
    
    async def player_left(self, event):
        """Handle player_left message from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'player_left',
            'player_number': event['player_number'],
            'player_id': event['player_id'],
            'username': event['username'],
            'timestamp': time.time() * 1000
        }))
    
    async def game_paused(self, event):
        """Handle game_paused message from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'game_paused',
            'player_number': event['player_number'],
            'timestamp': time.time() * 1000
        }))
    
    async def game_resumed(self, event):
        """Handle game_resumed message from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'game_resumed',
            'player_number': event['player_number'],
            'timestamp': time.time() * 1000
        }))
    
    async def goal_scored(self, event):
        """Handle goal_scored message from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'goal_scored',
            'scorer': event['scorer'],
            'player_1_score': event['player_1_score'],
            'player_2_score': event['player_2_score'],
            'timestamp': event['timestamp']
        }))
    
    async def game_over(self, event):
        """Handle game_over message from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'game_over',
            'winner': event['winner'],
            'player_1_score': event['player_1_score'],
            'player_2_score': event['player_2_score'],
            'timestamp': event['timestamp']
        }))
    
    @database_sync_to_async
    def create_game_state(self):
        """Create a new game state"""
        game = GameState.objects.create(
            room_code=self.room_code,
            status='WAITING',
            is_paused=True
        )
        return game