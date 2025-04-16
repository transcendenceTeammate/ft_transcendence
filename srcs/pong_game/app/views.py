from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .game.manager import GameManager
import logging
import jwt
from django.conf import settings
import random

# Set up logging
logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def create_room(request):
    """
    Creates a new game room with a unique code and joins the creator as player 1.
    """
    logger.info("Create room request received")

    try:
        # Check for explicit username in request body
        requested_username = None
        try:
            data = json.loads(request.body)
            requested_username = data.get('username')
            if requested_username:
                logger.info(f"Username provided in request body: {requested_username}")
        except Exception as e:
            logger.warning(f"Could not parse request body: {str(e)}")

        user_id = None
        username = None
        auth_header = request.headers.get('Authorization')

        logger.info(f"Auth header: {auth_header}")

        # Try to get username from JWT token
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user_id = str(payload.get('user_id'))
                logger.info(f"Decoded token payload: {payload}")
                username = payload.get('username')
                logger.info(f"Extracted user_id from token: {user_id}, username: {username}")
            except Exception as e:
                logger.error(f"Error decoding token: {str(e)}")

        # If username was provided in request body, use it instead of JWT username
        if requested_username:
            username = requested_username
            logger.info(f"Using username from request body: {username}")

        # Fallback for guests
        if not user_id:
            user_id = f"guest-{random.randint(1000, 9999)}"
            # Only use default guest username if no username was provided
            if not username:
                username = f"Guest-{user_id.split('-')[1]}"
            logger.warning(f"Using generated user_id: {user_id}, username: {username}")

        # Create new game with generated room code
        room_code = GameManager.generate_room_code()
        logger.info(f"Generated room code: {room_code}")

        game = GameManager.create_game(room_code)
        game.player_1_id = user_id
        # Store username in game state
        game.player_1_username = username
        GameManager.save_game(game)

        # Add player session
        GameManager.add_player_session(room_code, user_id, 1, username)

        logger.info(f"Created game room: {room_code}, player_1_id: {game.player_1_id}, username: {username}")

        response_data = {
            'success': True,
            'room_code': room_code,
            'player_number': 1,
            'player_id': user_id,
            'username': username,
            'game_state': game.to_dict()
        }

        return JsonResponse(response_data)
    except Exception as e:
        logger.exception(f"Error creating room: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def join_room(request):
    """
    Validates a room code and allows a player to join if the room exists and isn't full.
    """
    try:
        data = json.loads(request.body)
        room_code = data.get('room_code')

        if not room_code:
            return JsonResponse({
                'success': False,
                'error': 'Room code is required'
            }, status=400)

        # Check for explicit username in request body
        requested_username = data.get('username')
        if requested_username:
            logger.info(f"Username provided in request body: {requested_username}")
            
        user_id = None
        username = None
        auth_header = request.headers.get('Authorization')

        logger.info(f"Auth header: {auth_header}")

        # Try to get username from JWT token
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                logger.info(f"Decoded token payload: {payload}")
                user_id = str(payload.get('user_id'))
                username = payload.get('username')
                logger.info(f"Join room - extracted user_id from token: {user_id}, username: {username}")
            except Exception as e:
                logger.error(f"Join room - error decoding token: {str(e)}")

        # If username was provided in request body, use it instead of JWT username
        if requested_username:
            username = requested_username
            logger.info(f"Using username from request body: {username}")

        # Fallback for guests
        if not user_id:
            user_id = f"guest-{random.randint(1000, 9999)}"
            # Only use default guest username if no username was provided
            if not username:
                username = f"Guest-{user_id.split('-')[1]}"
            logger.warning(f"Join room - using generated user_id: {user_id}, username: {username}")

        # Check if room exists
        game = GameManager.get_game(room_code)
        if not game:
            return JsonResponse({
                'success': False,
                'error': 'Room not found'
            }, status=404)

        if game.status == 'FINISHED':
            return JsonResponse({
                'success': False,
                'error': 'Game has already ended'
            }, status=400)

        # Check if room is full or player is rejoining
        if game.player_1_id and game.player_2_id:
            if user_id in [game.player_1_id, game.player_2_id]:
                player_number = 2 if user_id == game.player_2_id else 1

                # Store the username in the game state for rejoining players
                if player_number == 1:
                    game.player_1_username = username
                else:
                    game.player_2_username = username
                
                GameManager.save_game(game)

                # Update player session for reconnection
                session = GameManager.get_player_session(room_code, user_id)
                if session:
                    GameManager.update_player_session(room_code, user_id, connected=True)
                else:
                    GameManager.add_player_session(room_code, user_id, player_number, username)

                return JsonResponse({
                    'success': True,
                    'room_code': room_code,
                    'player_number': player_number,
                    'player_id': user_id,
                    'username': username,
                    'reconnecting': True,
                    'game_state': game.to_dict()
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Room is full'
                }, status=400)

        # Assign player number
        player_number = 1 if not game.player_1_id else 2

        # Update game state
        if player_number == 1:
            game.player_1_id = user_id
            game.player_1_username = username
        else:
            game.player_2_id = user_id
            game.player_2_username = username
            if game.status == 'WAITING':
                game.status = 'ONGOING'

        GameManager.save_game(game)

        # Add player session
        GameManager.add_player_session(room_code, user_id, player_number, username)

        logger.info(f"Player {player_number} joined room {room_code}: {user_id}, username: {username}")

        return JsonResponse({
            'success': True,
            'room_code': room_code,
            'player_number': player_number,
            'player_id': user_id,
            'username': username,
            'game_state': game.to_dict()
        })
    except Exception as e:
        logger.exception(f"Error joining room: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def check_room(request, room_code):
    """
    Checks if a room exists and returns its status.
    """
    logger.info(f"Checking room {room_code}")

    try:
        # Get game from manager
        game = GameManager.get_game(room_code)
        if not game:
            logger.warning(f"Room {room_code} not found")
            return JsonResponse({
                'success': False,
                'error': 'Room not found'
            }, status=404)

        # Count players
        player_count = (
            (1 if game.player_1_id else 0) +
            (1 if game.player_2_id else 0)
        )

        # Count active sessions (connected players)
        active_sessions = 0
        if game.player_1_id:
            session = GameManager.get_player_session(room_code, game.player_1_id)
            if session and session.connected:
                active_sessions += 1
                
        if game.player_2_id:
            session = GameManager.get_player_session(room_code, game.player_2_id)
            if session and session.connected:
                active_sessions += 1

        logger.info(f"Room {room_code} status: {game.status}, player_count: {player_count}, active_sessions: {active_sessions}")
        logger.info(f"Player 1 ID: {game.player_1_id}, Player 2 ID: {game.player_2_id}")

        return JsonResponse({
            'success': True,
            'room_code': room_code,
            'status': game.status,
            'player_count': player_count,
            'active_sessions': active_sessions,
            'player_1_id': game.player_1_id,
            'player_2_id': game.player_2_id,
            'is_paused': game.is_paused,
            'created_at': game.created_at
        })
    except Exception as e:
        logger.exception(f"Error checking room {room_code}: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)