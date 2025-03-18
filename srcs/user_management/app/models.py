from django.db import models
import uuid
import os
from django.contrib.auth.models import User
from PIL import Image

class UserType(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_type')
	USER_TYPE_CHOICES = [
		('PENG', 'Peng'),
		('42', '42'),
	]
	user_type = models.CharField(max_length=5, choices=USER_TYPE_CHOICES, default='PENG')

	def __str__(self):
		return f"{self.user.username} - {self.get_user_type_display()}"

def upload_to(instance, filename):
	ext = filename.split('.')[-1]
	unique_filename = f"{uuid.uuid4()}.{ext}"
	return os.path.join('profile_pics/', unique_filename)

class ImageFile(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE)
	image = models.ImageField(upload_to=upload_to, null=True, blank=True)  

	def save(self, *args, **kwargs):
		super().save(*args, **kwargs)

		if self.image:
			img_path = self.image.path
			img = Image.open(img_path)  

			max_size = (300, 300)
			img.thumbnail(max_size, Image.LANCZOS)
			img.save(img_path)

	def __str__(self):
		return f"{self.user.username} - {self.image}"