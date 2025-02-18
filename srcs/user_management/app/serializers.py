from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserType

class UserSerializer(serializers.ModelSerializer):
	user_type = serializers.ChoiceField(choices=UserType.USER_TYPE_CHOICES, write_only=True, default='PENG')
	class Meta(object):
		model = User
		fields = ['id', 'username', 'password', 'user_type']
		extra_kwargs = {
			'password': {'write_only': True},
		}
	def create(self, validated_data):
		user_type = validated_data.pop('user_type', 'PENG')

		user = User.objects.create_user(
        username=validated_data['username'],
        password=validated_data['password']
		)

		UserType.objects.create(user=user, user_type=user_type)

		return user