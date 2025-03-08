import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import GameState
from .utils import game_state_to_dict, calculate_ball_trajectory

logger = logging.getLogger(__name__)

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group_name = f'game_{self.room_code}'
        
        self.player_number = None
        self.game_loop_task = None
        self.last_activity = timezone.now()
        
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        
        await self.accept()
        
        game = await self.get_game_state()
        if game:
            await self.send_game_state(game)
        else:
            await self.send_error("Game not found")

    async def disconnect(self, close_code):
        if self.game_loop_task:
            self.game_loop_task.cancel()
            try:
                await self.game_loop_task
            except asyncio.CancelledError:
                pass
        
        if self.player_number:
            game = await self.get_game_state()
            if game:
                if not game.is_paused:
                    game.is_paused = True
                    await self.save_game_state(game)
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_event',
                        'event_type': 'player_disconnected',
                        'data': {'player_number': self.player_number}
                    }
                )
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            event_type = data.get('event_type')
            event_data = data.get('data', {})
            
            self.last_activity = timezone.now()
            
            if event_type == 'join_game':
                await self.handle_join_game(event_data)
            elif event_type == 'key_event':
                await self.handle_key_event(event_data)
            elif event_type == 'start_game':
                await self.handle_start_game(event_data)
            elif event_type == 'pause_game':
                await self.handle_pause_game(event_data)
            elif event_type == 'resume_game':
                await self.handle_resume_game(event_data)
            else:
                await self.send_error(f"Unknown event type: {event_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.exception("Error in receive method")
            await self.send_error(f"Internal server error: {str(e)}")

    async def handle_join_game(self, data):
        player_id = data.get('player_id')
        if not player_id:
            await self.send_error("Player ID is required")
            return
        
        game = await self.get_game_state()
        if not game:
            await self.send_error("Game not found")
            return
        
        if game.player_1_id == player_id:
            self.player_number = 1
        elif game.player_2_id == player_id:
            self.player_number = 2
        elif not game.player_1_id:
            game.player_1_id = player_id
            self.player_number = 1
            await self.save_game_state(game)
        elif not game.player_2_id:
            game.player_2_id = player_id
            game.status = 'WAITING'
            self.player_number = 2
            await self.save_game_state(game)
        else:
            await self.send_error("Game is full")
            return
        
        await self.send_json({
            'event_type': 'join_success',
            'data': {
                'player_number': self.player_number,
                'player_id': player_id
            }
        })
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_event',
                'event_type': 'player_joined',
                'data': {
                    'player_number': self.player_number,
                    'player_id': player_id
                }
            }
        )
        
        if game.player_1_id and game.player_2_id and game.status == 'WAITING':
            game.status = 'ONGOING'
            await self.save_game_state(game)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_event',
                    'event_type': 'game_ready',
                    'data': game_state_to_dict(game)
                }
            )
            
            if self.player_number == 1 and not self.game_loop_task:
                self.game_loop_task = asyncio.create_task(self.game_loop())

    async def handle_key_event(self, data):
        key = data.get('key')
        action = data.get('action')  # 'keydown' ou 'keyup'
        
        if not all([key, action]) or not self.player_number:
            await self.send_error("Invalid key event data or player not joined")
            return
        
        game = await self.get_game_state()
        if not game:
            await self.send_error("Game not found")
            return
        
        # Mettre à jour l'état du jeu en fonction de la touche
        if self.player_number == 1:
            if key.lower() == 'w':
                game.player_1_moving_up = action == 'keydown'
            elif key.lower() == 's':
                game.player_1_moving_down = action == 'keydown'
        elif self.player_number == 2:
            if key.lower() == 'arrowup':
                game.player_2_moving_up = action == 'keydown'
            elif key.lower() == 'arrowdown':
                game.player_2_moving_down = action == 'keydown'
        
        await self.save_game_state(game)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_event',
                'event_type': 'key_event',
                'data': {
                    'player_number': self.player_number,
                    'key': key,
                    'action': action
                }
            }
        )

    async def handle_start_game(self, data):
        if not self.player_number:
            await self.send_error("Player not joined")
            return
            
        game = await self.get_game_state()
        if not game:
            await self.send_error("Game not found")
            return
        
        if not game.player_1_id or not game.player_2_id:
            await self.send_error("Both players must be connected to start the game")
            return
        
        # Démarrer le jeu
        game.status = 'ONGOING'
        game.is_paused = False
        game.reset_ball()
        game.start_ball()
        await self.save_game_state(game)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_event',
                'event_type': 'game_started',
                'data': game_state_to_dict(game)
            }
        )

    async def handle_pause_game(self, data):
        if not self.player_number:
            await self.send_error("Player not joined")
            return
            
        game = await self.get_game_state()
        if not game:
            await self.send_error("Game not found")
            return
        
        game.is_paused = True
        await self.save_game_state(game)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_event',
                'event_type': 'game_paused',
                'data': {'paused_by': self.player_number}
            }
        )

    async def handle_resume_game(self, data):
        if not self.player_number:
            await self.send_error("Player not joined")
            return
            
        game = await self.get_game_state()
        if not game:
            await self.send_error("Game not found")
            return
        
        game.is_paused = False
        
        if game.ball_x == game.canvas_width // 2 and game.ball_y == game.canvas_height // 2:
            direction = 1 if game.player_2_score > game.player_1_score else -1
            game.start_ball(direction)
        
        await self.save_game_state(game)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_event',
                'event_type': 'game_resumed',
                'data': {'resumed_by': self.player_number}
            }
        )

    async def game_loop(self):
        try:
            while True:
                game = await self.get_game_state()
                if not game:
                    break
                
                if game.status == 'ONGOING' and not game.is_paused:
                    goal_scored = game.update_game_state()
                    
                    await self.save_game_state(game)
                    
                    await self.broadcast_game_state(game)
                    
                    if goal_scored > 0:
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'game_event',
                                'event_type': 'goal_scored',
                                'data': {
                                    'scorer': goal_scored,
                                    'player_1_score': game.player_1_score,
                                    'player_2_score': game.player_2_score
                                }
                            }
                        )
                
                await asyncio.sleep(0.0167)  # ~60Hz
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.exception("Error in game loop")

    async def broadcast_game_state(self, game):
        game_dict = game_state_to_dict(game)
        
        if not game.is_paused:
            trajectory = calculate_ball_trajectory(game)
            game_dict['ball_trajectory'] = trajectory
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_event',
                'event_type': 'game_state',
                'data': game_dict
            }
        )

    async def game_event(self, event):
        await self.send_json({
            'event_type': event['event_type'],
            'data': event['data']
        })

    async def send_game_state(self, game):
        await self.send_json({
            'event_type': 'game_state',
            'data': game_state_to_dict(game)
        })

    async def send_error(self, message):
        await self.send_json({
            'event_type': 'error',
            'data': {'message': message}
        })

    async def send_json(self, data):
        await self.send(text_data=json.dumps(data))