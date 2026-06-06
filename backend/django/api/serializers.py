from rest_framework import serializers
from .models import Task, AppVersion, UserContext, UserProfile
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

    closestPlaceName = serializers.SerializerMethodField()
    closestPlaceAddress = serializers.SerializerMethodField()
    closestPlaceCoords = serializers.SerializerMethodField()
    closestPlaceDistance = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            '_id', 'title', 'isCompleted', 'createdAt', 'dueDate', 
            'notificationId', 'locationQuery', 'requiredContext', 
            'contextCondition', 'isMuted',
            'closestPlaceName', 'closestPlaceAddress', 'closestPlaceCoords', 'closestPlaceDistance'
        ]

    def _get_closest_place_data(self, obj):
        if hasattr(obj, '_closest_place_data'):
            return obj._closest_place_data

        obj._closest_place_data = None
        
        location_query = obj.locationQuery
        if not location_query:
            try:
                from .views import infer_task_place_query
                location_query = infer_task_place_query(obj.title)
            except Exception:
                pass

        if not location_query:
            return None

        request = self.context.get('request')
        if not request:
            return None

        lat_str = request.query_params.get('latitude')
        lng_str = request.query_params.get('longitude')
        if not lat_str or not lng_str:
            return None

        try:
            user_lat = float(lat_str)
            user_lng = float(lng_str)
            
            rounded_lat = round(user_lat, 3)
            rounded_lng = round(user_lng, 3)
            
            # For proximity sorting/display, we use a wide search radius (e.g., 10,000 meters)
            # to find the nearest actual execution place even if the user is not currently within its notification range.
            radius_m = 10000
                
            query_key = location_query.strip().lower()
            cache_key = f"places:{rounded_lat}:{rounded_lng}:{query_key}:{radius_m}"
            
            from django.core.cache import cache
            search_result = cache.get(cache_key)
            
            if not search_result:
                # Cache miss, import and search
                from .views import google_places_search
                search_result = google_places_search(location_query, user_lat, user_lng, radius_m=radius_m)
                cache.set(cache_key, search_result, 3600)
                
            if search_result and search_result.get("places"):
                nearest = search_result["places"][0]
                
                # Import distance helper from views
                from .views import haversine_distance_m
                dist = haversine_distance_m(user_lat, user_lng, float(nearest["lat"]), float(nearest["lng"]))
                
                obj._closest_place_data = {
                    "name": nearest["name"],
                    "address": nearest.get("address", ""),
                    "coords": {"lat": nearest["lat"], "lng": nearest["lng"]},
                    "distance": int(dist)
                }
        except Exception as err:
            print("Error in TaskSerializer._get_closest_place_data:", str(err))

        return obj._closest_place_data

    def get_closestPlaceName(self, obj):
        data = self._get_closest_place_data(obj)
        return data["name"] if data else None

    def get_closestPlaceAddress(self, obj):
        data = self._get_closest_place_data(obj)
        return data["address"] if data else None

    def get_closestPlaceCoords(self, obj):
        data = self._get_closest_place_data(obj)
        return data["coords"] if data else None

    def get_closestPlaceDistance(self, obj):
        data = self._get_closest_place_data(obj)
        return data["distance"] if data else None



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


class UserProfileSerializer(serializers.ModelSerializer):
    notificationsEnabled = serializers.BooleanField(source='notifications_enabled', required=False)
    dndEnabled = serializers.BooleanField(source='dnd_enabled', required=False)
    dndStart = serializers.CharField(source='dnd_start', required=False)
    dndEnd = serializers.CharField(source='dnd_end', required=False)
    notificationRadius = serializers.IntegerField(source='notification_radius', required=False)
    mutedContexts = serializers.JSONField(source='muted_contexts', required=False)
    isTelegramLinked = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'notificationsEnabled', 'dndEnabled', 'dndStart', 'dndEnd', 
            'notificationRadius', 'mutedContexts', 'isTelegramLinked'
        ]

    def get_isTelegramLinked(self, obj):
        return bool(obj.telegram_chat_id)
