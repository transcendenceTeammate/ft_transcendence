from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserType
from rest_framework.exceptions import ValidationError

class UserSerializer(serializers.ModelSerializer):
	user_type = serializers.ChoiceField(choices=UserType.USER_TYPE_CHOICES, write_only=True, required=True)

	class Meta:
		model = User
		fields = ['id', 'username', 'password', 'user_type']
		extra_kwargs = {
			'password': {'write_only': True},
		}

	def create(self, validated_data):
		user_type = validated_data.pop('user_type')

		user = User.objects.filter(username=validated_data['username']).first()

		if user:
			user_type_instance = UserType.objects.filter(user=user).first()
			if user_type_instance and user_type_instance.user_type != user_type:
				raise serializers.ValidationError("User already exists with a different userType")
			return user

		user = User.objects.create_user(
			username=validated_data['username'],
			password=validated_data['password']
		)

		UserType.objects.create(user=user, user_type=user_type)

		return user
