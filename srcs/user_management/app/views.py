from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.http import JsonResponse
from .serializers import UserSerializer, GameHistorySerializer
from django.contrib.auth.models import User
from . import models
from .models import Profile, Friendship, GameHistory, GameUserData
from rest_framework.authtoken.models import Token
from rest_framework import status
from django.shortcuts import get_object_or_404
import requests
import random
import string
from django.http import JsonResponse, HttpResponseRedirect
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import login
from rest_framework_simplejwt.tokens import AccessToken
import os
from urllib.parse import urlencode
from rest_framework.exceptions import ValidationError

from .serializers import UserSerializer

from django.http import JsonResponse

from app.presence_registry import presenceService


@api_view(['GET'])
@permission_classes([AllowAny])
def check_username(request):
	username = request.GET.get('username')
	if User.objects.filter(username=username).exists():
		return JsonResponse({"error": "Username already exists"}, status=400)
	return JsonResponse({"message": "Username is available"}, status=200)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
	try:
		user = User.objects.get(username=request.data['username'])
	except User.DoesNotExist:
		return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

	if not user.check_password(request.data['password']):
		return Response({"error": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

	user_type = user.profile.type

	if user_type != 'PENG':
		return Response({"error": "User is not a peng"}, status=status.HTTP_403_FORBIDDEN)

	access_token = AccessToken.for_user(user)

	serializer = UserSerializer(instance=user)
	response = Response({
		"user": serializer.data
	})
	response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.127.0.0.1.nip.io')
	return response

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
	if User.objects.filter(username=request.data.get('username')).exists():
		return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

	serializer = UserSerializer(data=request.data)
	if serializer.is_valid():
		user = serializer.save()
		access_token = AccessToken.for_user(user)

		response = Response({
			"username": user.profile.nickname,
			"type": user.profile.type,
			"picture": user.profile.picture.url if user.profile.picture else None
		})
		response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.127.0.0.1.nip.io')
		return response

	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_redirect_uri(request):
	client_id = os.getenv('CLIENT_ID')
	redirect_uri = os.getenv('API_URL') + '/auth42/'
	query = urlencode({
		'client_id': client_id,
		'redirect_uri': redirect_uri,
		'response_type': 'code',
	})
	url = f'https://api.intra.42.fr/oauth/authorize?{query}'
	return HttpResponseRedirect(url)


@api_view(['GET'])
@permission_classes([AllowAny])
def auth42(request):
	code = request.GET.get('code')
	if not code:
		return Response({'error': 'No authorization code provided'}, status=status.HTTP_400_BAD_REQUEST)

	client_id = os.getenv('CLIENT_ID')
	client_secret = os.getenv('CLIENT_SECRET')
	redirect_uri = os.getenv('API_URL') + '/auth42/'
	token_url = 'https://api.intra.42.fr/oauth/token'
	token_data = {
		'grant_type': 'authorization_code',
		'client_id': client_id,
		'client_secret': client_secret,
		'code': code,
		'redirect_uri': redirect_uri,
	}

	token_response = requests.post(token_url, data=token_data)
	if token_response.status_code != 200:
		return Response({'error': 'Failed to fetch access token'}, status=token_response.status_code)

	token_data = token_response.json()
	access_token = token_data.get('access_token')

	user_url = 'https://api.intra.42.fr/v2/me'
	user_response = requests.get(user_url, headers={'Authorization': f'Bearer {access_token}'})
	if user_response.status_code != 200:
		return Response({'error': 'Failed to fetch user data'}, status=user_response.status_code)

	user_data = user_response.json()
	username = user_data.get('login')

	user, created = User.objects.get_or_create(username=username)

	profile, profile_created = Profile.objects.get_or_create(user=user, defaults={'type': "42", 'nickname': username})

	if not profile_created and profile.type != "42":
		return Response({'error': 'User already exists with a different type'}, status=status.HTTP_403_FORBIDDEN)

	access_token = AccessToken.for_user(user)

	response = HttpResponseRedirect(os.getenv('BASE_URL') + '/start-game')
	response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.127.0.0.1.nip.io')

	return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_info(request):
	API_URL = os.getenv('API_URL')
	user = request.user
	image_url = API_URL + user.profile.picture.url if user.profile.picture and user.profile.picture.url else None
	response = Response({
		"nickname": user.username,
		"avatar_url": image_url
	})
	return response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_profile_picture(request):
	user = request.user
	image_file = request.FILES.get('image')

	if not image_file:
		return Response({'error': 'No image file provided'}, status=400)

	if user.profile.picture:
		user.profile.picture.delete(save=False)

	user.profile.picture = image_file
	user.profile.save()

	API_URL = os.getenv('API_URL')
	return Response({
		"avatar_url": API_URL + user.profile.picture.url
	})

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_username(request):
	user = request.user

	if user.profile.type != 'PENG':
		return Response({"error": "Only users of type 'PENG' can update their username."}, status=status.HTTP_403_FORBIDDEN)

	new_username = request.data.get('username')

	if not new_username:
		return Response({"error": "New username is required."}, status=status.HTTP_400_BAD_REQUEST)

	if User.objects.filter(username=new_username).exists():
		return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

	user.username = new_username
	user.profile.nickname = new_username
	user.save()
	user.profile.save()

	return Response({
		"nickname": user.profile.nickname
	})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_friend(request):
	user_profile = request.user.profile
	friend_nickname = request.data.get('friend_nickname')

	if not friend_nickname:
		return Response({"error": "Friend nickname is required."}, status=status.HTTP_400_BAD_REQUEST)

	try:
		friend_profile = Profile.objects.get(nickname=friend_nickname)
	except Profile.DoesNotExist:
		return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

	if user_profile == friend_profile:
		return Response({"error": "You cannot add yourself as a friend."}, status=status.HTTP_400_BAD_REQUEST)

	if Friendship.objects.filter(user=user_profile, friend=friend_profile).exists():
		return Response({"error": "Friendship already exists."}, status=status.HTTP_400_BAD_REQUEST)

	Friendship.objects.create(user=user_profile, friend=friend_profile)

	friendships = Friendship.objects.filter(user=user_profile).select_related("friend")
	API_URL = os.getenv('API_URL')

	friends_data = [
		{"nickname": friendship.friend.nickname, "avatar_url": API_URL + friendship.friend.picture.url if friendship.friend.picture else None, "is_online": presenceService.is_user_connected(friendship.friend.user.id)}
		for friendship in friendships
	]

	return Response({"friends": friends_data}, status=status.HTTP_201_CREATED)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_friend(request):
	friend_nickname = request.data.get('friend_nickname')

	if not friend_nickname:
		return Response({"error": "friend_nickname is required."}, status=status.HTTP_400_BAD_REQUEST)

	user_profile = request.user.profile

	try:
		friend_profile = Profile.objects.get(nickname=friend_nickname)
	except Profile.DoesNotExist:
		return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

	deleted, _ = Friendship.objects.filter(user=user_profile, friend=friend_profile).delete()

	if deleted:
		API_URL = os.getenv('API_URL')
		friendships = Friendship.objects.filter(user=user_profile).select_related("friend")

		friends_data = [
			{"nickname": friendship.friend.nickname, "avatar_url": API_URL + friendship.friend.picture.url if friendship.friend.picture else None, "is_online": presenceService.is_user_connected(friendship.friend.user.id)}
			for friendship in friendships
		]

		return Response({
			"friends": friends_data,
		})

	return Response({"error": "Friendship does not exist."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_friends(request):
	API_URL = os.getenv('API_URL')

	user_profile = request.user.profile

	friendships = Friendship.objects.filter(user=user_profile).select_related("friend")

	friends_data = [
		{"nickname": friendship.friend.nickname, "avatar_url": API_URL + friendship.friend.picture.url if friendship.friend.picture else None, "is_online": presenceService.is_user_connected(friendship.friend.user.id)}
		for friendship in friendships
	]

	return Response({
		"friends": friends_data
	})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_game(request):
	player_1_id = request.data.get('player_1')
	player_2_id = request.data.get('player_2')
	score_1 = request.data.get('score_1')
	score_2 = request.data.get('score_2')

	if not all([player_1_id, player_2_id, score_1, score_2]):
		return Response({"error": "All fields (player_1, player_2, score_1, score_2) are required."}, status=status.HTTP_400_BAD_REQUEST)

	try:
		player_1 = Profile.objects.get(id=player_1_id)
		player_2 = Profile.objects.get(id=player_2_id)
	except Profile.DoesNotExist:
		return Response({"error": "One or both users not found."}, status=status.HTTP_404_NOT_FOUND)

	if player_1 == player_2:
		return Response({"error": "A user cannot play against themselves."}, status=status.HTTP_400_BAD_REQUEST)

	player_1_wins = int(score_1) > int(score_2)
	player_2_wins = int(score_2) > int(score_1)

	game_history = GameHistory.objects.create()

	GameUserData.objects.create(game=game_history, user=player_1, score=score_1, is_winner=player_1_wins)
	GameUserData.objects.create(game=game_history, user=player_2, score=score_2, is_winner=player_2_wins)

	return Response({
		"message": "Game recorded successfully.",
		"game": GameHistorySerializer(game_history).data
	}, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_game_history(request):
	user = request.user.profile

	games = GameUserData.objects.filter(user=user).select_related('game', 'user')

	game_history = []

	for game_data in games:

		opponent_game_data = GameUserData.objects.filter(game=game_data.game).exclude(user=user).first()

		if opponent_game_data:
			game_history.append({
				"PlayerA_nickname": game_data.user.nickname,
				"PlayerA_score": game_data.score,
				"PlayerA_isWinner": game_data.is_winner,
				"PlayerB_nickname": opponent_game_data.user.nickname,
				"PlayerB_score": opponent_game_data.score,
			})

	return Response({"games": game_history})