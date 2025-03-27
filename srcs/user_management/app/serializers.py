from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile
from .models import Friendship
from .models import GameHistory
from .models import GameUserData

class UserSerializer(serializers.ModelSerializer):
	type = serializers.ChoiceField(choices=Profile.USER_TYPE_CHOICES, write_only=True, required=False, default="PENG")
	picture = serializers.ImageField(required=False)

	class Meta:
		model = User
		fields = ['id', 'username', 'password', 'type', 'picture']
		extra_kwargs = {'password': {'write_only': True}}

	def create(self, validated_data):
		user_type = validated_data.pop('type')
		picture = validated_data.pop('picture', None)

		user = User.objects.create_user(
			username=validated_data['username'],
			password=validated_data['password']
		)

		Profile.objects.create(user=user, nickname=user.username, type=user_type)

		return user

	def to_representation(self, instance):
		representation = super().to_representation(instance)
		representation['type'] = instance.profile.type
		representation['picture'] = instance.profile.picture.url if instance.profile.picture else None
		return representation

class GameHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GameHistory
        fields = '__all__'


class GameUserDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameUserData
        fields = '__all__'
