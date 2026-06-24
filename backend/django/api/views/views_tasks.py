from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from api.models import Task, UserProfile, UserContext
from api.serializers import TaskSerializer, UserContextSerializer
from .views_helpers import (
    evaluate_conditional_notifications,
    infer_task_place_query,
    resolve_google_place_config,
    GOOGLE_PLACE_CATALOG,
    resolve_user_location,
    google_places_search,
    build_static_map_url
)
from .views_ai import parse_voice_message_with_ai, predict_next_visit, infer_context_keys

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            print(f"Error in TaskViewSet.list: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['POST'], url_path='create-from-voice')
    def create_from_voice(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            audio_bytes = file_obj.read()
            mime_type = file_obj.content_type or 'audio/mp4'
            device_time = request.data.get('deviceTime')
            lat = request.data.get('latitude') or request.data.get('lat')
            lng = request.data.get('longitude') or request.data.get('lng')
            
            ai_data_list = parse_voice_message_with_ai(
                audio_bytes,
                mime_type=mime_type,
                device_time=device_time,
                user=request.user,
                latitude=lat,
                longitude=lng
            )
            if not ai_data_list:
                return Response({'error': 'AI failed to parse the voice recording'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
                
            created_tasks_data = []
            for ai_data in ai_data_list:
                location_query = ai_data.get('locationQuery')
                required_context = ai_data.get('requiredContext')
                due_date = ai_data.get('dueDate')
                
                if not location_query and not required_context and not due_date:
                    ai_data['locationQuery'] = 'supermarket'
                    location_query = 'supermarket'
                    
                serializer_data = {
                    'title': ai_data.get('title') or 'Voice Task',
                    'dueDate': due_date,
                    'locationQuery': location_query,
                    'requiredContext': required_context,
                    'contextCondition': ai_data.get('contextCondition'),
                }
                serializer = self.get_serializer(data=serializer_data)
                serializer.is_valid(raise_exception=True)
                task = serializer.save(user=request.user)
                
                serialized_dict = serializer.data
                suggested_due_date = None
                if not due_date:
                    predict_key = required_context or location_query
                    if predict_key:
                        suggested_due_date = predict_next_visit(request.user, predict_key.strip().lower())
                
                serialized_dict['suggestedDueDate'] = suggested_due_date
                created_tasks_data.append(serialized_dict)
                
            return Response(created_tasks_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print("Error in create_from_voice:", str(e))
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserContextViewSet(viewsets.ModelViewSet):
    serializer_class = UserContextSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserContext.objects.filter(user=self.request.user).order_by('key')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = serializer.validated_data
        context_key = validated.get('key')
        defaults = {
            'value': validated.get('value'),
            'coords_lat': validated.get('coords_lat'),
            'coords_lng': validated.get('coords_lng'),
            'metadata': validated.get('metadata'),
            'confidence': validated.get('confidence', 1.0),
            'source': validated.get('source', 'user'),
        }

        context, _ = UserContext.objects.update_or_create(
            user=request.user,
            key=context_key,
            defaults=defaults,
        )
        output = self.get_serializer(context)
        return Response(output.data, status=status.HTTP_200_OK)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_location(request):
    user = request.user
    data = request.data
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if latitude is None or longitude is None:
        return Response({'error': 'Missing latitude or longitude'}, status=status.HTTP_400_BAD_REQUEST)

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.coords_lat = latitude
    profile.coords_lng = longitude
    profile.location_updated_at = timezone.now()
    profile.save(update_fields=['coords_lat', 'coords_lng', 'location_updated_at'])

    print(f"📍 Location updated for {user.username}: {latitude}, {longitude}")
    
    try:
        evaluate_conditional_notifications(user, float(latitude), float(longitude))
    except Exception as e:
        print("Error in evaluate_conditional_notifications:", str(e))
        import traceback
        traceback.print_exc()

    return Response({'status': 'Location updated successfully'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_push_token(request):
    token = request.data.get('token')
    if not token:
        return Response({"error": "No token provided"}, status=status.HTTP_400_BAD_REQUEST)

    profile, created = UserProfile.objects.get_or_create(user=request.user)
    profile.expo_push_token = token
    profile.save()

    return Response({"message": "Token saved successfully"}, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def infer_context(request):
    title = request.data.get('title', '')
    inferred_keys = infer_context_keys(title)
    
    location_query = None
    recent_task = Task.objects.filter(user=request.user, title=title).order_by('-created_at').first()
    if recent_task and recent_task.locationQuery:
        location_query = recent_task.locationQuery
    else:
        location_query = infer_task_place_query(title)
        
    if location_query:
        category_key, config = resolve_google_place_config(location_query)
        target_key = category_key if category_key else location_query.lower().strip()
        inferred_keys.add(target_key)
        
    if not inferred_keys:
        return Response({"pending_contexts": [], "matched_contexts": []})

    existing = set(
        UserContext.objects.filter(user=request.user, key__in=inferred_keys)
        .values_list('key', flat=True)
    )

    pending = [key for key in inferred_keys if key not in existing]
    matched = [key for key in inferred_keys if key in existing]

    def get_label(key):
        for val, label in UserContext.ContextKey.choices:
            if val == key:
                return label
        if key in GOOGLE_PLACE_CATALOG:
            return GOOGLE_PLACE_CATALOG[key]["label"]
        return key.replace('_', ' ').title()

    return Response({
        "pending_contexts": [{"key": key, "label": get_label(key)} for key in pending],
        "matched_contexts": [{"key": key, "label": get_label(key)} for key in matched],
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def nearby_places(request, pk):
    task = get_object_or_404(Task, pk=pk, user=request.user)
    location_query = task.locationQuery or infer_task_place_query(task.title)

    if not location_query:
        return Response({
            "query": None,
            "category_key": None,
            "category_label": None,
            "location_source": None,
            "places": [],
            "map_image_url": None,
            "message": "No place category could be inferred for this task.",
        }, status=status.HTTP_200_OK)

    user_lat, user_lng, location_source = resolve_user_location(request.user, request.data)
    if user_lat is None or user_lng is None:
        return Response({
            "query": location_query,
            "category_key": None,
            "category_label": None,
            "location_source": None,
            "places": [],
            "map_image_url": None,
            "message": "No saved or current location is available. Sync your location first.",
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        search_result = None
        for radius_m in (1200, 2500, 5000):
            search_result = google_places_search(location_query, user_lat, user_lng, radius_m)
            if search_result["places"]:
                break

        places = search_result["places"] if search_result else []
        category_key = search_result["category_key"] if search_result else None
        category_label = search_result["category_label"] if search_result else location_query
        radius_m = search_result["radius_m"] if search_result else None
    except Exception as error:
        print("Nearby places error:", str(error))
        return Response({
            "query": location_query,
            "category_key": None,
            "category_label": None,
            "location_source": location_source,
            "user_location": {
                "lat": user_lat,
                "lng": user_lng,
            },
            "places": [],
            "radius_m": None,
            "map_image_url": build_static_map_url(user_lat, user_lng, []),
            "message": "Could not load nearby places right now. Please try again later.",
        }, status=status.HTTP_200_OK)

    return Response({
        "query": location_query,
        "category_key": category_key,
        "category_label": category_label,
        "location_source": location_source,
        "user_location": {
            "lat": user_lat,
            "lng": user_lng,
        },
        "places": places,
        "radius_m": radius_m,
        "map_image_url": build_static_map_url(user_lat, user_lng, places),
        "message": None if places else "No nearby places were found for this task.",
    })
