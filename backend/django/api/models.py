from django.db import models
from django.db import models
from django.contrib.auth.models import User

class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=200)
    is_completed = models.BooleanField(default=False)
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    location_trigger = models.JSONField(null=True, blank=True)
    locationQuery = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return self.title


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    expo_push_token = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Profile for {self.user.username}"


class UserContext(models.Model):
    class ContextKey(models.TextChoices):
        WORK = 'work', 'Work'
        HOME = 'home', 'Home'
        SCHOOL = 'school', 'School'
        GYM = 'gym', 'Gym'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contexts')
    key = models.CharField(max_length=40, choices=ContextKey.choices)
    value = models.CharField(max_length=255)
    coords_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    coords_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    confidence = models.FloatField(default=1.0)
    source = models.CharField(max_length=50, default='user')
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'key'], name='unique_user_context_key')
        ]

    def __str__(self):
        return f"{self.user.username} - {self.key}"
