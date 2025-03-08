from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
import json
import logging
from .models import GameState
from .utils import generate_room_code, game_state_to_dict

logger = logging.getLogger(__name__)

# Fonctions utilitaires pour les réponses
def cors_response(response):
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

def handle_options(request):
    response = JsonResponse({})
    return cors_response(response)

def success_response(data=None, message=None):
    response_data = {'status': 'SUCCESS'}
    if data:
        response_data['data'] = data
    if message:
        response_data['message'] = message
    return cors_response(JsonResponse(response_data))

def error_response(message, status=400):
    return cors_response(JsonResponse({'status': 'ERROR', 'message': message}, status=status))

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def create_game(request):
    if request.method == "OPTIONS":
        return handle_options(request)
    
    try:
        data = json.loads(request.body)
        player_id = data.get('player_id')
        
        if not player_id:
            return error_response("Player ID is required")
        
        room_code = generate_room_code()
        
        game = GameState.objects.create(
            room_code=room_code,
            player_1_id=player_id,
            status='WAITING'
        )
        
        return success_response({
            'room_code': room_code,
            'game_id': game.id
        }, "Game created successfully")
        
    except Exception as e:
        logger.exception("Error in create_game")
        return error_response(f"Internal server error: {str(e)}", 500)

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def join_game(request):
    if request.method == "OPTIONS":
        return handle_options(request)
    
    try:
        data = json.loads(request.body)
        room_code = data.get('room_code')
        player_id = data.get('player_id')
        
        if not room_code or not player_id:
            return error_response("Room code and player ID are required")
        
        try:
            with transaction.atomic():
                game = GameState.objects.select_for_update().get(room_code=room_code.upper())
                
                if game.player_2_id:
                    return error_response("Game is already full")
                
                if game.player_1_id == player_id:
                    return error_response("You cannot play against yourself")
                
                game.player_2_id = player_id
                game.status = 'ONGOING'
                game.save()
                
                return success_response({
                    'room_code': room_code,
                    'game_id': game.id
                }, "Successfully joined the game")
                
        except GameState.DoesNotExist:
            return error_response("Game not found", 404)
            
    except Exception as e:
        logger.exception("Error in join_game")
        return error_response(f"Internal server error: {str(e)}", 500)

@csrf_exempt
@require_http_methods(["GET"])
def get_game_state(request):
    """Récupère l'état actuel d'une partie"""
    try:
        room_code = request.GET.get('room_code')
        if not room_code:
            return error_response("Room code is required")
        
        try:
            game = GameState.objects.get(room_code=room_code.upper())
            return success_response({
                'game_state': game_state_to_dict(game)
            })
        except GameState.DoesNotExist:
            return error_response("Game not found", 404)
            
    except Exception as e:
        logger.exception("Error in get_game_state")
        return error_response(f"Internal server error: {str(e)}", 500)