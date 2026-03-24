from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import Task, UserProfile
from .serializers import TaskSerializer, UserSerializer
from exponent_server_sdk import PushClient, PushMessage
from google import genai
import os

# --- פונקציית עזר לשליחת התראות (Helper) ---

def send_expo_push_notification(expo_token, title, body):
    """
    פונקציית עזר לשליחת התראת פוש דרך שרתי Expo
    """
    try:
        # בדיקה שהטוקן תקין לפני השליחה
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
    # כאן אפשר להוסיף לוגיקה שבודקת קרבה למשימות ושולחת פוש אם המשתמש קרוב
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



# --- AI Logic ---

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ask_ai(request):
    title = request.data.get('title')
    taskId = request.data.get('taskId')
    
    if not title:
        return Response({"error": "חסר שם משימה"}, status=400)

    try:
        # אתחול הקליינט החדש של גוגל
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        
        prompt = f"""אתה עוזר חכם לאפליקציית ניהול משימות. המשתמש ייתן לך תיאור של משימה, ועליך להחזיר *אך ורק* את סוג המקום (באנגלית או בעברית) שבו ניתן לבצע אותה. אל תוסיף שום הסבר.
        דוגמה: עבור 'לקנות חלב' תחזיר 'סופרמרקט'.
        המשימה: '{title}'"""

        # קריאה למודל בסינטקס החדש
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        # ניקוי התשובה
        location_query = response.text.strip().replace('.', '')

        # --- הוספת שליחת פוש כשה-AI מסיים לנתח ---
        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.expo_push_token:
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="ה-AI מצא מיקום! 📍",
                    body=f"עבור המשימה '{title}', חפש באזור: {location_query}"
                )
            Task.objects.filter(id=taskId).update(locationQuery=location_query)    
        except Exception as e:
            print("Push error in AI:", str(e))

        print(f"AI Answered: {location_query}")
        return Response({"locationQuery": location_query})

    except Exception as e:
        print("Gemini API Error details:", str(e))
        return Response({"error": "שגיאה בפנייה למודל ה-AI"}, status=500)