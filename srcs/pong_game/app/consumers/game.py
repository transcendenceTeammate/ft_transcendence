import json
import asyncio
import logging
import random
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from ..game.manager import GameManager
from ..constants import SERVER_UPDATE_RATE
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
        
        self.token = self.get_token_from_scope()

        logger.info(f"WebSocket connection attempt to room {self.room_code}")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        game = GameManager.get_game(self.room_code)
        if game:
            await self.send_full_game_state(game)
        else:
            game = GameManager.create_game(self.room_code)
            await self.send_full_game_state(game)

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        logger.info(f"WebSocket disconnection from room {self.room_code} with code {close_code}")

        if self.game_loop_task:
            self.game_loop_task.cancel()
            try:
                await self.game_loop_task
            except asyncio.CancelledError:
                pass

        if self.player_number:
            GameManager.update_player_session(self.room_code, self.player_id, connected=False)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'player_left',
                    'player_number': self.player_number,
                    'player_id': self.player_id,
                    'username': self.username
                }
            )

            game = GameManager.get_game(self.room_code)
            if game and game.status == 'ONGOING' and not game.is_paused:
                game.is_paused = True
                GameManager.save_game(game)

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
                pass  # Simplified: ignore pong messages
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

        game = GameManager.get_game(self.room_code)
        if not game:
            logger.info(f"Creating new game for room {self.room_code}")
            game = GameManager.create_game(self.room_code)

        self.player_number, self.username = GameManager.assign_player_number(
            self.room_code, player_id, username
        )
        
        logger.info(f"Assigned player number {self.player_number} to {self.player_id}")

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'player_joined',
                'player_number': self.player_number,
                'player_id': self.player_id,
                'username': self.username
            }
        )

        # Send the updated game state to all clients to ensure everyone has latest player usernames
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_state_update',
                'delta': game.to_dict(),
                'sequence': 0,
                'is_full_state': True
            }
        )

        await self.send_full_game_state(game)

        if (game.player_1_id and game.player_2_id and
            game.status != 'FINISHED' and not self.game_loop_task):

            game.status = 'ONGOING'
            GameManager.save_game(game)

            logger.info(f"Starting game loop for room {self.room_code}")
            self.game_loop_task = asyncio.create_task(self.game_loop())

    async def handle_key_event(self, data):
        """Handle keyboard input from clients"""
        if not self.player_number:
            return

        key = data.get('key', '').lower()
        is_down = data.get('is_down', False)
        player_number = data.get('player_number')

        if player_number != self.player_number:
            return

        game = GameManager.get_game(self.room_code)
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

        GameManager.save_game(game)

    async def handle_paddle_position(self, data):
        """
        Handle paddle position updates from clients
        """
        if not self.player_number:
            return

        player_number = data.get('player_number')
        position = data.get('position')

        # Basic validation - player can only update their own paddle
        if player_number != self.player_number:
            return

        game = GameManager.get_game(self.room_code)
        if not game:
            return

        # Validate the position is within bounds
        if position < 0:
            position = 0
        elif position > game.canvas_height - game.paddle_height:
            position = game.canvas_height - game.paddle_height

        # Update the game state with the validated client position
        if player_number == 1:
            game.player_1_paddle_y = position
        elif player_number == 2:
            game.player_2_paddle_y = position

        GameManager.save_game(game)

    async def handle_pause_game(self, data):
        """Handle game pause request"""
        if not self.player_number:
            return

        game = GameManager.get_game(self.room_code)
        if not game:
            return

        game.is_paused = True
        GameManager.save_game(game)

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

        game = GameManager.get_game(self.room_code)
        if not game:
            return

        ball_speed_x = data.get('ball_speed_x', None)
        ball_speed_y = data.get('ball_speed_y', None)

        game.is_paused = False

        if ball_speed_x is not None and ball_speed_y is not None:
            game.ball_speed_x = ball_speed_x
            game.ball_speed_y = ball_speed_y
        elif game.ball_speed_x == 0 and game.ball_speed_y == 0:
            game.resume_ball()

        GameManager.save_game(game)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_resumed',
                'player_number': self.player_number,
                'ball_speed_x': game.ball_speed_x,
                'ball_speed_y': game.ball_speed_y
            }
        )

    async def game_loop(self):
        """Main game loop with fixed update rate"""
        try:
            frame_duration = 1 / SERVER_UPDATE_RATE  # 30 FPS

            while True:
                loop_start = time.time()

                game = GameManager.get_game(self.room_code)
                if not game or game.status == 'FINISHED':
                    if game and game.status == 'FINISHED':
                        await GameManager.record_game_result(game)
                    break

                changed = False
                if not game.is_paused:
                    scorer = game.update()
                    changed = True

                    if scorer > 0:
                        await self.handle_goal_scored(game, scorer)

                    winner = game.check_for_winner()
                    if winner > 0:
                        await self.handle_game_over(game, winner)
                        break

                if changed:
                    GameManager.save_game(game)

                # Send game state updates with delta compression
                new_state = game.to_dict()
                
                if self.last_sent_state:
                    delta = GameManager.calculate_state_delta(self.last_sent_state, new_state)
                    
                    if len(delta) > 2:  # If there are actual changes
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'game_state_update',
                                'delta': delta
                            }
                        )
                        self.last_sent_state = new_state
                else:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'game_state_update',
                            'delta': new_state,
                            'is_full_state': True
                        }
                    )
                    self.last_sent_state = new_state

                elapsed = time.time() - loop_start
                sleep_time = max(0, frame_duration - elapsed)
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.exception("Error in game loop")

    async def handle_goal_scored(self, game, scorer):
        """Handle goal scored event"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'goal_scored',
                'scorer': scorer,
                'player_1_score': game.player_1_score,
                'player_2_score': game.player_2_score,
                'player_1_username': game.player_1_username,
                'player_2_username': game.player_2_username,
                'timestamp': time.time() * 1000
            }
        )

    async def handle_game_over(self, game, winner):
        """Handle game over event and record game result"""
        # Mark game as finished
        game.status = 'FINISHED'
        GameManager.save_game(game)
        
        # Send game over message to clients
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_over',
                'winner': winner,
                'player_1_score': game.player_1_score,
                'player_2_score': game.player_2_score,
                'player_1_username': game.player_1_username,
                'player_2_username': game.player_2_username,
                'timestamp': time.time() * 1000
            }
        )
        
        # Record game result to user_management service
        try:
            logger.info(f"Recording game result for room {self.room_code}")
            await GameManager.record_game_result(game)
        except Exception as e:
            logger.error(f"Failed to record game result: {str(e)}")

    async def send_full_game_state(self, game):
        """Send full game state to the client"""
        state_dict = game.to_dict()
        self.last_sent_state = state_dict

        await self.send(text_data=json.dumps({
            'type': 'game_state',
            'is_full_state': True,
            **state_dict
        }))

    async def send_error(self, message):
        """Send error message to the client"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))

    async def game_state_update(self, event):
        """Handle game state update from channel layer"""
        delta = event['delta']
        is_full_state = event.get('is_full_state', False)

        if 'type' not in delta:
            delta['type'] = 'game_state_delta'

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
            'ball_speed_x': event.get('ball_speed_x'),
            'ball_speed_y': event.get('ball_speed_y'),
            'timestamp': time.time() * 1000
        }))

    async def goal_scored(self, event):
        """Handle goal_scored message from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'goal_scored',
            'scorer': event['scorer'],
            'player_1_score': event['player_1_score'],
            'player_2_score': event['player_2_score'],
            'player_1_username': event.get('player_1_username'),
            'player_2_username': event.get('player_2_username'),
            'timestamp': event['timestamp']
        }))

    async def game_over(self, event):
        """Handle game_over message from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'game_over',
            'winner': event['winner'],
            'player_1_score': event['player_1_score'],
            'player_2_score': event['player_2_score'],
            'player_1_username': event.get('player_1_username'),
            'player_2_username': event.get('player_2_username'),
            'timestamp': event['timestamp']
        }))
