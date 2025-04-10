from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .models import GameState, PlayerSession
from .utils import generate_room_code, game_state_to_dict
import logging
import jwt
from django.conf import settings

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
        user_id = None
        username = None
        auth_header = request.headers.get('Authorization')

        logger.info(f"Auth header: {auth_header}")

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

        if not user_id:
            user_id = f"guest-{generate_room_code(4)}"
            username = f"Guest-{user_id.split('-')[1]}"
            logger.warning(f"Using default user_id: {user_id}, username: {username}")

        room_code = generate_room_code()
        logger.info(f"Generated room code: {room_code}")

        game_state = GameState.objects.create(
            room_code=room_code,
            status='WAITING',
            is_paused=True,
            player_1_id=user_id
        )

        PlayerSession.objects.create(
            room_code=room_code,
            player_id=user_id,
            player_number=1,
            username=username,
            connected=True
        )

        game_state.refresh_from_db()
        logger.info(f"Created game state with ID: {game_state.id}, player_1_id: {game_state.player_1_id}")

        response_data = {
            'success': True,
            'room_code': room_code,
            'player_number': 1,
            'player_id': user_id,
            'username': username,
            'game_state': game_state_to_dict(game_state)
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

        user_id = None
        username = None
        auth_header = request.headers.get('Authorization')

        logger.info(f"Auth header: {auth_header}")

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                logger.info(f"Decoded token payload: {payload}")
                user_id = str(payload.get('user_id'))
                username = payload.get('username')
                logger.info(f"Join room - extracted user_id from token: {user_id}")
            except Exception as e:
                logger.error(f"Join room - error decoding token: {str(e)}")

        if not user_id:
            user_id = f"guest-{generate_room_code(4)}"
            username = f"Guest-{user_id.split('-')[1]}"
            logger.warning(f"Join room - using default user_id: {user_id}")

        try:
            game_state = GameState.objects.get(room_code=room_code)
        except GameState.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Room not found'
            }, status=404)

        if game_state.status == 'FINISHED':
            return JsonResponse({
                'success': False,
                'error': 'Game has already ended'
            }, status=400)

        if game_state.player_1_id and game_state.player_2_id:
            if user_id in [game_state.player_1_id, game_state.player_2_id]:
                player_number = 2 if user_id == game_state.player_2_id else 1

                player_session, created = PlayerSession.objects.get_or_create(
                    room_code=room_code,
                    player_id=user_id,
                    defaults={
                        'player_number': player_number,
                        'username': username,
                        'connected': True
                    }
                )

                if not created:
                    player_session.connected = True
                    player_session.save()

                return JsonResponse({
                    'success': True,
                    'room_code': room_code,
                    'player_number': player_number,
                    'player_id': user_id,
                    'username': username,
                    'reconnecting': True,
                    'game_state': game_state_to_dict(game_state)
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Room is full'
                }, status=400)

        player_number = 1 if not game_state.player_1_id else 2

        if player_number == 1:
            game_state.player_1_id = user_id
        else:
            game_state.player_2_id = user_id
            if game_state.status == 'WAITING':
                game_state.status = 'ONGOING'

        game_state.save()

        PlayerSession.objects.create(
            room_code=room_code,
            player_id=user_id,
            player_number=player_number,
            username=username,
            connected=True
        )

        return JsonResponse({
            'success': True,
            'room_code': room_code,
            'player_number': player_number,
            'player_id': user_id,
            'username': username,
            'game_state': game_state_to_dict(game_state)
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
        try:
            game_state = GameState.objects.get(room_code=room_code)
        except GameState.DoesNotExist:
            logger.warning(f"Room {room_code} not found")
            return JsonResponse({
                'success': False,
                'error': 'Room not found'
            }, status=404)

        player_count = (
            (1 if game_state.player_1_id else 0) +
            (1 if game_state.player_2_id else 0)
        )

        active_sessions = PlayerSession.objects.filter(
            room_code=room_code,
            connected=True
        ).count()

        logger.info(f"Room {room_code} status: {game_state.status}, player_count: {player_count}, active_sessions: {active_sessions}")
        logger.info(f"Player 1 ID: {game_state.player_1_id}, Player 2 ID: {game_state.player_2_id}")

        return JsonResponse({
            'success': True,
            'room_code': room_code,
            'status': game_state.status,
            'player_count': player_count,
            'active_sessions': active_sessions,
            'player_1_id': game_state.player_1_id,
            'player_2_id': game_state.player_2_id,
            'is_paused': game_state.is_paused,
            'created_at': game_state.created_at.isoformat()
        })
    except Exception as e:
        logger.exception(f"Error checking room {room_code}: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)