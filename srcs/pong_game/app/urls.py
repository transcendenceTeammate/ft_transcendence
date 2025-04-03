from django.urls import path
from . import views

urlpatterns = [
    # Room management endpoints
    path('api/room/create/', views.create_room, name='create_room'),
    path('api/room/join/', views.join_room, name='join_room'),
    path('api/room/check/<str:room_code>/', views.check_room, name='check_room'),
]