from rest_framework import serializers
from rest_framework import serializers
from .models import Task, AppVersion, UserContext
from django.contrib.auth.models import User

class TaskSerializer(serializers.ModelSerializer):
    _id = serializers.IntegerField(source='id', read_only=True)
    isCompleted = serializers.BooleanField(source='is_completed', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    dueDate = serializers.DateTimeField(source='due_date', required=False, allow_null=True)
    locationQuery = serializers.CharField(source='locationQuery', required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Task
        fields = ['_id', 'title', 'isCompleted', 'createdAt', 'dueDate', 'locationQuery']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class AppVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppVersion
        fields = ['id', 'version', 'release_notes', 'is_mandatory', 'released_at', 'download_url']

class UserContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserContext
        fields = ['id', 'key', 'value', 'coords_lat', 'coords_lng', 'metadata', 'confidence', 'source', 'last_updated']