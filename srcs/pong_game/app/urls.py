from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_game, name='create_game'),
    path('join/', views.join_game, name='join_game'),
    path('game-state/', views.get_game_state, name='get_game_state'),
]