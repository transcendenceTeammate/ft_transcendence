from rest_framework_simplejwt.views import TokenVerifyView
from django.contrib import admin
from django.urls import path, re_path
from app import views


urlpatterns = [
	path('admin/', admin.site.urls),
	path('', views.index),
    path('check_username/', views.check_username, name='check_username'),
	path('signup/', views.signup),
	path('login/', views.login),
	path('auth42/', views.auth42Page),
	path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
	path('get_user_info/', views.get_user_info),
	re_path(r'^.*$', views.index)
]