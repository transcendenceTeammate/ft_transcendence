from django.db import models
from django.contrib.auth.models import User

class UserType(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_type')
	USER_TYPE_CHOICES = [
		('PENG', 'Peng'),
		('42', '42'),
	]
	user_type = models.CharField(max_length=5, choices=USER_TYPE_CHOICES, default='PENG')

	def __str__(self):
		return f"{self.user.username} - {self.get_user_type_display()}"
