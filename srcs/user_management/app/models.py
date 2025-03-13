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


# class UserProfile(models.Model):
# 	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='image_file')
# 	UserType = models.OneToOneField(UserType, on_delete=models.CASCADE, related_name='user_type')
# 	image = models.OneToOneField(Images, on_delete=model, related_name

# 	def __str__(self):
# 		return f"{self.user.username} - {self.image_data}"


class ImageFile(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='image_file')
	image = models.ImageField(upload_to='profile_pics/', null=True, blank=True)

	def __str__(self):
		return f"{self.user.username} - {self.image_data}"