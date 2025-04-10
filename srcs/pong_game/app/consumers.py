import json
import asyncio
import logging
import random
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from .utils import (
    get_game_state, save_game_state, create_game_state,
    update_game_state, delete_game_state,
    calculate_state_delta, update_player_session,
    get_player_session, assign_player_number,
    update_game_physics, check_for_winner,
    record_game_history, get_username_from_api
)
from .constants import SERVER_UPDATE_RATE
import jwt
from django.conf import settings
from .models import PlayerSession

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

        self.token = self.get_token_from_scope()

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        game = get_game_state(self.room_code)
        if game:
            await self.send_full_game_state(game)
        else:
            await self.send_error("Game room not found")
            await self.close()

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if self.game_loop_task:
            self.game_loop_task.cancel()
            try:
                await self.game_loop_task
            except asyncio.CancelledError:
                pass

        if self.player_number and self.player_id:
            # Mark player as disconnected
            update_player_session(self.room_code, self.player_id, {'connected': False})

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'player_left',
                    'player_number': self.player_number,
                    'player_id': self.player_id,
                    'username': self.username
                }
            )

            # Pause the game if it's ongoing
            game = get_game_state(self.room_code)
            if game and game['status'] == 'ONGOING' and not game['is_paused']:
                game['is_paused'] = True
                save_game_state(game)

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

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
            elif message_type == 'client_prediction':
                await self.handle_client_prediction(data)
            else:
                await self.send_error(f"Unknown message type: {message_type}")

        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
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
                return None
            
            # If user_id exists but username doesn't, fetch it
            if user_id and not username:
                username = get_username_from_api(user_id, self.token)

            return {
                'user_id': user_id,
                'username': username or f"Player-{user_id[:6]}"
            }

        except jwt.PyJWTError:
            return None

    async def handle_client_prediction(self, data):
        """Handle client-side prediction data and acknowledge"""
        if not self.player_number:
            return

        sequence = data.get('sequence')
        if sequence:
            # Store the client sequence
            update_player_session(self.room_code, self.player_id, {'client_sequence': sequence})
            
            # Send acknowledgment
            await self.send(text_data=json.dumps({
                'type': 'prediction_ack',
                'sequence': sequence,
                'server_time': time.time() * 1000,
            }))

    async def handle_join_game(self, data):
        """Handle player joining the game"""
        try:
            player_id = data.get('player_id')
            username = data.get('username')

            logger.info(f"WebSocket join game request from player_id={player_id}, username={username}")

            if not player_id:
                user_info = await self.authenticate_user()
                if user_info:
                    player_id = user_info['user_id']
                    username = user_info['username']
                    logger.info(f"Got authenticated user: {player_id}, {username}")
                else:
                    player_id = f"guest-{random.randint(1000, 9999)}"
                    username = f"Guest-{random.randint(1000, 9999)}"
                    logger.info(f"Created guest user: {player_id}, {username}")

            self.player_id = player_id
            self.username = username

            # Get or create game state
            game = get_game_state(self.room_code)
            if not game:
                logger.warning(f"Game state not found for room {self.room_code}, creating new one")
                game = create_game_state(self.room_code)
                if not game:
                    logger.error(f"Failed to create game state for room {self.room_code}")
                    await self.send_error("Failed to create game")
                    return

            # First check if we already have a player session
            session = None
            
            try:
                session = await self.sync_to_async(PlayerSession.objects.get)(
                    room_code=self.room_code, 
                    player_id=player_id
                )
                # We have an existing session, use that player number
                logger.info(f"Found existing session for {player_id} in room {self.room_code} with player number {session.player_number}")
                self.player_number = session.player_number
                
                # Update connection status AND token
                if self.token:
                    session.token = self.token
                    await self.sync_to_async(session.save)(update_fields=['connected', 'token'])
                else:
                    await self.sync_to_async(session.save)(update_fields=['connected'])
                
            except Exception as e:
                # No existing session, assign new player number
                logger.info(f"No existing session for {player_id} in room {self.room_code}, assigning new player number")
                # Use the assign_player_number function
                self.player_number = assign_player_number(self.room_code, player_id, username)
                
                # Store the token explicitly here too
                if self.token and self.player_number:
                    update_player_session(self.room_code, player_id, {
                        'token': self.token,
                        'connected': True
                    })
            
            # Verify that the assignment is consistent
            if self.player_number == 1 and game.get('player_1_id') != player_id:
                logger.warning(f"Inconsistency: player {player_id} assigned as player 1 but game state has player_1_id={game.get('player_1_id')}")
                game['player_1_id'] = player_id
                save_game_state(game)
            elif self.player_number == 2 and game.get('player_2_id') != player_id:
                logger.warning(f"Inconsistency: player {player_id} assigned as player 2 but game state has player_2_id={game.get('player_2_id')}")
                game['player_2_id'] = player_id
                save_game_state(game)
            
            if self.player_number is not None:
                # Notify others about the player joining
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'player_joined',
                        'player_number': self.player_number,
                        'player_id': self.player_id,
                        'username': self.username
                    }
                )

                # Send full game state to the player
                await self.send_full_game_state(game)

                # Start game loop if both players are connected and game is not finished
                if (game['player_1_id'] and game['player_2_id'] and 
                    game['status'] != 'FINISHED' and not self.game_loop_task):
                    
                    # Update game status
                    game['status'] = 'ONGOING'
                    save_game_state(game)
                    
                    # Start the game loop
                    self.game_loop_task = asyncio.create_task(self.game_loop())
            else:
                logger.error(f"Failed to assign player number for {player_id} in room {self.room_code}")
                await self.send_error("Failed to join game: could not assign player number")
        except Exception as e:
            logger.exception(f"Error in handle_join_game: {str(e)}")
            await self.send_error(f"Failed to join game: {str(e)}")

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

        game = get_game_state(self.room_code)
        if not game:
            return

        # Update the appropriate movement flags
        updates = {}
        if self.player_number == 1:
            if key in ('w', 'arrowup'):
                updates['player_1_moving_up'] = is_down
            elif key in ('s', 'arrowdown'):
                updates['player_1_moving_down'] = is_down
        elif self.player_number == 2:
            if key in ('w', 'arrowup'):
                updates['player_2_moving_up'] = is_down
            elif key in ('s', 'arrowdown'):
                updates['player_2_moving_down'] = is_down

        if updates:
            update_game_state(self.room_code, updates)

        # Acknowledge the input
        if sequence > 0:
            await self.send(text_data=json.dumps({
                'type': 'input_ack',
                'sequence': sequence,
                'server_time': time.time() * 1000
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

        # Basic validation - player can only update their own paddle
        if player_number != self.player_number:
            return

        game = get_game_state(self.room_code)
        if not game:
            return

        # Validate the position is within bounds
        if position < 0:
            position = 0
        elif position > game['canvas_height'] - game['paddle_height']:
            position = game['canvas_height'] - game['paddle_height']

        # Ball collision check for server authority
        force_reconcile = False
        ball_radius = game['ball_size'] / 2

        # Check if paddle is involved in ball collision
        # - For player 1 (left paddle)
        if (player_number == 1 and
            game['ball_x'] - ball_radius <= game['paddle_width'] + 5 and
            game['ball_x'] > 0 and game['ball_speed_x'] < 0):
            
            # We're near a potential ball collision - server needs authority
            force_reconcile = True

        # - For player 2 (right paddle)
        elif (player_number == 2 and
            game['ball_x'] + ball_radius >= game['canvas_width'] - game['paddle_width'] - 5 and
            game['ball_x'] < game['canvas_width'] and game['ball_speed_x'] > 0):
            
            # We're near a potential ball collision - server needs authority
            force_reconcile = True

        # Update the position in game state
        if player_number == 1:
            update_game_state(self.room_code, {
                'player_1_paddle_y': position,
                'force_reconcile_p1': force_reconcile
            })
        elif player_number == 2:
            update_game_state(self.room_code, {
                'player_2_paddle_y': position,
                'force_reconcile_p2': force_reconcile
            })

        # Always send acknowledgment to client
        if sequence > 0:
            await self.send(text_data=json.dumps({
                'type': 'input_ack',
                'sequence': sequence,
                'server_time': time.time() * 1000,
                'position': position,
                'force_reconcile': force_reconcile
            }))

    async def handle_pause_game(self, data):
        """Handle game pause request"""
        if not self.player_number:
            return

        game = get_game_state(self.room_code)
        if not game:
            return

        # Update game state
        update_game_state(self.room_code, {'is_paused': True})

        # Notify all clients
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

        game = get_game_state(self.room_code)
        if not game:
            return

        # Get ball speeds from request
        ball_speed_x = data.get('ball_speed_x', None)
        ball_speed_y = data.get('ball_speed_y', None)

        # Prepare updates
        updates = {'is_paused': False}
        
        if ball_speed_x is not None and ball_speed_y is not None:
            updates['ball_speed_x'] = ball_speed_x
            updates['ball_speed_y'] = ball_speed_y
        elif game['ball_speed_x'] == 0 and game['ball_speed_y'] == 0:
            # Generate default speeds if none provided
            sign_x = 1 if random.random() > 0.5 else -1
            sign_y = 1 if random.random() > 0.5 else -1
            updates['ball_speed_x'] = sign_x * 5
            updates['ball_speed_y'] = sign_y * 5

        # Update game state
        update_game_state(self.room_code, updates)
        
        # Get updated game for notification
        game = get_game_state(self.room_code)

        # Notify all clients
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_resumed',
                'player_number': self.player_number,
                'ball_speed_x': game['ball_speed_x'],
                'ball_speed_y': game['ball_speed_y']
            }
        )

    async def game_loop(self):
        """Main game loop with optimized networking"""
        try:
            frame_duration = 1 / SERVER_UPDATE_RATE

            while True:
                loop_start = time.time()

                game = get_game_state(self.room_code)
                if not game or game['status'] == 'FINISHED':
                    break

                changed = False
                
                if not game['is_paused']:
                    # Update physics and check for scores
                    scorer = update_game_physics(self.room_code)
                    changed = True

                    if scorer > 0:
                        # Refresh game state after score
                        game = get_game_state(self.room_code)
                        
                        # Notify about goal
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'goal_scored',
                                'scorer': scorer,
                                'player_1_score': game['player_1_score'],
                                'player_2_score': game['player_2_score'],
                                'timestamp': time.time() * 1000
                            }
                        )

                    # Check for winner
                    winner = check_for_winner(self.room_code)
                    if winner > 0:
                        # Mark game as finished
                        update_game_state(self.room_code, {'status': 'FINISHED'})
                        
                        # Refresh game state
                        game = get_game_state(self.room_code)
                        
                        # Notify about game over
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'game_over',
                                'winner': winner,
                                'player_1_score': game['player_1_score'],
                                'player_2_score': game['player_2_score'],
                                'timestamp': time.time() * 1000
                            }
                        )
                        
                        # Record the game result
                        record_game_history(self.room_code)
                        break

                # Send state update if needed
                if changed or self.last_sent_state is None:
                    # Always fetch fresh state
                    game = get_game_state(self.room_code)
                    new_state = game.copy()
                    new_state['type'] = 'game_state'
                    
                    if self.last_sent_state:
                        delta = calculate_state_delta(self.last_sent_state, new_state)

                        if len(delta) > 2:  # Only send if there are actual changes
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
                        # First state update
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

                # Sleep to maintain frame rate
                elapsed = time.time() - loop_start
                sleep_time = max(0, frame_duration - elapsed)
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            pass

    async def send_full_game_state(self, game):
        """Send full game state to the client"""
        state_dict = game.copy()
        state_dict['type'] = 'game_state'
        
        # Include the player number in the game state for the client to update if needed
        if self.player_number is not None:
            state_dict['player_number'] = self.player_number
        
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