from rest_framework_simplejwt.views import TokenVerifyView
from django.contrib import admin
from django.urls import path, re_path
from app import views
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
	path('admin/', admin.site.urls),
	path('auth42/', views.auth42),

	# Authentication
	path('api/auth/signup/', views.signup),
	path('api/auth/login/', views.login),

	#update user info
	path('api/users/update-username/', views.update_username),

	# Token
	path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

	path('check_username/', views.check_username, name='check_username'),

	# User info
	path('api/users/me/', views.get_user_info),

	# get oauth code
	path('api/oauth/get-authorization-uri/', views.oauth_redirect_uri),

	path('api/users/upload-profile-picture/', views.upload_profile_picture),

	path('', views.index),
	re_path(r'^.*$', views.index),
]

if settings.DEBUG:
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
