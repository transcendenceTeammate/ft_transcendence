
from rest_framework_simplejwt.views import TokenVerifyView
from django.contrib import admin
from django.urls import path, re_path
from app import views
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
	path('admin/', admin.site.urls),

	# Authentication
	path('api/auth/signup/', views.signup),
	path('api/auth/login/', views.login),

	#update user info
	path('api/users/update-username/', views.update_username),
	path('api/users/upload-profile-picture/', views.upload_profile_picture),

	# Token
	path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

	path('check_username/', views.check_username, name='check_username'),

	# User info
	path('api/users/me/', views.get_user_info),

	# get oauth code
	path('api/oauth/get-authorization-uri/', views.oauth_redirect_uri),
	path('auth42/', views.auth42),

	# Friendship
	path('api/friend/add/', views.add_friend),
	path('api/friend/remove/', views.remove_friend),
	path('api/friend/list/', views.list_friends),

	# Game
	path('api/game/add/', views.create_game),
	path('api/game/list/', views.get_game_history),

]

if settings.DEBUG:
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
