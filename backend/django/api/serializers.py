from rest_framework import serializers
from .models import Task
from django.contrib.auth.models import User

class TaskSerializer(serializers.ModelSerializer):
    # המרת שמות השדות כדי שיתאימו למה שהפרונטנד מכיר מ-Mongo
    _id = serializers.IntegerField(source='id', read_only=True)
    isCompleted = serializers.BooleanField(source='is_completed', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    dueDate = serializers.DateTimeField(source='due_date', required=False, allow_null=True)

    class Meta:
        model = Task
        fields = ['_id', 'title', 'isCompleted', 'createdAt']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user