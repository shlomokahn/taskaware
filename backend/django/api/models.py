from django.db import models
from django.contrib.auth.models import User

class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=200)
    is_completed = models.BooleanField(default=False)
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # שדות עתידיים להתראות ומיקום
    location_trigger = models.JSONField(null=True, blank=True)
    
    def __str__(self):
        return self.title


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    expo_push_token = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Profile for {self.user.username}"