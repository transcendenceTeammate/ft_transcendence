from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.http import JsonResponse
from .serializers import UserSerializer
from django.contrib.auth.models import User
from . import models
from .models import Profile, Friendship
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
from dotenv import load_dotenv
from urllib.parse import urlencode
from rest_framework.exceptions import ValidationError

from .serializers import UserSerializer

from django.http import JsonResponse

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
	response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.localhost')
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
		response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.localhost')
		return response

	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

def index(request):
	return render(request, 'index.html')

def generate_random_password(length=12):
	characters = string.ascii_letters + string.digits + string.punctuation
	return ''.join(random.choice(characters) for i in range(length))

@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_redirect_uri(request):
	load_dotenv()
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

	load_dotenv()
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
	response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.localhost')

	return response



def get_access_token(request):
	if request.method == "POST":
		client_id = "VOTRE_CLIENT_ID"
		client_secret = "VOTRE_CLIENT_SECRET"
		redirect_uri = "http://localhost:8000/auth42/"
		code = request.POST.get("code")

		url = "https://api.intra.42.fr/oauth/token"
		data = {
			"grant_type": "authorization_code",
			"client_id": client_id,
			"client_secret": client_secret,
			"code": code,
			"redirect_uri": redirect_uri,
		}
		response = requests.post(url, data=data)
		return JsonResponse(response.json(), safe=False)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_info(request):
	load_dotenv()
	API_URL = os.getenv('API_URL')
	user = request.user
	image_url = None
	if hasattr(user, 'image_file') and user.image_file.image:
		image_url = API_URL + user.image_file.image.url
	response = Response({
		"username": user.username,
		"image": API_URL + user.profile.picture.url
	})
	return response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_profile_picture(request):
	load_dotenv()
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
		"image": API_URL + user.profile.picture.url
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

	return Response({"message": f"{friend_profile.nickname} added as a friend."}, status=status.HTTP_201_CREATED)

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
		return Response({"message": f"Friendship with {friend_profile.nickname} removed."})

	return Response({"error": "Friendship does not exist."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_friends(request):
	user_profile = request.user.profile

	friendships = Friendship.objects.filter(user=user_profile).select_related("friend")

	friends_data = [
		{"nickname": friendship.friend.nickname, "picture": friendship.friend.picture.url if friendship.friend.picture else None}
		for friendship in friendships
	]

	return Response({
		"friends": friends_data
	})