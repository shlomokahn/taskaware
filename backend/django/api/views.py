from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import AppVersion
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import Task, UserProfile, AppVersion, UserContext
from .serializers import TaskSerializer, UserSerializer, AppVersionSerializer, UserContextSerializer
from exponent_server_sdk import PushClient, PushMessage
from google import genai
import os
from packaging import version as packaging_version


def send_expo_push_notification(expo_token, title, body):
    try:
        if not expo_token or not expo_token.startswith("ExponentPushToken"):
            print(f"Invalid token: {expo_token}")
            return
            
        response = PushClient().publish(
            PushMessage(
                to=expo_token,
                title=title,
                body=body,
                sound="default"
            )
        )
        print("Push sent successfully!", response)
    except Exception as e:
        print("Failed to send push notification:", str(e))

# --- Authentication ---

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user_id': user.id}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key})
    return Response({'msg': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


# --- Location & Push Tokens ---

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_location(request):
    user = request.user
    data = request.data
    print(f"📍 Location update for {user.username}: {data}")
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


# --- Tasks CRUD ---

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        task = serializer.save(user=self.request.user)

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            print(f"Error in TaskViewSet.list: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserContextViewSet(viewsets.ModelViewSet):
    serializer_class = UserContextSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserContext.objects.filter(user=self.request.user).order_by('key')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)



# --- AI Logic ---

ANCHOR_MAP = {
    'עבודה': UserContext.ContextKey.WORK,
    'בית': UserContext.ContextKey.HOME,
    'לימודים': UserContext.ContextKey.SCHOOL,
    'אוניברסיטה': UserContext.ContextKey.SCHOOL,
    'חדר כושר': UserContext.ContextKey.GYM,
    'work': UserContext.ContextKey.WORK,
    'home': UserContext.ContextKey.HOME,
    'school': UserContext.ContextKey.SCHOOL,
    'gym': UserContext.ContextKey.GYM,
}


def infer_context_keys(text):
    if not text:
        return set()
    lowered = text.lower()
    matched = set()
    for anchor, key in ANCHOR_MAP.items():
        if anchor in lowered:
            matched.add(key)
    return matched


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def infer_context(request):
    title = request.data.get('title', '')
    inferred_keys = infer_context_keys(title)
    if not inferred_keys:
        return Response({"pending_contexts": [], "matched_contexts": []})

    existing = set(
        UserContext.objects.filter(user=request.user, key__in=inferred_keys)
        .values_list('key', flat=True)
    )

    pending = [key for key in inferred_keys if key not in existing]
    matched = [key for key in inferred_keys if key in existing]

    label_map = {choice.value: choice.label for choice in UserContext.ContextKey}

    return Response({
        "pending_contexts": [{"key": key, "label": label_map.get(key, key)} for key in pending],
        "matched_contexts": [{"key": key, "label": label_map.get(key, key)} for key in matched],
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ask_ai(request):
    title = request.data.get('title')
    
    if not title:
        return Response({"error": "חסר שם משימה"}, status=400)

    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        
        prompt = f"""אתה עוזר חכם לאפליקציית ניהול משימות. המשתמש ייתן לך תיאור של משימה, ועליך להחזיר *אך ורק* את סוג המקום (באנגלית בלבד) שבו ניתן לבצע אותה. אל תוסיף שום הסבר.
        דוגמה: עבור 'לקנות חלב' תחזיר 'supermarket'.
        המשימה: '{title}'"""

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        location_query = response.text.strip().replace('.', '')

        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.expo_push_token:
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="The AI ​​has found a location! 📍",
                    body=f"for the task '{title}', Search the area: {location_query}"
                )
        except Exception as e:
            print("Push error in AI:", str(e))

        print(f"AI Answered: {location_query}")
        return Response({"locationQuery": location_query})

    except Exception as e:
        print("Gemini API Error details:", str(e))
        return Response({"error": "שגיאה בפנייה למודל ה-AI"}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_update(request):
    current_version = request.query_params.get('current_version')
    latest = AppVersion.objects.order_by('-released_at').first()

    if not latest:
        return Response({"update_available": False})

    update_available = True
    if current_version:
        try:
            update_available = packaging_version.parse(latest.version) > packaging_version.parse(current_version)
        except Exception:
            update_available = True

    return Response({
        "update_available": update_available,
        "version": latest.version,
        "release_notes": latest.release_notes,
        "is_mandatory": latest.is_mandatory,
        "download_url": latest.download_url,
    })