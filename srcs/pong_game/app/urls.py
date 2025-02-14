from django.urls import path
from . import views

urlpatterns = [
    path('api/game/create', views.create_game, name='create_game'),
    path('api/game/join', views.join_game, name='join_game'),
##    path('api/game/key_event', views.send_key_event, name='send_key_event'),
]