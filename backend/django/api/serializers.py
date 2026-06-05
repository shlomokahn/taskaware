from rest_framework import serializers
from .models import Task, AppVersion, UserContext
from django.contrib.auth.models import User


class TaskSerializer(serializers.ModelSerializer):
    _id = serializers.IntegerField(source='id', read_only=True)
    isCompleted = serializers.BooleanField(source='is_completed', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    dueDate = serializers.DateTimeField(source='due_date', required=False, allow_null=True)
    notificationId = serializers.CharField(source='notification_id', required=False, allow_blank=True, allow_null=True)
    locationQuery = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    requiredContext = serializers.CharField(source='required_context', required=False, allow_null=True)
    contextCondition = serializers.CharField(source='context_condition', required=False, allow_null=True)
    isMuted = serializers.BooleanField(source='is_muted', required=False)

    class Meta:
        model = Task
        fields = [
            '_id', 'title', 'isCompleted', 'createdAt', 'dueDate', 
            'notificationId', 'locationQuery', 'requiredContext', 
            'contextCondition', 'isMuted'
        ]



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
