from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
import json
import random
import string
from .models import GameState

def generate_room_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not GameState.objects.filter(room_code=code).exists():
            return code

def cors_response(response):
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response

def handle_options(request):
    response = JsonResponse({})
    return cors_response(response)

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def create_game(request):
    if request.method == "OPTIONS":
        return handle_options(request)
    
    data = json.loads(request.body)
    user_id = data.get('user_id')
    if not user_id:
        return JsonResponse({'error': 'User ID required'}, status=400)
    
    room_code = generate_room_code()
    GameState.objects.create(room_code=room_code, player_1_id=user_id)
    return JsonResponse({'room_code': room_code})

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def join_game(request):
    if request.method == "OPTIONS":
        return handle_options(request)
    
    data = json.loads(request.body)
    room_code = data.get('room_code')
    user_id = data.get('user_id')
    
    try:
        with transaction.atomic():
            game = GameState.objects.select_for_update().get(room_code=room_code)
            if game.player_2_id:
                return JsonResponse({'error': 'Game full'}, status=400)
            
            game.player_2_id = user_id
            game.is_paused = False
            game.save()
            return JsonResponse({'success': True})
    except GameState.DoesNotExist:
        return JsonResponse({'error': 'Game not found'}, status=404)

@csrf_exempt
@require_http_methods(["GET"])
def get_game_state(request):
    room_code = request.GET.get('room_code')
    try:
        game = GameState.objects.get(room_code=room_code)
        return JsonResponse({
            'status': 'SUCCESS',
            'game_state': {
                'room_code': game.room_code,
                'player_1_id': game.player_1_id,
                'player_2_id': game.player_2_id,
                'player_1_score': game.player_1_score,
                'player_2_score': game.player_2_score,
                'player_1_paddle_y': game.player_1_paddle_y,
                'player_2_paddle_y': game.player_2_paddle_y,
                'ball_x': game.ball_x,
                'ball_y': game.ball_y,
                'ball_dx': game.ball_dx,
                'ball_dy': game.ball_dy,
                'is_paused': game.is_paused,
            }
        })
    except GameState.DoesNotExist:
        return JsonResponse({'status': 'ERROR', 'message': 'Room not found'}, status=404)