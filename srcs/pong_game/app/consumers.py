import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import GameState

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group_name = f'game_{self.room_code}'
        
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        self.game_loop_task = asyncio.create_task(self.game_loop())

    async def disconnect(self, close_code):
        if hasattr(self, 'game_loop_task'):
            self.game_loop_task.cancel()
            try:
                await self.game_loop_task
            except asyncio.CancelledError:
                pass

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        event_type = data.get('event_type')
        event_data = data.get('data', {})

        if event_type == 'key_event':
            room_code = event_data.get('room_code')
            player_nb = event_data.get('player_nb')
            key = event_data.get('key')
            action = event_data.get('action')

            if not all([room_code, player_nb, key, action]):
                return

            game = await self.get_game_state()
            if not game:
                return

            if player_nb == 1:
                if key.lower() == 'w':
                    game.player_1_moving_up = action == 'keydown'
                elif key.lower() == 's':
                    game.player_1_moving_down = action == 'keydown'
            elif player_nb == 2:
                if key == 'ArrowUp':
                    game.player_2_moving_up = action == 'keydown'
                elif key == 'ArrowDown':
                    game.player_2_moving_down = action == 'keydown'
            
            await self.save_game_state(game)

    async def game_loop(self):
        try:
            while True:
                game = await self.get_game_state()
                if game and not game.is_paused:
                    paddle_speed = 10

                    if game.player_1_moving_up:
                        game.player_1_paddle_y = max(0, game.player_1_paddle_y - paddle_speed)
                    if game.player_1_moving_down:
                        game.player_1_paddle_y = min(game.canvas_height - 100, game.player_1_paddle_y + paddle_speed)
                    if game.player_2_moving_up:
                        game.player_2_paddle_y = max(0, game.player_2_paddle_y - paddle_speed)
                    if game.player_2_moving_down:
                        game.player_2_paddle_y = min(game.canvas_height - 100, game.player_2_paddle_y + paddle_speed)

                    game.ball_x += game.ball_dx
                    game.ball_y += game.ball_dy

                    if game.ball_y <= 0 or game.ball_y >= game.canvas_height:
                        game.ball_dy *= -1

                    await self.save_game_state(game)
                    await self.broadcast_game_state(game)
                
                await asyncio.sleep(0.0167)
        except asyncio.CancelledError:
            pass

    async def broadcast_game_state(self, game):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_event',
                'event_type': 'game_state',
                'data': {
                    'canvas_width': game.canvas_width,
                    'canvas_height': game.canvas_height,
                    'ball_x': game.ball_x,
                    'ball_y': game.ball_y,
                    'player_1_paddle_y': game.player_1_paddle_y,
                    'player_2_paddle_y': game.player_2_paddle_y,
                    'player_1_score': game.player_1_score,
                    'player_2_score': game.player_2_score,
                }
            }
        )

    async def game_event(self, event):
        await self.send(text_data=json.dumps({
            'event_type': event['event_type'],
            'data': event['data']
        }))

    @database_sync_to_async
    def get_game_state(self):
        try:
            return GameState.objects.get(room_code=self.room_code)
        except GameState.DoesNotExist:
            return None

    @database_sync_to_async
    def save_game_state(self, game):
        game.save()