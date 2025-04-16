# In-Memory Pong Game Service

This service implements a real-time multiplayer Pong game using Django Channels for WebSocket communication. The implementation uses in-memory storage instead of a database to optimize for performance.

## Architecture

- **In-Memory Storage**: All game state is stored in memory for optimal performance
- **WebSocket Communication**: Real-time gameplay using Django Channels
- **Redis**: Optional caching layer for state synchronization between instances
- **API Integration**: Game history is stored in the user_management service via API calls

## Key Components

- **GameState**: In-memory model for game state (`app/game/state.py`)
- **PlayerSession**: In-memory model for player sessions (`app/game/player.py`)
- **GameManager**: Centralized manager for all game instances (`app/game/manager.py`)
- **GameConsumer**: WebSocket consumer for real-time game communication (`app/consumers/game.py`)

## Performance Optimizations

1. **No Database Queries**: All game state is stored in memory, eliminating database round-trips
2. **Reduced Update Rate**: Server update rate reduced from 120Hz to 30Hz
3. **Simplified Interpolation**: Basic paddle interpolation for smooth visuals
4. **Delta Compression**: Only send changed game state values to minimize bandwidth
5. **Server Authority**: Server fully controls ball physics for consistency

## Game History Storage

When a game finishes, the result is sent to the user_management service via an API call:

```python
async def record_game_result(game):
    """Send game result to user_management service"""
    if game.status != 'FINISHED':
        return
    
    try:
        # Prepare game result data
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
        
        # Send to user_management API
        async with aiohttp.ClientSession() as session:
            url = f"{settings.USER_MANAGEMENT_URL}/api/games/"
            headers = {'Content-Type': 'application/json'}
            
            if hasattr(settings, 'API_KEY'):
                headers['Authorization'] = f"Api-Key {settings.API_KEY}"
            
            async with session.post(url, json=game_data, headers=headers) as response:
                if response.status != 201:
                    logger.error(f"Failed to record game result: {await response.text()}")
                else:
                    logger.info(f"Game result recorded successfully for {game.room_code}")
    except Exception as e:
        logger.error(f"Error recording game result: {str(e)}")
```

## API Endpoints

- `POST /api/room/create/`: Create a new game room
- `POST /api/room/join/`: Join an existing game room
- `GET /api/room/check/<room_code>/`: Check status of a game room

## WebSocket Endpoints

- `ws/game/<room_code>/`: WebSocket connection for gameplay
