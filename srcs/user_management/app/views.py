from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.http import JsonResponse
from .serializers import UserSerializer
from django.contrib.auth.models import User
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
from .models import UserType


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
	
	try:
		user_type = user.user_type.user_type
	except UserType.DoesNotExist:
		return Response({"error": "User type not found"}, status=status.HTTP_404_NOT_FOUND)

	if user_type != 'PENG':
		return Response({"error": "User is not a peng"}, status=status.HTTP_403_FORBIDDEN)

	access_token = AccessToken.for_user(user)

	serializer = UserSerializer(instance=user)
	response = Response({
		"user": serializer.data
	})
	response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.localhost:8443') # httponly=True, secure=True
	return response

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
	if User.objects.filter(username=request.data['username']).exists():
		return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

	request.data['user_type'] = "PENG"
	serializer = UserSerializer(data=request.data)
	if serializer.is_valid():
		user = serializer.save()

		user_type_instance = UserType.objects.get(user=user)

		access_token = AccessToken.for_user(user)

		response = Response({
			"user": serializer.data.get('username'),
			"user_type": user_type_instance.user_type
		})
		response.set_cookie('access_token', str(access_token), httponly=False, secure=True, samesite='Lax', domain='.app.localhost:8443')
		return response

	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

def index(request):
	return render(request, 'index.html')

def generate_random_password(length=12):
	characters = string.ascii_letters + string.digits + string.punctuation
	return ''.join(random.choice(characters) for i in range(length))

@api_view(['GET'])
@permission_classes([AllowAny])
def auth42(request):
	code = request.GET.get('code')
	if not code:
		return Response({'error': 'No authorization code provided'}, status=status.HTTP_400_BAD_REQUEST)

	load_dotenv()
	token_url = 'https://api.intra.42.fr/oauth/token'
	token_data = {
		'grant_type': 'authorization_code',
		'client_id': os.getenv('CLIENT_ID'),
		'client_secret': os.getenv('CLIENT_SECRET'),
		'code': code,
		'redirect_uri': 'http://localhost:8000/auth42/',
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

	user = User.objects.filter(username=username).first()
	
	if user:
		user_type_instance = UserType.objects.filter(user=user).first()
		if not user_type_instance or user_type_instance.user_type != "42":
			return Response({'error': 'User already exists with a different userType'}, status=status.HTTP_403_FORBIDDEN)
	else:
		random_password = User.objects.make_random_password()
		user = User.objects.create_user(username=username, password=random_password)
		UserType.objects.create(user=user, user_type="42")

	access_token = AccessToken.for_user(user)

	serializer = UserSerializer(instance=user)

	response.set_cookie('access_token', str(access_token), httponly=False, secure=False, samesite='Lax')

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

@api_view(['GET', 'OPTIONS'])
@permission_classes([IsAuthenticated])
def get_user_info(request):
	if request.method == "OPTIONS":
		response = Response()
		response["Access-Control-Allow-Origin"] = "https://localhost:8443"
		response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
		response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
		response["Access-Control-Allow-Credentials"] = "true"
		return response

	user = request.user
	response = Response({
		"username": user.username,
	})
	response["Access-Control-Allow-Origin"] = "https://localhost:8443"
	response["Access-Control-Allow-Credentials"] = "true"
	return response