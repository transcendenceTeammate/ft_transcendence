from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .models import GameState, PlayerSession
from .utils import generate_room_code, game_state_to_dict, get_username_from_api
import logging
import jwt
from django.conf import settings
from django.db import transaction

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
        auth_token = None
        auth_header = request.headers.get('Authorization')

        logger.info(f"Auth header: {auth_header}")

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            auth_token = token
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user_id = str(payload.get('user_id'))
                logger.info(f"Decoded token payload: {payload}")
                username = payload.get('username')
                
                # Fetch username from API if not in token
                if user_id and not username:
                    logger.info(f"Username not in token, fetching from API for user_id: {user_id}")
                    username = get_username_from_api(user_id, auth_token)
                    
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
        auth_token = None
        auth_header = request.headers.get('Authorization')

        logger.info(f"Join room request for {room_code}")

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            auth_token = token
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                logger.info(f"Decoded token payload: {payload}")
                user_id = str(payload.get('user_id'))
                username = payload.get('username')
                
                # Fetch username from API if not in token
                if user_id and not username:
                    logger.info(f"Username not in token, fetching from API for user_id: {user_id}")
                    username = get_username_from_api(user_id, auth_token)
                    
                logger.info(f"Join room - extracted user_id from token: {user_id}, username: {username}")
            except Exception as e:
                logger.error(f"Join room - error decoding token: {str(e)}")

        if not user_id:
            user_id = f"guest-{generate_room_code(4)}"
            username = f"Guest-{user_id.split('-')[1]}"
            logger.warning(f"Join room - using default user_id: {user_id}")

        # Use a database transaction to prevent race conditions
        with transaction.atomic():
            try:
                game_state = GameState.objects.select_for_update().get(room_code=room_code)
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

            # Check for existing player session first
            existing_session = PlayerSession.objects.filter(
                room_code=room_code,
                player_id=user_id
            ).first()

            if existing_session:
                # Player is rejoining - update only connection status
                existing_session.connected = True
                # DON'T update token
                existing_session.save(update_fields=['connected'])
                
                logger.info(f"Player {user_id} rejoining as player {existing_session.player_number}")
                
                # Ensure consistency between session and game state
                if existing_session.player_number == 1 and game_state.player_1_id != user_id:
                    game_state.player_1_id = user_id
                    game_state.save(update_fields=['player_1_id'])
                elif existing_session.player_number == 2 and game_state.player_2_id != user_id:
                    game_state.player_2_id = user_id
                    game_state.save(update_fields=['player_2_id'])
                
                return JsonResponse({
                    'success': True,
                    'room_code': room_code,
                    'player_number': existing_session.player_number,
                    'player_id': user_id,
                    'username': existing_session.username,
                    'reconnecting': True,
                    'game_state': game_state_to_dict(game_state)
                })

            # Room has both players and this is a new player
            if game_state.player_1_id and game_state.player_2_id and user_id not in [game_state.player_1_id, game_state.player_2_id]:
                return JsonResponse({
                    'success': False,
                    'error': 'Room is full'
                }, status=400)

            # Determine player number
            player_number = None
            
            # If player is already in game_state but doesn't have a session
            if user_id == game_state.player_1_id:
                player_number = 1
            elif user_id == game_state.player_2_id:
                player_number = 2
            # Assign new player number
            elif not game_state.player_1_id:
                player_number = 1
                game_state.player_1_id = user_id
            elif not game_state.player_2_id:
                player_number = 2
                game_state.player_2_id = user_id
            else:
                # This should not happen due to earlier check
                player_number = 0  # Spectator
            
            # Update game status
            if player_number == 2 and game_state.status == 'WAITING':
                game_state.status = 'ONGOING'
            
            game_state.save()
            
            # Instead of using PlayerSession.objects.create, use get_or_create
            # This should prevent the uniqueness constraint error
            player_session, created = PlayerSession.objects.get_or_create(
                room_code=room_code,
                player_id=user_id,
                defaults={
                    'player_number': player_number,
                    'username': username,
                    'connected': True
                }
            )

            # If the session already existed, only update necessary fields:
            if not created:
                # Update only what's needed
                player_session.player_number = player_number
                player_session.connected = True
                player_session.save(update_fields=['player_number', 'connected'])
            
            logger.info(f"Player {user_id} joined as player {player_number}")

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