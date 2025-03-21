from django.db import models
from django.contrib.auth.models import User
import uuid
import os
from PIL import Image

def upload_to(instance, filename):
    ext = filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('profile_pics/', unique_filename)

class Profile(models.Model):
    USER_TYPE_CHOICES = [
        ('PENG', 'Peng'),
        ('42', '42'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    nickname = models.CharField(max_length=100, blank=True)
    picture = models.ImageField(upload_to=upload_to, null=True, blank=True)
    type = models.CharField(max_length=5, choices=USER_TYPE_CHOICES, default='PENG')

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.picture:
            img_path = self.picture.path
            img = Image.open(img_path)

            max_size = (300, 300)
            img.thumbnail(max_size, Image.LANCZOS)
            img.save(img_path)

    def __str__(self):
        return f"{self.user.username} - {self.get_type_display()}"


class Friendship(models.Model):
    user = models.ForeignKey('Profile', on_delete=models.CASCADE, related_name="friendships")
    friend = models.ForeignKey('Profile', on_delete=models.CASCADE, related_name="friends")

    class Meta:
        unique_together = ('user', 'friend')

    def __str__(self):
        return f"{self.user.nickname} follows {self.friend.nickname}"
