from django.db import models
from django.contrib.auth.models import User

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


class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=200)
    is_completed = models.BooleanField(default=False)
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    notification_id = models.CharField(max_length=255, null=True, blank=True)
    
    location_trigger = models.JSONField(null=True, blank=True)
    locationQuery = models.CharField(max_length=255, null=True, blank=True)
    required_context = models.CharField(
        max_length=40,
        choices=UserContext.ContextKey.choices,
        null=True,
        blank=True
    )
    context_condition = models.CharField(
        max_length=20,
        choices=[('before', 'Before'), ('during', 'During'), ('after', 'After')],
        null=True,
        blank=True
    )
    is_muted = models.BooleanField(default=False)
    last_notified_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_notified_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    def __str__(self):
        return self.title


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    expo_push_token = models.CharField(max_length=255, blank=True, null=True)
    coords_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    coords_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_updated_at = models.DateTimeField(null=True, blank=True)

    notifications_enabled = models.BooleanField(default=True)
    dnd_enabled = models.BooleanField(default=False)
    dnd_start = models.CharField(max_length=5, default="22:00")
    dnd_end = models.CharField(max_length=5, default="07:00")
    notification_radius = models.IntegerField(default=300)
    muted_contexts = models.JSONField(default=list, blank=True)

    telegram_chat_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    telegram_link_code = models.CharField(max_length=10, blank=True, null=True)
    telegram_link_code_expires = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Profile for {self.user.username}"


from django.utils import timezone

class UserContextVisit(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='context_visits')
    context_key = models.CharField(max_length=40, choices=UserContext.ContextKey.choices)
    date = models.DateField(default=timezone.now)
    was_visited = models.BooleanField(default=False)
    last_visited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'context_key', 'date'], name='unique_user_context_visit_daily')
        ]

    def __str__(self):
        return f"{self.user.username} - {self.context_key} on {self.date}"



class AppVersion(models.Model):
    version = models.CharField(max_length=20, unique=True)
    release_notes = models.TextField()
    is_mandatory = models.BooleanField(default=False)
    released_at = models.DateTimeField(auto_now_add=True)
    download_url = models.URLField(blank=True, null=True)

    class Meta:
        ordering = ['-released_at']

    def __str__(self):
        return self.version
