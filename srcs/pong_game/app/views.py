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

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user_id = str(payload.get('user_id'))
            except Exception as e:
                logger.error(f"Error decoding token: {str(e)}")

        if requested_username:
            username = requested_username
            logger.info(f"Using username from request body: {username}")

        room_code = GameManager.generate_room_code()
        logger.info(f"Generated room code: {room_code}")

        game = GameManager.create_game(room_code)
        game.player_1_id = user_id
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

        requested_username = data.get('username')
        if requested_username:
            logger.info(f"Username provided in request body: {requested_username}")
            
        user_id = None
        username = None
        auth_header = request.headers.get('Authorization')

        logger.info(f"Auth header: {auth_header}")

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user_id = str(payload.get('user_id'))
            except Exception as e:
                logger.error(f"Join room - error decoding token: {str(e)}")

        if requested_username:
            username = requested_username

        game = GameManager.get_game(room_code)
        
        if user_id == game.player_1_id:
            return JsonResponse({
                'success': False,
                'error': 'You are already in this game'
            }, status=400)  
        
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

        if game.player_1_id and game.player_2_id:
            if user_id in [game.player_1_id, game.player_2_id]:
                player_number = 2 if user_id == game.player_2_id else 1

                if player_number == 1:
                    game.player_1_username = username
                else:
                    game.player_2_username = username
                
                GameManager.save_game(game)

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

        player_number = 1 if not game.player_1_id else 2

        if player_number == 1:
            game.player_1_id = user_id
            game.player_1_username = username
        else:
            game.player_2_id = user_id
            game.player_2_username = username
            if game.status == 'WAITING':
                game.status = 'ONGOING'

        GameManager.save_game(game)

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
        game = GameManager.get_game(room_code)
        if not game:
            logger.warning(f"Room {room_code} not found")
            return JsonResponse({
                'success': False,
                'error': 'Room not found'
            }, status=404)

        player_count = (
            (1 if game.player_1_id else 0) +
            (1 if game.player_2_id else 0)
        )

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

@csrf_exempt
@require_http_methods(["POST"])
def cancel_room(request):
    """
    Cancels a game room when a player decides to close the waiting modal.
    """
    logger.info("Cancel room request received")

    try:
        data = json.loads(request.body)
        room_code = data.get('room_code')

        if not room_code:
            return JsonResponse({
                'success': False,
                'error': 'Room code is required'
            }, status=400)

        user_id = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user_id = str(payload.get('user_id'))
                logger.info(f"Extracted user_id from token: {user_id}")
            except Exception as e:
                logger.error(f"Error decoding token: {str(e)}")

        game = GameManager.get_game(room_code)
        if not game:
            logger.warning(f"Room {room_code} not found for cancellation")
            return JsonResponse({
                'success': False,
                'error': 'Room not found'
            }, status=404)

        if user_id and game.player_1_id and user_id != game.player_1_id:
            logger.warning(f"User {user_id} is not authorized to cancel room {room_code}")
            return JsonResponse({
                'success': False,
                'error': 'Only the room creator can cancel the room'
            }, status=403)

        if game.status != 'WAITING' or game.player_2_id:
            logger.warning(f"Cannot cancel room {room_code}: game already in progress or has both players")
            return JsonResponse({
                'success': False,
                'error': 'Cannot cancel: game already in progress or has both players'
            }, status=400)

        logger.info(f"Canceling room {room_code}")
        GameManager.delete_game(room_code)

        return JsonResponse({
            'success': True,
            'message': f'Room {room_code} has been canceled'
        })
    except Exception as e:
        logger.exception(f"Error canceling room: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)